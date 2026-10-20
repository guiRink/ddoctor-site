import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import type { OrcamentoVersao } from "@compartilhado/tipos";
import { itensChecklist } from "@compartilhado/dominio/config";
import { formatarReais, somaCentavos } from "@compartilhado/dominio/dinheiro";
import { formatarDocumento } from "@compartilhado/dominio/documento";
import { receitaOS } from "@compartilhado/dominio/custos";
import { dataNoFuso } from "@compartilhado/dominio/fuso";
import { gruposChecklist, progressoChecklist } from "@compartilhado/dominio/recepcao";
import { useAgora, useConfig, useOS } from "../dados/hooks";
import { useSessao } from "../dados/sessao";
import { veDadosSensiveis } from "../dominio/permissoes";
import { NIVEL_COMBUSTIVEL, STATUS_ITEM, TAMANHO_AVARIA, TECNICA, TIPO_AVARIA, VISTA_AVARIA } from "../dominio/rotulos";
import { Botao, Erro, Esqueleto } from "../componentes/ui/Basicos";
import { MarcaD } from "../componentes/ui/Marca";
import { Placa } from "../componentes/ui/Placa";
import { Icone } from "../componentes/Icone";
import { hora, telefoneLegivel } from "../componentes/orcamentos/formato";
import { MedidorCombustivel } from "../componentes/recepcao/FormRecepcao";
import { kmLegivel, nomeCarro } from "../componentes/os/formato";
import { LegendaAvarias, Marcador, VistasAvarias } from "../componentes/recepcao/MapaAvarias";

/**
 * Impressão do orçamento / OS em folha A4 retrato (fora do Layout). Na tela: barra com Voltar e Imprimir
 * e a folha centralizada; no papel (@media print): margens de 12 mm, sem barra, cores dos marcadores preservadas.
 * Dados da oficina: só o que é fato no PRODUCT.md (nome e "martelinho de ouro"); contatos e endereço
 * ainda não confirmados ficam de fora. Observações internas da recepção nunca saem aqui.
 */
const ESTILO_IMPRESSAO = `
@page { size: A4 portrait; margin: 12mm; }
@media print {
  html, body { background: #fff !important; }
}
`;

const dataLonga = (data: string) => {
  const [a, m, d] = data.split("-");
  return `${d}/${m}/${a}`;
};

export function ImprimirOS() {
  const { id } = useParams();
  const { perfil } = useSessao();
  const agora = useAgora(60_000);
  const consulta = useOS(id);
  const config = useConfig();

  const barra = (
    <div className="print:hidden sticky top-0 z-10 bg-cartao border-b border-linha">
      <div className="mx-auto max-w-[210mm] flex items-center justify-between gap-3 px-4 h-14">
        <Link to={`/orcamentos/${id}`} className="inline-flex items-center gap-1.5 h-11 text-[13px] font-medium text-tinta-suave no-underline hover:text-tinta">
          <Icone nome="voltar" tamanho={16} />
          Voltar para a ficha
        </Link>
        <Botao variante="primario" icone="documento" onClick={() => window.print()} disabled={!consulta.data}>
          Imprimir
        </Botao>
      </div>
    </div>
  );

  if (consulta.isError || config.isError) {
    return (
      <div data-tema="claro" className="min-h-svh bg-papel">
        {barra}
        <div className="mx-auto max-w-[210mm] p-4">
          <Erro mensagem="Não consegui carregar esta OS para impressão." onTentar={() => [consulta, config].forEach((c) => c.refetch())} />
        </div>
      </div>
    );
  }
  if (consulta.isPending || !config.data) {
    return (
      <div data-tema="claro" className="min-h-svh bg-papel">
        {barra}
        <div className="mx-auto max-w-[210mm] p-4">
          <Esqueleto linhas={8} />
        </div>
      </div>
    );
  }
  if (consulta.data === null) {
    return (
      <div data-tema="claro" className="min-h-svh bg-papel">
        {barra}
        <div className="mx-auto max-w-[210mm] p-4">
          <Erro mensagem="OS não encontrada. Ela pode ter sido removida junto com os dados de demonstração." />
        </div>
      </div>
    );
  }

  const v = consulta.data;
  const sensivel = veDadosSensiveis(perfil.papel);
  const orcamento = ["rascunho", "aguardando_aprovacao"].includes(v.os.estado);
  // mesma versão vigente da receita única (receitaOS): a aprovada de maior número; sem aprovação, a primeira da lista
  const receita = receitaOS({ versoes: v.versoes, titulos: v.titulos });
  const versao: OrcamentoVersao | undefined = v.versoes.find((x) => x.id === receita.versaoId) ?? v.versoes[0];
  const externo = versao?.tipo === "externo";
  const itens = versao?.itens.filter((i) => i.statusItem !== "dispensado") ?? [];
  const subtotal = somaCentavos(itens.map((i) => i.valor));
  const aprovado = versao?.estado === "aprovado";
  const total = versao ? (aprovado ? receita.autorizado : subtotal) : 0;
  const rec = v.os.recepcao;
  const itensCheck = itensChecklist(config.data);
  const prog = rec ? progressoChecklist(rec.checklist, itensCheck) : null;
  const naoConferidos = rec ? gruposChecklist(itensCheck).flatMap((g) => g.itens).filter((i) => !rec.checklist[i.id]) : [];
  const at = v.atendimentos[0];
  const emitido = `${dataLonga(dataNoFuso(agora))} ${hora(agora)}`;

  return (
    <div data-tema="claro" className="min-h-svh bg-papel print:bg-cartao print:min-h-0">
      <style>{ESTILO_IMPRESSAO}</style>
      {barra}

      <article
        aria-label={orcamento ? "Orçamento para impressão" : "Ordem de serviço para impressão"}
        className="folha mx-auto my-6 w-[210mm] max-w-full min-h-[297mm] bg-cartao border border-linha shadow-cartao px-[14mm] py-[14mm] text-[12px] leading-snug text-tinta [print-color-adjust:exact] [-webkit-print-color-adjust:exact] print:my-0 print:w-auto print:min-h-0 print:border-0 print:shadow-none print:p-0 max-sm:px-4 max-sm:py-5"
      >
        {/* cabeçalho */}
        <header className="flex items-start justify-between gap-6 pb-4 border-b-2 border-tinta">
          <div className="flex items-center gap-3">
            <MarcaD tamanho={40} />
            <div>
              <p className="text-[18px] font-[650] leading-tight tracking-[-0.01em]">D doctor</p>
              <p className="text-[12px] text-tinta-suave">martelinho de ouro</p>
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-[18px] font-[650] leading-tight tracking-[-0.01em]">{orcamento ? "Orçamento" : "Ordem de serviço"}</h1>
            <p className="mt-0.5 numero">
              OS nº <span className="font-semibold">{v.os.numero}</span>
              {versao && (
                <>
                  {" "}
                  · orçamento v{versao.numeroVersao}
                </>
              )}
            </p>
            <p className="text-tinta-suave numero">Emitido em {emitido}</p>
          </div>
        </header>

        {/* cliente e veículo */}
        <div className="grid grid-cols-2 gap-6 py-4 border-b border-linha break-inside-avoid max-sm:grid-cols-1">
          <Bloco titulo="Cliente">
            <Par nome="Nome">{v.cliente.nome}</Par>
            {sensivel && v.cliente.documento && (
              <Par nome={v.cliente.documento.length > 11 ? "CNPJ" : "CPF"}>
                <span className="numero">{formatarDocumento(v.cliente.documento)}</span>
              </Par>
            )}
            {sensivel && (v.cliente.telefone || v.cliente.whatsapp) && (
              <Par nome="Contato">
                <span className="numero">{telefoneLegivel(v.cliente.telefone ?? v.cliente.whatsapp)}</span>
              </Par>
            )}
            {sensivel && v.cliente.email && <Par nome="E-mail">{v.cliente.email}</Par>}
            {sensivel && at && (
              <Par nome="Seguradora">
                {at.seguradora}
                {at.idExterno && <span className="numero"> · protocolo {at.idExterno}</span>}
                {at.numeroSinistro && <span className="numero"> · sinistro {at.numeroSinistro}</span>}
              </Par>
            )}
          </Bloco>
          <Bloco titulo="Veículo">
            <div className="flex items-start gap-4">
              <Placa placa={v.veiculo.placa} tamanho="p" />
              <div className="min-w-0 flex-1">
                <Par nome="Modelo">{nomeCarro(v.veiculo) || "—"}</Par>
                {(v.veiculo.cor || v.veiculo.ano) && <Par nome="Cor / ano">{[v.veiculo.cor, v.veiculo.ano].filter(Boolean).join(" · ")}</Par>}
                {rec?.km !== undefined && <Par nome="Km"><span className="numero">{kmLegivel(rec.km)}</span></Par>}
                {rec?.combustivel && (
                  <Par nome="Combustível">
                    <span className="inline-flex items-center gap-1.5">
                      <MedidorCombustivel nivel={rec.combustivel} />
                      {NIVEL_COMBUSTIVEL[rec.combustivel]}
                    </span>
                  </Par>
                )}
              </div>
            </div>
          </Bloco>
        </div>

        {/* itens */}
        <section aria-label="Itens do orçamento" className="py-4 border-b border-linha">
          <h2 className="text-[13px] font-semibold mb-2">Serviços</h2>
          {itens.length === 0 ? (
            <p className="text-tinta-suave">Nenhuma peça no orçamento.</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-[11px] text-tinta-suave">
                  <th scope="col" className="font-medium py-1.5 pr-2 w-6 border-b border-linha-forte">#</th>
                  <th scope="col" className="font-medium py-1.5 pr-2 border-b border-linha-forte">Peça</th>
                  <th scope="col" className="font-medium py-1.5 pr-2 border-b border-linha-forte">Técnica</th>
                  {externo && <th scope="col" className="font-medium py-1.5 pr-2 border-b border-linha-forte">Situação</th>}
                  {sensivel && <th scope="col" className="font-medium py-1.5 text-right border-b border-linha-forte">Valor</th>}
                </tr>
              </thead>
              <tbody>
                {itens.map((it, i) => (
                  <tr key={it.id} className="border-b border-linha break-inside-avoid">
                    <td className="py-1.5 pr-2 numero text-tinta-suave align-top">{i + 1}</td>
                    <td className="py-1.5 pr-2 align-top">
                      <span className={it.statusItem === "negado" ? "line-through text-tinta-suave" : "font-medium"}>{it.peca}</span>
                      {it.descricao && <span className="block text-[11px] text-tinta-suave">{it.descricao}</span>}
                    </td>
                    <td className="py-1.5 pr-2 align-top">{TECNICA[it.tecnica]}</td>
                    {externo && <td className="py-1.5 pr-2 align-top">{STATUS_ITEM[it.statusItem].texto}</td>}
                    {sensivel && <td className="py-1.5 text-right numero whitespace-nowrap align-top">{it.valor > 0 ? formatarReais(it.valor) : "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {sensivel && versao && itens.length > 0 && (
            <dl className="m-0 mt-3 ml-auto w-full max-w-[78mm] break-inside-avoid">
              <Soma nome="Subtotal">{formatarReais(subtotal)}</Soma>
              {aprovado && total !== subtotal && <Soma nome="Não autorizado">− {formatarReais(subtotal - total)}</Soma>}
              <Soma nome={aprovado ? (externo ? "Total autorizado" : "Total aprovado") : "Total do orçamento"} forte>
                {formatarReais(total)}
              </Soma>
              {versao.franquia !== undefined && versao.franquia > 0 && <Soma nome="Franquia (paga pelo cliente)">{formatarReais(versao.franquia)}</Soma>}
              {externo && versao.complementoParticular !== undefined && versao.complementoParticular > 0 && (
                <Soma nome="Complemento particular">{formatarReais(versao.complementoParticular)}</Soma>
              )}
            </dl>
          )}
        </section>

        {/* recepção */}
        {rec && (
          <section aria-label="Recepção do veículo" className="py-4 border-b border-linha">
            <h2 className="text-[13px] font-semibold mb-2">Estado do veículo na entrada</h2>
            {rec.reclamacao && (
              <p className="mb-3">
                <span className="text-tinta-suave">Reclamação do cliente: </span>
                <span className="whitespace-pre-line">{rec.reclamacao}</span>
              </p>
            )}
            <div className="break-inside-avoid">
              <VistasAvarias avarias={rec.avarias} />
            </div>
            {rec.avarias.length === 0 ? (
              <p className="mt-2 text-tinta-suave">Nenhuma avaria registrada na entrada.</p>
            ) : (
              <ol className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 max-sm:grid-cols-1">
                {rec.avarias.map((a, i) => (
                  <li key={a.id} className="flex items-start gap-2 break-inside-avoid">
                    <Marcador numero={i + 1} tipo={a.tipo} tamanho="p" />
                    <span className="min-w-0">
                      <span className="font-medium">{TIPO_AVARIA[a.tipo]}</span> {TAMANHO_AVARIA[a.tamanho].toLowerCase()} · {VISTA_AVARIA[a.vista].toLowerCase()}
                      {a.obs && <span className="text-tinta-suave"> — {a.obs}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {rec.avarias.length > 0 && <LegendaAvarias className="mt-2" />}
            {prog && (
              <p className="mt-3 break-inside-avoid">
                <span className="font-medium">Checklist:</span>{" "}
                <span className="numero">
                  {prog.marcados} de {prog.total} itens conferidos
                </span>
                {naoConferidos.length > 0 && (
                  <span className="text-tinta-suave"> · não conferidos: {naoConferidos.map((i) => i.nome.toLowerCase()).join(", ")}.</span>
                )}
              </p>
            )}
          </section>
        )}

        {/* assinaturas */}
        <section aria-label="Assinaturas" className="pt-14 pb-4 grid grid-cols-2 gap-12 break-inside-avoid max-sm:grid-cols-1 max-sm:gap-10">
          <Assinatura nome="Assinatura do cliente" detalhe={v.cliente.nome} />
          <Assinatura nome="Responsável pela oficina" detalhe="D doctor" />
        </section>

        <footer className="mt-6 pt-3 border-t border-linha flex justify-between gap-4 text-[10px] text-tinta-fraca">
          <span>Documento gerado pelo painel D doctor</span>
          <span className="numero">
            OS {v.os.numero} · {emitido}
          </span>
        </footer>
      </article>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="min-w-0">
      <h2 className="text-[13px] font-semibold mb-2">{titulo}</h2>
      <dl className="m-0 flex flex-col gap-1">{children}</dl>
    </section>
  );
}

function Par({ nome, children }: { nome: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
      <dt className="text-tinta-suave">{nome}</dt>
      <dd className="m-0 min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Soma({ nome, forte = false, children }: { nome: string; forte?: boolean; children: ReactNode }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1 ${forte ? "border-t border-tinta mt-1 pt-1.5" : ""}`}>
      <dt className={forte ? "font-semibold" : "text-tinta-suave"}>{nome}</dt>
      <dd className={`m-0 numero whitespace-nowrap ${forte ? "text-[14px] font-semibold" : ""}`}>{children}</dd>
    </div>
  );
}

function Assinatura({ nome, detalhe }: { nome: string; detalhe: string }) {
  return (
    <div>
      <div className="border-b border-tinta h-10" />
      <p className="mt-1.5 font-medium">{nome}</p>
      <p className="text-tinta-suave">{detalhe}</p>
      <p className="mt-3 text-tinta-suave">Data: ____/____/________</p>
    </div>
  );
}

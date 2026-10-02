import { Link, useParams } from "react-router-dom";
import { formatISO } from "date-fns";
import { useAtendimento } from "../dados/hooks";
import { diasNaEtapa, formatarPlaca, formatarReais, margem, pendencias, receitaPrevista } from "../dominio/regras";
import { ROTULO_CANAL, ROTULO_ETAPA, ROTULO_ORIGEM, ROTULO_SUB_ETAPA, ROTULO_TECNICA } from "../dominio/rotulos";
import { BotaoLink } from "../componentes/Botao";
import { Cabecalho, Carregando, Demo, EtiquetaEtapa, EtiquetaPendencia } from "../componentes/Pagina";
import { Vazio } from "../componentes/Vazio";

function dataBR(iso?: string): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

function Campo({ nome, valor }: { nome: string; valor?: string | number | null }) {
  return (
    <div className="border-t border-linha py-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
      <dt className="rotulo text-tinta-suave self-center">{nome}</dt>
      <dd className="m-0 text-sm break-words">{valor === undefined || valor === null || valor === "" ? "—" : valor}</dd>
    </div>
  );
}

export function Ficha() {
  const { id } = useParams();
  const atendimento = useAtendimento(id);
  const hoje = formatISO(new Date(), { representation: "date" });

  if (!id) {
    return (
      <>
        <Cabecalho titulo="Novo atendimento" />
        <Vazio
          titulo="O cadastro chega no Sprint 1."
          texto="Aqui vai entrar a ficha única: placa, protocolo da Maxpar, seguradora, cliente, peças solicitadas × autorizadas, franquia e previsão. Por enquanto, use os dados de demonstração para avaliar as telas."
          acao={<BotaoLink para="/ajustes" variante="fantasma">Ir para Ajustes</BotaoLink>}
        />
      </>
    );
  }

  if (atendimento === undefined) return <Carregando />;
  if (atendimento === null) {
    return (
      <>
        <Cabecalho titulo="Atendimento não encontrado" />
        <Vazio titulo="Esse atendimento não existe mais." texto="Ele pode ter sido removido ou fazer parte de uma demonstração já limpa." acao={<BotaoLink para="/atendimentos" variante="fantasma">Voltar à lista</BotaoLink>} />
      </>
    );
  }

  const a = atendimento;
  const alertas = pendencias(a, hoje);
  const autorizadas = a.pecas.filter((p) => p.autorizada === true);
  const negadas = a.pecas.filter((p) => p.autorizada === false);
  const semResposta = a.pecas.filter((p) => p.autorizada === null);

  return (
    <>
      <p className="mb-3 text-sm">
        <Link to="/atendimentos" className="text-tinta-suave hover:text-tinta">← Atendimentos</Link>
      </p>
      <Cabecalho
        titulo={formatarPlaca(a.placa)}
        resumo={`${a.modelo ?? "Modelo não informado"}${a.cor ? ` · ${a.cor}` : ""} · ${a.cliente.nome}`}
        acoes={
          <div className="flex flex-wrap items-center gap-2">
            <EtiquetaEtapa etapa={a.etapa} />
            <Demo ativo={a.demo} />
          </div>
        }
      />

      {alertas.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2" role="status">
          {alertas.map((p) => (
            <EtiquetaPendencia key={p} pendencia={p} />
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-white border border-linha p-4">
          <h2 className="titulo-condensado text-xl mb-2">Atendimento</h2>
          <dl className="m-0">
            <Campo nome="Origem" valor={ROTULO_ORIGEM[a.origem]} />
            <Campo nome="Seguradora" valor={a.seguradora} />
            <Campo nome="Produto" valor={a.produto} />
            <Campo nome="Protocolo" valor={a.protocolo} />
            <Campo nome="Abertura" valor={dataBR(a.abertura)} />
            <Campo nome="Limite da vistoria" valor={dataBR(a.limiteVistoria)} />
            <Campo nome="Corretor" valor={a.corretor} />
            <Campo nome="Telefone" valor={a.cliente.telefone} />
          </dl>
        </section>

        <section className="bg-white border border-linha p-4">
          <h2 className="titulo-condensado text-xl mb-2">Onde está</h2>
          <dl className="m-0">
            <Campo nome="Etapa" valor={`${ROTULO_ETAPA[a.etapa]} · há ${diasNaEtapa(a, hoje)} dia(s)`} />
            <Campo nome="Produção" valor={a.subEtapa ? ROTULO_SUB_ETAPA[a.subEtapa] : undefined} />
            <Campo nome="Box" valor={a.box} />
            <Campo nome="Responsável" valor={a.responsavel} />
            <Campo nome="Previsão ao cliente" valor={dataBR(a.previsaoCliente)} />
            <Campo nome="Previsão no portal" valor={dataBR(a.previsaoPortal)} />
            <Campo nome="Entregue em" valor={dataBR(a.entregueEm)} />
          </dl>
        </section>

        <section className="bg-white border border-linha p-4 md:col-span-2">
          <h2 className="titulo-condensado text-xl mb-3">Peças</h2>
          {a.pecas.length === 0 ? (
            <p className="text-sm text-tinta-suave">Nenhuma peça registrada.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className="rotulo text-tinta-suave">
                  <th className="py-1 font-bold">Peça</th>
                  <th className="py-1 font-bold">Técnica</th>
                  <th className="py-1 font-bold">Situação</th>
                  <th className="py-1 font-bold text-right">Autorizado</th>
                </tr>
              </thead>
              <tbody>
                {a.pecas.map((p) => (
                  <tr key={p.id} className="border-t border-linha">
                    <td className="py-2">{p.nome}</td>
                    <td className="py-2">{ROTULO_TECNICA[p.tecnica]}</td>
                    <td className="py-2">
                      {p.autorizada === true ? <span className="rotulo bg-preto text-papel px-1.5 py-0.5">Autorizada</span> : p.autorizada === false ? <span className="rotulo bg-alerta text-papel px-1.5 py-0.5">Negada</span> : <span className="rotulo border border-linha px-1.5 py-0.5">Sem resposta</span>}
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatarReais(p.valorAutorizado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-sm text-tinta-suave">
            {autorizadas.length} autorizada(s) · {negadas.length} negada(s) · {semResposta.length} sem resposta
          </p>
        </section>

        <section className="bg-white border border-linha p-4">
          <h2 className="titulo-condensado text-xl mb-2">Dinheiro</h2>
          <dl className="m-0">
            <Campo nome="A receber (Maxpar)" valor={formatarReais(a.financeiro.aReceberMaxpar)} />
            <Campo nome="Franquia" valor={a.franquia.valor ? `${formatarReais(a.franquia.valor)} · ${a.franquia.paga ? `paga (${a.franquia.forma ?? "—"})` : "a receber do cliente"}` : "—"} />
            <Campo nome="Complemento particular" valor={formatarReais(a.complemento)} />
            <Campo nome="Receita prevista" valor={formatarReais(receitaPrevista(a))} />
            <Campo nome="Material" valor={formatarReais(a.financeiro.custoMaterial)} />
            <Campo nome="Comissão" valor={formatarReais(a.financeiro.comissao)} />
            <Campo nome="Margem" valor={formatarReais(margem(a))} />
          </dl>
        </section>

        <section className="bg-white border border-linha p-4">
          <h2 className="titulo-condensado text-xl mb-2">Documentação</h2>
          <ul className="m-0 p-0 list-none text-sm grid grid-cols-2 gap-x-4">
            {(
              [
                ["Fotos antes", a.documentacao.fotosAntes],
                ["Fotos depois", a.documentacao.fotosDepois],
                ["PDF na ordem", a.documentacao.pdfOrdem],
                ["Assinatura", a.documentacao.assinatura],
                ["Nota fiscal", a.documentacao.nf],
              ] as const
            ).map(([nome, ok]) => (
              <li key={nome} className="py-1 flex items-center gap-2">
                <span aria-hidden="true" className={`inline-block w-3 h-3 ${ok ? "bg-preto" : "border border-linha"}`} />
                <span className={ok ? "" : "text-tinta-suave"}>{nome}</span>
              </li>
            ))}
          </ul>
          <dl className="m-0 mt-2">
            <Campo nome="Enviada em" valor={dataBR(a.documentacao.enviadaEm)} />
            <Campo nome="Recusas" valor={a.documentacao.recusas.length ? a.documentacao.recusas.map((r) => `${dataBR(r.data)} — ${r.motivo}`).join("; ") : "nenhuma"} />
            <Campo nome="Pago em" valor={a.documentacao.pagoEm ? `${dataBR(a.documentacao.pagoEm)} · ${formatarReais(a.documentacao.valorPago)}` : "—"} />
          </dl>
        </section>

        {(a.contatos.length > 0 || a.observacoes) && (
          <section className="bg-white border border-linha p-4 md:col-span-2">
            <h2 className="titulo-condensado text-xl mb-2">Anotações</h2>
            {a.observacoes && <p className="text-sm whitespace-pre-wrap">{a.observacoes}</p>}
            {a.contatos.length > 0 && (
              <ul className="m-0 mt-3 p-0 list-none text-sm">
                {a.contatos.map((c, i) => (
                  <li key={i} className="border-t border-linha py-2">
                    <span className="rotulo text-tinta-suave">{dataBR(c.data)} · {ROTULO_CANAL[c.canal]} · {c.quem}{c.protocolo ? ` · ${c.protocolo}` : ""}</span>
                    <div>{c.resumo}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
      <p className="mt-6 text-sm text-tinta-suave">Edição da ficha, mudança de etapa e checklist interativo chegam no Sprint 1 e 2.</p>
    </>
  );
}

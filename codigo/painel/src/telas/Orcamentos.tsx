import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { MarcoISO } from "@compartilhado/tipos";
import { formatarReais } from "@compartilhado/dominio/dinheiro";
import { dataNoFuso, diferencaDias } from "@compartilhado/dominio/fuso";
import { useAgora, useOSs } from "../dados/hooks";
import type { OSVisao } from "../dados/repositorio";
import { useSessao } from "../dados/sessao";
import { podeEditar, veDadosSensiveis } from "../dominio/permissoes";
import { ESTADO_OS, ORIGEM_OS } from "../dominio/rotulos";
import { Botao, BotaoLink, CabecalhoPagina, Cartao, Erro, Esqueleto, SUPERFICIE, Vazio } from "../componentes/ui/Basicos";
import { CLASSE_LINHA, Tabela, Th } from "../componentes/ui/Tabela";
import { Etiqueta } from "../componentes/ui/Estado";
import { Placa } from "../componentes/ui/Placa";
import { Icone } from "../componentes/Icone";
import { ha } from "../componentes/orcamentos/formato";
import {
  ABAS_ORCAMENTOS,
  combinaBusca,
  contagemPecas,
  estadosDoFiltro,
  valorDaLista,
  versaoAtual,
} from "../componentes/orcamentos/selecoes";

/**
 * Orçamentos — lista por estado (docs/painel-design.md §5; informações §3.2).
 * Abas com contagem, busca `?q=` vinda do topo, filtro `?estado=` (chave de aba ou estados com vírgula).
 * Tabela no desktop, cartões no celular; a linha abre a ficha da OS.
 */
const PRIMEIRO_OS_MAIS_ANTIGO = new Set(["rascunho", "aguardando_aprovacao", "aguardando_agendamento"]);

export function Orcamentos() {
  const { perfil } = useSessao();
  const agora = useAgora();
  const consulta = useOSs();
  const [params, setParams] = useSearchParams();
  const termo = params.get("q")?.trim() ?? "";
  const filtro = estadosDoFiltro(params.get("estado"));
  const mostraValor = veDadosSensiveis(perfil.papel);
  const podeCriar = podeEditar(perfil.papel, "orcamentos");

  const trocar = (mudanca: Record<string, string | null>) => {
    const novo = new URLSearchParams(params);
    for (const [k, v] of Object.entries(mudanca)) {
      if (v === null) novo.delete(k);
      else novo.set(k, v);
    }
    setParams(novo, { replace: true });
  };

  const cabecalho = <CabecalhoPagina titulo="Orçamentos" resumo="Cada carro, do orçamento à entrega. Abra a linha para ver a ficha." />;

  if (consulta.isPending) {
    return (
      <>
        {cabecalho}
        <div className="esqueleto h-11 mb-4" />
        <Esqueleto linhas={8} />
      </>
    );
  }
  if (consulta.isError || !consulta.data) {
    return (
      <>
        {cabecalho}
        <Erro mensagem="Não consegui carregar os orçamentos." onTentar={() => consulta.refetch()} />
      </>
    );
  }

  const todas = consulta.data;
  if (todas.length === 0) {
    return (
      <>
        {cabecalho}
        <Cartao>
          <Vazio
            icone="orcamentos"
            titulo="Nenhum atendimento ainda"
            texto="Registre o primeiro carro: placa, cliente e peças. Leva uns 30 segundos."
            acao={podeCriar ? <BotaoLink para="/orcamentos/novo" variante="primario" icone="mais">Novo atendimento</BotaoLink> : undefined}
          />
        </Cartao>
      </>
    );
  }

  const buscadas = todas.filter((v) => combinaBusca(v, termo));
  const daAba = (estados: string[]) => (estados.length === 0 ? buscadas : buscadas.filter((v) => estados.includes(v.os.estado)));
  const visiveis = [...daAba(filtro.estados)].sort((a, b) =>
    PRIMEIRO_OS_MAIS_ANTIGO.has(filtro.chave) ? a.os.criadoEm.localeCompare(b.os.criadoEm) : b.os.atualizadoEm.localeCompare(a.os.atualizadoEm),
  );
  const abaConhecida = ABAS_ORCAMENTOS.some((a) => a.chave === filtro.chave);
  const nomeFiltro = filtro.estados.map((e) => ESTADO_OS[e]?.texto ?? e).join(" + ");
  const hoje = dataNoFuso(agora);

  return (
    <>
      {cabecalho}

      <nav aria-label="Filtrar por estado" className="-mx-4 md:mx-0 px-4 md:px-0 overflow-x-auto border-b border-linha mb-4">
        <ul className="flex gap-0.5 min-w-max">
          {ABAS_ORCAMENTOS.map((aba) => {
            const ativa = aba.chave === filtro.chave;
            const n = daAba(aba.estados).length;
            return (
              <li key={aba.chave}>
                <Link
                  to={{ search: novaBusca(params, aba.chave) }}
                  replace
                  aria-current={ativa ? "page" : undefined}
                  className={`flex items-center gap-2 h-11 px-3 text-[14px] no-underline whitespace-nowrap border-b-2 transition-colors duration-150 ${
                    ativa ? "border-amarelo font-semibold text-tinta" : "border-transparent font-medium text-tinta-suave hover:text-tinta hover:border-linha-forte"
                  }`}
                >
                  {aba.nome}
                  <span className={`numero text-[12px] font-medium ${ativa ? "text-tinta-suave" : "text-tinta-fraca"}`}>{n}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {(termo || !abaConhecida) && (
        <div className="flex flex-wrap items-center gap-2 mb-4 text-[14px]">
          {termo && (
            <span className="inline-flex items-center gap-1 h-8 pl-3 pr-0.5 bg-cartao border border-linha-forte rounded-controle shadow-controle">
              <span className="text-tinta-suave">Busca:</span>
              <strong className="font-semibold">“{termo}”</strong>
              <button
                type="button"
                onClick={() => trocar({ q: null })}
                aria-label="Limpar a busca"
                className="inline-grid place-items-center w-7 h-7 rounded-[4px] text-tinta-suave hover:text-tinta hover:bg-cinza-100"
              >
                <Icone nome="fechar" tamanho={16} />
              </button>
            </span>
          )}
          {!abaConhecida && (
            <span className="inline-flex items-center gap-1 h-8 pl-3 pr-0.5 bg-cartao border border-linha-forte rounded-controle shadow-controle">
              <span className="text-tinta-suave">Estado:</span>
              <strong className="font-semibold">{nomeFiltro}</strong>
              <button
                type="button"
                onClick={() => trocar({ estado: null })}
                aria-label="Limpar o filtro de estado"
                className="inline-grid place-items-center w-7 h-7 rounded-[4px] text-tinta-suave hover:text-tinta hover:bg-cinza-100"
              >
                <Icone nome="fechar" tamanho={16} />
              </button>
            </span>
          )}
          <span className="text-tinta-suave numero">
            {visiveis.length} {visiveis.length === 1 ? "resultado" : "resultados"}
          </span>
        </div>
      )}

      {visiveis.length === 0 ? (
        <Cartao>
          {termo ? (
            <Vazio
              icone="busca"
              titulo={`Nada encontrado para “${termo}”`}
              texto="Confira a placa (7 caracteres), o protocolo ou o nome do cliente. Se o carro é novo, registre o atendimento."
              acao={
                <div className="flex flex-wrap gap-2">
                  <Botao onClick={() => trocar({ q: null })}>Limpar busca</Botao>
                  {podeCriar && (
                    <BotaoLink para="/orcamentos/novo" variante="primario" icone="mais">
                      Novo atendimento
                    </BotaoLink>
                  )}
                </div>
              }
            />
          ) : (
            <Vazio
              icone="ok"
              titulo={`Nenhum carro em “${ABAS_ORCAMENTOS.find((a) => a.chave === filtro.chave)?.nome ?? nomeFiltro}”`}
              texto="Quando um carro chegar a esse estado, ele aparece aqui."
              acao={<Botao onClick={() => trocar({ estado: null })}>Ver todos</Botao>}
            />
          )}
        </Cartao>
      ) : (
        <>
          <TabelaOS lista={visiveis} agora={agora} hoje={hoje} mostraValor={mostraValor} />
          <CartoesOS lista={visiveis} agora={agora} hoje={hoje} mostraValor={mostraValor} />
        </>
      )}
    </>
  );
}

function novaBusca(params: URLSearchParams, chave: string): string {
  const novo = new URLSearchParams(params);
  if (chave === "todos") novo.delete("estado");
  else novo.set("estado", chave);
  const s = novo.toString();
  return s ? `?${s}` : "";
}

// ------------------------------------------------------------------ desktop

function TabelaOS({ lista, agora, hoje, mostraValor }: { lista: OSVisao[]; agora: MarcoISO; hoje: string; mostraValor: boolean }) {
  const navegar = useNavigate();
  return (
    <Tabela legenda="Orçamentos e ordens de serviço" className="hidden md:block">
      <thead>
        <tr>
          <Th className="pl-4">Placa</Th>
          <Th>Carro e cliente</Th>
          <Th>Origem e protocolo</Th>
          <Th direita>Peças</Th>
          {mostraValor && <Th direita>Valor autorizado</Th>}
          <Th>Estado</Th>
          <Th direita className="pr-4">Idade</Th>
        </tr>
      </thead>
        <tbody>
          {lista.map((v) => {
            const versao = versaoAtual(v);
            const pecas = contagemPecas(versao);
            const valor = valorDaLista(versao);
            const at = v.atendimentos[0];
            const estado = ESTADO_OS[v.os.estado];
            const idade = diferencaDias(dataNoFuso(v.os.criadoEm), hoje);
            return (
              <tr
                key={v.os.id}
                onClick={() => navegar(`/orcamentos/${v.os.id}`)}
                className={`${CLASSE_LINHA} cursor-pointer`}
              >
                <td className="pl-4 pr-3 py-2 h-[60px] align-middle">
                  <Placa placa={v.veiculo.placa} />
                </td>
                <td className="px-3 py-2 max-w-[260px]">
                  <Link
                    to={`/orcamentos/${v.os.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="block font-semibold text-tinta no-underline hover:underline underline-offset-4 truncate"
                  >
                    {v.veiculo.modelo ?? "Modelo não informado"}
                    <span className="sr-only"> — abrir OS {v.os.numero}</span>
                  </Link>
                  <span className="block text-[13px] text-tinta-suave truncate">{v.cliente.nome}</span>
                </td>
                <td className="px-3 py-2 max-w-[220px]">
                  <span className="block truncate">{at?.seguradora ?? ORIGEM_OS[v.os.origem]}</span>
                  <span className="block text-[13px] text-tinta-suave truncate numero">
                    {at?.idExterno ? `${v.os.origem === "maxpar" ? "Maxpar" : ORIGEM_OS[v.os.origem]} · ${at.idExterno}` : `OS ${v.os.numero}`}
                  </span>
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <span className="numero font-semibold">
                    {pecas.autorizadas}/{pecas.total}
                  </span>
                  {pecas.negadas > 0 && <span className="block text-[12px] font-semibold text-alerta numero">{pecas.negadas} negada{pecas.negadas > 1 ? "s" : ""}</span>}
                </td>
                {mostraValor && (
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {valor.aprovado ? (
                      <span className="numero font-semibold">{formatarReais(valor.valor)}</span>
                    ) : (
                      <span className="text-tinta-fraca numero">
                        {valor.valor > 0 ? formatarReais(valor.valor) : "—"}
                        <span className="block text-[12px]">{valor.valor > 0 ? "orçado" : "sem valor"}</span>
                      </span>
                    )}
                  </td>
                )}
                <td className="px-3 py-2">
                  <Etiqueta tom={estado.tom}>{estado.texto}</Etiqueta>
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <span className="block numero font-semibold">{idade === 0 ? "hoje" : `${idade} d`}</span>
                  <span className="block text-[12px] text-tinta-suave numero">atualiz. {ha(v.os.atualizadoEm, agora)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
    </Tabela>
  );
}

// ------------------------------------------------------------------ celular

function CartoesOS({ lista, agora, hoje, mostraValor }: { lista: OSVisao[]; agora: MarcoISO; hoje: string; mostraValor: boolean }) {
  return (
    <ul className="md:hidden flex flex-col gap-2">
      {lista.map((v) => {
        const versao = versaoAtual(v);
        const pecas = contagemPecas(versao);
        const valor = valorDaLista(versao);
        const at = v.atendimentos[0];
        const estado = ESTADO_OS[v.os.estado];
        const idade = diferencaDias(dataNoFuso(v.os.criadoEm), hoje);
        return (
          <li key={v.os.id}>
            <Link to={`/orcamentos/${v.os.id}`} className={`block ${SUPERFICIE} p-4 no-underline text-tinta active:bg-cinza-50`}>
              <span className="flex items-start justify-between gap-3">
                <Placa placa={v.veiculo.placa} tamanho="m" />
                <Etiqueta tom={estado.tom}>{estado.texto}</Etiqueta>
              </span>
              <span className="block mt-2.5 font-semibold truncate">
                {v.veiculo.modelo ?? "Modelo não informado"}
                <span className="font-normal text-tinta-suave"> · {v.cliente.nome}</span>
              </span>
              <span className="block text-[13px] text-tinta-suave truncate numero">
                {at ? `${at.seguradora} · ${at.idExterno ?? "sem protocolo"}` : ORIGEM_OS[v.os.origem]}
              </span>
              <span className="mt-3 pt-2.5 border-t border-linha flex items-center justify-between gap-3 text-[13px] numero">
                <span>
                  <span className="text-tinta-suave">Peças</span> <strong className="font-semibold">{pecas.autorizadas}/{pecas.total}</strong>
                  {pecas.negadas > 0 && <span className="text-alerta font-semibold"> · {pecas.negadas} negada{pecas.negadas > 1 ? "s" : ""}</span>}
                </span>
                {mostraValor && (
                  <span className={valor.aprovado ? "font-semibold" : "text-tinta-fraca"}>
                    {valor.valor > 0 ? formatarReais(valor.valor) : "—"}
                    {!valor.aprovado && valor.valor > 0 && " orçado"}
                  </span>
                )}
                <span className="text-tinta-suave">{idade === 0 ? "hoje" : `${idade} d`}</span>
              </span>
              <span className="sr-only">Atualizado {ha(v.os.atualizadoEm, agora)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

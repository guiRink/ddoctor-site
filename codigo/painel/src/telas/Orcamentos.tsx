import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { DataISO } from "@compartilhado/tipos";
import { formatarReais } from "@compartilhado/dominio/dinheiro";
import { dataNoFuso } from "@compartilhado/dominio/fuso";
import { useAgora, useOSs } from "../dados/hooks";
import type { OSVisao } from "../dados/repositorio";
import { useSessao } from "../dados/sessao";
import { podeEditar, veDadosSensiveis } from "../dominio/permissoes";
import { ESTADO_OS, ORIGEM_OS } from "../dominio/rotulos";
import { Botao, BotaoLink, CabecalhoPagina, Cartao, Erro, Esqueleto, SUPERFICIE, Vazio } from "../componentes/ui/Basicos";
import { Busca } from "../componentes/ui/Campos";
import { CLASSE_LINHA, Tabela, Th } from "../componentes/ui/Tabela";
import { Etiqueta } from "../componentes/ui/Estado";
import { Placa } from "../componentes/ui/Placa";
import { BarraAbas, ContagemAba, classeAba } from "../componentes/ui/Abas";
import { dataCurta } from "../componentes/orcamentos/formato";
import { contagemPecas, versaoAtual } from "../componentes/orcamentos/selecoes";
import {
  ABAS_ESTADO,
  escreverFiltros,
  filtrarPorEstado,
  filtrarSemEstado,
  FILTROS_VAZIOS,
  lerFiltros,
  nomeDoEstado,
  ordenarLista,
  quantosFiltros,
  seguradorasDe,
  SITUACAO,
  somaDaLista,
  temFiltroAtivo,
  tempoNaSituacao,
  textoHa,
  textoPecas,
  TITULO_ATENDIMENTOS,
  valorDaOS,
  type FiltrosLista,
  type TempoSituacao,
} from "../componentes/orcamentos/lista";
import { BotaoFiltros, GavetaFiltros, PilulasFiltro, SelectsFiltro, ThOrdenavel } from "../componentes/orcamentos/FiltrosLista";

/**
 * Atendimentos (antiga Orçamentos; nome em TITULO_ATENDIMENTOS) — todos os carros, do orçamento à entrega (docs/painel-design.md §5; informações §3.2; sprint SG).
 * Abas por estado com contagem; busca na página (placa com ou sem hífen, cliente, protocolo, sinistro, modelo);
 * filtros de seguradora, origem, valor e "há quanto tempo" (na situação atual, o mais parado em cima);
 * ordenação pelo cabeçalho; soma dos valores no rodapé. Tudo na URL
 * (`?q=&estado=&valor=&tempo=&origem=&seguradora=&ordem=`) para mandar o link.
 * Tabela no desktop, cartões no celular (filtros numa gaveta); a linha abre a ficha da OS.
 */
export function Orcamentos() {
  const { perfil } = useSessao();
  const agora = useAgora();
  const consulta = useOSs();
  const [params, setParams] = useSearchParams();
  const [gaveta, setGaveta] = useState(false);
  const mostraValor = veDadosSensiveis(perfil.papel);
  const podeCriar = podeEditar(perfil.papel, "orcamentos");

  const lidos = lerFiltros(params);
  // quem não vê valor não filtra nem ordena por valor (link de outra pessoa não vaza a faixa)
  const filtros: FiltrosLista = mostraValor
    ? lidos
    : { ...lidos, valor: undefined, ordem: lidos.ordem.startsWith("valor") ? FILTROS_VAZIOS.ordem : lidos.ordem };
  const mudar = (f: FiltrosLista) => setParams(escreverFiltros(f, params), { replace: true });

  const cabecalho = <CabecalhoPagina titulo={TITULO_ATENDIMENTOS} resumo="Todos os carros, do orçamento à entrega." />;

  if (consulta.isPending) {
    return (
      <>
        {cabecalho}
        <div className="esqueleto h-11 mb-4" />
        <div className="esqueleto h-9 mb-4 md:w-[640px]" />
        <Esqueleto linhas={8} altura="h-[60px]" />
      </>
    );
  }
  if (consulta.isError || !consulta.data) {
    return (
      <>
        {cabecalho}
        <Erro mensagem="Não consegui carregar os atendimentos." onTentar={() => consulta.refetch()} />
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

  const hoje = dataNoFuso(agora);
  const semEstado = filtrarSemEstado(todas, filtros, hoje);
  const visiveis = ordenarLista(filtrarPorEstado(semEstado, filtros.estado), filtros.ordem, hoje);
  const contar = (f: FiltrosLista) => filtrarPorEstado(filtrarSemEstado(todas, f, hoje), f.estado).length;
  const seguradoras = seguradorasDe(todas);
  const soma = somaDaLista(visiveis);
  const abas = ABAS_ESTADO.filter((a) => a.chave !== "cancelada" || a.chave === filtros.estado || filtrarPorEstado(semEstado, a.chave).length > 0);
  const n = visiveis.length;

  return (
    <>
      {cabecalho}

      <BarraAbas rotulo="Filtrar por situação" chave={filtros.estado} className="mb-4">
        {abas.map((a) => {
          const ativa = a.chave === filtros.estado;
          return (
            <li key={a.chave}>
              <Link
                to={{ search: `?${escreverFiltros({ ...filtros, estado: a.chave }, params).toString()}` }}
                replace
                aria-current={ativa ? "page" : undefined}
                title={a.explicacao}
                className={classeAba(ativa)}
              >
                {a.nome}
                <ContagemAba n={filtrarPorEstado(semEstado, a.chave).length} ativa={ativa} />
              </Link>
            </li>
          );
        })}
      </BarraAbas>

      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-x-5 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Busca
            valor={filtros.q}
            onMudar={(q) => mudar({ ...filtros, q })}
            rotulo="Buscar nesta lista"
            placeholder="Placa, cliente ou protocolo"
            className="md:w-[384px]"
          />
          <span className="md:hidden">
            <BotaoFiltros quantos={quantosFiltros(filtros)} onAbrir={() => setGaveta(true)} />
          </span>
        </div>
        <div role="group" aria-label="Filtros" className="hidden md:flex flex-wrap items-center gap-x-4 gap-y-2">
          <SelectsFiltro filtros={filtros} onMudar={mudar} seguradoras={seguradoras} mostraValor={mostraValor} />
        </div>
      </div>

      <div className="mb-3 empty:hidden">
        <PilulasFiltro filtros={filtros} onMudar={mudar} mostraValor={mostraValor} />
      </div>

      {n === 0 ? (
        <Cartao>
          {temFiltroAtivo({ ...filtros, estado: "todos" }) ? (
            <Vazio
              icone="busca"
              titulo="Nenhum carro com esses filtros"
              texto={
                filtros.q.trim()
                  ? "Confira a placa (7 caracteres), o protocolo ou o nome do cliente, ou tire algum filtro. Se o carro é novo, registre o atendimento."
                  : "Tire algum filtro ou limpe todos para ver a lista inteira."
              }
              acao={
                <div className="flex flex-wrap gap-2">
                  <Botao onClick={() => mudar(FILTROS_VAZIOS)}>Limpar filtros</Botao>
                  {podeCriar && filtros.q.trim() && (
                    <BotaoLink para="/orcamentos/novo" icone="mais">
                      Novo atendimento
                    </BotaoLink>
                  )}
                </div>
              }
            />
          ) : (
            <Vazio
              icone="ok"
              titulo={`Nenhum carro em “${nomeDoEstado(filtros.estado)}”`}
              texto="Quando um carro chegar a esse estado, ele aparece aqui."
              acao={<Botao onClick={() => mudar({ ...filtros, estado: "todos" })}>Ver todos</Botao>}
            />
          )}
        </Cartao>
      ) : (
        <>
          <TabelaOS lista={visiveis} hoje={hoje} mostraValor={mostraValor} filtros={filtros} onMudar={mudar} soma={soma} />
          <CartoesOS lista={visiveis} hoje={hoje} mostraValor={mostraValor} />
          <p className="md:hidden mt-3 px-1 text-[14px] numero" aria-live="polite">
            <strong className="font-semibold">{n === 1 ? "1 carro" : `${n} carros`}</strong>
            {mostraValor && <span className="text-tinta-suave"> · {formatarReais(soma)}</span>}
          </p>
        </>
      )}

      {gaveta && (
        <GavetaFiltros
          filtros={filtros}
          seguradoras={seguradoras}
          mostraValor={mostraValor}
          contar={contar}
          onAplicar={mudar}
          onFechar={() => setGaveta(false)}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------------ peças de linha

/** Quem paga (a seguradora; nunca "Maxpar") e, embaixo, por onde veio e o protocolo. */
function origemDe(v: OSVisao): { titulo: string; detalhe: string } {
  const at = v.atendimentos[0];
  if (v.os.origem === "particular" || !at) return { titulo: ORIGEM_OS[v.os.origem], detalhe: `OS ${v.os.numero}` };
  const via = v.os.origem === "maxpar" ? "via Maxpar" : v.os.origem === "misto" ? "via Maxpar + particular" : "direta";
  const protocolo = at.idExterno ?? at.numeroSinistro;
  return { titulo: at.seguradora || ORIGEM_OS[v.os.origem], detalhe: protocolo ? `${via} · ${protocolo}` : `${via} · sem protocolo` };
}

/**
 * "há 3 dias" + de quando conta ("desde a entrada"). Agendado mostra o que importa primeiro — "entra amanhã" —
 * e embaixo há quanto foi aberto (é o que conta na ordem, porque ainda não há marco do agendamento).
 */
function TempoCelula({ tempo, emLinha = false }: { tempo: TempoSituacao; emLinha?: boolean }) {
  const atrasada = tempo.extra?.startsWith("entrada atrasada");
  const principal = tempo.extra ?? textoHa(tempo.dias);
  const detalhe = tempo.extra ? `aberto ${textoHa(tempo.dias)}` : tempo.desde;
  if (emLinha) {
    return (
      <>
        <strong className={`font-semibold ${atrasada ? "text-alerta" : ""}`}>{principal}</strong>
        <span className="text-tinta-suave"> · {detalhe}</span>
      </>
    );
  }
  return (
    <>
      <span className={`block font-semibold numero ${atrasada ? "text-alerta" : ""}`}>{principal}</span>
      <span className="block text-[12px] text-tinta-suave numero">{detalhe}</span>
    </>
  );
}

function ValorCelula({ v }: { v: OSVisao }) {
  const valor = valorDaOS(v);
  if (valor.valor <= 0) {
    return (
      <span className="text-tinta-fraca">
        —<span className="block text-[12px]">sem valor</span>
      </span>
    );
  }
  return valor.aprovado ? (
    <span>
      <span className="block font-semibold numero">{formatarReais(valor.valor)}</span>
      <span className="block text-[12px] text-tinta-suave">autorizado</span>
    </span>
  ) : (
    <span className="text-tinta-fraca">
      <span className="block numero">{formatarReais(valor.valor)}</span>
      <span className="block text-[12px]">orçado</span>
    </span>
  );
}

function PecasCelula({ v }: { v: OSVisao }) {
  const p = contagemPecas(versaoAtual(v));
  if (p.total === 0) return <span className="text-tinta-fraca">sem peças</span>;
  return (
    <span>
      <span className="block numero">
        <strong className="font-semibold">{p.autorizadas}</strong> de {p.total}
        <span className="text-tinta-suave"> autorizada{p.total > 1 ? "s" : ""}</span>
      </span>
      {p.negadas > 0 && (
        <span className="block text-[12px] font-semibold text-alerta numero">
          {p.negadas} negada{p.negadas > 1 ? "s" : ""}
        </span>
      )}
    </span>
  );
}

// ------------------------------------------------------------------ desktop

function TabelaOS({
  lista,
  hoje,
  mostraValor,
  filtros,
  onMudar,
  soma,
}: {
  lista: OSVisao[];
  hoje: DataISO;
  mostraValor: boolean;
  filtros: FiltrosLista;
  onMudar: (f: FiltrosLista) => void;
  soma: number;
}) {
  const navegar = useNavigate();
  const ordenar = (ordem: FiltrosLista["ordem"]) => onMudar({ ...filtros, ordem });
  return (
    <Tabela legenda={`${TITULO_ATENDIMENTOS}: carros, do orçamento à entrega`} className="hidden md:block">
      <thead>
        <tr>
          <Th className="pl-4 w-[124px]">Placa</Th>
          <Th>Carro e cliente</Th>
          <Th>Origem</Th>
          <Th direita>Peças</Th>
          {mostraValor && (
            <ThOrdenavel coluna="valor" ordem={filtros.ordem} onOrdenar={ordenar} direita titulo="Valor">
              Valor
            </ThOrdenavel>
          )}
          <ThOrdenavel coluna="estado" ordem={filtros.ordem} onOrdenar={ordenar} titulo="Situação">
            Situação
          </ThOrdenavel>
          <ThOrdenavel coluna="tempo" ordem={filtros.ordem} onOrdenar={ordenar} direita titulo="Há quanto tempo" className="pr-4">
            Há quanto tempo
          </ThOrdenavel>
        </tr>
      </thead>
      <tbody>
        {lista.map((v) => {
          const estado = ESTADO_OS[v.os.estado];
          const tempo = tempoNaSituacao(v, hoje);
          const origem = origemDe(v);
          const modelo = v.veiculo.modelo ?? "Modelo não informado";
          return (
            <tr key={v.os.id} onClick={() => navegar(`/orcamentos/${v.os.id}`)} className={`${CLASSE_LINHA} cursor-pointer`}>
              <td className="pl-4 pr-3 py-2 h-[60px] align-middle">
                <Placa placa={v.veiculo.placa} />
              </td>
              <td className="px-3 py-2 max-w-[260px]">
                <Link
                  to={`/orcamentos/${v.os.id}`}
                  onClick={(e) => e.stopPropagation()}
                  title={`${modelo} · ${v.cliente.nome}`}
                  className="block font-semibold text-tinta no-underline hover:underline underline-offset-4 truncate"
                >
                  {modelo}
                  <span className="sr-only"> — abrir OS {v.os.numero}</span>
                </Link>
                <span className="block text-[13px] text-tinta-suave truncate">{v.cliente.nome}</span>
              </td>
              <td className="px-3 py-2 max-w-[200px]" title={`${origem.titulo} · ${origem.detalhe}`}>
                <span className="block truncate">{origem.titulo}</span>
                <span className="block text-[13px] text-tinta-suave truncate numero">{origem.detalhe}</span>
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                <PecasCelula v={v} />
              </td>
              {mostraValor && (
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <ValorCelula v={v} />
                </td>
              )}
              <td className="px-3 py-2">
                <Etiqueta tom={estado.tom}>{SITUACAO[v.os.estado]}</Etiqueta>
              </td>
              <td className="px-4 py-2 text-right whitespace-nowrap" title={`Aberto em ${dataCurta(dataNoFuso(v.os.criadoEm))}`}>
                <TempoCelula tempo={tempo} />
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="border-t border-linha bg-cinza-50">
          <td colSpan={4} className="pl-4 pr-3 h-11 text-[13px] numero" aria-live="polite">
            <strong className="font-semibold">{lista.length === 1 ? "1 carro" : `${lista.length} carros`}</strong>
          </td>
          {mostraValor && (
            <td className="px-3 h-11 text-right whitespace-nowrap numero">
              <span className="sr-only">Soma dos valores: </span>
              <strong className="font-semibold">{formatarReais(soma)}</strong>
            </td>
          )}
          <td colSpan={2} className="px-4 h-11 text-[12px] text-tinta-suave">
            {mostraValor ? "soma do autorizado e do orçado" : ""}
          </td>
        </tr>
      </tfoot>
    </Tabela>
  );
}

// ------------------------------------------------------------------ celular

function CartoesOS({ lista, hoje, mostraValor }: { lista: OSVisao[]; hoje: DataISO; mostraValor: boolean }) {
  return (
    <ul className="md:hidden flex flex-col gap-2 list-none m-0 p-0">
      {lista.map((v) => {
        const p = contagemPecas(versaoAtual(v));
        const valor = valorDaOS(v);
        const estado = ESTADO_OS[v.os.estado];
        const origem = origemDe(v);
        const tempo = tempoNaSituacao(v, hoje);
        return (
          <li key={v.os.id}>
            <Link to={`/orcamentos/${v.os.id}`} className={`block ${SUPERFICIE} p-4 no-underline text-tinta active:bg-cinza-50`}>
              <span className="flex items-start justify-between gap-3">
                <Placa placa={v.veiculo.placa} tamanho="m" />
                <Etiqueta tom={estado.tom}>{SITUACAO[v.os.estado]}</Etiqueta>
              </span>
              <span className="block mt-2.5 font-semibold truncate">
                {v.veiculo.modelo ?? "Modelo não informado"}
                <span className="font-normal text-tinta-suave"> · {v.cliente.nome}</span>
              </span>
              <span className="block text-[13px] text-tinta-suave truncate numero">
                {origem.titulo} · {origem.detalhe}
              </span>
              <span className="mt-3 pt-2.5 border-t border-linha grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px] numero">
                <span className="text-tinta-suave">Há quanto tempo</span>
                <span className="text-right">
                  <TempoCelula tempo={tempo} emLinha />
                </span>
                <span className="text-tinta-suave">Peças</span>
                <span className="text-right">
                  {p.total === 0 ? <span className="text-tinta-fraca">sem peças</span> : textoPecas(p.autorizadas, p.total)}
                  {p.negadas > 0 && (
                    <span className="text-alerta font-semibold">
                      {" "}
                      · {p.negadas} negada{p.negadas > 1 ? "s" : ""}
                    </span>
                  )}
                </span>
                {mostraValor && (
                  <>
                    <span className="text-tinta-suave">Valor</span>
                    <span className="text-right">
                      {valor.valor <= 0 ? (
                        <span className="text-tinta-fraca">sem valor</span>
                      ) : valor.aprovado ? (
                        <>
                          <strong className="font-semibold">{formatarReais(valor.valor)}</strong> <span className="text-tinta-suave">autorizado</span>
                        </>
                      ) : (
                        <span className="text-tinta-fraca">{formatarReais(valor.valor)} orçado</span>
                      )}
                    </span>
                  </>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

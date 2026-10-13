import { Fragment, useMemo, useState, type FormEvent } from "react";
import type { Id, Pagador, TituloReceber } from "@compartilhado/tipos";
import { estadoTitulo, faixaAging, saldoTitulo, type FaixaAging } from "@compartilhado/dominio/financeiro";
import { formatarReais, reaisParaCentavos, somaCentavos } from "@compartilhado/dominio/dinheiro";
import { dataNoFuso, diferencaDias } from "@compartilhado/dominio/fuso";
import { mensagemErro, useAcoes, useAgora, useOSs, usePagadores, useTitulos } from "../dados/hooks";
import type { OSVisao } from "../dados/repositorio";
import { useSessao } from "../dados/sessao";
import { podeEditar } from "../dominio/permissoes";
import { ESTADO_TITULO } from "../dominio/rotulos";
import { Botao, CabecalhoPagina, SUPERFICIE, Vazio } from "../componentes/ui/Basicos";
import { Etiqueta, Provisorio } from "../componentes/ui/Estado";
import { Icone } from "../componentes/Icone";
import { EstadoConsultas } from "../componentes/gestao/Consultas";
import { PlacaOS, Retorno } from "../componentes/gestao/Comuns";
import { GrupoFiltros } from "../componentes/ui/Filtros";
import { Linha, Tabela, Td, Th } from "../componentes/gestao/Tabela";
import { FAIXAS, resumoAging } from "../componentes/gestao/resumos";
import {
  CLASSE_CAMPO,
  FAIXA_AGING,
  FORMAS_RECEBIMENTO,
  TIPO_PAGADOR,
  centavosParaCampo,
  dataCurta,
  descreverPrazo,
} from "../componentes/gestao/formato";

type FiltroEstado = "abertos" | "vencidos" | "recebidos" | "todos";
type FiltroPagador = "todos" | Pagador["tipo"];

const FECHADO = new Set(["recebido", "cancelado"]);

// Cor só quando há título na faixa: ponto + rótulo na cor do atraso (sem faixa colorida na borda).
const COR_FAIXA: Record<FaixaAging, { ponto?: string; texto: string }> = {
  a_vencer: { texto: "text-tinta-suave" },
  "0_30": { ponto: "bg-atencao", texto: "text-atencao" },
  "31_60": { ponto: "bg-alerta", texto: "text-alerta" },
  "61_mais": { ponto: "bg-alerta", texto: "text-alerta" },
};

export function Recebiveis() {
  const titulosQ = useTitulos();
  const ossQ = useOSs();
  const pagadoresQ = usePagadores();
  return (
    <>
      <EstadoConsultas consultas={[titulosQ, ossQ, pagadoresQ]} linhas={8}>
        {() => <Conteudo titulos={titulosQ.data!} oss={ossQ.data!} pagadores={pagadoresQ.data!} />}
      </EstadoConsultas>
    </>
  );
}

function Conteudo({ titulos, oss, pagadores }: { titulos: TituloReceber[]; oss: OSVisao[]; pagadores: Pagador[] }) {
  const agora = useAgora(60_000);
  const hoje = dataNoFuso(agora);
  const { perfil } = useSessao();
  const podeReceber = podeEditar(perfil.papel, "recebiveis");

  const [faixa, setFaixa] = useState<FaixaAging | null>(null);
  const [filtroPagador, setFiltroPagador] = useState<FiltroPagador>("todos");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("abertos");
  const [aberto, setAberto] = useState<Id | null>(null);

  const porOS = useMemo(() => new Map(oss.map((v) => [v.os.id, v])), [oss]);
  const porPagador = useMemo(() => new Map(pagadores.map((p) => [p.id, p])), [pagadores]);
  const aging = useMemo(() => resumoAging(titulos, hoje), [titulos, hoje]);

  const abertos = titulos.filter((t) => !FECHADO.has(t.estado));
  const totalAberto = somaCentavos(abertos.map(saldoTitulo));
  const vencido = aging["0_30"].total + aging["31_60"].total + aging["61_mais"].total;

  const passaEstado = (t: TituloReceber) => {
    if (faixa) return faixaAging(t, hoje) === faixa;
    if (filtroEstado === "abertos") return !FECHADO.has(t.estado);
    if (filtroEstado === "vencidos") return estadoTitulo(t, hoje) === "vencido";
    if (filtroEstado === "recebidos") return t.estado === "recebido";
    return true;
  };
  const tipoDe = (t: TituloReceber) => porPagador.get(t.pagadorId)?.tipo;
  const noEstado = titulos.filter(passaEstado);
  const lista = noEstado
    .filter((t) => filtroPagador === "todos" || tipoDe(t) === filtroPagador)
    .sort((a, b) =>
      filtroEstado === "recebidos" && !faixa ? b.vencimento.localeCompare(a.vencimento) : a.vencimento.localeCompare(b.vencimento),
    );

  const tiposPresentes = (["maxpar", "cliente", "seguradora", "outro"] as const).filter((tp) => pagadores.some((p) => p.tipo === tp));
  const maxpar = pagadores.find((p) => p.tipo === "maxpar");

  function escolherFaixa(f: FaixaAging) {
    setFaixa((atual) => (atual === f ? null : f));
    setFiltroEstado("abertos");
    setAberto(null);
  }
  function limpar() {
    setFaixa(null);
    setFiltroPagador("todos");
    setFiltroEstado("abertos");
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Recebíveis"
        resumo={
          abertos.length ? (
            <>
              Em aberto <strong className="numero text-tinta whitespace-nowrap">{formatarReais(totalAberto)}</strong> em{" "}
              <span className="numero">{abertos.length}</span> {abertos.length === 1 ? "título" : "títulos"}
              {vencido > 0 && (
                <>
                  {" · "}vencido <strong className="numero text-alerta whitespace-nowrap">{formatarReais(vencido)}</strong>
                </>
              )}
            </>
          ) : (
            "Nenhum título em aberto."
          )
        }
      />

      {/* ---------------- faixa de aging (elemento dominante) */}
      <section aria-label="Saldo em aberto por atraso" className={`grid grid-cols-2 lg:grid-cols-4 ${SUPERFICIE} overflow-hidden`}>
        {FAIXAS.map((f, i) => {
          const ativo = faixa === f;
          const { total, quantidade } = aging[f];
          return (
            <button
              key={f}
              type="button"
              aria-pressed={ativo}
              onClick={() => escolherFaixa(f)}
              className={`relative text-left px-4 py-3.5 min-h-[100px] transition-colors duration-150 border-linha focus-visible:outline-offset-[-2px] ${
                i % 2 === 1 ? "border-l" : ""
              } ${i >= 2 ? "border-t lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""} ${
                ativo ? "bg-cinza-100" : "hover:bg-cinza-50"
              }`}
            >
              <span className={`flex items-center gap-1.5 text-[13px] font-medium ${quantidade ? COR_FAIXA[f].texto : "text-tinta-suave"}`}>
                {quantidade > 0 && COR_FAIXA[f].ponto && <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full shrink-0 ${COR_FAIXA[f].ponto}`} />}
                {FAIXA_AGING[f].texto}
              </span>
              <span className="block mt-1 text-[22px] md:text-[28px] font-semibold tracking-[-0.01em] numero leading-none whitespace-nowrap">
                {formatarReais(total)}
              </span>
              <span className="block mt-1.5 text-[12px] text-tinta-suave numero">
                {quantidade} {quantidade === 1 ? "título" : "títulos"}
                {ativo && <span className="font-medium text-tinta"> · filtrando</span>}
              </span>
            </button>
          );
        })}
      </section>
      <p className="mt-2.5 text-[13px] text-tinta-suave max-w-[90ch]">
        Atraso contado da data de vencimento. O vencimento segue a regra do pagador
        {maxpar && (
          <>
            {" "}— Maxpar: <Provisorio>{descreverPrazo(maxpar)}</Provisorio>
          </>
        )}
        . Prazos provisórios — a confirmar com a oficina (Ajustes → Pagadores e prazos).
      </p>

      {/* ---------------- filtros */}
      <div className="mt-6 mb-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        <GrupoFiltros<FiltroPagador>
          rotulo="Pagador"
          valor={filtroPagador}
          onMudar={setFiltroPagador}
          opcoes={[
            { valor: "todos", texto: "Todos", contagem: noEstado.length },
            ...tiposPresentes.map((tp) => ({
              valor: tp,
              texto: TIPO_PAGADOR[tp],
              contagem: noEstado.filter((t) => tipoDe(t) === tp).length,
            })),
          ]}
        />
        <GrupoFiltros<FiltroEstado>
          rotulo="Estado"
          valor={faixa ? "abertos" : filtroEstado}
          onMudar={(v) => {
            setFaixa(null);
            setFiltroEstado(v);
          }}
          opcoes={[
            { valor: "abertos", texto: "Em aberto" },
            { valor: "vencidos", texto: "Vencidos" },
            { valor: "recebidos", texto: "Recebidos" },
            { valor: "todos", texto: "Todos" },
          ]}
        />
        {faixa && (
          <Botao tamanho="denso" variante="fantasma" icone="fechar" onClick={() => setFaixa(null)}>
            Tirar filtro “{FAIXA_AGING[faixa].curto}”
          </Botao>
        )}
      </div>

      {titulos.length === 0 ? (
        <div className={SUPERFICIE}>
          <Vazio
            icone="recebiveis"
            titulo="Nenhum título ainda"
            texto="Os títulos nascem na entrega do carro: franquia e complemento do cliente, mão de obra da Maxpar ou da seguradora. O lançamento manual chega na etapa do financeiro."
          />
        </div>
      ) : lista.length === 0 ? (
        <div className={SUPERFICIE}>
          <Vazio
            icone="filtro"
            titulo="Nenhum título com esses filtros"
            texto="Troque o pagador ou o estado, ou volte para todos os títulos em aberto."
            acao={
              <Botao tamanho="denso" onClick={limpar}>
                Limpar filtros
              </Botao>
            }
          />
        </div>
      ) : (
        <>
          {/* ---------------- tabela (recepção 1366 px) */}
          <Tabela legenda="Títulos a receber" className="hidden md:block">
            <thead>
              <tr>
                <Th>Placa</Th>
                <Th>Descrição</Th>
                <Th>Pagador</Th>
                <Th>NF</Th>
                <Th>Vencimento</Th>
                <Th direita>Valor</Th>
                <Th direita>Saldo</Th>
                <Th>Estado</Th>
                <Th>
                  <span className="sr-only">Ações</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {lista.map((t) => {
                const v = porOS.get(t.osId);
                const est = estadoTitulo(t, hoje);
                const saldo = saldoTitulo(t);
                const recebido = t.valor - saldo;
                const estaAberto = aberto === t.id;
                const pagador = porPagador.get(t.pagadorId);
                return (
                  <Fragment key={t.id}>
                    <Linha destaque={estaAberto}>
                      <Td className="w-[112px]">
                        <PlacaOS v={v} />
                      </Td>
                      <Td className="min-w-[180px]">
                        <span className="block font-medium leading-snug">{t.descricao}</span>
                        {v && (
                          <span className="block text-[12px] text-tinta-suave numero">
                            OS {v.os.numero}
                            {v.veiculo.modelo && ` · ${v.veiculo.modelo}`}
                          </span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap">{pagador ? TIPO_PAGADOR[pagador.tipo] : "—"}</Td>
                      <Td className="whitespace-nowrap numero">
                        {t.nfNumero ? (
                          <>
                            <span className="block">{t.nfNumero}</span>
                            <span className="block text-[12px] text-tinta-suave">{dataCurta(t.nfEmitidaEm, hoje.slice(0, 4))}</span>
                          </>
                        ) : (
                          <span className="text-tinta-fraca">sem NF</span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap numero">
                        <Vencimento titulo={t} hoje={hoje} />
                      </Td>
                      <Td numero>{formatarReais(t.valor)}</Td>
                      <Td numero>
                        <span className="block font-semibold">{formatarReais(saldo)}</span>
                        {recebido > 0 && saldo > 0 && <span className="block text-[12px] text-tinta-suave">recebido {formatarReais(recebido)}</span>}
                      </Td>
                      <Td>
                        <Etiqueta tom={ESTADO_TITULO[est].tom}>{ESTADO_TITULO[est].texto}</Etiqueta>
                      </Td>
                      <Td className="text-right whitespace-nowrap">
                        <BotaoLinha titulo={t} placa={v?.veiculo.placa} podeReceber={podeReceber} aberto={estaAberto} onAlternar={() => setAberto(estaAberto ? null : t.id)} />
                      </Td>
                    </Linha>
                    {estaAberto && (
                      <tr className="bg-cinza-50 border-b border-linha">
                        <td colSpan={9} className="px-3 pb-4 pt-1">
                          <PainelTitulo titulo={t} hoje={hoje} podeReceber={podeReceber} onFechar={() => setAberto(null)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </Tabela>

          {/* ---------------- lista em cartões (celular 390 px) */}
          <ul className="md:hidden flex flex-col gap-2" aria-label="Títulos a receber">
            {lista.map((t) => {
              const v = porOS.get(t.osId);
              const est = estadoTitulo(t, hoje);
              const saldo = saldoTitulo(t);
              const pagador = porPagador.get(t.pagadorId);
              const estaAberto = aberto === t.id;
              return (
                <li key={t.id} className={`${SUPERFICIE} p-4`}>
                  <div className="flex items-start justify-between gap-2">
                    <PlacaOS v={v} />
                    <Etiqueta tom={ESTADO_TITULO[est].tom}>{ESTADO_TITULO[est].texto}</Etiqueta>
                  </div>
                  <p className="mt-2.5 font-medium leading-snug">{t.descricao}</p>
                  <p className="text-[13px] text-tinta-suave">
                    {pagador ? TIPO_PAGADOR[pagador.tipo] : "—"}
                    {t.nfNumero ? ` · NF ${t.nfNumero}` : " · sem NF"}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-[12px] text-tinta-suave">Vencimento</dt>
                      <dd className="m-0 numero">
                        <Vencimento titulo={t} hoje={hoje} />
                      </dd>
                    </div>
                    <div className="text-right">
                      <dt className="text-[12px] text-tinta-suave">Saldo</dt>
                      <dd className="m-0 numero font-semibold text-[16px]">{formatarReais(saldo)}</dd>
                      {saldo !== t.valor && <dd className="m-0 numero text-[12px] text-tinta-suave">de {formatarReais(t.valor)}</dd>}
                    </div>
                  </dl>
                  <div className="mt-3">
                    <BotaoLinha titulo={t} placa={v?.veiculo.placa} podeReceber={podeReceber} aberto={estaAberto} grande onAlternar={() => setAberto(estaAberto ? null : t.id)} />
                  </div>
                  {estaAberto && (
                    <div className="mt-3 pt-3 border-t border-linha">
                      <PainelTitulo titulo={t} hoje={hoje} podeReceber={podeReceber} onFechar={() => setAberto(null)} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[12px] text-tinta-fraca numero">
            {lista.length} {lista.length === 1 ? "título" : "títulos"} · saldo {formatarReais(somaCentavos(lista.map(saldoTitulo)))}
          </p>
        </>
      )}
    </>
  );
}

function Vencimento({ titulo, hoje }: { titulo: TituloReceber; hoje: string }) {
  const atraso = diferencaDias(titulo.vencimento, hoje);
  const fechado = FECHADO.has(titulo.estado);
  return (
    <>
      <span className="block">{dataCurta(titulo.vencimento, hoje.slice(0, 4))}</span>
      {!fechado && atraso > 0 && (
        <span className="block text-[12px] font-medium text-alerta">
          há {atraso} {atraso === 1 ? "dia" : "dias"}
        </span>
      )}
      {!fechado && atraso === 0 && <span className="block text-[12px] font-medium text-atencao">vence hoje</span>}
      {!fechado && atraso < 0 && atraso >= -7 && (
        <span className="block text-[12px] text-tinta-suave">
          em {-atraso} {atraso === -1 ? "dia" : "dias"}
        </span>
      )}
    </>
  );
}

function BotaoLinha({
  titulo,
  placa,
  podeReceber,
  aberto,
  grande = false,
  onAlternar,
}: {
  titulo: TituloReceber;
  placa?: string;
  podeReceber: boolean;
  aberto: boolean;
  grande?: boolean;
  onAlternar: () => void;
}) {
  const fechado = FECHADO.has(titulo.estado);
  const alvo = `${titulo.descricao}${placa ? `, placa ${placa}` : ""}`;
  const tamanho = grande ? "padrao" : "denso";
  const largura = grande ? "w-full" : "";
  if (aberto)
    return (
      <Botao tamanho={tamanho} variante="fantasma" className={largura} aria-expanded onClick={onAlternar} aria-label={`Fechar — ${alvo}`}>
        Fechar
      </Botao>
    );
  if (podeReceber && !fechado)
    return (
      <Botao tamanho={tamanho} variante="contorno" className={largura} aria-expanded={false} onClick={onAlternar} aria-label={`Receber — ${alvo}`}>
        Receber
      </Botao>
    );
  if (titulo.baixas.length > 0)
    return (
      <Botao tamanho={tamanho} variante="fantasma" className={largura} aria-expanded={false} onClick={onAlternar} aria-label={`Baixas (${titulo.baixas.length}) — ${alvo}`}>
        Baixas ({titulo.baixas.length})
      </Botao>
    );
  return null;
}

/** Baixas já registradas + formulário de recebimento (valor padrão = saldo). */
function PainelTitulo({ titulo, hoje, podeReceber, onFechar }: { titulo: TituloReceber; hoje: string; podeReceber: boolean; onFechar: () => void }) {
  const acoes = useAcoes();
  const saldo = saldoTitulo(titulo);
  const [valor, setValor] = useState(centavosParaCampo(saldo));
  const [data, setData] = useState(hoje);
  const [forma, setForma] = useState<string>(FORMAS_RECEBIMENTO[0]);
  const [erro, setErro] = useState<string>();
  const podeFormulario = podeReceber && !FECHADO.has(titulo.estado) && saldo > 0;
  const id = `baixa-${titulo.id}`;

  async function registrar(e: FormEvent) {
    e.preventDefault();
    setErro(undefined);
    const centavos = reaisParaCentavos(valor);
    if (centavos === null || centavos <= 0) return setErro("Informe um valor maior que zero, como 1.234,56.");
    if (centavos > saldo) return setErro(mensagemErro("baixa_maior_que_saldo"));
    if (!data) return setErro("Informe a data do recebimento.");
    try {
      const r = await acoes.aplicarBaixa.mutateAsync([titulo.id, { valor: centavos, recebidoEm: data, forma }]);
      if (!r.ok) return setErro(mensagemErro(r.codigo));
      onFechar();
    } catch {
      setErro(mensagemErro());
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] bg-cartao border border-linha rounded-cartao shadow-cartao p-4">
      <div className="min-w-0">
        <h3 className="text-[13px] font-semibold mb-2">Baixas registradas</h3>
        {titulo.baixas.length === 0 ? (
          <p className="text-[13px] text-tinta-suave">Nenhuma baixa ainda.</p>
        ) : (
          <ul className="flex flex-col">
            {titulo.baixas.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-linha last:border-b-0 text-[13px]">
                <span className="numero">
                  {dataCurta(b.recebidoEm, hoje.slice(0, 4))} · {b.forma}
                </span>
                <span className="numero font-semibold">{formatarReais(b.valor)}</span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 pt-2 text-[13px]">
              <span className="text-tinta-suave">Saldo</span>
              <span className="numero font-semibold">{formatarReais(saldo)}</span>
            </li>
          </ul>
        )}
      </div>

      {podeFormulario ? (
        <form onSubmit={registrar} aria-label="Registrar recebimento" className="min-w-0">
          <h3 className="text-[13px] font-semibold mb-2">Registrar recebimento</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1" htmlFor={`${id}-valor`}>
              <span className="text-[13px] font-medium text-tinta-suave">Valor (R$)</span>
              <input
                id={`${id}-valor`}
                inputMode="decimal"
                autoComplete="off"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className={`${CLASSE_CAMPO} numero text-right`}
                aria-describedby={`${id}-dica`}
              />
            </label>
            <label className="flex flex-col gap-1" htmlFor={`${id}-data`}>
              <span className="text-[13px] font-medium text-tinta-suave">Recebido em</span>
              <input id={`${id}-data`} type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value)} className={`${CLASSE_CAMPO} numero`} />
            </label>
            <label className="flex flex-col gap-1" htmlFor={`${id}-forma`}>
              <span className="text-[13px] font-medium text-tinta-suave">Forma</span>
              <span className="relative flex">
                <select id={`${id}-forma`} value={forma} onChange={(e) => setForma(e.target.value)} className={`${CLASSE_CAMPO} appearance-none pr-8 cursor-pointer`}>
                  {FORMAS_RECEBIMENTO.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
                <Icone nome="baixo" tamanho={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-tinta-suave" />
              </span>
            </label>
          </div>
          <p id={`${id}-dica`} className="mt-1.5 text-[12px] text-tinta-suave">
            Valor menor que o saldo fica como recebimento parcial.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Botao type="submit" variante="primario" tamanho="denso" className="max-md:h-11" disabled={acoes.aplicarBaixa.isPending}>
              {acoes.aplicarBaixa.isPending ? "Registrando…" : "Registrar recebimento"}
            </Botao>
            <Botao variante="fantasma" tamanho="denso" className="max-md:h-11" onClick={onFechar}>
              Cancelar
            </Botao>
            <Retorno erro={erro} />
          </div>
        </form>
      ) : (
        <p className="text-[13px] text-tinta-suave self-center">
          {FECHADO.has(titulo.estado)
            ? "Título fechado: não aceita novas baixas."
            : "Só o financeiro, o dono e o gestor registram recebimentos."}
        </p>
      )}
    </div>
  );
}

import { useState, type FormEvent } from "react";
import type { Despesa, Pagador, TituloReceber } from "@compartilhado/tipos";
import { formatarReais, reaisParaCentavos, somaCentavos } from "@compartilhado/dominio/dinheiro";
import { dataNoFuso, diferencaDias } from "@compartilhado/dominio/fuso";
import { mensagemErro, useAcoes, useAgora, useDespesas, useOSs, usePagadores, useTitulos } from "../dados/hooks";
import type { OSVisao } from "../dados/repositorio";
import { useSessao } from "../dados/sessao";
import { podeEditar } from "../dominio/permissoes";
import { Botao, CabecalhoPagina, Cartao, Vazio } from "../componentes/ui/Basicos";
import { Etiqueta } from "../componentes/ui/Estado";
import { EstadoConsultas } from "../componentes/gestao/Consultas";
import { AcaoFutura, Numero, PlacaOS, Retorno } from "../componentes/gestao/Comuns";
import { BarraPrevistoPago } from "../componentes/gestao/Barras";
import { baixasRecentes, despesasAPagar, despesasPorCategoria, resumoMes } from "../componentes/gestao/resumos";
import { CLASSE_CAMPO, TIPO_PAGADOR, centavosParaCampo, dataComSemana, dataCurta, nomeMes } from "../componentes/gestao/formato";

export function Financeiro() {
  const titulosQ = useTitulos();
  const despesasQ = useDespesas();
  const ossQ = useOSs();
  const pagadoresQ = usePagadores();
  return (
    <EstadoConsultas consultas={[titulosQ, despesasQ, ossQ, pagadoresQ]} linhas={8}>
      {() => <Conteudo titulos={titulosQ.data!} despesas={despesasQ.data!} oss={ossQ.data!} pagadores={pagadoresQ.data!} />}
    </EstadoConsultas>
  );
}

function Conteudo({ titulos, despesas, oss, pagadores }: { titulos: TituloReceber[]; despesas: Despesa[]; oss: OSVisao[]; pagadores: Pagador[] }) {
  const agora = useAgora(60_000);
  const hoje = dataNoFuso(agora);
  const ano = hoje.slice(0, 4);
  const { perfil } = useSessao();
  const podePagar = podeEditar(perfil.papel, "financeiro");

  const resumo = resumoMes(titulos, despesas, hoje);
  const mesAtual = hoje.slice(0, 7);
  const categorias = despesasPorCategoria(despesas, mesAtual);
  const aPagar = despesasAPagar(despesas);
  const recentes = baixasRecentes(titulos, 8);
  const porOS = new Map(oss.map((v) => [v.os.id, v]));
  const porPagador = new Map(pagadores.map((p) => [p.id, p]));
  const mes = nomeMes(resumo.mes);
  const qtdRecebimentos = titulos.reduce((s, t) => s + t.baixas.filter((b) => b.recebidoEm.startsWith(resumo.mes)).length, 0);
  const vencidas = aPagar.filter((d) => d.vencimento < hoje);

  return (
    <>
      <CabecalhoPagina
        titulo="Financeiro"
        resumo={
          <>
            Caixa de <strong className="text-tinta">{mes}</strong> e o que vem nos próximos 30 dias.
          </>
        }
        acoes={<AcaoFutura texto="Exportar CSV" quando="chega no S4" />}
      />

      {/* ---------------- saldo do mês (elemento dominante) */}
      <section aria-label={`Resumo de ${mes}`}>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-linha border border-linha">
          <Numero
            rotulo={`Recebido em ${mes}`}
            valor={formatarReais(resumo.recebido)}
            tom={resumo.recebido > 0 ? "ok" : undefined}
            frase={`Soma das baixas registradas no mês (${qtdRecebimentos} ${qtdRecebimentos === 1 ? "recebimento" : "recebimentos"}).`}
          />
          <Numero rotulo={`Pago em ${mes}`} valor={formatarReais(resumo.pago)} frase="Despesas marcadas como pagas no mês." />
          <Numero
            rotulo="Saldo realizado"
            valor={formatarReais(resumo.saldo)}
            tom={resumo.saldo < 0 ? "alerta" : undefined}
            frase="Recebido menos pago. Só conta o que já entrou ou saiu do caixa."
          />
          <Numero
            rotulo="Projeção 30 dias"
            valor={formatarReais(resumo.projecao)}
            tom={resumo.projecao < 0 ? "alerta" : undefined}
            frase={
              <>
                <span className="numero">{formatarReais(resumo.aReceber30)}</span> a receber até {dataCurta(resumo.limite, ano)} menos{" "}
                <span className="numero">{formatarReais(resumo.aPagar30)}</span> em despesas em aberto (inclui as vencidas). Títulos já vencidos ficam fora.
              </>
            }
          />
        </dl>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-start">
        <div className="flex flex-col gap-6 min-w-0">
          {/* ---------------- a pagar */}
          <Cartao
            titulo="A pagar"
            contagem={aPagar.length}
            acao={
              vencidas.length > 0 ? (
                <span className="text-[13px] font-semibold text-alerta numero">
                  {vencidas.length} {vencidas.length === 1 ? "vencida" : "vencidas"} · {formatarReais(somaCentavos(vencidas.map((d) => d.valorPrevisto)))}
                </span>
              ) : undefined
            }
          >
            {aPagar.length === 0 ? (
              <Vazio titulo="Nada a pagar" texto="Todas as despesas lançadas estão pagas. O lançamento de despesas chega no S4." />
            ) : (
              <ul>
                {aPagar.map((d) => (
                  <LinhaAPagar key={d.id} despesa={d} hoje={hoje} podePagar={podePagar} />
                ))}
              </ul>
            )}
          </Cartao>

          {/* ---------------- recebimentos recentes */}
          <Cartao titulo="Recebimentos recentes" contagem={recentes.length}>
            {recentes.length === 0 ? (
              <Vazio icone="recebiveis" titulo="Nenhum recebimento registrado" texto="Registre os recebimentos na aba Recebíveis; eles aparecem aqui e entram no caixa do mês." />
            ) : (
              <ul>
                {recentes.map(({ baixa, titulo }) => {
                  const pagador = porPagador.get(titulo.pagadorId);
                  return (
                    <li key={baixa.id} className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 min-h-14 border-b border-linha last:border-b-0">
                      <span className="numero text-[13px] text-tinta-suave">{dataCurta(baixa.recebidoEm, ano)}</span>
                      <span className="flex items-center gap-3 min-w-0">
                        <span className="hidden sm:inline-flex">
                          <PlacaOS v={porOS.get(titulo.osId)} />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold truncate">{titulo.descricao}</span>
                          <span className="block text-[12px] text-tinta-suave truncate">
                            {pagador ? TIPO_PAGADOR[pagador.tipo] : "—"} · {baixa.forma}
                          </span>
                        </span>
                      </span>
                      <span className="numero font-bold text-right whitespace-nowrap">{formatarReais(baixa.valor)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Cartao>
        </div>

        {/* ---------------- despesas por categoria */}
        <Cartao
          titulo={`Despesas de ${mes} por categoria`}
        >
          {categorias.length === 0 ? (
            <Vazio titulo={`Nenhuma despesa com vencimento em ${mes}`} texto="Quando houver despesas lançadas para o mês, elas aparecem aqui por categoria." />
          ) : (
            <>
              <p className="flex items-center gap-4 px-4 pt-3 text-[12px] text-tinta-suave" aria-hidden="true">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 bg-preto" /> pago
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 border border-linha-forte bg-cartao" /> previsto
                </span>
              </p>
              <BarrasCategoria categorias={categorias} />
            </>
          )}
        </Cartao>
      </div>
    </>
  );
}

function BarrasCategoria({ categorias }: { categorias: ReturnType<typeof despesasPorCategoria> }) {
  const max = Math.max(...categorias.map((c) => c.previsto), 1);
  const previsto = somaCentavos(categorias.map((c) => c.previsto));
  const pago = somaCentavos(categorias.map((c) => c.pago));
  return (
    <>
      <ul className="px-4 py-2">
        {categorias.map((c) => (
          <li key={c.categoria} className="py-2.5">
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <span className="text-[13px] font-semibold truncate">{c.categoria}</span>
              <span className="numero text-[13px] whitespace-nowrap">
                <span className="font-bold">{formatarReais(c.pago)}</span>
                <span className="text-tinta-suave"> de {formatarReais(c.previsto)}</span>
              </span>
            </div>
            <BarraPrevistoPago previsto={c.previsto} pago={c.pago} max={max} />
            <span className="sr-only">
              {c.categoria}: pago {formatarReais(c.pago)} de {formatarReais(c.previsto)} previstos.
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between gap-3 px-4 py-3 border-t border-linha">
        <span className="rotulo text-tinta-suave">Total do mês</span>
        <span className="numero whitespace-nowrap">
          <span className="font-bold">{formatarReais(pago)}</span>
          <span className="text-tinta-suave"> pagos de {formatarReais(previsto)}</span>
        </span>
      </div>
    </>
  );
}

function LinhaAPagar({ despesa: d, hoje, podePagar }: { despesa: Despesa; hoje: string; podePagar: boolean }) {
  const acoes = useAcoes();
  const [aberta, setAberta] = useState(false);
  const [valor, setValor] = useState(centavosParaCampo(d.valorPrevisto));
  const [data, setData] = useState(hoje);
  const [erro, setErro] = useState<string>();
  const atraso = diferencaDias(d.vencimento, hoje);
  const vencida = atraso > 0;
  const id = `pagar-${d.id}`;

  async function pagar(e: FormEvent) {
    e.preventDefault();
    setErro(undefined);
    const centavos = reaisParaCentavos(valor);
    if (centavos === null || centavos <= 0) return setErro("Informe um valor maior que zero, como 1.234,56.");
    if (!data) return setErro("Informe a data do pagamento.");
    try {
      const r = await acoes.pagarDespesa.mutateAsync([d.id, centavos, data]);
      if (!r.ok) setErro(mensagemErro(r.codigo));
    } catch {
      setErro(mensagemErro());
    }
  }

  return (
    <li className={`relative border-b border-linha last:border-b-0 ${aberta ? "bg-amarelo-claro" : ""}`}>
      {vencida && <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-1 bg-alerta" />}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[96px_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-2 px-4 py-2.5 min-h-14">
        <span className="numero text-[13px] sm:col-start-1 order-2 sm:order-none col-span-2 sm:col-span-1">
          <span className="font-semibold">{dataComSemana(d.vencimento)}</span>
          {vencida ? (
            <span className="sm:block text-[12px] font-semibold text-alerta">
              {" "}
              vencida há {atraso} {atraso === 1 ? "dia" : "dias"}
            </span>
          ) : atraso === 0 ? (
            <span className="sm:block text-[12px] font-semibold text-atencao"> vence hoje</span>
          ) : (
            <span className="sm:block text-[12px] text-tinta-suave"> em {-atraso} {atraso === -1 ? "dia" : "dias"}</span>
          )}
        </span>
        <span className="min-w-0 order-1 sm:order-none">
          <span className="block font-semibold leading-snug">{d.descricao}</span>
          <span className="block text-[12px] text-tinta-suave truncate">
            {d.categoria}
            {d.fornecedor && ` · ${d.fornecedor}`}
          </span>
        </span>
        <span className="numero font-bold text-right whitespace-nowrap order-1 sm:order-none">{formatarReais(d.valorPrevisto)}</span>
        {podePagar && !aberta && (
          <Botao
            tamanho="denso"
            className="order-3 sm:order-none col-span-2 sm:col-span-1 max-sm:h-11"
            aria-label={`Marcar como paga — ${d.descricao}`}
            onClick={() => setAberta(true)}
          >
            Marcar como paga
          </Botao>
        )}
        {vencida && !podePagar && <Etiqueta tom="alerta">Vencida</Etiqueta>}
      </div>
      {aberta && (
        <form onSubmit={pagar} aria-label={`Pagamento — ${d.descricao}`} className="px-4 pb-4">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-[160px_180px_auto] items-end">
            <label className="flex flex-col gap-1" htmlFor={`${id}-valor`}>
              <span className="text-[13px] font-semibold">Valor pago (R$)</span>
              <input
                id={`${id}-valor`}
                inputMode="decimal"
                autoComplete="off"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className={`${CLASSE_CAMPO} numero text-right`}
              />
            </label>
            <label className="flex flex-col gap-1" htmlFor={`${id}-data`}>
              <span className="text-[13px] font-semibold">Pago em</span>
              <input id={`${id}-data`} type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value)} className={`${CLASSE_CAMPO} numero`} />
            </label>
            <div className="col-span-2 sm:col-span-1 flex flex-wrap items-center gap-2">
              <Botao type="submit" variante="primario" tamanho="denso" className="max-sm:h-11" disabled={acoes.pagarDespesa.isPending}>
                {acoes.pagarDespesa.isPending ? "Salvando…" : "Confirmar pagamento"}
              </Botao>
              <Botao variante="fantasma" tamanho="denso" className="max-sm:h-11" onClick={() => setAberta(false)}>
                Cancelar
              </Botao>
            </div>
          </div>
          <div className="mt-2">
            <Retorno erro={erro} />
          </div>
        </form>
      )}
    </li>
  );
}

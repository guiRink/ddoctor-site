// Agregações de leitura das telas de gestão (Recebíveis, Financeiro, Funcionários).
// Funções puras, sem relógio: `hoje`/`agora` entram por parâmetro. Candidatas a mudar para
// codigo/compartilhado/src/dominio/financeiro.ts (e tempos.ts) — ver relatório do sprint SD.
import type { Baixa, Centavos, DataISO, Despesa, EtapaOS, Id, MarcoISO, TituloReceber } from "@compartilhado/tipos";
import { faixaAging, saldoTitulo, type FaixaAging } from "@compartilhado/dominio/financeiro";
import { somaCentavos } from "@compartilhado/dominio/dinheiro";
import { paraMs, somarDias } from "@compartilhado/dominio/fuso";
import { tempoEmExecucao } from "@compartilhado/dominio/tempos";

export const FAIXAS: FaixaAging[] = ["a_vencer", "0_30", "31_60", "61_mais"];

export type ResumoAging = Record<FaixaAging, { total: Centavos; quantidade: number }>;

/** Saldo em aberto e quantidade de títulos por faixa de atraso. */
export function resumoAging(titulos: readonly TituloReceber[], hoje: DataISO): ResumoAging {
  const r = Object.fromEntries(FAIXAS.map((f) => [f, { total: 0, quantidade: 0 }])) as ResumoAging;
  for (const t of titulos) {
    const f = faixaAging(t, hoje);
    if (!f) continue;
    r[f].total += saldoTitulo(t);
    r[f].quantidade += 1;
  }
  return r;
}

const doMes = (data: DataISO | undefined, mes: string) => Boolean(data && data.slice(0, 7) === mes);

export interface ResumoMes {
  mes: string; // AAAA-MM
  recebido: Centavos;
  pago: Centavos;
  saldo: Centavos;
  limite: DataISO; // hoje + 30
  aReceber30: Centavos;
  aPagar30: Centavos;
  projecao: Centavos;
}

/**
 * Caixa do mês de `hoje`: recebido = Σ baixas no mês; pago = Σ pagamentos no mês; saldo = recebido − pago.
 * Projeção 30 dias = saldo em aberto dos títulos que vencem de hoje até hoje+30 − despesas não pagas
 * com vencimento até hoje+30 (inclui as já vencidas). Títulos vencidos ficam fora (não há data para entrar).
 */
export function resumoMes(titulos: readonly TituloReceber[], despesas: readonly Despesa[], hoje: DataISO): ResumoMes {
  const mes = hoje.slice(0, 7);
  const limite = somarDias(hoje, 30);
  const recebido = somaCentavos(titulos.flatMap((t) => t.baixas.filter((b) => doMes(b.recebidoEm, mes)).map((b) => b.valor)));
  const pago = somaCentavos(despesas.filter((d) => doMes(d.pagoEm, mes)).map((d) => d.valorPago ?? 0));
  const aReceber30 = somaCentavos(
    titulos.filter((t) => faixaAging(t, hoje) === "a_vencer" && t.vencimento <= limite).map((t) => saldoTitulo(t)),
  );
  const aPagar30 = somaCentavos(despesas.filter((d) => !d.pagoEm && d.vencimento <= limite).map((d) => d.valorPrevisto));
  return { mes, recebido, pago, saldo: recebido - pago, limite, aReceber30, aPagar30, projecao: aReceber30 - aPagar30 };
}

export interface CategoriaDespesa {
  categoria: string;
  previsto: Centavos;
  pago: Centavos;
}

/** Despesas com vencimento no mês, por categoria (maior previsto primeiro). */
export function despesasPorCategoria(despesas: readonly Despesa[], mes: string): CategoriaDespesa[] {
  const mapa = new Map<string, CategoriaDespesa>();
  for (const d of despesas) {
    if (!doMes(d.vencimento, mes)) continue;
    const c = mapa.get(d.categoria) ?? { categoria: d.categoria, previsto: 0, pago: 0 };
    c.previsto += d.valorPrevisto;
    c.pago += d.pagoEm ? (d.valorPago ?? 0) : 0;
    mapa.set(d.categoria, c);
  }
  return [...mapa.values()].sort((a, b) => b.previsto - a.previsto || a.categoria.localeCompare(b.categoria));
}

/** Despesas em aberto: vencidas primeiro (mais antiga no topo), depois por vencimento. */
export function despesasAPagar(despesas: readonly Despesa[]): Despesa[] {
  return despesas.filter((d) => !d.pagoEm).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}

/** Baixas de todos os títulos, mais recentes primeiro. */
export function baixasRecentes(titulos: readonly TituloReceber[], limite = 8): { baixa: Baixa; titulo: TituloReceber }[] {
  return titulos
    .flatMap((titulo) => titulo.baixas.map((baixa) => ({ baixa, titulo })))
    .sort((a, b) => b.baixa.recebidoEm.localeCompare(a.baixa.recebidoEm))
    .slice(0, limite);
}

export interface NumerosPessoa {
  concluidas: EtapaOS[];
  pecas: number;
  carros: number;
  tempoMedio: number | null; // minutos em execução, média das etapas concluídas
  impedimentos: number;
  emAndamento: EtapaOS[];
}

/**
 * Produção de uma pessoa desde `desde`: etapas concluídas por ela no período, peças (Σ pecasFeitas),
 * carros distintos, tempo médio em execução, impedimentos abertos no período nas etapas dela e
 * etapas dela em execução ou impedidas agora.
 */
export function numerosPessoa(etapas: readonly EtapaOS[], perfilId: Id, desde: MarcoISO, agora: MarcoISO): NumerosPessoa {
  const inicio = paraMs(desde);
  const minhas = etapas.filter((e) => e.responsavelId === perfilId);
  const concluidas = minhas
    .filter((e) => e.estado === "concluida" && e.concluidaEm && paraMs(e.concluidaEm) >= inicio)
    .sort((a, b) => paraMs(b.concluidaEm!) - paraMs(a.concluidaEm!));
  const tempos = concluidas.filter((e) => e.iniciadaEm).map((e) => tempoEmExecucao(e, agora));
  return {
    concluidas,
    pecas: concluidas.reduce((s, e) => s + (e.pecasFeitas ?? 0), 0),
    carros: new Set(concluidas.map((e) => e.osId)).size,
    tempoMedio: tempos.length ? Math.round(tempos.reduce((s, t) => s + t, 0) / tempos.length) : null,
    impedimentos: minhas.reduce((s, e) => s + e.bloqueios.filter((b) => paraMs(b.inicioEm) >= inicio).length, 0),
    emAndamento: minhas.filter((e) => e.estado === "em_execucao" || e.estado === "bloqueada"),
  };
}

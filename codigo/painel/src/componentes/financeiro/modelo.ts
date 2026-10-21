// Montagem das listas da tela Financeiro sobre @compartilhado/dominio (caixa, financeiro). Sem regra nova de dinheiro.
import { FORMAS_PAGAMENTO, type Baixa, type DataISO, type Despesa, type FormaPagamento, type Pagador, type TituloReceber } from "@compartilhado/tipos";
import type { OSVisao } from "../../dados/repositorio";
import { seguradoraDaOS } from "../relatorios/gestao";
import { diferencaDias, mesDe } from "@compartilhado/dominio/fuso";
import type { Tom } from "../ui/Estado";

export type SituacaoDespesa = "paga" | "vencida" | "vence_hoje" | "a_vencer";

export function situacaoDespesa(d: Despesa, hoje: DataISO): SituacaoDespesa {
  if (d.pagoEm) return "paga";
  if (d.vencimento < hoje) return "vencida";
  if (d.vencimento === hoje) return "vence_hoje";
  return "a_vencer";
}

export const SITUACAO_DESPESA: Record<SituacaoDespesa, { texto: string; tom: Tom }> = {
  paga: { texto: "Paga", tom: "ok" },
  vencida: { texto: "Vencida", tom: "alerta" },
  vence_hoje: { texto: "Vence hoje", tom: "atencao" },
  a_vencer: { texto: "A vencer", tom: "neutro" },
};

/** "vencida há 3 dias" / "vence hoje" / "em 5 dias" / "paga em 12/10". */
export function prazoDespesa(d: Despesa, hoje: DataISO): string {
  const dias = diferencaDias(hoje, d.vencimento);
  if (d.pagoEm) return "";
  if (dias < 0) return `vencida há ${-dias} ${dias === -1 ? "dia" : "dias"}`;
  if (dias === 0) return "vence hoje";
  return `em ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

/**
 * Despesas da competência: vencimento no mês ou paga no mês. No mês corrente entram também as
 * vencidas de meses anteriores ainda em aberto (precisam de ação). Ordem: abertas por vencimento, depois pagas.
 */
export function despesasDaCompetencia(despesas: readonly Despesa[], mes: string, hoje: DataISO): Despesa[] {
  const corrente = mesDe(hoje) === mes;
  return despesas
    .filter(
      (d) =>
        mesDe(d.vencimento) === mes || (d.pagoEm && mesDe(d.pagoEm) === mes) || (corrente && !d.pagoEm && mesDe(d.vencimento) < mes),
    )
    .sort((a, b) => Number(Boolean(a.pagoEm)) - Number(Boolean(b.pagoEm)) || a.vencimento.localeCompare(b.vencimento) || a.descricao.localeCompare(b.descricao, "pt-BR"));
}

export interface EntradaMes {
  baixa: Baixa;
  titulo: TituloReceber;
}

/** Baixas recebidas no mês, mais recentes primeiro. */
export function entradasDoMes(titulos: readonly TituloReceber[], mes: string): EntradaMes[] {
  return titulos
    .flatMap((titulo) => titulo.baixas.filter((b) => mesDe(b.recebidoEm) === mes).map((baixa) => ({ baixa, titulo })))
    .sort((a, b) => b.baixa.recebidoEm.localeCompare(a.baixa.recebidoEm) || b.baixa.valor - a.baixa.valor);
}

/** Formas oferecidas ao pagar uma despesa (seguradora não paga despesa da oficina). */
export const FORMAS_DESPESA: readonly FormaPagamento[] = FORMAS_PAGAMENTO.filter((f) => f !== "seguradora");

/**
 * Quem paga o título, com o nome que a oficina usa (sprint SG): a seguradora do atendimento (HDI, Liberty…) ou
 * "Cliente". A Maxpar é o portal, não paga nada: título de pagador Maxpar mostra a seguradora da OS.
 */
export function quemPaga(tipo: Pagador["tipo"] | undefined, v?: Pick<OSVisao, "os" | "atendimentos">): string {
  if (tipo === "cliente") return "Cliente";
  if (tipo === "outro") return "Outro";
  const nome = v ? seguradoraDaOS(v) : "";
  return nome && nome !== "Particular" && nome !== "Seguradora não informada" ? nome : "Seguradora";
}

// Formatação das telas de Relatórios e dos gráficos (docs/painel-design.md §6).
// Só apresentação: nenhuma regra de negócio mora aqui.
import type { Centavos } from "@compartilhado/tipos";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-10" → "outubro de 2026". */
export function nomeMesAno(mes: string): string {
  return `${MESES[Number(mes.slice(5, 7)) - 1] ?? mes} de ${mes.slice(0, 4)}`;
}

/** "2026-10" → "Outubro". */
export function nomeMesCurto(mes: string): string {
  const nome = MESES[Number(mes.slice(5, 7)) - 1] ?? mes;
  return nome[0].toUpperCase() + nome.slice(1);
}

/** "2026-10" → "out". */
export function mesAbreviado(mes: string): string {
  return MESES_CURTOS[Number(mes.slice(5, 7)) - 1] ?? mes;
}

/** Desloca o mês "AAAA-MM" em `n` meses (negativo volta). */
export function somarMeses(mes: string, n: number): string {
  const ano = Number(mes.slice(0, 4));
  const m = Number(mes.slice(5, 7)) - 1 + n;
  const a = ano + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${a}-${String(mm + 1).padStart(2, "0")}`;
}

/** Valor curto para eixo de gráfico: 0 → "R$ 0"; 123456 → "R$ 1,2 mil"; 150000000 → "R$ 1,5 mi". */
export function reaisCompacto(c: Centavos): string {
  const reais = c / 100;
  const abs = Math.abs(reais);
  const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: n < 10 ? 1 : 0 });
  if (abs >= 1_000_000) return `R$ ${fmt(reais / 1_000_000)} mi`;
  if (abs >= 1_000) return `R$ ${fmt(reais / 1_000)} mil`;
  return `R$ ${Math.round(reais).toLocaleString("pt-BR")}`;
}

/** Fração → "34 %" (ou "34,5 %" com `casas`). null → "—". */
export function percentual(fracao: number | null | undefined, casas = 0): string {
  if (fracao === null || fracao === undefined || !Number.isFinite(fracao)) return "—";
  return `${(fracao * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })} %`;
}

/** Quantidade com até 3 casas, separador pt-BR. */
export const quantidade = (n: number): string => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

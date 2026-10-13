// Formatação das telas de Financeiro e Estoque (revisão SE). Rótulos vêm de src/dominio/rotulos.ts.
import { formatarMarco, minutoDoDia, msDeLocal } from "@compartilhado/dominio/fuso";
import { normalizarFormaPagamento } from "@compartilhado/dominio/pagamentos";
import { FORMA_PAGAMENTO } from "../../dominio/rotulos";
import { lerNumero } from "../../dominio/numero";

/** Forma de pagamento legível: "pix" → "Pix"; texto antigo é normalizado; desconhecido sai como veio. */
export function rotuloForma(forma: string | undefined | null): string {
  if (!forma) return "—";
  const f = normalizarFormaPagamento(forma);
  return f ? FORMA_PAGAMENTO[f] : forma;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-10" → "outubro de 2026". */
export function nomeCompetencia(mes: string): string {
  const nome = MESES[Number(mes.slice(5, 7)) - 1] ?? mes;
  return `${nome} de ${mes.slice(0, 4)}`;
}

/** Desloca a competência "AAAA-MM" em `n` meses. */
export function somarMeses(mes: string, n: number): string {
  const a = Number(mes.slice(0, 4));
  const m = Number(mes.slice(5, 7)) - 1 + n;
  const ano = a + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${ano}-${String(mm + 1).padStart(2, "0")}`;
}

/** Marco → "14:30" no fuso da oficina. */
export function horaDoMarco(marco: string): string {
  const min = Math.floor(minutoDoDia(marco));
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** Quantidade com até 3 casas, separador pt-BR. */
export const formatarQtd = (n: number): string => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(n);

/** Campo de quantidade "1,5" | "1.5" → 1.5; "1.000" → 1000; "1.000,5" → 1000.5; inválido → null (regra única: lerNumero). */
export const lerQuantidade = lerNumero;

/** Marco de uma movimentação lançada para um dia: hoje = agora (o repositório carimba); outro dia = meio-dia no fuso da oficina. */
export function marcoDoDia(data: string, hoje: string): string | undefined {
  return data === hoje ? undefined : formatarMarco(msDeLocal(data, 12 * 60));
}

// Auxiliares de formatação e leitura dos formulários da ficha da OS e da recepção (sem componentes).
import type { ReactNode } from "react";
import { normalizarFormaPagamento } from "@compartilhado/dominio/pagamentos";
import { FORMA_PAGAMENTO } from "../../dominio/rotulos";
import { lerNumero } from "../../dominio/numero";

/** Ids de descrição para aria-describedby, conforme o Grupo mostra erro ou dica. */
export function descritoPor(id: string, erro?: string, dica?: ReactNode): string | undefined {
  if (erro) return `${id}-erro`;
  if (dica) return `${id}-dica`;
  return undefined;
}

/** "45210" → "45.210" (só dígitos; para o campo de km enquanto digita). */
export function milhar(digitos: string): string {
  const d = digitos.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** "1,5" | "1.5" | "2" | "1.000" → número; vazio ou inválido → null (regra única: lerNumero). */
export const lerDecimal = lerNumero;

/** Quantidade legível: 1 → "1", 0,25 → "0,25". */
export function qtd(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export function kmLegivel(km?: number): string {
  return km === undefined ? "—" : `${milhar(String(Math.round(km)))} km`;
}

/** Forma legível de uma baixa (aceita o texto livre antigo, ex.: "Transferência"). */
export function formaLegivel(forma: string): string {
  const f = normalizarFormaPagamento(forma);
  return f ? FORMA_PAGAMENTO[f] : forma;
}

/** "BMW" + "X5" → "BMW X5"; não repete a marca quando o modelo já começa com ela ("BMW X5"). */
export function nomeCarro(veiculo: { marca?: string; modelo?: string }): string {
  const marca = veiculo.marca?.trim();
  const modelo = veiculo.modelo?.trim();
  if (marca && modelo) {
    const m = modelo.toLowerCase();
    const primeira = marca.split(/[\s-]/)[0].toLowerCase(); // "Mercedes-Benz" + "Mercedes C200"
    if (m.startsWith(marca.toLowerCase()) || (primeira.length > 2 && m.startsWith(primeira))) return modelo;
  }
  return [marca, modelo].filter(Boolean).join(" ");
}

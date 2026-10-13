// Formas de pagamento e resumo dos pagamentos de uma OS (títulos + baixas).
import { FORMAS_PAGAMENTO, type Centavos, type FormaPagamento, type TituloReceber } from "../tipos";
import { somaCentavos } from "./dinheiro";
import { saldoTitulo } from "./financeiro";

const SINONIMOS: Record<string, FormaPagamento> = {
  pix: "pix",
  dinheiro: "dinheiro",
  especie: "dinheiro",
  debito: "debito",
  "cartao de debito": "debito",
  credito: "credito",
  "cartao de credito": "credito",
  boleto: "boleto",
  transferencia: "transferencia",
  ted: "transferencia",
  doc: "transferencia",
  seguradora: "seguradora",
};

/** "Pix", "Transferência", "Cartão de crédito" → forma canônica; texto desconhecido → null. */
export function normalizarFormaPagamento(texto: string | undefined | null): FormaPagamento | null {
  if (!texto) return null;
  const t = texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
  if ((FORMAS_PAGAMENTO as readonly string[]).includes(t)) return t as FormaPagamento;
  return SINONIMOS[t] ?? null;
}

export interface ResumoPagamentos {
  total: Centavos; // Σ valor dos títulos não cancelados
  recebido: Centavos; // Σ baixas desses títulos
  saldo: Centavos; // Σ saldoTitulo
}

/** Total, recebido e saldo da OS. Título cancelado fica fora das três somas. */
export function resumoPagamentosOS(titulos: readonly TituloReceber[]): ResumoPagamentos {
  const validos = titulos.filter((t) => t.estado !== "cancelado");
  return {
    total: somaCentavos(validos.map((t) => t.valor)),
    recebido: somaCentavos(validos.flatMap((t) => t.baixas.map((b) => b.valor))),
    saldo: somaCentavos(validos.map(saldoTitulo)),
  };
}

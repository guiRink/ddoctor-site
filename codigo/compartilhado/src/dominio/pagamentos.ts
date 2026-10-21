// Formas de pagamento e resumo dos pagamentos de uma OS (títulos + baixas).
import { FORMAS_PAGAMENTO, type Centavos, type FormaPagamento, type OrcamentoVersao, type OrigemOS, type Pagador, type TituloReceber } from "../tipos";
import { somaCentavos } from "./dinheiro";
import { saldoTitulo, valorAprovado } from "./financeiro";

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

/** Títulos cujo pagador é do tipo "cliente" (franquia, complemento, particular); seguradora/Maxpar ficam fora. */
export function titulosDoCliente(titulos: readonly TituloReceber[], pagadores: readonly Pagador[]): TituloReceber[] {
  const ids = new Set(pagadores.filter((p) => p.tipo === "cliente").map((p) => p.id));
  return titulos.filter((t) => ids.has(t.pagadorId));
}

/** Total pago e saldo do CLIENTE (ficha e lista de clientes): só títulos de pagador tipo "cliente". */
export function resumoPagamentosCliente(titulos: readonly TituloReceber[], pagadores: readonly Pagador[]): ResumoPagamentos {
  return resumoPagamentosOS(titulosDoCliente(titulos, pagadores));
}

/**
 * Quanto o cliente deve pagar na OS: particular = valor aprovado da versão vigente; com seguradora/Maxpar =
 * franquia + complemento particular. Sem versão, 0.
 */
export function valorEsperadoCliente(origem: OrigemOS, versao: OrcamentoVersao | undefined): Centavos {
  if (!versao) return 0;
  if (origem === "particular") return valorAprovado(versao);
  return Math.max(0, versao.franquia ?? 0) + Math.max(0, versao.complementoParticular ?? 0);
}

/**
 * Saldo ainda NÃO cobrado do cliente = esperado − Σ valor dos títulos do cliente não cancelados.
 * ≤ 0 = nada a cobrar (a OS está quitada para o cliente; um pagamento novo é recusado com "os_quitada").
 */
export function saldoACobrarCliente(entrada: {
  origem: OrigemOS;
  versao: OrcamentoVersao | undefined;
  titulosCliente: readonly TituloReceber[];
}): Centavos {
  const jaCobrado = somaCentavos(entrada.titulosCliente.filter((t) => t.estado !== "cancelado").map((t) => t.valor));
  return valorEsperadoCliente(entrada.origem, entrada.versao) - jaCobrado;
}

export interface ClienteDeveOS {
  /** Versão aprovada vigente (a de maior número entre as aprovadas); ausente se nada foi aprovado. */
  versao: OrcamentoVersao | undefined;
  /** O que o cliente paga na oficina: max(valor esperado da versão vigente, Σ títulos do cliente não cancelados). */
  esperado: Centavos;
  /** Σ baixas dos títulos do cliente não cancelados. */
  pago: Centavos;
  /** max(0, esperado − pago). */
  falta: Centavos;
  /** Σ valor dos títulos do cliente não cancelados (já cobrado). */
  cobrado: Centavos;
}

/**
 * Regra ÚNICA de "quanto o cliente deve" (ficha, Geral, Produção, Atendimentos): parte da versão APROVADA
 * vigente (nunca de um orçamento enviado ou em rascunho); particular = valor aprovado; seguradora/Maxpar =
 * franquia + complemento particular. Se a recepção já lançou títulos do cliente acima disso, vale o lançado
 * (max). Pago = baixas de títulos do cliente não cancelados; falta nunca é negativa.
 */
export function clienteDeveOS(entrada: {
  origem: OrigemOS;
  versoes: readonly OrcamentoVersao[];
  titulos: readonly TituloReceber[];
  pagadores: readonly Pagador[];
}): ClienteDeveOS {
  const versao = entrada.versoes.filter((v) => v.estado === "aprovado").sort((a, b) => b.numeroVersao - a.numeroVersao)[0];
  const doCliente = titulosDoCliente(entrada.titulos, entrada.pagadores).filter((t) => t.estado !== "cancelado");
  const cobrado = somaCentavos(doCliente.map((t) => t.valor));
  const esperado = Math.max(valorEsperadoCliente(entrada.origem, versao), cobrado);
  const pago = somaCentavos(doCliente.flatMap((t) => t.baixas.map((b) => b.valor)));
  return { versao, esperado, pago, falta: Math.max(0, esperado - pago), cobrado };
}

// Fechamento de caixa diário (só dinheiro em espécie) e resumo da competência mensal.
import type { Baixa, Centavos, DataISO, Despesa, FechamentoCaixa, TituloReceber } from "../tipos";
import { somaCentavos } from "./dinheiro";
import { baixasValidas, saldoTitulo } from "./financeiro";
import { falha, type Resultado } from "./resultado";
import { mesDe } from "./fuso";
import { normalizarFormaPagamento } from "./pagamentos";

/** Valor efetivamente pago da despesa (valorPago ou, se faltar, o previsto); 0 se não paga. */
export function valorPagoDespesa(d: Despesa): Centavos {
  return d.pagoEm ? (d.valorPago ?? d.valorPrevisto) : 0;
}

export type CalculoFechamento = Pick<
  FechamentoCaixa,
  "data" | "saldoInicial" | "contado" | "entradasDinheiro" | "saidasDinheiro" | "esperado" | "diferenca"
>;

/**
 * Dinheiro em espécie com data de um dia cujo caixa já foi fechado mudaria a gaveta conferida:
 * recusa com "caixa_ja_fechado" (lance com a data de hoje). Outras formas passam.
 * `forma` aceita o texto livre antigo ("Dinheiro", "espécie").
 */
export function checarCaixaAberto(
  fechamentos: ReadonlyArray<Pick<FechamentoCaixa, "data">>,
  forma: string | undefined | null,
  data: DataISO | undefined,
): Resultado<"caixa_ja_fechado"> {
  if (!data || normalizarFormaPagamento(forma) !== "dinheiro") return { ok: true };
  return fechamentos.some((f) => f.data === data) ? falha("caixa_ja_fechado") : { ok: true };
}

/**
 * Fechamento do dia: entradas = baixas em dinheiro recebidas na data; saídas = despesas pagas em dinheiro
 * na data. esperado = saldoInicial + entradas − saídas; diferenca = contado − esperado (negativa = falta).
 * Pix, cartão, boleto etc. não passam pela gaveta e ficam fora.
 * Prefira passar `titulos`: as baixas de títulos cancelados ficam fora. `baixas` (lista solta) é
 * aceito por compatibilidade e é ignorado quando `titulos` vem.
 */
export function calcularFechamento(entrada: {
  saldoInicial: Centavos;
  contado: Centavos;
  titulos?: readonly TituloReceber[];
  baixas?: readonly Baixa[];
  despesas: readonly Despesa[];
  data: DataISO;
}): CalculoFechamento {
  const { saldoInicial, contado, despesas, data } = entrada;
  const baixas = entrada.titulos ? baixasValidas(entrada.titulos) : (entrada.baixas ?? []);
  const entradasDinheiro = somaCentavos(
    baixas.filter((b) => b.recebidoEm === data && normalizarFormaPagamento(b.forma) === "dinheiro").map((b) => b.valor),
  );
  const saidasDinheiro = somaCentavos(
    despesas.filter((d) => d.pagoEm === data && d.formaPagamento === "dinheiro").map(valorPagoDespesa),
  );
  const esperado = saldoInicial + entradasDinheiro - saidasDinheiro;
  return { data, saldoInicial, contado, entradasDinheiro, saidasDinheiro, esperado, diferenca: contado - esperado };
}

export interface ResumoCompetencia {
  mes: string; // AAAA-MM
  entradas: Centavos; // Σ baixas recebidas no mês (títulos cancelados fora)
  saidas: Centavos; // Σ despesas pagas no mês
  resultado: Centavos; // entradas − saídas
  aPagarEmAberto: Centavos; // despesas com vencimento no mês ainda não pagas
  aReceberEmAberto: Centavos; // saldo dos títulos não cancelados com vencimento no mês
}

/** Competência mensal pelo regime de caixa (o que entrou e saiu de fato no mês) + o que ficou em aberto. */
export function resumoCompetencia(
  mes: string,
  titulos: readonly TituloReceber[],
  despesas: readonly Despesa[],
): ResumoCompetencia {
  const entradas = somaCentavos(baixasValidas(titulos).filter((b) => mesDe(b.recebidoEm) === mes).map((b) => b.valor));
  const saidas = somaCentavos(despesas.filter((d) => d.pagoEm && mesDe(d.pagoEm) === mes).map(valorPagoDespesa));
  const aPagarEmAberto = somaCentavos(despesas.filter((d) => !d.pagoEm && mesDe(d.vencimento) === mes).map((d) => d.valorPrevisto));
  const aReceberEmAberto = somaCentavos(
    titulos.filter((t) => t.estado !== "cancelado" && mesDe(t.vencimento) === mes).map(saldoTitulo),
  );
  return { mes, entradas, saidas, resultado: entradas - saidas, aPagarEmAberto, aReceberEmAberto };
}

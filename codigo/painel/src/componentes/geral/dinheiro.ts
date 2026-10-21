// Quadrados de dinheiro do Geral para o papel financeiro (revisão SG, item 1): "Vence em 7 dias", "A pagar em 7 dias"
// e "Recebido no mês". Só leitura sobre @compartilhado/dominio (financeiro, fuso) e devedorDoTitulo de contagens.ts;
// nenhuma regra nova de dinheiro. Cada função devolve { total, itens } com total === itens.length, como as contagens.
import type { Baixa, Centavos, Despesa, MarcoISO, Pagador, TituloReceber } from "@compartilhado/tipos";
import { somaCentavos } from "@compartilhado/dominio/dinheiro";
import { estadoTitulo, saldoTitulo } from "@compartilhado/dominio/financeiro";
import { dataNoFuso, diferencaDias, mesDe, somarDias } from "@compartilhado/dominio/fuso";
import type { OSVisao } from "../../dados/repositorio";
import { devedorDoTitulo, type Contagem, type Devedor } from "../../dominio/contagens";

/** Janela dos quadrados "em 7 dias" (hoje inclusive). */
export const DIAS_JANELA = 7;

export interface ItemAVencer {
  t: TituloReceber;
  v?: OSVisao;
  saldo: Centavos;
  dias: number; // 0 = vence hoje
  devedor: Devedor;
}

/** Títulos emitidos (ou parciais) com saldo que vencem de hoje até hoje + 7 dias. O que vence antes primeiro. */
export function venceEm7Dias(
  titulos: readonly TituloReceber[],
  pagadores: readonly Pagador[],
  oss: readonly OSVisao[],
  agora: MarcoISO,
): Contagem<ItemAVencer> & { valor: Centavos } {
  const hoje = dataNoFuso(agora);
  const limite = somarDias(hoje, DIAS_JANELA);
  const porId = new Map(oss.map((v) => [v.os.id, v]));
  const itens: ItemAVencer[] = [];
  for (const t of titulos) {
    const estado = estadoTitulo(t, hoje);
    if ((estado !== "emitido" && estado !== "parcial") || t.vencimento < hoje || t.vencimento > limite) continue;
    const saldo = saldoTitulo(t);
    if (saldo <= 0) continue;
    const v = porId.get(t.osId);
    itens.push({ t, v, saldo, dias: diferencaDias(hoje, t.vencimento), devedor: devedorDoTitulo(t, pagadores, v) });
  }
  itens.sort((a, b) => a.t.vencimento.localeCompare(b.t.vencimento) || b.saldo - a.saldo);
  return { total: itens.length, itens, valor: somaCentavos(itens.map((i) => i.saldo)) };
}

export interface ItemAPagar {
  d: Despesa;
  dias: number; // negativo = vencida
  vencida: boolean;
}

/** Despesas em aberto que vencem até hoje + 7 dias, incluindo as já vencidas (pagar primeiro). */
export function aPagarEm7Dias(despesas: readonly Despesa[], agora: MarcoISO): Contagem<ItemAPagar> & { valor: Centavos; vencidas: number } {
  const hoje = dataNoFuso(agora);
  const limite = somarDias(hoje, DIAS_JANELA);
  const itens = despesas
    .filter((d) => !d.pagoEm && d.vencimento <= limite)
    .map((d) => ({ d, dias: diferencaDias(hoje, d.vencimento), vencida: d.vencimento < hoje }))
    .sort((a, b) => a.d.vencimento.localeCompare(b.d.vencimento) || b.d.valorPrevisto - a.d.valorPrevisto);
  return { total: itens.length, itens, valor: somaCentavos(itens.map((i) => i.d.valorPrevisto)), vencidas: itens.filter((i) => i.vencida).length };
}

export interface ItemRecebido {
  b: Baixa;
  t: TituloReceber;
  v?: OSVisao;
  devedor: Devedor;
}

/** Baixas recebidas no mês de hoje (títulos não cancelados), a mais recente primeiro. */
export function recebidoNoMes(
  titulos: readonly TituloReceber[],
  pagadores: readonly Pagador[],
  oss: readonly OSVisao[],
  agora: MarcoISO,
): Contagem<ItemRecebido> & { valor: Centavos } {
  const mes = mesDe(dataNoFuso(agora));
  const porId = new Map(oss.map((v) => [v.os.id, v]));
  const itens: ItemRecebido[] = [];
  for (const t of titulos) {
    if (t.estado === "cancelado") continue;
    const v = porId.get(t.osId);
    for (const b of t.baixas) {
      if (mesDe(b.recebidoEm) === mes) itens.push({ b, t, v, devedor: devedorDoTitulo(t, pagadores, v) });
    }
  }
  itens.sort((a, b) => b.b.recebidoEm.localeCompare(a.b.recebidoEm) || b.b.valor - a.b.valor);
  return { total: itens.length, itens, valor: somaCentavos(itens.map((i) => i.b.valor)) };
}

/** "vence hoje" / "vence amanhã" / "em 3 dias". */
export function textoVence(dias: number): string {
  if (dias <= 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  return `em ${dias} dias`;
}

/** Data da despesa: "venceu há 2 dias" / "vence hoje" / "em 3 dias". */
export function textoDespesa(i: ItemAPagar): string {
  if (i.vencida) return `venceu há ${-i.dias} ${i.dias === -1 ? "dia" : "dias"}`;
  return textoVence(i.dias);
}

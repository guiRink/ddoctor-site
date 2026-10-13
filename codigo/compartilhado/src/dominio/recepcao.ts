// Recepção do veículo: checklist de entrada e mapa de avarias.
import type { Avaria, ChecklistItem, EstadoOS, Id, MarcoISO, RecepcaoVeiculo } from "../tipos";
import { falha, type Resultado } from "./resultado";

export interface ProgressoChecklist {
  marcados: number;
  total: number;
  /** Fração 0..1; null quando não há item ativo. */
  fracao: number | null;
  completo: boolean;
}

/** Conta só itens ativos; marcações de itens desativados ou desconhecidos são ignoradas. */
export function progressoChecklist(checklist: Readonly<Record<string, boolean>>, itens: readonly ChecklistItem[]): ProgressoChecklist {
  const ativos = itens.filter((i) => i.ativo);
  const marcados = ativos.filter((i) => checklist[i.id] === true).length;
  const total = ativos.length;
  return { marcados, total, fracao: total > 0 ? marcados / total : null, completo: total > 0 && marcados === total };
}

/** Itens ativos agrupados na ordem em que os grupos aparecem na lista. */
export function gruposChecklist(itens: readonly ChecklistItem[]): Array<{ grupo: string; itens: ChecklistItem[] }> {
  const mapa = new Map<string, ChecklistItem[]>();
  for (const i of itens) {
    if (!i.ativo) continue;
    const g = mapa.get(i.grupo) ?? [];
    g.push(i);
    mapa.set(i.grupo, g);
  }
  return [...mapa].map(([grupo, lista]) => ({ grupo, itens: lista }));
}

export type CodigoAvaria = "posicao_invalida";

/** Posição dentro do desenho: x e y em [0, 1]. */
export function validarAvaria(a: Pick<Avaria, "x" | "y">): Resultado<CodigoAvaria> {
  const dentro = (v: number) => Number.isFinite(v) && v >= 0 && v <= 1;
  return dentro(a.x) && dentro(a.y) ? { ok: true } : falha("posicao_invalida");
}

/** OS entregue, encerrada ou cancelada não tem mais a recepção editada (o carro já saiu ou a OS morreu). */
const FECHADAS: ReadonlySet<EstadoOS> = new Set(["entregue", "encerrada", "cancelada"]);

export function recepcaoEditavel(estado: EstadoOS): Resultado<"os_fechada"> {
  return FECHADAS.has(estado) ? falha("os_fechada") : { ok: true };
}

/**
 * Carimbo da recepção: a PRIMEIRA gravação fica em registradaEm/Por para sempre; regravações só
 * atualizam atualizadaEm/Por. Os carimbos que vierem em `nova` são ignorados (não se forja a data).
 */
export function carimbarRecepcao(
  nova: RecepcaoVeiculo,
  anterior: RecepcaoVeiculo | undefined,
  momento: MarcoISO,
  perfilId: Id | undefined,
): RecepcaoVeiculo {
  const dados: RecepcaoVeiculo = { ...nova };
  delete dados.registradaEm;
  delete dados.registradaPor;
  delete dados.atualizadaEm;
  delete dados.atualizadaPor;
  if (anterior?.registradaEm)
    return { ...dados, registradaEm: anterior.registradaEm, registradaPor: anterior.registradaPor, atualizadaEm: momento, atualizadaPor: perfilId };
  return { ...dados, registradaEm: momento, registradaPor: perfilId };
}

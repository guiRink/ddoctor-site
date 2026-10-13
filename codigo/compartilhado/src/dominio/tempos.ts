// Tempos de uma etapa em minutos de RELÓGIO (não úteis). Em fila, em execução e bloqueada
// são três números separados (arq. §7.4); nunca somar num "atraso".
import type { EtapaOS, MarcoISO } from "../tipos";
import { paraMs } from "./fuso";

const MS_MIN = 60_000;
const minutos = (ms: number) => Math.max(0, Math.floor(ms / MS_MIN));

/** (iniciadaEm ou agora) − entrouFilaEm. Dispensada sem início: 0 (a dispensa não marca hora). */
export function tempoEmFila(etapa: EtapaOS, agora: MarcoISO): number {
  if (!etapa.entrouFilaEm) return 0;
  let fim: string | undefined = etapa.iniciadaEm;
  if (!fim) {
    if (etapa.estado === "na_fila") fim = agora;
    else return 0;
  }
  return minutos(paraMs(fim) - paraMs(etapa.entrouFilaEm));
}

/** Σ bloqueios (aberto conta até agora), recortados entre o início e o fim da execução quando houver. */
export function tempoBloqueada(etapa: EtapaOS, agora: MarcoISO): number {
  const limiteIni = etapa.iniciadaEm ? paraMs(etapa.iniciadaEm) : -Infinity;
  const limiteFim = paraMs(etapa.concluidaEm ?? agora);
  let total = 0;
  for (const b of etapa.bloqueios) {
    const ini = Math.max(paraMs(b.inicioEm), limiteIni);
    const fim = Math.min(paraMs(b.fimEm ?? agora), limiteFim);
    if (fim > ini) total += fim - ini;
  }
  return minutos(total);
}

/** (concluidaEm ou agora) − iniciadaEm − Σ bloqueios. */
export function tempoEmExecucao(etapa: EtapaOS, agora: MarcoISO): number {
  if (!etapa.iniciadaEm) return 0;
  const bruto = minutos(paraMs(etapa.concluidaEm ?? agora) - paraMs(etapa.iniciadaEm));
  return Math.max(0, bruto - tempoBloqueada(etapa, agora));
}

/** 45 → "45 min"; 135 → "2 h 15 min"; 120 → "2 h"; 4560 → "3 d 4 h". */
export function formatarDuracao(min: number): string {
  const total = Number.isFinite(min) ? Math.max(0, Math.floor(min)) : 0;
  if (total < 60) return `${total} min`;
  if (total < 24 * 60) {
    const h = Math.floor(total / 60);
    const r = total % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
  }
  const d = Math.floor(total / (24 * 60));
  const h = Math.floor((total % (24 * 60)) / 60);
  return h ? `${d} d ${h} h` : `${d} d`;
}

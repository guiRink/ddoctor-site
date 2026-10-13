// Horas úteis pelo expediente da oficina (config.expediente), no fuso America/Sao_Paulo.
// Sábado só é útil se 6 estiver em diasSemana; nesse dia o expediente termina em sabadoFim (se houver).
// Feriados ainda não entram (provisório: a configuração não tem lista de feriados).
import type { ConfigOficina, DataISO, MarcoISO } from "../tipos";
import { dataNoFuso, diaSemana, formatarMarco, minutosDeHora, msDeLocal, paraMs, somarDias } from "./fuso";

const MS_HORA = 3_600_000;
const LIMITE_DIAS = 3660; // proteção contra laço infinito

type Expediente = ConfigOficina["expediente"];

/** Janela de trabalho do dia em minutos desde a meia-noite, ou null se o dia não é útil. */
export function janelaDoDia(data: DataISO, config: Pick<ConfigOficina, "expediente">): { inicio: number; fim: number } | null {
  const exp: Expediente = config.expediente;
  const ds = diaSemana(data);
  if (!exp.diasSemana.includes(ds)) return null;
  const inicio = minutosDeHora(exp.inicio);
  const fim = minutosDeHora(ds === 6 && exp.sabadoFim ? exp.sabadoFim : exp.fim);
  return fim > inicio ? { inicio, fim } : null;
}

/** Aceita data (AAAA-MM-DD) ou marco; o dia é o do fuso da oficina. */
export function ehDiaUtil(data: DataISO | MarcoISO, config: Pick<ConfigOficina, "expediente">): boolean {
  const dia = data.length === 10 ? data : dataNoFuso(data);
  return janelaDoDia(dia, config) !== null;
}

/** Horas úteis (fração) entre dois marcos. fim ≤ inicio → 0. */
export function horasUteisEntre(inicio: MarcoISO, fim: MarcoISO, config: Pick<ConfigOficina, "expediente">): number {
  const a = paraMs(inicio);
  const b = paraMs(fim);
  if (b <= a) return 0;
  let total = 0;
  const ultimo = dataNoFuso(b);
  for (let d = dataNoFuso(a), n = 0; d <= ultimo && n < LIMITE_DIAS * 10; d = somarDias(d, 1), n++) {
    const j = janelaDoDia(d, config);
    if (!j) continue;
    const s = Math.max(a, msDeLocal(d, j.inicio));
    const e = Math.min(b, msDeLocal(d, j.fim));
    if (e > s) total += e - s;
  }
  return total / MS_HORA;
}

/**
 * Soma horas úteis a um marco (para calcular prazoEm). Começando fora do expediente, conta a partir
 * da próxima abertura. Terminar exatamente no fechamento devolve o fechamento (não pula para o dia seguinte).
 * horas = 0 devolve o próximo instante útil (o próprio marco, se já estiver dentro do expediente).
 */
export function somarHorasUteis(inicio: MarcoISO, horas: number, config: Pick<ConfigOficina, "expediente">): MarcoISO {
  if (!(horas >= 0)) throw new Error(`horas_invalidas: ${horas}`);
  let restante = horas * MS_HORA;
  let cursor = paraMs(inicio);
  let d = dataNoFuso(cursor);
  for (let n = 0; n < LIMITE_DIAS; n++, d = somarDias(d, 1)) {
    const j = janelaDoDia(d, config);
    if (j) {
      const s = Math.max(cursor, msDeLocal(d, j.inicio));
      const e = msDeLocal(d, j.fim);
      if (s < e) {
        if (restante <= e - s) return formatarMarco(Math.round(s + restante));
        restante -= e - s;
      }
    }
    cursor = -Infinity;
  }
  throw new Error("expediente_sem_dias_uteis");
}

/** Quantos dias úteis em (de, ate]. ate ≤ de → 0. */
export function diasUteisEntre(de: DataISO, ate: DataISO, config: Pick<ConfigOficina, "expediente">): number {
  let n = 0;
  for (let d = somarDias(de, 1), i = 0; d <= ate && i < LIMITE_DIAS * 10; d = somarDias(d, 1), i++) {
    if (janelaDoDia(d, config)) n++;
  }
  return n;
}

/** Próximo dia útil a partir de `data` (inclusive). */
export function proximoDiaUtil(data: DataISO, config: Pick<ConfigOficina, "expediente">): DataISO {
  let d = data;
  for (let n = 0; n < LIMITE_DIAS; n++, d = somarDias(d, 1)) if (janelaDoDia(d, config)) return d;
  throw new Error("expediente_sem_dias_uteis");
}

/** Fechamento do expediente no dia (marco), ou null se o dia não é útil. */
export function fimDoExpediente(data: DataISO, config: Pick<ConfigOficina, "expediente">): MarcoISO | null {
  const j = janelaDoDia(data, config);
  return j ? formatarMarco(msDeLocal(data, j.fim)) : null;
}

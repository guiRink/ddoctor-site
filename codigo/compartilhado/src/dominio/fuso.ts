// Datas de negócio no fuso da oficina (America/Sao_Paulo), sem depender do fuso da máquina.
// Usa Intl (determinístico); nada aqui lê o relógio: o "agora" sempre entra por parâmetro.
import type { DataISO, MarcoISO } from "../tipos";

export const FUSO = "America/Sao_Paulo";

const MS_MIN = 60_000;
const MS_DIA = 86_400_000;

const formatador = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

interface Partes {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
}

function partes(ms: number): Partes {
  const p: Record<string, number> = {};
  for (const { type, value } of formatador.formatToParts(ms)) {
    if (type !== "literal") p[type] = Number(value);
  }
  return { ano: p.year, mes: p.month, dia: p.day, hora: p.hour % 24, minuto: p.minute, segundo: p.second };
}

/** Deslocamento do fuso em minutos naquele instante (ex.: -180). */
function deslocamentoMin(ms: number): number {
  const seg = Math.floor(ms / 1000) * 1000;
  const p = partes(seg);
  return (Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo) - seg) / MS_MIN;
}

const COM_FUSO = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;
const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;

function separarData(data: DataISO): [number, number, number] {
  if (!SO_DATA.test(data)) throw new Error(`data_invalida: ${data}`);
  const [a, m, d] = data.split("-").map(Number);
  return [a, m, d];
}

/** Instante (ms) de um horário de parede no fuso da oficina. */
export function msDeLocal(data: DataISO, minutosDoDia: number): number {
  const [a, m, d] = separarData(data);
  const palpite = Date.UTC(a, m - 1, d) + minutosDoDia * MS_MIN;
  const off1 = deslocamentoMin(palpite);
  let ms = palpite - off1 * MS_MIN;
  const off2 = deslocamentoMin(ms);
  if (off2 !== off1) ms = palpite - off2 * MS_MIN;
  return ms;
}

/** Converte MarcoISO em ms. Sem fuso explícito, interpreta como horário de São Paulo. */
export function paraMs(marco: MarcoISO): number {
  if (SO_DATA.test(marco)) return msDeLocal(marco, 0);
  if (!COM_FUSO.test(marco)) {
    const [data, hora = "00:00:00"] = marco.split("T");
    const [h, mi, s = "0"] = hora.split(":");
    return msDeLocal(data, Number(h) * 60 + Number(mi) + Number(s) / 60);
  }
  const ms = Date.parse(marco);
  if (Number.isNaN(ms)) throw new Error(`marco_invalido: ${marco}`);
  return ms;
}

const doisDig = (n: number) => String(n).padStart(2, "0");

/** ms → "2026-10-12T14:30:00-03:00" no fuso da oficina. */
export function formatarMarco(ms: number): MarcoISO {
  const p = partes(ms);
  const off = deslocamentoMin(ms);
  const sinal = off < 0 ? "-" : "+";
  const abs = Math.abs(off);
  return (
    `${p.ano}-${doisDig(p.mes)}-${doisDig(p.dia)}T${doisDig(p.hora)}:${doisDig(p.minuto)}:${doisDig(p.segundo)}` +
    `${sinal}${doisDig(Math.floor(abs / 60))}:${doisDig(abs % 60)}`
  );
}

/** Ordena marcos pelo instante real (formatos misturados: "Z", "-03:00" ou sem fuso). Para .sort(). */
export function compararMarcos(a: MarcoISO, b: MarcoISO): number {
  return paraMs(a) - paraMs(b);
}

/** AAAA-MM-DD de um dia que existe no calendário (recusa 2026-02-30, 2026-13-01, "12/10/2026"). */
export function dataISOValida(data: unknown): data is DataISO {
  if (typeof data !== "string" || !SO_DATA.test(data)) return false;
  const [a, m, d] = data.split("-").map(Number);
  const r = new Date(Date.UTC(a, m - 1, d));
  return r.getUTCFullYear() === a && r.getUTCMonth() === m - 1 && r.getUTCDate() === d;
}

/** Data de negócio (AAAA-MM-DD) do instante, no fuso da oficina. */
export function dataNoFuso(marco: MarcoISO | number): DataISO {
  const p = partes(typeof marco === "number" ? marco : paraMs(marco));
  return `${p.ano}-${doisDig(p.mes)}-${doisDig(p.dia)}`;
}

/** Minutos desde a meia-noite (horário de parede da oficina). */
export function minutoDoDia(marco: MarcoISO | number): number {
  const p = partes(typeof marco === "number" ? marco : paraMs(marco));
  return p.hora * 60 + p.minuto + p.segundo / 60;
}

/** 0 = domingo … 6 = sábado. */
export function diaSemana(data: DataISO): number {
  const [a, m, d] = separarData(data);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

export function somarDias(data: DataISO, dias: number): DataISO {
  const [a, m, d] = separarData(data);
  const r = new Date(Date.UTC(a, m - 1, d) + dias * MS_DIA);
  return `${r.getUTCFullYear()}-${doisDig(r.getUTCMonth() + 1)}-${doisDig(r.getUTCDate())}`;
}

/** Dias corridos de `de` até `ate` (positivo se `ate` é depois). */
export function diferencaDias(de: DataISO, ate: DataISO): number {
  const [a1, m1, d1] = separarData(de);
  const [a2, m2, d2] = separarData(ate);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / MS_DIA);
}

/** "08:00" → 480. */
export function minutosDeHora(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) throw new Error(`hora_invalida: ${hhmm}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** "AAAA-MM" de uma data ou marco (marco convertido para o dia no fuso da oficina). */
export function mesDe(dataOuMarco: DataISO | MarcoISO): string {
  return (SO_DATA.test(dataOuMarco) ? dataOuMarco : dataNoFuso(dataOuMarco)).slice(0, 7);
}

/** Todos os dias do mês "AAAA-MM", em ordem. */
export function diasDoMes(mes: string): DataISO[] {
  if (!/^\d{4}-\d{2}$/.test(mes)) throw new Error(`mes_invalido: ${mes}`);
  const dias: DataISO[] = [];
  for (let d = `${mes}-01`; d.startsWith(mes); d = somarDias(d, 1)) dias.push(d);
  return dias;
}

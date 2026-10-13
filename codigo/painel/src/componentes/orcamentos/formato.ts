import type { DataISO, MarcoISO } from "@compartilhado/tipos";
import { dataNoFuso, diaSemana, minutoDoDia, paraMs } from "@compartilhado/dominio/fuso";
import { formatarDuracao } from "@compartilhado/dominio/tempos";

// Formatação de datas para as telas (docs/painel-design.md §6): "12/10", "seg 12/10", "14:30".
// Sempre no fuso da oficina. Candidato a subir para src/dominio/ (pedido no relatório do SD).

const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const DIAS_LONGOS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const dois = (n: number) => String(n).padStart(2, "0");

/** "2026-10-12" → "12/10". */
export function dataCurta(data?: DataISO): string {
  if (!data) return "—";
  const [, m, d] = data.slice(0, 10).split("-");
  return `${d}/${m}`;
}

/** "2026-10-12" → "seg 12/10". */
export function diaCurto(data?: DataISO): string {
  if (!data) return "—";
  return `${DIAS_CURTOS[diaSemana(data.slice(0, 10))]} ${dataCurta(data)}`;
}

/** "2026-10-12" → "Segunda, 12 de outubro". */
export function diaExtenso(data: DataISO): string {
  const [, m, d] = data.split("-").map(Number);
  return `${DIAS_LONGOS[diaSemana(data)]}, ${d} de ${MESES[m - 1]}`;
}

/** Marco → "14:30" no fuso da oficina. */
export function hora(marco?: MarcoISO): string {
  if (!marco) return "—";
  const min = Math.floor(minutoDoDia(marco));
  return `${dois(Math.floor(min / 60))}:${dois(min % 60)}`;
}

/** Marco → "12/10 14:30". */
export function marcoCurto(marco?: MarcoISO): string {
  if (!marco) return "—";
  return `${dataCurta(dataNoFuso(marco))} ${hora(marco)}`;
}

/** Minutos entre dois marcos (positivo se `ate` é depois). */
export function minutosEntre(de: MarcoISO, ate: MarcoISO): number {
  return (paraMs(ate) - paraMs(de)) / 60_000;
}

/** "há 2 h 15 min" (ou "agora" abaixo de 1 min). */
export function ha(marco: MarcoISO, agora: MarcoISO): string {
  const min = minutosEntre(marco, agora);
  if (min < 1) return "agora";
  return `há ${formatarDuracao(min)}`;
}

/** Telefone E.164 brasileiro → "(41) 99100-0005"; outro formato volta como veio. */
export function telefoneLegivel(tel?: string): string {
  if (!tel) return "—";
  const d = tel.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
}

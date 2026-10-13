import type { DataISO, Janela, MarcoISO } from "@compartilhado/tipos";
import { dataNoFuso, diaSemana, minutoDoDia, somarDias } from "@compartilhado/dominio/fuso";

// Formatação pt-BR usada pela Agenda e pelas Vistorias (docs/painel-design.md §6).
// Candidato a mover para src/dominio/ quando outra tela precisar (não há formatador comum ainda).

const DIA_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const DIA_LONGO = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

const dd = (n: number) => String(n).padStart(2, "0");

/** "2026-10-12" → "12/10". */
export function diaMes(data: DataISO): string {
  const [, m, d] = data.split("-");
  return `${d}/${m}`;
}

/** "2026-10-12" → "seg 12/10". */
export function diaCurto(data: DataISO): string {
  return `${DIA_CURTO[diaSemana(data)]} ${diaMes(data)}`;
}

/** "2026-10-12" → "segunda-feira". */
export function nomeDia(data: DataISO): string {
  return DIA_LONGO[diaSemana(data)];
}

/** "na segunda-feira (12/10)" / "no sábado (17/10)" — para a mensagem ao cliente. */
export function naDia(data: DataISO): string {
  const ds = diaSemana(data);
  return `${ds === 0 || ds === 6 ? "no" : "na"} ${DIA_LONGO[ds]} (${diaMes(data)})`;
}

export function periodoTexto(janela: Janela): string {
  return janela === "manha" ? "de manhã" : "à tarde";
}

/** Marco → "12/10 14:30" no fuso da oficina. */
export function dataHora(marco: MarcoISO): string {
  const min = Math.floor(minutoDoDia(marco));
  return `${diaMes(dataNoFuso(marco))} ${dd(Math.floor(min / 60))}:${dd(min % 60)}`;
}

/** Segunda-feira da semana de `data`. */
export function inicioDaSemana(data: DataISO): DataISO {
  return somarDias(data, -((diaSemana(data) + 6) % 7));
}

/** "+5541991000011" → "(41) 99100-0011". Formato desconhecido volta como veio. */
export function telefoneBR(e164?: string): string {
  if (!e164) return "";
  const n = e164.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return e164;
}

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

export function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

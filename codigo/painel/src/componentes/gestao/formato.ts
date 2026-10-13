// Formatação de exibição e rótulos das telas de gestão (docs/painel-design.md §6).
// Rótulos daqui são candidatos a mover para src/dominio/rotulos.ts (ver relatório do sprint SD).
import type { Centavos, DataISO, Pagador } from "@compartilhado/tipos";
import type { FaixaAging } from "@compartilhado/dominio/financeiro";
import type { StatusEstoque } from "@compartilhado/dominio/estoque";
import { diaSemana } from "@compartilhado/dominio/fuso";
import type { Tom } from "../ui/Estado";

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-10-12" → "12/10" (com o ano quando não é o ano de referência). */
export function dataCurta(data: DataISO | undefined, anoReferencia?: string): string {
  if (!data) return "—";
  const [a, m, d] = data.slice(0, 10).split("-");
  return anoReferencia && a !== anoReferencia ? `${d}/${m}/${a.slice(2)}` : `${d}/${m}`;
}

/** "2026-10-12" → "seg 12/10". */
export function dataComSemana(data: DataISO): string {
  return `${SEMANA[diaSemana(data.slice(0, 10))]} ${dataCurta(data)}`;
}

/** "2026-10" → "outubro". */
export function nomeMes(mes: string): string {
  return MESES[Number(mes.slice(5, 7)) - 1] ?? mes;
}

/** Valor do campo de dinheiro: 123456 → "1.234,56". */
export function centavosParaCampo(c: Centavos): string {
  const abs = Math.abs(Math.round(c));
  return `${Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${String(abs % 100).padStart(2, "0")}`;
}

const BASE_PRAZO: Record<Pagador["prazo"]["base"], string> = {
  nf: "a emissão da NF",
  entrega: "a entrega do carro",
  servico_realizado: "o serviço realizado",
};

/** "30 dias corridos após o serviço realizado" / "na entrega do carro". */
export function descreverPrazo(p: Pagador): string {
  const { dias, base, diasUteis } = p.prazo;
  if (dias === 0) return base === "entrega" ? "na entrega do carro" : `no dia de ${BASE_PRAZO[base]}`;
  return `${dias} ${dias === 1 ? "dia" : "dias"} ${diasUteis ? (dias === 1 ? "útil" : "úteis") : dias === 1 ? "corrido" : "corridos"} após ${BASE_PRAZO[base]}`;
}

export const TIPO_PAGADOR: Record<Pagador["tipo"], string> = {
  maxpar: "Maxpar",
  cliente: "Cliente",
  seguradora: "Seguradora direta",
  outro: "Outro",
};

export const FAIXA_AGING: Record<FaixaAging, { texto: string; curto: string; tom: Tom }> = {
  a_vencer: { texto: "A vencer", curto: "A vencer", tom: "neutro" },
  "0_30": { texto: "Vencido 1–30 dias", curto: "0–30 dias", tom: "atencao" },
  "31_60": { texto: "Vencido 31–60 dias", curto: "31–60 dias", tom: "alerta" },
  "61_mais": { texto: "Vencido 61+ dias", curto: "61+ dias", tom: "alerta" },
};

export const STATUS_ESTOQUE: Record<StatusEstoque, { texto: string; tom: Tom }> = {
  ok: { texto: "Ok", tom: "ok" },
  baixo: { texto: "Baixo", tom: "atencao" },
  zerado: { texto: "Zerado", tom: "alerta" },
  conferir: { texto: "Conferir", tom: "neutro" },
};

/** Formas de recebimento oferecidas no formulário de baixa. */
export const FORMAS_RECEBIMENTO = ["Pix", "Transferência", "Dinheiro", "Cartão", "Boleto"] as const;

/** Classe padrão de campo de formulário (borda forte, foco preto; o contorno amarelo vem do :focus-visible). */
export const CLASSE_CAMPO =
  "h-11 md:h-9 w-full px-2.5 bg-cartao border border-linha-forte text-[14px] text-tinta focus:border-preto";

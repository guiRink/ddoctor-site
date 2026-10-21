import type { DataISO, Foto } from "@compartilhado/tipos";

// Formatação das fotos da OS (captura e galeria).

/** "2027-10-20" → "20/10/2027" (a retenção é de 12 meses: o ano importa). */
export function dataCompleta(data: DataISO): string {
  const [a, m, d] = data.split("-");
  return `${d}/${m}/${a}`;
}

/**
 * "Guardada até 20/10/2027" — retenção de 12 meses após a entrega (L28); antes da entrega é estimativa.
 * (Revisão SG: "Apagada em…" assustava, parecia que a foto já tinha sido apagada.)
 */
export function textoExpiracao(f: Pick<Foto, "expiraEm" | "expiraProvisorio">): string | undefined {
  if (!f.expiraEm) return undefined;
  return `Guardada até ${dataCompleta(f.expiraEm)}${f.expiraProvisorio ? " (estimativa)" : ""}`;
}

export const DICA_EXPIRACAO = "As fotos ficam guardadas por 12 meses depois da entrega do carro e depois são apagadas. Antes da entrega, a data é uma estimativa.";

/** Fonte da miniatura: a pequena (~20 KB) quando existe, senão a foto inteira. Vazio = indisponível. */
export function fonteMiniatura(f: Pick<Foto, "url" | "miniaturaUrl">): string {
  return f.miniaturaUrl || f.url || "";
}

// Dinheiro em centavos inteiros; arredondar só na exibição.
import type { Centavos } from "../tipos";

/** 123456 → "R$ 1.234,56" (espaço comum; a UI evita a quebra com whitespace-nowrap). */
export function formatarReais(centavos: Centavos | null | undefined): string {
  if (centavos === null || centavos === undefined || !Number.isFinite(centavos)) return "—";
  const inteiro = Math.round(centavos);
  const sinal = inteiro < 0 ? "-" : "";
  const abs = Math.abs(inteiro);
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cent = String(abs % 100).padStart(2, "0");
  return `${sinal}R$ ${reais},${cent}`;
}

/** "1.234,56" | "R$ 160,00" | 1234.56 → centavos. Texto que não é valor devolve null. */
export function reaisParaCentavos(entrada: string | number): Centavos | null {
  if (typeof entrada === "number") {
    if (!Number.isFinite(entrada)) return null;
    return Math.round(Number((entrada * 100).toFixed(6)));
  }
  let t = entrada.replace(/R\$/gi, "").replace(/\s/g, "");
  let negativo = false;
  if (t.startsWith("-")) {
    negativo = true;
    t = t.slice(1);
  }
  if (!t) return null;
  let inteiro: string;
  let fracao = "";
  if (t.includes(",")) {
    if (!/^(\d{1,3}(\.\d{3})+|\d+),\d*$/.test(t)) return null;
    [inteiro, fracao] = t.split(",");
    inteiro = inteiro.replace(/\./g, "");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    inteiro = t.replace(/\./g, "");
  } else if (/^\d+(\.\d*)?$/.test(t)) {
    [inteiro, fracao = ""] = t.split(".");
  } else {
    return null;
  }
  const cent2 = (fracao + "00").slice(0, 2);
  const terceiro = Number(fracao[2] ?? "0");
  let valor = Number(inteiro || "0") * 100 + Number(cent2);
  if (terceiro >= 5) valor += 1;
  return negativo ? -valor : valor;
}

export function somaCentavos(valores: ReadonlyArray<Centavos | null | undefined>): Centavos {
  let total = 0;
  for (const v of valores) if (v !== null && v !== undefined) total += v;
  return total;
}

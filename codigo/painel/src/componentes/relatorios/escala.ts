// Utilitários dos gráficos SVG: largura medida, escala "redonda" e caminho de barra.
import { useCallback, useState } from "react";

/** Largura do elemento (ResizeObserver), para desenhar o SVG em pixels reais — texto nunca escala. */
export function useLarguraDe<T extends HTMLElement>(): [(el: T | null) => void | (() => void), number] {
  const [largura, setLargura] = useState(0);
  const ref = useCallback((el: T | null) => {
    if (!el) return;
    setLargura(Math.floor(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setLargura(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, largura];
}

/** Topo "redondo" do eixo: 1, 2, 2,5 ou 5 × 10ⁿ por divisão. */
export function escalaBonita(maximo: number, divisoes = 4): { topo: number; passo: number } {
  if (!(maximo > 0)) return { topo: divisoes, passo: 1 };
  const bruto = maximo / divisoes;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto) ?? 10 * pot;
  return { topo: passo * Math.ceil(maximo / passo - 1e-9), passo };
}

/** Caminho de barra com os dois cantos de cima arredondados. */
export function caminhoBarra(x: number, y: number, w: number, h: number, r = 3): string {
  if (h <= 0 || w <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

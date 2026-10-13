import type { ReactNode } from "react";

/**
 * Lista de barras horizontais com escala comum (sem biblioteca): rótulo e valor na mesma linha,
 * barra fina embaixo, participação em % à direita. Tom "ok" para entradas, "neutro" para saídas.
 */
export interface ItemBarra {
  chave: string;
  rotulo: ReactNode;
  valor: number;
  /** Texto do valor (ex.: "R$ 1.234,56"). */
  texto: string;
  detalhe?: ReactNode;
}

export function BarrasLista({ itens, tom = "neutro", legenda }: { itens: ItemBarra[]; tom?: "ok" | "neutro"; legenda: string }) {
  const max = Math.max(...itens.map((i) => i.valor), 1);
  const total = itens.reduce((s, i) => s + i.valor, 0);
  const cor = tom === "ok" ? "bg-ok/75" : "bg-tinta-suave/80";
  return (
    <ul aria-label={legenda} className="flex flex-col">
      {itens.map((i) => {
        const pct = total > 0 ? Math.round((i.valor / total) * 100) : 0;
        return (
          <li key={i.chave} className="px-4 py-3 border-b border-linha last:border-b-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-[14px] font-medium truncate">{i.rotulo}</span>
                {i.detalhe && <span className="block text-[12px] text-tinta-fraca numero">{i.detalhe}</span>}
              </span>
              <span className="flex items-baseline gap-3 shrink-0">
                <span className="numero text-[14px] font-semibold whitespace-nowrap">{i.texto}</span>
                <span className="numero text-[12px] text-tinta-fraca w-9 text-right">{pct}%</span>
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-cinza-100" aria-hidden="true">
              <div className={`h-full rounded-full ${cor}`} style={{ width: `${Math.max(1.5, (i.valor / max) * 100)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Rodapé de cartão com total (rótulo à esquerda, valor tabular à direita). */
export function RodapeTotal({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 h-12 border-t border-linha bg-cinza-50">
      <span className="text-[13px] font-medium text-tinta-suave">{rotulo}</span>
      <span className="numero text-[15px] font-semibold whitespace-nowrap">{valor}</span>
    </div>
  );
}

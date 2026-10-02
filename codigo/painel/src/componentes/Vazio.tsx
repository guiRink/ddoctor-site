import type { ReactNode } from "react";

/** Estado vazio com a próxima ação sempre visível. */
export function Vazio({ titulo, texto, acao }: { titulo: string; texto: string; acao?: ReactNode }) {
  return (
    <div className="border border-linha bg-papel p-6 md:p-10 max-w-2xl">
      <h2 className="titulo-condensado text-2xl md:text-3xl">{titulo}</h2>
      <p className="mt-3 text-tinta-suave leading-relaxed max-w-prose">{texto}</p>
      {acao && <div className="mt-6">{acao}</div>}
    </div>
  );
}

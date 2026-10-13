import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

/**
 * Tabela densa das telas de gestão (docs/painel-design.md §3 "Tabela"): cabeçalho `rotulo` sobre `papel`,
 * linhas de 48 px, hover `amarelo-claro`, números alinhados à direita (`numero`).
 * No celular a tela usa a lista em cartões; a tabela só aparece de `md` para cima.
 */
export function Tabela({
  legenda,
  children,
  className = "",
  fixa = false,
}: {
  legenda: string;
  children: ReactNode;
  className?: string;
  /** Larguras fixas (table-fixed): alinha colunas entre tabelas empilhadas. */
  fixa?: boolean;
}) {
  return (
    <div className={`bg-cartao border border-linha overflow-x-auto ${className}`}>
      <table className={`w-full border-collapse text-[14px] ${fixa ? "table-fixed min-w-[560px]" : ""}`}>
        <caption className="sr-only">{legenda}</caption>
        {children}
      </table>
    </div>
  );
}

export function Th({
  direita = false,
  className = "",
  children,
  ...resto
}: ThHTMLAttributes<HTMLTableCellElement> & { direita?: boolean }) {
  return (
    <th
      scope="col"
      className={`rotulo text-tinta-suave bg-papel h-10 px-3 font-bold border-b border-linha whitespace-nowrap ${direita ? "text-right" : "text-left"} ${className}`}
      {...resto}
    >
      {children}
    </th>
  );
}

export function Td({
  numero = false,
  className = "",
  children,
  ...resto
}: TdHTMLAttributes<HTMLTableCellElement> & { numero?: boolean }) {
  return (
    <td className={`h-12 px-3 py-2 align-middle ${numero ? "numero text-right whitespace-nowrap" : ""} ${className}`} {...resto}>
      {children}
    </td>
  );
}

/** Linha com hover suave; `destaque` marca a linha aberta (formulário inline). */
export function Linha({ destaque = false, children, className = "" }: { destaque?: boolean; children: ReactNode; className?: string }) {
  return (
    <tr
      className={`border-b border-linha last:border-b-0 transition-colors duration-150 ${destaque ? "bg-amarelo-claro" : "hover:bg-amarelo-claro"} ${className}`}
    >
      {children}
    </tr>
  );
}

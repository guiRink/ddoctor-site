import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

/**
 * Tabela padrão do painel (docs/painel-design.md §3 "Tabela", revisão SE):
 * superfície branca com raio 8; cabeçalho branco com texto 12/500 cinza (sentence case);
 * linhas de 52 px com divisória suave e hover `cinza-50`; números à direita e tabulares.
 * No celular as telas usam lista em cartões; a tabela aparece de `md` para cima.
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
    <div className={`bg-cartao border border-linha rounded-cartao shadow-cartao overflow-x-auto ${className}`}>
      <table className={`w-full border-collapse text-[14px] ${fixa ? "table-fixed min-w-[560px]" : ""}`}>
        <caption className="sr-only">{legenda}</caption>
        {children}
      </table>
    </div>
  );
}

/** Classe do cabeçalho de coluna, para tabelas que montam o próprio `<th>`. */
export const CLASSE_TH = "rotulo text-tinta-suave bg-cartao h-10 px-3 border-b border-linha whitespace-nowrap";

export function Th({
  direita = false,
  className = "",
  children,
  ...resto
}: ThHTMLAttributes<HTMLTableCellElement> & { direita?: boolean }) {
  return (
    <th scope="col" className={`${CLASSE_TH} ${direita ? "text-right" : "text-left"} ${className}`} {...resto}>
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
    <td className={`h-[52px] px-3 py-2 align-middle ${numero ? "numero text-right whitespace-nowrap" : ""} ${className}`} {...resto}>
      {children}
    </td>
  );
}

/** Classe da linha, para tabelas que montam o próprio `<tr>`. */
export const CLASSE_LINHA = "border-b border-linha last:border-b-0 transition-colors duration-150 hover:bg-cinza-50";

/** Linha com hover suave; `destaque` marca a linha aberta (formulário inline) ou o subtotal. */
export function Linha({
  destaque = false,
  onClick,
  children,
  className = "",
}: {
  destaque?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={`${CLASSE_LINHA} ${destaque ? "bg-cinza-50" : ""} ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {children}
    </tr>
  );
}

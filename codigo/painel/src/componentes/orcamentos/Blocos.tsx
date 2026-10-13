import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icone } from "../Icone";

/** Link "ver tudo" do cabeçalho de um grupo (design §3 "Secao"). */
export function VerTudo({ para, children = "Ver tudo", rotulo }: { para: string; children?: ReactNode; rotulo?: string }) {
  return (
    <Link
      to={para}
      aria-label={rotulo}
      className="inline-flex items-center gap-1 min-h-11 -my-2 px-1 text-[13px] font-semibold text-tinta-suave no-underline hover:text-tinta hover:underline underline-offset-4 shrink-0"
    >
      {children}
      <Icone nome="seta" tamanho={14} />
    </Link>
  );
}

/** Rodapé de lista cortada: "Ver os outros 4". */
export function MaisItens({ restantes, para }: { restantes: number; para?: string }) {
  if (restantes <= 0) return null;
  const texto = `Ver ${restantes === 1 ? "o outro" : `os outros ${restantes}`}`;
  if (!para) return <p className="px-4 py-3 text-[13px] text-tinta-suave numero">e mais {restantes}</p>;
  return (
    <Link to={para} className="flex items-center gap-1 px-4 h-11 text-[13px] font-semibold text-tinta-suave no-underline hover:bg-amarelo-claro hover:text-tinta numero">
      {texto}
      <Icone nome="seta" tamanho={14} />
    </Link>
  );
}

/** Subtítulo dentro de uma lista (ex.: Manhã / Tarde). */
export function Subtitulo({ children }: { children: ReactNode }) {
  return <p className="rotulo text-tinta-suave bg-papel px-4 h-8 flex items-center border-b border-linha numero">{children}</p>;
}

/** Linha de texto quando um grupo está vazio, com a próxima ação. */
export function LinhaVazia({ children }: { children: ReactNode }) {
  return <p className="px-4 py-4 text-[13px] text-tinta-suave">{children}</p>;
}

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";

type Variante = "primario" | "secundario" | "perigo" | "fantasma";

const CLASSES: Record<Variante, string> = {
  primario: "bg-amarelo text-preto hover:bg-preto hover:text-amarelo",
  secundario: "bg-preto text-papel hover:bg-grafite-2",
  perigo: "bg-papel text-alerta border border-alerta hover:bg-alerta hover:text-papel",
  fantasma: "bg-transparent text-tinta border border-linha hover:border-preto",
};

const BASE =
  "inline-flex items-center justify-center gap-2 min-h-11 px-4 text-[13px] font-extrabold uppercase tracking-[0.04em] transition-colors disabled:opacity-40 disabled:pointer-events-none";

export function Botao({
  variante = "primario",
  className = "",
  children,
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; children: ReactNode }) {
  return (
    <button type="button" className={`${BASE} ${CLASSES[variante]} ${className}`} {...resto}>
      {children}
    </button>
  );
}

export function BotaoLink({
  para,
  variante = "primario",
  className = "",
  children,
}: {
  para: string;
  variante?: Variante;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={para} className={`${BASE} ${CLASSES[variante]} ${className} no-underline`}>
      {children}
    </Link>
  );
}

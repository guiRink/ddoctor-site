import type { Semaforo as TipoSemaforo } from "@compartilhado/tipos";
import type { ReactNode } from "react";

/** Tons de estado — docs/painel-design.md §2. */
export type Tom = "ok" | "atencao" | "alerta" | "amarelo" | "neutro" | "escuro" | "maxpar";

const TOM: Record<Tom, string> = {
  ok: "bg-ok-claro text-ok",
  atencao: "bg-atencao-claro text-atencao",
  alerta: "bg-alerta-claro text-alerta",
  amarelo: "bg-amarelo text-preto",
  neutro: "bg-cartao text-tinta-suave border border-linha-forte",
  escuro: "bg-preto text-papel",
  maxpar: "bg-[#E7ECF5] text-maxpar",
};

/** Etiqueta de estado (OS, orçamento, agendamento, título). Texto sempre visível, nunca só cor. */
export function Etiqueta({ tom = "neutro", children, className = "" }: { tom?: Tom; children: ReactNode; className?: string }) {
  return (
    <span className={`rotulo inline-flex items-center gap-1.5 px-2 h-6 whitespace-nowrap ${TOM[tom]} ${className}`}>{children}</span>
  );
}

const SEMAFORO: Record<TipoSemaforo, { tom: Tom; texto: string; ponto: string }> = {
  verde: { tom: "ok", texto: "No prazo", ponto: "bg-ok" },
  laranja: { tom: "atencao", texto: "Atenção", ponto: "bg-atencao" },
  vermelho: { tom: "alerta", texto: "Atrasado", ponto: "bg-alerta" },
  neutro: { tom: "neutro", texto: "Sem prazo", ponto: "bg-tinta-fraca" },
};

/** Semáforo de prazo com ponto + texto. `texto` permite "Impedido" no lugar de "Atrasado". */
export function Semaforo({ valor, texto, className = "" }: { valor: TipoSemaforo; texto?: string; className?: string }) {
  const s = SEMAFORO[valor];
  return (
    <Etiqueta tom={s.tom} className={className}>
      <span aria-hidden="true" className={`inline-block w-2 h-2 ${s.ponto}`} />
      {texto ?? s.texto}
    </Etiqueta>
  );
}

export function corSemaforo(valor: TipoSemaforo): string {
  return { verde: "bg-ok", laranja: "bg-atencao", vermelho: "bg-alerta", neutro: "bg-linha-forte" }[valor];
}

/** Marca de valor provisório (ainda não confirmado pelo dono). */
export function Provisorio({ children }: { children: ReactNode }) {
  return (
    <span
      className="underline decoration-dotted decoration-atencao underline-offset-4"
      title="Provisório — a confirmar com a oficina"
    >
      {children}
    </span>
  );
}

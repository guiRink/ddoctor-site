import type { Semaforo as TipoSemaforo } from "@compartilhado/tipos";
import type { ReactNode } from "react";

/** Tons de estado — docs/painel-design.md §2/§3 (revisão SE: pílulas suaves). */
export type Tom = "ok" | "atencao" | "alerta" | "amarelo" | "neutro" | "escuro" | "maxpar";

// Fundo tint claro + texto escuro da cor + ponto. "amarelo" = em andamento/vez de agir;
// "escuro" = estado firme neutro (agendado, na oficina); "neutro" = sem urgência.
const TOM: Record<Tom, { pilula: string; ponto?: string }> = {
  ok: { pilula: "bg-ok-claro text-ok", ponto: "bg-ok" },
  atencao: { pilula: "bg-atencao-claro text-atencao", ponto: "bg-atencao" },
  alerta: { pilula: "bg-alerta-claro text-alerta", ponto: "bg-alerta" },
  amarelo: { pilula: "bg-amarelo-claro text-amarelo-tinta", ponto: "bg-amarelo" },
  neutro: { pilula: "bg-cinza-100 text-tinta-suave" },
  escuro: { pilula: "bg-cinza-200 text-tinta", ponto: "bg-tinta" },
  maxpar: { pilula: "bg-maxpar-claro text-maxpar", ponto: "bg-maxpar" },
};

/** Etiqueta de estado (OS, orçamento, agendamento, título). Texto sempre visível, nunca só cor. */
export function Etiqueta({
  tom = "neutro",
  ponto,
  children,
  className = "",
}: {
  tom?: Tom;
  /** Mostra o ponto da cor; padrão: sim em todos os tons menos "neutro". */
  ponto?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const t = TOM[tom];
  const comPonto = ponto ?? t.ponto !== undefined;
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[12px] font-medium leading-none whitespace-nowrap numero ${t.pilula} ${className}`}
    >
      {comPonto && <span aria-hidden="true" className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${t.ponto ?? "bg-tinta-fraca"}`} />}
      {children}
    </span>
  );
}

const SEMAFORO: Record<TipoSemaforo, { tom: Tom; texto: string }> = {
  verde: { tom: "ok", texto: "No prazo" },
  laranja: { tom: "atencao", texto: "Atenção" },
  vermelho: { tom: "alerta", texto: "Atrasado" },
  neutro: { tom: "neutro", texto: "Sem prazo" },
};

/** Semáforo de prazo com ponto + texto. `texto` permite "Impedido" no lugar de "Atrasado". */
export function Semaforo({ valor, texto, className = "" }: { valor: TipoSemaforo; texto?: string; className?: string }) {
  const s = SEMAFORO[valor];
  return (
    <Etiqueta tom={s.tom} ponto className={className}>
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
      className="underline decoration-dotted decoration-atencao decoration-[1.5px] underline-offset-4"
      title="Provisório — a confirmar com a oficina"
    >
      {children}
    </span>
  );
}

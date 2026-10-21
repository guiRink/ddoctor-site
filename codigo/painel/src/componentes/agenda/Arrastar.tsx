import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import type { DataISO, Janela } from "@compartilhado/tipos";
import { Placa } from "../ui/Placa";
import { JA_ESTA_AQUI, type AvaliacaoDestino, type Movel } from "./modelo";
import { Ctx, type CtxArrastar, type DadosAlvo, type EstadoAlvo } from "./ganchosArrastar";

/**
 * Arrastar e soltar da Agenda (sprint SG) sobre o @dnd-kit/core: mouse (arrasta depois de 6 px),
 * toque (toque longo) e teclado (espaço pega, setas andam entre dias e turnos, espaço solta, Esc cancela).
 * Um cartão selecionado arrasta o grupo selecionado inteiro. A tela decide o que é válido (`avaliar`)
 * e o que fazer ao soltar (`onSoltar`).
 */

// Pointer: o alvo é o que está sob o ponteiro. Teclado: o mais perto do centro (as setas centralizam).
const colisao: CollisionDetection = (args) => (args.pointerCoordinates ? pointerWithin(args) : closestCenter(args));

/** Setas: pula para o centro do alvo vizinho naquela direção (dia ao lado, manhã/tarde). */
const proximoAlvo: KeyboardCoordinateGetter = (event, { currentCoordinates, context }) => {
  const direcao: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
  const dir = direcao[event.code];
  const { collisionRect, droppableRects, droppableContainers } = context;
  if (!dir || !collisionRect) return undefined;
  event.preventDefault();
  const cx = collisionRect.left + collisionRect.width / 2;
  const cy = collisionRect.top + collisionRect.height / 2;
  let melhor: { x: number; y: number; nota: number } | null = null;
  for (const c of droppableContainers.getEnabled()) {
    const r = droppableRects.get(c.id);
    if (!r) continue;
    const tx = r.left + r.width / 2;
    const ty = r.top + Math.min(r.height / 2, 60); // célula alta: mira o topo, onde o cartão cai
    const dx = tx - cx;
    const dy = ty - cy;
    const frente = dir[0] ? dx * dir[0] : dy * dir[1];
    if (frente <= 8) continue;
    const lado = dir[0] ? Math.abs(dy) : Math.abs(dx);
    const nota = frente + lado * 3;
    if (!melhor || nota < melhor.nota) melhor = { x: tx, y: ty, nota };
  }
  if (!melhor) return currentCoordinates;
  return { x: currentCoordinates.x + (melhor.x - cx), y: currentCoordinates.y + (melhor.y - cy) };
};

export function ProvedorArrastar({
  habilitado,
  grupoDe,
  avaliar,
  descrever,
  onSoltar,
  onRecusar,
  onMudar,
  children,
}: {
  habilitado: boolean;
  /** O grupo que vai junto quando `chave` é pega (a seleção, se ela estiver nela). */
  grupoDe: (chave: string) => Movel[];
  avaliar: CtxArrastar["avaliar"];
  /** "sex 24/10, tarde". */
  descrever: (data: DataISO, janela: Janela) => string;
  onSoltar: (grupo: Movel[], data: DataISO, janela: Janela, avaliacao: AvaliacaoDestino) => void;
  onRecusar: (texto: string) => void;
  /** Avisado quando um arrasto começa ou termina (para o Esc da seleção não brigar com o do arrasto). */
  onMudar?: (arrastando: boolean) => void;
  children: ReactNode;
}) {
  const [grupo, setGrupo] = useState<Movel[] | null>(null);
  const fim = useRef(0);
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 280, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      keyboardCodes: { start: ["Space"], cancel: ["Escape", "Tab"], end: ["Space", "Enter"] },
      coordinateGetter: proximoAlvo,
    }),
  );

  const nomeGrupo = (g: Movel[] | null) => {
    if (!g || g.length === 0) return "carro";
    return g.length === 1 ? `${g[0].placa}${g[0].modelo ? ` ${g[0].modelo}` : ""}` : `${g.length} carros`;
  };

  const grupoRef = useRef<Movel[] | null>(null);
  const anuncios: Announcements = {
    onDragStart: () => `Pegou ${nomeGrupo(grupoRef.current)}. Setas escolhem o dia e o turno; espaço solta; Esc cancela.`,
    onDragOver: ({ over }) => {
      if (!over) return `${nomeGrupo(grupoRef.current)} fora da agenda.`;
      const d = over.data.current as DadosAlvo;
      const a = grupoRef.current ? avaliar(d.data, d.janela, grupoRef.current) : undefined;
      const quando = descrever(d.data, d.janela);
      if (!a) return quando;
      if (!a.ok) return `${quando}: ${a.motivo?.toLowerCase()}, não dá para soltar.`;
      return a.encaixe > 0 ? `${quando}: ${a.motivo?.toLowerCase()}. Soltar pede confirmação.` : `${quando}: pode soltar.`;
    },
    onDragEnd: ({ over }) => {
      if (!over) return "Solto fora da agenda. Nada mudou.";
      const d = over.data.current as DadosAlvo;
      return `Solto em ${descrever(d.data, d.janela)}.`;
    },
    onDragCancel: () => "Movimento cancelado. Nada mudou.",
  };

  function comecar(e: DragStartEvent) {
    const g = grupoDe(String(e.active.id));
    grupoRef.current = g;
    setGrupo(g);
    onMudar?.(true);
  }

  function terminar(e: DragEndEvent | null) {
    const g = grupoRef.current;
    grupoRef.current = null;
    setGrupo(null);
    fim.current = Date.now();
    onMudar?.(false);
    if (!e?.over || !g) return;
    const d = e.over.data.current as DadosAlvo;
    const a = avaliar(d.data, d.janela, g);
    if (!a.ok) {
      if (a.motivo !== JA_ESTA_AQUI) onRecusar(`Não dá para mover para ${descrever(d.data, d.janela)}: ${a.motivo?.toLowerCase()}.`);
      return;
    }
    onSoltar(g, d.data, d.janela, a);
  }

  const valor = useMemo<CtxArrastar>(
    () => ({ grupo, avaliar, acabouDeArrastar: () => Date.now() - fim.current < 250 }),
    [grupo, avaliar],
  );

  if (!habilitado) return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={colisao}
      onDragStart={comecar}
      onDragEnd={terminar}
      onDragCancel={() => terminar(null)}
      accessibility={{
        announcements: anuncios,
        screenReaderInstructions: {
          draggable: "Para mudar o dia, aperte espaço. As setas escolhem o dia e o turno, espaço solta e Esc cancela. Enter abre as ações.",
        },
      }}
    >
      <Ctx.Provider value={valor}>{children}</Ctx.Provider>
      <DragOverlay dropAnimation={null}>{grupo ? <Fantasma grupo={grupo} /> : null}</DragOverlay>
    </DndContext>
  );
}

/** O que segue o ponteiro: o carro pego e, no grupo, "3 carros". */
function Fantasma({ grupo }: { grupo: Movel[] }) {
  const m = grupo[0];
  return (
    <div className="relative w-[200px] cursor-grabbing flex items-center gap-2 p-2 rounded-controle border border-amarelo-escuro bg-cartao elevacao">
      <Placa placa={m.placa} tamanho="p" />
      <span className="min-w-0 text-[13px] font-semibold leading-tight truncate text-tinta">{m.modelo ?? "Carro"}</span>
      {grupo.length > 1 && (
        <span className="absolute -top-2.5 -right-2.5 inline-flex items-center h-6 px-2 rounded-full bg-tinta text-cartao text-[12px] font-semibold numero">
          {grupo.length} carros
        </span>
      )}
    </div>
  );
}

/** Faixa curta dentro da célula com o motivo (só no alvo sob o ponteiro/teclado). */
export function MotivoAlvo({ alvo }: { alvo: EstadoAlvo }) {
  const a = alvo.avaliacao;
  if (!alvo.arrastando || !alvo.sobre || !a || a.motivo === JA_ESTA_AQUI) return null;
  const texto = !a.ok ? a.motivo : a.encaixe > 0 ? a.motivo : a.total > 1 ? `Soltar ${a.total} aqui` : "Soltar aqui";
  const cor = !a.ok ? "text-alerta" : a.encaixe > 0 ? "text-atencao" : "text-amarelo-tinta";
  return <p className={`px-1 text-[12px] font-semibold leading-tight ${cor}`}>{texto}</p>;
}

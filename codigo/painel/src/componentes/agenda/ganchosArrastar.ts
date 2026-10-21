import { createContext, useContext } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { DataISO, Janela } from "@compartilhado/tipos";
import { JA_ESTA_AQUI, type AvaliacaoDestino, type Movel } from "./modelo";

// Contexto e ganchos do arrastar da Agenda (o provedor e as peças visuais estão em Arrastar.tsx).

export interface CtxArrastar {
  /** Grupo sendo arrastado agora (null = nada). */
  grupo: Movel[] | null;
  avaliar: (data: DataISO, janela: Janela, grupo: Movel[]) => AvaliacaoDestino;
  /** true logo depois de um arrasto: o clique que vem junto com o soltar é ignorado. */
  acabouDeArrastar: () => boolean;
}

export const Ctx = createContext<CtxArrastar>({ grupo: null, avaliar: () => ({ ok: false, cabem: 0, total: 0, encaixe: 0 }), acabouDeArrastar: () => false });

export const idAlvo = (data: DataISO, janela: Janela) => `${data}|${janela}`;

export interface DadosAlvo {
  data: DataISO;
  janela: Janela;
}

export function useArrastar() {
  return useContext(Ctx);
}

/** Liga um cartão ao arrasto. `ativador` recebe o foco do teclado (o botão principal do cartão). */
export function useArrastavel(movel: Movel, desabilitado: boolean) {
  const { grupo, acabouDeArrastar } = useContext(Ctx);
  const d = useDraggable({ id: movel.chave, data: { chave: movel.chave }, disabled: desabilitado });
  const noGrupo = Boolean(grupo?.some((m) => m.chave === movel.chave));
  return {
    prender: d.setNodeRef,
    prenderAtivador: d.setActivatorNodeRef,
    atributos: desabilitado ? {} : { ...d.attributes, "aria-roledescription": "carro arrastável" },
    ouvintes: desabilitado ? {} : (d.listeners ?? {}),
    /** Este cartão está indo junto no arrasto (fica apagado no lugar). */
    levando: noGrupo,
    acabouDeArrastar,
  };
}

/** Liga uma célula (dia + turno) ao soltar; diz se é um bom alvo para o grupo em arrasto. */
export function useAlvo(data: DataISO, janela: Janela) {
  const { grupo, avaliar } = useContext(Ctx);
  const d = useDroppable({ id: idAlvo(data, janela), data: { data, janela } satisfies DadosAlvo });
  const avaliacao = grupo ? avaliar(data, janela, grupo) : undefined;
  return { prender: d.setNodeRef, sobre: d.isOver, avaliacao, arrastando: Boolean(grupo) };
}

/**
 * Classes da célula enquanto há arrasto: sobre um alvo válido = amarelo-claro; encaixe = atenção;
 * inválido = vermelho suave. Fora do ponteiro, só um contorno tracejado nos válidos.
 */
export interface EstadoAlvo {
  sobre: boolean;
  avaliacao?: AvaliacaoDestino;
  arrastando: boolean;
}

export function classesAlvo(alvo: EstadoAlvo): string {
  const a = alvo.avaliacao;
  if (!alvo.arrastando || !a || a.motivo === JA_ESTA_AQUI) return "";
  if (alvo.sobre) {
    if (!a.ok) return "bg-alerta-claro outline-2 -outline-offset-2 outline-alerta/50";
    if (a.encaixe > 0) return "bg-atencao-claro outline-2 -outline-offset-2 outline-atencao/60";
    return "bg-amarelo-claro outline-2 -outline-offset-2 outline-amarelo-escuro";
  }
  return a.ok ? "outline-1 -outline-offset-2 outline-dashed outline-linha-forte" : "opacity-60";
}


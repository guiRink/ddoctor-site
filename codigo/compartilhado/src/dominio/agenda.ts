// Capacidade de entradas por dia (arq. §7.3): confirmado + proposto não expirado ocupam vaga.
import type { Agendamento, CapacidadeDia, DataISO, Id, Janela, MarcoISO } from "../tipos";
import { paraMs } from "./fuso";
import { falha, type Resultado } from "./resultado";

/** Proposta sem expiraEm ocupa a vaga até alguém resolver (não expira sozinha). */
function ocupaVaga(a: Agendamento, agoraMs: number): boolean {
  if (a.estado === "confirmado") return true;
  if (a.estado === "proposto") return !a.expiraEm || agoraMs < paraMs(a.expiraEm);
  return false;
}

export function vagasOcupadas(data: DataISO, agendamentos: readonly Agendamento[], agora: MarcoISO, ignorarId?: Id): number {
  const agoraMs = paraMs(agora);
  return agendamentos.filter((a) => a.data === data && a.id !== ignorarId && ocupaVaga(a, agoraMs)).length;
}

/** vagasEntrada − ocupadas; dia bloqueado → 0; nunca negativo. */
export function vagasRestantes(capacidade: CapacidadeDia, agendamentos: readonly Agendamento[], agora: MarcoISO, ignorarId?: Id): number {
  if (capacidade.bloqueado) return 0;
  return Math.max(0, capacidade.vagasEntrada - vagasOcupadas(capacidade.data, agendamentos, agora, ignorarId));
}

export type CodigoAgenda = "sem_vaga" | "dia_bloqueado";

/**
 * Cabe mais um agendamento no dia? `agendamentoId` = o próprio agendamento sendo confirmado
 * (uma proposta que já ocupa vaga não conta duas vezes).
 */
export function podeConfirmar(
  capacidade: CapacidadeDia,
  agendamentos: readonly Agendamento[],
  agora: MarcoISO,
  agendamentoId?: Id,
): Resultado<CodigoAgenda> {
  if (capacidade.bloqueado) return falha("dia_bloqueado");
  return vagasRestantes(capacidade, agendamentos, agora, agendamentoId) > 0 ? { ok: true } : falha("sem_vaga");
}

export interface OpcoesReagendar {
  /** Id do novo registro; padrão `${id}-r`. */
  novoId?: Id;
  /** Capacidade da nova data; se vier, a vaga é conferida (o anterior já não conta). */
  capacidade?: CapacidadeDia;
  /** Validade da nova proposta (quando o anterior era "proposto"); sem ela, vale a do anterior. */
  expiraEm?: MarcoISO;
  motivo?: string;
}

export type CodigoReagendar = CodigoAgenda | "agendamento_nao_encontrado" | "transicao_invalida";

/**
 * Reagendar = novo registro com substituiId e o anterior "cancelado" na mesma operação (libera a vaga).
 * Só de "proposto" ou "confirmado"; o novo herda o estado do anterior (e, se proposto, o expiraEm).
 */
export function reagendar(
  agendamentos: readonly Agendamento[],
  id: Id,
  novaData: DataISO,
  janela: Janela,
  agora: MarcoISO,
  opcoes: OpcoesReagendar = {},
): Resultado<CodigoReagendar, { agendamentos: Agendamento[]; novo: Agendamento }> {
  const anterior = agendamentos.find((a) => a.id === id);
  if (!anterior) return falha("agendamento_nao_encontrado");
  if (anterior.estado !== "proposto" && anterior.estado !== "confirmado") return falha("transicao_invalida");
  if (opcoes.capacidade) {
    if (opcoes.capacidade.data !== novaData) throw new Error("capacidade_de_outra_data");
    const r = podeConfirmar(opcoes.capacidade, agendamentos, agora, id);
    if (!r.ok) return r;
  }
  const novo: Agendamento = {
    id: opcoes.novoId ?? `${id}-r`,
    osId: anterior.osId,
    data: novaData,
    janela,
    estado: anterior.estado,
    origem: anterior.origem,
    substituiId: anterior.id,
  };
  // proposta arrastada (ou desfeita) continua com o prazo de resposta que tinha, salvo nova validade explícita
  if (anterior.estado === "proposto") {
    const expiraEm = opcoes.expiraEm ?? anterior.expiraEm;
    if (expiraEm) novo.expiraEm = expiraEm;
  }
  const lista = agendamentos.map((a) =>
    a.id === id ? { ...a, estado: "cancelado" as const, motivoCancelamento: opcoes.motivo?.trim() || "reagendado" } : { ...a },
  );
  lista.push(novo);
  return { ok: true, agendamentos: lista, novo };
}

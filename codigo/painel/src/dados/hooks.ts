import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Baixa, DataISO, Id, Janela } from "@compartilhado/tipos";
import { ERRO } from "../dominio/rotulos";
import { repositorioMemoria } from "./repositorioMemoria";
import type { NovoAtendimentoRapido, Repositorio, Resultado } from "./repositorio";

/**
 * Hooks de dados — a ÚNICA forma de uma tela ler ou mudar dados (CLAUDE.md).
 * Hoje sobre o repositório em memória; no S1 troca para o RepositorioSupabase escolhendo por VITE_DADOS.
 */
export const repositorio: Repositorio = repositorioMemoria;

const CHAVE = ["oficina"] as const;

export const useOSs = () => useQuery({ queryKey: [...CHAVE, "os"], queryFn: () => repositorio.listarOS() });
export const useOS = (id: Id | undefined) =>
  useQuery({ queryKey: [...CHAVE, "os", id], queryFn: () => repositorio.obterOS(id!), enabled: Boolean(id) });
export const useAgendamentos = () => useQuery({ queryKey: [...CHAVE, "agendamentos"], queryFn: () => repositorio.listarAgendamentos() });
export const useCapacidade = (inicio: DataISO, fim: DataISO) =>
  useQuery({ queryKey: [...CHAVE, "capacidade", inicio, fim], queryFn: () => repositorio.listarCapacidade(inicio, fim) });
export const usePerfis = () => useQuery({ queryKey: [...CHAVE, "perfis"], queryFn: () => repositorio.listarPerfis() });
export const useTiposReparo = () => useQuery({ queryKey: [...CHAVE, "tipos"], queryFn: () => repositorio.listarTiposReparo() });
export const usePagadores = () => useQuery({ queryKey: [...CHAVE, "pagadores"], queryFn: () => repositorio.listarPagadores() });
export const useTitulos = () => useQuery({ queryKey: [...CHAVE, "titulos"], queryFn: () => repositorio.listarTitulos() });
export const useDespesas = () => useQuery({ queryKey: [...CHAVE, "despesas"], queryFn: () => repositorio.listarDespesas() });
export const useMateriais = () => useQuery({ queryKey: [...CHAVE, "materiais"], queryFn: () => repositorio.listarMateriais() });
export const useConfig = () => useQuery({ queryKey: [...CHAVE, "config"], queryFn: () => repositorio.obterConfig() });

/** Relógio da tela: re-renderiza a cada `ms` para tempos e semáforos andarem sozinhos. */
export function useAgora(ms = 30_000): string {
  const [agora, setAgora] = useState(() => new Date().toISOString());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date().toISOString()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return agora;
}

/** Mensagem pt-BR para um código de erro do domínio/banco. */
export function mensagemErro(codigo?: string): string {
  return (codigo && ERRO[codigo]) || "Não foi possível concluir a ação. Tente de novo.";
}

/**
 * Ações (mutações). Cada uma devolve o Resultado; ao dar certo, invalida as consultas para
 * todas as telas (inclusive a TV) refletirem a mudança.
 */
export function useAcoes() {
  const qc = useQueryClient();
  const mut = <A extends unknown[]>(fn: (...args: A) => Promise<Resultado & { osId?: Id }>) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMutation({
      mutationFn: (args: A) => fn(...args),
      onSuccess: (r) => {
        if (r.ok) qc.invalidateQueries({ queryKey: CHAVE });
      },
    });

  return {
    iniciarEtapa: mut((etapaId: Id, responsavelId: Id) => repositorio.iniciarEtapa(etapaId, responsavelId)),
    concluirEtapa: mut((etapaId: Id, dados: { pecasFeitas?: number; temFoto?: boolean }) => repositorio.concluirEtapa(etapaId, dados)),
    bloquearEtapa: mut((etapaId: Id, motivo: string) => repositorio.bloquearEtapa(etapaId, motivo)),
    retomarEtapa: mut((etapaId: Id) => repositorio.retomarEtapa(etapaId)),
    dispensarEtapa: mut((etapaId: Id, motivo: string) => repositorio.dispensarEtapa(etapaId, motivo)),
    atribuirResponsavel: mut((etapaId: Id, perfilId: Id) => repositorio.atribuirResponsavel(etapaId, perfilId)),
    criarAtendimentoRapido: mut((dados: NovoAtendimentoRapido) => repositorio.criarAtendimentoRapido(dados)),
    registrarAprovacao: mut((osId: Id, evidencia: string) => repositorio.registrarAprovacao(osId, evidencia)),
    registrarEntrada: mut((osId: Id, tipoReparoId: Id) => repositorio.registrarEntrada(osId, tipoReparoId)),
    registrarEntrega: mut((osId: Id) => repositorio.registrarEntrega(osId)),
    agendar: mut((osId: Id, data: DataISO, janela: Janela) => repositorio.agendar(osId, data, janela)),
    reagendar: mut((agendamentoId: Id, data: DataISO, janela: Janela) => repositorio.reagendar(agendamentoId, data, janela)),
    cancelarAgendamento: mut((agendamentoId: Id, motivo: string) => repositorio.cancelarAgendamento(agendamentoId, motivo)),
    marcarNaoCompareceu: mut((agendamentoId: Id) => repositorio.marcarNaoCompareceu(agendamentoId)),
    concluirPendencia: mut((pendenciaId: Id) => repositorio.concluirPendencia(pendenciaId)),
    aplicarBaixa: mut((tituloId: Id, baixa: Omit<Baixa, "id">) => repositorio.aplicarBaixa(tituloId, baixa)),
    pagarDespesa: mut((despesaId: Id, valor: number, pagoEm: DataISO) => repositorio.pagarDespesa(despesaId, valor, pagoEm)),
    restaurarDemo: mut(async () => {
      await repositorio.restaurarDemo();
      return { ok: true };
    }),
  };
}

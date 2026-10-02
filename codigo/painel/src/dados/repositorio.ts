import type { Atendimento } from "../dominio/tipos";

/**
 * Única porta de entrada dos dados. Hoje implementada com Dexie (IndexedDB);
 * no Sprint 4 ganha uma implementação Supabase com a mesma assinatura.
 * Componentes nunca falam com o banco direto.
 */
export interface Repositorio {
  listar(): Promise<Atendimento[]>;
  obter(id: string): Promise<Atendimento | undefined>;
  salvar(atendimento: Atendimento): Promise<void>;
  remover(id: string): Promise<void>;
  contarDemo(): Promise<number>;
  semearDemo(itens: Atendimento[]): Promise<void>;
  limparDemo(): Promise<void>;
}

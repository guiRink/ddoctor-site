import { modoDados, type ModoDados } from "./modo";
import type { Repositorio } from "./repositorio";
import { repositorioMemoria } from "./repositorioMemoria";
import { criarRepositorioSupabase } from "./repositorioSupabase";
import { clienteSupabase, type ClienteSupabase } from "./supabase";

/**
 * Escolhe o repositório da aba (sprint S1): Supabase (banco real) ou memória (demonstração). Ver modo.ts.
 * `cliente` só para testes (cliente do Supabase falso).
 */
export function criarRepositorio(modo: ModoDados = modoDados(), cliente: () => ClienteSupabase = clienteSupabase): Repositorio {
  return modo === "supabase" ? criarRepositorioSupabase(cliente()) : repositorioMemoria;
}

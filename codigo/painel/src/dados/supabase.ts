import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente único do Supabase (sprint S1). Só `src/dados/*` importa o supabase-js (o lint bloqueia nas telas e
 * componentes). Lê a URL e a chave PÚBLICA (anon/publishable) do `.env.local` ou das variáveis do build; a chave
 * secreta (service_role) nunca chega ao front. A sessão do login fica no localStorage (`ddoctor.auth`).
 */
export type ClienteSupabase = SupabaseClient;

export function configSupabase(): { url?: string; chave?: string } {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || undefined;
  const chave = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || undefined;
  return { url, chave };
}

let cliente: ClienteSupabase | null = null;

export function clienteSupabase(): ClienteSupabase {
  if (cliente) return cliente;
  const { url, chave } = configSupabase();
  if (!url || !chave) throw new Error("supabase_nao_configurado: preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY");
  cliente = createClient(url, chave, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "ddoctor.auth" },
  });
  return cliente;
}

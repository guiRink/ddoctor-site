import { vi } from "vitest";
import type { ClienteSupabase } from "./supabase";

/**
 * Cliente do Supabase FALSO para os testes do RepositorioSupabase (só usado em *.test.ts). Cada consulta
 * `from(tabela)...` grava a cadeia de chamadas (select, eq, order, insert...) e responde pelo `tabelas[tabela]`;
 * `rpc(nome)` responde por `rpc[nome]`. Nada vai para a rede.
 */
export type Op = [metodo: string, args: unknown[]];
export type RespostaFalsa = { data: unknown; error: { code?: string; message?: string } | null };
type Resolvedor = RespostaFalsa | ((ops: Op[]) => RespostaFalsa);

export interface ConfigFalso {
  uid?: string | null;
  /** Linha do próprio perfil (contexto do repositório). */
  eu?: { id: string; oficina_id: string; papel: string; ativo?: boolean; login_desativado_em?: string | null } | null;
  tabelas?: Record<string, Resolvedor>;
  rpc?: Record<string, RespostaFalsa | ((params: Record<string, unknown>) => RespostaFalsa)>;
  invoke?: (nome: string, opcoes: { body: unknown }) => Promise<{ data: unknown; error: unknown }>;
}

export function supabaseFalso(cfg: ConfigFalso = {}) {
  const consultas: { tabela: string; ops: Op[] }[] = [];
  const uid = cfg.uid === undefined ? "u-1" : cfg.uid;
  const eu = cfg.eu === undefined ? { id: "p-1", oficina_id: "of-1", papel: "dono", ativo: true, login_desativado_em: null } : cfg.eu;

  function responder(tabela: string, ops: Op[]): RespostaFalsa {
    const r = cfg.tabelas?.[tabela];
    if (r) return typeof r === "function" ? r(ops) : r;
    if (tabela === "perfil") return { data: eu ? { ativo: true, login_desativado_em: null, ...eu } : null, error: null };
    return { data: [], error: null };
  }

  function construtor(tabela: string) {
    const ops: Op[] = [];
    consultas.push({ tabela, ops });
    const b: unknown = new Proxy(
      {},
      {
        get(_alvo, prop) {
          if (prop === "then") return (ok: (v: RespostaFalsa) => unknown, erro: (e: unknown) => unknown) => Promise.resolve(responder(tabela, ops)).then(ok, erro);
          return (...args: unknown[]) => {
            ops.push([String(prop), args]);
            return b;
          };
        },
      },
    );
    return b;
  }

  const balde = {
    upload: vi.fn(async (caminho: string) => ({ data: { path: caminho }, error: null as unknown })),
    remove: vi.fn(async (_caminhos: string[]) => ({ data: [], error: null as unknown })),
    createSignedUrls: vi.fn(async (caminhos: string[], _validadeS?: number) => ({
      data: caminhos.map((p) => ({ path: p, signedUrl: `https://assinada.test/${p}?token=x`, error: null })),
      error: null,
    })),
  };

  const cliente = {
    from: vi.fn((tabela: string) => construtor(tabela)),
    rpc: vi.fn(async (nome: string, params: Record<string, unknown>) => {
      const r = cfg.rpc?.[nome];
      if (!r) return { data: null, error: { code: "PGRST202", message: `função ${nome} não configurada no teste` } };
      return typeof r === "function" ? r(params) : r;
    }),
    storage: { from: vi.fn(() => balde) },
    functions: { invoke: vi.fn(cfg.invoke ?? (async () => ({ data: { ok: true }, error: null }))) },
    auth: {
      getSession: vi.fn(async () => ({ data: { session: uid ? { user: { id: uid, email: "dono@exemplo.test" } } : null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })),
      signInWithPassword: vi.fn(async () => ({ data: {}, error: null as unknown })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    channel: vi.fn(() => {
      const canal = { on: vi.fn(() => canal), subscribe: vi.fn(() => canal) };
      return canal;
    }),
    removeChannel: vi.fn(async () => "ok"),
  };

  return { cliente: cliente as unknown as ClienteSupabase, falso: cliente, balde, consultas };
}

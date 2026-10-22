/**
 * De onde vêm os dados (sprint S1):
 *   - `VITE_DADOS=supabase` com URL e chave → banco real, com login por usuário/e-mail e senha;
 *   - `VITE_DADOS=memoria` (ou sem banco configurado) → demonstração no navegador, com PIN;
 *   - `?demo=1` na URL → demonstração mesmo no build com banco (fica na aba: sessionStorage); `?demo=0` volta ao banco.
 * Em desenvolvimento, `?dev=1` (capturas e testes) também abre a demonstração.
 * A escolha vale para a aba inteira: trocar de modo recarrega a página.
 */
export type ModoDados = "memoria" | "supabase";

export const CHAVE_DEMO = "ddoctor.demo";

export interface EntradaModo {
  dados?: string;
  url?: string;
  chave?: string;
  /** Demonstração pedida (?demo=1 nesta aba). */
  demo?: boolean;
}

export function escolherModo(e: EntradaModo): ModoDados {
  if (e.demo) return "memoria";
  return e.dados === "supabase" && e.url && e.chave ? "supabase" : "memoria";
}

/** O build tem banco configurado? (decide se a demonstração mostra "Entrar com login".) */
export function temBanco(e: Omit<EntradaModo, "demo">): boolean {
  return escolherModo({ ...e, demo: false }) === "supabase";
}

type Armazenamento = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Lê o pedido de demonstração: `?demo=1` liga e guarda; `?demo=0` desliga e apaga; sem parâmetro vale o guardado.
 * `dev` = `?dev=1` em desenvolvimento (liga também).
 */
export function lerPedidoDemo(busca: string, armazenamento: Armazenamento | null, dev = false): boolean {
  const p = new URLSearchParams(busca);
  const pedido = p.get("demo");
  try {
    if (pedido === "1" || dev) armazenamento?.setItem(CHAVE_DEMO, "1");
    else if (pedido === "0") armazenamento?.removeItem(CHAVE_DEMO);
    return armazenamento?.getItem(CHAVE_DEMO) === "1" || pedido === "1" || dev;
  } catch {
    return pedido === "1" || dev;
  }
}

function sessao(): Armazenamento | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

function entradaDoBuild(): Omit<EntradaModo, "demo"> {
  return {
    dados: import.meta.env.VITE_DADOS as string | undefined,
    url: (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim(),
    chave: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim(),
  };
}

let modo: ModoDados | null = null;

/** Modo desta aba (calculado uma vez, no carregamento). */
export function modoDados(): ModoDados {
  if (modo) return modo;
  const busca = typeof window === "undefined" ? "" : window.location.search;
  const dev = Boolean(import.meta.env.DEV) && new URLSearchParams(busca).get("dev") === "1";
  modo = escolherModo({ ...entradaDoBuild(), demo: lerPedidoDemo(busca, sessao(), dev) });
  return modo;
}

/** Este build tem banco? (na demonstração, mostra o caminho de volta para o login). */
export function buildTemBanco(): boolean {
  return temBanco(entradaDoBuild());
}

/** Endereço do painel com ?demo=1 ou ?demo=0 (mesma página, rota inicial). */
export function enderecoModo(demo: boolean): string {
  const base = typeof window === "undefined" ? "/" : `${window.location.origin}${window.location.pathname}`;
  return `${base}?demo=${demo ? "1" : "0"}`;
}

/** Sai da demonstração desta aba (o próximo carregamento volta ao banco, se houver). */
export function esquecerDemo() {
  try {
    sessao()?.removeItem(CHAVE_DEMO);
  } catch {
    /* sem armazenamento: nada guardado */
  }
}

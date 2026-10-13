import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Perfil } from "@compartilhado/tipos";
import { usePerfis } from "./hooks";

/**
 * Quem está usando o painel. Na demonstração, um seletor "Ver como" troca o papel para o dono
 * conferir o que cada pessoa vê. No S1 isso vem do login (Supabase Auth) e o seletor some.
 */
const CHAVE = "ddoctor.perfil";

interface Sessao {
  perfil: Perfil;
  perfis: Perfil[];
  trocarPerfil: (id: string) => void;
}

const Contexto = createContext<Sessao | null>(null);

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const consulta = usePerfis();
  const [perfilId, setPerfilId] = useState<string>(() => lerChave() ?? "p-dono");

  const valor = useMemo<Sessao | null>(() => {
    const perfis = consulta.data ?? [];
    const perfil = perfis.find((p) => p.id === perfilId) ?? perfis.find((p) => p.papel === "dono");
    if (!perfil) return null;
    return {
      perfil,
      perfis,
      trocarPerfil: (id: string) => {
        setPerfilId(id);
        gravarChave(id);
      },
    };
  }, [consulta.data, perfilId]);

  if (!valor) return null;
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao(): Sessao {
  const s = useContext(Contexto);
  if (!s) throw new Error("useSessao fora do ProvedorSessao");
  return s;
}

function lerChave(): string | null {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}
function gravarChave(id: string) {
  try {
    localStorage.setItem(CHAVE, id);
  } catch {
    /* navegador sem armazenamento: segue só na memória */
  }
}

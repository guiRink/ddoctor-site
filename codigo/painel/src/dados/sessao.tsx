import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Perfil } from "@compartilhado/tipos";
import { usePerfis, useTempoReal } from "./hooks";
import { buildTemBanco, enderecoModo, esquecerDemo, modoDados, type ModoDados } from "./modo";
import { useAutenticacao, useMeuAcesso, useSair } from "./autenticacao";
import { Botao, Erro, Esqueleto } from "../componentes/ui/Basicos";
import { SemAcesso } from "../componentes/Login";
import { sairDaSessao } from "../componentes/PinGate";

/**
 * Quem está usando o painel.
 *   - Banco real (Supabase): o perfil do usuário logado (perfil.auth_user_id = auth.uid()); "Ver como" não existe.
 *   - Demonstração: um seletor "Ver como" troca o papel para o dono conferir o que cada pessoa vê.
 */
const CHAVE = "ddoctor.perfil";

interface Sessao {
  perfil: Perfil;
  perfis: Perfil[];
  trocarPerfil: (id: string) => void;
  /** "Ver como" (só na demonstração). */
  podeVerComo: boolean;
  modo: ModoDados;
  /** Na demonstração: o build tem banco (mostra "Entrar com login"). */
  temBanco: boolean;
  /** E-mail do login (banco real). */
  email?: string;
  sair: () => void;
  saindo: boolean;
}

const Contexto = createContext<Sessao | null>(null);

export function ProvedorSessao({ children }: { children: ReactNode }) {
  return modoDados() === "supabase" ? <ProvedorBanco>{children}</ProvedorBanco> : <ProvedorDemo>{children}</ProvedorDemo>;
}

function TelaEspera({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh grid place-items-center p-6 bg-papel">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

function ProvedorDemo({ children }: { children: ReactNode }) {
  const consulta = usePerfis();
  const [perfilId, setPerfilId] = useState<string>(() => lerChave() ?? "p-dono");

  const valor = useMemo<Sessao | null>(() => {
    const perfis = consulta.data ?? [];
    const perfil = perfis.find((p) => p.id === perfilId) ?? perfis.find((p) => p.papel === "dono");
    if (!perfil) return null;
    const temBanco = buildTemBanco();
    return {
      perfil,
      perfis,
      trocarPerfil: (id: string) => {
        setPerfilId(id);
        gravarChave(id);
      },
      podeVerComo: true,
      modo: "memoria",
      temBanco,
      sair: () => {
        sairDaSessao();
        // build com banco: sair da demonstração volta para o login de verdade
        if (temBanco) {
          esquecerDemo();
          window.location.replace(enderecoModo(false));
        } else window.location.reload();
      },
      saindo: false,
    };
  }, [consulta.data, perfilId]);

  if (!valor) {
    // carregando ou falhou: nunca deixar a tela em branco
    return <TelaEspera>{consulta.isError ? <Erro mensagem="Não consegui abrir o painel." onTentar={() => consulta.refetch()} /> : <Esqueleto linhas={3} />}</TelaEspera>;
  }
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** Banco real: o portão (Login) já garantiu um usuário logado; aqui descobre o perfil dele. */
function ProvedorBanco({ children }: { children: ReactNode }) {
  const auth = useAutenticacao();
  const usuarioId = auth.carregando ? undefined : auth.usuarioId;
  const email = auth.carregando ? undefined : auth.email;
  const acesso = useMeuAcesso(usuarioId);
  const liberado = acesso.data?.estado === "ok";
  const perfis = usePerfis(liberado);
  const sairMut = useSair();
  const qc = useQueryClient();
  useTempoReal(liberado);

  const sair = () =>
    sairMut.mutate(undefined, {
      onSettled: () => qc.clear(),
    });

  const perfil = acesso.data?.estado === "ok" ? perfis.data?.find((p) => p.id === (acesso.data as { perfilId: string }).perfilId) : undefined;
  const valor: Sessao | null =
    perfil && perfis.data
      ? { perfil, perfis: perfis.data, trocarPerfil: () => {}, podeVerComo: false, modo: "supabase", temBanco: true, email, sair, saindo: sairMut.isPending }
      : null;

  // falha de leitura: tentar de novo ou sair (sem sair, um banco fora do ar prenderia a pessoa nesta tela)
  const sairDaqui = (
    <Botao variante="fantasma" tamanho="denso" icone="sair" className="mt-3" onClick={sair} disabled={sairMut.isPending}>
      Sair
    </Botao>
  );
  if (acesso.isError)
    return (
      <TelaEspera>
        <Erro mensagem="Não consegui conferir o seu acesso." onTentar={() => acesso.refetch()} />
        {sairDaqui}
      </TelaEspera>
    );
  if (acesso.data && acesso.data.estado !== "ok") return <SemAcesso acesso={acesso.data} email={email} onSair={sair} saindo={sairMut.isPending} />;
  if (perfis.isError)
    return (
      <TelaEspera>
        <Erro mensagem="Não consegui abrir o painel." onTentar={() => perfis.refetch()} />
        {sairDaqui}
      </TelaEspera>
    );
  // perfil ativo que a vw_equipe não devolveu (não deveria acontecer): trata como sem acesso
  if (perfis.data && !valor) return <SemAcesso acesso={{ estado: "sem_perfil" }} email={email} onSair={sair} saindo={sairMut.isPending} />;
  if (!valor)
    return (
      <TelaEspera>
        <Esqueleto linhas={3} />
      </TelaEspera>
    );
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

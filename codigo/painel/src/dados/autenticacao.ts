import { useMutation, useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import type { Id } from "@compartilhado/tipos";
import { emailParaEntrar } from "@compartilhado/dominio/equipe";
import { codigoDoErro } from "./mapeamento";
import { clienteSupabase, type ClienteSupabase } from "./supabase";
import type { Resultado } from "./repositorio";

/**
 * Login real (sprint S1, modo Supabase): usuário ("diego" → e-mail técnico) ou e-mail, e senha. A sessão fica
 * guardada pelo supabase-js (localStorage `ddoctor.auth`) e renova sozinha. Telas e componentes usam só os hooks
 * daqui (useAutenticacao, useEntrar, useSair, useMeuAcesso); nada de supabase-js fora de src/dados.
 */

export type EstadoAuth = { carregando: true } | { carregando: false; usuarioId?: Id; email?: string };

let estado: EstadoAuth = { carregando: true };
const ouvintes = new Set<() => void>();
let iniciado = false;
let aoTrocarUsuario: (() => void) | null = null;

/** Chamado quando o usuário logado muda (saiu, ou entrou outro): o main limpa o cache das consultas. */
export function definirAoTrocarUsuario(fn: () => void) {
  aoTrocarUsuario = fn;
}

function iniciar(sb: ClienteSupabase = clienteSupabase()) {
  if (iniciado) return;
  iniciado = true;
  sb.auth.onAuthStateChange((_evento, sessao) => {
    const antes = estado.carregando ? undefined : estado.usuarioId;
    const usuarioId = sessao?.user.id;
    estado = { carregando: false, usuarioId, email: sessao?.user.email };
    if (antes !== usuarioId && antes !== undefined) aoTrocarUsuario?.();
    ouvintes.forEach((f) => f());
  });
}

function assinar(f: () => void) {
  iniciar();
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

/** Sessão atual: carregando (lendo o armazenamento), sem usuário (mostra o login) ou com usuário. */
export function useAutenticacao(): EstadoAuth {
  return useSyncExternalStore(
    assinar,
    () => estado,
    () => estado,
  );
}

/** Erro do Supabase Auth → código de ERRO (rotulos.ts). */
export function codigoDoLogin(erro: { code?: string; status?: number; message?: string; name?: string } | null | undefined): string {
  if (!erro) return "erro_desconhecido";
  const msg = erro.message ?? "";
  if (erro.code === "invalid_credentials" || /invalid login credentials/i.test(msg)) return "login_invalido";
  if (erro.code === "user_banned" || erro.code === "email_not_confirmed" || /banned|not confirmed/i.test(msg)) return "login_bloqueado";
  if (erro.status === 429 || erro.code === "over_request_rate_limit" || /rate limit|too many/i.test(msg)) return "muitas_tentativas";
  if (erro.name === "AuthRetryableFetchError" || /failed to fetch|networkerror|load failed|fetch failed/i.test(msg)) return "sem_conexao";
  return "erro_desconhecido";
}

/** Entra com usuário ou e-mail e senha. Falha traz o código e o campo a marcar. */
export async function entrar(texto: string, senha: string, sb: ClienteSupabase = clienteSupabase()): Promise<Resultado> {
  const email = emailParaEntrar(texto);
  if (!email) return { ok: false, codigo: "usuario_ou_email_invalido", campo: "usuario" };
  if (!senha) return { ok: false, codigo: "senha_obrigatoria", campo: "senha" };
  try {
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) return { ok: false, codigo: codigoDoLogin(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, codigo: codigoDoLogin(e as Error) === "erro_desconhecido" ? "sem_conexao" : codigoDoLogin(e as Error) };
  }
}

/** Sai só deste aparelho (a TV e outros aparelhos com o mesmo login continuam). */
export async function sair(sb: ClienteSupabase = clienteSupabase()): Promise<void> {
  await sb.auth.signOut({ scope: "local" });
}

/**
 * A oficina já tem dono com login? (RPC `oficina_tem_dono`, que o anon pode chamar.) Abre sozinho o passo a passo de
 * "Primeiro acesso da oficina" no login quando não tem. `null` = não deu para saber (sem rede, banco antigo): a
 * tela deixa o passo a passo recolhido.
 */
export async function oficinaTemDono(sb?: ClienteSupabase): Promise<boolean | null> {
  try {
    const { data, error } = await (sb ?? clienteSupabase()).rpc("oficina_tem_dono");
    if (error || typeof data !== "boolean") return null;
    return data;
  } catch {
    return null;
  }
}

export const useOficinaTemDono = () =>
  useQuery({ queryKey: ["auth", "oficina_tem_dono"], queryFn: () => oficinaTemDono(), staleTime: 5 * 60_000, retry: false });

export const useEntrar = () => useMutation({ mutationFn: ({ texto, senha }: { texto: string; senha: string }) => entrar(texto, senha) });
export const useSair = () => useMutation({ mutationFn: () => sair() });

/**
 * O login está ligado a alguém da equipe ativo? `sem_perfil`: o usuário existe no Auth mas não está em nenhum perfil
 * (primeiro acesso antes de definir_primeiro_dono, ou login apagado); `inativo`: desligado ou login desativado.
 */
export type Acesso = { estado: "ok"; perfilId: Id } | { estado: "sem_perfil" } | { estado: "inativo"; nome: string };

export async function meuAcesso(usuarioId: Id, sb: ClienteSupabase = clienteSupabase()): Promise<Acesso> {
  const { data, error } = await sb.from("perfil").select("id, nome, ativo, login_desativado_em").eq("auth_user_id", usuarioId).maybeSingle();
  if (error) throw new Error(codigoDoErro(error));
  const p = data as { id: Id; nome: string; ativo: boolean; login_desativado_em: string | null } | null;
  if (!p) return { estado: "sem_perfil" };
  if (!p.ativo || p.login_desativado_em) return { estado: "inativo", nome: p.nome };
  return { estado: "ok", perfilId: p.id };
}

export const useMeuAcesso = (usuarioId: Id | undefined) =>
  useQuery({ queryKey: ["auth", "acesso", usuarioId], queryFn: () => meuAcesso(usuarioId!), enabled: Boolean(usuarioId), staleTime: 60_000 });

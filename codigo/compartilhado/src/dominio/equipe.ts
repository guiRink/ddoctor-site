// Equipe (sprint S1): login curto do funcionário, validação do cadastro e guarda do último dono. Funções puras.
//
// Login sem e-mail real: o Supabase Auth exige e-mail. O dono cria só `usuario` + senha ("diego" / "••••") e o
// painel entra com o e-mail técnico `emailDeLogin("diego")` = "diego@equipe.ddoctor.app". O domínio
// DOMINIO_LOGIN não recebe mensagens: nada de "esqueci a senha" por e-mail para esses logins — quem troca a
// senha é o dono (Edge Function com service_role, nunca no front). Quem tem e-mail real pode entrar com ele
// (emailParaEntrar aceita os dois).
import { PAPEIS, type Centavos, type DataISO, type Id, type Papel, type Perfil } from "../tipos";
import { dataISOValida } from "./fuso";

/** Domínio técnico dos logins por usuário (sem caixa postal). */
export const DOMINIO_LOGIN = "equipe.ddoctor.app";

export const LIMITES_USUARIO = { min: 3, max: 30 } as const;

/** Sugestões para o campo "Função" (texto livre; não muda permissão). Do pedido do S1. */
export const FUNCOES_SUGERIDAS = ["Funileiro", "Pintor", "Recepção", "Gerente", "Financeiro", "Dono"] as const;

const semAcento = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "");

/**
 * "  Diégo Souza " → "diegosouza": minúsculas, sem acento, sem espaço. NÃO corta nem remove outros caracteres:
 * quem decide se vale é validarUsuario (não truncar antes de validar).
 */
export function normalizarUsuario(texto: string): string {
  return semAcento(texto ?? "").toLowerCase().replace(/\s+/g, "");
}

export type CodigoUsuario = "usuario_obrigatorio" | "usuario_curto" | "usuario_longo" | "usuario_invalido" | "usuario_em_uso";

/** Começa e termina com letra ou dígito; no meio, [a-z0-9._-]; sem ".." (vira parte local de e-mail). */
const USUARIO = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;

/**
 * Valida o login curto depois de normalizar: 3–30 caracteres de [a-z0-9._-], começa e termina com letra ou
 * dígito, sem "..", e único na oficina (comparado já normalizado; o próprio perfil `proprioId` não conta).
 */
export function validarUsuario(
  texto: string,
  existentes: ReadonlyArray<Pick<Perfil, "id" | "usuario">> = [],
  proprioId?: Id,
): { ok: true; usuario: string } | { ok: false; codigo: CodigoUsuario } {
  const usuario = normalizarUsuario(texto);
  if (!usuario) return { ok: false, codigo: "usuario_obrigatorio" };
  if (usuario.length < LIMITES_USUARIO.min) return { ok: false, codigo: "usuario_curto" };
  if (usuario.length > LIMITES_USUARIO.max) return { ok: false, codigo: "usuario_longo" };
  if (!USUARIO.test(usuario) || usuario.includes("..")) return { ok: false, codigo: "usuario_invalido" };
  const emUso = existentes.some((p) => p.id !== proprioId && p.usuario && normalizarUsuario(p.usuario) === usuario);
  if (emUso) return { ok: false, codigo: "usuario_em_uso" };
  return { ok: true, usuario };
}

/** "diego" → "diego@equipe.ddoctor.app". Lança `usuario_invalido` se o usuário não passa em validarUsuario. */
export function emailDeLogin(usuario: string): string {
  const r = validarUsuario(usuario);
  if (!r.ok) throw new Error(`usuario_invalido: ${usuario}`);
  return `${r.usuario}@${DOMINIO_LOGIN}`;
}

/** "diego@equipe.ddoctor.app" → "diego"; e-mail de outro domínio → null. */
export function usuarioDeEmail(email: string): string | null {
  const e = (email ?? "").trim().toLowerCase();
  const sufixo = `@${DOMINIO_LOGIN}`;
  if (!e.endsWith(sufixo)) return null;
  const u = e.slice(0, -sufixo.length);
  return validarUsuario(u).ok ? u : null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailValido(texto: string): boolean {
  return EMAIL.test((texto ?? "").trim());
}

/**
 * Tela de login: aceita "diego" (vira e-mail técnico) ou um e-mail real. Devolve o e-mail para o Supabase Auth,
 * ou null se o texto não serve para nenhum dos dois.
 */
export function emailParaEntrar(texto: string): string | null {
  const t = (texto ?? "").trim();
  if (t.includes("@")) return emailValido(t) ? t.toLowerCase() : null;
  const r = validarUsuario(t);
  return r.ok ? `${r.usuario}@${DOMINIO_LOGIN}` : null;
}

/**
 * Sugere um login livre a partir do nome: "Diego Souza" → "diego"; em uso → "diego.souza"; em uso → "diego2"…
 * Caracteres fora de [a-z0-9._-] somem só na SUGESTÃO (o que a pessoa digitar é validado sem corte).
 */
export function sugerirUsuario(nome: string, existentes: ReadonlyArray<Pick<Perfil, "id" | "usuario">> = []): string | null {
  const partes = semAcento(nome ?? "")
    .toLowerCase()
    .split(/\s+/)
    .map((p) => p.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);
  if (!partes.length) return null;
  const base = partes[0].slice(0, LIMITES_USUARIO.max);
  const candidatos = [base];
  if (partes.length > 1) candidatos.push(`${base}.${partes[partes.length - 1]}`.slice(0, LIMITES_USUARIO.max));
  for (const c of candidatos) if (validarUsuario(c, existentes).ok) return c;
  for (let n = 2; n < 1000; n++) {
    const c = `${base.slice(0, LIMITES_USUARIO.max - String(n).length)}${n}`;
    if (validarUsuario(c, existentes).ok) return c;
  }
  return null;
}

// ---------------------------------------------------------------- cadastro do funcionário

export interface FuncionarioEntrada {
  id?: Id;
  nome: string;
  papel: Papel;
  funcao?: string;
  usuario?: string;
  email?: string;
  telefone?: string;
  salarioMensal?: Centavos;
  admitidoEm?: DataISO;
  ativo?: boolean;
  usaTerminal?: boolean;
}

export type CodigoFuncionario =
  | "nome_obrigatorio"
  | "papel_invalido"
  | "email_invalido"
  | "telefone_invalido"
  | "salario_invalido"
  | "data_invalida"
  | CodigoUsuario;

/** Dados aparados e normalizados, prontos para o repositório (sem `id`, `temLogin` nem campos de Auth). */
export type FuncionarioValido = Omit<FuncionarioEntrada, "ativo" | "usaTerminal"> & { ativo: boolean; usaTerminal: boolean };

/** Teto de sanidade do salário mensal: R$ 1.000.000,00 (erro de digitação, não regra da oficina). */
export const SALARIO_MAXIMO: Centavos = 100_000_000;

/**
 * Valida o cadastro/edição do funcionário. Nome obrigatório; papel de PAPEIS; usuário (se vier) por validarUsuario;
 * e-mail com "@" e domínio; telefone E.164 brasileiro (+55 e 10–11 dígitos); salário inteiro em centavos de 0 a
 * SALARIO_MAXIMO; admissão AAAA-MM-DD existente. Falha traz o `campo`.
 */
export function validarFuncionario(
  entrada: FuncionarioEntrada,
  existentes: ReadonlyArray<Pick<Perfil, "id" | "usuario">> = [],
): { ok: true; funcionario: FuncionarioValido } | { ok: false; codigo: CodigoFuncionario; campo: string } {
  const nome = (entrada.nome ?? "").replace(/\s+/g, " ").trim();
  if (!nome) return { ok: false, codigo: "nome_obrigatorio", campo: "nome" };
  if (!(PAPEIS as readonly string[]).includes(entrada.papel)) return { ok: false, codigo: "papel_invalido", campo: "papel" };
  const f: FuncionarioValido = {
    ...(entrada.id ? { id: entrada.id } : {}),
    nome,
    papel: entrada.papel,
    ativo: entrada.ativo ?? true,
    usaTerminal: entrada.usaTerminal ?? false,
  };
  const funcao = entrada.funcao?.replace(/\s+/g, " ").trim();
  if (funcao) f.funcao = funcao;
  if (entrada.usuario !== undefined && entrada.usuario.trim() !== "") {
    const u = validarUsuario(entrada.usuario, existentes, entrada.id);
    if (!u.ok) return { ok: false, codigo: u.codigo, campo: "usuario" };
    f.usuario = u.usuario;
  }
  const email = entrada.email?.trim();
  if (email) {
    if (!emailValido(email)) return { ok: false, codigo: "email_invalido", campo: "email" };
    f.email = email.toLowerCase();
  }
  const tel = entrada.telefone?.trim();
  if (tel) {
    if (!/^\+55\d{10,11}$/.test(tel)) return { ok: false, codigo: "telefone_invalido", campo: "telefone" };
    f.telefone = tel;
  }
  if (entrada.salarioMensal !== undefined) {
    const s = entrada.salarioMensal;
    if (!Number.isInteger(s) || s < 0 || s > SALARIO_MAXIMO) return { ok: false, codigo: "salario_invalido", campo: "salarioMensal" };
    f.salarioMensal = s;
  }
  if (entrada.admitidoEm !== undefined && entrada.admitidoEm !== "") {
    if (!dataISOValida(entrada.admitidoEm)) return { ok: false, codigo: "data_invalida", campo: "admitidoEm" };
    f.admitidoEm = entrada.admitidoEm;
  }
  return { ok: true, funcionario: f };
}

/**
 * A oficina nunca fica sem dono ativo: trocar o papel do único dono ativo ou desativá-lo devolve `ultimo_dono`.
 * (Quem PODE trocar papel é regra de permissão: podeEditarPapel, só o dono.)
 */
export function validarMudancaPapel(
  perfilId: Id,
  mudanca: { papel?: Papel; ativo?: boolean },
  perfis: ReadonlyArray<Pick<Perfil, "id" | "papel" | "ativo">>,
): { ok: true } | { ok: false; codigo: "ultimo_dono" | "perfil_inexistente" | "papel_invalido" } {
  const alvo = perfis.find((p) => p.id === perfilId);
  if (!alvo) return { ok: false, codigo: "perfil_inexistente" };
  if (mudanca.papel !== undefined && !(PAPEIS as readonly string[]).includes(mudanca.papel)) return { ok: false, codigo: "papel_invalido" };
  const continuaDono = (mudanca.papel ?? alvo.papel) === "dono" && (mudanca.ativo ?? alvo.ativo);
  const eraDonoAtivo = alvo.papel === "dono" && alvo.ativo;
  if (eraDonoAtivo && !continuaDono) {
    const outros = perfis.filter((p) => p.id !== perfilId && p.papel === "dono" && p.ativo).length;
    if (outros === 0) return { ok: false, codigo: "ultimo_dono" };
  }
  return { ok: true };
}

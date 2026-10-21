import { describe, expect, it } from "vitest";
import type { Perfil } from "../tipos";
import {
  DOMINIO_LOGIN,
  emailDeLogin,
  emailParaEntrar,
  normalizarUsuario,
  sugerirUsuario,
  usuarioDeEmail,
  validarFuncionario,
  validarMudancaPapel,
  validarUsuario,
} from "./equipe";

const perfil = (id: string, papel: Perfil["papel"], extra: Partial<Perfil> = {}): Perfil => ({
  id,
  nome: id,
  papel,
  ativo: true,
  usaTerminal: false,
  ...extra,
});

describe("normalizarUsuario", () => {
  it("minúsculas, sem acento e sem espaço", () => {
    expect(normalizarUsuario("  Diégo Souza ")).toBe("diegosouza");
    expect(normalizarUsuario("JOÃO.Paulo")).toBe("joao.paulo");
  });
  it("não corta o texto longo nem remove caracteres inválidos (quem decide é validarUsuario)", () => {
    expect(normalizarUsuario("a".repeat(40))).toHaveLength(40);
    expect(normalizarUsuario("diego!")).toBe("diego!");
  });
});

describe("validarUsuario", () => {
  it("aceita 3–30 caracteres de [a-z0-9._-]", () => {
    expect(validarUsuario("Diego")).toEqual({ ok: true, usuario: "diego" });
    expect(validarUsuario("ana.paula_2")).toEqual({ ok: true, usuario: "ana.paula_2" });
    expect(validarUsuario("abc").ok).toBe(true);
    expect(validarUsuario("a".repeat(30)).ok).toBe(true);
  });
  it("bordas de tamanho: vazio, 2 e 31 caracteres", () => {
    expect(validarUsuario("   ")).toEqual({ ok: false, codigo: "usuario_obrigatorio" });
    expect(validarUsuario("ab")).toEqual({ ok: false, codigo: "usuario_curto" });
    expect(validarUsuario("a".repeat(31))).toEqual({ ok: false, codigo: "usuario_longo" });
  });
  it("recusa caractere fora do padrão, ponta com pontuação e '..'", () => {
    expect(validarUsuario("diego!")).toEqual({ ok: false, codigo: "usuario_invalido" });
    expect(validarUsuario("diego@x")).toEqual({ ok: false, codigo: "usuario_invalido" });
    expect(validarUsuario(".diego")).toEqual({ ok: false, codigo: "usuario_invalido" });
    expect(validarUsuario("diego-")).toEqual({ ok: false, codigo: "usuario_invalido" });
    expect(validarUsuario("di..ego")).toEqual({ ok: false, codigo: "usuario_invalido" });
  });
  it("único na oficina (normalizado), mas o próprio perfil não conta", () => {
    const existentes = [{ id: "p1", usuario: "diego" }];
    expect(validarUsuario("DIÉGO", existentes)).toEqual({ ok: false, codigo: "usuario_em_uso" });
    expect(validarUsuario("diego", existentes, "p1").ok).toBe(true);
  });
});

describe("emailDeLogin e emailParaEntrar", () => {
  it("usuário vira o e-mail técnico do Supabase Auth", () => {
    expect(DOMINIO_LOGIN).toBe("equipe.ddoctor.app");
    expect(emailDeLogin("Diego")).toBe("diego@equipe.ddoctor.app");
    expect(() => emailDeLogin("di")).toThrow("usuario_invalido");
  });
  it("a tela de login aceita usuário ou e-mail real", () => {
    expect(emailParaEntrar(" diego ")).toBe("diego@equipe.ddoctor.app");
    expect(emailParaEntrar("Dono@Exemplo.com")).toBe("dono@exemplo.com");
    expect(emailParaEntrar("dono@")).toBeNull();
    expect(emailParaEntrar("x")).toBeNull();
  });
  it("usuarioDeEmail desfaz o e-mail técnico; outro domínio não", () => {
    expect(usuarioDeEmail("diego@equipe.ddoctor.app")).toBe("diego");
    expect(usuarioDeEmail("diego@gmail.com")).toBeNull();
  });
});

describe("sugerirUsuario", () => {
  it("primeiro nome; em uso → nome.sobrenome; em uso → número", () => {
    expect(sugerirUsuario("Diego Souza")).toBe("diego");
    expect(sugerirUsuario("Diego Souza", [{ id: "a", usuario: "diego" }])).toBe("diego.souza");
    expect(sugerirUsuario("Diego Souza", [{ id: "a", usuario: "diego" }, { id: "b", usuario: "diego.souza" }])).toBe("diego2");
  });
  it("nome curto ou vazio", () => {
    expect(sugerirUsuario("Jô")).toBe("jo2");
    expect(sugerirUsuario("   ")).toBeNull();
  });
});

describe("validarFuncionario", () => {
  it("apara e normaliza; ativo por padrão", () => {
    const r = validarFuncionario({ nome: "  Diego   Souza ", papel: "producao", funcao: " Pintor ", usuario: "Diego", salarioMensal: 250000, admitidoEm: "2026-10-01" });
    expect(r).toEqual({
      ok: true,
      funcionario: { nome: "Diego Souza", papel: "producao", funcao: "Pintor", usuario: "diego", salarioMensal: 250000, admitidoEm: "2026-10-01", ativo: true, usaTerminal: false },
    });
  });
  it("cada campo inválido devolve código e campo", () => {
    expect(validarFuncionario({ nome: " ", papel: "producao" })).toMatchObject({ ok: false, codigo: "nome_obrigatorio", campo: "nome" });
    expect(validarFuncionario({ nome: "A", papel: "chefe" as never })).toMatchObject({ codigo: "papel_invalido" });
    expect(validarFuncionario({ nome: "A", papel: "producao", email: "a@b" })).toMatchObject({ codigo: "email_invalido" });
    expect(validarFuncionario({ nome: "A", papel: "producao", telefone: "41999990000" })).toMatchObject({ codigo: "telefone_invalido" });
    expect(validarFuncionario({ nome: "A", papel: "producao", salarioMensal: -1 })).toMatchObject({ codigo: "salario_invalido" });
    expect(validarFuncionario({ nome: "A", papel: "producao", salarioMensal: 1500.5 })).toMatchObject({ codigo: "salario_invalido" });
    expect(validarFuncionario({ nome: "A", papel: "producao", admitidoEm: "2026-02-30" })).toMatchObject({ codigo: "data_invalida" });
    expect(validarFuncionario({ nome: "A", papel: "producao", usuario: "ab" })).toMatchObject({ codigo: "usuario_curto", campo: "usuario" });
  });
  it("salário zero vale (só comissão); telefone E.164 brasileiro", () => {
    expect(validarFuncionario({ nome: "A", papel: "producao", salarioMensal: 0, telefone: "+5541999990000" }).ok).toBe(true);
  });
});

describe("validarMudancaPapel", () => {
  const perfis = [perfil("dono", "dono"), perfil("g", "gestor")];
  it("não deixa a oficina sem dono ativo", () => {
    expect(validarMudancaPapel("dono", { papel: "gestor" }, perfis)).toEqual({ ok: false, codigo: "ultimo_dono" });
    expect(validarMudancaPapel("dono", { ativo: false }, perfis)).toEqual({ ok: false, codigo: "ultimo_dono" });
  });
  it("com outro dono ativo, pode", () => {
    const dois = [...perfis, perfil("dono2", "dono")];
    expect(validarMudancaPapel("dono", { papel: "gestor" }, dois)).toEqual({ ok: true });
  });
  it("dono inativo não conta como o outro dono", () => {
    const comInativo = [...perfis, perfil("velho", "dono", { ativo: false })];
    expect(validarMudancaPapel("dono", { papel: "gestor" }, comInativo)).toEqual({ ok: false, codigo: "ultimo_dono" });
  });
  it("promover gerente a dono e trocar papel de outro sempre pode", () => {
    expect(validarMudancaPapel("g", { papel: "dono" }, perfis)).toEqual({ ok: true });
    expect(validarMudancaPapel("g", { papel: "financeiro" }, perfis)).toEqual({ ok: true });
    expect(validarMudancaPapel("x", { papel: "dono" }, perfis)).toEqual({ ok: false, codigo: "perfil_inexistente" });
  });
});

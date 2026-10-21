import { describe, expect, it } from "vitest";
import { PAPEIS, type Papel } from "@compartilhado/tipos";
import {
  acesso,
  MODULOS_FINANCEIROS,
  modulosDoMenu,
  podeEditar,
  podeEditarComissoes,
  podeEditarConfig,
  podeEditarPapel,
  podeEditarSalario,
  podeEditarPerfilDe,
  podeGerenciarEquipe,
  podePagarFolha,
  podeRemoverFoto,
  podeVer,
  podeVerFolha,
  telaInicial,
  veCustosOS,
  veDadosSensiveis,
  veFinanceiro,
  vePagamentosOS,
  type Modulo,
} from "./permissoes";

const quem = (f: (p: Papel) => boolean) => PAPEIS.filter(f);

describe("matriz final (S1)", () => {
  it("gerente vê quase tudo menos o financeiro", () => {
    for (const m of MODULOS_FINANCEIROS) expect(podeVer("gestor", m)).toBe(false);
    for (const m of ["geral", "orcamentos", "clientes", "agenda", "vistorias", "producao", "minhas_tarefas", "tv", "equipe", "estoque", "ajustes"] as Modulo[])
      expect(podeVer("gestor", m)).toBe(true);
    expect(veFinanceiro("gestor")).toBe(false);
    expect(veCustosOS("gestor")).toBe(false);
    expect(podeVerFolha("gestor")).toBe(false);
  });

  it("A receber, Financeiro (caixa) e Relatórios: só dono e financeiro", () => {
    expect(quem((p) => podeVer(p, "recebiveis"))).toEqual(["dono", "financeiro"]);
    expect(quem((p) => podeVer(p, "financeiro"))).toEqual(["dono", "financeiro"]);
    expect(quem((p) => podeVer(p, "relatorios"))).toEqual(["dono", "financeiro"]);
    expect(quem((p) => podeEditar(p, "recebiveis"))).toEqual(["dono", "financeiro"]);
    expect(acesso("financeiro", "relatorios")).toBe("ler");
  });

  it("custos, resultado e margem da OS e dinheiro do Geral: dono e financeiro", () => {
    expect(quem(veCustosOS)).toEqual(["dono", "financeiro"]);
    expect(quem(veFinanceiro)).toEqual(["dono", "financeiro"]);
  });

  it("pagamentos da OS: dono, financeiro e a recepção que cobra no balcão; o gerente não", () => {
    expect(quem(vePagamentosOS)).toEqual(["dono", "recepcao", "financeiro"]);
  });

  it("dono vê todos os módulos", () => {
    const todos: Modulo[] = ["geral", "orcamentos", "clientes", "agenda", "vistorias", "producao", "minhas_tarefas", "tv", "equipe", "folha", "estoque", "recebiveis", "financeiro", "relatorios", "ajustes"];
    for (const m of todos) expect(podeVer("dono", m)).toBe(true);
  });

  it("Equipe: dono e gerente veem e gerenciam; só o dono troca papel/login, salário e comissões", () => {
    expect(quem((p) => podeVer(p, "equipe"))).toEqual(["dono", "gestor"]);
    expect(quem(podeGerenciarEquipe)).toEqual(["dono", "gestor"]);
    expect(quem(podeEditarPapel)).toEqual(["dono"]);
    expect(quem(podeEditarSalario)).toEqual(["dono"]);
    expect(quem(podeEditarComissoes)).toEqual(["dono"]);
    // o nome antigo do módulo segue igual à Equipe
    for (const p of PAPEIS) expect(acesso(p, "funcionarios")).toBe(acesso(p, "equipe"));
  });

  it("podeEditarPerfilDe: dono edita todos; gerente não mexe em dono, gerente nem financeiro", () => {
    for (const alvo of PAPEIS) expect(podeEditarPerfilDe("dono", alvo)).toBe(true);
    expect(PAPEIS.filter((alvo) => podeEditarPerfilDe("gestor", alvo))).toEqual(["recepcao", "producao", "dispositivo"]);
    for (const quemEdita of ["recepcao", "producao", "financeiro", "dispositivo"] as const)
      for (const alvo of PAPEIS) expect(podeEditarPerfilDe(quemEdita, alvo)).toBe(false);
  });

  it("Folha: dono e financeiro veem e pagam; o resto não", () => {
    expect(quem(podeVerFolha)).toEqual(["dono", "financeiro"]);
    expect(quem(podePagarFolha)).toEqual(["dono", "financeiro"]);
  });

  it("produção e TV nunca veem dinheiro nem a Equipe", () => {
    for (const p of ["producao", "dispositivo"] as Papel[]) {
      expect(veDadosSensiveis(p)).toBe(false);
      expect(veCustosOS(p)).toBe(false);
      expect(podeVer(p, "equipe")).toBe(false);
      expect(podeVerFolha(p)).toBe(false);
    }
  });

  it("recepção perdeu A receber (S1); continua com orçamento e agenda", () => {
    expect(podeVer("recepcao", "recebiveis")).toBe(false);
    expect(podeEditar("recepcao", "orcamentos")).toBe(true);
    expect(podeEditar("recepcao", "agenda")).toBe(true);
  });

  it("Ajustes: dono e gerente (comissões à parte, só o dono)", () => {
    expect(quem(podeEditarConfig)).toEqual(["dono", "gestor"]);
  });
});

describe("menu por papel", () => {
  it("gerente sem A receber e Financeiro", () => {
    expect(modulosDoMenu("gestor")).toEqual(["geral", "orcamentos", "agenda", "producao", "vistorias", "clientes", "equipe", "estoque", "ajustes"]);
  });
  it("dono com tudo; financeiro com folha", () => {
    expect(modulosDoMenu("dono")).toContain("recebiveis");
    expect(modulosDoMenu("dono")).toContain("financeiro");
    expect(modulosDoMenu("financeiro")).toEqual(["geral", "recebiveis", "financeiro", "folha", "clientes", "orcamentos"]);
  });
  it("todo item do menu é um módulo que o papel pode abrir", () => {
    for (const p of PAPEIS) for (const m of modulosDoMenu(p)) expect(podeVer(p, m)).toBe(true);
  });
  it("tela inicial", () => {
    expect(telaInicial("financeiro")).toBe("/recebiveis");
    expect(telaInicial("gestor")).toBe("/geral");
    expect(telaInicial("producao")).toBe("/producao/eu");
  });
});

describe("fotos", () => {
  it("produção remove só a própria; foto da Maxpar ninguém", () => {
    expect(podeRemoverFoto("producao", { autorId: "p1", origem: "interna" }, "p1")).toBe(true);
    expect(podeRemoverFoto("producao", { autorId: "p2", origem: "interna" }, "p1")).toBe(false);
    expect(podeRemoverFoto("dono", { origem: "maxpar" })).toBe(false);
  });
});

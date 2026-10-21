import { beforeEach, describe, expect, it } from "vitest";
import { repositorioMemoria as repo } from "./repositorioMemoria";

// Equipe, login, comissões e folha (sprint S1) no repositório da demonstração.
const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const mesAtual = () => hoje().slice(0, 7);
const comoQuem = (id: string) => localStorage.setItem("ddoctor.perfil", id);

describe("equipe no repositório em memória", () => {
  beforeEach(async () => {
    localStorage.clear();
    comoQuem("p-dono");
    await repo.restaurarDemo();
  });

  it("demo tem gerente, salários e comissões de exemplo", async () => {
    const perfis = await repo.listarPerfis();
    expect(perfis.find((p) => p.papel === "gestor")?.nome).toBeTruthy();
    expect(perfis.filter((p) => p.salarioMensal !== undefined).every((p) => p.salarioMensal! >= 220000 && p.salarioMensal! <= 450000)).toBe(true);
    const regras = await repo.listarRegrasComissao();
    expect(regras.map((r) => r.etapaNome)).toEqual(expect.arrayContaining(["Pintura", "Funilaria"]));
  });

  it("salário só chega a quem vê a folha", async () => {
    comoQuem("p-gerente");
    expect((await repo.listarPerfis()).every((p) => p.salarioMensal === undefined)).toBe(true);
    comoQuem("p-paula");
    expect((await repo.listarPerfis()).some((p) => p.salarioMensal !== undefined)).toBe(true);
  });

  it("cadastra e edita; papel e salário só o dono; nunca sem dono", async () => {
    const r = await repo.salvarFuncionario({ nome: "  Tiago   Funileiro ", papel: "producao", funcao: "Funileiro", telefone: "(41) 98888-7777", salarioMensal: 250000 });
    expect(r.ok).toBe(true);
    const novo = (await repo.listarPerfis()).find((p) => p.id === r.id)!;
    expect(novo).toMatchObject({ nome: "Tiago Funileiro", telefone: "+5541988887777", salarioMensal: 250000, ativo: true });
    expect((await repo.listarAuditoria())[0]).toMatchObject({ acao: "criar", entidade: "perfil", entidadeId: r.id });

    comoQuem("p-gerente");
    // o gerente edita nome e função, mas não troca permissão nem salário
    expect((await repo.salvarFuncionario({ id: r.id, nome: "Tiago", papel: "producao", funcao: "Pintor" })).ok).toBe(true);
    expect((await repo.salvarFuncionario({ id: r.id, nome: "Tiago", papel: "gestor" })).codigo).toBe("sem_permissao");
    expect((await repo.salvarFuncionario({ id: r.id, nome: "Tiago", papel: "producao", salarioMensal: 999900 })).codigo).toBe("sem_permissao");
    comoQuem("p-dono");
    const depois = (await repo.listarPerfis()).find((p) => p.id === r.id)!;
    expect(depois).toMatchObject({ nome: "Tiago", funcao: "Pintor", salarioMensal: 250000 });

    // pintor virou gerente
    expect((await repo.salvarFuncionario({ id: r.id, nome: "Tiago", papel: "gestor", funcao: "Gerente", salarioMensal: 250000 })).ok).toBe(true);
    expect((await repo.listarPerfis()).find((p) => p.id === r.id)?.papel).toBe("gestor");
    // o único dono não deixa de ser dono
    expect((await repo.salvarFuncionario({ id: "p-dono", nome: "Carlos Dantas", papel: "gestor" })).codigo).toBe("ultimo_dono");
    expect((await repo.salvarFuncionario({ nome: "", papel: "producao" })).codigo).toBe("nome_obrigatorio");
    expect((await repo.salvarFuncionario({ nome: "X", papel: "producao", telefone: "123" })).codigo).toBe("telefone_invalido");
  });

  it("login: só o dono dá; usuário único; a senha não fica em lugar nenhum", async () => {
    const r = await repo.definirLogin("p-marcos", { usuario: "Márcos", senha: "abcd-efgh-jk" });
    expect(r).toMatchObject({ ok: true, usuario: "marcos", email: "marcos@equipe.ddoctor.app" });
    const marcos = (await repo.listarPerfis()).find((p) => p.id === "p-marcos")!;
    expect(marcos).toMatchObject({ usuario: "marcos", temLogin: true });
    expect(localStorage.getItem("ddoctor.demo.v3")).not.toContain("abcd-efgh-jk");
    expect(JSON.stringify(await repo.listarAuditoria())).not.toContain("abcd-efgh-jk");
    expect((await repo.definirLogin("p-rafael", { usuario: "diego", senha: "12345678" })).codigo).toBe("usuario_em_uso");
    expect((await repo.definirLogin("p-rafael", { usuario: "rafael", senha: "123" })).codigo).toBe("senha_curta");
    expect((await repo.removerLogin("p-dono")).codigo).toBe("proprio_login");
    expect((await repo.removerLogin("p-marcos")).ok).toBe(true);
    expect((await repo.listarPerfis()).find((p) => p.id === "p-marcos")?.temLogin).toBe(false);
    comoQuem("p-gerente");
    expect((await repo.definirLogin("p-rafael", { usuario: "rafael", senha: "12345678" })).codigo).toBe("sem_permissao");
  });

  it("comissões: só o dono edita; duplicada recusada; auditoria sem valor", async () => {
    const r = await repo.salvarRegraComissao({ etapaNome: "Polimento", valor: 1500 });
    expect(r.ok).toBe(true);
    expect((await repo.salvarRegraComissao({ etapaNome: "polimento", valor: 2000 })).codigo).toBe("regra_duplicada");
    expect((await repo.salvarRegraComissao({ valor: 2000 })).codigo).toBe("alvo_obrigatorio");
    expect((await repo.listarAuditoria())[0].resumo).not.toContain("15,00");
    expect((await repo.removerRegraComissao(r.id!)).ok).toBe(true);
    comoQuem("p-gerente");
    expect((await repo.salvarRegraComissao({ etapaNome: "Montagem", valor: 1000 })).codigo).toBe("sem_permissao");
  });

  it("folha do mês: comissões de quem concluiu; ajuste e pagamento viram despesa em Salários", async () => {
    const folha = await repo.listarFolha(mesAtual());
    expect(folha.linhas.some((l) => l.nome === "TV da oficina")).toBe(false);
    const comissionados = folha.linhas.filter((l) => l.comissoes > 0);
    expect(comissionados.length).toBeGreaterThan(0);
    expect(folha.totais.total).toBe(folha.linhas.reduce((s, l) => s + l.total, 0));

    const alvo = folha.linhas.find((l) => l.perfilId === "p-diego")!;
    expect((await repo.salvarAjusteFolha("p-diego", mesAtual(), -10000, "Vale")).ok).toBe(true);
    const comAjuste = (await repo.listarFolha(mesAtual())).linhas.find((l) => l.perfilId === "p-diego")!;
    expect(comAjuste.ajustes).toBe(-10000);
    expect(comAjuste.total).toBe(alvo.total - 10000);

    // o financeiro paga com o ajuste do dono, mas não muda o ajuste
    comoQuem("p-paula");
    expect((await repo.pagarFolha("p-diego", mesAtual(), hoje(), 0)).codigo).toBe("sem_permissao");
    const pago = await repo.pagarFolha("p-diego", mesAtual(), hoje());
    expect(pago.ok).toBe(true);
    const despesa = (await repo.listarDespesas()).find((d) => d.id === pago.despesaId)!;
    expect(despesa).toMatchObject({ categoriaId: "desp_salarios", valorPago: comAjuste.total, pagoEm: hoje() });
    const linha = (await repo.listarFolha(mesAtual())).linhas.find((l) => l.perfilId === "p-diego")!;
    expect(linha.pago).toBe(true);
    expect((await repo.pagarFolha("p-diego", mesAtual(), hoje())).codigo).toBe("ja_pago");
    comoQuem("p-dono");
    expect((await repo.salvarAjusteFolha("p-diego", mesAtual(), 500)).codigo).toBe("ja_pago");

    // gerente não lê a folha
    comoQuem("p-gerente");
    await expect(repo.listarFolha(mesAtual())).rejects.toThrow("sem_permissao");
  });

  it("histórico do funcionário: 'Concluiu …' com a placa, mais recente primeiro", async () => {
    const eventos = await repo.historicoFuncionario("p-marcos");
    expect(eventos.length).toBeGreaterThan(0);
    expect(eventos.some((e) => e.tipo === "concluiu" && e.placa && e.texto.startsWith("Concluiu"))).toBe(true);
    const ms = eventos.map((e) => new Date(e.em).getTime());
    expect(ms.every((x, i) => i === 0 || ms[i - 1] >= x)).toBe(true);
  });
});

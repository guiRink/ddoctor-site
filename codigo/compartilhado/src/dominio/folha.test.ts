import { describe, expect, it } from "vitest";
import type { PagamentoFolha, Perfil } from "../tipos";
import { calcularFolha, despesaDaFolha, pagarLinhaFolha, totaisFolha } from "./folha";
import type { ComissoesDoPeriodo } from "./comissoes";

const p = (id: string, nome: string, extra: Partial<Perfil> = {}): Perfil => ({
  id,
  nome,
  papel: "producao",
  ativo: true,
  usaTerminal: false,
  ...extra,
});

const perfis: Perfil[] = [
  p("diego", "Diego", { funcao: "Pintor", salarioMensal: 250000 }),
  p("ana", "Ana", { funcao: "Funileira", salarioMensal: 280000 }),
  p("tv", "TV da oficina", { papel: "dispositivo" }),
  p("bia", "Bia", { papel: "recepcao" }), // sem salário cadastrado
];

const comissoes: ComissoesDoPeriodo = {
  linhas: [],
  porPessoa: [{ perfilId: "diego", quantidade: 3, total: 12000 }],
  total: 12000,
};

describe("calcularFolha", () => {
  it("salário + comissões + ajustes = total, por funcionário ativo, em ordem de nome; TV fica de fora", () => {
    const f = calcularFolha(perfis, comissoes, "2026-10", { ana: -20000 });
    expect(f.map((l) => [l.nome, l.salario, l.comissoes, l.ajustes, l.total])).toEqual([
      ["Ana", 280000, 0, -20000, 260000],
      ["Bia", 0, 0, 0, 0],
      ["Diego", 250000, 12000, 0, 262000],
    ]);
    expect(f.find((l) => l.perfilId === "diego")).toMatchObject({ funcao: "Pintor", quantidadeComissoes: 3, pago: false });
  });

  it("aceita as linhas de comissão direto", () => {
    const linhas = [
      { perfilId: "diego", osId: "o", etapaId: "e1", etapa: "Pintura", concluidaEm: "2026-10-01T10:00:00-03:00", valor: 4000, regraId: "r" },
      { perfilId: "diego", osId: "o", etapaId: "e2", etapa: "Pintura", concluidaEm: "2026-10-02T10:00:00-03:00", valor: 4000, regraId: "r" },
    ];
    expect(calcularFolha(perfis, linhas, "2026-10").find((l) => l.perfilId === "diego")).toMatchObject({ comissoes: 8000, quantidadeComissoes: 2 });
  });

  it("admitido depois do mês não entra; admitido no meio do mês recebe o salário inteiro (provisório)", () => {
    const novos = [p("novo", "Novo", { salarioMensal: 200000, admitidoEm: "2026-11-03" }), p("meio", "Meio", { salarioMensal: 200000, admitidoEm: "2026-10-20" })];
    const f = calcularFolha(novos, [], "2026-10");
    expect(f.map((l) => [l.perfilId, l.salario])).toEqual([["meio", 200000]]);
  });

  it("desligado só aparece com comissão no mês, e sem salário", () => {
    const fora = [p("saiu", "Saiu", { ativo: false, salarioMensal: 300000 }), p("sumiu", "Sumiu", { ativo: false, salarioMensal: 300000 })];
    const c: ComissoesDoPeriodo = { linhas: [], porPessoa: [{ perfilId: "saiu", quantidade: 1, total: 4000 }], total: 4000 };
    expect(calcularFolha(fora, c, "2026-10").map((l) => [l.perfilId, l.salario, l.total, l.ativo])).toEqual([["saiu", 0, 4000, false]]);
  });

  it("já pago: valores congelados do pagamento, mesmo que o salário ou as comissões mudem depois", () => {
    const pago: PagamentoFolha = { id: "pg1", perfilId: "diego", mes: "2026-10", salario: 240000, comissoes: 8000, total: 248000, pagoEm: "2026-11-05" };
    const l = calcularFolha(perfis, comissoes, "2026-10", { diego: 99999 }, [pago]).find((x) => x.perfilId === "diego")!;
    expect(l).toMatchObject({ salario: 240000, comissoes: 8000, ajustes: 0, total: 248000, pago: true, pagamento: pago });
  });

  it("pagamento de outro mês não conta; ajuste salvo e ainda não pago é usado se não vier ajuste", () => {
    const outro: PagamentoFolha = { id: "pg0", perfilId: "ana", mes: "2026-09", salario: 1, comissoes: 0, total: 1, pagoEm: "2026-10-05" };
    const rascunho: PagamentoFolha = { id: "pg2", perfilId: "diego", mes: "2026-10", salario: 0, comissoes: 0, ajustes: 5000, total: 0 };
    const f = calcularFolha(perfis, comissoes, "2026-10", undefined, [outro, rascunho]);
    expect(f.find((l) => l.perfilId === "ana")).toMatchObject({ pago: false, total: 280000 });
    expect(f.find((l) => l.perfilId === "diego")).toMatchObject({ ajustes: 5000, total: 267000, pago: false });
  });

  it("totais: pago e a pagar separados", () => {
    const pago: PagamentoFolha = { id: "pg1", perfilId: "ana", mes: "2026-10", salario: 280000, comissoes: 0, total: 280000, pagoEm: "2026-11-05" };
    const t = totaisFolha(calcularFolha(perfis, comissoes, "2026-10", undefined, [pago]));
    expect(t).toEqual({ salarios: 530000, comissoes: 12000, ajustes: 0, total: 542000, pago: 280000, aPagar: 262000 });
  });

  it("mês inválido", () => {
    expect(() => calcularFolha(perfis, [], "10/2026")).toThrow("mes_invalido");
  });
});

describe("pagarLinhaFolha e despesaDaFolha", () => {
  const linha = calcularFolha(perfis, comissoes, "2026-10").find((l) => l.perfilId === "diego")!;

  it("congela os valores e gera a despesa Salários paga", () => {
    const r = pagarLinhaFolha(linha, { id: "pg1", pagoEm: "2026-11-05", obs: "  pix " });
    expect(r).toEqual({
      ok: true,
      pagamento: { id: "pg1", perfilId: "diego", mes: "2026-10", salario: 250000, comissoes: 12000, total: 262000, pagoEm: "2026-11-05", obs: "pix" },
    });
    if (!r.ok) return;
    expect(despesaDaFolha(r.pagamento, "Diego", "cat-salarios")).toEqual({
      categoria: "Salários",
      categoriaId: "cat-salarios",
      descricao: "Folha 10/2026 · Diego",
      valorPrevisto: 262000,
      vencimento: "2026-11-05",
      pagoEm: "2026-11-05",
      valorPago: 262000,
    });
  });

  it("recusa já pago, total negativo (desconto maior que o devido) e data inexistente", () => {
    expect(pagarLinhaFolha({ ...linha, pago: true }, { id: "x", pagoEm: "2026-11-05" })).toEqual({ ok: false, codigo: "ja_pago" });
    expect(pagarLinhaFolha({ ...linha, total: -100 }, { id: "x", pagoEm: "2026-11-05" })).toEqual({ ok: false, codigo: "total_invalido" });
    expect(pagarLinhaFolha(linha, { id: "x", pagoEm: "2026-02-30" })).toEqual({ ok: false, codigo: "data_invalida" });
  });

  it("total zero ou não pago não vira despesa", () => {
    expect(despesaDaFolha({ id: "a", perfilId: "bia", mes: "2026-10", salario: 0, comissoes: 0, total: 0, pagoEm: "2026-11-05" }, "Bia")).toBeNull();
    expect(despesaDaFolha({ id: "a", perfilId: "bia", mes: "2026-10", salario: 1, comissoes: 0, total: 1 }, "Bia")).toBeNull();
  });
});

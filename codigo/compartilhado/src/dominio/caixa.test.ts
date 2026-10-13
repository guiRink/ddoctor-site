import { describe, expect, it } from "vitest";
import type { Baixa, Despesa, TituloReceber } from "../tipos";
import { calcularFechamento, resumoCompetencia } from "./caixa";

const baixa = (valor: number, recebidoEm: string, forma: string): Baixa => ({ id: `b${valor}${forma}`, valor, recebidoEm, forma });
const despesa = (p: Partial<Despesa>): Despesa => ({
  id: "d",
  categoria: "Outras despesas",
  descricao: "x",
  valorPrevisto: 10000,
  vencimento: "2026-10-12",
  ...p,
});

describe("calcularFechamento", () => {
  const baixas = [
    baixa(50000, "2026-10-12", "dinheiro"),
    baixa(20000, "2026-10-12", "Dinheiro"), // rótulo antigo
    baixa(90000, "2026-10-12", "pix"),
    baixa(7000, "2026-10-11", "dinheiro"),
  ];
  const despesas = [
    despesa({ id: "1", pagoEm: "2026-10-12", valorPago: 3000, formaPagamento: "dinheiro" }),
    despesa({ id: "2", pagoEm: "2026-10-12", formaPagamento: "dinheiro" }), // sem valorPago: vale o previsto
    despesa({ id: "3", pagoEm: "2026-10-12", valorPago: 40000, formaPagamento: "pix" }),
    despesa({ id: "4", formaPagamento: "dinheiro" }), // não paga
  ];
  it("só dinheiro do dia: esperado e diferença", () => {
    expect(calcularFechamento({ saldoInicial: 10000, contado: 66000, baixas, despesas, data: "2026-10-12" })).toEqual({
      data: "2026-10-12",
      saldoInicial: 10000,
      contado: 66000,
      entradasDinheiro: 70000,
      saidasDinheiro: 13000,
      esperado: 67000,
      diferenca: -1000,
    });
  });
  it("caixa batido: diferença zero; dia sem movimento: esperado = saldo inicial", () => {
    expect(calcularFechamento({ saldoInicial: 10000, contado: 67000, baixas, despesas, data: "2026-10-12" }).diferenca).toBe(0);
    const vazio = calcularFechamento({ saldoInicial: 5000, contado: 5000, baixas, despesas, data: "2026-10-10" });
    expect([vazio.entradasDinheiro, vazio.saidasDinheiro, vazio.esperado, vazio.diferenca]).toEqual([0, 0, 5000, 0]);
  });
});

describe("resumoCompetencia", () => {
  const titulos: TituloReceber[] = [
    {
      id: "t1",
      osId: "os1",
      pagadorId: "c",
      descricao: "Franquia",
      valor: 150000,
      vencimento: "2026-10-05",
      estado: "parcial",
      baixas: [baixa(50000, "2026-10-05", "pix"), baixa(30000, "2026-09-30", "pix")],
    },
    { id: "t2", osId: "os2", pagadorId: "m", descricao: "MO", valor: 200000, vencimento: "2026-10-31", estado: "emitido", baixas: [] },
    { id: "t3", osId: "os3", pagadorId: "m", descricao: "MO", valor: 80000, vencimento: "2026-10-20", estado: "cancelado", baixas: [] },
    { id: "t4", osId: "os4", pagadorId: "m", descricao: "MO", valor: 60000, vencimento: "2026-11-01", estado: "emitido", baixas: [] },
  ];
  const despesas = [
    despesa({ id: "1", vencimento: "2026-10-05", pagoEm: "2026-10-06", valorPago: 12000 }),
    despesa({ id: "2", vencimento: "2026-09-25", pagoEm: "2026-10-01" }), // venceu em set, pago em out: saída de out
    despesa({ id: "3", vencimento: "2026-10-31", valorPrevisto: 25000 }), // a pagar
    despesa({ id: "4", vencimento: "2026-11-01", valorPrevisto: 99999 }), // outro mês
    despesa({ id: "5", vencimento: "2026-10-30", pagoEm: "2026-11-02", valorPago: 5000 }), // pago em nov
  ];
  it("entradas e saídas pelo dia do dinheiro; em aberto pelo vencimento do mês (bordas 1º e 31)", () => {
    expect(resumoCompetencia("2026-10", titulos, despesas)).toEqual({
      mes: "2026-10",
      entradas: 50000,
      saidas: 22000,
      resultado: 28000,
      aPagarEmAberto: 25000,
      aReceberEmAberto: 70000 + 200000, // saldo de t1 (150000 − 80000) + t2; cancelado e nov fora
    });
  });
  it("mês sem nada: zeros", () => {
    expect(resumoCompetencia("2025-01", titulos, despesas)).toEqual({
      mes: "2025-01",
      entradas: 0,
      saidas: 0,
      resultado: 0,
      aPagarEmAberto: 0,
      aReceberEmAberto: 0,
    });
  });
});

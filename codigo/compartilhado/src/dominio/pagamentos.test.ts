import { describe, expect, it } from "vitest";
import type { OrcamentoVersao, Pagador, TituloReceber } from "../tipos";
import { FORMAS_PAGAMENTO } from "../tipos";
import { clienteDeveOS, normalizarFormaPagamento, resumoPagamentosOS } from "./pagamentos";

const titulo = (p: Partial<TituloReceber>): TituloReceber => ({
  id: "t",
  osId: "os1",
  pagadorId: "cliente",
  descricao: "x",
  valor: 0,
  vencimento: "2026-10-12",
  estado: "emitido",
  baixas: [],
  ...p,
});
const b = (valor: number, forma = "pix") => ({ id: `b${valor}`, valor, recebidoEm: "2026-10-12", forma });

describe("normalizarFormaPagamento", () => {
  it("canônicas passam; rótulos antigos e acentos viram a forma canônica", () => {
    for (const f of FORMAS_PAGAMENTO) expect(normalizarFormaPagamento(f)).toBe(f);
    expect(normalizarFormaPagamento("Pix")).toBe("pix");
    expect(normalizarFormaPagamento("Transferência")).toBe("transferencia");
    expect(normalizarFormaPagamento(" Débito ")).toBe("debito");
    expect(normalizarFormaPagamento("Cartão de crédito")).toBe("credito");
    expect(normalizarFormaPagamento("TED")).toBe("transferencia");
    expect(normalizarFormaPagamento("Espécie")).toBe("dinheiro");
  });
  it("desconhecido ou vazio → null", () => {
    expect(normalizarFormaPagamento("cheque")).toBeNull();
    expect(normalizarFormaPagamento("")).toBeNull();
    expect(normalizarFormaPagamento(undefined)).toBeNull();
  });
});

describe("resumoPagamentosOS", () => {
  it("franquia parcial + mão de obra em aberto; cancelado fica fora", () => {
    const r = resumoPagamentosOS([
      titulo({ id: "f", valor: 150000, estado: "parcial", baixas: [b(50000, "dinheiro")] }),
      titulo({ id: "m", valor: 300000 }),
      titulo({ id: "x", valor: 99900, estado: "cancelado", baixas: [b(100)] }),
    ]);
    expect(r).toEqual({ total: 450000, recebido: 50000, saldo: 400000 });
  });
  it("tudo quitado: saldo zero; sem títulos: zeros", () => {
    expect(resumoPagamentosOS([titulo({ valor: 1000, estado: "recebido", baixas: [b(600), b(400)] })])).toEqual({
      total: 1000,
      recebido: 1000,
      saldo: 0,
    });
    expect(resumoPagamentosOS([])).toEqual({ total: 0, recebido: 0, saldo: 0 });
  });
});

describe("clienteDeveOS (regra única do 'cliente deve')", () => {
  const pagadores: Pagador[] = [
    { id: "cliente", nome: "Cliente", tipo: "cliente", prazo: { dias: 0, base: "entrega", diasUteis: false, provisorio: true } },
    { id: "hdi", nome: "HDI", tipo: "seguradora", prazo: { dias: 30, base: "nf", diasUteis: false, provisorio: true } },
  ];
  const ver = (p: Partial<OrcamentoVersao>): OrcamentoVersao => ({
    id: `v${p.numeroVersao ?? 1}`,
    osId: "os1",
    tipo: "externo",
    numeroVersao: 1,
    fonte: "manual",
    estado: "aprovado",
    itens: [{ id: "i", peca: "Capô", tecnica: "martelinho", valor: 40000, statusItem: "autorizado" }],
    criadoEm: "2026-10-10T09:00:00-03:00",
    ...p,
  });

  it("seguradora: franquia + complemento da versão APROVADA vigente, não da mais nova enviada", () => {
    const r = clienteDeveOS({
      origem: "maxpar",
      versoes: [ver({ numeroVersao: 3, estado: "enviado", franquia: 99900 }), ver({ numeroVersao: 2, franquia: 16000, complementoParticular: 5000 }), ver({ numeroVersao: 1, franquia: 1000 })],
      titulos: [titulo({ id: "s", pagadorId: "hdi", valor: 40000, baixas: [b(40000)] })],
      pagadores,
    });
    expect(r.versao?.numeroVersao).toBe(2);
    expect(r).toMatchObject({ esperado: 21000, pago: 0, falta: 21000 });
  });

  it("particular: max(aprovado, títulos do cliente); baixa de título cancelado não conta", () => {
    const r = clienteDeveOS({
      origem: "particular",
      versoes: [ver({ tipo: "interno" })],
      titulos: [
        titulo({ id: "a", valor: 50000, estado: "parcial", baixas: [b(20000)] }),
        titulo({ id: "c", valor: 40000, estado: "cancelado", baixas: [b(40000)] }),
      ],
      pagadores,
    });
    expect(r).toMatchObject({ esperado: 50000, cobrado: 50000, pago: 20000, falta: 30000 });
  });

  it("sem versão aprovada nem título: nada a pagar; pago acima do esperado não fica negativo", () => {
    expect(clienteDeveOS({ origem: "particular", versoes: [ver({ estado: "enviado" })], titulos: [], pagadores })).toMatchObject({ versao: undefined, esperado: 0, falta: 0 });
    const r = clienteDeveOS({ origem: "maxpar", versoes: [ver({ franquia: 16000 })], titulos: [titulo({ valor: 16000, estado: "recebido", baixas: [b(16000)] })], pagadores });
    expect(r).toMatchObject({ esperado: 16000, pago: 16000, falta: 0 });
  });
});

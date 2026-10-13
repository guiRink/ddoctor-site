import { describe, expect, it } from "vitest";
import type { TituloReceber } from "../tipos";
import { FORMAS_PAGAMENTO } from "../tipos";
import { normalizarFormaPagamento, resumoPagamentosOS } from "./pagamentos";

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

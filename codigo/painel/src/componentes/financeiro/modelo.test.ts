import { describe, expect, it } from "vitest";
import type { Despesa, TituloReceber } from "@compartilhado/tipos";
import { despesasDaCompetencia, entradasDoMes, prazoDespesa, situacaoDespesa } from "./modelo";
import { lerQuantidade, nomeCompetencia, rotuloForma, somarMeses } from "./formato";

const desp = (id: string, vencimento: string, pagoEm?: string): Despesa => ({
  id,
  categoria: "Outras despesas",
  descricao: id,
  valorPrevisto: 1000,
  vencimento,
  pagoEm,
  valorPago: pagoEm ? 1000 : undefined,
});

describe("financeiro — listas", () => {
  it("situação e prazo da despesa", () => {
    expect(situacaoDespesa(desp("a", "2026-10-10"), "2026-10-13")).toBe("vencida");
    expect(situacaoDespesa(desp("b", "2026-10-13"), "2026-10-13")).toBe("vence_hoje");
    expect(situacaoDespesa(desp("c", "2026-10-20"), "2026-10-13")).toBe("a_vencer");
    expect(situacaoDespesa(desp("d", "2026-10-01", "2026-10-02"), "2026-10-13")).toBe("paga");
    expect(prazoDespesa(desp("a", "2026-10-12"), "2026-10-13")).toBe("vencida há 1 dia");
    expect(prazoDespesa(desp("c", "2026-10-18"), "2026-10-13")).toBe("em 5 dias");
  });

  it("competência inclui vencidas antigas em aberto só no mês corrente", () => {
    const lista = [desp("set-aberta", "2026-09-20"), desp("out", "2026-10-05"), desp("set-paga-out", "2026-09-30", "2026-10-01"), desp("nov", "2026-11-02")];
    expect(despesasDaCompetencia(lista, "2026-10", "2026-10-13").map((d) => d.id)).toEqual(["set-aberta", "out", "set-paga-out"]);
    expect(despesasDaCompetencia(lista, "2026-09", "2026-10-13").map((d) => d.id)).toEqual(["set-aberta", "set-paga-out"]);
  });

  it("entradas do mês vêm das baixas, mais recentes primeiro", () => {
    const t: TituloReceber = {
      id: "t",
      osId: "o",
      pagadorId: "p",
      descricao: "Franquia",
      valor: 5000,
      vencimento: "2026-10-01",
      estado: "parcial",
      baixas: [
        { id: "b1", valor: 1000, recebidoEm: "2026-10-02", forma: "pix" },
        { id: "b2", valor: 2000, recebidoEm: "2026-10-09", forma: "Dinheiro" },
        { id: "b3", valor: 500, recebidoEm: "2026-09-30", forma: "pix" },
      ],
    };
    expect(entradasDoMes([t], "2026-10").map((e) => e.baixa.id)).toEqual(["b2", "b1"]);
  });
});

describe("financeiro — formato", () => {
  it("forma de pagamento legível, inclusive texto antigo", () => {
    expect(rotuloForma("pix")).toBe("Pix");
    expect(rotuloForma("Cartão de crédito")).toBe("Cartão de crédito");
    expect(rotuloForma("transferencia")).toBe("Transferência");
    expect(rotuloForma("vale")).toBe("vale");
    expect(rotuloForma(undefined)).toBe("—");
  });

  it("competência anda mês a mês e tem nome", () => {
    expect(somarMeses("2026-12", 1)).toBe("2027-01");
    expect(somarMeses("2026-01", -1)).toBe("2025-12");
    expect(nomeCompetencia("2026-10")).toBe("outubro de 2026");
  });

  it("lê quantidade com vírgula ou ponto", () => {
    expect(lerQuantidade("1,5")).toBe(1.5);
    expect(lerQuantidade("1.5")).toBe(1.5);
    expect(lerQuantidade("1.000,25")).toBe(1000.25);
    expect(lerQuantidade("abc")).toBeNull();
    expect(lerQuantidade("")).toBeNull();
  });
});

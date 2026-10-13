import { describe, expect, it } from "vitest";
import type { Despesa, EtapaOS, TituloReceber } from "@compartilhado/tipos";
import { baixasRecentes, despesasAPagar, despesasPorCategoria, numerosPessoa, resumoAging, resumoMes } from "./resumos";
import { descreverPrazo } from "./formato";

const HOJE = "2026-10-12";

const titulo = (p: Partial<TituloReceber>): TituloReceber => ({
  id: "t",
  osId: "os",
  pagadorId: "pg",
  descricao: "x",
  valor: 10000,
  vencimento: HOJE,
  estado: "emitido",
  baixas: [],
  ...p,
});

const despesa = (p: Partial<Despesa>): Despesa => ({
  id: "d",
  categoria: "Aluguel",
  descricao: "x",
  valorPrevisto: 1000,
  vencimento: HOJE,
  ...p,
});

describe("resumoAging", () => {
  it("soma o saldo por faixa e ignora recebidos e cancelados", () => {
    const r = resumoAging(
      [
        titulo({ id: "a", vencimento: "2026-10-20" }),
        titulo({ id: "b", vencimento: "2026-10-01", baixas: [{ id: "x", valor: 4000, recebidoEm: "2026-10-05", forma: "Pix" }], estado: "parcial" }),
        titulo({ id: "c", vencimento: "2026-08-25" }),
        titulo({ id: "d", vencimento: "2026-07-01" }),
        titulo({ id: "e", vencimento: "2026-07-01", estado: "recebido" }),
        titulo({ id: "f", vencimento: "2026-07-01", estado: "cancelado" }),
      ],
      HOJE,
    );
    expect(r.a_vencer).toEqual({ total: 10000, quantidade: 1 });
    expect(r["0_30"]).toEqual({ total: 6000, quantidade: 1 });
    expect(r["31_60"]).toEqual({ total: 10000, quantidade: 1 });
    expect(r["61_mais"]).toEqual({ total: 10000, quantidade: 1 });
  });
});

describe("resumoMes", () => {
  it("recebido e pago do mês, saldo e projeção de 30 dias", () => {
    const titulos = [
      titulo({ id: "a", baixas: [{ id: "1", valor: 5000, recebidoEm: "2026-10-03", forma: "Pix" }, { id: "2", valor: 999, recebidoEm: "2026-09-30", forma: "Pix" }], estado: "parcial", vencimento: "2026-10-20" }),
      titulo({ id: "b", vencimento: "2026-11-30" }), // fora do horizonte
      titulo({ id: "c", vencimento: "2026-10-01" }), // vencido: fora da projeção
    ];
    const despesas = [
      despesa({ id: "p", pagoEm: "2026-10-02", valorPago: 2000 }),
      despesa({ id: "q", vencimento: "2026-10-01", valorPrevisto: 3000 }), // vencida em aberto: entra
      despesa({ id: "r", vencimento: "2026-12-01", valorPrevisto: 7000 }), // fora do horizonte
    ];
    const r = resumoMes(titulos, despesas, HOJE);
    expect(r.recebido).toBe(5000);
    expect(r.pago).toBe(2000);
    expect(r.saldo).toBe(3000);
    expect(r.limite).toBe("2026-11-11");
    expect(r.aReceber30).toBe(4001); // saldo = 10000 − 5000 − 999
    expect(r.aPagar30).toBe(3000);
    expect(r.projecao).toBe(1001);
  });
});

describe("despesas", () => {
  it("agrupa por categoria do mês com previsto e pago", () => {
    const c = despesasPorCategoria(
      [
        despesa({ id: "1", categoria: "Aluguel", valorPrevisto: 800 }),
        despesa({ id: "2", categoria: "Impostos", valorPrevisto: 300, pagoEm: HOJE, valorPago: 300 }),
        despesa({ id: "3", categoria: "Impostos", valorPrevisto: 900 }),
        despesa({ id: "4", categoria: "Aluguel", vencimento: "2026-09-10", valorPrevisto: 800 }),
      ],
      "2026-10",
    );
    expect(c).toEqual([
      { categoria: "Impostos", previsto: 1200, pago: 300 },
      { categoria: "Aluguel", previsto: 800, pago: 0 },
    ]);
  });

  it("a pagar: só as abertas, mais antigas primeiro", () => {
    const l = despesasAPagar([
      despesa({ id: "b", vencimento: "2026-10-20" }),
      despesa({ id: "a", vencimento: "2026-10-01" }),
      despesa({ id: "c", pagoEm: HOJE, valorPago: 1 }),
    ]);
    expect(l.map((d) => d.id)).toEqual(["a", "b"]);
  });

  it("baixas recentes em ordem decrescente de data", () => {
    const l = baixasRecentes([
      titulo({ id: "a", baixas: [{ id: "1", valor: 1, recebidoEm: "2026-10-01", forma: "Pix" }] }),
      titulo({ id: "b", baixas: [{ id: "2", valor: 1, recebidoEm: "2026-10-09", forma: "Pix" }] }),
    ]);
    expect(l.map((x) => x.baixa.id)).toEqual(["2", "1"]);
  });
});

describe("numerosPessoa", () => {
  const etapa = (p: Partial<EtapaOS>): EtapaOS => ({
    id: "e",
    osId: "os1",
    ordem: 1,
    nome: "Martelinho",
    estado: "concluida",
    responsavelId: "p1",
    prazoHoras: 4,
    exigeFoto: false,
    bloqueios: [],
    ...p,
  });
  it("conta etapas, peças, carros, tempo médio e impedimentos no período", () => {
    const n = numerosPessoa(
      [
        etapa({ id: "1", iniciadaEm: "2026-10-10T08:00:00-03:00", concluidaEm: "2026-10-10T10:00:00-03:00", pecasFeitas: 2 }),
        etapa({ id: "2", osId: "os2", iniciadaEm: "2026-10-11T08:00:00-03:00", concluidaEm: "2026-10-11T09:00:00-03:00", pecasFeitas: 1 }),
        etapa({ id: "3", iniciadaEm: "2026-09-01T08:00:00-03:00", concluidaEm: "2026-09-01T09:00:00-03:00", pecasFeitas: 9 }), // fora
        etapa({ id: "4", responsavelId: "p2", concluidaEm: "2026-10-11T09:00:00-03:00" }), // outra pessoa
        etapa({
          id: "5",
          estado: "bloqueada",
          concluidaEm: undefined,
          iniciadaEm: "2026-10-12T08:00:00-03:00",
          bloqueios: [{ inicioEm: "2026-10-12T09:00:00-03:00", motivo: "peça" }],
        }),
      ],
      "p1",
      "2026-10-06T00:00:00-03:00",
      "2026-10-12T10:00:00-03:00",
    );
    expect(n.concluidas.map((e) => e.id)).toEqual(["2", "1"]);
    expect(n.pecas).toBe(3);
    expect(n.carros).toBe(2);
    expect(n.tempoMedio).toBe(90);
    expect(n.impedimentos).toBe(1);
    expect(n.emAndamento.map((e) => e.id)).toEqual(["5"]);
  });
});

describe("descreverPrazo", () => {
  it("descreve dias corridos, úteis e pagamento na entrega", () => {
    const base = { id: "x", nome: "x", tipo: "maxpar" as const };
    expect(descreverPrazo({ ...base, prazo: { dias: 30, base: "servico_realizado", diasUteis: false, provisorio: true } })).toBe(
      "30 dias corridos após o serviço realizado",
    );
    expect(descreverPrazo({ ...base, prazo: { dias: 3, base: "nf", diasUteis: true, provisorio: true } })).toBe("3 dias úteis após a emissão da NF");
    expect(descreverPrazo({ ...base, prazo: { dias: 0, base: "entrega", diasUteis: false, provisorio: true } })).toBe("na entrega do carro");
  });
});

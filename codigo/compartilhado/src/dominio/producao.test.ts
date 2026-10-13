import { describe, expect, it } from "vitest";
import { CONFIG_PADRAO } from "./config";
import { diasUteisDoMes, producaoPrevista, proximosDiasUteis } from "./producao";

describe("dias úteis do período", () => {
  it("outubro/2026 pelo expediente padrão (seg–sáb): 27 dias, sem domingos", () => {
    const dias = diasUteisDoMes("2026-10", CONFIG_PADRAO);
    expect(dias).toHaveLength(27);
    expect(dias[0]).toBe("2026-10-01");
    expect(dias).not.toContain("2026-10-04");
    expect(dias).toContain("2026-10-03"); // sábado é útil no padrão
  });
  it("sem sábado no expediente", () => {
    const cfg = { expediente: { ...CONFIG_PADRAO.expediente, diasSemana: [1, 2, 3, 4, 5] } };
    expect(diasUteisDoMes("2026-10", cfg)).toHaveLength(22);
  });
  it("próximos dias úteis a partir de um sábado pulam o domingo", () => {
    expect(proximosDiasUteis("2026-10-10", 3, CONFIG_PADRAO)).toEqual(["2026-10-10", "2026-10-12", "2026-10-13"]);
    expect(proximosDiasUteis("2026-10-11", 1, CONFIG_PADRAO)).toEqual(["2026-10-12"]);
  });
});

describe("producaoPrevista", () => {
  const dias = ["2026-10-16", "2026-10-17", "2026-10-19"]; // sex, sáb, seg
  it("atrasadas no 1º dia; domingo vai para o sábado; capacidade exata sem excesso", () => {
    const r = producaoPrevista(
      [
        { previsaoEntrega: "2026-10-14", pecas: 3 }, // atrasada
        { previsaoEntrega: "2026-10-16", pecas: 8 },
        { previsaoEntrega: "2026-10-18", pecas: 10 }, // domingo → sábado
        { previsaoEntrega: "2026-10-19", pecas: 4 },
        { previsaoEntrega: "2026-10-19", pecas: 2 },
        { previsaoEntrega: "2026-10-20", pecas: 7 }, // depois do período
        { pecas: 5 }, // sem previsão
      ],
      dias,
      10,
    );
    expect(r.dias).toEqual([
      { data: "2026-10-16", pecas: 11, os: 2, capacidade: 10, excesso: 1 },
      { data: "2026-10-17", pecas: 10, os: 1, capacidade: 10, excesso: 0 },
      { data: "2026-10-19", pecas: 6, os: 2, capacidade: 10, excesso: 0 },
    ]);
    expect([r.pecasAtrasadas, r.semPrevisao, r.foraDoPeriodo]).toEqual([3, 1, 1]);
  });
  it("aceita marco na previsão e ignora peças negativas; período vazio manda tudo para fora", () => {
    const r = producaoPrevista([{ previsaoEntrega: "2026-10-17T18:00:00-03:00", pecas: -2 }], dias, 10);
    expect(r.dias[1]).toMatchObject({ pecas: 0, os: 1 });
    expect(producaoPrevista([{ previsaoEntrega: "2026-10-17", pecas: 1 }], [], 10).foraDoPeriodo).toBe(1);
  });
});

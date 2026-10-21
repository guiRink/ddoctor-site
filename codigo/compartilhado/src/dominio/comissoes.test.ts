import { describe, expect, it } from "vitest";
import type { EtapaOS, RegraComissao } from "../tipos";
import { comissoesDoPeriodo, regraDaEtapa, validarRegraComissao, type OSComissao } from "./comissoes";

const etapa = (id: string, nome: string, extra: Partial<EtapaOS> = {}): EtapaOS => ({
  id,
  osId: "os1",
  ordem: 1,
  nome,
  estado: "concluida",
  responsavelId: "diego",
  prazoHoras: 2,
  concluidaEm: "2026-10-15T10:00:00-03:00",
  exigeFoto: false,
  bloqueios: [],
  ...extra,
});

const os = (id: string, etapas: EtapaOS[], extra: Partial<OSComissao["os"]> = {}, placa = "RKP1L34"): OSComissao => ({
  os: { id, estado: "entregue", tipoReparoId: "tr-martelinho", ...extra },
  veiculo: { placa },
  etapas,
});

const PINTURA: RegraComissao = { id: "r-pintura", etapaNome: "Pintura", valor: 4000, ativa: true };

describe("regraDaEtapa — a mais específica vence", () => {
  const regras: RegraComissao[] = [
    { id: "tipo", tipoReparoId: "tr-pintura", valor: 1000, ativa: true },
    PINTURA,
    { id: "tipo+etapa", tipoReparoId: "tr-pintura", etapaNome: "pintura", valor: 6000, ativa: true },
  ];
  it("tipo+etapa > etapa > tipo", () => {
    expect(regraDaEtapa("Pintura", "tr-pintura", regras)?.id).toBe("tipo+etapa");
    expect(regraDaEtapa("Pintura", "tr-martelinho", regras)?.id).toBe("r-pintura");
    expect(regraDaEtapa("Polimento", "tr-pintura", regras)?.id).toBe("tipo");
    expect(regraDaEtapa("Polimento", "tr-martelinho", regras)).toBeUndefined();
  });
  it("nome sem acento, caixa ou espaço extra; regra inativa e regra sem alvo não valem", () => {
    expect(regraDaEtapa("  PINTURA ", undefined, [PINTURA])?.id).toBe("r-pintura");
    expect(regraDaEtapa("Funilária", undefined, [{ id: "f", etapaNome: "funilaria", valor: 1, ativa: true }])?.id).toBe("f");
    expect(regraDaEtapa("Pintura", undefined, [{ ...PINTURA, ativa: false }])).toBeUndefined();
    expect(regraDaEtapa("Pintura", undefined, [{ id: "x", valor: 1, ativa: true }])).toBeUndefined();
  });
});

describe("comissoesDoPeriodo", () => {
  it("pintura concluída = R$ 40 para quem concluiu, com placa e etapa", () => {
    const r = comissoesDoPeriodo([os("os1", [etapa("e1", "Pintura"), etapa("e2", "Polimento")])], [PINTURA], "2026-10");
    expect(r.linhas).toEqual([
      { perfilId: "diego", osId: "os1", placa: "RKP1L34", etapaId: "e1", etapa: "Pintura", concluidaEm: "2026-10-15T10:00:00-03:00", valor: 4000, regraId: "r-pintura" },
    ]);
    expect(r.porPessoa).toEqual([{ perfilId: "diego", quantidade: 1, total: 4000 }]);
    expect(r.total).toBe(4000);
  });

  it("etapa dispensada, não concluída ou sem responsável não paga", () => {
    const r = comissoesDoPeriodo(
      [
        os("os1", [
          etapa("e1", "Pintura", { estado: "dispensada", motivoDispensa: "sem pintura" }),
          etapa("e2", "Pintura", { estado: "em_execucao", concluidaEm: undefined }),
          etapa("e3", "Pintura", { responsavelId: undefined }),
        ]),
      ],
      [PINTURA],
      "2026-10",
    );
    expect(r.linhas).toEqual([]);
    expect(r.total).toBe(0);
  });

  it("virada do mês no fuso da oficina: 31/10 23h30 em SP é outubro, mesmo sendo novembro em UTC", () => {
    const e = etapa("e1", "Pintura", { concluidaEm: "2026-11-01T02:30:00Z" });
    expect(comissoesDoPeriodo([os("os1", [e])], [PINTURA], "2026-10").total).toBe(4000);
    expect(comissoesDoPeriodo([os("os1", [e])], [PINTURA], "2026-11").total).toBe(0);
  });

  it("OS cancelada não paga (provisório)", () => {
    expect(comissoesDoPeriodo([os("os1", [etapa("e1", "Pintura")], { estado: "cancelada" })], [PINTURA], "2026-10").total).toBe(0);
  });

  it("valor 0 na regra mais específica anula a geral", () => {
    const regras = [PINTURA, { id: "zero", tipoReparoId: "tr-martelinho", etapaNome: "Pintura", valor: 0, ativa: true }];
    expect(comissoesDoPeriodo([os("os1", [etapa("e1", "Pintura")])], regras, "2026-10").linhas).toEqual([]);
  });

  it("regra por tipo paga cada etapa concluída daquele tipo", () => {
    const regras: RegraComissao[] = [{ id: "t", tipoReparoId: "tr-martelinho", valor: 2500, ativa: true }];
    const r = comissoesDoPeriodo([os("os1", [etapa("e1", "Desmontagem"), etapa("e2", "Martelinho")])], regras, "2026-10");
    expect(r.total).toBe(5000);
  });

  it("filtra por pessoa; totais por pessoa do maior para o menor; linhas do mais recente", () => {
    const oss = [
      os("os1", [etapa("e1", "Pintura", { concluidaEm: "2026-10-02T09:00:00-03:00" })], {}, "AAA1B23"),
      os("os2", [
        etapa("e2", "Pintura", { concluidaEm: "2026-10-20T09:00:00-03:00" }),
        etapa("e3", "Pintura", { responsavelId: "ana", concluidaEm: "2026-10-10T09:00:00-03:00" }),
      ]),
    ];
    const todos = comissoesDoPeriodo(oss, [PINTURA], "2026-10");
    expect(todos.linhas.map((l) => l.etapaId)).toEqual(["e2", "e3", "e1"]);
    expect(todos.porPessoa).toEqual([
      { perfilId: "diego", quantidade: 2, total: 8000 },
      { perfilId: "ana", quantidade: 1, total: 4000 },
    ]);
    const ana = comissoesDoPeriodo(oss, [PINTURA], "2026-10", "ana");
    expect(ana.total).toBe(4000);
    expect(ana.porPessoa).toHaveLength(1);
  });

  it("sem regras ou mês inválido", () => {
    expect(comissoesDoPeriodo([os("os1", [etapa("e1", "Pintura")])], undefined, "2026-10").total).toBe(0);
    expect(() => comissoesDoPeriodo([], [], "2026-1")).toThrow("mes_invalido");
  });
});

describe("validarRegraComissao", () => {
  it("apara e aceita etapa, tipo ou os dois", () => {
    expect(validarRegraComissao({ etapaNome: "  Pintura ", valor: 4000 })).toEqual({ ok: true, regra: { etapaNome: "Pintura", valor: 4000, ativa: true } });
    expect(validarRegraComissao({ tipoReparoId: "tr-sra", valor: 0 }).ok).toBe(true);
  });
  it("sem alvo, valor quebrado/negativo/acima do teto", () => {
    expect(validarRegraComissao({ etapaNome: " ", valor: 4000 })).toMatchObject({ ok: false, codigo: "alvo_obrigatorio" });
    expect(validarRegraComissao({ etapaNome: "Pintura", valor: -1 })).toMatchObject({ codigo: "valor_invalido" });
    expect(validarRegraComissao({ etapaNome: "Pintura", valor: 40.5 })).toMatchObject({ codigo: "valor_invalido" });
    expect(validarRegraComissao({ etapaNome: "Pintura", valor: 10_000_001 })).toMatchObject({ codigo: "valor_invalido" });
  });
  it("duplicada: mesma etapa (sem acento/caixa) e mesmo tipo, ativa; a própria e as inativas não contam", () => {
    expect(validarRegraComissao({ etapaNome: "PINTURA", valor: 1 }, [PINTURA])).toMatchObject({ codigo: "regra_duplicada" });
    expect(validarRegraComissao({ id: "r-pintura", etapaNome: "Pintura", valor: 5000 }, [PINTURA]).ok).toBe(true);
    expect(validarRegraComissao({ etapaNome: "Pintura", valor: 1 }, [{ ...PINTURA, ativa: false }]).ok).toBe(true);
    expect(validarRegraComissao({ etapaNome: "Pintura", tipoReparoId: "tr-sra", valor: 1 }, [PINTURA]).ok).toBe(true);
    expect(validarRegraComissao({ etapaNome: "Pintura", valor: 1, ativa: false }, [PINTURA]).ok).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import type { EtapaOS } from "../tipos";
import { formatarDuracao, tempoBloqueada, tempoEmExecucao, tempoEmFila } from "./tempos";

const m = (s: string) => `${s}:00-03:00`;
const base: EtapaOS = {
  id: "e1",
  osId: "os1",
  ordem: 1,
  nome: "Martelinho",
  estado: "na_fila",
  prazoHoras: 4,
  exigeFoto: false,
  bloqueios: [],
};

describe("tempoEmFila", () => {
  it("na fila conta até agora", () => {
    expect(tempoEmFila({ ...base, entrouFilaEm: m("2026-10-12T08:00") }, m("2026-10-12T09:30"))).toBe(90);
  });
  it("iniciada conta até o início", () => {
    const e = { ...base, estado: "em_execucao" as const, entrouFilaEm: m("2026-10-12T08:00"), iniciadaEm: m("2026-10-12T08:20") };
    expect(tempoEmFila(e, m("2026-10-12T15:00"))).toBe(20);
  });
  it("sem entrada na fila, aguardando ou dispensada sem início → 0", () => {
    expect(tempoEmFila(base, m("2026-10-12T15:00"))).toBe(0);
    expect(tempoEmFila({ ...base, estado: "dispensada", entrouFilaEm: m("2026-10-12T08:00") }, m("2026-10-12T15:00"))).toBe(0);
  });
  it("conta minutos de relógio, inclusive fora do expediente", () => {
    expect(tempoEmFila({ ...base, entrouFilaEm: m("2026-10-09T17:00") }, m("2026-10-12T08:00"))).toBe(63 * 60);
  });
});

describe("tempoEmExecucao e tempoBloqueada", () => {
  const exec: EtapaOS = {
    ...base,
    estado: "em_execucao",
    entrouFilaEm: m("2026-10-12T08:00"),
    iniciadaEm: m("2026-10-12T09:00"),
  };
  it("sem bloqueio: agora − início", () => {
    expect(tempoEmExecucao(exec, m("2026-10-12T11:15"))).toBe(135);
    expect(tempoBloqueada(exec, m("2026-10-12T11:15"))).toBe(0);
  });
  it("desconta bloqueio fechado e mostra separado", () => {
    const e = { ...exec, bloqueios: [{ inicioEm: m("2026-10-12T10:00"), fimEm: m("2026-10-12T10:45"), motivo: "material" }] };
    expect(tempoEmExecucao(e, m("2026-10-12T12:00"))).toBe(135);
    expect(tempoBloqueada(e, m("2026-10-12T12:00"))).toBe(45);
    expect(tempoEmFila(e, m("2026-10-12T12:00"))).toBe(60);
  });
  it("bloqueio aberto conta até agora", () => {
    const e = { ...exec, estado: "bloqueada" as const, bloqueios: [{ inicioEm: m("2026-10-12T10:00"), motivo: "peça" }] };
    expect(tempoBloqueada(e, m("2026-10-12T13:00"))).toBe(180);
    expect(tempoEmExecucao(e, m("2026-10-12T13:00"))).toBe(60);
  });
  it("concluída para no fim; vários bloqueios somam", () => {
    const e: EtapaOS = {
      ...exec,
      estado: "concluida",
      concluidaEm: m("2026-10-12T14:00"),
      bloqueios: [
        { inicioEm: m("2026-10-12T10:00"), fimEm: m("2026-10-12T10:30"), motivo: "a" },
        { inicioEm: m("2026-10-12T12:00"), fimEm: m("2026-10-12T12:15"), motivo: "b" },
      ],
    };
    expect(tempoEmExecucao(e, m("2026-10-13T10:00"))).toBe(255);
    expect(tempoBloqueada(e, m("2026-10-13T10:00"))).toBe(45);
  });
  it("não iniciada → 0", () => {
    expect(tempoEmExecucao(base, m("2026-10-12T13:00"))).toBe(0);
  });
});

describe("formatarDuracao", () => {
  it("formatos", () => {
    expect(formatarDuracao(0)).toBe("0 min");
    expect(formatarDuracao(45)).toBe("45 min");
    expect(formatarDuracao(60)).toBe("1 h");
    expect(formatarDuracao(135)).toBe("2 h 15 min");
    expect(formatarDuracao(3 * 1440 + 4 * 60 + 30)).toBe("3 d 4 h");
    expect(formatarDuracao(1440)).toBe("1 d");
    expect(formatarDuracao(-5)).toBe("0 min");
  });
});

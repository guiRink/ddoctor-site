import { describe, expect, it } from "vitest";
import type { EtapaOS, OS } from "../tipos";
import { CONFIG_PADRAO as cfg } from "./config";
import { etapaAtual, piorSemaforo, progressoEtapas, semaforoEtapa, semaforoOS } from "./semaforo";

const m = (s: string) => `${s}:00-03:00`;
const etapa = (p: Partial<EtapaOS>): EtapaOS => ({
  id: `e${p.ordem ?? 1}`,
  osId: "os1",
  ordem: 1,
  nome: "Etapa",
  estado: "em_execucao",
  prazoHoras: 4,
  exigeFoto: false,
  bloqueios: [],
  ...p,
});
const os: OS = {
  id: "os1",
  numero: 1,
  veiculoId: "v1",
  clienteId: "c1",
  origem: "maxpar",
  estado: "na_oficina",
  prioridade: 0,
  atendimentosExternos: [],
  criadoEm: m("2026-10-01T08:00"),
  atualizadoEm: m("2026-10-01T08:00"),
};

describe("semaforoEtapa", () => {
  it("neutro para aguardando, concluída e dispensada", () => {
    for (const estado of ["aguardando", "concluida", "dispensada"] as const)
      expect(semaforoEtapa(etapa({ estado, prazoEm: m("2026-10-01T10:00") }), m("2026-10-12T10:00"), cfg)).toBe("neutro");
  });
  it("verde com folga, sem prazo também", () => {
    expect(semaforoEtapa(etapa({ prazoEm: m("2026-10-13T12:00") }), m("2026-10-12T09:00"), cfg)).toBe("verde");
    expect(semaforoEtapa(etapa({}), m("2026-10-12T09:00"), cfg)).toBe("verde");
  });
  it("laranja quando restam menos de 8 h úteis (contando o fim de semana como fora)", () => {
    expect(semaforoEtapa(etapa({ prazoEm: m("2026-10-12T16:00") }), m("2026-10-12T09:00"), cfg)).toBe("laranja");
    // sex 17h → seg 11h = 1 (sex) + 4 (sáb) + 3 (seg) = 8 h: ainda verde
    expect(semaforoEtapa(etapa({ prazoEm: m("2026-10-12T11:00") }), m("2026-10-09T17:00"), cfg)).toBe("verde");
    expect(semaforoEtapa(etapa({ prazoEm: m("2026-10-12T10:59") }), m("2026-10-09T17:00"), cfg)).toBe("laranja");
  });
  it("exatamente no prazo ainda não venceu; um minuto depois é vermelho", () => {
    expect(semaforoEtapa(etapa({ prazoEm: m("2026-10-12T10:00") }), m("2026-10-12T10:00"), cfg)).toBe("laranja");
    expect(semaforoEtapa(etapa({ prazoEm: m("2026-10-12T10:00") }), m("2026-10-12T10:01"), cfg)).toBe("vermelho");
  });
  it("na fila também tem cor", () => {
    expect(semaforoEtapa(etapa({ estado: "na_fila", prazoEm: m("2026-10-12T08:00") }), m("2026-10-12T09:00"), cfg)).toBe("vermelho");
  });
  it("bloqueio aberto há mais de 4 h úteis → vermelho; fechado não conta", () => {
    const bloq = (fimEm?: string) =>
      etapa({ estado: "bloqueada", prazoEm: m("2026-10-20T10:00"), bloqueios: [{ inicioEm: m("2026-10-12T09:00"), fimEm, motivo: "peça" }] });
    expect(semaforoEtapa(bloq(), m("2026-10-12T13:00"), cfg)).toBe("verde");
    expect(semaforoEtapa(bloq(), m("2026-10-12T13:01"), cfg)).toBe("vermelho");
    expect(semaforoEtapa(bloq(m("2026-10-12T10:00")), m("2026-10-12T15:00"), cfg)).toBe("verde");
  });
  it("bloqueio de sexta à noite não fica vermelho no fim de semana sem expediente", () => {
    const e = etapa({ estado: "bloqueada", bloqueios: [{ inicioEm: m("2026-10-10T11:00"), motivo: "x" }] });
    expect(semaforoEtapa(e, m("2026-10-11T20:00"), cfg)).toBe("verde"); // 1 h útil (sáb 11–12)
  });
});

describe("etapaAtual e progressoEtapas", () => {
  const lista = [
    etapa({ ordem: 3, estado: "aguardando" }),
    etapa({ ordem: 1, estado: "concluida" }),
    etapa({ ordem: 2, estado: "dispensada" }),
    etapa({ ordem: 4, estado: "na_fila" }),
  ];
  it("primeira ativa por ordem", () => {
    expect(etapaAtual(lista)?.ordem).toBe(4);
    expect(etapaAtual([etapa({ estado: "concluida" })])).toBeNull();
  });
  it("progresso ignora dispensadas", () => {
    expect(progressoEtapas(lista)).toEqual({ concluidas: 1, total: 3, atualIndex: 2 });
    expect(progressoEtapas([])).toEqual({ concluidas: 0, total: 0, atualIndex: null });
  });
});

describe("semaforoOS", () => {
  const etapas = [
    etapa({ ordem: 1, estado: "concluida" }),
    etapa({ ordem: 2, estado: "em_execucao", prazoEm: m("2026-10-14T18:00") }),
    etapa({ ordem: 3, estado: "aguardando" }),
  ];
  it("fora de na_oficina → neutro", () => {
    expect(semaforoOS({ ...os, estado: "agendada" }, etapas, m("2026-10-12T09:00"), cfg)).toBe("neutro");
    expect(semaforoOS({ ...os, estado: "pronta" }, etapas, m("2026-10-12T09:00"), cfg)).toBe("neutro");
  });
  it("verde com prazo e previsão folgados", () => {
    expect(semaforoOS({ ...os, previsaoEntrega: "2026-10-16" }, etapas, m("2026-10-12T09:00"), cfg)).toBe("verde");
  });
  it("laranja quando a previsão está a ≤ 1 dia útil com etapas restantes", () => {
    expect(semaforoOS({ ...os, previsaoEntrega: "2026-10-13" }, etapas, m("2026-10-12T09:00"), cfg)).toBe("laranja");
    expect(semaforoOS({ ...os, previsaoEntrega: "2026-10-12" }, etapas, m("2026-10-12T09:00"), cfg)).toBe("laranja");
    // sexta → previsão segunda: sábado é útil, então são 2 dias úteis
    expect(semaforoOS({ ...os, previsaoEntrega: "2026-10-12" }, etapas, m("2026-10-09T09:00"), cfg)).toBe("verde");
  });
  it("sem etapas restantes a previsão próxima não pinta laranja", () => {
    const feitas = [etapa({ estado: "concluida" })];
    expect(semaforoOS({ ...os, previsaoEntrega: "2026-10-12" }, feitas, m("2026-10-12T09:00"), cfg)).toBe("verde");
  });
  it("previsão vencida → vermelho, mesmo com etapas em dia", () => {
    expect(semaforoOS({ ...os, previsaoEntrega: "2026-10-09" }, etapas, m("2026-10-12T09:00"), cfg)).toBe("vermelho");
  });
  it("etapa vencida → vermelho; ignora etapas de outra OS", () => {
    const vencida = [etapa({ prazoEm: m("2026-10-12T08:30") })];
    expect(semaforoOS(os, vencida, m("2026-10-12T09:00"), cfg)).toBe("vermelho");
    expect(semaforoOS(os, vencida.map((e) => ({ ...e, osId: "outra" })), m("2026-10-12T09:00"), cfg)).toBe("verde");
  });
  it("piorSemaforo", () => {
    expect(piorSemaforo("verde", "neutro", "laranja")).toBe("laranja");
    expect(piorSemaforo()).toBe("neutro");
  });
});

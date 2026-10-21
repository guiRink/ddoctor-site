import { describe, expect, it } from "vitest";
import { CONFIG_PADRAO as cfg } from "@compartilhado/dominio/config";
import { rotuloDia, rotuloHaQuanto, rotuloPrazo, ultimoInstanteUtil } from "./horarios";
import { formatarMarco } from "@compartilhado/dominio/fuso";

// 12/10/2026 é segunda; 10/10 sábado (expediente 8h–12h); 11/10 domingo (fechado).
const m = (s: string) => `${s}:00-03:00`;
const seg9 = m("2026-10-12T09:00");

describe("rotuloPrazo", () => {
  it("hoje, amanhã, dia da semana e data", () => {
    expect(rotuloPrazo(m("2026-10-12T16:00"), seg9, cfg)).toBe("hoje 16h");
    expect(rotuloPrazo(m("2026-10-12T16:30"), seg9, cfg)).toBe("hoje 16h30");
    expect(rotuloPrazo(m("2026-10-13T10:00"), seg9, cfg)).toBe("amanhã 10h");
    expect(rotuloPrazo(m("2026-10-15T09:00"), seg9, cfg)).toBe("qui 9h");
    expect(rotuloPrazo(m("2026-10-24T09:00"), seg9, cfg)).toBe("24/10 9h");
  });
  it("nunca mostra madrugada: prazo fora do expediente vira o fechamento anterior", () => {
    expect(rotuloPrazo(m("2026-10-13T04:04"), seg9, cfg)).toBe("hoje 18h");
    expect(rotuloPrazo(m("2026-10-12T22:00"), seg9, cfg)).toBe("hoje 18h");
    // domingo e segunda 7h → fechamento de sábado (12h)
    expect(rotuloPrazo(m("2026-10-11T15:00"), m("2026-10-10T09:00"), cfg)).toBe("hoje 12h");
    expect(rotuloPrazo(m("2026-10-12T07:00"), m("2026-10-09T10:00"), cfg)).toBe("amanhã 12h");
  });
  it("sem hora útil antes do prazo (madrugada, fim de semana) → 'antes de abrir'", () => {
    expect(rotuloPrazo(m("2026-10-13T04:04"), m("2026-10-12T22:30"), cfg)).toBe("antes de abrir");
    expect(rotuloPrazo(m("2026-10-11T20:00"), m("2026-10-10T13:00"), cfg)).toBe("antes de abrir");
  });
  it("início e fim do expediente valem como dentro", () => {
    expect(rotuloPrazo(m("2026-10-13T08:00"), seg9, cfg)).toBe("amanhã 8h");
    expect(rotuloPrazo(m("2026-10-12T18:00"), seg9, cfg)).toBe("hoje 18h");
  });
  it("atrasado no mesmo dia em horas úteis; de outro dia em dias úteis", () => {
    expect(rotuloPrazo(m("2026-10-12T13:00"), m("2026-10-12T16:00"), cfg)).toBe("atrasado 3 h");
    expect(rotuloPrazo(m("2026-10-12T13:00"), m("2026-10-12T13:20"), cfg)).toBe("atrasado 20 min");
    expect(rotuloPrazo(m("2026-10-12T17:30"), m("2026-10-12T21:00"), cfg)).toBe("atrasado 30 min");
    expect(rotuloPrazo(m("2026-10-12T18:00"), m("2026-10-12T20:00"), cfg)).toBe("atrasado");
    expect(rotuloPrazo(m("2026-10-12T17:00"), m("2026-10-13T09:00"), cfg)).toBe("atrasado 1 dia");
    // sexta → segunda: sábado é útil, domingo não → 2 dias
    expect(rotuloPrazo(m("2026-10-09T17:00"), seg9, cfg)).toBe("atrasado 2 dias");
  });
  it("data sem hora (entrega prometida)", () => {
    expect(rotuloPrazo("2026-10-12", seg9, cfg)).toBe("hoje");
    expect(rotuloPrazo("2026-10-13", seg9, cfg)).toBe("amanhã");
    expect(rotuloPrazo("2026-10-16", seg9, cfg)).toBe("sex");
    expect(rotuloPrazo("2026-10-10", seg9, cfg)).toBe("atrasado 1 dia"); // sáb → seg: 1 dia útil
    expect(rotuloPrazo("2026-10-11", seg9, cfg)).toBe("atrasado 1 dia"); // domingo: no mínimo 1
    expect(rotuloPrazo("2026-10-07", seg9, cfg)).toBe("atrasado 4 dias");
  });
  it("fuso de São Paulo, mesmo com marco em UTC", () => {
    expect(rotuloPrazo("2026-10-12T19:00:00Z", seg9, cfg)).toBe("hoje 16h");
    // 13/10 01:00 UTC = 12/10 22:00 em SP → fechamento de hoje
    expect(rotuloPrazo("2026-10-13T01:00:00Z", seg9, cfg)).toBe("hoje 18h");
    // agora em UTC: 12/10 02:00 UTC = 11/10 23:00 (domingo) em SP → prazo de segunda 10h é "amanhã"
    expect(rotuloPrazo(m("2026-10-12T10:00"), "2026-10-12T02:00:00Z", cfg)).toBe("amanhã 10h");
  });
});

describe("ultimoInstanteUtil e rotuloDia", () => {
  it("dentro do expediente devolve o próprio marco; fora, o fechamento anterior", () => {
    expect(formatarMarco(ultimoInstanteUtil(m("2026-10-12T10:00"), cfg)!)).toBe(m("2026-10-12T10:00"));
    expect(formatarMarco(ultimoInstanteUtil(m("2026-10-12T05:00"), cfg)!)).toBe(m("2026-10-10T12:00"));
    expect(ultimoInstanteUtil(m("2026-10-12T05:00"), { expediente: { ...cfg.expediente, diasSemana: [] } })).toBeNull();
  });
  it("ontem e datas fora da semana", () => {
    expect(rotuloDia("2026-10-11", "2026-10-12")).toBe("ontem");
    expect(rotuloDia("2026-10-01", "2026-10-12")).toBe("01/10");
    expect(rotuloDia("2026-10-18", "2026-10-12")).toBe("dom");
  });
});

describe("rotuloHaQuanto", () => {
  it("agora, minutos, horas e dias", () => {
    expect(rotuloHaQuanto(seg9, seg9)).toBe("agora");
    expect(rotuloHaQuanto(m("2026-10-12T09:30"), seg9)).toBe("agora"); // futuro
    expect(rotuloHaQuanto(m("2026-10-12T08:40"), seg9)).toBe("há 20 min");
    expect(rotuloHaQuanto(m("2026-10-12T04:00"), seg9)).toBe("há 5 h");
    expect(rotuloHaQuanto(m("2026-10-11T08:00"), seg9)).toBe("há 1 dia");
    expect(rotuloHaQuanto(m("2026-10-09T09:00"), seg9)).toBe("há 3 dias");
  });
  it("data sem hora conta dias corridos", () => {
    expect(rotuloHaQuanto("2026-10-12", seg9)).toBe("hoje");
    expect(rotuloHaQuanto("2026-10-09", seg9)).toBe("há 3 dias");
  });
});

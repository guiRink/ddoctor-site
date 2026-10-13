import { describe, expect, it } from "vitest";
import type { ConfigOficina } from "../tipos";
import { CONFIG_PADRAO } from "./config";
import {
  diasUteisEntre,
  ehDiaUtil,
  fimDoExpediente,
  horasUteisEntre,
  janelaDoDia,
  proximoDiaUtil,
  somarHorasUteis,
} from "./expediente";

// 2026-10-09 sexta · 10 sábado · 11 domingo · 12 segunda
const cfg = CONFIG_PADRAO; // seg–sex 8–18, sáb 8–12
const semSabado: ConfigOficina = { ...cfg, expediente: { diasSemana: [1, 2, 3, 4, 5], inicio: "08:00", fim: "18:00" } };
const m = (s: string) => `${s}:00-03:00`;

describe("ehDiaUtil / janelaDoDia", () => {
  it("segunda útil, domingo não, sábado só se configurado", () => {
    expect(ehDiaUtil("2026-10-12", cfg)).toBe(true);
    expect(ehDiaUtil("2026-10-11", cfg)).toBe(false);
    expect(ehDiaUtil("2026-10-10", cfg)).toBe(true);
    expect(ehDiaUtil("2026-10-10", semSabado)).toBe(false);
  });
  it("aceita marco e usa o dia de São Paulo, não o UTC", () => {
    // 01:00Z de segunda = 22:00 de domingo em SP
    expect(ehDiaUtil("2026-10-12T01:00:00Z", cfg)).toBe(false);
  });
  it("sábado termina em sabadoFim", () => {
    expect(janelaDoDia("2026-10-10", cfg)).toEqual({ inicio: 480, fim: 720 });
    expect(janelaDoDia("2026-10-12", cfg)).toEqual({ inicio: 480, fim: 1080 });
  });
});

describe("horasUteisEntre", () => {
  it("mesmo dia dentro do expediente", () => {
    expect(horasUteisEntre(m("2026-10-12T09:00"), m("2026-10-12T11:30"), cfg)).toBe(2.5);
  });
  it("começa antes da abertura e termina depois do fechamento", () => {
    expect(horasUteisEntre(m("2026-10-12T06:00"), m("2026-10-12T20:00"), cfg)).toBe(10);
  });
  it("virada de expediente: 17h de segunda até 9h de terça = 2 h", () => {
    expect(horasUteisEntre(m("2026-10-12T17:00"), m("2026-10-13T09:00"), cfg)).toBe(2);
  });
  it("atravessa fim de semana com sábado meio período", () => {
    // sex 16–18 (2) + sáb 8–12 (4) + seg 8–10 (2) = 8
    expect(horasUteisEntre(m("2026-10-09T16:00"), m("2026-10-12T10:00"), cfg)).toBe(8);
    expect(horasUteisEntre(m("2026-10-09T16:00"), m("2026-10-12T10:00"), semSabado)).toBe(4);
  });
  it("fim antes do início → 0; fim de semana inteiro sem expediente → 0", () => {
    expect(horasUteisEntre(m("2026-10-12T10:00"), m("2026-10-12T09:00"), cfg)).toBe(0);
    expect(horasUteisEntre(m("2026-10-10T13:00"), m("2026-10-11T23:00"), cfg)).toBe(0);
  });
});

describe("somarHorasUteis", () => {
  it("mesmo dia", () => {
    expect(somarHorasUteis(m("2026-10-12T09:00"), 4, cfg)).toBe(m("2026-10-12T13:00"));
  });
  it("começa fora do expediente: conta da próxima abertura", () => {
    expect(somarHorasUteis(m("2026-10-12T06:30"), 2, cfg)).toBe(m("2026-10-12T10:00"));
    expect(somarHorasUteis(m("2026-10-12T19:00"), 2, cfg)).toBe(m("2026-10-13T10:00"));
    expect(somarHorasUteis(m("2026-10-11T10:00"), 1, cfg)).toBe(m("2026-10-12T09:00"));
  });
  it("terminar no fechamento devolve o fechamento", () => {
    expect(somarHorasUteis(m("2026-10-12T16:00"), 2, cfg)).toBe(m("2026-10-12T18:00"));
  });
  it("atravessa o fim de semana com sábado meio período", () => {
    // sex 16h + 8 h: sex 2 h, sáb 4 h, seg 2 h → seg 10h
    expect(somarHorasUteis(m("2026-10-09T16:00"), 8, cfg)).toBe(m("2026-10-12T10:00"));
    expect(somarHorasUteis(m("2026-10-09T16:00"), 8, semSabado)).toBe(m("2026-10-12T14:00"));
    // sábado depois do meio-dia já é fora do expediente
    expect(somarHorasUteis(m("2026-10-10T13:00"), 1, cfg)).toBe(m("2026-10-12T09:00"));
  });
  it("horas fracionadas e zero", () => {
    expect(somarHorasUteis(m("2026-10-12T09:00"), 1.5, cfg)).toBe(m("2026-10-12T10:30"));
    expect(somarHorasUteis(m("2026-10-12T09:00"), 0, cfg)).toBe(m("2026-10-12T09:00"));
    expect(somarHorasUteis(m("2026-10-12T19:00"), 0, cfg)).toBe(m("2026-10-13T08:00"));
  });
  it("aceita marco em UTC e devolve no fuso da oficina", () => {
    expect(somarHorasUteis("2026-10-12T12:00:00Z", 1, cfg)).toBe(m("2026-10-12T10:00"));
  });
  it("é o inverso de horasUteisEntre", () => {
    const ini = m("2026-10-08T15:20");
    const fim = somarHorasUteis(ini, 23, cfg);
    expect(horasUteisEntre(ini, fim, cfg)).toBe(23);
  });
  it("sem dias úteis configurados lança erro em vez de travar", () => {
    const vazio: ConfigOficina = { ...cfg, expediente: { diasSemana: [], inicio: "08:00", fim: "18:00" } };
    expect(() => somarHorasUteis(m("2026-10-12T09:00"), 1, vazio)).toThrow("expediente_sem_dias_uteis");
    expect(() => somarHorasUteis(m("2026-10-12T09:00"), -1, cfg)).toThrow("horas_invalidas");
  });
});

describe("diasUteisEntre / proximoDiaUtil / fimDoExpediente", () => {
  it("conta (de, ate]", () => {
    expect(diasUteisEntre("2026-10-09", "2026-10-12", cfg)).toBe(2); // sáb + seg
    expect(diasUteisEntre("2026-10-09", "2026-10-12", semSabado)).toBe(1);
    expect(diasUteisEntre("2026-10-12", "2026-10-12", cfg)).toBe(0);
    expect(diasUteisEntre("2026-10-12", "2026-10-09", cfg)).toBe(0);
  });
  it("próximo dia útil e fechamento", () => {
    expect(proximoDiaUtil("2026-10-11", cfg)).toBe("2026-10-12");
    expect(proximoDiaUtil("2026-10-10", semSabado)).toBe("2026-10-12");
    expect(fimDoExpediente("2026-10-10", cfg)).toBe(m("2026-10-10T12:00"));
    expect(fimDoExpediente("2026-10-11", cfg)).toBeNull();
  });
});

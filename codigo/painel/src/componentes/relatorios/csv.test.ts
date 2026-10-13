import { describe, expect, it } from "vitest";
import { gerarCsv, reaisCsv } from "./csv";
import { percentual, reaisCompacto, somarMeses } from "./formato";

describe("csv", () => {
  it("usa ; com BOM e CRLF, e protege campos com separador ou aspas", () => {
    const t = gerarCsv([
      ["Nome", "Valor"],
      ['Funilaria "A"; B', 12.5],
      [null, undefined],
    ]);
    expect(t.startsWith("﻿")).toBe(true);
    expect(t.slice(1)).toBe('Nome;Valor\r\n"Funilaria ""A""; B";12,5\r\n;\r\n');
  });

  it("formata centavos sem milhar", () => {
    expect(reaisCsv(123456)).toBe("1234,56");
    expect(reaisCsv(-5)).toBe("-0,05");
    expect(reaisCsv(undefined)).toBe("");
  });
});

describe("formato dos relatórios", () => {
  it("desloca meses atravessando o ano", () => {
    expect(somarMeses("2026-01", -1)).toBe("2025-12");
    expect(somarMeses("2026-12", 1)).toBe("2027-01");
    expect(somarMeses("2026-10", 0)).toBe("2026-10");
  });

  it("encurta valores do eixo", () => {
    expect(reaisCompacto(0)).toBe("R$ 0");
    expect(reaisCompacto(123456)).toBe("R$ 1,2 mil");
    expect(reaisCompacto(2500000)).toBe("R$ 25 mil");
  });

  it("formata percentual", () => {
    expect(percentual(0.346)).toBe("35 %");
    expect(percentual(null)).toBe("—");
  });
});

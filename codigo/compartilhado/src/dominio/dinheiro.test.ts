import { describe, expect, it } from "vitest";
import { formatarReais, reaisParaCentavos, somaCentavos } from "./dinheiro";

describe("formatarReais", () => {
  it("formata centavos em pt-BR", () => {
    expect(formatarReais(123456)).toBe("R$ 1.234,56");
    expect(formatarReais(0)).toBe("R$ 0,00");
    expect(formatarReais(5)).toBe("R$ 0,05");
    expect(formatarReais(100000000)).toBe("R$ 1.000.000,00");
  });
  it("negativo leva o sinal antes", () => {
    expect(formatarReais(-16000)).toBe("-R$ 160,00");
  });
  it("vazio vira travessão", () => {
    expect(formatarReais(undefined)).toBe("—");
    expect(formatarReais(null)).toBe("—");
    expect(formatarReais(Number.NaN)).toBe("—");
  });
});

describe("reaisParaCentavos", () => {
  it("lê texto pt-BR", () => {
    expect(reaisParaCentavos("1.234,56")).toBe(123456);
    expect(reaisParaCentavos("R$ 160,00")).toBe(16000);
    expect(reaisParaCentavos("0,29")).toBe(29);
    expect(reaisParaCentavos("10,5")).toBe(1050);
    expect(reaisParaCentavos("1000")).toBe(100000);
    expect(reaisParaCentavos("-10,00")).toBe(-1000);
  });
  it("ponto sozinho: milhar se agrupado de 3 em 3, senão decimal", () => {
    expect(reaisParaCentavos("1.234")).toBe(123400);
    expect(reaisParaCentavos("1.234.567")).toBe(123456700);
    expect(reaisParaCentavos("12.50")).toBe(1250);
  });
  it("lê número em reais sem erro de ponto flutuante", () => {
    expect(reaisParaCentavos(1234.56)).toBe(123456);
    expect(reaisParaCentavos(0.29)).toBe(29);
    expect(reaisParaCentavos(1.005)).toBe(101);
  });
  it("texto inválido devolve null", () => {
    expect(reaisParaCentavos("")).toBeNull();
    expect(reaisParaCentavos("abc")).toBeNull();
    expect(reaisParaCentavos("1,2,3")).toBeNull();
    expect(reaisParaCentavos(Number.NaN)).toBeNull();
  });
});

describe("somaCentavos", () => {
  it("soma ignorando vazios", () => {
    expect(somaCentavos([100, undefined, 250, null])).toBe(350);
    expect(somaCentavos([])).toBe(0);
  });
});

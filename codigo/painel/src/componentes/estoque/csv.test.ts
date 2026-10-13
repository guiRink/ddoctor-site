import { describe, expect, it } from "vitest";
import { celulaCsv, centavosCsv, gerarCsv, nomeArquivoCsv, numeroCsv } from "./csv";

describe("csv do estoque", () => {
  it("começa com BOM, separa por ponto e vírgula e termina linhas com CRLF", () => {
    const csv = gerarCsv(["Material", "Saldo"], [["Lixa P1500", 3.5]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1)).toBe("Material;Saldo\r\nLixa P1500;3,5\r\n");
  });

  it("põe aspas quando a célula tem separador, aspas ou quebra de linha", () => {
    expect(celulaCsv("a;b")).toBe('"a;b"');
    expect(celulaCsv('fita "crepe"')).toBe('"fita ""crepe"""');
    expect(celulaCsv("linha\nnova")).toBe('"linha\nnova"');
    expect(celulaCsv(undefined)).toBe("");
  });

  it("formata números e centavos sem separador de milhar", () => {
    expect(numeroCsv(1234.5)).toBe("1234,5");
    expect(numeroCsv(0.1 + 0.2)).toBe("0,3");
    expect(centavosCsv(123456)).toBe("1234,56");
    expect(centavosCsv(-5)).toBe("-0,05");
    expect(centavosCsv(undefined)).toBe("");
  });

  it("nomeia o arquivo com a data", () => {
    expect(nomeArquivoCsv("estoque-materiais", "2026-10-13")).toBe("estoque-materiais-2026-10-13.csv");
  });
});

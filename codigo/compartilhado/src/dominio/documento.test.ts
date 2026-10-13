// Documentos gerados pelo algoritmo de dígito verificador (nenhum dado real).
import { describe, expect, it } from "vitest";
import type { Cliente } from "../tipos";
import { clienteCorresponde } from "./clientes";
import {
  formatarCEP,
  formatarDocumento,
  normalizarCEP,
  normalizarDocumento,
  tipoPorDocumento,
  validarCNPJ,
  validarCPF,
  validarDocumento,
} from "./documento";

describe("CPF", () => {
  it("aceita CPFs com DV correto, com ou sem máscara", () => {
    expect(validarCPF("12345678909")).toBe(true);
    expect(validarCPF("123.456.789-09")).toBe(true);
    expect(validarCPF("111.444.777-35")).toBe(true);
    expect(validarCPF("390 533 447 05")).toBe(true);
    expect(validarCPF("98765432100")).toBe(true); // 2º DV com resto < 2 → 0
  });
  it("recusa DV errado, dígitos repetidos e tamanho errado (sem truncar)", () => {
    expect(validarCPF("12345678900")).toBe(false);
    expect(validarCPF("12345678919")).toBe(false);
    expect(validarCPF("11111111111")).toBe(false);
    expect(validarCPF("00000000000")).toBe(false);
    expect(validarCPF("1234567890")).toBe(false);
    expect(validarCPF("123456789090")).toBe(false); // 12 dígitos: não corta para 11
    expect(validarCPF("")).toBe(false);
    expect(validarCPF("1234567890A")).toBe(false);
  });
});

describe("CNPJ", () => {
  it("aceita CNPJ numérico e alfanumérico com DV correto", () => {
    expect(validarCNPJ("11222333000181")).toBe(true);
    expect(validarCNPJ("11.222.333/0001-81")).toBe(true);
    expect(validarCNPJ("12.345.678/0001-95")).toBe(true);
    expect(validarCNPJ("12.ABC.345/01DE-35")).toBe(true); // alfanumérico (IN RFB 2.229/2024)
    expect(validarCNPJ("12.abc.345/01de-35")).toBe(true); // minúsculas normalizadas
  });
  it("recusa DV errado, repetidos, tamanho errado e letra no DV", () => {
    expect(validarCNPJ("11222333000182")).toBe(false);
    expect(validarCNPJ("11222333000191")).toBe(false);
    expect(validarCNPJ("00000000000000")).toBe(false);
    expect(validarCNPJ("1122233300018")).toBe(false);
    expect(validarCNPJ("112223330001810")).toBe(false);
    expect(validarCNPJ("12ABC34501DE3A")).toBe(false);
    expect(validarCNPJ("12ABC34501DE36")).toBe(false);
  });
});

describe("normalizar, tipo e formatar", () => {
  it("normaliza sem cortar", () => {
    expect(normalizarDocumento(" 123.456.789-09 ")).toBe("12345678909");
    expect(normalizarDocumento("12.abc.345/01de-35")).toBe("12ABC34501DE35");
    expect(normalizarDocumento("123.456.789-090")).toBe("123456789090");
  });
  it("tipo pelo tamanho", () => {
    expect(tipoPorDocumento("123.456.789-09")).toBe("pf");
    expect(tipoPorDocumento("11.222.333/0001-81")).toBe("pj");
    expect(tipoPorDocumento("12ABC34501DE35")).toBe("pj");
    expect(tipoPorDocumento("1234")).toBeNull();
    expect(tipoPorDocumento("ABCDEFGHIJK")).toBeNull();
  });
  it("validarDocumento usa o tipo informado ou o deduzido", () => {
    expect(validarDocumento("12345678909")).toBe(true);
    expect(validarDocumento("11222333000181")).toBe(true);
    expect(validarDocumento("12345678909", "pj")).toBe(false);
    expect(validarDocumento("123")).toBe(false);
  });
  it("formata com máscara; tamanho estranho volta normalizado", () => {
    expect(formatarDocumento("12345678909")).toBe("123.456.789-09");
    expect(formatarDocumento("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatarDocumento("12abc34501de35")).toBe("12.ABC.345/01DE-35");
    expect(formatarDocumento("12-34")).toBe("1234");
  });
  it("CEP", () => {
    expect(normalizarCEP("80000-000")).toBe("80000000");
    expect(normalizarCEP("8000-000")).toBeNull();
    expect(formatarCEP("80000000")).toBe("80000-000");
    expect(formatarCEP("123")).toBe("123");
  });
});

describe("clienteCorresponde", () => {
  const c: Cliente = {
    id: "c1",
    nome: "João da Conceição (demo)",
    documento: "12345678909",
    telefone: "+5541900001111",
    whatsapp: "+5541900002222",
    email: "joao.demo@exemplo.com",
  };
  it("nome sem acento e sem caixa", () => {
    expect(clienteCorresponde(c, "conceicao")).toBe(true);
    expect(clienteCorresponde(c, "JOÃO")).toBe(true);
    expect(clienteCorresponde(c, "maria")).toBe(false);
  });
  it("documento com ou sem máscara, telefone, WhatsApp e e-mail", () => {
    expect(clienteCorresponde(c, "123.456.789-09")).toBe(true);
    expect(clienteCorresponde(c, "789")).toBe(true);
    expect(clienteCorresponde(c, "0000-2222")).toBe(true);
    expect(clienteCorresponde(c, "(41) 90000-1111")).toBe(true);
    expect(clienteCorresponde(c, "exemplo.com")).toBe(true);
    expect(clienteCorresponde(c, "")).toBe(true);
  });
});

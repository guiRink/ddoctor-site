import { describe, expect, it } from "vitest";
import { formatarPlaca, normalizarPlaca, placaValida } from "./placa";

describe("normalizarPlaca", () => {
  it("passa para maiúscula e tira hífen, espaço e ponto", () => {
    expect(normalizarPlaca(" abc-1d23 ")).toBe("ABC1D23");
    expect(normalizarPlaca("abc 1234")).toBe("ABC1234");
    expect(normalizarPlaca("a.b.c-1.2.3.4")).toBe("ABC1234");
  });
  it("não trunca: 8 caracteres continuam 8", () => {
    expect(normalizarPlaca("ABC-1D234")).toBe("ABC1D234");
  });
});

describe("placaValida", () => {
  it("aceita Mercosul e antiga", () => {
    expect(placaValida("ABC1D23")).toBe(true);
    expect(placaValida("abc-1234")).toBe(true);
  });
  it("recusa mais de 7 depois de normalizar (bug da QA: truncava antes de validar)", () => {
    expect(placaValida("ABC1D234")).toBe(false);
    expect(placaValida("ABC-12345")).toBe(false);
  });
  it("recusa menos de 7 e formatos errados", () => {
    expect(placaValida("ABC123")).toBe(false);
    expect(placaValida("AB12345")).toBe(false);
    expect(placaValida("ABC12D3")).toBe(false);
    expect(placaValida("1BC1234")).toBe(false);
    expect(placaValida("")).toBe(false);
  });
});

describe("formatarPlaca", () => {
  it("formata placa válida com hífen", () => {
    expect(formatarPlaca("abc1d23")).toBe("ABC-1D23");
    expect(formatarPlaca("ABC 1234")).toBe("ABC-1234");
  });
  it("menos de 7 devolve o normalizado", () => {
    expect(formatarPlaca("ab-c1")).toBe("ABC1");
  });
  it("mais de 7 ou inválida devolve o normalizado, sem cortar", () => {
    expect(formatarPlaca("abc-1d234")).toBe("ABC1D234");
    expect(formatarPlaca("1234567")).toBe("1234567");
  });
});

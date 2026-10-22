import { describe, expect, it } from "vitest";
import { bytesUtf8, LIMITES_SENHA, validarSenha } from "./senha";

describe("validarSenha", () => {
  it("mínimo de 8 caracteres", () => {
    expect(validarSenha("")).toBe("senha_curta");
    expect(validarSenha("abc-123")).toBe("senha_curta");
    expect(validarSenha("abcd-123")).toBeNull();
    // 4 letras com acento = 8 bytes, mas só 4 caracteres
    expect(validarSenha("ãéíõ")).toBe("senha_curta");
  });

  it("máximo de 72 bytes UTF-8 (acento conta 2, emoji 4)", () => {
    expect(bytesUtf8("a")).toBe(1);
    expect(bytesUtf8("ç")).toBe(2);
    expect(bytesUtf8("🔧")).toBe(4);
    expect(validarSenha("a".repeat(LIMITES_SENHA.maxBytes))).toBeNull();
    expect(validarSenha("a".repeat(LIMITES_SENHA.maxBytes + 1))).toBe("senha_longa");
    // 40 caracteres, 80 bytes: passa no número de letras, mas não cabe
    expect(validarSenha("ç".repeat(40))).toBe("senha_longa");
    expect(validarSenha("ç".repeat(36))).toBeNull();
    expect(validarSenha("🔧".repeat(19))).toBe("senha_longa");
  });
});

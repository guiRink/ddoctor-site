import { describe, expect, it } from "vitest";
import type { Material } from "../tipos";
import { statusEstoque } from "./estoque";

const mat = (p: Partial<Material> = {}): Material => ({
  id: "m1",
  nome: "Massa poliéster",
  categoria: "massa/primer",
  unidade: "kg",
  saldoEstimado: 5,
  saldoMinimo: 2,
  ultimaConferenciaEm: "2026-10-01",
  custoMedio: 4500,
  ...p,
});
const hoje = "2026-10-12";

describe("statusEstoque", () => {
  it("ok com saldo acima do mínimo e conferência recente", () => {
    expect(statusEstoque(mat(), hoje)).toBe("ok");
    expect(statusEstoque(mat({ saldoEstimado: 2 }), hoje)).toBe("ok"); // igual ao mínimo não é baixo
  });
  it("baixo abaixo do mínimo; zerado em 0 ou negativo", () => {
    expect(statusEstoque(mat({ saldoEstimado: 1.5 }), hoje)).toBe("baixo");
    expect(statusEstoque(mat({ saldoEstimado: 0 }), hoje)).toBe("zerado");
    expect(statusEstoque(mat({ saldoEstimado: -1, saldoMinimo: 0 }), hoje)).toBe("zerado");
  });
  it("conferir depois de 90 dias ou nunca conferido; zerado/baixo têm prioridade", () => {
    expect(statusEstoque(mat({ ultimaConferenciaEm: "2026-07-14" }), hoje)).toBe("ok"); // 90 dias
    expect(statusEstoque(mat({ ultimaConferenciaEm: "2026-07-13" }), hoje)).toBe("conferir"); // 91 dias
    expect(statusEstoque(mat({ ultimaConferenciaEm: undefined }), hoje)).toBe("conferir");
    expect(statusEstoque(mat({ ultimaConferenciaEm: undefined, saldoEstimado: 1 }), hoje)).toBe("baixo");
    expect(statusEstoque(mat({ ultimaConferenciaEm: "2026-09-01" }), hoje, 30)).toBe("conferir");
  });
});

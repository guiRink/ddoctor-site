import { describe, expect, it } from "vitest";
import type { ChecklistItem } from "../tipos";
import { CHECKLIST_PADRAO, CONFIG_PADRAO, capacidadePecasDia, itensChecklist } from "./config";
import { gruposChecklist, progressoChecklist, validarAvaria } from "./recepcao";

const itens: ChecklistItem[] = [
  { id: "a", grupo: "G1", nome: "A", ativo: true },
  { id: "b", grupo: "G1", nome: "B", ativo: true },
  { id: "c", grupo: "G2", nome: "C", ativo: false },
  { id: "d", grupo: "G2", nome: "D", ativo: true },
];

describe("checklist de entrada", () => {
  it("conta só itens ativos e ignora marcações de inativos/desconhecidos", () => {
    expect(progressoChecklist({ a: true, c: true, x: true, b: false }, itens)).toEqual({
      marcados: 1,
      total: 3,
      fracao: 1 / 3,
      completo: false,
    });
    expect(progressoChecklist({ a: true, b: true, d: true }, itens).completo).toBe(true);
  });
  it("sem itens ativos: fração null e não completo", () => {
    expect(progressoChecklist({}, [])).toEqual({ marcados: 0, total: 0, fracao: null, completo: false });
  });
  it("agrupa na ordem dos grupos, sem inativos", () => {
    expect(gruposChecklist(itens).map((g) => [g.grupo, g.itens.map((i) => i.id)])).toEqual([
      ["G1", ["a", "b"]],
      ["G2", ["d"]],
    ]);
  });
  it("padrão provisório: ~20 itens em 4 grupos, ids únicos", () => {
    expect(CHECKLIST_PADRAO.length).toBeGreaterThanOrEqual(20);
    expect(new Set(CHECKLIST_PADRAO.map((i) => i.id)).size).toBe(CHECKLIST_PADRAO.length);
    expect(gruposChecklist(CHECKLIST_PADRAO).map((g) => g.grupo)).toEqual([
      "Documentos e chaves",
      "Itens de série",
      "Funcionamento",
      "Conservação",
    ]);
    expect(itensChecklist(CONFIG_PADRAO)).toBe(CHECKLIST_PADRAO);
    expect(itensChecklist({ checklist: itens })).toBe(itens);
  });
  it("capacidade de peças/dia vem da configuração, com padrão provisório 10", () => {
    expect(capacidadePecasDia(CONFIG_PADRAO)).toBe(10);
    expect(capacidadePecasDia({ capacidadePadrao: { vagasEntrada: 4, carrosSimultaneos: 12 } })).toBe(10);
    expect(capacidadePecasDia({ capacidadePadrao: { vagasEntrada: 4, carrosSimultaneos: 12, pecasDia: 14 } })).toBe(14);
  });
});

describe("validarAvaria", () => {
  it("posição dentro do desenho (bordas inclusas)", () => {
    expect(validarAvaria({ x: 0, y: 1 }).ok).toBe(true);
    expect(validarAvaria({ x: 0.5, y: 0.25 }).ok).toBe(true);
    expect(validarAvaria({ x: 1.01, y: 0.5 })).toEqual({ ok: false, codigo: "posicao_invalida" });
    expect(validarAvaria({ x: -0.1, y: 0.5 })).toEqual({ ok: false, codigo: "posicao_invalida" });
    expect(validarAvaria({ x: Number.NaN, y: 0.5 }).ok).toBe(false);
  });
});

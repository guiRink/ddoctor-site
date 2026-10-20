import { describe, expect, it } from "vitest";
import type { ModeloEtapaItem } from "../tipos";
import { ETAPAS_SUGERIDAS, validarTipoReparo } from "./tiposReparo";

const etapa = (ordem: number, nome: string, prazoPadraoHoras = 2): ModeloEtapaItem => ({
  ordem,
  nome,
  prazoPadraoHoras,
  dispensavel: false,
  exigeFoto: false,
  exigeContagemPecas: false,
});
const existentes = [{ id: "tr-martelinho", nome: "Martelinho" }, { id: "tr-sra", nome: "SRA (arranhões)" }];

describe("validarTipoReparo", () => {
  it("aceita um tipo novo e devolve etapas ordenadas e aparadas", () => {
    const r = validarTipoReparo({ nome: "  Para-choque  plástico ", etapas: [etapa(2, " Pintura "), etapa(1, "Preparação", 0.5)] }, existentes);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.nome).toBe("Para-choque plástico");
    expect(r.etapas.map((e) => [e.ordem, e.nome, e.prazoPadraoHoras])).toEqual([[1, "Preparação", 0.5], [2, "Pintura", 2]]);
  });

  it("recusa nome vazio e nome repetido (sem acento nem caixa), mas não conta o próprio id", () => {
    expect(validarTipoReparo({ nome: "  ", etapas: [etapa(1, "A")] }, existentes)).toEqual({ ok: false, codigo: "nome_obrigatorio" });
    expect(validarTipoReparo({ nome: "martelinho", etapas: [etapa(1, "A")] }, existentes)).toEqual({ ok: false, codigo: "nome_duplicado" });
    expect(validarTipoReparo({ nome: "SRA (ARRANHOES)", etapas: [etapa(1, "A")] }, existentes)).toEqual({ ok: false, codigo: "nome_duplicado" });
    expect(validarTipoReparo({ id: "tr-martelinho", nome: "Martelinho", etapas: [etapa(1, "A")] }, existentes).ok).toBe(true);
  });

  it("exige ao menos uma etapa, ordens 1..n e prazo > 0", () => {
    expect(validarTipoReparo({ nome: "X", etapas: [] }, existentes)).toEqual({ ok: false, codigo: "sem_etapas" });
    expect(validarTipoReparo({ nome: "X", etapas: [etapa(1, "A"), etapa(3, "B")] }, existentes)).toEqual({ ok: false, codigo: "ordem_invalida" });
    expect(validarTipoReparo({ nome: "X", etapas: [etapa(1, "A"), etapa(1, "B")] }, existentes)).toEqual({ ok: false, codigo: "ordem_invalida" });
    expect(validarTipoReparo({ nome: "X", etapas: [etapa(0, "A")] }, existentes)).toEqual({ ok: false, codigo: "ordem_invalida" });
    expect(validarTipoReparo({ nome: "X", etapas: [etapa(1, "A", 0)] }, existentes)).toEqual({ ok: false, codigo: "prazo_invalido" });
    expect(validarTipoReparo({ nome: "X", etapas: [etapa(1, "A", Number.NaN)] }, existentes)).toEqual({ ok: false, codigo: "prazo_invalido" });
    expect(validarTipoReparo({ nome: "X", etapas: [etapa(1, "  ")] }, existentes)).toEqual({ ok: false, codigo: "etapa_invalida" });
  });

  it("as etapas sugeridas montam um tipo válido", () => {
    const etapas = ETAPAS_SUGERIDAS.map((e, i) => ({ ...e, ordem: i + 1 }));
    expect(validarTipoReparo({ nome: "Completo", etapas }, existentes).ok).toBe(true);
    expect(new Set(ETAPAS_SUGERIDAS.map((e) => e.nome)).size).toBe(ETAPAS_SUGERIDAS.length);
  });
});

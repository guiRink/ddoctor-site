import { describe, expect, it } from "vitest";
import type { Perfil, TipoReparo } from "@compartilhado/tipos";
import type { LinhaFolha } from "@compartilhado/dominio/folha";
import { csvFolha, funcaoEPermissao, gerarSenha, nomesDeEtapa, ordenarEquipe, situacaoFolha, textoAlvoComissao } from "./modelo";

const p = (id: string, nome: string, papel: Perfil["papel"], ativo = true): Perfil => ({ id, nome, papel, ativo, usaTerminal: false });

describe("equipe — apresentação", () => {
  it("ordena ativos primeiro, depois dono → produção e nome; aparelho fica fora", () => {
    const lista = ordenarEquipe([p("1", "Zé", "producao"), p("2", "Ana", "producao", false), p("3", "Carlos", "dono"), p("4", "TV", "dispositivo"), p("5", "Bia", "gestor")]);
    expect(lista.map((x) => x.nome)).toEqual(["Carlos", "Bia", "Zé", "Ana"]);
  });

  it("função e permissão", () => {
    expect(funcaoEPermissao({ funcao: "Pintor", papel: "producao" })).toBe("Pintor · Produção");
    expect(funcaoEPermissao({ papel: "gestor" })).toBe("Gerente");
  });

  it("alvo da comissão e nomes de etapa sem repetir", () => {
    const tipos = [
      { id: "t1", nome: "Funilaria e pintura", etapas: [{ nome: "Pintura" }, { nome: "Funilaria" }] },
      { id: "t2", nome: "Pintura", etapas: [{ nome: "pintura " }, { nome: "Polimento" }] },
    ] as unknown as TipoReparo[];
    expect(nomesDeEtapa(tipos)).toEqual(["Funilaria", "Pintura", "Polimento"]);
    expect(textoAlvoComissao({ etapaNome: "Pintura" }, tipos)).toBe("Pintura");
    expect(textoAlvoComissao({ etapaNome: "Pintura", tipoReparoId: "t1" }, tipos)).toBe("Pintura em Funilaria e pintura");
    expect(textoAlvoComissao({ tipoReparoId: "t2" }, tipos)).toBe("Toda etapa de Pintura");
  });

  it("situação da folha", () => {
    expect(situacaoFolha({ pago: false, total: 100 })).toEqual({ texto: "A pagar", tom: "neutro" });
    expect(situacaoFolha({ pago: false, total: 0 }).texto).toBe("Nada a pagar");
    expect(situacaoFolha({ pago: true, pagamento: { pagoEm: "2026-11-05" } as LinhaFolha["pagamento"] }).texto).toBe("Pago em 05/11");
  });

  it("CSV da folha em pt-BR", () => {
    const csv = csvFolha([
      { perfilId: "p", nome: "Diego; Ramos", papel: "producao", ativo: true, mes: "2026-10", salario: 340000, comissoes: 5500, quantidadeComissoes: 2, ajustes: -15000, total: 330500, pago: false },
    ]);
    expect(csv.startsWith("﻿Funcionário;")).toBe(true);
    expect(csv).toContain('"Diego; Ramos";;Produção;10/2026;3400,00;55,00;2;-150,00;3305,00;A pagar;');
  });

  it("senha sugerida: 3 grupos de 4, sem caracteres que confundem", () => {
    const s = gerarSenha();
    expect(s).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(s).not.toMatch(/[01ilo]/);
    expect(gerarSenha((n) => new Uint32Array(n))).toBe("aaaa-aaaa-aaaa");
  });
});

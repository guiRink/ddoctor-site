import { describe, expect, it } from "vitest";
import type { EtapaOS, OS } from "@compartilhado/tipos";
import { CONFIG_PADRAO } from "@compartilhado/dominio/config";
import type { OSVisao } from "../../dados/repositorio";
import { COLUNA_PRONTOS, contarItens, filtrarItens, formatarDia, montarColunas, montarItens, ordemEtapas } from "./quadro";

const AGORA = "2026-10-13T10:00:00-03:00"; // terça, dentro do expediente

function etapa(osId: string, ordem: number, nome: string, estado: EtapaOS["estado"], extra: Partial<EtapaOS> = {}): EtapaOS {
  return { id: `${osId}-${ordem}`, osId, ordem, nome, estado, prazoHoras: 4, exigeFoto: false, bloqueios: [], ...extra };
}

function visao(id: string, estado: OS["estado"], etapas: EtapaOS[], extra: Partial<OS> = {}): OSVisao {
  return {
    os: { id, numero: 1, veiculoId: `v-${id}`, clienteId: "c", origem: "particular", estado, prioridade: 0, atendimentosExternos: [], criadoEm: AGORA, atualizadoEm: AGORA, ...extra },
    veiculo: { id: `v-${id}`, placa: `ABC1D${id.padStart(2, "0")}` },
    cliente: { id: "c", nome: "Cliente" },
    atendimentos: [],
    versoes: [],
    etapas,
    pendencias: [],
    titulos: [],
    fotos: [],
    custos: [],
  };
}

describe("ordemEtapas", () => {
  it("junta sequências de tipos de reparo diferentes na ordem do fluxo", () => {
    const ordem = ordemEtapas([
      ["Desmontagem", "Martelinho", "Polimento", "Montagem e revisão"],
      ["Desmontagem", "Funilaria", "Preparação", "Pintura", "Polimento", "Montagem"],
      ["Preparação", "Pintura localizada", "Polimento"],
      ["Polimento", "Higienização"],
    ]);
    expect(ordem[0]).toBe("Desmontagem");
    expect(ordem.indexOf("Preparação")).toBeLessThan(ordem.indexOf("Pintura"));
    expect(ordem.indexOf("Pintura")).toBeLessThan(ordem.indexOf("Polimento"));
    expect(ordem.indexOf("Pintura localizada")).toBeLessThan(ordem.indexOf("Polimento"));
    expect(ordem.indexOf("Polimento")).toBeLessThan(ordem.indexOf("Higienização"));
    expect(ordem.indexOf("Polimento")).toBeLessThan(ordem.indexOf("Montagem"));
    expect(new Set(ordem).size).toBe(ordem.length);
  });

  it("não trava com ordens conflitantes (ciclo)", () => {
    const ordem = ordemEtapas([
      ["A", "B"],
      ["B", "A"],
    ]);
    expect(ordem.sort()).toEqual(["A", "B"]);
  });
});

describe("montarItens e colunas", () => {
  const oss = [
    visao("1", "na_oficina", [etapa("1", 1, "Funilaria", "concluida"), etapa("1", 2, "Pintura", "em_execucao", { iniciadaEm: "2026-10-13T08:00:00-03:00", prazoEm: "2026-10-12T17:00:00-03:00" })], {
      previsaoEntrega: "2026-10-13",
    }),
    visao("2", "na_oficina", [
      etapa("2", 1, "Funilaria", "bloqueada", { iniciadaEm: "2026-10-13T08:00:00-03:00", prazoEm: "2026-10-14T17:00:00-03:00", bloqueios: [{ inicioEm: "2026-10-13T09:30:00-03:00", motivo: "Falta de material" }] }),
      etapa("2", 2, "Pintura", "aguardando"),
    ]),
    visao("3", "pronta", [etapa("3", 1, "Polimento", "concluida")], { previsaoEntrega: "2026-10-13" }),
    visao("4", "agendada", []),
  ];
  const itens = montarItens(oss, AGORA, CONFIG_PADRAO);

  it("considera só OS na oficina e prontas", () => {
    expect(itens.map((i) => i.v.os.id).sort()).toEqual(["1", "2", "3"]);
  });

  it("separa atrasado de impedido e conta entregas de hoje", () => {
    expect(contarItens(itens)).toEqual({ naOficina: 2, prontos: 1, atrasados: 1, impedidos: 1, hoje: 2 });
    expect(filtrarItens(itens, "impedidos").map((i) => i.v.os.id)).toEqual(["2"]);
    expect(filtrarItens(itens, "atrasados").map((i) => i.v.os.id)).toEqual(["1"]);
  });

  it("monta colunas pela etapa atual, com Prontos no fim", () => {
    const colunas = montarColunas(itens, oss);
    expect(colunas.map((c) => c.id)).toEqual(["Funilaria", "Pintura", COLUNA_PRONTOS]);
  });
});

describe("formatarDia", () => {
  it("usa hoje/amanhã/ontem e cai para dia da semana", () => {
    expect(formatarDia("2026-10-13", AGORA)).toBe("hoje");
    expect(formatarDia("2026-10-14", AGORA)).toBe("amanhã");
    expect(formatarDia("2026-10-12", AGORA)).toBe("ontem");
    expect(formatarDia("2026-10-16", AGORA)).toBe("sex 16/10");
  });
});

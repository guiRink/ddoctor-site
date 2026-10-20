import { describe, expect, it } from "vitest";
import type { EtapaOS, OS } from "@compartilhado/tipos";
import { CONFIG_PADRAO } from "@compartilhado/dominio/config";
import type { OSVisao } from "../../dados/repositorio";
import { COLUNA_PRONTOS, contarItens, densidadeTV, etapasSemCarro, filtrarItens, formatarDia, formatarPrazoCurto, lerVisao, montarColunas, montarItens, ordemEtapas, ordenarPorUrgencia, paginasTV } from "./quadro";

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

  it("lista etapas do fluxo sem carro e ordena por urgência com prontos no fim", () => {
    expect(etapasSemCarro(itens, oss)).toEqual(["Polimento"]);
    expect(etapasSemCarro(itens.filter((i) => i.coluna !== "Pintura"), oss).sort()).toEqual(["Pintura", "Polimento"]);
    const ordem = ordenarPorUrgencia(itens).map((i) => i.v.os.id);
    expect(ordem.at(-1)).toBe("3");
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

describe("apresentação", () => {
  it("densidade da TV encolhe o cartão antes de paginar", () => {
    expect(densidadeTV(820, 2, 12)).toEqual({ densidade: "cheio", porPagina: 2 });
    expect(densidadeTV(820, 3, 12).densidade).toBe("medio");
    expect(densidadeTV(820, 4, 12).densidade).toBe("compacto");
    const muitos = densidadeTV(820, 12, 12);
    expect(muitos.densidade).toBe("compacto");
    expect(muitos.porPagina).toBe(6);
  });

  it("prazo curto mostra só a hora quando é hoje", () => {
    expect(formatarPrazoCurto("2026-10-13T18:41:00-03:00", AGORA)).toBe("18:41");
    expect(formatarPrazoCurto("2026-10-14T09:00:00-03:00", AGORA)).toBe("amanhã");
    expect(formatarPrazoCurto("2026-10-09T09:00:00-03:00", AGORA)).toBe("09/10");
  });

  it("lê a visão salva com quadro como padrão", () => {
    expect(lerVisao("lista")).toBe("lista");
    expect(lerVisao(null)).toBe("quadro");
    expect(lerVisao("outra")).toBe("quadro");
  });
});

describe("paginasTV", () => {
  it("com um só conjunto de colunas, a coluna pagina a cada tique", () => {
    expect([0, 1, 2, 3].map((t) => paginasTV(t, 1).paginaDaColuna(3))).toEqual([0, 1, 2, 0]);
    expect(paginasTV(5, 1).paginaColunas).toBe(0);
  });

  it("com 2 conjuntos e coluna de 2 páginas, toda página aparece no conjunto da coluna", () => {
    const vistas = new Set<number>();
    for (let t = 0; t < 8; t++) {
      const { paginaColunas, paginaDaColuna } = paginasTV(t, 2);
      if (paginaColunas === 0) vistas.add(paginaDaColuna(2));
    }
    expect([...vistas].sort()).toEqual([0, 1]);
  });

  it("a página da coluna só avança quando o conjunto dá a volta", () => {
    expect([0, 1, 2, 3, 4, 5].map((t) => paginasTV(t, 3).paginaColunas)).toEqual([0, 1, 2, 0, 1, 2]);
    expect([0, 1, 2, 3, 4, 5].map((t) => paginasTV(t, 3).paginaDaColuna(2))).toEqual([0, 0, 0, 1, 1, 1]);
  });

  it("tolera zero páginas", () => {
    expect(paginasTV(4, 0).paginaColunas).toBe(0);
    expect(paginasTV(4, 1).paginaDaColuna(0)).toBe(0);
  });
});

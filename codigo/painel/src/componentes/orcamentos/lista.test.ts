import { describe, expect, it } from "vitest";
import type { EstadoOS, OrcamentoVersao, OS } from "@compartilhado/tipos";
import { dataNoFuso } from "@compartilhado/dominio/fuso";
import type { OSVisao } from "../../dados/repositorio";
import {
  alternarOrdem,
  combinaTermo,
  diasDesdeAbertura,
  direcaoDaColuna,
  escreverFiltros,
  estadosDaChave,
  faixaDoTempo,
  faixaDoValor,
  filtrarPorEstado,
  filtrarSemEstado,
  FILTROS_VAZIOS,
  lerFiltros,
  ordenarLista,
  quantosFiltros,
  seguradorasDe,
  somaDaLista,
  tempoNaSituacao,
  textoHa,
  textoPecas,
} from "./lista";

const HOJE = "2026-10-12";

function versao(valor: number, estado: OrcamentoVersao["estado"] = "aprovado", extra: Partial<OrcamentoVersao> = {}): OrcamentoVersao {
  return {
    id: "v",
    osId: "x",
    tipo: "externo",
    numeroVersao: 1,
    fonte: "manual",
    estado,
    criadoEm: "2026-10-08T10:00:00-03:00",
    itens: [{ id: "1", peca: "Capô", tecnica: "martelinho", valor, statusItem: estado === "aprovado" ? "autorizado" : "solicitado" }],
    ...extra,
  };
}

function os(id: string, estado: EstadoOS, osExtra: Partial<OS> = {}, extra: Partial<OSVisao> = {}): OSVisao {
  return {
    os: {
      id,
      numero: 1000,
      veiculoId: `v-${id}`,
      clienteId: `c-${id}`,
      origem: "maxpar",
      estado,
      prioridade: 0,
      atendimentosExternos: [],
      criadoEm: "2026-10-01T09:00:00-03:00",
      atualizadoEm: "2026-10-12T09:00:00-03:00",
      ...osExtra,
    },
    veiculo: { id: `v-${id}`, placa: "RJC8T15", modelo: "Audi Q5" },
    cliente: { id: `c-${id}`, nome: "Marina Albuquerque" },
    atendimentos: [],
    versoes: [],
    etapas: [],
    pendencias: [],
    titulos: [],
    fotos: [],
    custos: [],
    ...extra,
  };
}

const at = (seguradora: string, idExterno?: string, numeroSinistro?: string) => ({
  id: `at-${seguradora}`,
  fonte: "manual" as const,
  seguradora,
  idExterno,
  numeroSinistro,
  statusNormalizado: "autorizado" as const,
  estadoConciliacao: "ok" as const,
});

describe("busca da página", () => {
  const v = os("a", "agendada", {}, { atendimentos: [at("MAPFRE", "18389907", "SIN-7731")] });

  it("acha a placa com ou sem hífen, em maiúscula ou minúscula", () => {
    expect(combinaTermo(v, "RJC8T15")).toBe(true);
    expect(combinaTermo(v, "rjc-8t15")).toBe(true);
    expect(combinaTermo(v, "rjc 8t")).toBe(true);
    expect(combinaTermo(os("b", "agendada", {}, { veiculo: { id: "v", placa: "ABC-1D23" } }), "abc1d")).toBe(true);
  });

  it("acha cliente sem acento, protocolo, sinistro, modelo e nº da OS", () => {
    expect(combinaTermo(v, "albuquerque")).toBe(true);
    expect(combinaTermo(os("c", "agendada", {}, { cliente: { id: "c", nome: "João Araújo" } }), "araujo")).toBe(true);
    expect(combinaTermo(v, "18389907")).toBe(true);
    expect(combinaTermo(v, "sin-7731")).toBe(true);
    expect(combinaTermo(v, "audi q5")).toBe(true);
    expect(combinaTermo(v, "1000")).toBe(true);
    expect(combinaTermo(v, "")).toBe(true);
    expect(combinaTermo(v, "volvo")).toBe(false);
  });
});

describe("faixas de valor", () => {
  it("separa por faixa com os limites em reais fechados embaixo", () => {
    expect(faixaDoValor(0)).toBe("sem_valor");
    expect(faixaDoValor(1)).toBe("ate500");
    expect(faixaDoValor(50_000)).toBe("ate500");
    expect(faixaDoValor(50_001)).toBe("500a1500");
    expect(faixaDoValor(150_000)).toBe("500a1500");
    expect(faixaDoValor(150_001)).toBe("1500a5000");
    expect(faixaDoValor(500_000)).toBe("1500a5000");
    expect(faixaDoValor(500_001)).toBe("acima5000");
  });
});

describe("tempo", () => {
  it("conta os dias no fuso de São Paulo, não em UTC", () => {
    // 23:30 de 11/10 em SP já é 12/10 em UTC: abriu ontem para a oficina.
    const v = os("a", "rascunho", { criadoEm: "2026-10-12T02:30:00Z" });
    expect(dataNoFuso("2026-10-12T02:30:00Z")).toBe("2026-10-11");
    expect(diasDesdeAbertura(v, HOJE)).toBe(1);
    expect(diasDesdeAbertura(os("b", "rascunho", { criadoEm: "2026-10-12T08:00:00-03:00" }), HOJE)).toBe(0);
    expect(diasDesdeAbertura(os("c", "rascunho"), HOJE)).toBe(11);
  });

  it("escreve 'há N dias' e separa por faixa", () => {
    expect(textoHa(0)).toBe("hoje");
    expect(textoHa(1)).toBe("há 1 dia");
    expect(textoHa(5)).toBe("há 5 dias");
    expect(faixaDoTempo(0)).toBe("ate3");
    expect(faixaDoTempo(3)).toBe("ate3");
    expect(faixaDoTempo(4)).toBe("4a7");
    expect(faixaDoTempo(15)).toBe("8a15");
    expect(faixaDoTempo(16)).toBe("mais15");
  });

  it("conta há quanto tempo está na situação atual pelo marco; sem marco, desde a abertura", () => {
    const t = (v: OSVisao) => {
      const r = tempoNaSituacao(v, HOJE);
      return [r.dias, r.desde, r.extra];
    };
    expect(t(os("a", "na_oficina", { entradaRealEm: "2026-10-09T08:10:00-03:00" }))).toEqual([3, "desde a entrada", undefined]);
    expect(t(os("b", "pronta", { prontaEm: "2026-10-12T07:00:00-03:00" }))).toEqual([0, "desde que ficou pronto", undefined]);
    expect(t(os("c", "aguardando_aprovacao", {}, { versoes: [versao(1000, "enviado")] }))).toEqual([4, "desde o orçamento", undefined]);
    const aprovada = versao(1000, "aprovado", { aprovacao: { tipo: "externa", aprovadoEm: "2026-10-11T15:00:00-03:00", confiavel: true } });
    expect(t(os("d", "aguardando_agendamento", {}, { versoes: [aprovada] }))).toEqual([1, "desde a aprovação", undefined]);
    expect(t(os("h", "entregue", { entregueEm: "2026-10-05T17:00:00-03:00" }))).toEqual([7, "desde a entrega", undefined]);
    const ag = (data: string) => ({ id: "g", osId: "e", data, janela: "manha" as const, estado: "confirmado" as const, origem: "recepcao" as const });
    expect(tempoNaSituacao(os("e", "agendada", {}, { agendamento: ag("2026-10-12") }), HOJE).extra).toBe("entra hoje");
    expect(tempoNaSituacao(os("e", "agendada", {}, { agendamento: ag("2026-10-13") }), HOJE).extra).toBe("entra amanhã");
    expect(tempoNaSituacao(os("e", "agendada", {}, { agendamento: ag("2026-10-15") }), HOJE).extra).toBe("entra em 3 dias");
    expect(tempoNaSituacao(os("e", "agendada", {}, { agendamento: ag("2026-10-10") }), HOJE).extra).toBe("entrada atrasada há 2 dias");
    // sem o marco, conta desde a abertura e diz isso
    expect(t(os("f", "na_oficina"))).toEqual([11, "desde a abertura", undefined]);
    expect(t(os("g", "rascunho"))).toEqual([11, "desde a abertura", undefined]);
  });

  it("escreve as peças como '1 de 2 autorizadas'", () => {
    expect(textoPecas(1, 2)).toBe("1 de 2 autorizadas");
    expect(textoPecas(1, 1)).toBe("1 de 1 autorizada");
    expect(textoPecas(0, 0)).toBe("sem peças");
  });
});

describe("filtros na URL", () => {
  it("lê, ignora valor desconhecido e escreve só o que difere do padrão", () => {
    const f = lerFiltros(new URLSearchParams("q=rjc&estado=pronta&valor=500a1500&tempo=xx&origem=maxpar&seguradora=HDI&ordem=valor_desc"));
    expect(f).toEqual({ q: "rjc", estado: "pronta", valor: "500a1500", tempo: undefined, origem: "maxpar", seguradora: "HDI", ordem: "valor_desc" });
    expect(lerFiltros(new URLSearchParams("")).ordem).toBe("tempo_desc"); // o mais parado em cima
    expect(lerFiltros(new URLSearchParams("estado=bobagem&ordem=zz"))).toEqual({ ...FILTROS_VAZIOS, valor: undefined, tempo: undefined, origem: undefined, seguradora: undefined });
    const p = escreverFiltros({ ...FILTROS_VAZIOS, valor: "ate500" }, new URLSearchParams("dev=1&perfil=p-dono&q=velho&ordem=valor_asc"));
    expect(p.toString()).toBe("dev=1&perfil=p-dono&valor=ate500");
  });

  it("aceita aba conhecida ou estados separados por vírgula", () => {
    expect(estadosDaChave("todos")).toEqual([]);
    expect(estadosDaChave("entregue")).toEqual(["entregue", "encerrada"]);
    expect(estadosDaChave("na_oficina,pronta")).toEqual(["na_oficina", "pronta"]);
    expect(estadosDaChave("na_oficina,bobagem")).toEqual(["na_oficina"]);
    expect(lerFiltros(new URLSearchParams("estado=na_oficina,pronta")).estado).toBe("na_oficina,pronta");
  });

  it("alterna a ordem pelo cabeçalho e conta os filtros ligados", () => {
    expect(alternarOrdem("tempo_desc", "valor")).toBe("valor_desc");
    expect(alternarOrdem("tempo_desc", "tempo")).toBe("tempo_asc");
    expect(alternarOrdem("valor_desc", "valor")).toBe("valor_asc");
    expect(alternarOrdem("valor_asc", "valor")).toBe("valor_desc");
    expect(alternarOrdem("valor_desc", "tempo")).toBe("tempo_desc");
    expect(alternarOrdem("estado_asc", "estado")).toBe("estado_desc");
    expect(direcaoDaColuna("tempo_desc", "tempo")).toBe("descending");
    expect(direcaoDaColuna("valor_asc", "valor")).toBe("ascending");
    expect(direcaoDaColuna("valor_asc", "tempo")).toBeUndefined();
    expect(quantosFiltros(FILTROS_VAZIOS)).toBe(0);
    expect(quantosFiltros({ ...FILTROS_VAZIOS, q: "abc", estado: "pronta", origem: "particular" })).toBe(2);
  });
});

describe("aplicar e ordenar", () => {
  const lista = [
    os("barato", "na_oficina", { criadoEm: "2026-10-10T09:00:00-03:00", atualizadoEm: "2026-10-12T08:00:00-03:00" }, { versoes: [versao(30_000)], atendimentos: [at("HDI")] }),
    os("medio", "pronta", { criadoEm: "2026-10-02T09:00:00-03:00", atualizadoEm: "2026-10-12T09:30:00-03:00" }, { versoes: [versao(120_000)], atendimentos: [at("MAPFRE")] }),
    os("caro", "aguardando_aprovacao", { criadoEm: "2026-09-20T09:00:00-03:00", origem: "seguradora_direta" }, { versoes: [versao(800_000, "enviado")], atendimentos: [at("Porto Seguro")] }),
    os("vazio", "rascunho", { criadoEm: "2026-10-12T09:00:00-03:00", origem: "particular" }),
  ];
  const ids = (l: OSVisao[]) => l.map((v) => v.os.id);

  it("filtra por valor (orçado conta antes da aprovação), tempo, origem e seguradora", () => {
    expect(ids(filtrarSemEstado(lista, { ...FILTROS_VAZIOS, valor: "ate500" }, HOJE))).toEqual(["barato"]);
    expect(ids(filtrarSemEstado(lista, { ...FILTROS_VAZIOS, valor: "acima5000" }, HOJE))).toEqual(["caro"]);
    expect(ids(filtrarSemEstado(lista, { ...FILTROS_VAZIOS, valor: "sem_valor" }, HOJE))).toEqual(["vazio"]);
    // tempo na situação: barato 2 (abertura), medio 10 (abertura), caro 4 (desde o orçamento), vazio 0
    expect(ids(filtrarSemEstado(lista, { ...FILTROS_VAZIOS, tempo: "8a15" }, HOJE))).toEqual(["medio"]);
    expect(ids(filtrarSemEstado(lista, { ...FILTROS_VAZIOS, tempo: "4a7" }, HOJE))).toEqual(["caro"]);
    expect(ids(filtrarSemEstado(lista, { ...FILTROS_VAZIOS, tempo: "ate3" }, HOJE))).toEqual(["barato", "vazio"]);
    expect(ids(filtrarSemEstado(lista, { ...FILTROS_VAZIOS, origem: "particular" }, HOJE))).toEqual(["vazio"]);
    expect(ids(filtrarSemEstado(lista, { ...FILTROS_VAZIOS, seguradora: "mapfre" }, HOJE))).toEqual(["medio"]);
    expect(ids(filtrarPorEstado(lista, "na_oficina,pronta"))).toEqual(["barato", "medio"]);
  });

  it("ordena pelo mais parado na situação; quem já saiu do fluxo fica no fim", () => {
    const l = [
      os("vazio", "rascunho", { criadoEm: "2026-10-12T09:00:00-03:00" }),
      os("pronto", "pronta", { prontaEm: "2026-10-11T16:00:00-03:00" }, { versoes: [versao(120_000)] }),
      os("entregue", "entregue", { entregueEm: "2026-09-01T16:00:00-03:00" }, { versoes: [versao(900_000)] }),
      os("oficina", "na_oficina", { criadoEm: "2026-10-10T09:00:00-03:00" }, { versoes: [versao(30_000)] }),
      os("espera", "aguardando_aprovacao", {}, { versoes: [versao(800_000, "enviado")] }),
    ];
    // dias na situação: espera 4, oficina 2 (desde a abertura), pronto 1, vazio 0; entregue há 41, mas no fim
    expect(ids(ordenarLista(l, "tempo_desc", HOJE))).toEqual(["espera", "oficina", "pronto", "vazio", "entregue"]);
    expect(ids(ordenarLista(l, "tempo_asc", HOJE))).toEqual(["vazio", "pronto", "oficina", "espera", "entregue"]);
    expect(ids(ordenarLista(l, "valor_desc", HOJE))).toEqual(["entregue", "espera", "pronto", "oficina", "vazio"]);
    expect(ids(ordenarLista(l, "valor_asc", HOJE))[0]).toBe("vazio");
    expect(ids(ordenarLista(l, "estado_asc", HOJE))).toEqual(["vazio", "espera", "oficina", "pronto", "entregue"]);
    expect(ids(ordenarLista(l, "estado_desc", HOJE))[0]).toBe("entregue");
    expect(somaDaLista(l)).toBe(120_000 + 900_000 + 30_000 + 800_000);
  });

  it("lista as seguradoras sem repetir, em ordem alfabética, e nunca a Maxpar", () => {
    expect(seguradorasDe([...lista, os("x", "pronta", {}, { atendimentos: [at("HDI"), at("Maxpar")] })])).toEqual(["HDI", "MAPFRE", "Porto Seguro"]);
  });
});

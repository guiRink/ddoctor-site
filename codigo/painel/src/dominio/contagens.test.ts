import { describe, expect, it } from "vitest";
import type { Agendamento, EtapaOS, OS, OrcamentoVersao, Pagador, TituloReceber } from "@compartilhado/tipos";
import { CONFIG_PADRAO as cfg } from "@compartilhado/dominio/config";
import { paraMs } from "@compartilhado/dominio/fuso";
import { situacaoCartao } from "@compartilhado/dominio/semaforo";
import type { OSVisao } from "../dados/repositorio";
import { gerarDemo, type EstadoDemo } from "../dados/demo";
import {
  clienteDeve,
  devedorDoTitulo,
  dinheiroVencido,
  entramHoje,
  esperandoSeguradora,
  naOficina,
  paraAgendar,
  paraFazerHoje,
  paradosEAtrasados,
  prontosCobrarFranquia,
  saemHoje,
  textoFalta,
} from "./contagens";

// seg 12/10/2026 10h (expediente seg–sex 8h–18h, sáb 8h–12h)
const m = (s: string) => `${s}:00-03:00`;
const agora = m("2026-10-12T10:00");

const pagadores: Pagador[] = [
  { id: "pg-maxpar", nome: "Maxpar", tipo: "maxpar", prazo: { dias: 30, base: "servico_realizado", diasUteis: false, provisorio: true } },
  { id: "pg-cliente", nome: "Cliente", tipo: "cliente", prazo: { dias: 0, base: "entrega", diasUteis: false, provisorio: true } },
];

let seq = 0;
function etapa(p: Partial<EtapaOS>): EtapaOS {
  return { id: `e${++seq}`, osId: "?", ordem: 1, nome: "Etapa", estado: "aguardando", prazoHoras: 4, exigeFoto: false, bloqueios: [], ...p };
}
function versao(p: Partial<OrcamentoVersao> = {}): OrcamentoVersao {
  return {
    id: `ver${++seq}`,
    osId: "?",
    tipo: "externo",
    numeroVersao: 1,
    fonte: "manual",
    estado: "aprovado",
    itens: [
      { id: "i1", peca: "Capô", tecnica: "martelinho", valor: 40000, statusItem: "autorizado" },
      { id: "i2", peca: "Teto", tecnica: "martelinho", valor: 30000, statusItem: "negado" },
    ],
    franquia: 16000,
    criadoEm: m("2026-10-07T09:00"),
    aprovacao: { tipo: "externa", aprovadoEm: m("2026-10-09T15:00"), confiavel: true },
    ...p,
  };
}
function visao(id: string, os: Partial<OS>, extra: Partial<OSVisao> = {}): OSVisao {
  const etapas = (extra.etapas ?? []).map((e) => ({ ...e, osId: id }));
  return {
    os: { id, numero: 1, veiculoId: `v-${id}`, clienteId: `c-${id}`, origem: "maxpar", estado: "na_oficina", prioridade: 0, atendimentosExternos: [], criadoEm: m("2026-10-05T09:00"), atualizadoEm: agora, ...os },
    veiculo: { id: `v-${id}`, placa: `PLA${id.padStart(4, "0")}`.slice(0, 7) },
    cliente: { id: `c-${id}`, nome: `Cliente ${id}`, telefone: "+5541990000000" },
    atendimentos: [{ id: `at-${id}`, fonte: "manual", seguradora: "HDI", idExterno: `P-${id}`, statusNormalizado: "autorizado", aberturaEm: "2026-10-06", estadoConciliacao: "ok" }],
    versoes: [versao()],
    pendencias: [],
    titulos: [],
    fotos: [],
    custos: [],
    ...extra,
    etapas,
  };
}

describe("naOficina", () => {
  const oss = [
    visao("1", { previsaoEntrega: "2026-10-16" }, { etapas: [etapa({ estado: "em_execucao", prazoEm: m("2026-10-12T13:00") })] }), // no prazo
    visao("2", {}, { etapas: [etapa({ estado: "em_execucao", prazoEm: m("2026-10-12T09:00") })] }), // atrasado
    visao("3", {}, { etapas: [etapa({ estado: "bloqueada", prazoEm: m("2026-10-12T09:00"), bloqueios: [{ inicioEm: m("2026-10-12T09:30"), motivo: "peça" }] })] }),
    visao("4", { estado: "pronta", prontaEm: m("2026-10-09T17:00") }),
    visao("5", { estado: "pronta", prontaEm: m("2026-10-12T08:00") }),
    visao("6", { estado: "agendada" }),
    visao("7", { estado: "entregue" }),
  ];
  it("na_oficina + pronta; emServico + prontos = total = itens", () => {
    const r = naOficina(oss, agora, cfg);
    expect(r).toMatchObject({ total: 5, emServico: 3, prontos: 2 });
    expect(r.itens).toHaveLength(r.total);
  });
  it("atrasados no topo; impedido logo depois; prontos por último, o mais antigo primeiro", () => {
    expect(naOficina(oss, agora, cfg).itens.map((i) => [i.v.os.id, i.situacao])).toEqual([
      ["2", "atrasado"],
      ["3", "impedido"],
      ["1", "no_prazo"],
      ["4", "pronto"],
      ["5", "pronto"],
    ]);
  });
  it("pronto há 2 dias ou mais: cliente não buscou", () => {
    const itens = naOficina(oss, agora, cfg).itens;
    expect(itens.find((i) => i.v.os.id === "4")).toMatchObject({ prontoHaDias: 3, naoBuscou: true });
    expect(itens.find((i) => i.v.os.id === "5")).toMatchObject({ prontoHaDias: 0, naoBuscou: false });
  });
});

describe("entramHoje", () => {
  const oss = [visao("1", { estado: "agendada" }), visao("2", { estado: "aguardando_agendamento" }), visao("3", { estado: "na_oficina" }), visao("4", { estado: "agendada" })];
  const ag = (p: Partial<Agendamento>): Agendamento => ({ id: `ag${++seq}`, osId: "1", data: "2026-10-12", janela: "manha", estado: "confirmado", origem: "recepcao", ...p });
  it("confirmados e propostas válidas de hoje, de carros que ainda não entraram; manhã antes da tarde", () => {
    const r = entramHoje(
      oss,
      [
        ag({ osId: "1", janela: "tarde" }),
        ag({ osId: "2", estado: "proposto", expiraEm: m("2026-10-12T11:00") }),
        ag({ osId: "2", estado: "proposto", expiraEm: m("2026-10-12T09:00"), id: "expirada" }),
        ag({ osId: "3" }), // já entrou
        ag({ osId: "4", data: "2026-10-13" }), // amanhã
        ag({ osId: "4", estado: "cancelado" }),
      ],
      agora,
    );
    expect(r.total).toBe(2);
    expect(r.itens.map((i) => [i.v.os.id, i.janela, i.confirmado])).toEqual([
      ["2", "manha", false],
      ["1", "tarde", true],
    ]);
    expect(r).toMatchObject({ confirmados: 1, manha: 1, tarde: 1 });
  });
});

describe("saemHoje", () => {
  const titulo = (osId: string, valor: number, pago: number): TituloReceber => ({
    id: `t${++seq}`, osId, pagadorId: "pg-cliente", descricao: "Franquia", valor, vencimento: "2026-10-12", estado: pago >= valor ? "recebido" : "parcial",
    baixas: pago ? [{ id: `b${seq}`, valor: pago, recebidoEm: "2026-10-12", forma: "pix" }] : [],
  });
  const oss = [
    visao("1", { previsaoEntrega: "2026-10-12" }, {
      etapas: [
        etapa({ ordem: 1, estado: "concluida", nome: "Desmontagem" }),
        etapa({ ordem: 2, estado: "em_execucao", nome: "Polimento", prazoEm: m("2026-10-12T12:00") }),
        etapa({ ordem: 3, nome: "Montagem" }),
      ],
    }),
    visao("2", { estado: "pronta", previsaoEntrega: "2026-10-12" }, { titulos: [titulo("2", 16000, 16000)] }),
    visao("3", { estado: "pronta", previsaoEntrega: "2026-10-12", origem: "particular" }, {
      versoes: [versao({ tipo: "interno", franquia: undefined })],
      titulos: [titulo("3", 70000, 20000)],
    }),
    visao("4", { previsaoEntrega: "2026-10-13" }),
    visao("5", { estado: "entregue", previsaoEntrega: "2026-10-12" }),
  ];
  it("entrega prometida hoje, inclui os não prontos com o que falta; prontos primeiro", () => {
    const r = saemHoje(oss, agora, cfg, pagadores);
    expect(r).toMatchObject({ total: 3, prontos: 2, emServico: 1 });
    expect(r.itens.map((i) => i.v.os.id)).toEqual(["2", "3", "1"]);
    expect(r.itens[2]).toMatchObject({ pronto: false, situacao: "atencao", etapasRestantes: 2, falta: "Polimento e Montagem" });
  });
  it("a cobrar do cliente: franquia menos o já pago; particular = aprovado menos o pago", () => {
    const r = saemHoje(oss, agora, cfg, pagadores);
    expect(r.itens.map((i) => [i.v.os.id, i.aCobrarCliente])).toEqual([
      ["2", 0],
      ["3", 20000], // interno: aprovado 40000 (o negado fica fora) − 20000 já pagos
      ["1", 16000],
    ]);
  });
  it("textoFalta", () => {
    expect(textoFalta([])).toBe("");
    expect(textoFalta([etapa({ nome: "Pintura" })])).toBe("Pintura");
    expect(textoFalta([etapa({ nome: "A" }), etapa({ nome: "B" }), etapa({ nome: "C" })])).toBe("A e mais 2");
  });
});

describe("paradosEAtrasados", () => {
  const oss = [
    visao("1", { previsaoEntrega: "2026-10-09" }, { etapas: [etapa({ estado: "em_execucao", nome: "Pintura", prazoEm: m("2026-10-12T09:00") })] }),
    visao("2", {}, { etapas: [etapa({ estado: "em_execucao", nome: "Pintura", prazoEm: m("2026-10-12T09:00") })] }),
    visao("3", { previsaoEntrega: "2026-10-09" }, {
      etapas: [etapa({ estado: "bloqueada", responsavelId: "p1", prazoEm: m("2026-10-13T09:00"), bloqueios: [{ inicioEm: m("2026-10-12T08:00"), motivo: "Peça não chegou" }] })],
    }),
    visao("4", { previsaoEntrega: "2026-10-16" }, { etapas: [etapa({ estado: "em_execucao", prazoEm: m("2026-10-12T16:00") })] }),
    visao("5", { estado: "pronta", previsaoEntrega: "2026-10-01" }),
  ];
  it("impedidos + etapa atrasada + entrega vencida = carros impedidos ou atrasados (mesmo número da situação)", () => {
    const r = paradosEAtrasados(oss, agora, cfg);
    expect(r.total).toBe(3);
    const porSituacao = oss.filter((v) => ["impedido", "atrasado"].includes(situacaoCartao(v.os, v.etapas, agora, cfg) ?? "")).length;
    expect(r.total).toBe(porSituacao);
  });
  it("motivo, desde quando e quem resolve; impedido vence entrega vencida; o mais antigo primeiro", () => {
    const r = paradosEAtrasados(oss, agora, cfg);
    expect(r.itens.map((i) => [i.v.os.id, i.tipo, i.motivo, i.haQuanto, i.quemResolve])).toEqual([
      ["1", "entrega_vencida", "Entrega prometida passou", "atrasado 2 dias", "producao"],
      ["3", "impedido", "Peça não chegou", "há 2 h", "dono"],
      ["2", "etapa_atrasada", "Pintura passou do prazo", "atrasado 1 h", "producao"],
    ]);
    expect(r.itens[1]).toMatchObject({ entregaVencida: true, responsavelId: "p1" });
  });
});

describe("esperandoSeguradora", () => {
  it("só seguradora aguardando aprovação; há X dias desde o envio; valor orçado sem negados", () => {
    const oss = [
      visao("1", { estado: "aguardando_aprovacao" }, { versoes: [versao({ estado: "enviado", aprovacao: undefined, criadoEm: m("2026-10-07T09:00") })] }),
      visao("2", { estado: "aguardando_aprovacao" }, { versoes: [versao({ estado: "enviado", aprovacao: undefined, criadoEm: m("2026-10-11T09:00") })] }),
      visao("3", { estado: "aguardando_aprovacao", origem: "particular" }),
      visao("4", { estado: "na_oficina" }),
    ];
    const r = esperandoSeguradora(oss, agora);
    expect(r).toMatchObject({ total: 2, maisAntigoDias: 5 });
    expect(r.itens.map((i) => [i.v.os.id, i.seguradora, i.protocolo, i.dias, i.valorOrcado])).toEqual([
      ["1", "HDI", "P-1", 5, 40000],
      ["2", "HDI", "P-2", 1, 40000],
    ]);
  });
});

describe("dinheiroVencido", () => {
  const t = (p: Partial<TituloReceber>): TituloReceber => ({ id: `t${++seq}`, osId: "1", pagadorId: "pg-maxpar", descricao: "x", valor: 10000, vencimento: "2026-10-01", estado: "emitido", baixas: [], ...p });
  const oss = [visao("1", { estado: "entregue" }), visao("2", { estado: "entregue", origem: "particular" }, { atendimentos: [] })];
  it("vencidos com saldo, por quem deve (a seguradora do atendimento, nunca 'Maxpar'; o cliente pelo nome)", () => {
    const titulos = [
      t({ valor: 30000 }),
      t({ valor: 20000, vencimento: "2026-10-05", baixas: [{ id: "b", valor: 5000, recebidoEm: "2026-10-06", forma: "pix" }], estado: "parcial" }),
      t({ osId: "2", pagadorId: "pg-cliente", valor: 8000, vencimento: "2026-10-11" }),
      t({ vencimento: "2026-10-12" }), // vence hoje: ainda não venceu
      t({ estado: "recebido" }),
      t({ estado: "cancelado" }),
    ];
    const r = dinheiroVencido(titulos, pagadores, oss, agora);
    expect(r).toMatchObject({ total: 3, valor: 53000 });
    expect(r.itens.map((i) => [i.saldo, i.diasAtraso, i.devedor.nome])).toEqual([
      [30000, 11, "HDI"],
      [15000, 7, "HDI"],
      [8000, 1, "Cliente 2"],
    ]);
    expect(r.porDevedor).toEqual([
      { tipo: "seguradora", nome: "HDI", valor: 45000, titulos: 2 },
      { tipo: "cliente", nome: "Cliente 2", valor: 8000, titulos: 1 },
    ]);
  });
  it("sem atendimento: seguradora direta pelo nome do pagador; Maxpar vira 'Seguradora'", () => {
    const direta: Pagador = { ...pagadores[0], id: "pg-d", nome: "Porto Seguro", tipo: "seguradora" };
    expect(devedorDoTitulo(t({ pagadorId: "pg-d" }), [...pagadores, direta])).toEqual({ tipo: "seguradora", nome: "Porto Seguro" });
    expect(devedorDoTitulo(t({}), pagadores)).toEqual({ tipo: "seguradora", nome: "Seguradora" });
  });
});

describe("paraAgendar, prontosCobrarFranquia e clienteDeve", () => {
  it("aguardando agendamento, a aprovada há mais tempo primeiro, com telefone e proposta", () => {
    const oss = [
      visao("1", { estado: "aguardando_agendamento" }),
      visao("2", { estado: "aguardando_agendamento" }, { versoes: [versao({ aprovacao: { tipo: "externa", aprovadoEm: m("2026-10-02T10:00"), confiavel: true } })] }),
      visao("3", { estado: "agendada" }),
    ];
    oss[0].cliente.telefone = undefined;
    const proposta: Agendamento = { id: "p", osId: "2", data: "2026-10-13", janela: "manha", estado: "proposto", origem: "calia", expiraEm: m("2026-10-12T12:00") };
    const r = paraAgendar(oss, [proposta], agora);
    expect(r.total).toBe(2);
    expect(r.itens.map((i) => [i.v.os.id, i.dias, i.semTelefone, i.proposta?.id])).toEqual([
      ["2", 10, false, "p"],
      ["1", 2, true, undefined],
    ]);
  });
  it("prontos com franquia ou saldo particular a receber", () => {
    const oss = [visao("1", { estado: "pronta" }), visao("2", { estado: "pronta", origem: "particular" }, { versoes: [versao({ tipo: "interno" })] }), visao("3", { estado: "na_oficina" })];
    const r = prontosCobrarFranquia(oss, pagadores);
    expect(r).toMatchObject({ total: 2, valor: 56000 });
    expect(r.itens.map((i) => [i.v.os.id, i.tipo, i.valor])).toEqual([
      ["2", "servico", 40000],
      ["1", "franquia", 16000],
    ]);
  });
  it("clienteDeve ignora títulos de seguradora e baixas de título cancelado", () => {
    const v = visao("1", { estado: "pronta" }, {
      titulos: [
        { id: "a", osId: "1", pagadorId: "pg-maxpar", descricao: "MO", valor: 24000, vencimento: "2026-11-12", estado: "recebido", baixas: [{ id: "x", valor: 24000, recebidoEm: "2026-10-12", forma: "transferencia" }] },
        { id: "b", osId: "1", pagadorId: "pg-cliente", descricao: "Franquia", valor: 16000, vencimento: "2026-10-12", estado: "cancelado", baixas: [{ id: "y", valor: 16000, recebidoEm: "2026-10-12", forma: "pix" }] },
      ],
    });
    expect(clienteDeve(v, pagadores)).toBe(16000);
  });
});

describe("paraFazerHoje", () => {
  it("cada item com placa, texto curto, quem faz e destino; 'sem telefone' substitui 'agendar'", () => {
    const oss = [
      visao("1", { estado: "entregue" }, { pendencias: [{ id: "pd", osId: "1", tipo: "reenviar_documentacao", descricao: "x", estado: "aberta", criadaEm: m("2026-10-08T10:00") }] }),
      visao("2", { estado: "aguardando_aprovacao" }, { atendimentos: [{ id: "a2", fonte: "manual", seguradora: "HDI", statusNormalizado: "aguardando_autorizacao", limiteVistoriaEm: "2026-10-13", estadoConciliacao: "ok" }] }),
      visao("3", { estado: "aguardando_aprovacao" }, { atendimentos: [{ id: "a3", fonte: "manual", seguradora: "HDI", statusNormalizado: "aguardando_autorizacao", limiteVistoriaEm: "2026-10-16", estadoConciliacao: "ok" }] }),
      visao("4", { estado: "aguardando_agendamento" }),
      visao("5", { estado: "aguardando_agendamento" }),
      visao("6", { estado: "aguardando_agendamento" }),
      visao("7", { estado: "entregue" }, { pendencias: [{ id: "pf", osId: "7", tipo: "encerrar_portal", descricao: "x", estado: "concluida", criadaEm: m("2026-10-08T10:00") }] }),
    ];
    oss[4].cliente.telefone = undefined;
    const ags: Agendamento[] = [{ id: "ag6", osId: "6", data: "2026-10-13", janela: "tarde", estado: "proposto", origem: "calia", expiraEm: m("2026-10-12T15:30") }];
    const r = paraFazerHoje(oss, ags, agora, cfg);
    expect(r.total).toBe(r.itens.length);
    expect(r.itens.map((i) => [i.tipo, i.v.os.id, i.texto, i.quem, i.para])).toEqual([
      ["proposta_expirando", "6", "Horário proposto expira hoje 15h30", "recepcao", "/agenda"],
      ["vistoria_vencendo", "2", "Vistoria vence amanhã", "recepcao", "/orcamentos/2"],
      ["pendencia_portal", "1", "Reenviar documentação no portal · há 4 dias", "recepcao", "/orcamentos/1"],
      ["agendar", "4", "Ligar para agendar · aprovado há 2 dias", "recepcao", "/agenda"],
      ["sem_telefone", "5", "Sem telefone · pedir à seguradora", "recepcao", "/clientes/c-5"],
    ]);
    expect(new Set(r.itens.map((i) => i.chave)).size).toBe(r.total);
  });
  it("vistoria vencida e proposta já expirada continuam na lista", () => {
    const oss = [
      visao("1", { estado: "agendada" }, { atendimentos: [{ id: "a", fonte: "manual", seguradora: "HDI", statusNormalizado: "autorizado", limiteVistoriaEm: "2026-10-10", estadoConciliacao: "ok" }] }),
      visao("2", { estado: "aguardando_agendamento" }),
    ];
    const ags: Agendamento[] = [{ id: "x", osId: "2", data: "2026-10-13", janela: "tarde", estado: "proposto", origem: "calia", expiraEm: m("2026-10-12T09:00") }];
    const textos = paraFazerHoje(oss, ags, agora, cfg).itens.map((i) => i.texto);
    expect(textos).toContain("Vistoria vencida há 2 dias");
    expect(textos).toContain("Horário proposto expirou · remarcar");
    expect(textos).toContain("Ligar para agendar · aprovado há 2 dias"); // a proposta expirada não segura mais o carro
  });
});

// ---------------------------------------------------------------- demonstração: os números do Geral (sistemas-r2 §3)

function visoes(e: EstadoDemo): OSVisao[] {
  return e.oss.map((os) => ({
    os,
    veiculo: e.veiculos.find((v) => v.id === os.veiculoId)!,
    cliente: e.clientes.find((c) => c.id === os.clienteId)!,
    atendimentos: e.atendimentos.filter((a) => os.atendimentosExternos.includes(a.id)),
    versoes: e.versoes.filter((v) => v.osId === os.id),
    etapas: e.etapas.filter((x) => x.osId === os.id),
    pendencias: e.pendencias.filter((p) => p.osId === os.id),
    titulos: e.titulos.filter((t) => t.osId === os.id),
    fotos: [],
    custos: [],
  }));
}

describe("demonstração (quarta 21/10/2026)", () => {
  for (const hora of ["08:30", "10:00", "14:00", "16:30"]) {
    it(`às ${hora}: 8 na oficina, 1 entra, 3 saem, 2 parados, 2 com a seguradora, 2 vencidos, 7 a fazer; no máximo 2 laranja`, () => {
      const agoraDemo = `2026-10-21T${hora}:00-03:00`;
      const e = gerarDemo(paraMs(agoraDemo));
      const oss = visoes(e);
      const na = naOficina(oss, agoraDemo, e.config);
      expect([na.total, na.emServico, na.prontos]).toEqual([8, 6, 2]);
      expect(entramHoje(oss, e.agendamentos, agoraDemo).total).toBe(1);
      expect(saemHoje(oss, agoraDemo, e.config, e.pagadores).total).toBe(3);
      expect(paradosEAtrasados(oss, agoraDemo, e.config).itens.map((i) => i.v.veiculo.placa)).toEqual(["RKP1L34", "RTB2E90"]);
      expect(esperandoSeguradora(oss, agoraDemo).total).toBe(2);
      const venc = dinheiroVencido(e.titulos, e.pagadores, oss, agoraDemo);
      expect([venc.total, venc.valor]).toEqual([2, 156000]);
      expect(venc.porDevedor.map((g) => g.nome)).not.toContain("Maxpar");
      expect(paraFazerHoje(oss, e.agendamentos, agoraDemo, e.config).total).toBe(7);
      const contagem = (s: string) => na.itens.filter((i) => i.situacao === s).length;
      expect(contagem("atencao")).toBeLessThanOrEqual(2);
      expect([contagem("atrasado"), contagem("impedido")]).toEqual([1, 1]);
    });
  }
});

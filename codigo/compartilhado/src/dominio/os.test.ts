import { describe, expect, it } from "vitest";
import type { EtapaOS, OrcamentoVersao, OS, TipoReparo } from "../tipos";
import { CONFIG_PADRAO as cfg } from "./config";
import {
  bloquearEtapa,
  concluirEtapa,
  dispensarEtapa,
  gerarEtapas,
  iniciarEtapa,
  previsaoEntregaSugerida,
  retomarEtapa,
  transicaoOS,
  transicoesPossiveis,
  type ResultadoEtapas,
} from "./os";

const m = (s: string) => `${s}:00-03:00`;
const os = (estado: OS["estado"], extra: Partial<OS> = {}): OS => ({
  id: "os1",
  numero: 1,
  veiculoId: "v1",
  clienteId: "c1",
  origem: "maxpar",
  estado,
  prioridade: 0,
  atendimentosExternos: [],
  criadoEm: m("2026-10-01T08:00"),
  atualizadoEm: m("2026-10-01T08:00"),
  ...extra,
});
const versao = (extra: Partial<OrcamentoVersao> = {}): OrcamentoVersao => ({
  id: "v1",
  osId: "os1",
  tipo: "externo",
  numeroVersao: 1,
  fonte: "manual",
  estado: "aprovado",
  itens: [{ id: "i1", peca: "Capô", tecnica: "martelinho", valor: 50000, statusItem: "autorizado" }],
  criadoEm: m("2026-10-01T08:00"),
  ...extra,
});
const etapasDe = (r: ResultadoEtapas) => {
  if (!r.ok) throw new Error(r.codigo);
  return r.etapas;
};

describe("transicaoOS", () => {
  it("transição fora da tabela → transicao_invalida", () => {
    expect(transicaoOS(os("rascunho"), "na_oficina")).toEqual({ ok: false, codigo: "transicao_invalida" });
    expect(transicaoOS(os("encerrada"), "cancelada", { motivo: "x" })).toEqual({ ok: false, codigo: "transicao_invalida" });
    expect(transicaoOS(os("na_oficina"), "na_oficina")).toEqual({ ok: false, codigo: "transicao_invalida" });
    expect(transicoesPossiveis("cancelada")).toEqual([]);
  });
  it("rascunho → aguardando_aprovacao exige ≥ 1 item", () => {
    expect(transicaoOS(os("rascunho"), "aguardando_aprovacao", { versao: versao() })).toEqual({ ok: true });
    expect(transicaoOS(os("rascunho"), "aguardando_aprovacao", { versao: versao({ itens: [] }) })).toEqual({ ok: false, codigo: "sem_itens" });
    expect(transicaoOS(os("rascunho"), "aguardando_aprovacao")).toEqual({ ok: false, codigo: "sem_itens" });
  });
  it("aprovação só avança se confiável e sem conflito", () => {
    const aprov = (confiavel: boolean) => versao({ aprovacao: { tipo: "externa", aprovadoEm: m("2026-10-02T10:00"), confiavel } });
    expect(transicaoOS(os("aguardando_aprovacao"), "aguardando_agendamento", { versao: aprov(true) })).toEqual({ ok: true });
    expect(transicaoOS(os("aguardando_aprovacao"), "aguardando_agendamento", { versao: aprov(false) })).toEqual({ ok: false, codigo: "aprovacao_nao_confiavel" });
    expect(transicaoOS(os("aguardando_aprovacao"), "aguardando_agendamento", { versao: versao() })).toEqual({ ok: false, codigo: "aprovacao_nao_confiavel" });
    expect(transicaoOS(os("aguardando_aprovacao"), "aguardando_agendamento", { versao: aprov(true), conflitosAbertos: 1 })).toEqual({ ok: false, codigo: "conflito_aberto" });
  });
  it("agendada exige agendamento confirmado", () => {
    expect(transicaoOS(os("aguardando_agendamento"), "agendada", { agendamentoConfirmado: true })).toEqual({ ok: true });
    expect(transicaoOS(os("aguardando_agendamento"), "agendada")).toEqual({ ok: false, codigo: "sem_vaga" });
  });
  it("na_oficina exige tipo de reparo (de agendada ou direto de aguardando_agendamento)", () => {
    expect(transicaoOS(os("agendada"), "na_oficina")).toEqual({ ok: false, codigo: "sem_tipo_reparo" });
    expect(transicaoOS(os("agendada"), "na_oficina", { tipoReparoId: "t1" })).toEqual({ ok: true });
    expect(transicaoOS(os("aguardando_agendamento", { tipoReparoId: "t1" }), "na_oficina")).toEqual({ ok: true });
  });
  it("pronta exige todas as etapas concluídas ou dispensadas", () => {
    const e = (estado: EtapaOS["estado"]) => ({ estado }) as EtapaOS;
    expect(transicaoOS(os("na_oficina"), "pronta", { etapas: [e("concluida"), e("dispensada")] })).toEqual({ ok: true });
    expect(transicaoOS(os("na_oficina"), "pronta", { etapas: [e("concluida"), e("bloqueada")] })).toEqual({ ok: false, codigo: "etapas_pendentes" });
    expect(transicaoOS(os("na_oficina"), "pronta", { etapas: [] })).toEqual({ ok: false, codigo: "etapas_pendentes" });
  });
  it("entregue sem guarda; encerrada exige pendências e títulos resolvidos", () => {
    expect(transicaoOS(os("pronta"), "entregue")).toEqual({ ok: true });
    expect(transicaoOS(os("entregue"), "encerrada", { pendenciasAbertas: 0, titulosAbertos: 0 })).toEqual({ ok: true });
    expect(transicaoOS(os("entregue"), "encerrada", { pendenciasAbertas: 1 })).toEqual({ ok: false, codigo: "pendencias_abertas" });
    expect(transicaoOS(os("entregue"), "encerrada", { titulosAbertos: 2 })).toEqual({ ok: false, codigo: "pendencias_abertas" });
  });
  it("cancelar exige motivo", () => {
    expect(transicaoOS(os("agendada"), "cancelada", { motivo: "  " })).toEqual({ ok: false, codigo: "motivo_obrigatorio" });
    expect(transicaoOS(os("agendada"), "cancelada", { motivo: "cliente desistiu" })).toEqual({ ok: true });
  });
});

const tipo: TipoReparo = {
  id: "t1",
  nome: "Martelinho",
  provisorio: true,
  etapas: [
    { ordem: 2, nome: "Martelinho", prazoPadraoHoras: 4, dispensavel: false, exigeFoto: false, exigeContagemPecas: true },
    { ordem: 1, nome: "Desmontagem", prazoPadraoHoras: 4, dispensavel: true, exigeFoto: false, exigeContagemPecas: false },
    { ordem: 3, nome: "Polimento", prazoPadraoHoras: 2, dispensavel: false, exigeFoto: false, exigeContagemPecas: false },
    { ordem: 4, nome: "Montagem e revisão", prazoPadraoHoras: 4, dispensavel: false, exigeFoto: true, exigeContagemPecas: false },
  ],
};

describe("gerarEtapas", () => {
  it("primeira na fila, demais aguardando, prazos encadeados em horas úteis", () => {
    const etapas = gerarEtapas(tipo, "os1", m("2026-10-12T14:00"), cfg, { pecasPrevistas: 3 });
    expect(etapas.map((e) => [e.id, e.ordem, e.estado, e.prazoEm])).toEqual([
      ["os1-e1", 1, "na_fila", m("2026-10-12T18:00")],
      ["os1-e2", 2, "aguardando", m("2026-10-13T12:00")],
      ["os1-e3", 3, "aguardando", m("2026-10-13T14:00")],
      ["os1-e4", 4, "aguardando", m("2026-10-13T18:00")],
    ]);
    expect(etapas[0].entrouFilaEm).toBe(m("2026-10-12T14:00"));
    expect(etapas[1].entrouFilaEm).toBeUndefined();
    expect(etapas[1].pecasPrevistas).toBe(3);
    expect(etapas[0].pecasPrevistas).toBeUndefined();
    expect(etapas[3].exigeFoto).toBe(true);
    expect(etapas[1].exigeContagemPecas).toBe(true);
  });
  it("entrada na sexta à tarde atravessa o sábado meio período", () => {
    const etapas = gerarEtapas(tipo, "os1", m("2026-10-09T16:00"), cfg, { gerarId: (o) => `x${o}` });
    expect(etapas[0].id).toBe("x1");
    expect(etapas[0].prazoEm).toBe(m("2026-10-10T10:00")); // sex 2 h + sáb 2 h
    expect(etapas[1].prazoEm).toBe(m("2026-10-12T10:00")); // sáb 2 h + seg 2 h
  });
});

describe("previsaoEntregaSugerida", () => {
  it("soma + 20 % e arredonda para o fim do dia útil", () => {
    // 14 h × 1,2 = 16,8 h a partir de seg 08:00 → ter 14:48 → fim de terça
    expect(previsaoEntregaSugerida(tipo, m("2026-10-12T08:00"), cfg)).toEqual({ data: "2026-10-13", fimEm: m("2026-10-13T18:00") });
  });
  it("cai no sábado: fecha ao meio-dia de sábado", () => {
    // sex 16:00 + 16,8 h: sex 2 + sáb 4 = 6; seg 10 = 16; ter 0,8 → terça
    expect(previsaoEntregaSugerida(tipo, m("2026-10-09T16:00"), cfg).data).toBe("2026-10-13");
    const curto: TipoReparo = { ...tipo, etapas: [{ ...tipo.etapas[0], prazoPadraoHoras: 5 }] };
    expect(previsaoEntregaSugerida(curto, m("2026-10-09T16:00"), cfg)).toEqual({ data: "2026-10-10", fimEm: m("2026-10-10T12:00") });
  });
  it("folga configurável e modelo vazio na entrada fora do expediente", () => {
    const vazio: TipoReparo = { ...tipo, etapas: [] };
    expect(previsaoEntregaSugerida(vazio, m("2026-10-10T15:00"), cfg).data).toBe("2026-10-12");
    expect(previsaoEntregaSugerida(tipo, m("2026-10-12T08:00"), cfg, 0).data).toBe("2026-10-13");
  });
});

describe("etapas: iniciar, concluir, bloquear, retomar, dispensar", () => {
  const inicial = () => gerarEtapas(tipo, "os1", m("2026-10-12T08:00"), cfg, { pecasPrevistas: 3 });

  it("iniciar exige na_fila e responsável; não muda a lista original", () => {
    const lista = inicial();
    const r = etapasDe(iniciarEtapa(lista, "os1-e1", "p1", m("2026-10-12T08:30")));
    expect(r[0]).toMatchObject({ estado: "em_execucao", responsavelId: "p1", iniciadaEm: m("2026-10-12T08:30") });
    expect(lista[0].estado).toBe("na_fila");
    expect(iniciarEtapa(lista, "os1-e2", "p1", m("2026-10-12T08:30"))).toEqual({ ok: false, codigo: "transicao_invalida" });
    expect(iniciarEtapa(lista, "os1-e1", "", m("2026-10-12T08:30"))).toEqual({ ok: false, codigo: "sem_responsavel" });
    expect(iniciarEtapa(lista, "nao-existe", "p1", m("2026-10-12T08:30"))).toEqual({ ok: false, codigo: "etapa_nao_encontrada" });
  });

  it("concluir libera a próxima para a fila", () => {
    let l = etapasDe(iniciarEtapa(inicial(), "os1-e1", "p1", m("2026-10-12T08:30")));
    l = etapasDe(concluirEtapa(l, "os1-e1", {}, m("2026-10-12T11:00")));
    expect(l[0]).toMatchObject({ estado: "concluida", concluidaEm: m("2026-10-12T11:00") });
    expect(l[1]).toMatchObject({ estado: "na_fila", entrouFilaEm: m("2026-10-12T11:00") });
    expect(l[2].estado).toBe("aguardando");
  });

  it("concluir só de em_execucao; exige contagem e foto quando a etapa pede", () => {
    let l = etapasDe(iniciarEtapa(inicial(), "os1-e1", "p1", m("2026-10-12T08:30")));
    l = etapasDe(concluirEtapa(l, "os1-e1", {}, m("2026-10-12T09:00")));
    expect(concluirEtapa(l, "os1-e2", { pecasFeitas: 3 }, m("2026-10-12T09:00"))).toEqual({ ok: false, codigo: "transicao_invalida" });
    l = etapasDe(iniciarEtapa(l, "os1-e2", "p1", m("2026-10-12T09:00")));
    expect(concluirEtapa(l, "os1-e2", {}, m("2026-10-12T10:00"))).toEqual({ ok: false, codigo: "contagem_obrigatoria" });
    expect(concluirEtapa(l, "os1-e2", { pecasFeitas: -1 }, m("2026-10-12T10:00"))).toEqual({ ok: false, codigo: "contagem_obrigatoria" });
    expect(concluirEtapa(l, "os1-e2", { pecasFeitas: 1.5 }, m("2026-10-12T10:00"))).toEqual({ ok: false, codigo: "contagem_obrigatoria" });
    l = etapasDe(concluirEtapa(l, "os1-e2", { pecasFeitas: 3 }, m("2026-10-12T10:00")));
    expect(l[1].pecasFeitas).toBe(3);
    l = etapasDe(iniciarEtapa(l, "os1-e3", "p2", m("2026-10-12T10:00")));
    l = etapasDe(concluirEtapa(l, "os1-e3", {}, m("2026-10-12T11:00")));
    l = etapasDe(iniciarEtapa(l, "os1-e4", "p2", m("2026-10-12T11:00")));
    expect(concluirEtapa(l, "os1-e4", {}, m("2026-10-12T12:00"))).toEqual({ ok: false, codigo: "foto_obrigatoria" });
    l = etapasDe(concluirEtapa(l, "os1-e4", { temFoto: true }, m("2026-10-12T12:00")));
    expect(l.every((e) => e.estado === "concluida")).toBe(true);
  });

  it("concluir pula etapa dispensada ao liberar a próxima", () => {
    let l = etapasDe(dispensarEtapa(inicial(), "os1-e2", "martelinho não se aplica", m("2026-10-12T08:10")));
    expect(l[1]).toMatchObject({ estado: "dispensada", motivoDispensa: "martelinho não se aplica" });
    l = etapasDe(iniciarEtapa(l, "os1-e1", "p1", m("2026-10-12T08:30")));
    l = etapasDe(concluirEtapa(l, "os1-e1", {}, m("2026-10-12T09:00")));
    expect(l[2]).toMatchObject({ estado: "na_fila", entrouFilaEm: m("2026-10-12T09:00") });
  });

  it("dispensar exige motivo e estado aguardando/na_fila; na fila libera a próxima", () => {
    expect(dispensarEtapa(inicial(), "os1-e1", "", m("2026-10-12T08:10"))).toEqual({ ok: false, codigo: "motivo_obrigatorio" });
    const l = etapasDe(dispensarEtapa(inicial(), "os1-e1", "sem desmontagem", m("2026-10-12T08:10")));
    expect(l[1]).toMatchObject({ estado: "na_fila", entrouFilaEm: m("2026-10-12T08:10") });
    const exec = etapasDe(iniciarEtapa(inicial(), "os1-e1", "p1", m("2026-10-12T08:30")));
    expect(dispensarEtapa(exec, "os1-e1", "x", m("2026-10-12T09:00"))).toEqual({ ok: false, codigo: "transicao_invalida" });
  });

  it("bloquear exige motivo e em_execucao; retomar fecha o bloqueio", () => {
    let l = etapasDe(iniciarEtapa(inicial(), "os1-e1", "p1", m("2026-10-12T08:30")));
    expect(bloquearEtapa(l, "os1-e1", " ", m("2026-10-12T09:00"))).toEqual({ ok: false, codigo: "motivo_obrigatorio" });
    expect(bloquearEtapa(l, "os1-e2", "x", m("2026-10-12T09:00"))).toEqual({ ok: false, codigo: "transicao_invalida" });
    const antes = l;
    l = etapasDe(bloquearEtapa(l, "os1-e1", "peça do segurado", m("2026-10-12T09:00")));
    expect(l[0].estado).toBe("bloqueada");
    expect(l[0].bloqueios).toEqual([{ inicioEm: m("2026-10-12T09:00"), motivo: "peça do segurado" }]);
    expect(antes[0].bloqueios).toEqual([]);
    expect(concluirEtapa(l, "os1-e1", {}, m("2026-10-12T09:30"))).toEqual({ ok: false, codigo: "transicao_invalida" });
    expect(bloquearEtapa(l, "os1-e1", "de novo", m("2026-10-12T09:30"))).toEqual({ ok: false, codigo: "transicao_invalida" });
    l = etapasDe(retomarEtapa(l, "os1-e1", m("2026-10-12T10:00")));
    expect(l[0].estado).toBe("em_execucao");
    expect(l[0].bloqueios[0].fimEm).toBe(m("2026-10-12T10:00"));
    expect(retomarEtapa(l, "os1-e1", m("2026-10-12T10:30"))).toEqual({ ok: false, codigo: "transicao_invalida" });
  });
});

describe("OS agendada volta para a fila", () => {
  it("cancelamento ou não comparecimento devolve a OS para aguardando_agendamento com motivo", async () => {
    const { transicaoOS } = await import("./os");
    const os = { id: "o", numero: 1, veiculoId: "v", clienteId: "c", origem: "maxpar", estado: "agendada", prioridade: 0, atendimentosExternos: [], criadoEm: "", atualizadoEm: "" } as const;
    expect(transicaoOS({ ...os }, "aguardando_agendamento", { motivo: "Cliente não compareceu" }).ok).toBe(true);
    expect(transicaoOS({ ...os }, "aguardando_agendamento", {})).toEqual({ ok: false, codigo: "motivo_obrigatorio" });
    expect(transicaoOS({ ...os, estado: "na_oficina" }, "aguardando_agendamento", { motivo: "x" })).toEqual({ ok: false, codigo: "transicao_invalida" });
  });
});

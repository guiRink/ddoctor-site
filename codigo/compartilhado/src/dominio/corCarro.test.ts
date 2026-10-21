// Casos do 2º áudio do dono (docs/revisao-sh/pedido-dono-2.md). Quarta 21/10/2026; expediente padrão seg–sáb (sáb até 12h).
import { describe, expect, it } from "vitest";
import type { ConfigOficina, EtapaOS, OS } from "../tipos";
import { ALERTA_CARRO_PADRAO, CONFIG_PADRAO as cfg, aplicarConfig, alertaCarroBase, campoConfigProvisorio } from "./config";
import { aplicarAlertaOS, corDoCarro, entregaPorDiasUteis, piorCorCarro } from "./corCarro";

const m = (s: string) => `${s}:00-03:00`;
const AGORA = m("2026-10-21T10:00"); // quarta

const os = (p: Partial<OS> = {}): OS => ({
  id: "os1",
  numero: 1,
  veiculoId: "v1",
  clienteId: "c1",
  origem: "maxpar",
  estado: "na_oficina",
  prioridade: 0,
  atendimentosExternos: [],
  entradaRealEm: m("2026-10-19T08:30"),
  criadoEm: m("2026-10-15T08:00"),
  atualizadoEm: m("2026-10-19T08:30"),
  ...p,
});
const etapa = (ordem: number, estado: EtapaOS["estado"], p: Partial<EtapaOS> = {}): EtapaOS => ({
  id: `e${ordem}`,
  osId: "os1",
  ordem,
  nome: `Etapa ${ordem}`,
  estado,
  prazoHoras: 4,
  exigeFoto: false,
  bloqueios: [],
  ...p,
});
/** Nenhuma etapa concluída. */
const SEM_ETAPA = [etapa(1, "em_execucao"), etapa(2, "aguardando"), etapa(3, "aguardando")];
/** Uma de três concluída. */
const COM_ETAPA = [etapa(1, "concluida"), etapa(2, "em_execucao"), etapa(3, "aguardando")];
const SEG_A_SEX: ConfigOficina = { ...cfg, expediente: { diasSemana: [1, 2, 3, 4, 5], inicio: "08:00", fim: "18:00" } };

describe("corDoCarro — as frases do dono", () => {
  it("entrega hoje e nenhuma etapa concluída → vermelho", () => {
    expect(corDoCarro(os({ previsaoEntrega: "2026-10-21" }), SEM_ETAPA, AGORA, cfg)).toMatchObject({
      cor: "vermelho",
      motivo: "Entrega hoje e nenhuma etapa concluída",
      diasUteisParaEntrega: 0,
    });
  });
  it("entrega amanhã e nenhuma etapa concluída → vermelho", () => {
    expect(corDoCarro(os({ previsaoEntrega: "2026-10-22" }), SEM_ETAPA, AGORA, cfg)).toMatchObject({
      cor: "vermelho",
      motivo: "Entrega amanhã e nenhuma etapa concluída",
      diasUteisParaEntrega: 1,
    });
  });
  it("entrega amanhã com etapa concluída → laranja (só fica laranja no dia anterior se já tem etapa)", () => {
    expect(corDoCarro(os({ previsaoEntrega: "2026-10-22" }), COM_ETAPA, AGORA, cfg)).toMatchObject({
      cor: "laranja",
      motivo: "Entrega amanhã · 1 de 3 etapas",
      diasUteisParaEntrega: 1,
      etapasConcluidas: 1,
      etapasTotal: 3,
    });
  });
  it("entrega hoje com etapa concluída → laranja", () => {
    expect(corDoCarro(os({ previsaoEntrega: "2026-10-21" }), COM_ETAPA, AGORA, cfg)).toMatchObject({ cor: "laranja", motivo: "Entrega hoje · 1 de 3 etapas" });
  });
  it("passou da entrega → vermelho piscando, com os dias úteis de atraso", () => {
    expect(corDoCarro(os({ previsaoEntrega: "2026-10-19" }), COM_ETAPA, AGORA, cfg)).toMatchObject({
      cor: "vermelho_piscando",
      motivo: "Atrasado 2 dias",
      diasUteisParaEntrega: -2,
    });
    expect(corDoCarro(os({ previsaoEntrega: "2026-10-20" }), SEM_ETAPA, AGORA, cfg)).toMatchObject({ cor: "vermelho_piscando", motivo: "Atrasado 1 dia" });
  });
  it("piscar desligado em Ajustes → atrasado fica vermelho", () => {
    const semPiscar: ConfigOficina = { ...cfg, alertaCarro: { ...ALERTA_CARRO_PADRAO, piscarAtrasado: false } };
    expect(corDoCarro(os({ previsaoEntrega: "2026-10-19" }), COM_ETAPA, AGORA, semPiscar)).toMatchObject({ cor: "vermelho", motivo: "Atrasado 2 dias" });
  });
  it("com folga é verde, mesmo sem etapa (base: 1 dia útil)", () => {
    expect(corDoCarro(os({ previsaoEntrega: "2026-10-23" }), SEM_ETAPA, AGORA, cfg)).toMatchObject({
      cor: "verde",
      motivo: "Entrega em 2 dias úteis · 0 de 3 etapas",
      diasUteisParaEntrega: 2,
    });
  });
  it("mesmo dia vale o dia todo: depois do expediente e na virada da meia-noite", () => {
    expect(corDoCarro(os({ previsaoEntrega: "2026-10-21" }), COM_ETAPA, m("2026-10-21T23:30"), cfg).cor).toBe("laranja");
    expect(corDoCarro(os({ previsaoEntrega: "2026-10-21" }), COM_ETAPA, m("2026-10-22T00:05"), cfg).cor).toBe("vermelho_piscando");
  });
});

describe("corDoCarro — base ajustável e valor por carro", () => {
  it("base da configuração: laranja a 2 dias úteis", () => {
    const c: ConfigOficina = { ...cfg, alertaCarro: { ...ALERTA_CARRO_PADRAO, laranjaDiasAntes: 2 } };
    expect(corDoCarro(os({ previsaoEntrega: "2026-10-23" }), COM_ETAPA, AGORA, c).cor).toBe("laranja");
    expect(corDoCarro(os({ previsaoEntrega: "2026-10-23" }), SEM_ETAPA, AGORA, c).cor).toBe("laranja"); // vermelho sem etapa segue a 1 dia
  });
  it("carro com 10 dias úteis e 'urgente a partir de 3 dias': laranja/vermelho antes da base", () => {
    // entrou seg 12/10; 10 dias úteis (seg–sáb) → sex 23/10
    const carro = os({
      entradaRealEm: m("2026-10-12T09:00"),
      previsaoEntrega: "2026-10-23",
      alerta: { prazoDiasUteis: 10, laranjaDiasAntes: 3, vermelhoSemEtapaDiasAntes: 3 },
    });
    expect(corDoCarro(carro, COM_ETAPA, m("2026-10-19T10:00"), cfg)).toMatchObject({ cor: "verde", diasUteisParaEntrega: 4, personalizado: true });
    expect(corDoCarro(carro, COM_ETAPA, m("2026-10-20T10:00"), cfg)).toMatchObject({ cor: "laranja", motivo: "Entrega em 3 dias úteis · 1 de 3 etapas" });
    expect(corDoCarro(carro, SEM_ETAPA, m("2026-10-20T10:00"), cfg)).toMatchObject({ cor: "vermelho", motivo: "Entrega em 3 dias úteis e nenhuma etapa concluída" });
    // o mesmo carro pela base ficaria verde
    expect(corDoCarro({ ...carro, alerta: undefined }, SEM_ETAPA, m("2026-10-20T10:00"), cfg)).toMatchObject({ cor: "verde", personalizado: false });
  });
  it("só o prazo do carro, sem entrega gravada: a entrega sai da entrada", () => {
    const carro = os({ entradaRealEm: m("2026-10-12T09:00"), alerta: { prazoDiasUteis: 10 } });
    expect(corDoCarro(carro, COM_ETAPA, AGORA, cfg)).toMatchObject({ entrega: "2026-10-23", diasUteisParaEntrega: 2, cor: "verde" });
  });
  it("laranja 0 = só no dia da entrega", () => {
    const carro = os({ previsaoEntrega: "2026-10-22", alerta: { laranjaDiasAntes: 0 } });
    expect(corDoCarro(carro, COM_ETAPA, AGORA, cfg).cor).toBe("verde");
    expect(corDoCarro(carro, COM_ETAPA, m("2026-10-22T08:00"), cfg).cor).toBe("laranja");
  });
});

describe("corDoCarro — fim de semana (dias úteis pelo expediente)", () => {
  it("sexta → segunda com sábado útil: 2 dias úteis, verde", () => {
    expect(corDoCarro(os({ previsaoEntrega: "2026-10-26" }), SEM_ETAPA, m("2026-10-23T15:00"), cfg)).toMatchObject({ cor: "verde", diasUteisParaEntrega: 2 });
  });
  it("sexta → segunda sem sábado no expediente: 1 dia útil, vermelho sem etapa / laranja com etapa", () => {
    expect(corDoCarro(os({ previsaoEntrega: "2026-10-26" }), SEM_ETAPA, m("2026-10-23T15:00"), SEG_A_SEX)).toMatchObject({
      cor: "vermelho",
      motivo: "Entrega segunda e nenhuma etapa concluída",
      diasUteisParaEntrega: 1,
    });
    expect(corDoCarro(os({ previsaoEntrega: "2026-10-26" }), COM_ETAPA, m("2026-10-23T15:00"), SEG_A_SEX).cor).toBe("laranja");
  });
  it("domingo → segunda é amanhã", () => {
    expect(corDoCarro(os({ previsaoEntrega: "2026-10-26" }), COM_ETAPA, m("2026-10-25T10:00"), cfg)).toMatchObject({ cor: "laranja", motivo: "Entrega amanhã · 1 de 3 etapas" });
  });
  it("atraso conta dias úteis, no mínimo 1 (sexta → domingo sem sábado útil)", () => {
    expect(corDoCarro(os({ previsaoEntrega: "2026-10-24" }), COM_ETAPA, m("2026-10-26T09:00"), cfg).motivo).toBe("Atrasado 1 dia");
    expect(corDoCarro(os({ previsaoEntrega: "2026-10-23" }), COM_ETAPA, m("2026-10-25T09:00"), SEG_A_SEX)).toMatchObject({ motivo: "Atrasado 1 dia", diasUteisParaEntrega: -1 });
  });
});

describe("corDoCarro — o que não muda a cor", () => {
  it("impedimento não muda a cor (Parado é selo à parte)", () => {
    const bloqueada = [etapa(1, "concluida"), etapa(2, "bloqueada", { bloqueios: [{ inicioEm: m("2026-10-20T09:00"), motivo: "Peça" }] }), etapa(3, "aguardando")];
    expect(corDoCarro(os({ previsaoEntrega: "2026-10-24" }), bloqueada, AGORA, cfg).cor).toBe("verde");
    expect(corDoCarro(os({ previsaoEntrega: "2026-10-22" }), bloqueada, AGORA, cfg).cor).toBe("laranja");
  });
  it("etapa dispensada não conta como concluída", () => {
    const dispensada = [etapa(1, "dispensada"), etapa(2, "na_fila"), etapa(3, "aguardando")];
    expect(corDoCarro(os({ previsaoEntrega: "2026-10-22" }), dispensada, AGORA, cfg)).toMatchObject({ cor: "vermelho", etapasConcluidas: 0, etapasTotal: 2 });
  });
  it("etapas de outra OS são ignoradas", () => {
    const outra = [etapa(1, "concluida", { osId: "os2" }), ...SEM_ETAPA];
    expect(corDoCarro(os({ previsaoEntrega: "2026-10-22" }), outra, AGORA, cfg).cor).toBe("vermelho");
  });
  it("pronto → verde 'Pronto'; fora da oficina → verde; sem entrega → verde 'Sem data de entrega'", () => {
    expect(corDoCarro(os({ estado: "pronta", previsaoEntrega: "2026-10-19" }), COM_ETAPA, AGORA, cfg)).toMatchObject({ cor: "verde", motivo: "Pronto", diasUteisParaEntrega: null });
    expect(corDoCarro(os({ estado: "agendada", previsaoEntrega: "2026-10-19" }), [], AGORA, cfg)).toMatchObject({ cor: "verde", motivo: "Fora da oficina" });
    expect(corDoCarro(os({}), SEM_ETAPA, AGORA, cfg)).toMatchObject({ cor: "verde", motivo: "Sem data de entrega", diasUteisParaEntrega: null });
  });
  it("piorCorCarro", () => {
    expect(piorCorCarro()).toBe("verde");
    expect(piorCorCarro("laranja", "vermelho_piscando", "vermelho")).toBe("vermelho_piscando");
  });
});

describe("entregaPorDiasUteis", () => {
  it("10 dias úteis de seg 12/10 (seg–sáb) → sex 23/10; o dia da entrada é o dia 0", () => {
    expect(entregaPorDiasUteis(m("2026-10-12T09:00"), 10, cfg)).toBe("2026-10-23");
    expect(entregaPorDiasUteis("2026-10-12", 1, cfg)).toBe("2026-10-13");
  });
  it("sem sábado no expediente pula o fim de semana", () => {
    expect(entregaPorDiasUteis("2026-10-12", 10, SEG_A_SEX)).toBe("2026-10-26");
    expect(entregaPorDiasUteis("2026-10-23", 1, SEG_A_SEX)).toBe("2026-10-26");
  });
  it("sexta 1 dia útil com sábado útil → sábado; 0 dias = o próprio dia (ou o próximo útil)", () => {
    expect(entregaPorDiasUteis("2026-10-23", 1, cfg)).toBe("2026-10-24");
    expect(entregaPorDiasUteis("2026-10-21", 0, cfg)).toBe("2026-10-21");
    expect(entregaPorDiasUteis("2026-10-25", 0, cfg)).toBe("2026-10-26"); // domingo
  });
  it("marco à noite usa a data do fuso da oficina", () => {
    expect(entregaPorDiasUteis("2026-10-21T23:30:00-03:00", 1, cfg)).toBe("2026-10-22");
    expect(entregaPorDiasUteis("2026-10-22T01:30:00Z", 1, cfg)).toBe("2026-10-22"); // 21/10 22h30 em Curitiba
  });
  it("dias negativos ou fracionados → erro", () => {
    expect(() => entregaPorDiasUteis("2026-10-21", -1, cfg)).toThrow();
    expect(() => entregaPorDiasUteis("2026-10-21", 1.5, cfg)).toThrow();
  });
});

describe("aplicarAlertaOS", () => {
  it("prazo de 10 dias úteis recalcula a entrega a partir da entrada", () => {
    const r = aplicarAlertaOS(os({ entradaRealEm: m("2026-10-12T09:00"), previsaoEntrega: "2026-10-20" }), { prazoDiasUteis: 10, laranjaDiasAntes: 3 }, AGORA, cfg);
    expect(r).toMatchObject({ ok: true, mudanca: { previsaoEntrega: "2026-10-23", alerta: { prazoDiasUteis: 10, laranjaDiasAntes: 3 }, prioridade: 0 } });
  });
  it("carro que ainda não entrou: prazo conta de hoje", () => {
    const r = aplicarAlertaOS(os({ estado: "agendada", entradaRealEm: undefined }), { prazoDiasUteis: 5 }, AGORA, cfg);
    expect(r.ok && r.mudanca.previsaoEntrega).toBe("2026-10-27"); // qui, sex, sáb, seg, ter
  });
  it("urgente liga prioridade 2; desligar volta a 0; prioridade alta (1) fica", () => {
    expect(aplicarAlertaOS(os(), { urgente: true }, AGORA, cfg)).toMatchObject({ ok: true, mudanca: { prioridade: 2 } });
    expect(aplicarAlertaOS(os({ prioridade: 2 }), { urgente: false }, AGORA, cfg)).toMatchObject({ ok: true, mudanca: { prioridade: 0 } });
    expect(aplicarAlertaOS(os({ prioridade: 1 }), { urgente: false }, AGORA, cfg)).toMatchObject({ ok: true, mudanca: { prioridade: 1 } });
  });
  it("só urgente não mexe na entrega nem no alerta", () => {
    const r = aplicarAlertaOS(os({ previsaoEntrega: "2026-10-22", alerta: { laranjaDiasAntes: 2 } }), { urgente: true }, AGORA, cfg);
    expect(r).toMatchObject({ ok: true, mudanca: { previsaoEntrega: "2026-10-22", alerta: { laranjaDiasAntes: 2 } } });
  });
  it("null volta o campo para a base (sem nada próprio, alerta some)", () => {
    const r = aplicarAlertaOS(os({ alerta: { laranjaDiasAntes: 3 } }), { laranjaDiasAntes: null }, AGORA, cfg);
    expect(r.ok && r.mudanca.alerta).toBeUndefined();
  });
  it("valida inteiros 0–60 e diz o campo", () => {
    expect(aplicarAlertaOS(os(), { prazoDiasUteis: 61 }, AGORA, cfg)).toEqual({ ok: false, codigo: "valor_invalido", campo: "prazoDiasUteis" });
    expect(aplicarAlertaOS(os(), { laranjaDiasAntes: -1 }, AGORA, cfg)).toEqual({ ok: false, codigo: "valor_invalido", campo: "laranjaDiasAntes" });
    expect(aplicarAlertaOS(os(), { vermelhoSemEtapaDiasAntes: 1.5 }, AGORA, cfg)).toEqual({ ok: false, codigo: "valor_invalido", campo: "vermelhoSemEtapaDiasAntes" });
    expect(aplicarAlertaOS(os(), { laranjaDiasAntes: "3" as unknown as number }, AGORA, cfg)).toMatchObject({ ok: false, codigo: "valor_invalido" });
    expect(aplicarAlertaOS(os(), { prazoDiasUteis: 0 }, AGORA, cfg).ok).toBe(true);
    expect(aplicarAlertaOS(os(), { prazoDiasUteis: 60 }, AGORA, cfg).ok).toBe(true);
  });
  it("OS entregue, encerrada ou cancelada → transicao_invalida; nada → nada_a_salvar", () => {
    for (const estado of ["entregue", "encerrada", "cancelada"] as const)
      expect(aplicarAlertaOS(os({ estado }), { urgente: true }, AGORA, cfg)).toEqual({ ok: false, codigo: "transicao_invalida" });
    expect(aplicarAlertaOS(os(), {}, AGORA, cfg)).toEqual({ ok: false, codigo: "nada_a_salvar" });
  });
});

describe("configuração do alerta (Ajustes)", () => {
  it("padrão provisório: 1 / 1 / pisca / 10 dias úteis", () => {
    expect(alertaCarroBase(cfg)).toEqual({ laranjaDiasAntes: 1, vermelhoSemEtapaDiasAntes: 1, piscarAtrasado: true, prazoPadraoDiasUteis: 10 });
    expect(campoConfigProvisorio(cfg, "alertaCarro")).toBe(true);
  });
  it("salvar marca confirmado e mantém o que não veio", () => {
    const r = aplicarConfig(cfg, { alertaCarro: { laranjaDiasAntes: 3, piscarAtrasado: false } });
    expect(r.ok && r.config.alertaCarro).toEqual({ laranjaDiasAntes: 3, vermelhoSemEtapaDiasAntes: 1, piscarAtrasado: false, prazoPadraoDiasUteis: 10 });
    expect(r.ok && r.campos).toEqual(["alertaCarro"]);
    expect(r.ok && campoConfigProvisorio(r.config, "alertaCarro")).toBe(false);
  });
  it("recusa fora dos limites", () => {
    expect(aplicarConfig(cfg, { alertaCarro: { laranjaDiasAntes: 61 } })).toEqual({ ok: false, codigo: "valor_invalido", campo: "laranjaDiasAntes" });
    expect(aplicarConfig(cfg, { alertaCarro: { vermelhoSemEtapaDiasAntes: -1 } })).toEqual({ ok: false, codigo: "valor_invalido", campo: "vermelhoSemEtapaDiasAntes" });
    expect(aplicarConfig(cfg, { alertaCarro: { prazoPadraoDiasUteis: 0 } })).toEqual({ ok: false, codigo: "valor_invalido", campo: "prazoPadraoDiasUteis" });
    expect(aplicarConfig(cfg, { alertaCarro: { piscarAtrasado: "sim" as unknown as boolean } })).toEqual({ ok: false, codigo: "valor_invalido", campo: "piscarAtrasado" });
    expect(aplicarConfig(cfg, { alertaCarro: {} })).toEqual({ ok: false, codigo: "nada_a_salvar" });
  });
  it("valor gravado fora do limite cai no padrão ao ler", () => {
    expect(alertaCarroBase({ alertaCarro: { laranjaDiasAntes: 99, vermelhoSemEtapaDiasAntes: 2, piscarAtrasado: false } })).toEqual({
      laranjaDiasAntes: 1,
      vermelhoSemEtapaDiasAntes: 2,
      piscarAtrasado: false,
      prazoPadraoDiasUteis: 10,
    });
  });
});

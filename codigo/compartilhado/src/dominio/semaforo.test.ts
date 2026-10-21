import { describe, expect, it } from "vitest";
import type { EtapaOS, OS } from "../tipos";
import { CONFIG_PADRAO as cfg } from "./config";
import {
  cargaAteEntrega,
  etapaAtual,
  fracaoPrazoEtapa,
  piorSemaforo,
  progressoEtapas,
  semaforoEtapa,
  semaforoOS,
  situacaoCartao,
  trabalhoRestanteHoras,
} from "./semaforo";

const m = (s: string) => `${s}:00-03:00`;
const etapa = (p: Partial<EtapaOS>): EtapaOS => ({
  id: `e${p.ordem ?? 1}`,
  osId: "os1",
  ordem: 1,
  nome: "Etapa",
  estado: "em_execucao",
  prazoHoras: 4,
  exigeFoto: false,
  bloqueios: [],
  ...p,
});
const os: OS = {
  id: "os1",
  numero: 1,
  veiculoId: "v1",
  clienteId: "c1",
  origem: "maxpar",
  estado: "na_oficina",
  prioridade: 0,
  atendimentosExternos: [],
  criadoEm: m("2026-10-01T08:00"),
  atualizadoEm: m("2026-10-01T08:00"),
};

describe("semaforoEtapa", () => {
  it("neutro para aguardando, concluída e dispensada", () => {
    for (const estado of ["aguardando", "concluida", "dispensada"] as const)
      expect(semaforoEtapa(etapa({ estado, prazoEm: m("2026-10-01T10:00") }), m("2026-10-12T10:00"), cfg)).toBe("neutro");
  });
  it("verde com folga, sem prazo também", () => {
    expect(semaforoEtapa(etapa({ prazoEm: m("2026-10-13T12:00") }), m("2026-10-12T09:00"), cfg)).toBe("verde");
    expect(semaforoEtapa(etapa({}), m("2026-10-12T09:00"), cfg)).toBe("verde");
  });
  it("laranja a partir de 80 % do prazo da etapa (horas úteis), não mais a 8 h do prazo", () => {
    // etapa de 4 h com prazo seg 12h: às 9h restam 3 h (25 %); às 11h12 restam 0,8 h (80 %)
    const e = etapa({ prazoHoras: 4, prazoEm: m("2026-10-12T12:00") });
    expect(semaforoEtapa(e, m("2026-10-12T09:00"), cfg)).toBe("verde");
    expect(semaforoEtapa(e, m("2026-10-12T11:11"), cfg)).toBe("verde");
    expect(semaforoEtapa(e, m("2026-10-12T11:12"), cfg)).toBe("laranja");
  });
  it("etapa curta na fila com prazo folgado não nasce laranja", () => {
    // 2 h de prazo, faltando 5 h úteis: pela regra antiga (< 8 h) seria laranja
    expect(semaforoEtapa(etapa({ estado: "na_fila", prazoHoras: 2, prazoEm: m("2026-10-12T14:00") }), m("2026-10-12T09:00"), cfg)).toBe("verde");
  });
  it("fim de semana e sábado meio período: domingo não consome prazo", () => {
    // prazo seg 9h, etapa de 4 h: sáb 11h30 → 0,5 (sáb) + 1 (seg) = 1,5 h restantes (62,5 %)
    const e = etapa({ prazoHoras: 4, prazoEm: m("2026-10-12T09:00") });
    expect(semaforoEtapa(e, m("2026-10-10T11:30"), cfg)).toBe("verde");
    expect(semaforoEtapa(e, m("2026-10-11T20:00"), cfg)).toBe("verde"); // domingo: resta 1 h (75 %)
    expect(semaforoEtapa(e, m("2026-10-12T08:12"), cfg)).toBe("laranja"); // seg 8h12: 0,8 h (80 %)
  });
  it("fração configurável; fora de (0, 1] usa o padrão 0,8", () => {
    const e = etapa({ prazoHoras: 4, prazoEm: m("2026-10-12T12:00") });
    const metade = { ...cfg, semaforo: { ...cfg.semaforo, laranjaFracao: 0.5 } };
    expect(semaforoEtapa(e, m("2026-10-12T10:00"), metade)).toBe("laranja");
    const invalida = { ...cfg, semaforo: { ...cfg.semaforo, laranjaFracao: 1.5 } };
    expect(semaforoEtapa(e, m("2026-10-12T10:00"), invalida)).toBe("verde");
    const semCampo = { ...cfg, semaforo: { laranjaAntesHoras: 8, vermelhoBloqueioHoras: 4 } };
    expect(semaforoEtapa(e, m("2026-10-12T11:12"), semCampo)).toBe("laranja");
  });
  it("etapa sem prazoHoras cai na regra antiga de laranjaAntesHoras", () => {
    const e = etapa({ prazoHoras: 0, prazoEm: m("2026-10-12T16:00") });
    expect(semaforoEtapa(e, m("2026-10-12T09:00"), cfg)).toBe("laranja"); // 7 h < 8 h
    expect(semaforoEtapa(e, m("2026-10-09T17:00"), cfg)).toBe("verde"); // 1 + 4 + 8 = 13 h
  });
  it("exatamente no prazo ainda não venceu (laranja); um minuto depois é vermelho", () => {
    expect(semaforoEtapa(etapa({ prazoEm: m("2026-10-12T10:00") }), m("2026-10-12T10:00"), cfg)).toBe("laranja");
    expect(semaforoEtapa(etapa({ prazoEm: m("2026-10-12T10:00") }), m("2026-10-12T10:01"), cfg)).toBe("vermelho");
  });
  it("na fila também tem cor", () => {
    expect(semaforoEtapa(etapa({ estado: "na_fila", prazoEm: m("2026-10-12T08:00") }), m("2026-10-12T09:00"), cfg)).toBe("vermelho");
  });
  it("bloqueio aberto há mais de 4 h úteis → vermelho; fechado não conta", () => {
    const bloq = (fimEm?: string) =>
      etapa({ estado: "bloqueada", prazoEm: m("2026-10-20T10:00"), bloqueios: [{ inicioEm: m("2026-10-12T09:00"), fimEm, motivo: "peça" }] });
    expect(semaforoEtapa(bloq(), m("2026-10-12T13:00"), cfg)).toBe("verde");
    expect(semaforoEtapa(bloq(), m("2026-10-12T13:01"), cfg)).toBe("vermelho");
    expect(semaforoEtapa(bloq(m("2026-10-12T10:00")), m("2026-10-12T15:00"), cfg)).toBe("verde");
  });
  it("bloqueio de sexta à noite não fica vermelho no fim de semana sem expediente", () => {
    const e = etapa({ estado: "bloqueada", bloqueios: [{ inicioEm: m("2026-10-10T11:00"), motivo: "x" }] });
    expect(semaforoEtapa(e, m("2026-10-11T20:00"), cfg)).toBe("verde"); // 1 h útil (sáb 11–12)
  });
});

describe("fracaoPrazoEtapa", () => {
  const e = etapa({ prazoHoras: 4, prazoEm: m("2026-10-12T12:00") });
  it("0 antes da janela, 1 no prazo, passa de 1 depois", () => {
    expect(fracaoPrazoEtapa(e, m("2026-10-09T09:00"), cfg)).toBe(0);
    expect(fracaoPrazoEtapa(e, m("2026-10-12T10:00"), cfg)).toBe(0.5);
    expect(fracaoPrazoEtapa(e, m("2026-10-12T12:00"), cfg)).toBe(1);
    expect(fracaoPrazoEtapa(e, m("2026-10-12T14:00"), cfg)).toBe(1.5);
  });
  it("sem prazoEm ou sem prazoHoras → null", () => {
    expect(fracaoPrazoEtapa(etapa({}), m("2026-10-12T10:00"), cfg)).toBeNull();
    expect(fracaoPrazoEtapa(etapa({ prazoHoras: 0, prazoEm: m("2026-10-12T12:00") }), m("2026-10-12T10:00"), cfg)).toBeNull();
  });
});

describe("etapaAtual e progressoEtapas", () => {
  const lista = [
    etapa({ ordem: 3, estado: "aguardando" }),
    etapa({ ordem: 1, estado: "concluida" }),
    etapa({ ordem: 2, estado: "dispensada" }),
    etapa({ ordem: 4, estado: "na_fila" }),
  ];
  it("primeira ativa por ordem", () => {
    expect(etapaAtual(lista)?.ordem).toBe(4);
    expect(etapaAtual([etapa({ estado: "concluida" })])).toBeNull();
  });
  it("progresso ignora dispensadas", () => {
    expect(progressoEtapas(lista)).toEqual({ concluidas: 1, total: 3, atualIndex: 2 });
    expect(progressoEtapas([])).toEqual({ concluidas: 0, total: 0, atualIndex: null });
  });
});

describe("semaforoOS", () => {
  // seg 12/10 9h: etapa atual de 4 h vence às 12h (restam 3 h, 25 %) e falta uma de 4 h → 7 h de trabalho
  const etapas = [
    etapa({ ordem: 1, estado: "concluida" }),
    etapa({ ordem: 2, estado: "em_execucao", prazoHoras: 4, prazoEm: m("2026-10-12T12:00") }),
    etapa({ ordem: 3, estado: "aguardando", prazoHoras: 4 }),
  ];
  const seg9 = m("2026-10-12T09:00");
  it("fora de na_oficina → neutro", () => {
    expect(semaforoOS({ ...os, estado: "agendada" }, etapas, seg9, cfg)).toBe("neutro");
    expect(semaforoOS({ ...os, estado: "pronta" }, etapas, seg9, cfg)).toBe("neutro");
  });
  it("verde com prazo e previsão folgados", () => {
    expect(semaforoOS({ ...os, previsaoEntrega: "2026-10-16" }, etapas, seg9, cfg)).toBe("verde");
  });
  it("entrega hoje com etapas restantes → laranja", () => {
    expect(semaforoOS({ ...os, previsaoEntrega: "2026-10-12" }, etapas, seg9, cfg)).toBe("laranja");
  });
  it("entrega amanhã: laranja só quando o trabalho restante passa de 80 % das horas úteis até lá", () => {
    // 7 h de trabalho ÷ 19 h úteis (9 h hoje + 10 h amanhã) = 37 %: verde
    expect(semaforoOS({ ...os, previsaoEntrega: "2026-10-13" }, etapas, seg9, cfg)).toBe("verde");
    // + 12 h aguardando → 19 h ÷ 19 h = 100 %: laranja
    const apertada = [...etapas, etapa({ ordem: 4, estado: "aguardando", prazoHoras: 12 })];
    expect(semaforoOS({ ...os, previsaoEntrega: "2026-10-13" }, apertada, seg9, cfg)).toBe("laranja");
  });
  it("sábado meio período: entrega na segunda é 'amanhã' (domingo não é útil)", () => {
    // sáb 9h: 3 h no sábado + 10 h na segunda = 13 h úteis
    const sab9 = m("2026-10-10T09:00");
    const leve = [etapa({ estado: "em_execucao", prazoHoras: 4, prazoEm: m("2026-10-12T09:00") })]; // restam 4 h
    expect(semaforoOS({ ...os, previsaoEntrega: "2026-10-12" }, leve, sab9, cfg)).toBe("verde"); // 4/13
    const pesada = [...leve, etapa({ ordem: 2, estado: "aguardando", prazoHoras: 7 })]; // 11/13 = 85 %
    expect(semaforoOS({ ...os, previsaoEntrega: "2026-10-12" }, pesada, sab9, cfg)).toBe("laranja");
    // sexta → segunda são 2 dias úteis (sábado é útil): não é "amanhã"
    expect(semaforoOS({ ...os, previsaoEntrega: "2026-10-12" }, pesada, m("2026-10-09T09:00"), cfg)).toBe("verde");
  });
  it("sem etapas restantes a previsão de hoje não pinta laranja", () => {
    const feitas = [etapa({ estado: "concluida" })];
    expect(semaforoOS({ ...os, previsaoEntrega: "2026-10-12" }, feitas, seg9, cfg)).toBe("verde");
  });
  it("previsão vencida → vermelho, mesmo com etapas em dia", () => {
    expect(semaforoOS({ ...os, previsaoEntrega: "2026-10-09" }, etapas, seg9, cfg)).toBe("vermelho");
  });
  it("etapa vencida → vermelho; ignora etapas de outra OS", () => {
    const vencida = [etapa({ prazoEm: m("2026-10-12T08:30") })];
    expect(semaforoOS(os, vencida, seg9, cfg)).toBe("vermelho");
    expect(semaforoOS(os, vencida.map((e) => ({ ...e, osId: "outra" })), seg9, cfg)).toBe("verde");
  });
  it("piorSemaforo", () => {
    expect(piorSemaforo("verde", "neutro", "laranja")).toBe("laranja");
    expect(piorSemaforo()).toBe("neutro");
  });
});

describe("trabalhoRestanteHoras e cargaAteEntrega", () => {
  const lista = [
    etapa({ ordem: 1, estado: "concluida", prazoHoras: 2 }),
    etapa({ ordem: 2, estado: "em_execucao", prazoHoras: 4, prazoEm: m("2026-10-12T10:00") }), // restam 1 h
    etapa({ ordem: 3, estado: "aguardando", prazoHoras: 3 }),
    etapa({ ordem: 4, estado: "dispensada", prazoHoras: 5 }),
  ];
  it("conta o que falta da etapa atual (no máximo o prazo dela) e as aguardando", () => {
    expect(trabalhoRestanteHoras(lista, m("2026-10-12T09:00"), cfg)).toBe(4);
    // etapa com prazo bem à frente conta só o próprio prazo
    expect(trabalhoRestanteHoras([etapa({ prazoHoras: 2, prazoEm: m("2026-10-14T10:00") })], m("2026-10-12T09:00"), cfg)).toBe(2);
  });
  it("carga = trabalho ÷ horas úteis até o fim do dia prometido; sem tempo → Infinity; sem trabalho → 0", () => {
    expect(cargaAteEntrega(lista, "2026-10-12", m("2026-10-12T10:00"), cfg)).toBeCloseTo(3 / 8);
    expect(cargaAteEntrega(lista, "2026-10-12", m("2026-10-12T19:00"), cfg)).toBe(Number.POSITIVE_INFINITY);
    expect(cargaAteEntrega([etapa({ estado: "concluida" })], "2026-10-12", m("2026-10-12T10:00"), cfg)).toBe(0);
  });
});

describe("situacaoCartao", () => {
  const seg9 = m("2026-10-12T09:00");
  const comPrazo = (prazo: string, p: Partial<EtapaOS> = {}) => [etapa({ prazoHoras: 4, prazoEm: m(prazo), ...p })];
  it("pronta → pronto; fora da oficina → null", () => {
    expect(situacaoCartao({ ...os, estado: "pronta" }, [], seg9, cfg)).toBe("pronto");
    expect(situacaoCartao({ ...os, estado: "agendada" }, [], seg9, cfg)).toBeNull();
    expect(situacaoCartao({ ...os, estado: "entregue" }, [], seg9, cfg)).toBeNull();
  });
  it("impedido vence atrasado e atenção (uma pílula só)", () => {
    const bloqueada = comPrazo("2026-10-12T08:30", { estado: "bloqueada", bloqueios: [{ inicioEm: m("2026-10-12T08:45"), motivo: "peça" }] });
    expect(situacaoCartao({ ...os, previsaoEntrega: "2026-10-09" }, bloqueada, seg9, cfg)).toBe("impedido");
  });
  it("atrasado, atenção e no prazo pelo semáforo", () => {
    expect(situacaoCartao(os, comPrazo("2026-10-12T08:30"), seg9, cfg)).toBe("atrasado");
    expect(situacaoCartao(os, comPrazo("2026-10-12T09:30"), seg9, cfg)).toBe("atencao");
    expect(situacaoCartao({ ...os, previsaoEntrega: "2026-10-12" }, comPrazo("2026-10-12T15:00"), seg9, cfg)).toBe("atencao");
    expect(situacaoCartao({ ...os, previsaoEntrega: "2026-10-14" }, comPrazo("2026-10-12T15:00"), seg9, cfg)).toBe("no_prazo");
  });
  it("bloqueio aberto em etapa de outra OS não conta", () => {
    const outra = comPrazo("2026-10-12T15:00", { osId: "outra", estado: "bloqueada" });
    expect(situacaoCartao(os, outra, seg9, cfg)).toBe("no_prazo");
  });
});

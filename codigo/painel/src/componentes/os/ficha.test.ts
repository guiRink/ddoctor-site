import { describe, expect, it } from "vitest";
import type { EstadoEtapa, EtapaOS, OrcamentoVersao, OS, Pagador, TituloReceber } from "@compartilhado/tipos";
import type { OSVisao } from "../../dados/repositorio";
import { acaoPrimariaDoTopo, clienteDeve, faltasParaEntregar, numerosEtapas, prometidoAoCliente, textoEtapas, textoFaltaCliente } from "./ficha";

const AGORA = "2026-10-21T10:00:00-03:00";
const PAGADORES: Pagador[] = [
  { id: "pg-cliente", nome: "Cliente", tipo: "cliente", prazo: { dias: 0, base: "entrega", diasUteis: false, provisorio: true } },
  { id: "pg-hdi", nome: "HDI", tipo: "seguradora", prazo: { dias: 30, base: "nf", diasUteis: false, provisorio: true } },
];

function versao(extra: Partial<OrcamentoVersao> = {}): OrcamentoVersao {
  return {
    id: "ver-1",
    osId: "os-1",
    tipo: "externo",
    numeroVersao: 1,
    fonte: "manual",
    estado: "aprovado",
    itens: [{ id: "i1", peca: "Capô", tecnica: "martelinho", valor: 42000, statusItem: "autorizado" }],
    criadoEm: "2026-10-10T09:00:00-03:00",
    ...extra,
  };
}

function titulo(valor: number, pago: number, pagadorId = "pg-cliente"): TituloReceber {
  return {
    id: `t-${valor}-${pago}-${pagadorId}`,
    osId: "os-1",
    pagadorId,
    descricao: "Franquia",
    valor,
    vencimento: "2026-10-21",
    estado: pago >= valor ? "recebido" : pago > 0 ? "parcial" : "emitido",
    baixas: pago > 0 ? [{ id: "b", valor: pago, recebidoEm: "2026-10-21", forma: "pix" }] : [],
  };
}

function visao(extra: Partial<OSVisao> = {}, osExtra: Partial<OS> = {}): OSVisao {
  return {
    os: {
      id: "os-1",
      numero: 1001,
      veiculoId: "v-1",
      clienteId: "c-1",
      origem: "maxpar",
      estado: "na_oficina",
      prioridade: 0,
      atendimentosExternos: [],
      criadoEm: "2026-10-10T09:00:00-03:00",
      atualizadoEm: "2026-10-20T09:00:00-03:00",
      ...osExtra,
    },
    veiculo: { id: "v-1", placa: "RJC8T15" },
    cliente: { id: "c-1", nome: "Cliente Exemplo" },
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

function etapa(ordem: number, estado: EstadoEtapa): EtapaOS {
  return { id: `e${ordem}`, osId: "os-1", ordem, nome: `Etapa ${ordem}`, estado, prazoHoras: 2, exigeFoto: false, bloqueios: [] };
}

describe("clienteDeve", () => {
  it("cobra a franquia desde a entrada, sem título nenhum", () => {
    const d = clienteDeve(visao({ versoes: [versao({ franquia: 16000 })] }), PAGADORES)!;
    expect(d.total).toBe(16000);
    expect(d.pago).toBe(0);
    expect(d.falta).toBe(16000);
    expect(d.partes).toEqual([{ nome: "Franquia", valor: 16000 }]);
    expect(textoFaltaCliente(d)).toBe("Franquia de R$ 160,00 não paga");
  });

  it("soma franquia e complemento e desconta o que o cliente já pagou", () => {
    const d = clienteDeve(
      visao({ versoes: [versao({ franquia: 16000, complementoParticular: 30000 })], titulos: [titulo(16000, 16000), titulo(42000, 0, "pg-hdi")] }),
      PAGADORES,
    )!;
    expect(d.total).toBe(46000);
    expect(d.pago).toBe(16000);
    expect(d.falta).toBe(30000);
    expect(textoFaltaCliente(d)).toBe("Faltam R$ 300,00 do cliente (franquia e complemento)");
  });

  it("particular deve o valor aprovado; sinal pago entra como pago", () => {
    const d = clienteDeve(
      visao({ versoes: [versao({ tipo: "interno", itens: [{ id: "i", peca: "Capô", tecnica: "pintura", valor: 230000, statusItem: "solicitado" }] })], titulos: [titulo(230000, 100000)] }, { origem: "particular" }),
      PAGADORES,
    )!;
    expect(d.partes).toEqual([{ nome: "Serviço particular", valor: 230000 }]);
    expect(d.falta).toBe(130000);
    expect(textoFaltaCliente(d)).toBe("Serviço particular: faltam R$ 1.300,00");
  });

  it("seguradora sem franquia: nada a pagar; sem orçamento aprovado: null", () => {
    const d = clienteDeve(visao({ versoes: [versao()] }), PAGADORES)!;
    expect(d.semFranquia).toBe(true);
    expect(d.falta).toBe(0);
    expect(clienteDeve(visao({ versoes: [versao({ estado: "enviado" })] }), PAGADORES)).toBeNull();
  });
});

describe("prometidoAoCliente", () => {
  it("hoje, amanhã, em N dias e atrasado N dias", () => {
    expect(prometidoAoCliente("2026-10-21", "na_oficina", AGORA)).toMatchObject({ relativo: "hoje", tom: "amarelo" });
    expect(prometidoAoCliente("2026-10-22", "pronta", AGORA)).toMatchObject({ relativo: "amanhã" });
    expect(prometidoAoCliente("2026-10-24", "na_oficina", AGORA)).toMatchObject({ relativo: "em 3 dias" });
    expect(prometidoAoCliente("2026-10-20", "na_oficina", AGORA)).toMatchObject({ relativo: "atrasado 1 dia", tom: "alerta" });
    expect(prometidoAoCliente("2026-10-18", "na_oficina", AGORA)).toMatchObject({ relativo: "atrasado 3 dias" });
  });
  it("entregue não fica atrasado; sem data ou cancelada: null", () => {
    expect(prometidoAoCliente("2026-10-10", "entregue", AGORA)).toMatchObject({ relativo: "entregue", tom: "ok" });
    expect(prometidoAoCliente(undefined, "na_oficina", AGORA)).toBeNull();
    expect(prometidoAoCliente("2026-10-10", "cancelada", AGORA)).toBeNull();
  });
});

describe("etapas", () => {
  const etapas = [etapa(1, "dispensada"), etapa(2, "concluida"), etapa(3, "na_fila"), etapa(4, "aguardando")];
  it("conta só as que valem e cita as dispensadas", () => {
    expect(textoEtapas(etapas)).toBe("Etapa 2 de 3 (1 dispensada)");
    expect(textoEtapas([etapa(1, "concluida"), etapa(2, "concluida")])).toBe("2 de 2 feitas");
    expect(textoEtapas([])).toBe("");
  });
  it("numera a lista sem as dispensadas", () => {
    const n = numerosEtapas(etapas);
    expect([n.get("e1"), n.get("e2"), n.get("e3"), n.get("e4")]).toEqual([null, 1, 2, 3]);
  });
});

describe("faltasParaEntregar", () => {
  it("avisa franquia não paga e falta de foto de saída", () => {
    const v = visao({ versoes: [versao({ franquia: 16000 })] }, { estado: "pronta" });
    expect(faltasParaEntregar(v, clienteDeve(v, PAGADORES)).map((f) => f.texto)).toEqual(["Franquia de R$ 160,00 não paga", "Nenhuma foto de saída"]);
  });
  it("nada falta com franquia paga e foto final", () => {
    const v = visao(
      {
        versoes: [versao({ franquia: 16000 })],
        titulos: [titulo(16000, 16000)],
        fotos: [{ id: "f", osId: "os-1", fase: "final", url: "x", origem: "interna", tiradaEm: AGORA } as OSVisao["fotos"][number]],
      },
      { estado: "pronta" },
    );
    expect(faltasParaEntregar(v, clienteDeve(v, PAGADORES))).toEqual([]);
  });

  it("foto final de uma etapa não conta como foto de saída", () => {
    const v = visao(
      {
        versoes: [versao()],
        fotos: [{ id: "f", osId: "os-1", etapaId: "e3", fase: "final", url: "x", origem: "interna", tiradaEm: AGORA } as OSVisao["fotos"][number]],
      },
      { estado: "pronta" },
    );
    expect(faltasParaEntregar(v, clienteDeve(v, PAGADORES)).map((f) => f.texto)).toEqual(["Nenhuma foto de saída"]);
  });
});

describe("acaoPrimariaDoTopo", () => {
  it("pronto com franquia em aberto: primeiro o pagamento", () => {
    expect(acaoPrimariaDoTopo("pronta", 16000)).toBe("pagamento");
    expect(acaoPrimariaDoTopo("pronta", 0)).toBe("entrega");
    expect(acaoPrimariaDoTopo("entregue", 0)).toBeNull();
    expect(acaoPrimariaDoTopo("na_oficina", 16000)).toBeNull();
  });
});

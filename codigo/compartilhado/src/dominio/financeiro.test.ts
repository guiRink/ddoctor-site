import { describe, expect, it } from "vitest";
import type { OrcamentoVersao, OS, Pagador, TituloReceber } from "../tipos";
import {
  aplicarBaixa,
  custoUsoEstimado,
  dataBaseTitulo,
  estadoTitulo,
  faixaAging,
  margemOS,
  saldoTitulo,
  titulosSugeridos,
  valorAprovado,
  vencimentoPorRegra,
} from "./financeiro";

const titulo = (p: Partial<TituloReceber> = {}): TituloReceber => ({
  id: "t1",
  osId: "os1",
  pagadorId: "maxpar",
  descricao: "Mão de obra",
  valor: 100000,
  vencimento: "2026-10-12",
  estado: "emitido",
  baixas: [],
  ...p,
});
const baixa = (valor: number) => ({ id: `b${valor}`, valor, recebidoEm: "2026-10-12", forma: "pix" });

describe("saldo, estado e aging", () => {
  it("saldo desconta baixas; cancelado tem saldo 0", () => {
    expect(saldoTitulo(titulo({ baixas: [baixa(30000), baixa(20000)], estado: "parcial" }))).toBe(50000);
    expect(saldoTitulo(titulo({ estado: "cancelado" }))).toBe(0);
  });
  it("vencido é derivado: só depois do dia do vencimento e se não fechado", () => {
    expect(estadoTitulo(titulo(), "2026-10-12")).toBe("emitido");
    expect(estadoTitulo(titulo(), "2026-10-13")).toBe("vencido");
    expect(estadoTitulo(titulo({ estado: "previsto" }), "2026-10-13")).toBe("vencido");
    expect(estadoTitulo(titulo({ estado: "parcial" }), "2026-10-13")).toBe("vencido");
    expect(estadoTitulo(titulo({ estado: "recebido" }), "2026-12-01")).toBe("recebido");
    expect(estadoTitulo(titulo({ estado: "cancelado" }), "2026-12-01")).toBe("cancelado");
  });
  it("faixas de aging nas bordas", () => {
    expect(faixaAging(titulo(), "2026-10-12")).toBe("a_vencer");
    expect(faixaAging(titulo(), "2026-10-13")).toBe("0_30");
    expect(faixaAging(titulo(), "2026-11-11")).toBe("0_30"); // 30 dias
    expect(faixaAging(titulo(), "2026-11-12")).toBe("31_60");
    expect(faixaAging(titulo(), "2026-12-11")).toBe("31_60"); // 60 dias
    expect(faixaAging(titulo(), "2026-12-12")).toBe("61_mais");
    expect(faixaAging(titulo({ estado: "recebido" }), "2026-12-12")).toBeNull();
  });
});

describe("aplicarBaixa", () => {
  it("parcial e depois quitação", () => {
    const r1 = aplicarBaixa(titulo(), baixa(40000));
    if (!r1.ok) throw new Error(r1.codigo);
    expect(r1.titulo.estado).toBe("parcial");
    expect(saldoTitulo(r1.titulo)).toBe(60000);
    const r2 = aplicarBaixa(r1.titulo, baixa(60000));
    if (!r2.ok) throw new Error(r2.codigo);
    expect(r2.titulo.estado).toBe("recebido");
    expect(saldoTitulo(r2.titulo)).toBe(0);
  });
  it("baixa maior que o saldo é recusada; título original intacto", () => {
    const t = titulo({ baixas: [baixa(90000)], estado: "parcial" });
    expect(aplicarBaixa(t, baixa(10001))).toEqual({ ok: false, codigo: "baixa_maior_que_saldo" });
    expect(t.baixas).toHaveLength(1);
  });
  it("valor inválido e título fechado", () => {
    expect(aplicarBaixa(titulo(), baixa(0))).toEqual({ ok: false, codigo: "valor_invalido" });
    expect(aplicarBaixa(titulo(), baixa(10.5))).toEqual({ ok: false, codigo: "valor_invalido" });
    expect(aplicarBaixa(titulo({ estado: "recebido" }), baixa(1))).toEqual({ ok: false, codigo: "transicao_invalida" });
    expect(aplicarBaixa(titulo({ estado: "cancelado" }), baixa(1))).toEqual({ ok: false, codigo: "transicao_invalida" });
  });
});

const pagador = (p: Partial<Pagador> & Pick<Pagador, "id" | "tipo">): Pagador => ({
  nome: p.id,
  prazo: { dias: 0, base: "entrega", diasUteis: false, provisorio: true },
  ...p,
});
const maxpar = pagador({ id: "maxpar", nome: "Maxpar", tipo: "maxpar", prazo: { dias: 30, base: "nf", diasUteis: false, provisorio: true } });
const cliente = pagador({ id: "cliente", nome: "Cliente particular", tipo: "cliente" });
const segDireta = pagador({ id: "seg", nome: "Seguradora X", tipo: "seguradora", prazo: { dias: 3, base: "nf", diasUteis: true, provisorio: true }, descontaFranquia: false });

describe("vencimentoPorRegra e dataBaseTitulo", () => {
  it("dias corridos", () => {
    expect(vencimentoPorRegra(maxpar, "2026-10-12")).toBe("2026-11-11");
    expect(vencimentoPorRegra(cliente, "2026-10-12")).toBe("2026-10-12");
  });
  it("dias úteis pulam sábado e domingo", () => {
    expect(vencimentoPorRegra(segDireta, "2026-10-08")).toBe("2026-10-13"); // qui → sex, seg, ter
    expect(vencimentoPorRegra(segDireta, "2026-10-10")).toBe("2026-10-14"); // sáb → seg, ter, qua
  });
  it("data-base pela regra do pagador", () => {
    expect(dataBaseTitulo(maxpar, { nfEmitidaEm: "2026-10-12", entregueEm: "2026-10-10" })).toBe("2026-10-12");
    expect(dataBaseTitulo(cliente, { entregueEm: "2026-10-10T15:00:00-03:00" })).toBe("2026-10-10");
    expect(dataBaseTitulo(maxpar, { entregueEm: "2026-10-10" })).toBeNull();
  });
});

const os = (origem: OS["origem"]): OS => ({
  id: "os1",
  numero: 1,
  veiculoId: "v",
  clienteId: "c",
  origem,
  estado: "entregue",
  prioridade: 0,
  atendimentosExternos: [],
  criadoEm: "2026-10-01T08:00:00-03:00",
  atualizadoEm: "2026-10-01T08:00:00-03:00",
});
const versao = (p: Partial<OrcamentoVersao> = {}): OrcamentoVersao => ({
  id: "v1",
  osId: "os1",
  tipo: "externo",
  numeroVersao: 1,
  fonte: "manual",
  estado: "aprovado",
  itens: [
    { id: "i1", peca: "Capô", tecnica: "martelinho", valor: 60000, statusItem: "autorizado" },
    { id: "i2", peca: "Porta DE", tecnica: "martelinho", valor: 40000, statusItem: "autorizado" },
    { id: "i3", peca: "Teto", tecnica: "pintura", valor: 30000, statusItem: "negado" },
  ],
  franquia: 16000,
  criadoEm: "2026-10-01T08:00:00-03:00",
  ...p,
});

describe("titulosSugeridos", () => {
  it("Maxpar: franquia ao cliente e mão de obra líquida à Maxpar", () => {
    const r = titulosSugeridos(os("maxpar"), versao({ complementoParticular: 25000 }), [maxpar, cliente]);
    if (!r.ok) throw new Error(r.codigo);
    expect(r.titulos.map((t) => [t.tipo, t.pagadorId, t.valor])).toEqual([
      ["franquia", "cliente", 16000],
      ["mao_obra_autorizada", "maxpar", 84000],
      ["complemento", "cliente", 25000],
    ]);
  });
  it("pagador que não desconta a franquia recebe o total autorizado", () => {
    const r = titulosSugeridos(os("seguradora_direta"), versao(), [maxpar, cliente, segDireta], "seg");
    if (!r.ok) throw new Error(r.codigo);
    expect(r.titulos.find((t) => t.tipo === "mao_obra_autorizada")).toMatchObject({ pagadorId: "seg", valor: 100000 });
  });
  it("seguradora direta sem pagador indicado → sem_pagador; sem cliente com franquia → sem_pagador", () => {
    expect(titulosSugeridos(os("seguradora_direta"), versao(), [maxpar, cliente])).toEqual({ ok: false, codigo: "sem_pagador" });
    expect(titulosSugeridos(os("maxpar"), versao(), [maxpar])).toEqual({ ok: false, codigo: "sem_pagador" });
  });
  it("franquia maior que o autorizado não gera título negativo", () => {
    const r = titulosSugeridos(os("maxpar"), versao({ franquia: 200000 }), [maxpar, cliente]);
    if (!r.ok) throw new Error(r.codigo);
    expect(r.titulos.map((t) => t.tipo)).toEqual(["franquia"]);
  });
  it("particular: um título com o valor aprovado do orçamento interno", () => {
    const interno = versao({ tipo: "interno", franquia: undefined, itens: [
      { id: "i1", peca: "Capô", tecnica: "martelinho", valor: 45000, statusItem: "solicitado" },
      { id: "i2", peca: "Teto", tecnica: "pintura", valor: 30000, statusItem: "dispensado" },
    ] });
    expect(valorAprovado(interno)).toBe(45000);
    const r = titulosSugeridos(os("particular"), interno, [cliente]);
    if (!r.ok) throw new Error(r.codigo);
    expect(r.titulos).toEqual([{ osId: "os1", pagadorId: "cliente", tipo: "particular", descricao: "Serviço particular", valor: 45000 }]);
  });
  it("versão não aprovada é recusada", () => {
    expect(titulosSugeridos(os("maxpar"), versao({ estado: "enviado" }), [maxpar, cliente])).toEqual({ ok: false, codigo: "versao_nao_aprovada" });
  });
});

describe("margemOS", () => {
  it("receita − custos, ignora cancelados, marca prevista até tudo recebido", () => {
    const titulos = [
      titulo({ id: "a", valor: 84000, estado: "recebido" }),
      titulo({ id: "b", valor: 16000, estado: "emitido" }),
      titulo({ id: "c", valor: 99999, estado: "cancelado" }),
    ];
    const r = margemOS(titulos, [{ valor: custoUsoEstimado(0.5, 9000) }, { valor: 10000 }]);
    expect(r).toEqual({ receita: 100000, custo: 14500, margem: 85500, percentual: 0.855, prevista: true });
    expect(margemOS([titulo({ estado: "recebido" })], []).prevista).toBe(false);
    expect(margemOS([], [{ valor: 100 }])).toEqual({ receita: 0, custo: 100, margem: -100, percentual: null, prevista: true });
  });
});

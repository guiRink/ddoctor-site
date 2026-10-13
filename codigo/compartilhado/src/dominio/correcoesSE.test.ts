// Regras acrescentadas na correção da revisão QA do sprint SE (receita única, caixa fechado, datas,
// cancelados, devolução de insumo, cobrança do cliente, recepção, mão de obra, contato demo).
import { describe, expect, it } from "vitest";
import type { Baixa, Despesa, Material, MovimentoEstoque, OrcamentoVersao, Pagador, RecepcaoVeiculo, TituloReceber } from "../tipos";
import { calcularFechamento, checarCaixaAberto, resumoCompetencia } from "./caixa";
import { contatoClicavel } from "./clientes";
import { receitaOS, validarMaoDeObra } from "./custos";
import { consumoPorFuncionario, ehDevolucaoOS } from "./estoque";
import { baixasValidas, validarDataPrevista, validarDataRealizada } from "./financeiro";
import { compararMarcos, dataISOValida } from "./fuso";
import { resumoPagamentosCliente, saldoACobrarCliente, titulosDoCliente, valorEsperadoCliente } from "./pagamentos";
import { carimbarRecepcao, recepcaoEditavel } from "./recepcao";
import { faturamentoPorForma, pecasConsumidas, recebimentosPorDia } from "./relatorios";

const titulo = (p: Partial<TituloReceber>): TituloReceber => ({
  id: "t",
  osId: "os1",
  pagadorId: "pg-cliente",
  descricao: "x",
  valor: 0,
  vencimento: "2026-10-12",
  estado: "emitido",
  baixas: [],
  ...p,
});
const baixa = (valor: number, recebidoEm = "2026-10-12", forma = "dinheiro"): Baixa => ({ id: `b${valor}`, valor, recebidoEm, forma });
const versao = (p: Partial<OrcamentoVersao>): OrcamentoVersao => ({
  id: "v1",
  osId: "os1",
  tipo: "externo",
  numeroVersao: 1,
  fonte: "manual",
  estado: "aprovado",
  itens: [],
  criadoEm: "2026-10-01T10:00:00-03:00",
  ...p,
});
const item = (valor: number, statusItem: OrcamentoVersao["itens"][number]["statusItem"] = "autorizado") => ({
  id: `i${valor}${statusItem}`,
  peca: "Porta",
  tecnica: "martelinho" as const,
  valor,
  statusItem,
});

describe("fuso: ordenação por instante e data real", () => {
  it("compararMarcos ordena pelo instante, não pelo texto (Z × -03:00)", () => {
    const a = "2026-10-12T10:00:00-03:00"; // 13:00Z
    const b = "2026-10-12T12:30:00Z"; // 09:30 em SP: ANTES de a, embora o texto seja "maior"
    expect([a, b].sort(compararMarcos)).toEqual([b, a]);
    expect(a.localeCompare(b)).toBeLessThan(0); // a comparação de texto erraria
  });
  it("dataISOValida recusa dia que não existe e formato errado", () => {
    expect(dataISOValida("2026-10-12")).toBe(true);
    expect(dataISOValida("2028-02-29")).toBe(true);
    expect(dataISOValida("2026-02-29")).toBe(false);
    expect(dataISOValida("2026-13-01")).toBe(false);
    expect(dataISOValida("2026-10-32")).toBe(false);
    expect(dataISOValida("12/10/2026")).toBe(false);
    expect(dataISOValida("2026-10-12T10:00")).toBe(false);
    expect(dataISOValida(undefined)).toBe(false);
  });
});

describe("datas de pagamento e vencimento", () => {
  it("recebido/pago: dia real e não futuro", () => {
    expect(validarDataRealizada("2026-10-12", "2026-10-12")).toEqual({ ok: true });
    expect(validarDataRealizada("2026-10-01", "2026-10-12")).toEqual({ ok: true });
    expect(validarDataRealizada("2026-10-13", "2026-10-12")).toEqual({ ok: false, codigo: "data_futura" });
    expect(validarDataRealizada("2026-02-30", "2026-10-12")).toEqual({ ok: false, codigo: "data_invalida" });
    expect(validarDataRealizada("", "2026-10-12")).toEqual({ ok: false, codigo: "data_invalida" });
  });
  it("vencimento: só formato e dia real (futuro e passado valem)", () => {
    expect(validarDataPrevista("2027-01-31")).toEqual({ ok: true });
    expect(validarDataPrevista("2020-01-31")).toEqual({ ok: true });
    expect(validarDataPrevista("2026-04-31")).toEqual({ ok: false, codigo: "data_invalida" });
  });
});

describe("títulos cancelados ficam fora de toda soma de baixas", () => {
  const titulos = [
    titulo({ id: "ok", valor: 50000, estado: "parcial", baixas: [baixa(20000), baixa(5000, "2026-10-12", "pix")] }),
    titulo({ id: "cancelado", valor: 30000, estado: "cancelado", baixas: [baixa(30000)] }),
  ];
  const despesas: Despesa[] = [];
  it("baixasValidas", () => {
    expect(baixasValidas(titulos).map((b) => b.valor)).toEqual([20000, 5000]);
  });
  it("calcularFechamento com titulos ignora o cancelado; com baixas soltas segue compatível", () => {
    const comTitulos = calcularFechamento({ saldoInicial: 0, contado: 20000, titulos, despesas, data: "2026-10-12" });
    expect(comTitulos.entradasDinheiro).toBe(20000);
    expect(comTitulos.diferenca).toBe(0);
    const soltas = calcularFechamento({ saldoInicial: 0, contado: 0, baixas: [baixa(700)], despesas, data: "2026-10-12" });
    expect(soltas.entradasDinheiro).toBe(700);
    // titulos vence baixas quando os dois vêm
    expect(calcularFechamento({ saldoInicial: 0, contado: 0, titulos, baixas: [baixa(999)], despesas, data: "2026-10-12" }).entradasDinheiro).toBe(20000);
  });
  it("resumoCompetencia, faturamentoPorForma e recebimentosPorDia ignoram o cancelado", () => {
    expect(resumoCompetencia("2026-10", titulos, despesas).entradas).toBe(25000);
    expect(faturamentoPorForma(titulos, "2026-10")).toEqual([
      { forma: "dinheiro", valor: 20000, quantidade: 1 },
      { forma: "pix", valor: 5000, quantidade: 1 },
    ]);
    expect(recebimentosPorDia(titulos, "2026-10").find((d) => d.data === "2026-10-12")!.valor).toBe(25000);
  });
});

describe("caixa fechado trava dinheiro", () => {
  const fechamentos = [{ data: "2026-10-11" }];
  it("dinheiro (ou o rótulo antigo) com data de dia fechado é recusado", () => {
    expect(checarCaixaAberto(fechamentos, "dinheiro", "2026-10-11")).toEqual({ ok: false, codigo: "caixa_ja_fechado" });
    expect(checarCaixaAberto(fechamentos, "Espécie", "2026-10-11")).toEqual({ ok: false, codigo: "caixa_ja_fechado" });
  });
  it("outra forma, outro dia ou sem data passam", () => {
    expect(checarCaixaAberto(fechamentos, "pix", "2026-10-11").ok).toBe(true);
    expect(checarCaixaAberto(fechamentos, "dinheiro", "2026-10-12").ok).toBe(true);
    expect(checarCaixaAberto(fechamentos, "dinheiro", undefined).ok).toBe(true);
    expect(checarCaixaAberto(fechamentos, undefined, "2026-10-11").ok).toBe(true);
  });
});

describe("receitaOS: receita única da OS", () => {
  it("externo: autorizado (com franquia) + complemento; títulos parciais não mudam a receita", () => {
    const v = versao({ itens: [item(100000), item(50000, "negado")], franquia: 16000, complementoParticular: 20000 });
    const parcial = titulo({ valor: 16000, estado: "parcial", baixas: [baixa(10000)] });
    expect(receitaOS({ versoes: [v], titulos: [parcial] })).toEqual({
      valor: 120000,
      aprovada: true,
      autorizado: 100000,
      complemento: 20000,
      faturado: 16000,
      versaoId: "v1",
    });
  });
  it("vale a versão aprovada de maior número; versão nova ainda não aprovada não conta", () => {
    const v1 = versao({ id: "v1", numeroVersao: 1, estado: "substituido", itens: [item(80000)] });
    const v2 = versao({ id: "v2", numeroVersao: 2, estado: "aprovado", itens: [item(90000)] });
    const v3 = versao({ id: "v3", numeroVersao: 3, estado: "enviado", itens: [item(150000, "solicitado")] });
    const r = receitaOS({ versoes: [v1, v3, v2], titulos: [] });
    expect(r.valor).toBe(90000);
    expect(r.versaoId).toBe("v2");
  });
  it("interno: itens não negados; complemento não soma de novo", () => {
    const v = versao({ tipo: "interno", itens: [item(30000, "solicitado"), item(10000, "dispensado")], complementoParticular: 5000 });
    expect(receitaOS({ versoes: [v], titulos: [] })).toMatchObject({ valor: 30000, complemento: 0 });
  });
  it("sem aprovação: receita 0 e aprovada false, mesmo com título lançado", () => {
    const r = receitaOS({ versoes: [versao({ estado: "enviado", itens: [item(50000)] })], titulos: [titulo({ valor: 50000 })] });
    expect(r).toMatchObject({ valor: 0, aprovada: false, faturado: 50000 });
    expect(r.versaoId).toBeUndefined();
  });
  it("título cancelado não conta como faturado", () => {
    expect(receitaOS({ versoes: [], titulos: [titulo({ valor: 1000, estado: "cancelado" })] }).faturado).toBe(0);
  });
});

describe("mão de obra", () => {
  it("recusa R$ 0,00, valor quebrado e minutos zerados", () => {
    expect(validarMaoDeObra({ modo: "fixo", minutos: 0, valorUnitario: 0 })).toEqual({ ok: false, codigo: "valor_invalido" });
    expect(validarMaoDeObra({ modo: "hora", minutos: 60, valorUnitario: 10.5 })).toEqual({ ok: false, codigo: "valor_invalido" });
    expect(validarMaoDeObra({ modo: "hora", minutos: 0, valorUnitario: 4000 })).toEqual({ ok: false, codigo: "minutos_invalidos" });
    expect(validarMaoDeObra({ modo: "minuto", minutos: -5, valorUnitario: 70 })).toEqual({ ok: false, codigo: "minutos_invalidos" });
    // arredonda para 0 centavo → não é custo
    expect(validarMaoDeObra({ modo: "hora", minutos: 0.1, valorUnitario: 1 })).toEqual({ ok: false, codigo: "valor_invalido" });
  });
  it("válida devolve o total do domínio", () => {
    expect(validarMaoDeObra({ modo: "hora", minutos: 90, valorUnitario: 4000 })).toEqual({ ok: true, total: 6000 });
    expect(validarMaoDeObra({ modo: "fixo", minutos: 0, valorUnitario: 15000 })).toEqual({ ok: true, total: 15000 });
  });
});

describe("cobrança do cliente", () => {
  const pagadores: Pagador[] = [
    { id: "pg-cliente", nome: "Cliente", tipo: "cliente", prazo: { dias: 0, base: "entrega", diasUteis: false, provisorio: true } },
    { id: "pg-maxpar", nome: "Maxpar", tipo: "maxpar", prazo: { dias: 30, base: "servico_realizado", diasUteis: false, provisorio: true } },
  ];
  const titulos = [
    titulo({ id: "f", valor: 16000, estado: "recebido", baixas: [baixa(16000)] }),
    titulo({ id: "m", pagadorId: "pg-maxpar", valor: 200000, estado: "recebido", baixas: [baixa(200000, "2026-10-12", "transferencia")] }),
    titulo({ id: "c", valor: 5000, estado: "emitido" }),
  ];
  it("total pago e saldo do cliente só com títulos de pagador tipo cliente", () => {
    expect(titulosDoCliente(titulos, pagadores).map((t) => t.id)).toEqual(["f", "c"]);
    expect(resumoPagamentosCliente(titulos, pagadores)).toEqual({ total: 21000, recebido: 16000, saldo: 5000 });
  });
  it("esperado: particular = aprovado; seguradora = franquia + complemento; sem versão = 0", () => {
    const v = versao({ itens: [item(100000)], franquia: 16000, complementoParticular: 4000 });
    expect(valorEsperadoCliente("maxpar", v)).toBe(20000);
    expect(valorEsperadoCliente("particular", versao({ tipo: "interno", itens: [item(30000, "solicitado")] }))).toBe(30000);
    expect(valorEsperadoCliente("particular", undefined)).toBe(0);
  });
  it("saldo a cobrar desconta títulos do cliente não cancelados; ≤ 0 = quitada", () => {
    const v = versao({ itens: [item(100000)], franquia: 16000 });
    expect(saldoACobrarCliente({ origem: "maxpar", versao: v, titulosCliente: [] })).toBe(16000);
    expect(saldoACobrarCliente({ origem: "maxpar", versao: v, titulosCliente: [titulo({ valor: 10000, estado: "cancelado" })] })).toBe(16000);
    expect(saldoACobrarCliente({ origem: "maxpar", versao: v, titulosCliente: [titulo({ valor: 16000, estado: "recebido" })] })).toBe(0);
    expect(saldoACobrarCliente({ origem: "maxpar", versao: versao({ itens: [item(1000)] }), titulosCliente: [] })).toBe(0);
  });
});

describe("devolução de insumo", () => {
  const materiais: Material[] = [{ id: "m1", nome: "Verniz", categoria: "tinta", unidade: "L", saldoEstimado: 5, saldoMinimo: 1, custoMedio: 8000 }];
  const mov = (p: Partial<MovimentoEstoque>): MovimentoEstoque => ({ id: "x", materialId: "m1", tipo: "saida_os", quantidade: 1, em: "2026-10-10T10:00:00-03:00", ...p });
  const saida = mov({ id: "s", quantidade: 2, custoUnitario: 8000, osId: "os1", perfilId: "p1" });
  const dev = mov({ id: "d", tipo: "ajuste", sentido: "mais", quantidade: 0.5, custoUnitario: 8000, osId: "os1", perfilId: "p1", obs: "Devolução do insumo da OS nº 1" });
  it("ehDevolucaoOS: ajuste 'mais' ligado a OS", () => {
    expect(ehDevolucaoOS(dev)).toBe(true);
    expect(ehDevolucaoOS({ ...dev, osId: undefined })).toBe(false);
    expect(ehDevolucaoOS({ ...dev, sentido: "menos" })).toBe(false);
    expect(ehDevolucaoOS(saida)).toBe(false);
  });
  it("relatório de peças e consumo por funcionário descontam a devolução", () => {
    expect(pecasConsumidas([saida, dev], materiais, "2026-10")).toEqual([{ materialId: "m1", nome: "Verniz", unidade: "L", quantidade: 1.5, custo: 12000 }]);
    const [p1] = consumoPorFuncionario([saida, dev], materiais);
    expect(p1).toMatchObject({ perfilId: "p1", custo: 12000 });
    expect(p1.itens[0].quantidade).toBe(1.5);
  });
  it("devolução total some do relatório", () => {
    const tudo = { ...dev, quantidade: 2 };
    expect(pecasConsumidas([saida, tudo], materiais, "2026-10")).toEqual([]);
    expect(consumoPorFuncionario([saida, tudo], materiais)).toEqual([]);
  });
});

describe("recepção", () => {
  const base: RecepcaoVeiculo = { checklist: { estepe: true }, avarias: [] };
  it("só edita OS que ainda não saiu", () => {
    for (const e of ["entregue", "encerrada", "cancelada"] as const) expect(recepcaoEditavel(e)).toEqual({ ok: false, codigo: "os_fechada" });
    for (const e of ["aguardando_agendamento", "na_oficina", "pronta"] as const) expect(recepcaoEditavel(e).ok).toBe(true);
  });
  it("primeira gravação carimba registrada; regravação preserva e carimba atualizada", () => {
    const primeira = carimbarRecepcao({ ...base, registradaEm: "1999-01-01T00:00:00-03:00" }, undefined, "2026-10-12T09:00:00-03:00", "p-recepcao");
    expect(primeira).toMatchObject({ registradaEm: "2026-10-12T09:00:00-03:00", registradaPor: "p-recepcao" });
    expect(primeira.atualizadaEm).toBeUndefined();
    const segunda = carimbarRecepcao({ ...base, km: 1000 }, primeira, "2026-10-12T15:00:00-03:00", "p-dono");
    expect(segunda).toMatchObject({
      km: 1000,
      registradaEm: "2026-10-12T09:00:00-03:00",
      registradaPor: "p-recepcao",
      atualizadaEm: "2026-10-12T15:00:00-03:00",
      atualizadaPor: "p-dono",
    });
  });
});

describe("contato de cliente demo", () => {
  it("não vira link para cliente demo nem sem número", () => {
    expect(contatoClicavel({ demo: true }, "+5541991000005")).toBe(false);
    expect(contatoClicavel({}, "+5541991000005")).toBe(true);
    expect(contatoClicavel({}, undefined)).toBe(false);
  });
});

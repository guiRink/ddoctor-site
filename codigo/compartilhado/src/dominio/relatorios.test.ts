import { describe, expect, it } from "vitest";
import type { Despesa, Material, MovimentoEstoque, TituloReceber } from "../tipos";
import {
  despesasPorCategoria,
  faturamentoPorForma,
  margemEstimada,
  osPorEstado,
  pecasConsumidas,
  recebimentosPorDia,
  ticketMedio,
  topClientes,
  type OSRelatorio,
} from "./relatorios";

const mes = "2026-10";
const titulos: TituloReceber[] = [
  {
    id: "t1",
    osId: "o1",
    pagadorId: "c",
    descricao: "x",
    valor: 300000,
    vencimento: "2026-10-10",
    estado: "parcial",
    baixas: [
      { id: "a", valor: 50000, recebidoEm: "2026-10-01", forma: "Pix" },
      { id: "b", valor: 70000, recebidoEm: "2026-10-31", forma: "dinheiro" },
      { id: "c", valor: 10000, recebidoEm: "2026-09-30", forma: "pix" },
    ],
  },
  {
    id: "t2",
    osId: "o2",
    pagadorId: "m",
    descricao: "y",
    valor: 200000,
    vencimento: "2026-10-10",
    estado: "recebido",
    baixas: [
      { id: "d", valor: 200000, recebidoEm: "2026-10-01", forma: "seguradora" },
      { id: "e", valor: 1000, recebidoEm: "2026-10-15", forma: "cheque" },
      { id: "f", valor: 30000, recebidoEm: "2026-10-15", forma: "pix" },
    ],
  },
];

describe("recebimentos", () => {
  it("faturamento por forma no mês (texto antigo normalizado; desconhecido = outra)", () => {
    expect(faturamentoPorForma(titulos, mes)).toEqual([
      { forma: "seguradora", valor: 200000, quantidade: 1 },
      { forma: "pix", valor: 80000, quantidade: 2 },
      { forma: "dinheiro", valor: 70000, quantidade: 1 },
      { forma: "outra", valor: 1000, quantidade: 1 },
    ]);
  });
  it("recebimentos por dia: todos os dias do mês, bordas 1º e 31", () => {
    const r = recebimentosPorDia(titulos, mes);
    expect(r).toHaveLength(31);
    expect(r[0]).toEqual({ data: "2026-10-01", valor: 250000 });
    expect(r[14]).toEqual({ data: "2026-10-15", valor: 31000 });
    expect(r[30]).toEqual({ data: "2026-10-31", valor: 70000 });
    expect(r[1].valor).toBe(0);
  });
});

describe("despesasPorCategoria", () => {
  const d = (p: Partial<Despesa>): Despesa => ({ id: "d", categoria: "Outras", descricao: "", valorPrevisto: 1000, vencimento: "2026-10-01", ...p });
  it("pagas no mês, por categoria do cadastro ou pelo texto", () => {
    const r = despesasPorCategoria(
      [
        d({ categoriaId: "desp_aluguel", categoria: "aluguel antigo", pagoEm: "2026-10-05", valorPago: 300000 }),
        d({ categoria: "Material de pintura", pagoEm: "2026-10-06", valorPago: 50000 }),
        d({ categoria: "Material de pintura", pagoEm: "2026-10-20" }),
        d({ categoria: "", pagoEm: "2026-10-21", valorPago: 10 }),
        d({ categoria: "Impostos", valorPrevisto: 70000 }), // não paga
        d({ categoria: "Impostos", pagoEm: "2026-11-01", valorPago: 1 }), // outro mês
      ],
      mes,
      [{ id: "desp_aluguel", nome: "Aluguel", tipo: "despesa", ativa: true }],
    );
    expect(r).toEqual([
      { categoriaId: "desp_aluguel", categoria: "Aluguel", valor: 300000, quantidade: 1 },
      { categoria: "Material de pintura", valor: 51000, quantidade: 2 },
      { categoria: "Sem categoria", valor: 10, quantidade: 1 },
    ]);
  });
});

const os = (p: Partial<OSRelatorio>): OSRelatorio => ({
  id: "o",
  clienteId: "c1",
  estado: "entregue",
  criadoEm: "2026-10-02T09:00:00-03:00",
  entregueEm: "2026-10-10T17:00:00-03:00",
  receita: 100000,
  custo: 40000,
  ...p,
});
const oss: OSRelatorio[] = [
  os({ id: "1", clienteId: "c1", receita: 100000, custo: 40000 }),
  os({ id: "2", clienteId: "c2", receita: 250000, custo: 100000, estado: "encerrada" }),
  os({ id: "3", clienteId: "c1", receita: 160000, custo: undefined }),
  os({ id: "4", clienteId: "c3", receita: 999999, estado: "cancelada" }),
  os({ id: "5", clienteId: "c4", receita: 50000, entregueEm: "2026-11-01T00:30:00-03:00" }),
  os({ id: "6", clienteId: "c5", estado: "na_oficina", entregueEm: undefined, receita: 80000, custo: 0 }),
  // 31/10 23h30 em SP = 1º/11 em UTC: conta em outubro
  os({ id: "7", clienteId: "c6", receita: 10000, custo: 2000, entregueEm: "2026-11-01T02:30:00Z", criadoEm: "2026-09-20T10:00:00-03:00" }),
];

describe("relatórios de OS", () => {
  it("ticket médio das entregues no mês (cancelada e outro mês fora; fuso da oficina)", () => {
    expect(ticketMedio(oss, mes)).toEqual({ quantidade: 4, total: 520000, ticket: 130000 });
    expect(ticketMedio(oss, "2026-08")).toEqual({ quantidade: 0, total: 0, ticket: null });
  });
  it("top clientes por receita, limitado a n", () => {
    expect(topClientes(oss, mes, 2)).toEqual([
      { clienteId: "c1", quantidadeOS: 2, total: 260000 },
      { clienteId: "c2", quantidadeOS: 1, total: 250000 },
    ]);
    expect(topClientes(oss, mes)).toHaveLength(3);
    expect(topClientes(oss, mes, 0)).toEqual([]);
  });
  it("margem estimada avisa OS sem custo lançado", () => {
    expect(margemEstimada(oss, mes)).toEqual({
      quantidade: 4,
      receita: 520000,
      custo: 142000,
      margem: 378000,
      margemPct: 378000 / 520000,
      semCusto: 1,
    });
    expect(margemEstimada([], mes).margemPct).toBeNull();
  });
  it("OS por estado na ordem do fluxo; com mês, só as criadas no mês", () => {
    expect(osPorEstado(oss).map((l) => [l.estado, l.quantidade])).toEqual([
      ["na_oficina", 1],
      ["entregue", 4],
      ["encerrada", 1],
      ["cancelada", 1],
    ]);
    const out = osPorEstado(oss, mes);
    expect(out.find((l) => l.estado === "entregue")).toEqual({ estado: "entregue", quantidade: 3, receita: 310000, custo: 80000, margem: 230000 });
  });
});

describe("pecasConsumidas", () => {
  const materiais: Material[] = [
    { id: "m1", nome: "Verniz", categoria: "tinta", unidade: "L", saldoEstimado: 5, saldoMinimo: 1, custoMedio: 8000 },
    { id: "m2", nome: "Lixa", categoria: "lixa", unidade: "un", saldoEstimado: 50, saldoMinimo: 10, custoMedio: 200 },
  ];
  const m = (p: Partial<MovimentoEstoque>): MovimentoEstoque => ({ id: "x", materialId: "m1", tipo: "saida_os", quantidade: 1, em: "2026-10-10T10:00:00-03:00", ...p });
  it("saídas do mês por material, maior custo primeiro; entradas e outro mês fora", () => {
    expect(
      pecasConsumidas(
        [
          m({ quantidade: 0.5 }),
          m({ quantidade: 0.25, custoUnitario: 9000 }),
          m({ materialId: "m2", tipo: "consumo_interno", quantidade: 30 }),
          m({ tipo: "entrada_compra", quantidade: 10, custoUnitario: 8000 }),
          m({ em: "2026-09-30T10:00:00-03:00" }),
          m({ tipo: "ajuste", sentido: "menos", quantidade: 1, obs: "perda" }),
        ],
        materiais,
        mes,
      ),
    ).toEqual([
      { materialId: "m1", nome: "Verniz", unidade: "L", quantidade: 0.75, custo: 6250 },
      { materialId: "m2", nome: "Lixa", unidade: "un", quantidade: 30, custo: 6000 },
    ]);
  });
});

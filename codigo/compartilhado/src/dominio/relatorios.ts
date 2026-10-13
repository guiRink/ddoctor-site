// Relatórios do mês ("AAAA-MM"): funções puras sobre listas. Dinheiro em centavos.
// Entradas mínimas: títulos com baixas, despesas, movimentos de estoque e um resumo da OS (OSRelatorio),
// que o painel monta a partir da OS, dos títulos e dos custos (resultadoOS) — sem depender do painel.
import {
  ESTADOS_OS,
  type CategoriaFinanceira,
  type Centavos,
  type DataISO,
  type Despesa,
  type EstadoOS,
  type FormaPagamento,
  type Id,
  type MarcoISO,
  type Material,
  type MovimentoEstoque,
  type TituloReceber,
} from "../tipos";
import { valorPagoDespesa } from "./caixa";
import { custoDoMovimento, TIPOS_SAIDA } from "./estoque";
import { diasDoMes, mesDe } from "./fuso";
import { normalizarFormaPagamento } from "./pagamentos";

/** Resumo de uma OS para relatório. `receita` = valor faturado (títulos não cancelados ou serviços − desconto). */
export interface OSRelatorio {
  id: Id;
  clienteId: Id;
  estado: EstadoOS;
  criadoEm: MarcoISO;
  entregueEm?: MarcoISO;
  receita: Centavos;
  /** Custo lançado (resultadoOS.custoTotal); ausente = sem custo lançado. */
  custo?: Centavos;
}

const entregueNoMes = (o: OSRelatorio, mes: string) => o.estado !== "cancelada" && !!o.entregueEm && mesDe(o.entregueEm) === mes;

const baixasDoMes = (titulos: readonly TituloReceber[], mes: string) =>
  titulos.flatMap((t) => t.baixas.filter((b) => mesDe(b.recebidoEm) === mes));

/** Recebido no mês por forma de pagamento (texto desconhecido vira "outra"), do maior para o menor. */
export function faturamentoPorForma(
  titulos: readonly TituloReceber[],
  mes: string,
): Array<{ forma: FormaPagamento | "outra"; valor: Centavos; quantidade: number }> {
  const mapa = new Map<FormaPagamento | "outra", { valor: number; quantidade: number }>();
  for (const b of baixasDoMes(titulos, mes)) {
    const forma = normalizarFormaPagamento(b.forma) ?? "outra";
    const g = mapa.get(forma) ?? { valor: 0, quantidade: 0 };
    g.valor += b.valor;
    g.quantidade++;
    mapa.set(forma, g);
  }
  return [...mapa].map(([forma, g]) => ({ forma, ...g })).sort((a, b) => b.valor - a.valor);
}

/** Despesas pagas no mês por categoria (categoriaId → nome do cadastro; senão o texto `categoria`). */
export function despesasPorCategoria(
  despesas: readonly Despesa[],
  mes: string,
  categorias: readonly CategoriaFinanceira[] = [],
): Array<{ categoriaId?: Id; categoria: string; valor: Centavos; quantidade: number }> {
  const nomes = new Map(categorias.map((c) => [c.id, c.nome]));
  const mapa = new Map<string, { categoriaId?: Id; categoria: string; valor: number; quantidade: number }>();
  for (const d of despesas) {
    if (!d.pagoEm || mesDe(d.pagoEm) !== mes) continue;
    const nome = (d.categoriaId && nomes.get(d.categoriaId)) || d.categoria || "Sem categoria";
    const chave = d.categoriaId && nomes.has(d.categoriaId) ? `id:${d.categoriaId}` : `nome:${nome}`;
    const g = mapa.get(chave) ?? { ...(chave.startsWith("id:") ? { categoriaId: d.categoriaId } : {}), categoria: nome, valor: 0, quantidade: 0 };
    g.valor += valorPagoDespesa(d);
    g.quantidade++;
    mapa.set(chave, g);
  }
  return [...mapa.values()].sort((a, b) => b.valor - a.valor);
}

/** Recebido por dia, com todos os dias do mês (zero onde não houve baixa). */
export function recebimentosPorDia(titulos: readonly TituloReceber[], mes: string): Array<{ data: DataISO; valor: Centavos }> {
  const porDia = new Map<DataISO, number>();
  for (const b of baixasDoMes(titulos, mes)) porDia.set(b.recebidoEm, (porDia.get(b.recebidoEm) ?? 0) + b.valor);
  return diasDoMes(mes).map((data) => ({ data, valor: porDia.get(data) ?? 0 }));
}

export interface LinhaOSPorEstado {
  estado: EstadoOS;
  quantidade: number;
  receita: Centavos;
  custo: Centavos;
  margem: Centavos;
}

/** OS por estado (ordem de ESTADOS_OS, só estados com OS). Com `mes`, só OS abertas (criadas) no mês. */
export function osPorEstado(oss: readonly OSRelatorio[], mes?: string): LinhaOSPorEstado[] {
  const filtradas = mes ? oss.filter((o) => mesDe(o.criadoEm) === mes) : oss;
  return ESTADOS_OS.map((estado) => {
    const doEstado = filtradas.filter((o) => o.estado === estado);
    const receita = doEstado.reduce((s, o) => s + o.receita, 0);
    const custo = doEstado.reduce((s, o) => s + (o.custo ?? 0), 0);
    return { estado, quantidade: doEstado.length, receita, custo, margem: receita - custo };
  }).filter((l) => l.quantidade > 0);
}

/** Ticket médio das OS entregues no mês (canceladas fora). ticket null sem OS. */
export function ticketMedio(oss: readonly OSRelatorio[], mes: string): { quantidade: number; total: Centavos; ticket: Centavos | null } {
  const lista = oss.filter((o) => entregueNoMes(o, mes));
  const total = lista.reduce((s, o) => s + o.receita, 0);
  return { quantidade: lista.length, total, ticket: lista.length ? Math.round(total / lista.length) : null };
}

/** Os `n` clientes com maior receita em OS entregues no mês (empate: mais OS primeiro). */
export function topClientes(
  oss: readonly OSRelatorio[],
  mes: string,
  n = 10,
): Array<{ clienteId: Id; quantidadeOS: number; total: Centavos }> {
  const mapa = new Map<Id, { quantidadeOS: number; total: number }>();
  for (const o of oss) {
    if (!entregueNoMes(o, mes)) continue;
    const g = mapa.get(o.clienteId) ?? { quantidadeOS: 0, total: 0 };
    g.quantidadeOS++;
    g.total += o.receita;
    mapa.set(o.clienteId, g);
  }
  return [...mapa]
    .map(([clienteId, g]) => ({ clienteId, ...g }))
    .sort((a, b) => b.total - a.total || b.quantidadeOS - a.quantidadeOS)
    .slice(0, Math.max(0, n));
}

/** Material que saiu no mês (para OS e consumo interno), do maior custo para o menor. */
export function pecasConsumidas(
  movimentos: readonly MovimentoEstoque[],
  materiais: readonly Material[],
  mes: string,
): Array<{ materialId: Id; nome: string; unidade: string; quantidade: number; custo: Centavos }> {
  const porId = new Map(materiais.map((m) => [m.id, m]));
  const mapa = new Map<Id, { materialId: Id; nome: string; unidade: string; quantidade: number; custo: number }>();
  for (const mov of movimentos) {
    if (!TIPOS_SAIDA.has(mov.tipo) || mesDe(mov.em) !== mes) continue;
    const mat = porId.get(mov.materialId);
    const g = mapa.get(mov.materialId) ?? { materialId: mov.materialId, nome: mat?.nome ?? mov.materialId, unidade: mat?.unidade ?? "", quantidade: 0, custo: 0 };
    g.quantidade = Math.round((g.quantidade + mov.quantidade) * 1000) / 1000;
    g.custo += custoDoMovimento(mov, mat);
    mapa.set(mov.materialId, g);
  }
  return [...mapa.values()].sort((a, b) => b.custo - a.custo || a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * Margem das OS entregues no mês: receita − custo lançado. `semCusto` conta OS sem custo lançado
 * (a margem delas está superestimada — a UI deve avisar). margemPct em fração; null sem receita.
 */
export function margemEstimada(
  oss: readonly OSRelatorio[],
  mes: string,
): { quantidade: number; receita: Centavos; custo: Centavos; margem: Centavos; margemPct: number | null; semCusto: number } {
  const lista = oss.filter((o) => entregueNoMes(o, mes));
  const receita = lista.reduce((s, o) => s + o.receita, 0);
  const custo = lista.reduce((s, o) => s + (o.custo ?? 0), 0);
  const margem = receita - custo;
  return {
    quantidade: lista.length,
    receita,
    custo,
    margem,
    margemPct: receita > 0 ? margem / receita : null,
    semCusto: lista.filter((o) => o.custo === undefined).length,
  };
}

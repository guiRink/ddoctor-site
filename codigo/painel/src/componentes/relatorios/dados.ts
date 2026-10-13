// Monta, para um mês, tudo o que a tela de Relatórios mostra e exporta.
// As contas são do domínio (@compartilhado/dominio/relatorios e caixa); aqui só se junta e ordena.
import type { CategoriaFinanceira, Centavos, DataISO, Despesa, Material, MovimentoEstoque, TituloReceber } from "@compartilhado/tipos";
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
} from "@compartilhado/dominio/relatorios";
import { resumoCompetencia, valorPagoDespesa } from "@compartilhado/dominio/caixa";
import { mesDe } from "@compartilhado/dominio/fuso";
import type { OSVisao } from "../../dados/repositorio";
import { paraRelatorio } from "./montar";

export interface BaixaDoMes {
  id: string;
  data: DataISO;
  forma: string;
  descricao: string;
  v?: OSVisao;
  valor: Centavos;
}

export interface EntregueDoMes {
  v: OSVisao;
  rel: OSRelatorio;
}

export interface DadosRelatorio {
  mes: string;
  competencia: ReturnType<typeof resumoCompetencia>;
  porForma: ReturnType<typeof faturamentoPorForma>;
  porDia: ReturnType<typeof recebimentosPorDia>;
  baixas: BaixaDoMes[];
  porCategoria: ReturnType<typeof despesasPorCategoria>;
  despesasPagas: (Despesa & { nomeCategoria: string; pago: Centavos })[];
  porEstado: ReturnType<typeof osPorEstado>;
  entregues: EntregueDoMes[];
  ticket: ReturnType<typeof ticketMedio>;
  margem: ReturnType<typeof margemEstimada>;
  clientes: (ReturnType<typeof topClientes>[number] & { nome: string })[];
  materiais: ReturnType<typeof pecasConsumidas>;
}

export function montarRelatorio(entrada: {
  mes: string;
  oss: readonly OSVisao[];
  titulos: readonly TituloReceber[];
  despesas: readonly Despesa[];
  categorias: readonly CategoriaFinanceira[];
  movimentos: readonly MovimentoEstoque[];
  materiais: readonly Material[];
}): DadosRelatorio {
  const { mes, oss, titulos, despesas, categorias, movimentos, materiais } = entrada;
  const porId = new Map(oss.map((v) => [v.os.id, v]));
  const rels = oss.map(paraRelatorio);
  const relPorId = new Map(rels.map((r) => [r.id, r]));
  const nomeCategoria = new Map(categorias.map((c) => [c.id, c.nome]));
  const nomeCliente = new Map(oss.map((v) => [v.cliente.id, v.cliente.nome]));

  const baixas: BaixaDoMes[] = titulos
    .flatMap((t) =>
      t.baixas
        .filter((b) => mesDe(b.recebidoEm) === mes)
        .map((b) => ({ id: b.id, data: b.recebidoEm, forma: b.forma, descricao: t.descricao, v: porId.get(t.osId), valor: b.valor })),
    )
    .sort((a, b) => a.data.localeCompare(b.data));

  const despesasPagas = despesas
    .filter((d) => d.pagoEm && mesDe(d.pagoEm) === mes)
    .map((d) => ({ ...d, nomeCategoria: (d.categoriaId && nomeCategoria.get(d.categoriaId)) || d.categoria || "Sem categoria", pago: valorPagoDespesa(d) }))
    .sort((a, b) => (a.pagoEm ?? "").localeCompare(b.pagoEm ?? ""));

  const entregues = oss
    .filter((v) => v.os.estado !== "cancelada" && v.os.entregueEm && mesDe(v.os.entregueEm) === mes)
    .map((v) => ({ v, rel: relPorId.get(v.os.id)! }))
    .sort((a, b) => (a.v.os.entregueEm ?? "").localeCompare(b.v.os.entregueEm ?? ""));

  return {
    mes,
    competencia: resumoCompetencia(mes, titulos, despesas),
    porForma: faturamentoPorForma(titulos, mes),
    porDia: recebimentosPorDia(titulos, mes),
    baixas,
    porCategoria: despesasPorCategoria(despesas, mes, categorias),
    despesasPagas,
    porEstado: osPorEstado(rels, mes),
    entregues,
    ticket: ticketMedio(rels, mes),
    margem: margemEstimada(rels, mes),
    clientes: topClientes(rels, mes, 10).map((c) => ({ ...c, nome: nomeCliente.get(c.clienteId) ?? "Cliente" })),
    materiais: pecasConsumidas(movimentos, materiais, mes),
  };
}

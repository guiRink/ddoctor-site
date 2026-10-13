// CSV de cada aba dos Relatórios (o detalhe que a planilha consegue somar e filtrar).
import { ESTADO_OS, FORMA_PAGAMENTO } from "../../dominio/rotulos";
import { normalizarFormaPagamento } from "@compartilhado/dominio/pagamentos";
import { dataNoFuso } from "@compartilhado/dominio/fuso";
import { gerarCsv, reaisCsv, type CelulaCsv } from "./csv";
import type { DadosRelatorio } from "./dados";

export const ABAS_RELATORIO = [
  { chave: "faturamento", nome: "Faturamento" },
  { chave: "despesas", nome: "Despesas" },
  { chave: "os", nome: "Ordens de serviço" },
  { chave: "clientes", nome: "Clientes" },
  { chave: "materiais", nome: "Materiais" },
] as const;
export type AbaRelatorio = (typeof ABAS_RELATORIO)[number]["chave"];

const dataBr = (d?: string) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "");
export const nomeForma = (forma: string) => {
  const f = normalizarFormaPagamento(forma);
  return f ? FORMA_PAGAMENTO[f] : forma || "Outra";
};

/** Linhas do CSV da aba (cabeçalho na primeira). Custos e margem só com `veCustos`. */
export function linhasCsv(aba: AbaRelatorio, d: DadosRelatorio, veCustos: boolean): CelulaCsv[][] {
  switch (aba) {
    case "faturamento":
      return [
        ["Data", "Forma", "Título", "Placa", "OS", "Valor (R$)"],
        ...d.baixas.map((b) => [dataBr(b.data), nomeForma(b.forma), b.descricao, b.v?.veiculo.placa, b.v ? b.v.os.numero : "", reaisCsv(b.valor)]),
      ];
    case "despesas":
      return [
        ["Pago em", "Descrição", "Fornecedor", "Categoria", "Forma", "Valor pago (R$)"],
        ...d.despesasPagas.map((x) => [dataBr(x.pagoEm), x.descricao, x.fornecedor, x.nomeCategoria, x.formaPagamento ? FORMA_PAGAMENTO[x.formaPagamento] : "", reaisCsv(x.pago)]),
      ];
    case "os":
      return [
        ["OS", "Placa", "Modelo", "Cliente", "Estado", "Entregue em", "Receita (R$)", ...(veCustos ? ["Custo lançado (R$)", "Margem (R$)", "Margem (%)"] : [])],
        ...d.entregues.map(({ v, rel }) => {
          const margem = rel.custo === undefined ? undefined : rel.receita - rel.custo;
          return [
            v.os.numero,
            v.veiculo.placa,
            v.veiculo.modelo,
            v.cliente.nome,
            ESTADO_OS[v.os.estado].texto,
            dataBr(v.os.entregueEm ? dataNoFuso(v.os.entregueEm) : undefined),
            reaisCsv(rel.receita),
            ...(veCustos
              ? [
                  rel.custo === undefined ? "sem custo lançado" : reaisCsv(rel.custo),
                  reaisCsv(margem),
                  margem !== undefined && rel.receita > 0 ? Math.round((margem / rel.receita) * 1000) / 10 : "",
                ]
              : []),
          ];
        }),
      ];
    case "clientes":
      return [["Posição", "Cliente", "OS entregues", "Valor (R$)"], ...d.clientes.map((c, i) => [i + 1, c.nome, c.quantidadeOS, reaisCsv(c.total)])];
    case "materiais":
      return [["Material", "Quantidade", "Unidade", "Custo (R$)"], ...d.materiais.map((m) => [m.nome, m.quantidade, m.unidade, reaisCsv(m.custo)])];
  }
}

export function csvDaAba(aba: AbaRelatorio, d: DadosRelatorio, veCustos: boolean): string {
  return gerarCsv(linhasCsv(aba, d, veCustos));
}

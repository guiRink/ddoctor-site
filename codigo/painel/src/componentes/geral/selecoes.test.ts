import { describe, expect, it } from "vitest";
import type { EstadoOS, ItemOrcamento, OS } from "@compartilhado/tipos";
import type { OSVisao } from "../../dados/repositorio";
import { entregasDoMes, itensProducao, pecasDaOS } from "./selecoes";
import { paraRelatorio } from "../relatorios/montar";

function item(id: string, statusItem: ItemOrcamento["statusItem"], valor = 10000): ItemOrcamento {
  return { id, peca: id, tecnica: "martelinho", valor, statusItem };
}

function os(id: string, estado: EstadoOS, itens: ItemOrcamento[], osExtra: Partial<OS> = {}, extra: Partial<OSVisao> = {}): OSVisao {
  return {
    os: {
      id,
      numero: 1,
      veiculoId: `v-${id}`,
      clienteId: `c-${id}`,
      origem: "particular",
      estado,
      prioridade: 0,
      atendimentosExternos: [],
      criadoEm: "2026-10-01T09:00:00-03:00",
      atualizadoEm: "2026-10-01T09:00:00-03:00",
      ...osExtra,
    },
    veiculo: { id: `v-${id}`, placa: `ABC1D2${id.length}` },
    cliente: { id: `c-${id}`, nome: "Cliente" },
    atendimentos: [],
    versoes: [{ id: `ver-${id}`, osId: id, tipo: "interno", numeroVersao: 1, fonte: "manual", estado: "aprovado", itens, criadoEm: "2026-10-01T09:00:00-03:00" }],
    etapas: [],
    pendencias: [],
    titulos: [],
    fotos: [],
    custos: [],
    ...extra,
  };
}

describe("planejamento do Geral", () => {
  it("conta peças autorizadas e, sem autorização, as solicitadas não negadas", () => {
    expect(pecasDaOS(os("a", "na_oficina", [item("1", "autorizado"), item("2", "negado"), item("3", "autorizado")]))).toBe(2);
    expect(pecasDaOS(os("b", "agendada", [item("1", "solicitado"), item("2", "negado"), item("3", "dispensado")]))).toBe(1);
  });

  it("produção prevista só com OS a produzir", () => {
    const lista = [
      os("a", "na_oficina", [item("1", "autorizado")], { previsaoEntrega: "2026-10-14" }),
      os("b", "pronta", [item("1", "autorizado")], { previsaoEntrega: "2026-10-14" }),
      os("c", "entregue", [item("1", "autorizado")]),
    ];
    expect(itensProducao(lista).map((i) => i.v.os.id)).toEqual(["a"]);
  });

  it("agrupa entregas do mês por dia, incluindo prontas e ignorando outros meses", () => {
    const lista = [
      os("a", "na_oficina", [item("1", "autorizado")], { previsaoEntrega: "2026-10-14" }),
      os("bb", "pronta", [item("1", "autorizado"), item("2", "autorizado")], { previsaoEntrega: "2026-10-14" }),
      os("c", "agendada", [item("1", "autorizado")], { previsaoEntrega: "2026-11-02" }),
      os("d", "cancelada", [item("1", "autorizado")], { previsaoEntrega: "2026-10-20" }),
    ];
    const mapa = entregasDoMes(lista, "2026-10");
    expect([...mapa.keys()]).toEqual(["2026-10-14"]);
    expect(mapa.get("2026-10-14")!.reduce((s, e) => s + e.pecas, 0)).toBe(3);
  });

  it("monta o resumo de relatório: títulos não cancelados ou valor aprovado; custo ausente sem lançamento", () => {
    const semTitulo = os("a", "entregue", [item("1", "autorizado", 30000), item("2", "negado", 5000)]);
    expect(paraRelatorio(semTitulo)).toMatchObject({ receita: 30000, custo: undefined });
    const comTitulo = os("b", "entregue", [item("1", "autorizado", 30000)], {}, {
      titulos: [
        { id: "t1", osId: "b", pagadorId: "p", descricao: "x", valor: 25000, vencimento: "2026-10-10", estado: "recebido", baixas: [] },
        { id: "t2", osId: "b", pagadorId: "p", descricao: "y", valor: 9000, vencimento: "2026-10-10", estado: "cancelado", baixas: [] },
      ],
      custos: [{ id: "k", osId: "b", tipo: "outro", descricao: "z", quantidade: 1, custoUnitario: 4000, total: 4000, lancadoEm: "2026-10-02T09:00:00-03:00" }],
    });
    expect(paraRelatorio(comTitulo)).toMatchObject({ receita: 25000, custo: 4000 });
  });
});

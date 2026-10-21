import { describe, expect, it } from "vitest";
import type { AtendimentoExterno, ItemOrcamento, OrcamentoVersao, OS } from "@compartilhado/tipos";
import type { OSVisao } from "../../dados/repositorio";
import { diasDePatio, entreguesNoMes, faturadoPorSeguradora, negadosPorSeguradora, seguradoraDaOS, tempoMedioDePatio } from "./gestao";

const item = (id: string, statusItem: ItemOrcamento["statusItem"], valor = 10000): ItemOrcamento => ({ id, peca: id, tecnica: "martelinho", valor, statusItem });
const at = (seguradora: string): AtendimentoExterno => ({ id: `a-${seguradora}`, fonte: "manual", seguradora, statusNormalizado: "autorizado", estadoConciliacao: "ok" });
const versao = (id: string, itens: ItemOrcamento[], extra: Partial<OrcamentoVersao> = {}): OrcamentoVersao => ({
  id: `ver-${id}`,
  osId: id,
  tipo: "externo",
  numeroVersao: 1,
  fonte: "manual",
  estado: "aprovado",
  itens,
  criadoEm: "2026-10-01T09:00:00-03:00",
  ...extra,
});

function os(id: string, osExtra: Partial<OS>, extra: Partial<OSVisao> = {}): OSVisao {
  return {
    os: {
      id,
      numero: 1,
      veiculoId: `v-${id}`,
      clienteId: `c-${id}`,
      origem: "maxpar",
      estado: "entregue",
      prioridade: 0,
      atendimentosExternos: [],
      criadoEm: "2026-10-01T09:00:00-03:00",
      atualizadoEm: "2026-10-01T09:00:00-03:00",
      ...osExtra,
    },
    veiculo: { id: `v-${id}`, placa: "ABC1D23" },
    cliente: { id: `c-${id}`, nome: "Cliente" },
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

describe("relatórios de gestão", () => {
  it("o pagador é a seguradora, nunca a Maxpar; sem seguro é Particular", () => {
    expect(seguradoraDaOS(os("a", {}, { atendimentos: [at("Maxpar"), at("HDI")] }))).toBe("HDI");
    expect(seguradoraDaOS(os("b", { origem: "particular" }))).toBe("Particular");
    expect(seguradoraDaOS(os("c", {}, { atendimentos: [at("Maxpar")] }))).toBe("Seguradora não informada");
  });

  it("tempo de pátio da entrada à entrega, e a média ignora quem não tem as datas", () => {
    const a = os("a", { entradaRealEm: "2026-10-01T09:00:00-03:00", entregueEm: "2026-10-04T21:00:00-03:00" });
    const b = os("b", { entradaRealEm: "2026-10-02T09:00:00-03:00", entregueEm: "2026-10-03T09:00:00-03:00" });
    const c = os("c", { entregueEm: "2026-10-03T09:00:00-03:00" });
    expect(diasDePatio(a)).toBe(3.5);
    expect(diasDePatio(c)).toBeNull();
    expect(tempoMedioDePatio([a, b, c])).toEqual({ media: 2.3, quantidade: 2 });
    expect(tempoMedioDePatio([])).toEqual({ media: null, quantidade: 0 });
  });

  it("faturado por seguradora soma a receita dos entregues no mês, sem canceladas", () => {
    const hdi1 = os("h1", { entregueEm: "2026-10-05T10:00:00-03:00" }, { atendimentos: [at("HDI")], versoes: [versao("h1", [item("p1", "autorizado", 30000)])] });
    const hdi2 = os("h2", { entregueEm: "2026-10-06T10:00:00-03:00" }, { atendimentos: [at("HDI")], versoes: [versao("h2", [item("p2", "autorizado", 20000), item("p3", "negado", 9000)])] });
    const part = os("p", { origem: "particular", entregueEm: "2026-10-07T10:00:00-03:00" }, { versoes: [versao("p", [item("p4", "autorizado", 15000)], { tipo: "interno" })] });
    const setembro = os("s", { entregueEm: "2026-09-29T10:00:00-03:00" }, { atendimentos: [at("Liberty")] });
    const cancelada = os("x", { estado: "cancelada", entregueEm: "2026-10-08T10:00:00-03:00" }, { atendimentos: [at("Liberty")] });
    const entregues = entreguesNoMes([part, hdi2, hdi1, setembro, cancelada], "2026-10");
    expect(entregues.map((v) => v.os.id)).toEqual(["h1", "h2", "p"]);
    expect(faturadoPorSeguradora(entregues)).toEqual([
      { seguradora: "HDI", carros: 2, valor: 50000 },
      { seguradora: "Particular", carros: 1, valor: 15000 },
    ]);
  });

  it("negados por seguradora contam só a versão externa vigente das OS abertas no mês", () => {
    const hdi = os("h", { estado: "na_oficina" }, {
      atendimentos: [at("HDI")],
      versoes: [
        versao("h", [item("a", "negado"), item("b", "negado")], { id: "v1", estado: "substituido" }),
        versao("h", [item("a", "negado", 5000), item("b", "autorizado")], { id: "v2", numeroVersao: 2 }),
      ],
    });
    const liberty = os("l", { estado: "aguardando_aprovacao" }, { atendimentos: [at("Liberty")], versoes: [versao("l", [item("c", "negado", 7000), item("d", "negado", 3000)], { estado: "recusado" })] });
    const antiga = os("o", { criadoEm: "2026-09-20T09:00:00-03:00" }, { atendimentos: [at("Tokio")], versoes: [versao("o", [item("e", "negado")])] });
    expect(negadosPorSeguradora([hdi, liberty, antiga], "2026-10")).toEqual([
      { seguradora: "Liberty", itens: 2, carros: 1, valor: 10000 },
      { seguradora: "HDI", itens: 1, carros: 1, valor: 5000 },
    ]);
  });
});

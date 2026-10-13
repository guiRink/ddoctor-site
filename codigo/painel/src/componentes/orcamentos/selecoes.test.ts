import { describe, expect, it } from "vitest";
import type { Agendamento, ConfigOficina, EstadoOS, OS, TituloReceber } from "@compartilhado/tipos";
import type { OSVisao } from "../../dados/repositorio";
import { combinaBusca, contagemPecas, estadosDoFiltro, painelDoDia, valorDaLista } from "./selecoes";

const AGORA = "2026-10-12T10:00:00-03:00";
const CONFIG: ConfigOficina = {
  expediente: { diasSemana: [1, 2, 3, 4, 5, 6], inicio: "08:00", fim: "18:00", sabadoFim: "12:00" },
  semaforo: { laranjaAntesHoras: 8, vermelhoBloqueioHoras: 4 },
  capacidadePadrao: { vagasEntrada: 4, carrosSimultaneos: 12 },
  provisorio: true,
};

function os(id: string, estado: EstadoOS, extra: Partial<OSVisao> = {}, osExtra: Partial<OS> = {}): OSVisao {
  return {
    os: {
      id,
      numero: 1000,
      veiculoId: `v-${id}`,
      clienteId: `c-${id}`,
      origem: "maxpar",
      estado,
      prioridade: 0,
      atendimentosExternos: [],
      criadoEm: "2026-10-01T09:00:00-03:00",
      atualizadoEm: "2026-10-12T09:00:00-03:00",
      ...osExtra,
    },
    veiculo: { id: `v-${id}`, placa: "RJC8T15", modelo: "Audi Q5" },
    cliente: { id: `c-${id}`, nome: "Marina Albuquerque" },
    atendimentos: [],
    versoes: [],
    etapas: [],
    pendencias: [],
    titulos: [],
    fotos: [],
    ...extra,
  };
}

describe("painelDoDia", () => {
  it("separa entradas de hoje, saídas, prontos e alertas", () => {
    const lista = [
      os("a", "agendada"),
      os("b", "pronta", {}, { previsaoEntrega: "2026-10-12" }),
      os("c", "pronta", {}, { previsaoEntrega: "2026-10-13" }),
      os("d", "aguardando_aprovacao", {
        atendimentos: [
          { id: "at", fonte: "manual", seguradora: "HDI", statusNormalizado: "aguardando_autorizacao", aberturaEm: "2026-10-07", limiteVistoriaEm: "2026-10-13", estadoConciliacao: "ok" },
        ],
      }),
      os("e", "aguardando_agendamento"),
      os("f", "aguardando_agendamento"),
    ];
    const ags: Agendamento[] = [
      { id: "g1", osId: "a", data: "2026-10-12", janela: "tarde", estado: "confirmado", origem: "recepcao" },
      { id: "g2", osId: "f", data: "2026-10-13", janela: "manha", estado: "proposto", origem: "calia", expiraEm: "2026-10-12T12:00:00-03:00" },
    ];
    const p = painelDoDia(lista, ags, [], AGORA, CONFIG);
    expect(p.entradasHoje.map((x) => x.v.os.id)).toEqual(["a"]);
    expect(p.saemHoje.map((v) => v.os.id)).toEqual(["b"]);
    expect(p.prontos.map((v) => v.os.id)).toEqual(["c"]);
    expect(p.naOficina).toHaveLength(2);
    expect(p.semAutorizacao.map((x) => [x.v.os.id, x.dias])).toEqual([["d", 5]]);
    expect(p.vistoriaVencendo.map((x) => [x.v.os.id, x.dias])).toEqual([["d", 1]]);
    // a OS com proposta da Calia sai da fila "aguardando agendamento" e vai para "propostas"
    expect(p.aguardandoAgendamento.map((v) => v.os.id)).toEqual(["e"]);
    expect(p.propostasCalia.map((x) => x.v.os.id)).toEqual(["f"]);
  });

  it("soma dinheiro: vencido pelo saldo, a vencer em 7 dias e recebido no mês", () => {
    const titulos: TituloReceber[] = [
      { id: "t1", osId: "x", pagadorId: "pg", descricao: "Mão de obra", valor: 50000, vencimento: "2026-10-01", estado: "parcial", baixas: [{ id: "b1", valor: 20000, recebidoEm: "2026-10-05", forma: "Pix" }] },
      { id: "t2", osId: "x", pagadorId: "pg", descricao: "Franquia", valor: 16000, vencimento: "2026-10-15", estado: "emitido", baixas: [] },
      { id: "t3", osId: "x", pagadorId: "pg", descricao: "Longe", valor: 9900, vencimento: "2026-11-30", estado: "emitido", baixas: [] },
      { id: "t4", osId: "x", pagadorId: "pg", descricao: "Recebido mês passado", valor: 7000, vencimento: "2026-09-10", estado: "recebido", baixas: [{ id: "b2", valor: 7000, recebidoEm: "2026-09-12", forma: "Pix" }] },
    ];
    const p = painelDoDia([], [], titulos, AGORA, CONFIG);
    expect(p.vencidos.map((i) => [i.t.id, i.saldo])).toEqual([["t1", 30000]]);
    expect(p.aVencer7.map((i) => i.t.id)).toEqual(["t2"]);
    expect(p.recebidoMes).toBe(20000);
  });
});

describe("lista de orçamentos", () => {
  it("busca por placa sem traço, cliente sem acento, protocolo e número da OS", () => {
    const v = os("a", "agendada", {
      atendimentos: [{ id: "at", fonte: "manual", seguradora: "MAPFRE", idExterno: "18389907", statusNormalizado: "autorizado", estadoConciliacao: "ok" }],
    });
    expect(combinaBusca(v, "rjc-8t")).toBe(true);
    expect(combinaBusca(v, "albuquerque")).toBe(true);
    expect(combinaBusca(v, "MARINA")).toBe(true);
    expect(combinaBusca(v, "18389907")).toBe(true);
    expect(combinaBusca(v, "1000")).toBe(true);
    expect(combinaBusca(v, "volvo")).toBe(false);
  });

  it("aceita aba conhecida ou lista de estados no filtro", () => {
    expect(estadosDoFiltro(null)).toEqual({ chave: "todos", estados: [] });
    expect(estadosDoFiltro("entregue").estados).toEqual(["entregue", "encerrada"]);
    expect(estadosDoFiltro("na_oficina,pronta").estados).toEqual(["na_oficina", "pronta"]);
  });

  it("conta peças e escolhe o valor da lista pela situação da versão", () => {
    const versao = {
      id: "v1",
      osId: "a",
      tipo: "externo" as const,
      numeroVersao: 1,
      fonte: "manual" as const,
      estado: "aprovado" as const,
      criadoEm: AGORA,
      itens: [
        { id: "1", peca: "Capô", tecnica: "martelinho" as const, valor: 42000, statusItem: "autorizado" as const },
        { id: "2", peca: "Teto", tecnica: "martelinho" as const, valor: 45000, statusItem: "negado" as const },
      ],
    };
    expect(contagemPecas(versao)).toEqual({ autorizadas: 1, total: 2, negadas: 1 });
    expect(valorDaLista(versao)).toEqual({ valor: 42000, aprovado: true });
    expect(valorDaLista({ ...versao, estado: "enviado" })).toEqual({ valor: 87000, aprovado: false });
  });
});

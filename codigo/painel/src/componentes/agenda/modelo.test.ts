import { describe, expect, it } from "vitest";
import type { OS } from "@compartilhado/tipos";
import type { OSVisao } from "../../dados/repositorio";
import { JA_ESTA_AQUI, avaliarDestino, chavesEmOrdem, clienteCurto, origemCurta, podeMover, saidasDoDia, selecionarIntervalo, separarQueCabem, tamanhoServico, type DiaAgenda, type Movel } from "./modelo";

function dia(extra: Partial<DiaAgenda> = {}): DiaAgenda {
  return {
    data: "2026-10-23",
    total: 4,
    ocupadas: 2,
    restantes: 2,
    fechado: false,
    periodosFechados: [],
    hoje: false,
    passado: false,
    itens: { manha: [], tarde: [] },
    ...extra,
  };
}

const daGrade = (n: number, data = "2026-10-21", janela: "manha" | "tarde" = "manha"): Movel => ({
  chave: `ag:${n}`,
  osId: `os-${n}`,
  agendamentoId: `${n}`,
  data,
  janela,
  placa: `ABC1D0${n}`,
});
const daFila = (n: number): Movel => ({ chave: `os:${n}`, osId: `os-${n}`, placa: `QWE2R0${n}` });

describe("avaliarDestino", () => {
  it("aceita quando há vaga para todos", () => {
    expect(avaliarDestino(dia(), "tarde", [daGrade(1), daFila(2)])).toEqual({ ok: true, cabem: 2, total: 2, encaixe: 0, motivo: undefined });
  });

  it("recusa com motivo curto: passado, bloqueado, sem expediente, turno fechado", () => {
    const g = [daGrade(1)];
    expect(avaliarDestino(dia({ passado: true }), "manha", g).motivo).toBe("Data passada");
    expect(avaliarDestino(dia({ bloqueado: "Feriado", total: 0, restantes: 0 }), "manha", g).motivo).toBe("Dia bloqueado");
    expect(avaliarDestino(dia({ fechado: true }), "manha", g).motivo).toBe("Sem expediente");
    expect(avaliarDestino(dia({ periodosFechados: ["tarde"] }), "tarde", g).motivo).toBe("Fechado à tarde");
    expect(avaliarDestino(undefined, "manha", g).ok).toBe(false);
  });

  it("trocar manhã por tarde no mesmo dia não ocupa vaga nova (mesmo lotado)", () => {
    const cheio = dia({ restantes: 0, ocupadas: 4 });
    const g = [daGrade(1, cheio.data, "manha")];
    expect(avaliarDestino(cheio, "tarde", g)).toMatchObject({ ok: true, cabem: 1, total: 1 });
  });

  it("soltar no mesmo lugar não faz nada", () => {
    const d = dia();
    expect(avaliarDestino(d, "manha", [daGrade(1, d.data, "manha")])).toMatchObject({ ok: false, motivo: JA_ESTA_AQUI });
  });

  it("dia lotado não recusa: vira encaixe", () => {
    expect(avaliarDestino(dia({ restantes: 0, ocupadas: 4 }), "manha", [daGrade(1)])).toEqual({ ok: true, cabem: 0, total: 1, encaixe: 1, motivo: "Lotado — encaixe" });
  });

  it("grupo maior que a vaga: cabem alguns, o resto é encaixe", () => {
    const r = avaliarDestino(dia({ restantes: 1 }), "manha", [daGrade(1), daGrade(2), daFila(3)]);
    expect(r).toEqual({ ok: true, cabem: 1, total: 3, encaixe: 2, motivo: "Cabem 1 de 3" });
  });
});

describe("separarQueCabem", () => {
  it("leva primeiro quem já está no dia e preenche as vagas na ordem do grupo", () => {
    const d = dia({ restantes: 1 });
    const mesmoDia = daGrade(9, d.data, "manha");
    const { vao, ficam } = separarQueCabem(d, "tarde", [daGrade(1), mesmoDia, daFila(2)]);
    expect(vao.map((m) => m.chave)).toEqual(["ag:1", "ag:9"]);
    expect(ficam.map((m) => m.chave)).toEqual(["os:2"]);
  });

  it("ignora quem já está no turno de destino", () => {
    const d = dia();
    const { vao, ficam } = separarQueCabem(d, "manha", [daGrade(1, d.data, "manha"), daGrade(2)]);
    expect(vao.map((m) => m.chave)).toEqual(["ag:2"]);
    expect(ficam).toEqual([]);
  });
});

describe("podeMover", () => {
  const v = (estado: OS["estado"]) => ({ os: { estado } }) as OSVisao;
  it("só antes de o carro entrar na oficina", () => {
    expect(podeMover(v("agendada"))).toBe(true);
    expect(podeMover(v("aguardando_agendamento"))).toBe(true);
    expect(podeMover(v("na_oficina"))).toBe(false);
    expect(podeMover(v("pronta"))).toBe(false);
    expect(podeMover(undefined)).toBe(false);
  });
});

describe("seleção", () => {
  it("clienteCurto: primeiro nome + inicial do último", () => {
    expect(clienteCurto("Marcos Silva souza")).toBe("Marcos S.");
    expect(clienteCurto("Ana")).toBe("Ana");
    expect(clienteCurto(undefined)).toBe("");
  });

  it("chavesEmOrdem segue dia a dia, manhã antes da tarde", () => {
    const ag = (id: string) => ({ ag: { id, osId: id, data: "2026-10-23", janela: "manha" as const, estado: "confirmado" as const, origem: "recepcao" as const } });
    const dias = [dia({ data: "2026-10-22", itens: { manha: [ag("a")], tarde: [ag("b")] } }), dia({ itens: { manha: [ag("c")], tarde: [] } })];
    expect(chavesEmOrdem(dias, () => true)).toEqual(["ag:a", "ag:b", "ag:c"]);
    expect(chavesEmOrdem(dias, (it) => it.ag.id !== "b")).toEqual(["ag:a", "ag:c"]);
  });

  it("Shift+clique seleciona do âncora até o alvo, sem repetir", () => {
    const ordem = ["a", "b", "c", "d"];
    expect(selecionarIntervalo(ordem, ["a"], "a", "c")).toEqual(["a", "b", "c"]);
    expect(selecionarIntervalo(ordem, ["d"], "d", "b")).toEqual(["d", "b", "c"]);
    expect(selecionarIntervalo(ordem, [], null, "b")).toEqual(["b"]);
  });
});

describe("cartão e cabeçalho", () => {
  const item = (tecnica: "martelinho" | "pintura", statusItem: "autorizado" | "negado" = "autorizado") => ({ id: tecnica + statusItem, peca: "Porta", tecnica, valor: 0, statusItem });
  const comVersoes = (versoes: unknown[]) => ({ versoes }) as unknown as OSVisao;

  it("tamanhoServico conta as peças da versão aprovada, sem as negadas", () => {
    const v = comVersoes([
      { numeroVersao: 1, itens: [item("pintura")], aprovacao: { tipo: "externa" } },
      { numeroVersao: 2, itens: [item("martelinho"), item("martelinho"), item("pintura", "negado")] },
    ]);
    expect(tamanhoServico(v)).toBe("1 peça · pintura");
    const s = comVersoes([{ numeroVersao: 1, itens: [item("martelinho"), { ...item("martelinho"), id: "x" }, item("pintura")] }]);
    expect(tamanhoServico(s)).toBe("3 peças · martelinho + pintura");
    expect(tamanhoServico(comVersoes([]))).toBeUndefined();
  });

  it("saidasDoDia: entrega prometida no dia, ainda na oficina ou pronta", () => {
    const v = (id: string, estado: OS["estado"], previsaoEntrega?: string) => ({ os: { id, estado, previsaoEntrega } }) as OSVisao;
    const lista = [v("a", "na_oficina", "2026-10-23"), v("b", "pronta", "2026-10-23"), v("c", "entregue", "2026-10-23"), v("d", "na_oficina", "2026-10-24")];
    expect(saidasDoDia(lista, "2026-10-23").map((x) => x.os.id)).toEqual(["a", "b"]);
  });
});


describe("origemCurta", () => {
  const v = (origem: OS["origem"], seguradoras: string[]) =>
    ({
      os: { origem },
      atendimentos: seguradoras.map((seguradora, i) => ({ id: `a${i}`, fonte: "manual", seguradora, statusNormalizado: "autorizado", estadoConciliacao: "ok" })),
    }) as unknown as OSVisao;
  it("nunca mostra a Maxpar como seguradora (mesma regra de seguradoraDaOS)", () => {
    expect(origemCurta(v("maxpar", ["Maxpar", "HDI"]), true)).toBe("HDI");
    expect(origemCurta(v("maxpar", ["Maxpar"]), true)).toBe("Seguradora");
    expect(origemCurta(v("misto", ["Liberty"]), true)).toBe("Liberty + particular");
    expect(origemCurta(v("maxpar", ["HDI"]), false)).toBe("Seguradora");
    expect(origemCurta(v("particular", []), true)).toBe("Particular");
  });
});

import { describe, expect, it } from "vitest";
import type { Material, MovimentoEstoque } from "../tipos";
import {
  aplicarMovimento,
  consumoPorFuncionario,
  custoMedioPonderado,
  diasSemSaida,
  estoqueParado,
  listaReposicao,
  situacaoMaterial,
  statusEstoque,
} from "./estoque";

const mat = (p: Partial<Material> = {}): Material => ({
  id: "m1",
  nome: "Massa poliéster",
  categoria: "massa/primer",
  unidade: "kg",
  saldoEstimado: 5,
  saldoMinimo: 2,
  ultimaConferenciaEm: "2026-10-01",
  custoMedio: 4500,
  ...p,
});
const hoje = "2026-10-12";

describe("statusEstoque", () => {
  it("ok com saldo acima do mínimo e conferência recente", () => {
    expect(statusEstoque(mat(), hoje)).toBe("ok");
    expect(statusEstoque(mat({ saldoEstimado: 2 }), hoje)).toBe("ok"); // igual ao mínimo não é baixo
  });
  it("baixo abaixo do mínimo; zerado em 0 ou negativo", () => {
    expect(statusEstoque(mat({ saldoEstimado: 1.5 }), hoje)).toBe("baixo");
    expect(statusEstoque(mat({ saldoEstimado: 0 }), hoje)).toBe("zerado");
    expect(statusEstoque(mat({ saldoEstimado: -1, saldoMinimo: 0 }), hoje)).toBe("zerado");
  });
  it("conferir depois de 90 dias ou nunca conferido; zerado/baixo têm prioridade", () => {
    expect(statusEstoque(mat({ ultimaConferenciaEm: "2026-07-14" }), hoje)).toBe("ok"); // 90 dias
    expect(statusEstoque(mat({ ultimaConferenciaEm: "2026-07-13" }), hoje)).toBe("conferir"); // 91 dias
    expect(statusEstoque(mat({ ultimaConferenciaEm: undefined }), hoje)).toBe("conferir");
    expect(statusEstoque(mat({ ultimaConferenciaEm: undefined, saldoEstimado: 1 }), hoje)).toBe("baixo");
    expect(statusEstoque(mat({ ultimaConferenciaEm: "2026-09-01" }), hoje, 30)).toBe("conferir");
  });
});

let seq = 0;
const mov = (p: Partial<MovimentoEstoque>): MovimentoEstoque => ({
  id: `mv${++seq}`,
  materialId: "m1",
  tipo: "saida_os",
  quantidade: 1,
  em: "2026-10-10T10:00:00-03:00",
  ...p,
});

describe("custoMedioPonderado", () => {
  it("pondera saldo e entrada, arredondando ao centavo", () => {
    expect(custoMedioPonderado(5, 4500, 5, 5500)).toBe(5000);
    expect(custoMedioPonderado(3, 1000, 1, 2000)).toBe(1250);
    expect(custoMedioPonderado(2, 1000, 1, 1001)).toBe(1000); // 1000,33
    expect(custoMedioPonderado(1, 1000, 1, 1001)).toBe(1001); // 1000,5 sobe
  });
  it("saldo zero ou negativo não pesa: vale o custo da entrada", () => {
    expect(custoMedioPonderado(0, 4500, 2, 6000)).toBe(6000);
    expect(custoMedioPonderado(-1, 4500, 2, 6000)).toBe(6000);
  });
});

describe("aplicarMovimento", () => {
  it("compra soma saldo e recalcula custo médio", () => {
    const r = aplicarMovimento(mat(), mov({ tipo: "entrada_compra", quantidade: 5, custoUnitario: 5500 }));
    if (!r.ok) throw new Error(r.codigo);
    expect(r.material.saldoEstimado).toBe(10);
    expect(r.material.custoMedio).toBe(5000);
  });
  it("compra sem custo unitário é recusada", () => {
    expect(aplicarMovimento(mat(), mov({ tipo: "entrada_compra", quantidade: 1 }))).toEqual({ ok: false, codigo: "custo_obrigatorio" });
    expect(aplicarMovimento(mat(), mov({ tipo: "entrada_compra", quantidade: 1, custoUnitario: 10.5 })).ok).toBe(false);
  });
  it("saída igual ao saldo zera; maior que o saldo é recusada; custo médio não muda", () => {
    const r = aplicarMovimento(mat(), mov({ quantidade: 5 }));
    if (!r.ok) throw new Error(r.codigo);
    expect(r.material.saldoEstimado).toBe(0);
    expect(r.material.custoMedio).toBe(4500);
    expect(aplicarMovimento(mat(), mov({ quantidade: 5.001 }))).toEqual({ ok: false, codigo: "saldo_insuficiente" });
    expect(aplicarMovimento(mat(), mov({ tipo: "consumo_interno", quantidade: 6 }))).toEqual({ ok: false, codigo: "saldo_insuficiente" });
  });
  it("frações sem erro de ponto flutuante (0,1 + 0,2 − 0,3 = 0)", () => {
    let m = mat({ saldoEstimado: 0.1 });
    const r1 = aplicarMovimento(m, mov({ tipo: "ajuste", sentido: "mais", quantidade: 0.2, obs: "contagem" }));
    if (!r1.ok) throw new Error(r1.codigo);
    m = r1.material;
    expect(m.saldoEstimado).toBe(0.3);
    const r2 = aplicarMovimento(m, mov({ quantidade: 0.3 }));
    expect(r2.ok && r2.material.saldoEstimado).toBe(0);
  });
  it("ajuste exige sentido e motivo; ajuste para menos não passa do saldo", () => {
    expect(aplicarMovimento(mat(), mov({ tipo: "ajuste", quantidade: 1, obs: "quebra" }))).toEqual({ ok: false, codigo: "sentido_obrigatorio" });
    expect(aplicarMovimento(mat(), mov({ tipo: "ajuste", sentido: "menos", quantidade: 1, obs: "  " }))).toEqual({ ok: false, codigo: "motivo_obrigatorio" });
    expect(aplicarMovimento(mat(), mov({ tipo: "ajuste", sentido: "menos", quantidade: 6, obs: "perda" }))).toEqual({ ok: false, codigo: "saldo_insuficiente" });
    const r = aplicarMovimento(mat(), mov({ tipo: "ajuste", sentido: "menos", quantidade: 2, obs: "lata amassada" }));
    expect(r.ok && r.material.saldoEstimado).toBe(3);
  });
  it("quantidade zero/negativa, material trocado e saída de inativo", () => {
    expect(aplicarMovimento(mat(), mov({ quantidade: 0 }))).toEqual({ ok: false, codigo: "quantidade_invalida" });
    expect(aplicarMovimento(mat(), mov({ quantidade: -1 }))).toEqual({ ok: false, codigo: "quantidade_invalida" });
    expect(aplicarMovimento(mat(), mov({ materialId: "m2" }))).toEqual({ ok: false, codigo: "material_divergente" });
    expect(aplicarMovimento(mat({ ativo: false }), mov({}))).toEqual({ ok: false, codigo: "material_inativo" });
    expect(aplicarMovimento(mat({ ativo: false }), mov({ tipo: "entrada_compra", custoUnitario: 100 })).ok).toBe(true);
  });
});

describe("situacaoMaterial e listaReposicao", () => {
  it("sem_estoque ≤ 0; crítico abaixo do mínimo; no mínimo é normal", () => {
    expect(situacaoMaterial(mat({ saldoEstimado: 0 }))).toBe("sem_estoque");
    expect(situacaoMaterial(mat({ saldoEstimado: 1.9 }))).toBe("critico");
    expect(situacaoMaterial(mat({ saldoEstimado: 2 }))).toBe("normal");
  });
  it("lista ativos abaixo do mínimo, sem estoque primeiro, com quanto falta e custo estimado", () => {
    const lista = listaReposicao([
      mat({ id: "a", nome: "Verniz", saldoEstimado: 1, saldoMinimo: 3, custoMedio: 10000 }),
      mat({ id: "b", nome: "Lixa", saldoEstimado: -2, saldoMinimo: 10, custoMedio: 150 }),
      mat({ id: "c", nome: "Fita", saldoEstimado: 5 }),
      mat({ id: "d", nome: "Cera", saldoEstimado: 0, saldoMinimo: 4, ativo: false }),
      mat({ id: "e", nome: "Solvente", saldoEstimado: 0, saldoMinimo: 0 }),
    ]);
    expect(lista.map((i) => [i.material.id, i.situacao, i.faltam, i.custoEstimado])).toEqual([
      ["b", "sem_estoque", 10, 1500],
      ["a", "critico", 2, 20000],
    ]);
  });
});

describe("estoque parado", () => {
  const agora = "2026-10-13T10:00:00-03:00";
  it("90 dias desde a última saída é parado; 89 não", () => {
    expect(estoqueParado(mat(), [mov({ em: "2026-07-15T09:00:00-03:00" })], agora)).toBe(true);
    expect(estoqueParado(mat(), [mov({ em: "2026-07-16T09:00:00-03:00" })], agora)).toBe(false);
    expect(estoqueParado(mat(), [mov({ em: "2026-09-01T09:00:00-03:00" })], agora, 30)).toBe(true);
  });
  it("data da saída no fuso da oficina (22h30 em SP já é dia seguinte em UTC)", () => {
    expect(diasSemSaida(mat(), [mov({ em: "2026-07-16T01:30:00Z" })], agora)).toBe(90);
  });
  it("usa a última saída, não a última entrada; sem saída conta da 1ª movimentação", () => {
    const movs = [
      mov({ em: "2026-06-01T10:00:00-03:00" }),
      mov({ tipo: "entrada_compra", custoUnitario: 1, em: "2026-10-01T10:00:00-03:00" }),
      mov({ materialId: "outro", em: "2026-10-12T10:00:00-03:00" }),
    ];
    expect(estoqueParado(mat(), movs, agora)).toBe(true);
    expect(estoqueParado(mat(), [mov({ tipo: "entrada_compra", custoUnitario: 1, em: "2026-10-01T10:00:00-03:00" })], agora)).toBe(false);
  });
  it("sem movimento usa a última conferência; sem nada não marca; saldo zero ou inativo não é parado", () => {
    expect(estoqueParado(mat({ ultimaConferenciaEm: "2026-01-10" }), [], agora)).toBe(true);
    expect(estoqueParado(mat({ ultimaConferenciaEm: undefined }), [], agora)).toBe(false);
    expect(diasSemSaida(mat({ ultimaConferenciaEm: undefined }), [], agora)).toBeNull();
    expect(estoqueParado(mat({ saldoEstimado: 0, ultimaConferenciaEm: "2026-01-10" }), [], agora)).toBe(false);
    expect(estoqueParado(mat({ ativo: false, ultimaConferenciaEm: "2026-01-10" }), [], agora)).toBe(false);
  });
});

describe("consumoPorFuncionario", () => {
  it("agrupa saídas por funcionário e material; custo do movimento ou custo médio; entradas fora", () => {
    const materiais = [mat(), mat({ id: "m2", nome: "Lixa 600", unidade: "un", custoMedio: 150 })];
    const r = consumoPorFuncionario(
      [
        mov({ perfilId: "p1", quantidade: 0.5, custoUnitario: 4600 }),
        mov({ perfilId: "p1", quantidade: 0.25 }),
        mov({ perfilId: "p1", materialId: "m2", tipo: "consumo_interno", quantidade: 10 }),
        mov({ perfilId: "p2", materialId: "m2", quantidade: 4 }),
        mov({ quantidade: 1 }),
        mov({ perfilId: "p2", tipo: "entrada_compra", quantidade: 50, custoUnitario: 4000 }),
      ],
      materiais,
    );
    expect(r.map((g) => [g.perfilId, g.custo])).toEqual([
      ["p1", 2300 + 1125 + 1500],
      [null, 4500],
      ["p2", 600],
    ]);
    expect(r[0].itens.map((i) => [i.materialId, i.quantidade, i.custo])).toEqual([
      ["m1", 0.75, 3425],
      ["m2", 10, 1500],
    ]);
  });
});

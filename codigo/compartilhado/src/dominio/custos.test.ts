import { describe, expect, it } from "vitest";
import type { CustoOS } from "../tipos";
import { custoMaoDeObra, resultadoOS, totalCusto } from "./custos";

const custo = (tipo: CustoOS["tipo"], total: number): CustoOS => ({
  id: `${tipo}-${total}`,
  osId: "os1",
  tipo,
  descricao: tipo,
  quantidade: 1,
  custoUnitario: total,
  total,
  lancadoEm: "2026-10-12T10:00:00-03:00",
});

describe("custoMaoDeObra", () => {
  it("por hora: minutos/60 × valor da hora, arredondado ao centavo", () => {
    expect(custoMaoDeObra({ modo: "hora", minutos: 90, valorUnitario: 4000 })).toBe(6000);
    expect(custoMaoDeObra({ modo: "hora", minutos: 7, valorUnitario: 3333 })).toBe(389); // 388,85
    expect(custoMaoDeObra({ modo: "hora", minutos: 0, valorUnitario: 4000 })).toBe(0);
  });
  it("por minuto e fixo", () => {
    expect(custoMaoDeObra({ modo: "minuto", minutos: 45, valorUnitario: 70 })).toBe(3150);
    expect(custoMaoDeObra({ modo: "fixo", minutos: 999, valorUnitario: 15000 })).toBe(15000);
  });
  it("minutos ou valor negativos são erro", () => {
    expect(() => custoMaoDeObra({ modo: "hora", minutos: -1, valorUnitario: 100 })).toThrow("minutos_invalidos");
    expect(() => custoMaoDeObra({ modo: "fixo", minutos: 0, valorUnitario: -1 })).toThrow("valor_invalido");
  });
  it("totalCusto arredonda quantidade fracionária", () => {
    expect(totalCusto(0.35, 4590)).toBe(1607); // 1606,5 → 1607
    expect(totalCusto(3, 1250)).toBe(3750);
  });
});

describe("resultadoOS", () => {
  const custos = [custo("insumo", 12000), custo("insumo", 3000), custo("mao_de_obra", 20000), custo("terceiro", 5000), custo("outro", 1000)];
  it("receita − desconto − custos por tipo", () => {
    expect(resultadoOS(100000, 10000, custos)).toEqual({
      receita: 90000,
      custoInsumos: 15000,
      custoMaoDeObra: 20000,
      custoTerceiros: 5000,
      custoOutros: 1000,
      custoTotal: 41000,
      margem: 49000,
      margemPct: 49000 / 90000,
    });
  });
  it("sem custos: margem = receita, 100 %", () => {
    const r = resultadoOS(50000, 0, []);
    expect(r.margem).toBe(50000);
    expect(r.margemPct).toBe(1);
  });
  it("receita zero: margemPct null e margem negativa", () => {
    const r = resultadoOS(0, 0, [custo("insumo", 500)]);
    expect(r.margemPct).toBeNull();
    expect(r.margem).toBe(-500);
  });
  it("desconto maior que o valor zera a receita; desconto negativo é ignorado", () => {
    expect(resultadoOS(10000, 20000, []).receita).toBe(0);
    expect(resultadoOS(10000, -500, []).receita).toBe(10000);
  });
  it("custo maior que a receita: margem negativa", () => {
    expect(resultadoOS(10000, 0, [custo("terceiro", 15000)]).margemPct).toBe(-0.5);
  });
});

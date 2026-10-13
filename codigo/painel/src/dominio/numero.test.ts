import { describe, expect, it } from "vitest";
import { lerNumero } from "./numero";
import { lerDecimal } from "../componentes/os/formato";
import { lerQuantidade } from "../componentes/financeiro/formato";

describe("lerNumero", () => {
  it.each([
    ["2", 2],
    ["1,5", 1.5],
    ["1.5", 1.5],
    ["0,25", 0.25],
    [",5", 0.5],
    ["1.000", 1000],
    ["1.000.000", 1000000],
    ["1.000,5", 1000.5],
    ["12.345,67", 12345.67],
    ["0.125", 0.125],
    ["  3,0 ", 3],
    ["1,", 1],
  ])("%s → %s", (texto, esperado) => {
    expect(lerNumero(texto)).toBe(esperado);
  });

  it.each(["", "   ", ",", ".", "0x10", "1e3", "-1", "+1", "1,000.5", "1,2,3", "1.2.3", "1.00,5", "abc", "Infinity", "1 000"])(
    "recusa %j",
    (texto) => {
      expect(lerNumero(texto)).toBeNull();
    },
  );

  it("lerDecimal e lerQuantidade seguem a mesma regra", () => {
    for (const f of [lerDecimal, lerQuantidade]) {
      expect(f("1.000")).toBe(1000);
      expect(f("1,5")).toBe(1.5);
      expect(f("1.5")).toBe(1.5);
      expect(f("0x10")).toBeNull();
      expect(f("1e3")).toBeNull();
    }
  });
});

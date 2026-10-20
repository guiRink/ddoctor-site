import { describe, expect, it } from "vitest";
import type { Foto } from "../tipos";
import { expiracaoFoto, fotosDaEtapa, somarMeses } from "./fotos";

const foto = (id: string, extra: Partial<Foto>): Foto => ({ id, osId: "os-1", fase: "durante", url: "", origem: "interna", tiradaEm: "2026-10-20T10:00:00-03:00", ...extra });

describe("fotos: retenção e etapa", () => {
  it("somarMeses vira o ano e ajusta o fim do mês", () => {
    expect(somarMeses("2026-10-20", 12)).toBe("2027-10-20");
    expect(somarMeses("2027-01-31", 1)).toBe("2027-02-28");
    expect(somarMeses("2027-02-28", 12)).toBe("2028-02-28");
    expect(somarMeses("2028-02-29", 12)).toBe("2029-02-28");
  });

  it("expira 12 meses depois da entrega; sem entrega é estimativa provisória", () => {
    expect(expiracaoFoto(foto("a", {}), { entregueEm: "2026-11-03T17:00:00-03:00" })).toEqual({ expiraEm: "2027-11-03", provisorio: false });
    expect(expiracaoFoto(foto("a", {}), { previsaoEntrega: "2026-10-25" })).toEqual({ expiraEm: "2027-10-25", provisorio: true });
    expect(expiracaoFoto(foto("a", {}), undefined)).toEqual({ expiraEm: "2027-10-20", provisorio: true });
  });

  it("só fotos durante/final da mesma OS e ligadas à etapa comprovam a etapa", () => {
    const fotos = [
      foto("1", { etapaId: "et-1" }),
      foto("2", { etapaId: "et-1", fase: "final" }),
      foto("3", { etapaId: "et-1", fase: "entrada" }),
      foto("4", { etapaId: "et-2" }),
      foto("5", { etapaId: "et-1", osId: "os-2" }),
      foto("6", {}),
    ];
    expect(fotosDaEtapa(fotos, "os-1", "et-1").map((f) => f.id)).toEqual(["1", "2"]);
  });
});

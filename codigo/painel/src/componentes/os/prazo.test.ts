import { describe, expect, it } from "vitest";
import type { OS } from "@compartilhado/tipos";
import { CONFIG_PADRAO } from "@compartilhado/dominio/config";
import type { OSVisao } from "../../dados/repositorio";
import { prazoAtual, temPrazoProprio } from "./prazo";

// qua 21/10/2026; expediente padrão seg–sáb
const AGORA = "2026-10-21T10:00:00-03:00";
const visao = (os: Partial<OS>): OSVisao =>
  ({ os: { id: "os-1", numero: 1, veiculoId: "v", clienteId: "c", origem: "particular", estado: "na_oficina", prioridade: 0, atendimentosExternos: [], criadoEm: AGORA, atualizadoEm: AGORA, ...os } }) as OSVisao;

describe("prazo do carro na ficha", () => {
  it("prazo atual: o do carro; senão, os dias úteis da entrada à entrega; senão, o padrão da oficina", () => {
    expect(prazoAtual(visao({ alerta: { prazoDiasUteis: 7 } }), CONFIG_PADRAO, AGORA)).toBe(7);
    // entrada seg 19/10 → entrega sex 23/10 = 4 dias úteis (ter, qua, qui, sex)
    expect(prazoAtual(visao({ entradaRealEm: "2026-10-19T09:00:00-03:00", previsaoEntrega: "2026-10-23" }), CONFIG_PADRAO, AGORA)).toBe(4);
    expect(prazoAtual(visao({ entradaRealEm: "2026-10-19T09:00:00-03:00" }), CONFIG_PADRAO, AGORA)).toBe(10);
  });
  it("prazo próprio só quando difere da base da oficina", () => {
    expect(temPrazoProprio(visao({}), CONFIG_PADRAO)).toBe(false);
    expect(temPrazoProprio(visao({ alerta: { prazoDiasUteis: 10 } }), CONFIG_PADRAO)).toBe(false); // = padrão
    expect(temPrazoProprio(visao({ alerta: { prazoDiasUteis: 15 } }), CONFIG_PADRAO)).toBe(true);
    expect(temPrazoProprio(visao({ alerta: { laranjaDiasAntes: 3 } }), CONFIG_PADRAO)).toBe(true);
  });
});

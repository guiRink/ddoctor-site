import { describe, expect, it } from "vitest";
import { CONFIG_PADRAO, aplicarConfig, campoConfigProvisorio } from "./config";

describe("aplicarConfig", () => {
  it("salva a capacidade e só os campos salvos deixam de ser provisórios", () => {
    const r = aplicarConfig(CONFIG_PADRAO, { capacidadePadrao: { vagasEntrada: 5, pecasDia: 12 } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.capacidadePadrao).toEqual({ vagasEntrada: 5, carrosSimultaneos: 12, pecasDia: 12 });
    expect(r.campos).toEqual(["vagasEntrada", "pecasDia"]);
    expect(campoConfigProvisorio(r.config, "vagasEntrada")).toBe(false);
    expect(campoConfigProvisorio(r.config, "carrosSimultaneos")).toBe(true);
    expect(r.config.provisorio).toBe(true);
  });

  it("recusa fora dos limites ou não inteiro, dizendo o campo", () => {
    expect(aplicarConfig(CONFIG_PADRAO, { capacidadePadrao: { vagasEntrada: 0 } })).toEqual({ ok: false, codigo: "valor_invalido", campo: "vagasEntrada" });
    expect(aplicarConfig(CONFIG_PADRAO, { capacidadePadrao: { vagasEntrada: 31 } })).toEqual({ ok: false, codigo: "valor_invalido", campo: "vagasEntrada" });
    expect(aplicarConfig(CONFIG_PADRAO, { capacidadePadrao: { carrosSimultaneos: 61 } })).toEqual({ ok: false, codigo: "valor_invalido", campo: "carrosSimultaneos" });
    expect(aplicarConfig(CONFIG_PADRAO, { capacidadePadrao: { pecasDia: 2.5 } })).toEqual({ ok: false, codigo: "valor_invalido", campo: "pecasDia" });
    expect(aplicarConfig(CONFIG_PADRAO, { capacidadePadrao: { pecasDia: 201 } })).toEqual({ ok: false, codigo: "valor_invalido", campo: "pecasDia" });
    expect(aplicarConfig(CONFIG_PADRAO, { semaforo: { laranjaAntesHoras: -1 } })).toEqual({ ok: false, codigo: "valor_invalido", campo: "laranjaAntesHoras" });
    expect(aplicarConfig(CONFIG_PADRAO, {})).toEqual({ ok: false, codigo: "nada_a_salvar" });
  });

  it("valida o expediente e, com tudo confirmado, a configuração deixa de ser provisória", () => {
    expect(aplicarConfig(CONFIG_PADRAO, { expediente: { diasSemana: [], inicio: "08:00", fim: "18:00" } }).ok).toBe(false);
    expect(aplicarConfig(CONFIG_PADRAO, { expediente: { diasSemana: [1, 7], inicio: "08:00", fim: "18:00" } }).ok).toBe(false);
    expect(aplicarConfig(CONFIG_PADRAO, { expediente: { diasSemana: [1], inicio: "18:00", fim: "08:00" } }).ok).toBe(false);
    expect(aplicarConfig(CONFIG_PADRAO, { expediente: { diasSemana: [1], inicio: "8h", fim: "18:00" } }).ok).toBe(false);
    const r = aplicarConfig(CONFIG_PADRAO, {
      capacidadePadrao: { vagasEntrada: 4, carrosSimultaneos: 12, pecasDia: 10 },
      expediente: { diasSemana: [6, 1, 2, 3, 4, 5], inicio: "08:00", fim: "18:00", sabadoFim: "12:00" },
      semaforo: { laranjaAntesHoras: 8, vermelhoBloqueioHoras: 4 },
    });
    expect(r.ok && r.config.provisorio).toBe(false);
    expect(r.ok && r.config.expediente.diasSemana).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("laranja por fração do prazo: 50 % a 95 %, marca o semáforo como confirmado", () => {
    const r = aplicarConfig(CONFIG_PADRAO, { semaforo: { laranjaFracao: 0.75 } });
    expect(r.ok && r.config.semaforo.laranjaFracao).toBe(0.75);
    expect(r.ok && r.campos).toEqual(["semaforo"]);
    expect(r.ok && campoConfigProvisorio(r.config, "semaforo")).toBe(false);
    expect(r.ok && r.config.semaforo.vermelhoBloqueioHoras).toBe(CONFIG_PADRAO.semaforo.vermelhoBloqueioHoras);
    expect(aplicarConfig(CONFIG_PADRAO, { semaforo: { laranjaFracao: 0.4 } })).toEqual({ ok: false, codigo: "valor_invalido", campo: "laranjaFracao" });
    expect(aplicarConfig(CONFIG_PADRAO, { semaforo: { laranjaFracao: 1 } })).toEqual({ ok: false, codigo: "valor_invalido", campo: "laranjaFracao" });
    expect(aplicarConfig(CONFIG_PADRAO, { semaforo: { laranjaFracao: Number.NaN } }).ok).toBe(false);
  });
});

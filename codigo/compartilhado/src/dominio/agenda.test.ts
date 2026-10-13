import { describe, expect, it } from "vitest";
import type { Agendamento, CapacidadeDia } from "../tipos";
import { podeConfirmar, reagendar, vagasOcupadas, vagasRestantes } from "./agenda";

const m = (s: string) => `${s}:00-03:00`;
const ag = (id: string, p: Partial<Agendamento>): Agendamento => ({
  id,
  osId: `os-${id}`,
  data: "2026-10-13",
  janela: "manha",
  estado: "confirmado",
  origem: "recepcao",
  ...p,
});
const agora = m("2026-10-12T10:00");
const lista: Agendamento[] = [
  ag("a", {}),
  ag("b", { estado: "proposto", expiraEm: m("2026-10-12T11:00") }), // ocupa
  ag("c", { estado: "proposto", expiraEm: m("2026-10-12T09:59") }), // expirou
  ag("d", { estado: "cancelado" }),
  ag("e", { estado: "pendente" }),
  ag("f", { data: "2026-10-14" }),
  ag("g", { estado: "proposto" }), // sem expiraEm: ocupa
];
const cap = (vagasEntrada: number, bloqueado?: string): CapacidadeDia => ({ data: "2026-10-13", vagasEntrada, bloqueado });

describe("vagasOcupadas / vagasRestantes", () => {
  it("conta confirmado + proposto não expirado na data", () => {
    expect(vagasOcupadas("2026-10-13", lista, agora)).toBe(3);
    expect(vagasOcupadas("2026-10-14", lista, agora)).toBe(1);
  });
  it("a proposta expira exatamente em expiraEm", () => {
    expect(vagasOcupadas("2026-10-13", lista, m("2026-10-12T11:00"))).toBe(2);
  });
  it("restantes nunca negativas; dia bloqueado → 0", () => {
    expect(vagasRestantes(cap(4), lista, agora)).toBe(1);
    expect(vagasRestantes(cap(2), lista, agora)).toBe(0);
    expect(vagasRestantes(cap(4, "feriado"), lista, agora)).toBe(0);
  });
});

describe("podeConfirmar", () => {
  it("vaga exata: a última cabe, a seguinte não", () => {
    expect(podeConfirmar(cap(4), lista, agora)).toEqual({ ok: true });
    expect(podeConfirmar(cap(3), lista, agora)).toEqual({ ok: false, codigo: "sem_vaga" });
  });
  it("confirmar uma proposta que já ocupa a vaga não conta em dobro", () => {
    expect(podeConfirmar(cap(3), lista, agora, "b")).toEqual({ ok: true });
  });
  it("dia bloqueado", () => {
    expect(podeConfirmar(cap(10, "cabine em manutenção"), lista, agora)).toEqual({ ok: false, codigo: "dia_bloqueado" });
  });
});

describe("reagendar", () => {
  it("cancela o anterior, cria o novo com substituiId e libera a vaga", () => {
    const r = reagendar(lista, "a", "2026-10-14", "tarde", agora, { novoId: "a2" });
    if (!r.ok) throw new Error(r.codigo);
    const antigo = r.agendamentos.find((x) => x.id === "a")!;
    expect(antigo).toMatchObject({ estado: "cancelado", motivoCancelamento: "reagendado" });
    expect(r.novo).toEqual({ id: "a2", osId: "os-a", data: "2026-10-14", janela: "tarde", estado: "confirmado", origem: "recepcao", substituiId: "a" });
    expect(r.agendamentos).toHaveLength(lista.length + 1);
    expect(vagasOcupadas("2026-10-13", r.agendamentos, agora)).toBe(2);
    expect(vagasOcupadas("2026-10-14", r.agendamentos, agora)).toBe(2);
    expect(lista[0].estado).toBe("confirmado"); // original intacto
  });
  it("confere a vaga da nova data quando a capacidade vem", () => {
    const cheia: CapacidadeDia = { data: "2026-10-14", vagasEntrada: 1 };
    expect(reagendar(lista, "a", "2026-10-14", "manha", agora, { capacidade: cheia })).toEqual({ ok: false, codigo: "sem_vaga" });
    // mesmo dia, outra janela: o próprio anterior não conta
    const r = reagendar(lista, "a", "2026-10-13", "tarde", agora, { capacidade: cap(3) });
    expect(r.ok).toBe(true);
    expect(reagendar(lista, "a", "2026-10-14", "manha", agora, { capacidade: { ...cheia, bloqueado: "feriado" } })).toEqual({
      ok: false,
      codigo: "dia_bloqueado",
    });
  });
  it("proposta reagendada continua proposta com nova validade; motivo personalizado", () => {
    const r = reagendar(lista, "b", "2026-10-15", "manha", agora, { expiraEm: m("2026-10-12T12:00"), motivo: "cliente pediu" });
    if (!r.ok) throw new Error(r.codigo);
    expect(r.novo).toMatchObject({ estado: "proposto", expiraEm: m("2026-10-12T12:00"), id: "b-r" });
    expect(r.agendamentos.find((x) => x.id === "b")?.motivoCancelamento).toBe("cliente pediu");
  });
  it("guardas", () => {
    expect(reagendar(lista, "zz", "2026-10-14", "manha", agora)).toEqual({ ok: false, codigo: "agendamento_nao_encontrado" });
    expect(reagendar(lista, "d", "2026-10-14", "manha", agora)).toEqual({ ok: false, codigo: "transicao_invalida" });
    expect(reagendar(lista, "e", "2026-10-14", "manha", agora)).toEqual({ ok: false, codigo: "transicao_invalida" });
  });
});

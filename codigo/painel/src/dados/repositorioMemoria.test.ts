import { beforeEach, describe, expect, it, vi } from "vitest";
import { repositorioMemoria as repo } from "./repositorioMemoria";

// Sequências que a revisão QA do sprint SD apontou (docs/qa-sprintSD.md).
const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

async function osPorPlaca(placa: string) {
  const lista = await repo.listarOS();
  return lista.find((v) => v.veiculo.placa === placa)!;
}

describe("repositório em memória", () => {
  beforeEach(async () => {
    localStorage.clear();
    await repo.restaurarDemo();
  });

  it("registrar entrada cancela a proposta da Calia e a OS não volta para a fila", async () => {
    const v = await osPorPlaca("RNA4S66"); // aguardando agendamento com proposta da Calia
    expect(v.agendamento?.estado).toBe("proposto");
    expect((await repo.registrarEntrada(v.os.id, "tr-martelinho")).ok).toBe(true);
    const depois = await repo.obterOS(v.os.id);
    expect(depois?.os.estado).toBe("na_oficina");
    expect(depois?.agendamento).toBeUndefined();
    const ags = (await repo.listarAgendamentos()).filter((a) => a.osId === v.os.id);
    expect(ags.every((a) => a.estado !== "proposto")).toBe(true);
    // cancelar um agendamento antigo dessa OS não rebaixa a OS
    for (const a of ags) await repo.cancelarAgendamento(a.id, "teste");
    expect((await repo.obterOS(v.os.id))?.os.estado).toBe("na_oficina");
  });

  it("cancelar um agendamento confirmado devolve a OS agendada para a fila", async () => {
    const v = await osPorPlaca("SBD7C41");
    expect(v.os.estado).toBe("agendada");
    expect((await repo.cancelarAgendamento(v.agendamento!.id, "Cliente pediu outra semana")).ok).toBe(true);
    expect((await repo.obterOS(v.os.id))?.os.estado).toBe("aguardando_agendamento");
  });

  it("não agenda em data passada nem em dia fechado", async () => {
    const v = await osPorPlaca("SAE5P73");
    expect((await repo.agendar(v.os.id, "2020-01-06", "manha")).codigo).toBe("data_passada");
    // próximo domingo
    const d = new Date(`${hoje()}T12:00:00`);
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
    const domingo = d.toISOString().slice(0, 10);
    expect((await repo.agendar(v.os.id, domingo, "tarde")).codigo).toBe("dia_fechado");
  });

  it("recusa protocolo repetido na mesma seguradora", async () => {
    const r = await repo.criarAtendimentoRapido({
      placa: "ABC1D23",
      clienteNome: "Teste",
      origem: "maxpar",
      seguradora: "HDI",
      protocolo: "18398760",
      pecas: [{ peca: "Capô", tecnica: "martelinho" }],
    });
    expect(r.ok).toBe(false);
    expect(r.codigo).toBe("protocolo_duplicado");
    expect(r.osId).toBeTruthy();
  });

  it("aprovação com conflito aberto com a Maxpar é bloqueada", async () => {
    const v = await osPorPlaca("RHK2C47"); // aguardando aprovação
    // simula conflito vindo da importação
    const estado = JSON.parse(localStorage.getItem("ddoctor.demo.v2")!);
    estado.atendimentos = estado.atendimentos.map((a: { id: string }) => (v.os.atendimentosExternos.includes(a.id) ? { ...a, estadoConciliacao: "conflito" } : a));
    localStorage.setItem("ddoctor.demo.v2", JSON.stringify(estado));
    vi.resetModules();
    const { repositorioMemoria: novo } = await import("./repositorioMemoria");
    expect((await novo.registrarAprovacao(v.os.id, "Vi no portal")).codigo).toBe("conflito_aberto");
  });

  it("concluir a última etapa deixa a OS pronta pela máquina de estados", async () => {
    const v = await osPorPlaca("SCH4A22"); // polimento + higienização, na oficina
    for (let i = 0; i < 10; i++) {
      const etapas = (await repo.obterOS(v.os.id))!.etapas;
      const atual = etapas.find((e) => e.estado === "na_fila" || e.estado === "em_execucao");
      if (!atual) break;
      if (atual.estado === "na_fila") await repo.iniciarEtapa(atual.id, "p-andre");
      expect((await repo.concluirEtapa(atual.id, { temFoto: true, pecasFeitas: 1 })).ok).toBe(true);
    }
    expect((await repo.obterOS(v.os.id))?.os.estado).toBe("pronta");
  });
});

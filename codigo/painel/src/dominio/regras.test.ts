import { describe, expect, it } from "vitest";
import {
  aReceberEmAberto,
  entregaAtrasada,
  formatarPlaca,
  margem,
  normalizarPlaca,
  ordemEtapa,
  pendencias,
  placaValida,
} from "./regras";
import type { Atendimento } from "./tipos";

function atendimento(extra: Partial<Atendimento> = {}): Atendimento {
  return {
    id: "a1",
    origem: "maxpar",
    seguradora: "Tokio Marine",
    placa: "ABC1D23",
    cliente: { nome: "Cliente Teste" },
    abertura: "2026-10-01",
    pecas: [],
    franquia: { valor: 160, paga: false },
    etapa: "aguardando_autorizacao",
    documentacao: { fotosAntes: false, fotosDepois: false, pdfOrdem: false, assinatura: false, nf: false, recusas: [] },
    financeiro: {},
    contatos: [],
    etapaDesde: "2026-10-01",
    criadoEm: "2026-10-01T10:00:00",
    atualizadoEm: "2026-10-01T10:00:00",
    ...extra,
  };
}

describe("etapas", () => {
  it("ordena do aguardando autorização até pago", () => {
    expect(ordemEtapa("aguardando_autorizacao")).toBe(0);
    expect(ordemEtapa("pago")).toBe(8);
    expect(ordemEtapa("no_patio")).toBeLessThan(ordemEtapa("entregue"));
  });
});

describe("pendências", () => {
  it("aponta falta de autorização depois do limite de dias", () => {
    expect(pendencias(atendimento(), "2026-10-03")).not.toContain("sem_autorizacao");
    expect(pendencias(atendimento(), "2026-10-05")).toContain("sem_autorizacao");
  });

  it("avisa vistoria vencendo só enquanto aguarda autorização", () => {
    const a = atendimento({ limiteVistoria: "2026-10-04" });
    expect(pendencias(a, "2026-10-02")).toContain("vistoria_vencendo");
    expect(pendencias(atendimento({ limiteVistoria: "2026-10-04", etapa: "autorizado" }), "2026-10-02")).not.toContain(
      "vistoria_vencendo",
    );
  });

  it("marca entrega atrasada pela previsão do cliente, não depois de entregue", () => {
    const a = atendimento({ etapa: "no_patio", previsaoCliente: "2026-10-05", previsaoPortal: "2026-10-09" });
    expect(entregaAtrasada(a, "2026-10-05")).toBe(false);
    expect(entregaAtrasada(a, "2026-10-06")).toBe(true);
    expect(entregaAtrasada({ ...a, etapa: "entregue" }, "2026-10-20")).toBe(false);
  });

  it("documentação recusada fica pendente até um novo envio posterior à recusa", () => {
    const doc = { fotosAntes: true, fotosDepois: true, pdfOrdem: true, assinatura: true, nf: true, recusas: [{ data: "2026-10-10", motivo: "assinatura" }] };
    expect(pendencias(atendimento({ etapa: "entregue", documentacao: { ...doc, enviadaEm: "2026-10-08" } }), "2026-10-11")).toContain("documentacao_recusada");
    expect(pendencias(atendimento({ etapa: "documentacao_enviada", documentacao: { ...doc, enviadaEm: "2026-10-12" } }), "2026-10-13")).not.toContain("documentacao_recusada");
  });

  it("pagamento atrasado depois de 30 dias da documentação enviada", () => {
    const doc = { fotosAntes: true, fotosDepois: true, pdfOrdem: true, assinatura: true, nf: true, recusas: [], enviadaEm: "2026-09-01" };
    expect(pendencias(atendimento({ etapa: "documentacao_enviada", documentacao: doc }), "2026-09-20")).not.toContain("pagamento_atrasado");
    expect(pendencias(atendimento({ etapa: "documentacao_enviada", documentacao: doc }), "2026-10-05")).toContain("pagamento_atrasado");
  });
});

describe("financeiro", () => {
  it("margem = Maxpar + franquia + complemento − material − comissão", () => {
    const a = atendimento({ franquia: { valor: 160, paga: true }, complemento: 300, financeiro: { aReceberMaxpar: 840, custoMaterial: 120, comissao: 250 } });
    expect(margem(a)).toBe(840 + 160 + 300 - 120 - 250);
  });

  it("a receber em aberto só conta Maxpar/seguradora sem pagamento", () => {
    expect(aReceberEmAberto(atendimento({ etapa: "documentacao_enviada", financeiro: { aReceberMaxpar: 900 } }))).toBe(900);
    expect(aReceberEmAberto(atendimento({ etapa: "no_patio", financeiro: { aReceberMaxpar: 900 } }))).toBe(900);
    expect(aReceberEmAberto(atendimento({ etapa: "pago", financeiro: { aReceberMaxpar: 900 }, documentacao: { fotosAntes: true, fotosDepois: true, pdfOrdem: true, assinatura: true, nf: true, recusas: [], pagoEm: "2026-10-01" } }))).toBe(0);
    expect(aReceberEmAberto(atendimento({ origem: "particular", financeiro: { aReceberMaxpar: 900 } }))).toBe(0);
  });
});

describe("placa", () => {
  it("normaliza e valida Mercosul e antiga", () => {
    expect(normalizarPlaca("abc-1d23")).toBe("ABC1D23");
    expect(placaValida("ABC1D23")).toBe(true);
    expect(placaValida("ABC1234")).toBe(true);
    expect(placaValida("AB12345")).toBe(false);
    expect(formatarPlaca("abc1d23")).toBe("ABC-1D23");
  });
});

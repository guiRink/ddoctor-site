import { describe, expect, it } from "vitest";
import type { EtapaOS, RegistroAuditoria } from "../tipos";
import { historicoFuncionario, resumoFuncionario, type OSHistorico } from "./historicoFuncionario";

const etapa = (id: string, nome: string, extra: Partial<EtapaOS> = {}): EtapaOS => ({
  id,
  osId: "os1",
  ordem: 1,
  nome,
  estado: "concluida",
  responsavelId: "diego",
  prazoHoras: 2,
  iniciadaEm: "2026-10-15T08:00:00-03:00",
  concluidaEm: "2026-10-15T10:00:00-03:00",
  exigeFoto: false,
  bloqueios: [],
  ...extra,
});

const visao = (id: string, etapas: EtapaOS[], placa = "RKP1L34", fotos: OSHistorico["fotos"] = []): OSHistorico => ({
  os: { id, estado: "na_oficina", tipoReparoId: "tr" },
  veiculo: { placa },
  etapas,
  fotos,
});

describe("historicoFuncionario", () => {
  const pintura = etapa("e1", "Pintura", {
    bloqueios: [{ inicioEm: "2026-10-15T08:30:00-03:00", fimEm: "2026-10-15T09:00:00-03:00", motivo: "falta tinta" }],
  });
  const oss = [
    visao("os1", [pintura, etapa("e2", "Polimento", { responsavelId: "ana" })], "RKP1L34", [
      { id: "f1", osId: "os1", etapaId: "e1", autorId: "diego", tiradaEm: "2026-10-15T09:55:00-03:00", origem: "interna" },
      { id: "f2", osId: "os1", autorId: "ana", tiradaEm: "2026-10-15T09:56:00-03:00", origem: "interna" },
    ]),
  ];

  it("eventos da pessoa, do mais recente, com o texto da Equipe", () => {
    const h = historicoFuncionario("diego", oss);
    expect(h.map((e) => [e.tipo, e.texto])).toEqual([
      ["concluiu", "Concluiu Pintura · RKP1L34"],
      ["foto", "Foto em Pintura · RKP1L34"],
      ["retomou", "Retomou Pintura · RKP1L34"],
      ["parou", "Parou Pintura · RKP1L34 — falta tinta"],
      ["iniciou", "Iniciou Pintura · RKP1L34"],
    ]);
    expect(h[0]).toMatchObject({ em: "2026-10-15T10:00:00-03:00", etapa: "Pintura", etapaId: "e1", osId: "os1", placa: "RKP1L34" });
  });

  it("bloqueio aberto: parou sem retomou; etapa em execução: só iniciou", () => {
    const aberta = etapa("e9", "Funilaria", {
      estado: "bloqueada",
      concluidaEm: undefined,
      bloqueios: [{ inicioEm: "2026-10-16T10:00:00-03:00", motivo: "peça" }],
    });
    expect(historicoFuncionario("diego", [visao("os9", [aberta])]).map((e) => e.tipo)).toEqual(["parou", "iniciou"]);
  });

  it("não mostra etapa dos outros nem foto da Maxpar", () => {
    const maxpar = [visao("os1", [], "AAA1B23", [{ id: "fm", osId: "os1", autorId: "diego", tiradaEm: "2026-10-15T09:00:00-03:00", origem: "maxpar" }])];
    expect(historicoFuncionario("diego", maxpar)).toEqual([]);
    expect(historicoFuncionario("ana", oss).map((e) => e.texto)).toEqual(["Concluiu Polimento · RKP1L34", "Foto · RKP1L34", "Iniciou Polimento · RKP1L34"]);
  });

  it("auditoria completa sem duplicar o que já saiu da etapa", () => {
    const auditoria: RegistroAuditoria[] = [
      // mesmo evento já tirado da etapa (1 min de diferença): não duplica
      { id: "a1", em: "2026-10-15T10:01:00-03:00", perfilId: "diego", acao: "concluir_etapa", entidade: "etapa_os", entidadeId: "e1", resumo: "x" },
      // parou a etapa da colega: entra
      { id: "a2", em: "2026-10-15T09:30:00-03:00", perfilId: "diego", acao: "bloquear_etapa", entidade: "etapa_os", entidadeId: "e2", resumo: "x" },
      // ação sem etapa conhecida: usa o resumo
      { id: "a3", em: "2026-10-14T09:30:00-03:00", perfilId: "diego", acao: "adicionar_foto", entidade: "foto", entidadeId: "f-antiga", resumo: "Foto na OS #7" },
      // ação que não é evento de funcionário, ou de outra pessoa: fica de fora
      { id: "a4", em: "2026-10-15T09:40:00-03:00", perfilId: "diego", acao: "baixa", entidade: "titulo_receber", resumo: "Baixa" },
      { id: "a5", em: "2026-10-15T09:40:00-03:00", perfilId: "ana", acao: "bloquear_etapa", entidade: "etapa_os", entidadeId: "e1", resumo: "x" },
    ];
    const h = historicoFuncionario("diego", oss, auditoria);
    expect(h.filter((e) => e.tipo === "concluiu")).toHaveLength(1);
    expect(h.find((e) => e.etapaId === "e2")).toMatchObject({ tipo: "parou", texto: "Parou Polimento · RKP1L34", osId: "os1" });
    expect(h[h.length - 1]).toMatchObject({ tipo: "foto", texto: "Foto na OS #7", fotoId: "f-antiga" });
    expect(h).toHaveLength(7);
  });
});

describe("resumoFuncionario", () => {
  const oss = [
    visao("os1", [
      // 2 h, com 30 min impedida → 90 min
      etapa("e1", "Pintura", { bloqueios: [{ inicioEm: "2026-10-15T08:30:00-03:00", fimEm: "2026-10-15T09:00:00-03:00", motivo: "tinta" }] }),
      etapa("e2", "Polimento", { iniciadaEm: "2026-10-15T10:00:00-03:00", concluidaEm: "2026-10-15T10:30:00-03:00" }),
    ]),
    visao("os2", [
      etapa("e3", "Pintura", { osId: "os2", iniciadaEm: "2026-10-20T08:00:00-03:00", concluidaEm: "2026-10-20T08:30:00-03:00" }),
      // concluída em setembro: fora
      etapa("e4", "Pintura", { osId: "os2", iniciadaEm: "2026-09-30T08:00:00-03:00", concluidaEm: "2026-09-30T09:00:00-03:00" }),
      // sem início registrado: conta, mas não entra na média
      etapa("e5", "Pintura", { osId: "os2", iniciadaEm: undefined, concluidaEm: "2026-10-21T08:00:00-03:00" }),
      etapa("e6", "Montagem", { osId: "os2", estado: "em_execucao", concluidaEm: undefined }),
    ], "AAA1B23"),
  ];

  it("etapas concluídas no mês, tempo médio sem o impedido, por etapa e comissões", () => {
    const r = resumoFuncionario("diego", oss, "2026-10", [{ id: "r", etapaNome: "Pintura", valor: 4000, ativa: true }]);
    expect(r).toEqual({
      perfilId: "diego",
      mes: "2026-10",
      etapasConcluidas: 4,
      carros: 2,
      tempoMedioMin: 50, // (90 + 30 + 30) / 3
      porEtapa: [
        { etapa: "Pintura", quantidade: 3, tempoMedioMin: 60 },
        { etapa: "Polimento", quantidade: 1, tempoMedioMin: 30 },
      ],
      comissoes: 12000,
      quantidadeComissoes: 3,
    });
  });

  it("mês sem nada", () => {
    expect(resumoFuncionario("diego", oss, "2026-08")).toMatchObject({ etapasConcluidas: 0, carros: 0, tempoMedioMin: null, porEtapa: [], comissoes: 0 });
  });
});

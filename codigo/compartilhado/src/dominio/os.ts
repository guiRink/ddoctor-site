// Máquinas de estado da OS e da etapa (arq. §7.2). Funções puras: devolvem resultado ou nova lista.
import type { ConfigOficina, DataISO, EstadoEtapa, EstadoOS, EtapaOS, Id, MarcoISO, OrcamentoVersao, OS, TipoReparo } from "../tipos";
import { FOLGA_PREVISAO_PADRAO } from "./config";
import { janelaDoDia, proximoDiaUtil, somarHorasUteis } from "./expediente";
import { dataNoFuso, formatarMarco, minutoDoDia, msDeLocal, somarDias } from "./fuso";
import { falha, type Resultado } from "./resultado";

// ---------------------------------------------------------------- OS

/** Tabela de transições da OS (arq. §7.2). "cancelada" sai de qualquer estado não terminal. */
export const TRANSICOES_OS: Readonly<Record<EstadoOS, readonly EstadoOS[]>> = {
  rascunho: ["aguardando_aprovacao", "cancelada"],
  aguardando_aprovacao: ["aguardando_agendamento", "cancelada"],
  aguardando_agendamento: ["agendada", "na_oficina", "cancelada"],
  // agendada → aguardando_agendamento: agendamento cancelado ou cliente não compareceu (volta para a fila)
  agendada: ["na_oficina", "aguardando_agendamento", "cancelada"],
  na_oficina: ["pronta", "cancelada"],
  pronta: ["entregue", "cancelada"],
  entregue: ["encerrada", "cancelada"],
  encerrada: [],
  cancelada: [],
};

export type CodigoTransicaoOS =
  | "transicao_invalida"
  | "sem_itens"
  | "aprovacao_nao_confiavel"
  | "conflito_aberto"
  | "sem_vaga"
  | "sem_tipo_reparo"
  | "etapas_pendentes"
  | "pendencias_abertas"
  | "motivo_obrigatorio";

export interface ContextoTransicaoOS {
  /** Versão de orçamento vigente (rascunho→aguardando_aprovacao: ≥ 1 item; aprovação: confiável). */
  versao?: OrcamentoVersao;
  /** Conflitos de sincronização abertos em itens/valores (bloqueiam a aprovação). */
  conflitosAbertos?: number;
  /** Há agendamento confirmado (vaga reservada) para a OS. */
  agendamentoConfirmado?: boolean;
  /** Tipo de reparo escolhido na entrada real (senão usa os.tipoReparoId). */
  tipoReparoId?: Id;
  /** Etapas da OS (na_oficina→pronta). */
  etapas?: readonly EtapaOS[];
  /** entregue→encerrada: pendências externas abertas e títulos não recebidos/cancelados. */
  pendenciasAbertas?: number;
  titulosAbertos?: number;
  /** Obrigatório para cancelar. */
  motivo?: string;
}

const FECHADAS: ReadonlySet<EstadoEtapa> = new Set(["concluida", "dispensada"]);

export function transicaoOS(os: OS, para: EstadoOS, contexto: ContextoTransicaoOS = {}): Resultado<CodigoTransicaoOS> {
  if (!TRANSICOES_OS[os.estado].includes(para)) return falha("transicao_invalida");
  switch (para) {
    case "cancelada":
      return contexto.motivo?.trim() ? { ok: true } : falha("motivo_obrigatorio");
    case "aguardando_aprovacao":
      return (contexto.versao?.itens.length ?? 0) > 0 ? { ok: true } : falha("sem_itens");
    case "aguardando_agendamento":
      if (os.estado === "agendada") return contexto.motivo?.trim() ? { ok: true } : falha("motivo_obrigatorio");
      if (!contexto.versao?.aprovacao?.confiavel) return falha("aprovacao_nao_confiavel");
      if ((contexto.conflitosAbertos ?? 0) > 0) return falha("conflito_aberto");
      return { ok: true };
    case "agendada":
      return contexto.agendamentoConfirmado ? { ok: true } : falha("sem_vaga");
    case "na_oficina":
      // Não iniciar produção só por aprovação externa: exige entrada real com tipo de reparo.
      return (contexto.tipoReparoId ?? os.tipoReparoId) ? { ok: true } : falha("sem_tipo_reparo");
    case "pronta": {
      const etapas = contexto.etapas ?? [];
      return etapas.length > 0 && etapas.every((e) => FECHADAS.has(e.estado)) ? { ok: true } : falha("etapas_pendentes");
    }
    case "encerrada":
      return (contexto.pendenciasAbertas ?? 0) === 0 && (contexto.titulosAbertos ?? 0) === 0
        ? { ok: true }
        : falha("pendencias_abertas");
    default:
      return { ok: true };
  }
}

export function transicoesPossiveis(estado: EstadoOS): readonly EstadoOS[] {
  return TRANSICOES_OS[estado];
}

// ---------------------------------------------------------------- etapas

export type CodigoEtapa =
  | "etapa_nao_encontrada"
  | "transicao_invalida"
  | "sem_responsavel"
  | "foto_obrigatoria"
  | "contagem_obrigatoria"
  | "motivo_obrigatorio";

export type ResultadoEtapas = Resultado<CodigoEtapa, { etapas: EtapaOS[] }>;

function copiar(e: EtapaOS): EtapaOS {
  return { ...e, bloqueios: e.bloqueios.map((b) => ({ ...b })) };
}

/** Aplica `mudar` à etapa `etapaId` sobre cópias; o resto da lista é copiado sem mudança. */
function comEtapa(
  etapas: readonly EtapaOS[],
  etapaId: Id,
  mudar: (e: EtapaOS, lista: EtapaOS[]) => CodigoEtapa | null,
): ResultadoEtapas {
  const lista = etapas.map(copiar);
  const alvo = lista.find((e) => e.id === etapaId);
  if (!alvo) return falha("etapa_nao_encontrada");
  const erro = mudar(alvo, lista);
  return erro ? falha(erro) : { ok: true, etapas: lista };
}

/** Próxima etapa da mesma OS, por ordem, que não foi dispensada: sai de "aguardando" para "na_fila". */
function liberarProxima(lista: EtapaOS[], atual: EtapaOS, agora: MarcoISO) {
  const proxima = lista
    .filter((e) => e.osId === atual.osId && e.ordem > atual.ordem && e.estado !== "dispensada")
    .sort((a, b) => a.ordem - b.ordem)[0];
  if (proxima?.estado === "aguardando") {
    proxima.estado = "na_fila";
    proxima.entrouFilaEm = agora;
  }
}

/** na_fila → em_execucao. Exige responsável. */
export function iniciarEtapa(etapas: readonly EtapaOS[], etapaId: Id, responsavelId: Id, agora: MarcoISO): ResultadoEtapas {
  return comEtapa(etapas, etapaId, (e) => {
    if (e.estado !== "na_fila") return "transicao_invalida";
    if (!responsavelId?.trim()) return "sem_responsavel";
    e.estado = "em_execucao";
    e.responsavelId = responsavelId;
    e.iniciadaEm = agora;
    return null;
  });
}

/**
 * em_execucao → concluida. Exige foto (exigeFoto) e contagem de peças (exigeContagemPecas) se a etapa pedir.
 * A próxima etapa não dispensada vai de aguardando para na_fila com entrouFilaEm = agora.
 * O prazoEm planejado das próximas não é recalculado aqui (foi encadeado em gerarEtapas).
 */
export function concluirEtapa(
  etapas: readonly EtapaOS[],
  etapaId: Id,
  dados: { pecasFeitas?: number; temFoto?: boolean },
  agora: MarcoISO,
): ResultadoEtapas {
  return comEtapa(etapas, etapaId, (e, lista) => {
    if (e.estado !== "em_execucao") return "transicao_invalida";
    if (e.exigeFoto && !dados.temFoto) return "foto_obrigatoria";
    const pecas = dados.pecasFeitas;
    const pecasOk = pecas !== undefined && Number.isInteger(pecas) && pecas >= 0;
    if (e.exigeContagemPecas && !pecasOk) return "contagem_obrigatoria";
    e.estado = "concluida";
    e.concluidaEm = agora;
    if (pecasOk) e.pecasFeitas = pecas;
    liberarProxima(lista, e, agora);
    return null;
  });
}

/** em_execucao → bloqueada; abre um bloqueio com motivo. */
export function bloquearEtapa(etapas: readonly EtapaOS[], etapaId: Id, motivo: string, agora: MarcoISO): ResultadoEtapas {
  return comEtapa(etapas, etapaId, (e) => {
    if (e.estado !== "em_execucao") return "transicao_invalida";
    if (!motivo?.trim()) return "motivo_obrigatorio";
    e.estado = "bloqueada";
    e.bloqueios.push({ inicioEm: agora, motivo: motivo.trim() });
    return null;
  });
}

/** bloqueada → em_execucao; fecha o bloqueio aberto. */
export function retomarEtapa(etapas: readonly EtapaOS[], etapaId: Id, agora: MarcoISO): ResultadoEtapas {
  return comEtapa(etapas, etapaId, (e) => {
    if (e.estado !== "bloqueada") return "transicao_invalida";
    e.estado = "em_execucao";
    for (const b of e.bloqueios) if (!b.fimEm) b.fimEm = agora;
    return null;
  });
}

/** aguardando | na_fila → dispensada, com motivo. Se estava na fila, libera a próxima. */
export function dispensarEtapa(etapas: readonly EtapaOS[], etapaId: Id, motivo: string, agora: MarcoISO): ResultadoEtapas {
  return comEtapa(etapas, etapaId, (e, lista) => {
    if (e.estado !== "aguardando" && e.estado !== "na_fila") return "transicao_invalida";
    if (!motivo?.trim()) return "motivo_obrigatorio";
    const estavaNaFila = e.estado === "na_fila";
    e.estado = "dispensada";
    e.motivoDispensa = motivo.trim();
    if (estavaNaFila) liberarProxima(lista, e, agora);
    return null;
  });
}

// ---------------------------------------------------------------- geração a partir do modelo

export interface OpcoesGerarEtapas {
  /** Id de cada etapa; padrão determinístico `${osId}-e${ordem}`. */
  gerarId?: (ordem: number) => Id;
  /** Peças previstas (itens autorizados) para etapas que exigem contagem. */
  pecasPrevistas?: number;
}

/** Cria as etapas da OS na entrada real: primeira na_fila, demais aguardando; prazoEm encadeado em horas úteis. */
export function gerarEtapas(
  tipoReparo: TipoReparo,
  osId: Id,
  entradaEm: MarcoISO,
  config: ConfigOficina,
  opcoes: OpcoesGerarEtapas = {},
): EtapaOS[] {
  const gerarId = opcoes.gerarId ?? ((ordem: number) => `${osId}-e${ordem}`);
  let cursor = entradaEm;
  return [...tipoReparo.etapas]
    .sort((a, b) => a.ordem - b.ordem)
    .map((modelo, i) => {
      const prazoEm = somarHorasUteis(cursor, modelo.prazoPadraoHoras, config);
      cursor = prazoEm;
      const etapa: EtapaOS = {
        id: gerarId(modelo.ordem),
        osId,
        ordem: modelo.ordem,
        nome: modelo.nome,
        estado: i === 0 ? "na_fila" : "aguardando",
        prazoHoras: modelo.prazoPadraoHoras,
        prazoEm,
        exigeFoto: modelo.exigeFoto,
        exigeContagemPecas: modelo.exigeContagemPecas,
        bloqueios: [],
      };
      if (i === 0) etapa.entrouFilaEm = entradaEm;
      if (modelo.exigeContagemPecas && opcoes.pecasPrevistas !== undefined) etapa.pecasPrevistas = opcoes.pecasPrevistas;
      return etapa;
    });
}

/**
 * Previsão de entrega sugerida: soma dos prazos do modelo + folga (padrão 20 %, provisório),
 * arredondada para o fim do dia útil em que cai. Devolve a data e o marco de fechamento.
 */
export function previsaoEntregaSugerida(
  tipoReparo: TipoReparo,
  entradaEm: MarcoISO,
  config: ConfigOficina,
  folga: number = FOLGA_PREVISAO_PADRAO,
): { data: DataISO; fimEm: MarcoISO } {
  const horas = tipoReparo.etapas.reduce((s, e) => s + e.prazoPadraoHoras, 0) * (1 + folga);
  const fim = somarHorasUteis(entradaEm, horas, config);
  let dia = dataNoFuso(fim);
  const janela = janelaDoDia(dia, config);
  if (!janela || minutoDoDia(fim) > janela.fim) dia = proximoDiaUtil(somarDias(dia, 1), config);
  const j = janelaDoDia(dia, config)!;
  return { data: dia, fimEm: formatarMarco(msDeLocal(dia, j.fim)) };
}

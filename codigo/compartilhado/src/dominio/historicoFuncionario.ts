// Histórico e resumo de um funcionário (aba Equipe, sprint S1): "Concluiu Pintura · RKP1L34". Funções puras.
//
// Fonte principal: as etapas em que a pessoa é `responsavelId` (iniciadaEm, concluidaEm, bloqueios) e as fotos
// que ela tirou (`autorId`). Parou/retomou vêm dos bloqueios da etapa e são atribuídos ao responsável (o
// bloqueio não guarda quem parou). A auditoria (opcional) completa com ações da pessoa que não estão nas etapas
// (ex.: parou a etapa de um colega), sem duplicar o que já saiu delas.
import type { EtapaOS, Foto, Id, MarcoISO, OS, RegistroAuditoria, RegraComissao, Veiculo } from "../tipos";
import { comissoesDoPeriodo } from "./comissoes";
import { mesDe, paraMs } from "./fuso";
import { tempoEmExecucao } from "./tempos";

export const TIPOS_EVENTO_FUNCIONARIO = ["iniciou", "concluiu", "parou", "retomou", "foto"] as const;
export type TipoEventoFuncionario = (typeof TIPOS_EVENTO_FUNCIONARIO)[number];

const VERBO: Record<TipoEventoFuncionario, string> = {
  iniciou: "Iniciou",
  concluiu: "Concluiu",
  parou: "Parou",
  retomou: "Retomou",
  foto: "Foto",
};

/** Ação da auditoria → tipo de evento (nomes que o repositório usa ou vai usar no S1). */
export const ACAO_PARA_EVENTO: Readonly<Record<string, TipoEventoFuncionario>> = {
  iniciar_etapa: "iniciou",
  concluir_etapa: "concluiu",
  bloquear_etapa: "parou",
  desbloquear_etapa: "retomou",
  retomar_etapa: "retomou",
  adicionar_foto: "foto",
};

export interface OSHistorico {
  os: Pick<OS, "id" | "tipoReparoId" | "estado">;
  veiculo?: Pick<Veiculo, "placa">;
  etapas: readonly EtapaOS[];
  fotos?: ReadonlyArray<Pick<Foto, "id" | "osId" | "etapaId" | "autorId" | "tiradaEm" | "origem">>;
}

export interface EventoFuncionario {
  em: MarcoISO;
  tipo: TipoEventoFuncionario;
  /** Nome da etapa (ausente em foto sem etapa ou auditoria sem etapa achada). */
  etapa?: string;
  etapaId?: Id;
  fotoId?: Id;
  placa?: string;
  osId?: Id;
  /** "Concluiu Pintura · RKP1L34"; parou traz o motivo: "Parou Pintura · RKP1L34 — falta peça". */
  texto: string;
}

function texto(tipo: TipoEventoFuncionario, etapa?: string, placa?: string, detalhe?: string): string {
  const alvo = tipo === "foto" ? (etapa ? `${VERBO.foto} em ${etapa}` : VERBO.foto) : `${VERBO[tipo]}${etapa ? ` ${etapa}` : ""}`;
  return `${alvo}${placa ? ` · ${placa}` : ""}${detalhe ? ` — ${detalhe}` : ""}`;
}

/** Janela em que um registro de auditoria é o mesmo evento já tirado da etapa/foto. */
const MESMO_EVENTO_MS = 2 * 60_000;

/** Eventos da pessoa, do mais recente para o mais antigo. */
export function historicoFuncionario(
  perfilId: Id,
  oss: readonly OSHistorico[],
  auditoria: readonly RegistroAuditoria[] = [],
): EventoFuncionario[] {
  const eventos: EventoFuncionario[] = [];
  const etapaPorId = new Map<Id, { etapa: EtapaOS; v: OSHistorico }>();
  for (const v of oss) {
    const placa = v.veiculo?.placa;
    const comum = { osId: v.os.id, ...(placa ? { placa } : {}) };
    for (const e of v.etapas) {
      etapaPorId.set(e.id, { etapa: e, v });
      if (e.responsavelId !== perfilId) continue;
      const daEtapa = { ...comum, etapa: e.nome, etapaId: e.id };
      if (e.iniciadaEm) eventos.push({ ...daEtapa, em: e.iniciadaEm, tipo: "iniciou", texto: texto("iniciou", e.nome, placa) });
      for (const b of e.bloqueios) {
        eventos.push({ ...daEtapa, em: b.inicioEm, tipo: "parou", texto: texto("parou", e.nome, placa, b.motivo?.trim()) });
        if (b.fimEm) eventos.push({ ...daEtapa, em: b.fimEm, tipo: "retomou", texto: texto("retomou", e.nome, placa) });
      }
      if (e.estado === "concluida" && e.concluidaEm)
        eventos.push({ ...daEtapa, em: e.concluidaEm, tipo: "concluiu", texto: texto("concluiu", e.nome, placa) });
    }
    for (const f of v.fotos ?? []) {
      if (f.autorId !== perfilId || f.origem !== "interna") continue;
      const nome = f.etapaId ? v.etapas.find((e) => e.id === f.etapaId)?.nome : undefined;
      eventos.push({
        ...comum,
        ...(nome ? { etapa: nome, etapaId: f.etapaId } : {}),
        fotoId: f.id,
        em: f.tiradaEm,
        tipo: "foto",
        texto: texto("foto", nome, placa),
      });
    }
  }

  const jaTem = (tipo: TipoEventoFuncionario, entidadeId: Id | undefined, ms: number) =>
    eventos.some(
      (ev) => ev.tipo === tipo && (ev.etapaId === entidadeId || ev.fotoId === entidadeId) && Math.abs(paraMs(ev.em) - ms) <= MESMO_EVENTO_MS,
    );
  for (const a of auditoria) {
    if (a.perfilId !== perfilId) continue;
    const tipo = ACAO_PARA_EVENTO[a.acao];
    if (!tipo) continue;
    const ms = paraMs(a.em);
    if (jaTem(tipo, a.entidadeId, ms)) continue;
    const achada = a.entidadeId ? etapaPorId.get(a.entidadeId) : undefined;
    const placa = achada?.v.veiculo?.placa;
    eventos.push({
      em: a.em,
      tipo,
      ...(achada ? { etapa: achada.etapa.nome, etapaId: achada.etapa.id, osId: achada.v.os.id } : {}),
      ...(tipo === "foto" && a.entidadeId ? { fotoId: a.entidadeId } : {}),
      ...(placa ? { placa } : {}),
      texto: achada ? texto(tipo, achada.etapa.nome, placa) : a.resumo,
    });
  }
  return eventos.sort((a, b) => paraMs(b.em) - paraMs(a.em));
}

export interface ResumoEtapaFuncionario {
  etapa: string;
  quantidade: number;
  /** Minutos em execução (sem o tempo impedido); null se nenhuma tinha início registrado. */
  tempoMedioMin: number | null;
}

export interface ResumoFuncionario {
  perfilId: Id;
  mes: string;
  etapasConcluidas: number;
  /** Carros distintos com etapa concluída por ela no mês. */
  carros: number;
  tempoMedioMin: number | null;
  /** Por nome de etapa (mais feitas primeiro). */
  porEtapa: ResumoEtapaFuncionario[];
  comissoes: number; // centavos
  quantidadeComissoes: number;
}

const media = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);

/**
 * Resumo do mês "AAAA-MM": etapas concluídas pela pessoa (mês do concluidaEm no fuso da oficina), tempo médio
 * em execução (tempoEmExecucao, sem o tempo impedido), por etapa, e comissões (comissoesDoPeriodo).
 */
export function resumoFuncionario(
  perfilId: Id,
  oss: readonly OSHistorico[],
  mes: string,
  regras: readonly RegraComissao[] = [],
): ResumoFuncionario {
  if (!/^\d{4}-\d{2}$/.test(mes)) throw new Error(`mes_invalido: ${mes}`);
  const concluidas = oss.flatMap((v) =>
    v.etapas
      .filter((e) => e.responsavelId === perfilId && e.estado === "concluida" && e.concluidaEm && mesDe(e.concluidaEm) === mes)
      .map((e) => ({ e, osId: v.os.id })),
  );
  const tempo = (e: EtapaOS) => (e.iniciadaEm ? tempoEmExecucao(e, e.concluidaEm!) : null);
  const grupos = new Map<string, { etapa: string; quantidade: number; tempos: number[] }>();
  for (const { e } of concluidas) {
    const chave = e.nome.trim().toLowerCase();
    const g = grupos.get(chave) ?? { etapa: e.nome, quantidade: 0, tempos: [] };
    g.quantidade++;
    const t = tempo(e);
    if (t !== null) g.tempos.push(t);
    grupos.set(chave, g);
  }
  const todos = concluidas.map(({ e }) => tempo(e)).filter((t): t is number => t !== null);
  const com = comissoesDoPeriodo(oss, regras, mes, perfilId);
  return {
    perfilId,
    mes,
    etapasConcluidas: concluidas.length,
    carros: new Set(concluidas.map((c) => c.osId)).size,
    tempoMedioMin: media(todos),
    porEtapa: [...grupos.values()]
      .map((g) => ({ etapa: g.etapa, quantidade: g.quantidade, tempoMedioMin: media(g.tempos) }))
      .sort((a, b) => b.quantidade - a.quantidade || a.etapa.localeCompare(b.etapa, "pt-BR")),
    comissoes: com.total,
    quantidadeComissoes: com.linhas.length,
  };
}

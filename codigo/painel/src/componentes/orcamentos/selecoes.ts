import type {
  Agendamento,
  ConfigOficina,
  DataISO,
  EstadoOS,
  MarcoISO,
  OrcamentoVersao,
  PendenciaExterna,
  Semaforo,
  TituloReceber,
} from "@compartilhado/tipos";
import { dataNoFuso, diferencaDias, somarDias } from "@compartilhado/dominio/fuso";
import { etapaAtual, semaforoOS } from "@compartilhado/dominio/semaforo";
import { estadoTitulo, saldoTitulo, valorAprovado } from "@compartilhado/dominio/financeiro";
import { somaCentavos } from "@compartilhado/dominio/dinheiro";
import type { OSVisao } from "../../dados/repositorio";

/**
 * Seleções de leitura das telas Geral e Orçamentos (só agregam; nenhuma muda estado).
 * Os limites abaixo são os provisórios de docs/painel-informacoes.md §5 ("Limites de alerta").
 * Pedido no relatório do SD: subir para src/dominio/ e ler os limites de config_oficina.
 */
export const LIMITE_SEM_AUTORIZACAO_DIAS = 3;
export const LIMITE_VISTORIA_DIAS = 2;

const ANTES_DA_ENTRADA: ReadonlySet<EstadoOS> = new Set(["rascunho", "aguardando_aprovacao", "aguardando_agendamento", "agendada"]);
const PENDENCIA_ABERTA: ReadonlySet<PendenciaExterna["estado"]> = new Set(["aberta", "em_andamento"]);

export interface ItemAgenda {
  v: OSVisao;
  ag: Agendamento;
}
export interface ItemAtraso {
  v: OSVisao;
  semaforo: Semaforo;
  impedido: boolean;
}
export interface ItemDias {
  v: OSVisao;
  dias: number;
  data?: DataISO;
}
export interface ItemPendencia {
  v: OSVisao;
  p: PendenciaExterna;
}
export interface ItemTitulo {
  v?: OSVisao;
  t: TituloReceber;
  saldo: number;
}

export interface PainelDoDia {
  hoje: DataISO;
  naOficina: OSVisao[];
  entradasHoje: ItemAgenda[];
  saemHoje: OSVisao[];
  prontos: OSVisao[];
  atrasados: ItemAtraso[];
  semAutorizacao: ItemDias[];
  vistoriaVencendo: ItemDias[];
  aguardandoAgendamento: OSVisao[];
  pendencias: ItemPendencia[];
  propostasCalia: ItemAgenda[];
  vencidos: ItemTitulo[];
  aVencer7: ItemTitulo[];
  recebidoMes: number;
}

export function painelDoDia(
  oss: readonly OSVisao[],
  agendamentos: readonly Agendamento[],
  titulos: readonly TituloReceber[],
  agora: MarcoISO,
  config: ConfigOficina,
): PainelDoDia {
  const hoje = dataNoFuso(agora);
  const porId = new Map(oss.map((v) => [v.os.id, v]));
  const com = (ag: Agendamento) => {
    const v = porId.get(ag.osId);
    return v ? { v, ag } : null;
  };
  const doEstado = (...estados: EstadoOS[]) => oss.filter((v) => estados.includes(v.os.estado));

  const entradasHoje = agendamentos
    .filter((a) => a.data === hoje && a.estado === "confirmado")
    .map(com)
    .filter((x): x is ItemAgenda => x !== null && x.v.os.estado === "agendada")
    .sort((a, b) => (a.ag.janela === b.ag.janela ? 0 : a.ag.janela === "manha" ? -1 : 1));

  const saemHoje = oss.filter((v) => v.os.previsaoEntrega === hoje && ["na_oficina", "pronta"].includes(v.os.estado));
  const prontos = doEstado("pronta").filter((v) => v.os.previsaoEntrega !== hoje);

  const atrasados: ItemAtraso[] = doEstado("na_oficina")
    .map((v) => {
      const semaforo = semaforoOS(v.os, v.etapas, agora, config);
      const impedido = etapaAtual(v.etapas)?.estado === "bloqueada";
      return { v, semaforo, impedido };
    })
    .filter((x) => x.semaforo === "vermelho" || x.impedido)
    .sort((a, b) => Number(b.semaforo === "vermelho") - Number(a.semaforo === "vermelho"));

  const semAutorizacao: ItemDias[] = doEstado("aguardando_aprovacao")
    .map((v) => {
      const abertura = v.atendimentos[0]?.aberturaEm ?? dataNoFuso(v.os.criadoEm);
      return { v, dias: diferencaDias(abertura, hoje), data: abertura };
    })
    .filter((x) => x.dias > LIMITE_SEM_AUTORIZACAO_DIAS)
    .sort((a, b) => b.dias - a.dias);

  const vistoriaVencendo: ItemDias[] = oss
    .filter((v) => ANTES_DA_ENTRADA.has(v.os.estado))
    .flatMap((v) => {
      const limite = v.atendimentos.map((a) => a.limiteVistoriaEm).filter((d): d is DataISO => Boolean(d)).sort()[0];
      if (!limite) return [];
      const dias = diferencaDias(hoje, limite);
      return dias <= LIMITE_VISTORIA_DIAS ? [{ v, dias, data: limite }] : [];
    })
    .sort((a, b) => a.dias - b.dias);

  const propostasCalia = agendamentos
    .filter((a) => a.estado === "proposto")
    .map(com)
    .filter((x): x is ItemAgenda => x !== null)
    .sort((a, b) => (a.ag.expiraEm ?? "").localeCompare(b.ag.expiraEm ?? ""));
  const comProposta = new Set(propostasCalia.map((x) => x.v.os.id));
  const aguardandoAgendamento = doEstado("aguardando_agendamento")
    .filter((v) => !comProposta.has(v.os.id))
    .sort((a, b) => a.os.criadoEm.localeCompare(b.os.criadoEm));

  const pendencias: ItemPendencia[] = oss
    .flatMap((v) => v.pendencias.filter((p) => PENDENCIA_ABERTA.has(p.estado)).map((p) => ({ v, p })))
    .sort((a, b) => a.p.criadaEm.localeCompare(b.p.criadaEm));

  const comOS = (t: TituloReceber): ItemTitulo => ({ v: porId.get(t.osId), t, saldo: saldoTitulo(t) });
  const vencidos = titulos
    .filter((t) => estadoTitulo(t, hoje) === "vencido")
    .map(comOS)
    .sort((a, b) => a.t.vencimento.localeCompare(b.t.vencimento));
  const limite7 = somarDias(hoje, 7);
  const aVencer7 = titulos
    .filter((t) => ["emitido", "parcial"].includes(estadoTitulo(t, hoje)) && t.vencimento >= hoje && t.vencimento <= limite7)
    .map(comOS)
    .sort((a, b) => a.t.vencimento.localeCompare(b.t.vencimento));
  const mes = hoje.slice(0, 7);
  const recebidoMes = somaCentavos(titulos.flatMap((t) => t.baixas.filter((b) => b.recebidoEm.slice(0, 7) === mes).map((b) => b.valor)));

  return {
    hoje,
    naOficina: doEstado("na_oficina", "pronta"),
    entradasHoje,
    saemHoje,
    prontos,
    atrasados,
    semAutorizacao,
    vistoriaVencendo,
    aguardandoAgendamento,
    pendencias,
    propostasCalia,
    vencidos,
    aVencer7,
    recebidoMes,
  };
}

export const somaSaldos = (itens: readonly ItemTitulo[]) => somaCentavos(itens.map((i) => i.saldo));

// ------------------------------------------------------------------ lista de orçamentos

// Abas, busca, filtros e ordenação da lista: lista.ts (sprint SG).

/** Versão vigente (a mais nova). */
export const versaoAtual = (v: OSVisao): OrcamentoVersao | undefined => v.versoes[0];

/** Peças autorizadas × solicitadas e negadas, na versão vigente. */
export function contagemPecas(versao?: OrcamentoVersao): { autorizadas: number; total: number; negadas: number } {
  const itens = (versao?.itens ?? []).filter((i) => i.statusItem !== "dispensado");
  return {
    autorizadas: itens.filter((i) => i.statusItem === "autorizado").length,
    total: itens.length,
    negadas: itens.filter((i) => i.statusItem === "negado").length,
  };
}

/** Valor para a lista: aprovado quando a versão foi aprovada; senão o orçado (soma dos itens). */
export function valorDaLista(versao?: OrcamentoVersao): { valor: number; aprovado: boolean } {
  if (!versao) return { valor: 0, aprovado: false };
  if (versao.estado === "aprovado") return { valor: valorAprovado(versao), aprovado: true };
  return { valor: somaCentavos(versao.itens.filter((i) => i.statusItem !== "dispensado").map((i) => i.valor)), aprovado: false };
}

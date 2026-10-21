// Semáforo de produção (arq. §7.4; revisão SG item 3). Limiares em horas ÚTEIS pelo expediente da configuração.
import type { ConfigOficina, DataISO, EstadoEtapa, EtapaOS, MarcoISO, OS, Semaforo } from "../tipos";
import { laranjaFracao } from "./config";
import { diasUteisEntre, horasUteisEntre } from "./expediente";
import { dataNoFuso, formatarMarco, msDeLocal, paraMs, somarDias } from "./fuso";

const ATIVAS: ReadonlySet<EstadoEtapa> = new Set(["na_fila", "em_execucao", "bloqueada"]);
const FECHADAS: ReadonlySet<EstadoEtapa> = new Set(["concluida", "dispensada"]);
const PESO: Record<Semaforo, number> = { neutro: 0, verde: 1, laranja: 2, vermelho: 3 };

export function piorSemaforo(...cores: Semaforo[]): Semaforo {
  return cores.reduce<Semaforo>((pior, c) => (PESO[c] > PESO[pior] ? c : pior), "neutro");
}

const porOrdem = (etapas: readonly EtapaOS[]) => [...etapas].sort((a, b) => a.ordem - b.ordem);

/** Primeira etapa (por ordem) em na_fila, em_execucao ou bloqueada; null se nenhuma. */
export function etapaAtual(etapas: readonly EtapaOS[]): EtapaOS | null {
  return porOrdem(etapas).find((e) => ATIVAS.has(e.estado)) ?? null;
}

/**
 * concluidas: etapas concluídas; total: etapas não dispensadas;
 * atualIndex: posição (0-based) da etapa atual entre as não dispensadas, ou null.
 */
export function progressoEtapas(etapas: readonly EtapaOS[]): { concluidas: number; total: number; atualIndex: number | null } {
  const validas = porOrdem(etapas).filter((e) => e.estado !== "dispensada");
  const atual = etapaAtual(validas);
  return {
    concluidas: validas.filter((e) => e.estado === "concluida").length,
    total: validas.length,
    atualIndex: atual ? validas.indexOf(atual) : null,
  };
}

/**
 * Fração do prazo da etapa já consumida, em horas úteis: 1 − (horas úteis até prazoEm) / prazoHoras.
 * A janela da etapa são as últimas `prazoHoras` úteis antes de prazoEm (o prazo é encadeado desde a entrada,
 * então a hora em que a etapa entrou na fila não mede o aperto). Antes da janela → 0; no prazo → 1;
 * depois do prazo passa de 1 (1,5 = meio prazo além). Sem prazoEm ou sem prazoHoras (> 0) → null.
 */
export function fracaoPrazoEtapa(etapa: EtapaOS, agora: MarcoISO, config: Pick<ConfigOficina, "expediente">): number | null {
  if (!etapa.prazoEm || !(etapa.prazoHoras > 0)) return null;
  if (paraMs(agora) > paraMs(etapa.prazoEm)) return 1 + horasUteisEntre(etapa.prazoEm, agora, config) / etapa.prazoHoras;
  return Math.max(0, 1 - horasUteisEntre(agora, etapa.prazoEm, config) / etapa.prazoHoras);
}

const EPS = 1e-9;

/**
 * Cor da etapa. aguardando/concluída/dispensada → "neutro".
 * Vermelho: agora > prazoEm, ou bloqueio aberto há mais de vermelhoBloqueioHoras úteis.
 * Laranja: já passou laranjaFracao (padrão 0,8, provisório) do prazo da etapa (fracaoPrazoEtapa).
 * Etapa sem prazoHoras (> 0) cai na regra antiga: restam menos de laranjaAntesHoras úteis até prazoEm.
 * Senão verde.
 */
export function semaforoEtapa(etapa: EtapaOS, agora: MarcoISO, config: ConfigOficina): Semaforo {
  if (!ATIVAS.has(etapa.estado)) return "neutro";
  const { laranjaAntesHoras, vermelhoBloqueioHoras } = config.semaforo;
  const bloqueioLongo = etapa.bloqueios.some(
    (b) => !b.fimEm && horasUteisEntre(b.inicioEm, agora, config) > vermelhoBloqueioHoras,
  );
  if (bloqueioLongo) return "vermelho";
  if (etapa.prazoEm) {
    if (paraMs(agora) > paraMs(etapa.prazoEm)) return "vermelho";
    const fracao = fracaoPrazoEtapa(etapa, agora, config);
    if (fracao !== null) return fracao >= laranjaFracao(config) - EPS ? "laranja" : "verde";
    if (horasUteisEntre(agora, etapa.prazoEm, config) < laranjaAntesHoras) return "laranja";
  }
  return "verde";
}

/**
 * Horas úteis de trabalho que ainda faltam na OS pelo plano: etapa ativa com prazo = o menor entre prazoHoras
 * e as horas úteis até prazoEm; etapa ativa sem prazo e etapas aguardando = prazoHoras. Fechadas não contam.
 */
export function trabalhoRestanteHoras(etapas: readonly EtapaOS[], agora: MarcoISO, config: Pick<ConfigOficina, "expediente">): number {
  let total = 0;
  for (const e of etapas) {
    if (FECHADAS.has(e.estado)) continue;
    const prazo = Math.max(0, e.prazoHoras || 0);
    total += ATIVAS.has(e.estado) && e.prazoEm ? Math.min(prazo, horasUteisEntre(agora, e.prazoEm, config)) : prazo;
  }
  return total;
}

/**
 * Carga até a entrega prometida: trabalho restante ÷ horas úteis de agora até o fim do dia prometido.
 * ≥ 1 não cabe; sem horas disponíveis e com trabalho → Infinity; sem trabalho → 0.
 */
export function cargaAteEntrega(etapas: readonly EtapaOS[], previsao: DataISO, agora: MarcoISO, config: Pick<ConfigOficina, "expediente">): number {
  const trabalho = trabalhoRestanteHoras(etapas, agora, config);
  if (trabalho <= 0) return 0;
  const disponivel = horasUteisEntre(agora, formatarMarco(msDeLocal(somarDias(previsao, 1), 0)), config);
  return disponivel > 0 ? trabalho / disponivel : Number.POSITIVE_INFINITY;
}

/**
 * Cor da OS: só calculada em "na_oficina" (demais estados → "neutro"). Pior entre as etapas ativas e a entrega:
 * - entrega vencida (hoje > previsaoEntrega) → vermelho;
 * - entrega hoje com etapas restantes → laranja;
 * - entrega amanhã (≤ 1 dia útil) com etapas restantes → laranja só se a carga até a entrega
 *   (cargaAteEntrega) passa de laranjaFracao. Decisão do SG para não pintar de laranja todo carro que sai
 *   amanhã com folga (na demonstração seriam 4 de 6); a confirmar com o dono junto com os 80 %.
 */
export function semaforoOS(os: OS, etapas: readonly EtapaOS[], agora: MarcoISO, config: ConfigOficina): Semaforo {
  if (os.estado !== "na_oficina") return "neutro";
  const daOS = etapas.filter((e) => e.osId === os.id);
  let cor: Semaforo = piorSemaforo("verde", ...daOS.map((e) => semaforoEtapa(e, agora, config)));
  if (os.previsaoEntrega) {
    const hoje = dataNoFuso(agora);
    const previsao = os.previsaoEntrega.slice(0, 10);
    const restantes = daOS.some((e) => !FECHADAS.has(e.estado));
    if (hoje > previsao) cor = piorSemaforo(cor, "vermelho");
    else if (restantes && previsao === hoje) cor = piorSemaforo(cor, "laranja");
    else if (restantes && diasUteisEntre(hoje, previsao, config) <= 1 && cargaAteEntrega(daOS, previsao, agora, config) >= laranjaFracao(config) - EPS)
      cor = piorSemaforo(cor, "laranja");
  }
  return cor;
}

// ---------------------------------------------------------------- situação única do cartão (revisão SG, item 3)

export const SITUACOES_CARTAO = ["impedido", "atrasado", "atencao", "no_prazo", "pronto"] as const;
export type SituacaoCartao = (typeof SITUACOES_CARTAO)[number];

/**
 * UMA situação por carro na oficina (uma pílula só): pronta → "pronto"; etapa bloqueada → "impedido"
 * (impedido vence atrasado e atenção); semaforoOS vermelho → "atrasado"; laranja → "atencao"; senão "no_prazo".
 * OS fora da oficina (antes da entrada, entregue, cancelada) → null.
 */
export function situacaoCartao(os: OS, etapas: readonly EtapaOS[], agora: MarcoISO, config: ConfigOficina): SituacaoCartao | null {
  if (os.estado === "pronta") return "pronto";
  if (os.estado !== "na_oficina") return null;
  const daOS = etapas.filter((e) => e.osId === os.id);
  if (daOS.some((e) => e.estado === "bloqueada")) return "impedido";
  const cor = semaforoOS(os, daOS, agora, config);
  return cor === "vermelho" ? "atrasado" : cor === "laranja" ? "atencao" : "no_prazo";
}

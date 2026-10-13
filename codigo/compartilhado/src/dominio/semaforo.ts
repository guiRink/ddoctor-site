// Semáforo de produção (arq. §7.4). Limiares em horas ÚTEIS pelo expediente da configuração.
import type { ConfigOficina, EstadoEtapa, EtapaOS, MarcoISO, OS, Semaforo } from "../tipos";
import { diasUteisEntre, horasUteisEntre } from "./expediente";
import { dataNoFuso, paraMs } from "./fuso";

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
 * Cor da etapa. aguardando/concluída/dispensada → "neutro".
 * Vermelho: agora > prazoEm, ou bloqueio aberto há mais de vermelhoBloqueioHoras úteis.
 * Laranja: restam menos de laranjaAntesHoras úteis até prazoEm. Senão verde.
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
    if (horasUteisEntre(agora, etapa.prazoEm, config) < laranjaAntesHoras) return "laranja";
  }
  return "verde";
}

/**
 * Cor da OS: só calculada em "na_oficina" (demais estados → "neutro").
 * Pior entre as etapas ativas e a previsão global: vencida (hoje > previsaoEntrega) → vermelho;
 * a ≤ 1 dia útil com etapas restantes → laranja.
 */
export function semaforoOS(os: OS, etapas: readonly EtapaOS[], agora: MarcoISO, config: ConfigOficina): Semaforo {
  if (os.estado !== "na_oficina") return "neutro";
  const daOS = etapas.filter((e) => e.osId === os.id);
  let cor: Semaforo = piorSemaforo("verde", ...daOS.map((e) => semaforoEtapa(e, agora, config)));
  if (os.previsaoEntrega) {
    const hoje = dataNoFuso(agora);
    const restantes = daOS.some((e) => !FECHADAS.has(e.estado));
    if (hoje > os.previsaoEntrega) cor = piorSemaforo(cor, "vermelho");
    else if (restantes && diasUteisEntre(hoje, os.previsaoEntrega, config) <= 1) cor = piorSemaforo(cor, "laranja");
  }
  return cor;
}

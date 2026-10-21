// Cor do carro no painel e na TV — pedido do dono, 2º áudio (docs/revisao-sh/pedido-dono-2.md).
// Regra por DIAS ÚTEIS até a entrega prometida (expediente da configuração) e etapas concluídas:
//   vermelho piscando = passou da entrega; vermelho = falta pouco e nenhuma etapa concluída;
//   laranja = falta pouco (com etapa concluída); verde = o resto.
// Base em config.alertaCarro (provisório: ALERTA_CARRO_PADRAO); cada carro pode ter a sua (OS.alerta).
// Funções puras: `agora` e a configuração entram por parâmetro.
import type { AlertaOS, ConfigOficina, CorCarro, DataISO, EtapaOS, MarcoISO, OS } from "../tipos";
import { LIMITES_ALERTA, alertaCarroBase } from "./config";
import { diasUteisEntre, janelaDoDia, proximoDiaUtil } from "./expediente";
import { dataNoFuso, diaSemana, somarDias } from "./fuso";
import { progressoEtapas } from "./semaforo";

/** Gravidade (para ordenar o mosaico da TV: o pior primeiro). */
export const PESO_COR_CARRO: Record<CorCarro, number> = { verde: 0, laranja: 1, vermelho: 2, vermelho_piscando: 3 };

export function piorCorCarro(...cores: CorCarro[]): CorCarro {
  return cores.reduce<CorCarro>((pior, c) => (PESO_COR_CARRO[c] > PESO_COR_CARRO[pior] ? c : pior), "verde");
}

/**
 * Entrega prometida a `dias` dias úteis da data de entrada (ou de hoje, se o carro não entrou). O dia da entrada é o
 * dia 0; conta os dias úteis seguintes pelo expediente (sábado e domingo só contam se estiverem em diasSemana).
 * dias = 0 → o próprio dia (ou o próximo dia útil, se a entrada caiu num dia sem expediente). Feriados ainda não entram.
 */
export function entregaPorDiasUteis(entradaOuHoje: DataISO | MarcoISO, dias: number, config: Pick<ConfigOficina, "expediente">): DataISO {
  if (!Number.isInteger(dias) || dias < 0) throw new Error(`dias_invalidos: ${dias}`);
  const base = entradaOuHoje.length === 10 ? entradaOuHoje : dataNoFuso(entradaOuHoje);
  if (dias === 0) return proximoDiaUtil(base, config);
  let d = base;
  for (let falta = dias, n = 0; falta > 0; n++) {
    if (n > 3660) throw new Error("expediente_sem_dias_uteis");
    d = somarDias(d, 1);
    if (janelaDoDia(d, config)) falta--;
  }
  return d;
}

export interface AlertaEfetivo {
  laranjaDiasAntes: number;
  vermelhoSemEtapaDiasAntes: number;
  piscarAtrasado: boolean;
  /** Prazo combinado do carro (só se ajustado nele). */
  prazoDiasUteis?: number;
  /** O carro tem algum valor próprio (OS.alerta) que vence a base. */
  personalizado: boolean;
}

/** Alerta que vale para o carro: o valor do carro (OS.alerta) vence a base da configuração. */
export function alertaDoCarro(os: Pick<OS, "alerta">, config: Pick<ConfigOficina, "alertaCarro">): AlertaEfetivo {
  const base = alertaCarroBase(config);
  const a = os.alerta ?? {};
  return {
    laranjaDiasAntes: a.laranjaDiasAntes ?? base.laranjaDiasAntes,
    vermelhoSemEtapaDiasAntes: a.vermelhoSemEtapaDiasAntes ?? base.vermelhoSemEtapaDiasAntes,
    piscarAtrasado: base.piscarAtrasado,
    ...(a.prazoDiasUteis !== undefined ? { prazoDiasUteis: a.prazoDiasUteis } : {}),
    personalizado: a.laranjaDiasAntes !== undefined || a.vermelhoSemEtapaDiasAntes !== undefined || a.prazoDiasUteis !== undefined,
  };
}

export interface CorDoCarro {
  cor: CorCarro;
  /** Frase curta para o cartão e a TV: "Entrega amanhã · 2 de 4 etapas", "Atrasado 2 dias". */
  motivo: string;
  /** Dias úteis até a entrega (0 = hoje, 1 = próximo dia útil); negativo = dias úteis de atraso; null = sem entrega. */
  diasUteisParaEntrega: number | null;
  /** Entrega prometida usada na conta. */
  entrega?: DataISO;
  /** Etapas concluídas (dispensadas não contam) e total de etapas não dispensadas. */
  etapasConcluidas: number;
  etapasTotal: number;
  /** O carro usa valores próprios (OS.alerta). */
  personalizado: boolean;
}

const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function textoEntrega(hoje: DataISO, entrega: DataISO, d: number): string {
  if (entrega === hoje) return "Entrega hoje";
  if (entrega === somarDias(hoje, 1)) return "Entrega amanhã";
  if (d <= 1) return `Entrega ${DIAS_SEMANA[diaSemana(entrega)]}`; // sexta → segunda
  return `Entrega em ${plural(d, "dia útil", "dias úteis")}`;
}

/**
 * Cor do carro (pedido do dono, 2º áudio). Só carros em serviço (na_oficina) são avaliados:
 * - pronta → verde, "Pronto"; outros estados (antes da entrada, entregue, cancelada) → verde, "Fora da oficina";
 * - sem entrega prometida (nem prazo do carro com entrada) → verde, "Sem data de entrega" — decisão SH: não há
 *   como medir o aperto sem data; a tela pode marcar o carro como "sem data" à parte;
 * - d = dias úteis de hoje até a entrega (diasUteisEntre: 0 = hoje, 1 = amanhã/próximo dia útil);
 * - passou da entrega (hoje > entrega) → vermelho_piscando (ou vermelho com piscarAtrasado desligado),
 *   "Atrasado N dias" (N em dias úteis, no mínimo 1) — o mesmo critério de "Atrasados" (entrega vencida);
 * - d ≤ vermelhoSemEtapaDiasAntes e nenhuma etapa concluída → vermelho;
 * - d ≤ laranjaDiasAntes → laranja;
 * - senão verde.
 * Valores do carro (OS.alerta) vencem a base. Impedimento (etapa bloqueada) NÃO muda a cor: "Parado" é um selo à
 * parte (contagens.parados), para o dono ver as duas coisas. Prazos das etapas também não entram aqui (semaforoOS).
 */
export function corDoCarro(os: OS, etapas: readonly EtapaOS[], agora: MarcoISO, config: ConfigOficina): CorDoCarro {
  const alerta = alertaDoCarro(os, config);
  const { concluidas, total } = progressoEtapas(etapas.filter((e) => e.osId === os.id));
  const base = { etapasConcluidas: concluidas, etapasTotal: total, personalizado: alerta.personalizado };
  if (os.estado === "pronta") return { ...base, cor: "verde", motivo: "Pronto", diasUteisParaEntrega: null };
  if (os.estado !== "na_oficina") return { ...base, cor: "verde", motivo: "Fora da oficina", diasUteisParaEntrega: null };

  const entrega =
    os.previsaoEntrega?.slice(0, 10) ??
    (alerta.prazoDiasUteis !== undefined && os.entradaRealEm ? entregaPorDiasUteis(os.entradaRealEm, alerta.prazoDiasUteis, config) : undefined);
  if (!entrega) return { ...base, cor: "verde", motivo: "Sem data de entrega", diasUteisParaEntrega: null };

  const hoje = dataNoFuso(agora);
  if (hoje > entrega) {
    const n = Math.max(1, diasUteisEntre(entrega, hoje, config));
    return {
      ...base,
      entrega,
      cor: alerta.piscarAtrasado ? "vermelho_piscando" : "vermelho",
      motivo: `Atrasado ${plural(n, "dia", "dias")}`,
      diasUteisParaEntrega: -n,
    };
  }
  const d = diasUteisEntre(hoje, entrega, config);
  const quando = textoEntrega(hoje, entrega, d);
  const etapasTxt = `${concluidas} de ${plural(total, "etapa", "etapas")}`;
  if (d <= alerta.vermelhoSemEtapaDiasAntes && concluidas === 0)
    return { ...base, entrega, cor: "vermelho", motivo: `${quando} e nenhuma etapa concluída`, diasUteisParaEntrega: d };
  if (d <= alerta.laranjaDiasAntes) return { ...base, entrega, cor: "laranja", motivo: `${quando} · ${etapasTxt}`, diasUteisParaEntrega: d };
  return { ...base, entrega, cor: "verde", motivo: `${quando} · ${etapasTxt}`, diasUteisParaEntrega: d };
}

// ---------------------------------------------------------------- ajuste do alerta por carro

/** Ajuste do alerta de um carro. `null` volta o campo para a base da configuração. */
export interface EntradaAlertaOS {
  /** Prazo em dias úteis desde a entrada (ou de hoje, se não entrou): recalcula a entrega prometida. */
  prazoDiasUteis?: number | null;
  laranjaDiasAntes?: number | null;
  vermelhoSemEtapaDiasAntes?: number | null;
  /** true → prioridade 2 (urgente); false → tira o urgente (volta a 0). */
  urgente?: boolean;
}

export type CodigoAlertaOS = "valor_invalido" | "transicao_invalida" | "nada_a_salvar";

export type ResultadoAlertaOS =
  | { ok: true; mudanca: Pick<OS, "alerta" | "prioridade" | "previsaoEntrega">; resumo: string }
  | { ok: false; codigo: CodigoAlertaOS; campo?: string };

const FECHADA: ReadonlySet<OS["estado"]> = new Set(["entregue", "encerrada", "cancelada"]);

/**
 * Valida e aplica o ajuste do alerta de um carro. Inteiros 0–60 (LIMITES_ALERTA) → senão valor_invalido com o campo;
 * OS entregue, encerrada ou cancelada → transicao_invalida; nenhum campo → nada_a_salvar.
 * prazoDiasUteis recalcula previsaoEntrega com entregaPorDiasUteis a partir da entrada (ou de hoje).
 */
export function aplicarAlertaOS(os: OS, entrada: EntradaAlertaOS, agora: MarcoISO, config: Pick<ConfigOficina, "expediente">): ResultadoAlertaOS {
  if (FECHADA.has(os.estado)) return { ok: false, codigo: "transicao_invalida" };
  const campos = ["prazoDiasUteis", "laranjaDiasAntes", "vermelhoSemEtapaDiasAntes"] as const;
  let alerta: AlertaOS = { ...os.alerta };
  const partes: string[] = [];
  for (const campo of campos) {
    const v = entrada[campo];
    if (v === undefined) continue;
    if (v === null) {
      delete alerta[campo];
      partes.push(`${ROTULO_CAMPO[campo]} pela base`);
      continue;
    }
    const lim = LIMITES_ALERTA[campo];
    if (typeof v !== "number" || !Number.isInteger(v) || v < lim.min || v > lim.max) return { ok: false, codigo: "valor_invalido", campo };
    alerta = { ...alerta, [campo]: v };
    partes.push(`${ROTULO_CAMPO[campo]} ${plural(v, "dia útil", "dias úteis")}`);
  }
  if (entrada.urgente !== undefined && typeof entrada.urgente !== "boolean") return { ok: false, codigo: "valor_invalido", campo: "urgente" };
  if (partes.length === 0 && entrada.urgente === undefined) return { ok: false, codigo: "nada_a_salvar" };

  let previsaoEntrega = os.previsaoEntrega;
  if (typeof entrada.prazoDiasUteis === "number") {
    previsaoEntrega = entregaPorDiasUteis(os.entradaRealEm ?? agora, entrada.prazoDiasUteis, config);
    partes.push(`entrega ${previsaoEntrega}`);
  }
  let prioridade = os.prioridade;
  if (entrada.urgente === true) prioridade = 2;
  if (entrada.urgente === false && prioridade === 2) prioridade = 0;
  if (entrada.urgente !== undefined) partes.push(entrada.urgente ? "urgente" : "sem urgência");

  const vazio = Object.keys(alerta).length === 0;
  return { ok: true, mudanca: { alerta: vazio ? undefined : alerta, prioridade, previsaoEntrega }, resumo: partes.join(", ") };
}

const ROTULO_CAMPO: Record<keyof AlertaOS, string> = {
  prazoDiasUteis: "prazo",
  laranjaDiasAntes: "laranja a",
  vermelhoSemEtapaDiasAntes: "vermelho sem etapa a",
};

// Horários legíveis para Produção, TV, Minhas tarefas e Geral (revisão SG, item 4).
// Funções puras: `agora` e a configuração entram por parâmetro; tudo no fuso da oficina (America/Sao_Paulo).
//
// Prazo fora do expediente (ex.: 04:04): mostra o FIM DO EXPEDIENTE ANTERIOR, porque o trabalho tem de ficar
// pronto antes de a oficina fechar (em horas úteis, 18h de ontem e 04:04 de hoje são o mesmo instante).
// Se esse fechamento já passou e o prazo ainda não (madrugada, fim de semana), não há mais hora útil antes do
// prazo: o rótulo é "antes de abrir". Nunca aparece horário de madrugada.
import type { ConfigOficina, DataISO, MarcoISO } from "@compartilhado/tipos";
import { diasUteisEntre, horasUteisEntre, janelaDoDia } from "@compartilhado/dominio/expediente";
import { dataNoFuso, diaSemana, diferencaDias, minutoDoDia, msDeLocal, paraMs, somarDias } from "@compartilhado/dominio/fuso";

type Expediente = Pick<ConfigOficina, "expediente">;

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;
const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const MS_MIN = 60_000;

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** 960 → "16h"; 990 → "16h30". */
function hora(minutos: number): string {
  const total = Math.round(minutos);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** "hoje", "amanhã", dia da semana até 6 dias à frente ("qui"), depois "12/11". */
export function rotuloDia(data: DataISO, hoje: DataISO): string {
  const dif = diferencaDias(hoje, data);
  if (dif === 0) return "hoje";
  if (dif === 1) return "amanhã";
  if (dif === -1) return "ontem";
  if (dif > 1 && dif <= 6) return DIAS[diaSemana(data)];
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`;
}

/**
 * Último instante útil até o marco (ms): o próprio marco se cair dentro do expediente (início e fim inclusive);
 * senão o fechamento do dia útil anterior mais próximo. null se não houver dia útil (expediente vazio).
 */
export function ultimoInstanteUtil(marco: MarcoISO, config: Expediente): number | null {
  const ms = paraMs(marco);
  const dia = dataNoFuso(ms);
  const min = minutoDoDia(ms);
  const j = janelaDoDia(dia, config);
  if (j && min >= j.inicio && min <= j.fim) return ms;
  if (j && min > j.fim) return msDeLocal(dia, j.fim);
  for (let d = somarDias(dia, -1), n = 0; n < 366; d = somarDias(d, -1), n++) {
    const jd = janelaDoDia(d, config);
    if (jd) return msDeLocal(d, jd.fim);
  }
  return null;
}

/** "atrasado 1 dia" / "atrasado 3 dias" (dias úteis desde a data, no mínimo 1). */
function atrasoEmDias(desde: DataISO, hoje: DataISO, config: Expediente): string {
  return `atrasado ${plural(Math.max(1, diasUteisEntre(desde, hoje, config)), "dia", "dias")}`;
}

/**
 * Prazo legível: "hoje 16h", "amanhã 10h", "qui 9h", "12/11 9h"; data sem hora: "hoje", "amanhã", "qui".
 * Vencido no mesmo dia: "atrasado 3 h" / "atrasado 20 min" (horas úteis); de outro dia: "atrasado 1 dia"
 * (dias úteis). Fora do expediente: veja o cabeçalho do módulo ("antes de abrir").
 */
export function rotuloPrazo(marco: MarcoISO | DataISO, agora: MarcoISO, config: Expediente): string {
  const hoje = dataNoFuso(agora);
  if (SO_DATA.test(marco)) return marco < hoje ? atrasoEmDias(marco, hoje, config) : rotuloDia(marco, hoje);

  const agoraMs = paraMs(agora);
  if (agoraMs > paraMs(marco)) {
    const dia = dataNoFuso(marco);
    if (dia !== hoje) return atrasoEmDias(dia, hoje, config);
    const min = Math.floor(horasUteisEntre(marco, agora, config) * 60);
    if (min < 1) return "atrasado";
    return min < 60 ? `atrasado ${min} min` : `atrasado ${Math.floor(min / 60)} h`;
  }
  const alvo = ultimoInstanteUtil(marco, config);
  if (alvo === null) return rotuloDia(dataNoFuso(marco), hoje);
  if (alvo <= agoraMs) return "antes de abrir";
  return `${rotuloDia(dataNoFuso(alvo), hoje)} ${hora(minutoDoDia(alvo))}`;
}

/** Há quanto tempo (relógio): "agora", "há 20 min", "há 5 h", "há 1 dia", "há 3 dias". Data sem hora: "hoje", "há 2 dias". */
export function rotuloHaQuanto(marco: MarcoISO | DataISO, agora: MarcoISO): string {
  if (SO_DATA.test(marco)) {
    const dias = diferencaDias(marco, dataNoFuso(agora));
    return dias <= 0 ? "hoje" : `há ${plural(dias, "dia", "dias")}`;
  }
  const min = Math.floor((paraMs(agora) - paraMs(marco)) / MS_MIN);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${plural(Math.floor(h / 24), "dia", "dias")}`;
}

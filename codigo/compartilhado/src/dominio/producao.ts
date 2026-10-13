// Produção prevista: peças a entregar por dia útil contra a capacidade de peças/dia.
import type { ConfigOficina, DataISO } from "../tipos";
import { janelaDoDia } from "./expediente";
import { diasDoMes, somarDias } from "./fuso";

export interface ItemPrevisto {
  /** Data de entrega prevista; sem ela o item não entra no gráfico (conta em `semPrevisao`). */
  previsaoEntrega?: DataISO;
  /** Peças a fazer (OS em aberto: itens do orçamento aprovados; etapa: pecasPrevistas − pecasFeitas). */
  pecas: number;
}

export interface DiaPrevisto {
  data: DataISO;
  pecas: number; // peças com entrega neste dia útil (o 1º dia inclui as atrasadas)
  os: number; // itens que caem no dia
  capacidade: number;
  excesso: number; // max(0, pecas − capacidade)
}

export interface ProducaoPrevista {
  dias: DiaPrevisto[];
  /** Peças com previsão antes do 1º dia (já atrasadas), somadas ao 1º dia. */
  pecasAtrasadas: number;
  semPrevisao: number;
  foraDoPeriodo: number; // previsão depois do último dia
}

/**
 * Distribui as peças pelo dia útil da entrega. Previsão em dia não útil vai para o último dia útil antes dela;
 * previsão antes do período soma no 1º dia (e em `pecasAtrasadas`). `diasUteis` em ordem crescente.
 */
export function producaoPrevista(
  itens: readonly ItemPrevisto[],
  diasUteis: readonly DataISO[],
  capacidadePecasDia: number,
): ProducaoPrevista {
  const dias: DiaPrevisto[] = diasUteis.map((data) => ({ data, pecas: 0, os: 0, capacidade: capacidadePecasDia, excesso: 0 }));
  let pecasAtrasadas = 0;
  let semPrevisao = 0;
  let foraDoPeriodo = 0;
  for (const item of itens) {
    const pecas = Math.max(0, item.pecas);
    if (!item.previsaoEntrega) {
      semPrevisao++;
      continue;
    }
    const p = item.previsaoEntrega.slice(0, 10);
    if (dias.length === 0 || p > dias[dias.length - 1].data) {
      foraDoPeriodo++;
      continue;
    }
    let alvo: DiaPrevisto;
    if (p < dias[0].data) {
      alvo = dias[0];
      pecasAtrasadas += pecas;
    } else {
      alvo = dias[0];
      for (const d of dias) if (d.data <= p) alvo = d;
    }
    alvo.pecas += pecas;
    alvo.os++;
  }
  for (const d of dias) d.excesso = Math.max(0, d.pecas - d.capacidade);
  return { dias, pecasAtrasadas, semPrevisao, foraDoPeriodo };
}

/** Os próximos `n` dias úteis a partir de `desde` (inclusive), pelo expediente da configuração. */
export function proximosDiasUteis(desde: DataISO, n: number, config: Pick<ConfigOficina, "expediente">): DataISO[] {
  const dias: DataISO[] = [];
  for (let d = desde, guarda = 0; dias.length < n && guarda < 3660; d = somarDias(d, 1), guarda++)
    if (janelaDoDia(d, config)) dias.push(d);
  return dias;
}

/** Dias úteis do mês "AAAA-MM" pelo expediente da configuração. */
export function diasUteisDoMes(mes: string, config: Pick<ConfigOficina, "expediente">): DataISO[] {
  return diasDoMes(mes).filter((d) => janelaDoDia(d, config) !== null);
}

// Leituras do prazo do carro para a ficha e Ajustes (sem componentes): nome da cor, prazo próprio, prazo atual.
import type { ConfigOficina, CorCarro, MarcoISO } from "@compartilhado/tipos";
import { LIMITES_ALERTA, alertaCarroBase } from "@compartilhado/dominio/config";
import { diasUteisEntre } from "@compartilhado/dominio/expediente";
import { dataNoFuso } from "@compartilhado/dominio/fuso";
import type { OSVisao } from "../../dados/repositorio";

/** Nome da cor (leitor de tela, dica e amostras de Ajustes). */
export const NOME_COR: Record<CorCarro, string> = {
  verde: "Verde",
  laranja: "Laranja",
  vermelho: "Vermelho",
  vermelho_piscando: "Vermelho piscando",
};

/** O carro tem prazo ou limites próprios (diferentes da base da oficina)? */
export function temPrazoProprio(v: OSVisao, config: ConfigOficina): boolean {
  const a = v.os.alerta;
  if (!a) return false;
  const base = alertaCarroBase(config);
  return (
    (a.laranjaDiasAntes !== undefined && a.laranjaDiasAntes !== base.laranjaDiasAntes) ||
    (a.vermelhoSemEtapaDiasAntes !== undefined && a.vermelhoSemEtapaDiasAntes !== base.vermelhoSemEtapaDiasAntes) ||
    (a.prazoDiasUteis !== undefined && a.prazoDiasUteis !== base.prazoPadraoDiasUteis)
  );
}

/** Prazo atual em dias úteis: o combinado no carro, ou o que leva da entrada à entrega prometida, ou a base. */
export function prazoAtual(v: OSVisao, config: ConfigOficina, agora: MarcoISO): number {
  if (v.os.alerta?.prazoDiasUteis !== undefined) return v.os.alerta.prazoDiasUteis;
  const de = dataNoFuso(v.os.entradaRealEm ?? agora);
  if (v.os.previsaoEntrega && v.os.previsaoEntrega.slice(0, 10) >= de) {
    return Math.min(LIMITES_ALERTA.prazoDiasUteis.max, diasUteisEntre(de, v.os.previsaoEntrega.slice(0, 10), config));
  }
  return alertaCarroBase(config).prazoPadraoDiasUteis;
}


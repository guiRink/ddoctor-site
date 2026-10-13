// Situação do material no estoque. Prioridade: zerado > baixo > conferir > ok.
import type { DataISO, Material } from "../tipos";
import { DIAS_CONFERENCIA_ESTOQUE_PADRAO } from "./config";
import { diferencaDias } from "./fuso";

export type StatusEstoque = "ok" | "baixo" | "zerado" | "conferir";

/**
 * zerado: saldo ≤ 0; baixo: saldo < mínimo; conferir: nunca conferido ou última conferência
 * há mais de `diasConferencia` dias (padrão 90, provisório). `hoje` entra por parâmetro.
 */
export function statusEstoque(
  material: Material,
  hoje: DataISO,
  diasConferencia: number = DIAS_CONFERENCIA_ESTOQUE_PADRAO,
): StatusEstoque {
  if (material.saldoEstimado <= 0) return "zerado";
  if (material.saldoEstimado < material.saldoMinimo) return "baixo";
  if (!material.ultimaConferenciaEm || diferencaDias(material.ultimaConferenciaEm.slice(0, 10), hoje) > diasConferencia)
    return "conferir";
  return "ok";
}

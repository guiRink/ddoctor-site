import type { DataISO, FaseVistoria, Foto, Id, OS } from "../tipos";
import { dataNoFuso } from "./fuso";

/** Retenção das fotos (L28, confirmada): 12 meses depois da entrega, depois apagadas. */
export const MESES_RETENCAO_FOTOS = 12;

/** Compressão no aparelho (L38): lado maior e qualidade da foto e da miniatura. */
export const COMPRESSAO_FOTO = {
  ladoMaior: 1600,
  qualidade: 0.75,
  ladoMiniatura: 320,
  qualidadeMiniatura: 0.6,
  /** Arquivo original aceito (antes de comprimir). */
  maxBytesOriginal: 25 * 1024 * 1024,
  /** Foto já comprimida aceita pelo repositório (folga sobre os ~200 KB esperados). */
  maxBytesSalva: 5 * 1024 * 1024,
} as const;

/** Fases em que a produção registra foto; só elas comprovam uma etapa (concluirEtapa). */
export const FASES_FOTO_ETAPA: readonly FaseVistoria[] = ["durante", "final"];

/** Fases que a oficina fotografa (a "externa" vem da Maxpar). */
export const FASES_FOTO_INTERNA: readonly FaseVistoria[] = ["entrada", "durante", "final"];

/** Fotos que comprovam a etapa: da mesma OS, ligadas à etapa, nas fases "durante" ou "final". */
export function fotosDaEtapa(fotos: readonly Foto[], osId: Id, etapaId: Id): Foto[] {
  return fotos.filter((f) => f.osId === osId && f.etapaId === etapaId && FASES_FOTO_ETAPA.includes(f.fase));
}

/** Soma meses a uma data AAAA-MM-DD; dia que não existe no mês de destino vira o último dia (31/01 + 1 → 28/02). */
export function somarMeses(data: DataISO, meses: number): DataISO {
  const [a, m, d] = data.split("-").map(Number);
  const total = a * 12 + (m - 1) + meses;
  const ano = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
}

/**
 * Quando a foto expira pela retenção: entrega + 12 meses. Sem entrega ainda, é estimativa (provisória):
 * previsão de entrega, ou o dia da foto, + 12 meses.
 */
export function expiracaoFoto(
  foto: Pick<Foto, "tiradaEm">,
  os: Pick<OS, "entregueEm" | "previsaoEntrega"> | undefined,
): { expiraEm: DataISO; provisorio: boolean } {
  if (os?.entregueEm) return { expiraEm: somarMeses(dataNoFuso(os.entregueEm), MESES_RETENCAO_FOTOS), provisorio: false };
  const base = os?.previsaoEntrega ?? dataNoFuso(foto.tiradaEm);
  return { expiraEm: somarMeses(base, MESES_RETENCAO_FOTOS), provisorio: true };
}

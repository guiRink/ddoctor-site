// Leitura de números digitados nos formulários (quantidade, horas, decimais). Pura, sem formatação.

/**
 * "1,5" | "1.5" | "2" | "1.000" | "1.000,5" → número; vazio ou inválido → null.
 * Aceita só dígitos com UM separador decimal ("," ou "."). Ponto de milhar só em grupos de 3 dígitos
 * depois de um primeiro grupo de 1 a 3 dígitos que não começa por zero ("1.000" = 1000, "12.345,6" = 12345.6;
 * "0.125" = 0.125). Recusa sinal, expoente e hexadecimal ("-1", "1e3", "0x10"), separadores misturados
 * ("1,000.5") e mais de um separador decimal ("1,2,3").
 */
export function lerNumero(texto: string): number | null {
  const t = texto.trim();
  if (!/\d/.test(t)) return null;
  let normal: string | null = null;
  if (/^\d+$/.test(t)) normal = t;
  else if (/^[1-9]\d{0,2}(\.\d{3})+(,\d*)?$/.test(t)) normal = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d*,\d*$/.test(t)) normal = t.replace(",", ".");
  else if (/^\d*\.\d*$/.test(t)) normal = t;
  if (normal === null) return null;
  const n = Number(normal.endsWith(".") ? normal.slice(0, -1) : normal);
  return Number.isFinite(n) ? n : null;
}

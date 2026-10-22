/**
 * Senha do login do funcionário (Equipe → Dar login). O Supabase Auth (bcrypt) só aproveita 72 BYTES: letra com
 * acento conta 2, emoji 4. Mínimo de 8 caracteres (provisório — a confirmar; o Supabase Auth pede 6+).
 */
export const LIMITES_SENHA = { min: 8, maxBytes: 72 } as const;

/** Tamanho em bytes UTF-8 (o que o bcrypt do Auth enxerga). */
export function bytesUtf8(texto: string): number {
  return new TextEncoder().encode(texto).length;
}

/** null = senha aceita; senão o código de ERRO (rotulos.ts). Mínimo em caracteres, máximo em bytes UTF-8. */
export function validarSenha(senha: string): "senha_curta" | "senha_longa" | null {
  if (Array.from(senha).length < LIMITES_SENHA.min) return "senha_curta";
  if (bytesUtf8(senha) > LIMITES_SENHA.maxBytes) return "senha_longa";
  return null;
}

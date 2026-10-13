// CPF, CNPJ e CEP. Normaliza sem truncar: a validação vê o documento inteiro.
// CNPJ alfanumérico (IN RFB 2.229/2024, vigente desde jul/2026): 12 posições [0-9A-Z] + 2 DV numéricos;
// o DV usa o valor (código ASCII − 48) de cada posição, o que mantém o cálculo antigo para CNPJ só numérico.
import type { TipoPessoa } from "../tipos";

/** Remove máscara e espaços; letras viram maiúsculas (CNPJ alfanumérico). Não corta nada. */
export function normalizarDocumento(texto: string): string {
  return texto.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function dv(base: string, pesos: readonly number[]): number {
  let soma = 0;
  for (let i = 0; i < base.length; i++) soma += (base.charCodeAt(i) - 48) * pesos[i];
  const r = soma % 11;
  return r < 2 ? 0 : 11 - r;
}

const repetido = (s: string) => /^(.)\1*$/.test(s);

/** CPF com ou sem máscara: 11 dígitos, não repetidos, DVs corretos. */
export function validarCPF(texto: string): boolean {
  const d = normalizarDocumento(texto);
  if (!/^\d{11}$/.test(d) || repetido(d)) return false;
  const d1 = dv(d.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv(d.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(d[9]) && d2 === Number(d[10]);
}

const PESOS_CNPJ = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;

/** CNPJ com ou sem máscara (numérico ou alfanumérico): 14 posições, DVs corretos. */
export function validarCNPJ(texto: string): boolean {
  const d = normalizarDocumento(texto);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(d) || repetido(d)) return false;
  const d1 = dv(d.slice(0, 12), PESOS_CNPJ);
  const d2 = dv(d.slice(0, 13), [6, ...PESOS_CNPJ]);
  return d1 === Number(d[12]) && d2 === Number(d[13]);
}

/** "pf" para 11 dígitos, "pj" para 14 posições; null para outros tamanhos (não valida os DVs). */
export function tipoPorDocumento(texto: string): TipoPessoa | null {
  const d = normalizarDocumento(texto);
  if (/^\d{11}$/.test(d)) return "pf";
  if (/^[0-9A-Z]{12}\d{2}$/.test(d)) return "pj";
  return null;
}

/** Documento válido do tipo indicado (ou do tipo deduzido pelo tamanho). */
export function validarDocumento(texto: string, tipo?: TipoPessoa): boolean {
  const t = tipo ?? tipoPorDocumento(texto);
  if (t === "pf") return validarCPF(texto);
  if (t === "pj") return validarCNPJ(texto);
  return false;
}

/** 000.000.000-00 ou 00.000.000/0000-00; outro tamanho volta normalizado, sem máscara. */
export function formatarDocumento(texto: string): string {
  const d = normalizarDocumento(texto);
  if (/^\d{11}$/.test(d)) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return d;
}

/** CEP só com dígitos; null se não tiver exatamente 8. */
export function normalizarCEP(texto: string): string | null {
  const d = texto.replace(/\D/g, "");
  return d.length === 8 ? d : null;
}

/** 80000000 → "80000-000"; inválido volta como veio. */
export function formatarCEP(texto: string): string {
  const d = normalizarCEP(texto);
  return d ? `${d.slice(0, 5)}-${d.slice(5)}` : texto;
}

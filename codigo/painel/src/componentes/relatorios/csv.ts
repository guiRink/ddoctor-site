// Exportação CSV para planilha em pt-BR: separador ";", BOM UTF-8 (acentos no Excel), linhas CRLF.
import type { Centavos } from "@compartilhado/tipos";

export type CelulaCsv = string | number | null | undefined;

/** Campo com ; " ou quebra de linha vai entre aspas (aspas internas duplicadas). */
function celula(v: CelulaCsv): string {
  if (v === null || v === undefined) return "";
  const t = typeof v === "number" ? (Number.isFinite(v) ? String(v).replace(".", ",") : "") : v;
  return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** Monta o texto do CSV (com BOM). A primeira linha é o cabeçalho. */
export function gerarCsv(linhas: readonly (readonly CelulaCsv[])[]): string {
  return "﻿" + linhas.map((l) => l.map(celula).join(";")).join("\r\n") + "\r\n";
}

/** Centavos → "1234,56" (sem milhar nem "R$", para a planilha somar). */
export function reaisCsv(c: Centavos | null | undefined): string {
  if (c === null || c === undefined || !Number.isFinite(c)) return "";
  const inteiro = Math.round(c);
  const abs = Math.abs(inteiro);
  return `${inteiro < 0 ? "-" : ""}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

/** Baixa o CSV no navegador. */
export function baixarCsv(nomeArquivo: string, conteudo: string): void {
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

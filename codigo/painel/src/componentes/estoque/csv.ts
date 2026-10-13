// CSV gerado no cliente para abrir no Excel em pt-BR: separador ";", vírgula decimal, BOM UTF-8, CRLF.
import type { Centavos } from "@compartilhado/tipos";

export type CelulaCsv = string | number | null | undefined;

const BOM = "﻿";

/** Aspas quando há separador, aspas, quebra de linha ou espaço nas pontas; aspas internas dobradas. */
export function celulaCsv(v: CelulaCsv): string {
  if (v === null || v === undefined) return "";
  const t = typeof v === "number" ? numeroCsv(v) : v;
  return /[;"\r\n]|^\s|\s$/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** 3.5 → "3,5" (sem separador de milhar, para a planilha ler como número). */
export function numeroCsv(n: number): string {
  if (!Number.isFinite(n)) return "";
  return String(Math.round(n * 1000) / 1000).replace(".", ",");
}

/** 123456 centavos → "1234,56". */
export function centavosCsv(c: Centavos | null | undefined): string {
  if (c === null || c === undefined || !Number.isFinite(c)) return "";
  const v = Math.round(c);
  const abs = Math.abs(v);
  return `${v < 0 ? "-" : ""}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

/** Monta o arquivo inteiro (com BOM). */
export function gerarCsv(cabecalho: readonly string[], linhas: readonly (readonly CelulaCsv[])[]): string {
  return BOM + [cabecalho, ...linhas].map((l) => l.map(celulaCsv).join(";")).join("\r\n") + "\r\n";
}

/** "estoque-materiais" + "2026-10-13" → "estoque-materiais-2026-10-13.csv". */
export const nomeArquivoCsv = (prefixo: string, hoje: string) => `${prefixo}-${hoje}.csv`;

/** Dispara o download no navegador. */
export function baixarCsv(nome: string, conteudo: string): void {
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

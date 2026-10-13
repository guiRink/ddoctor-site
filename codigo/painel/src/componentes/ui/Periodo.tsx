import type { ReactNode } from "react";
import { Icone } from "../Icone";

const SETA =
  "inline-grid place-items-center w-10 md:w-9 h-full rounded-[4px] text-tinta-suave hover:text-tinta hover:bg-cinza-100 transition-colors duration-150 disabled:opacity-35 disabled:pointer-events-none";

/**
 * Seletor de período — versão única (docs/painel-design.md §3 "Seletor de período"): ← período →
 * num controle só (branco, borda `linha-forte`, raio 6, 40 px / 44 no celular), texto 14/600 tabular no meio.
 * O atalho para o período atual ("Hoje", "Mês atual") é um botão fantasma à esquerda e só aparece fora dele.
 */
export function SeletorPeriodo({
  rotulo,
  texto,
  onAnterior,
  onProximo,
  rotuloAnterior,
  rotuloProximo,
  proximoDesabilitado = false,
  atalho,
  larguraTexto = "min-w-[148px]",
}: {
  rotulo: string;
  texto: ReactNode;
  onAnterior: () => void;
  onProximo: () => void;
  rotuloAnterior: string;
  rotuloProximo: string;
  proximoDesabilitado?: boolean;
  /** Volta ao período atual; omitido quando já está nele. */
  atalho?: { texto: string; onClick: () => void };
  larguraTexto?: string;
}) {
  return (
    <div role="group" aria-label={rotulo} className="inline-flex items-center gap-1">
      {atalho && (
        <button
          type="button"
          onClick={atalho.onClick}
          className="h-11 md:h-10 px-3 rounded-controle text-[13px] font-semibold text-tinta-suave hover:text-tinta hover:bg-cinza-100 transition-colors duration-150"
        >
          {atalho.texto}
        </button>
      )}
      <span className="inline-flex items-stretch h-11 md:h-10 p-0.5 bg-cartao border border-linha-forte rounded-controle shadow-controle">
        <button type="button" onClick={onAnterior} aria-label={rotuloAnterior} className={SETA}>
          <Icone nome="voltar" tamanho={16} />
        </button>
        <span aria-live="polite" className={`inline-flex items-center justify-center px-2 text-[14px] font-semibold numero whitespace-nowrap ${larguraTexto}`}>
          <span className="block first-letter:uppercase">{texto}</span>
        </span>
        <button type="button" onClick={onProximo} aria-label={rotuloProximo} disabled={proximoDesabilitado} className={SETA}>
          <Icone nome="seta" tamanho={16} />
        </button>
      </span>
    </div>
  );
}

import { useRef, type KeyboardEvent } from "react";
import { Icone } from "../Icone";
import { nomeMesCurto, somarMeses } from "./formato";

/** Seletor de mês: ◀ outubro de 2026 ▶ num controle só (raio 6, borda `linha-forte`). */
export function SeletorMes({ mes, onMudar, maximo }: { mes: string; onMudar: (m: string) => void; maximo?: string }) {
  const botao =
    "inline-grid place-items-center w-11 md:w-9 h-full text-tinta-suave hover:text-tinta hover:bg-cinza-50 transition-colors duration-150 disabled:opacity-35 disabled:pointer-events-none";
  return (
    <div role="group" aria-label="Mês do relatório" className="inline-flex items-stretch h-11 md:h-9 bg-cartao border border-linha-forte rounded-controle shadow-controle overflow-hidden">
      <button type="button" className={`${botao} border-r border-linha`} aria-label="Mês anterior" onClick={() => onMudar(somarMeses(mes, -1))}>
        <Icone nome="baixo" tamanho={16} className="rotate-90" />
      </button>
      <span aria-live="polite" className="inline-flex items-center justify-center min-w-[8.5rem] md:min-w-[10.5rem] px-2 md:px-3 text-[14px] font-semibold numero whitespace-nowrap">
        {nomeMesCurto(mes)} {mes.slice(0, 4)}
      </span>
      <button
        type="button"
        className={`${botao} border-l border-linha`}
        aria-label="Próximo mês"
        disabled={maximo !== undefined && mes >= maximo}
        onClick={() => onMudar(somarMeses(mes, 1))}
      >
        <Icone nome="baixo" tamanho={16} className="-rotate-90" />
      </button>
    </div>
  );
}

/** Abas de navegação com sublinhado amarelo (mesmo desenho das abas de Orçamentos), setas do teclado. */
export function Abas<T extends string>({
  rotulo,
  abas,
  valor,
  onMudar,
  idPainel,
}: {
  rotulo: string;
  abas: readonly { chave: T; nome: string; contagem?: number }[];
  valor: T;
  onMudar: (v: T) => void;
  idPainel: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function teclado(e: KeyboardEvent, i: number) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const j = (i + delta + abas.length) % abas.length;
    onMudar(abas[j].chave);
    refs.current[j]?.focus();
  }
  return (
    <div className="-mx-4 md:mx-0 px-4 md:px-0 overflow-x-auto border-b border-linha mb-6">
      <div role="tablist" aria-label={rotulo} className="flex gap-0.5 min-w-max">
        {abas.map((a, i) => {
          const ativa = a.chave === valor;
          return (
            <button
              key={a.chave}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`aba-${a.chave}`}
              aria-selected={ativa}
              aria-controls={idPainel}
              tabIndex={ativa ? 0 : -1}
              onClick={() => onMudar(a.chave)}
              onKeyDown={(e) => teclado(e, i)}
              className={`flex items-center gap-2 h-11 px-3 text-[14px] whitespace-nowrap border-b-2 -mb-px transition-colors duration-150 ${
                ativa ? "border-amarelo font-semibold text-tinta" : "border-transparent font-medium text-tinta-suave hover:text-tinta hover:border-linha-forte"
              }`}
            >
              {a.nome}
              {a.contagem !== undefined && <span className={`numero text-[12px] font-medium ${ativa ? "text-tinta-suave" : "text-tinta-fraca"}`}>{a.contagem}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

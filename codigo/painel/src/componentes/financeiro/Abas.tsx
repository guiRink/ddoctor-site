import { useRef, type KeyboardEvent, type ReactNode } from "react";

/**
 * Abas de seção (navegação dentro da tela): sublinhado amarelo na ativa, contagem tabular.
 * Mesmo desenho das abas de estado de Orçamentos (docs/painel-design.md §3 "Segmentos").
 * ARIA tablist: ← → trocam de aba, Home/End vão às pontas. No celular a fileira rola.
 */
export interface Aba<T extends string> {
  valor: T;
  texto: string;
  contagem?: number;
  /** Contagem em vermelho (ex.: itens para repor). */
  critico?: boolean;
}

export function Abas<T extends string>({
  rotulo,
  abas,
  valor,
  onMudar,
  idBase,
}: {
  rotulo: string;
  abas: Aba<T>[];
  valor: T;
  onMudar: (v: T) => void;
  idBase: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function teclas(e: KeyboardEvent, i: number) {
    let alvo = -1;
    if (e.key === "ArrowRight") alvo = (i + 1) % abas.length;
    if (e.key === "ArrowLeft") alvo = (i - 1 + abas.length) % abas.length;
    if (e.key === "Home") alvo = 0;
    if (e.key === "End") alvo = abas.length - 1;
    if (alvo < 0) return;
    e.preventDefault();
    onMudar(abas[alvo].valor);
    refs.current[alvo]?.focus();
  }

  return (
    <div className="-mx-4 md:mx-0 px-4 md:px-0 overflow-x-auto border-b border-linha mb-5">
      <div role="tablist" aria-label={rotulo} className="flex gap-0.5 min-w-max">
        {abas.map((a, i) => {
          const ativa = a.valor === valor;
          return (
            <button
              key={a.valor}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${idBase}-aba-${a.valor}`}
              aria-selected={ativa}
              aria-controls={`${idBase}-painel`}
              tabIndex={ativa ? 0 : -1}
              onClick={() => onMudar(a.valor)}
              onKeyDown={(e) => teclas(e, i)}
              className={`flex items-center gap-2 h-11 px-3 text-[14px] whitespace-nowrap border-b-2 -mb-px transition-colors duration-150 ${
                ativa ? "border-amarelo font-semibold text-tinta" : "border-transparent font-medium text-tinta-suave hover:text-tinta hover:border-linha-forte"
              }`}
            >
              {a.texto}
              {a.contagem !== undefined && (
                <span
                  className={`numero text-[12px] font-medium ${
                    a.critico && a.contagem > 0 ? "text-alerta" : ativa ? "text-tinta-suave" : "text-tinta-fraca"
                  }`}
                >
                  {a.contagem}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PainelAba({ idBase, valor, children }: { idBase: string; valor: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`${idBase}-painel`} aria-labelledby={`${idBase}-aba-${valor}`}>
      {children}
    </div>
  );
}

/** Barra de ferramentas da aba: filtros à esquerda, ações à direita; empilha no celular. */
export function BarraFerramentas({ filtros, acoes }: { filtros: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center min-w-0">{filtros}</div>
      {acoes && <div className="flex flex-wrap items-center gap-2 shrink-0">{acoes}</div>}
    </div>
  );
}

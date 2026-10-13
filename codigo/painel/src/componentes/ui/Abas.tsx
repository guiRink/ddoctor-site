import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

/**
 * Abas de navegação — versão única (docs/painel-design.md §3 "Abas").
 * Fileira com divisória `linha` embaixo; aba 44 px, 14 px, 500 `tinta-suave`; ativa 600 `tinta` com sublinhado
 * amarelo de 2 px sobre a divisória; contagem 12 tabular ao lado (vermelha quando crítica). Hover: texto `tinta`
 * e sublinhado `linha-forte`. No celular a fileira rola até a borda e a aba ativa entra na tela sozinha.
 * Duas formas: `Abas` (tablist com painel, setas do teclado) e `BarraAbas` + `classeAba` (links ou botões de
 * navegação que mudam a URL: Orçamentos, ficha da OS).
 */

export function classeAba(ativa: boolean): string {
  return `flex items-center gap-2 h-11 px-3 text-[14px] no-underline whitespace-nowrap border-b-2 -mb-px transition-colors duration-150 ${
    ativa ? "border-amarelo font-semibold text-tinta" : "border-transparent font-medium text-tinta-suave hover:text-tinta hover:border-linha-forte"
  }`;
}

export function ContagemAba({ n, ativa = false, critico = false }: { n: number; ativa?: boolean; critico?: boolean }) {
  return <span className={`numero text-[12px] font-medium ${critico && n > 0 ? "text-alerta" : ativa ? "text-tinta-suave" : "text-tinta-fraca"}`}>{n}</span>;
}

/** Fileira rolável das abas. `chave` = valor da aba ativa (para trazê-la à vista no celular). */
export function BarraAbas({
  rotulo,
  chave,
  como = "nav",
  className = "mb-6",
  children,
}: {
  rotulo: string;
  chave: string;
  /** "nav" envolve uma lista de links; "tablist" é o contêiner de `Abas`. */
  como?: "nav" | "tablist";
  className?: string;
  children: ReactNode;
}) {
  const trilho = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const t = trilho.current;
    const ativa = t?.querySelector<HTMLElement>('[aria-selected="true"], [aria-current="page"]');
    if (!t || !ativa || t.scrollWidth <= t.clientWidth) return;
    const esq = ativa.offsetLeft; // o trilho é `relative`: offsetLeft já é relativo a ele
    const dir = esq + ativa.offsetWidth;
    if (esq < t.scrollLeft + 16) t.scrollLeft = Math.max(0, esq - 16);
    else if (dir > t.scrollLeft + t.clientWidth - 16) t.scrollLeft = dir - t.clientWidth + 48;
  }, [chave]);

  return (
    <div ref={trilho} className={`relative -mx-4 md:mx-0 px-4 md:px-0 overflow-x-auto border-b border-linha ${className}`}>
      {como === "nav" ? (
        <nav aria-label={rotulo}>
          <ul className="m-0 p-0 list-none flex gap-0.5 min-w-max">{children}</ul>
        </nav>
      ) : (
        <div role="tablist" aria-label={rotulo} className="flex gap-0.5 min-w-max">
          {children}
        </div>
      )}
    </div>
  );
}

export interface Aba<T extends string> {
  valor: T;
  texto: string;
  contagem?: number;
  /** Contagem em vermelho quando > 0 (ex.: itens para repor). */
  critico?: boolean;
}

/** Abas com painel (ARIA tablist): ← → trocam, Home/End vão às pontas. Use `PainelAba` com o mesmo `idBase`. */
export function Abas<T extends string>({
  rotulo,
  abas,
  valor,
  onMudar,
  idBase,
  className,
}: {
  rotulo: string;
  abas: readonly Aba<T>[];
  valor: T;
  onMudar: (v: T) => void;
  idBase: string;
  className?: string;
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
    <BarraAbas rotulo={rotulo} chave={valor} como="tablist" className={className}>
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
            className={classeAba(ativa)}
          >
            {a.texto}
            {a.contagem !== undefined && <ContagemAba n={a.contagem} ativa={ativa} critico={a.critico} />}
          </button>
        );
      })}
    </BarraAbas>
  );
}

export function PainelAba({ idBase, valor, children }: { idBase: string; valor: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`${idBase}-painel`} aria-labelledby={`${idBase}-aba-${valor}`}>
      {children}
    </div>
  );
}

/** Barra de ferramentas da aba: filtros à esquerda, ações à direita; empilha no celular. Controles de 36 px. */
export function BarraFerramentas({ filtros, acoes }: { filtros: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center min-w-0">{filtros}</div>
      {acoes && <div className="flex flex-wrap items-center gap-2 shrink-0">{acoes}</div>}
    </div>
  );
}

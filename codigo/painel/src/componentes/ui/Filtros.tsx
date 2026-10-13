import type { ReactNode } from "react";

/**
 * Segmentos de filtro com contagem (um selecionado por vez) — docs/painel-design.md §3 "Segmentos".
 * Mesmo visual em Produção, Recebíveis, Estoque e Funcionários.
 * Revisão SE: trilho cinza claro com o selecionado em branco elevado (controle segmentado).
 * Não usa amarelo: amarelo fica para a ação primária da tela.
 * No celular a fileira rola na horizontal até a borda da tela; no desktop quebra linha.
 */
export type OpcaoFiltro<T extends string> = {
  valor: T;
  texto: ReactNode;
  /** Número ao lado do texto; string para "–" enquanto carrega. */
  contagem?: number | string;
  /** Contagem em vermelho quando não selecionada (ex.: atrasados > 0). */
  critico?: boolean;
};

export function GrupoFiltros<T extends string>({
  rotulo,
  mostrarRotulo = true,
  opcoes,
  valor,
  onMudar,
}: {
  rotulo: string;
  mostrarRotulo?: boolean;
  opcoes: OpcaoFiltro<T>[];
  valor: T;
  onMudar: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={rotulo} className="flex flex-col gap-1.5 md:flex-row md:items-center min-w-0 max-w-full">
      {mostrarRotulo && <span className="text-[13px] font-medium text-tinta-suave md:mr-1">{rotulo}</span>}
      <div className="flex overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-cartao bg-cinza-100 md:flex-wrap shrink-0">
          {opcoes.map((o) => {
            const ativo = o.valor === valor;
            return (
              <button
                key={o.valor}
                type="button"
                aria-pressed={ativo}
                onClick={() => onMudar(o.valor)}
                className={`shrink-0 inline-flex items-center gap-1.5 h-10 md:h-8 px-3 rounded-controle text-[13px] whitespace-nowrap transition-colors duration-150 ${
                  ativo
                    ? "bg-cartao text-tinta font-semibold shadow-[0_1px_2px_rgba(17,17,17,0.08)] ring-1 ring-linha"
                    : "text-tinta-suave font-medium hover:text-tinta"
                }`}
              >
                {o.texto}
                {o.contagem !== undefined && (
                  <span
                    className={`numero text-[12px] min-w-3 text-center ${
                      o.critico ? "text-alerta font-semibold" : "text-tinta-fraca"
                    }`}
                  >
                    {o.contagem}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

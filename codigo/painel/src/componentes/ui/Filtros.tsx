import type { ReactNode } from "react";

/**
 * Segmentos de filtro com contagem (um selecionado por vez) — docs/painel-design.md §3 "Segmentos".
 * Mesmo visual em Produção, Recebíveis, Estoque e Funcionários.
 * Selecionado = preto (estado), não amarelo: amarelo fica para a ação primária da tela.
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
      {mostrarRotulo && <span className="rotulo text-tinta-fraca md:mr-1">{rotulo}</span>}
      <div className="flex items-center gap-1.5 overflow-x-auto -mx-4 px-4 py-1 -my-1 md:mx-0 md:px-0 md:flex-wrap md:overflow-visible">
        {opcoes.map((o) => {
          const ativo = o.valor === valor;
          return (
            <button
              key={o.valor}
              type="button"
              aria-pressed={ativo}
              onClick={() => onMudar(o.valor)}
              className={`shrink-0 inline-flex items-center gap-2 h-11 md:h-9 px-3 text-[13px] font-semibold border transition-colors duration-150 ${
                ativo ? "bg-preto text-papel border-preto" : "bg-cartao text-tinta border-linha-forte hover:border-preto"
              }`}
            >
              {o.texto}
              {o.contagem !== undefined && (
                <span
                  className={`numero text-[12px] min-w-3 text-center ${
                    ativo ? "text-papel-suave" : o.critico ? "text-alerta font-bold" : "text-tinta-fraca"
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
  );
}

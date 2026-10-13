import type { ReactNode } from "react";

/**
 * Grupo de filtros em botões com contagem (um selecionado por vez).
 * Selecionado = preto (estado), não amarelo: amarelo fica para a ação primária da tela.
 */
export function GrupoFiltros<T extends string>({
  rotulo,
  opcoes,
  valor,
  onMudar,
}: {
  rotulo: string;
  opcoes: { valor: T; texto: ReactNode; contagem?: number }[];
  valor: T;
  onMudar: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={rotulo} className="flex flex-col gap-1.5 md:flex-row md:items-center min-w-0 max-w-full">
      <span className="rotulo text-tinta-fraca mr-1">{rotulo}</span>
      <div className="flex items-center gap-1.5 overflow-x-auto p-1 -m-1 md:flex-wrap md:overflow-visible">
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
              <span className={`numero text-[12px] ${ativo ? "text-papel-suave" : "text-tinta-fraca"}`}>{o.contagem}</span>
            )}
          </button>
        );
      })}
      </div>
    </div>
  );
}

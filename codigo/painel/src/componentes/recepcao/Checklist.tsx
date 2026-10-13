import type { ChecklistItem } from "@compartilhado/tipos";
import { gruposChecklist, progressoChecklist } from "@compartilhado/dominio/recepcao";
import { Icone } from "../Icone";

/** Barra de progresso do checklist: "6 de 21" + barra fina (verde quando completo). */
export function ProgressoChecklist({ checklist, itens, className = "" }: { checklist: Record<string, boolean>; itens: readonly ChecklistItem[]; className?: string }) {
  const p = progressoChecklist(checklist, itens);
  const pct = Math.round((p.fracao ?? 0) * 100);
  return (
    <div className={`flex items-center gap-3 min-w-0 ${className}`}>
      <span className="text-[13px] numero whitespace-nowrap">
        <span className="font-semibold text-tinta">{p.marcados}</span>
        <span className="text-tinta-suave"> de {p.total}</span>
      </span>
      <span
        role="progressbar"
        aria-label="Itens conferidos"
        aria-valuemin={0}
        aria-valuemax={p.total}
        aria-valuenow={p.marcados}
        className="relative flex-1 min-w-16 h-1.5 rounded-full bg-cinza-200 overflow-hidden"
      >
        <span className={`absolute inset-y-0 left-0 rounded-full ${p.completo ? "bg-ok" : "bg-tinta"}`} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

/** Caixa de marcação visual (o input real é sr-only dentro do label). */
function Caixa({ marcado }: { marcado: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-grid place-items-center shrink-0 w-5 h-5 rounded-[5px] border transition-colors duration-150 ${
        marcado ? "bg-tinta border-tinta text-cartao" : "bg-cartao border-linha-forte"
      }`}
    >
      {marcado && <Icone nome="ok" tamanho={14} traco={2.25} />}
    </span>
  );
}

/**
 * Checklist de entrada agrupado (itens de `config.checklist ?? CHECKLIST_PADRAO`).
 * Edição: caixas grandes (linha inteira clicável, ≥ 44 px), "Marcar grupo" por grupo e progresso no topo.
 * Leitura: grade compacta com ✓ ou traço; o que não foi conferido fica em cinza.
 */
export function Checklist({
  itens,
  valor,
  onMudar,
  somenteLeitura = false,
  mostrarProgresso = true,
}: {
  itens: readonly ChecklistItem[];
  valor: Record<string, boolean>;
  onMudar?: (v: Record<string, boolean>) => void;
  somenteLeitura?: boolean;
  mostrarProgresso?: boolean;
}) {
  const grupos = gruposChecklist(itens);
  const editavel = !somenteLeitura && onMudar;

  if (grupos.length === 0) {
    return <p className="text-[13px] text-tinta-suave">Nenhum item de checklist ativo. O dono ou o gestor cadastra os itens em Ajustes.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {mostrarProgresso && <ProgressoChecklist checklist={valor} itens={itens} className="max-w-sm" />}
      {grupos.map(({ grupo, itens: doGrupo }) => {
        const marcados = doGrupo.filter((i) => valor[i.id]).length;
        const todos = marcados === doGrupo.length;
        return (
          <section key={grupo} aria-label={grupo} className="min-w-0">
            <header className="flex items-center justify-between gap-3 mb-2 min-h-8">
              <h3 className="text-[13px] font-semibold text-tinta">
                {grupo}
                <span className="ml-2 font-normal text-tinta-fraca numero">
                  {marcados}/{doGrupo.length}
                </span>
              </h3>
              {editavel && (
                <button
                  type="button"
                  onClick={() => onMudar({ ...valor, ...Object.fromEntries(doGrupo.map((i) => [i.id, !todos])) })}
                  className="inline-flex items-center h-11 md:h-8 -my-1.5 px-2 rounded-controle text-[13px] font-medium text-tinta-suave hover:text-tinta hover:bg-cinza-100 transition-colors duration-150"
                  aria-label={`${todos ? "Desmarcar" : "Marcar"} todos os itens de ${grupo}`}
                >
                  {todos ? "Desmarcar grupo" : "Marcar grupo"}
                </button>
              )}
            </header>
            {editavel ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {doGrupo.map((i) => {
                  const marcado = Boolean(valor[i.id]);
                  return (
                    <li key={i.id}>
                      <label
                        className={`flex items-center gap-3 min-h-12 px-3 py-2 rounded-controle border cursor-pointer select-none transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-amarelo-escuro has-[:focus-visible]:outline-offset-2 ${
                          marcado ? "bg-cinza-50 border-linha-forte" : "bg-cartao border-linha hover:border-linha-forte hover:bg-cinza-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={(e) => onMudar({ ...valor, [i.id]: e.target.checked })}
                          className="sr-only"
                        />
                        <Caixa marcado={marcado} />
                        <span className={`text-[14px] leading-snug ${marcado ? "text-tinta font-medium" : "text-tinta"}`}>{i.nome}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {doGrupo.map((i) => {
                  const marcado = Boolean(valor[i.id]);
                  return (
                    <li key={i.id} className="flex items-center gap-2 text-[13px] min-w-0">
                      {marcado ? (
                        <Icone nome="ok" tamanho={16} traco={2} className="text-ok shrink-0" />
                      ) : (
                        <span aria-hidden="true" className="inline-block w-4 shrink-0 text-center text-tinta-fraca">–</span>
                      )}
                      <span className={marcado ? "text-tinta" : "text-tinta-fraca"}>
                        {i.nome}
                        <span className="sr-only">{marcado ? ": conferido" : ": não conferido"}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

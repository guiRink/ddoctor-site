import { useEffect, useRef } from "react";
import type { DataISO, Janela } from "@compartilhado/tipos";
import { JANELA } from "../../dominio/rotulos";
import { Icone } from "../Icone";
import { diaCurto, plural } from "./formato";
import { JANELAS, type AvaliacaoDestino, type DiaAgenda, type Movel } from "./modelo";

/**
 * "Mover para…" sem arrastar (celular, teclado, ou um grupo marcado na caixinha): lista os próximos
 * dias com Manhã/Tarde. Destino impossível fica apagado com o motivo; lotado aparece como "encaixe".
 */
export function MoverPara({
  grupo,
  dias,
  avaliar,
  onEscolher,
  onFechar,
}: {
  grupo: Movel[];
  dias: DiaAgenda[];
  avaliar: (data: DataISO, janela: Janela, grupo: Movel[]) => AvaliacaoDestino;
  onEscolher: (data: DataISO, janela: Janela) => void;
  onFechar: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const titulo = grupo.length === 1 ? `Mover ${grupo[0].placa} para…` : `Mover ${plural(grupo.length, "carro", "carros")} para…`;

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button[data-destino]:not([disabled])")?.focus();
  }, []);

  const visiveis = dias.filter((d) => !d.passado && !d.fechado);

  return (
    <section
      ref={ref}
      aria-label={titulo}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onFechar();
        }
      }}
      className="bg-cartao border border-linha rounded-cartao shadow-cartao overflow-hidden"
    >
      <header className="flex items-center justify-between gap-3 pl-3.5 pr-1 h-11 border-b border-linha">
        <h3 className="text-[14px] font-semibold truncate">{titulo}</h3>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar “Mover para”"
          className="inline-grid place-items-center w-10 h-10 rounded-controle text-tinta-suave hover:text-tinta hover:bg-cinza-100"
        >
          <Icone nome="fechar" tamanho={18} />
        </button>
      </header>
      {visiveis.length === 0 ? (
        <p className="p-3.5 text-[13px] text-tinta-suave">Nenhum dia aberto nas próximas semanas.</p>
      ) : (
        <ul className="max-h-[340px] overflow-y-auto divide-y divide-linha">
          {visiveis.map((d) => (
            <li key={d.data} className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-3.5 py-1.5 ${d.hoje ? "bg-amarelo-claro/50" : ""}`}>
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold numero leading-tight">
                  {diaCurto(d.data)}
                  {d.hoje && <span className="ml-1.5 text-[12px] font-medium text-amarelo-tinta">hoje</span>}
                </span>
                <span className={`block text-[12px] numero leading-tight ${d.bloqueado ? "text-alerta" : d.restantes === 0 ? "text-atencao" : "text-tinta-suave"}`}>
                  {d.bloqueado ? "Bloqueado" : d.restantes === 0 ? "Lotado" : plural(d.restantes, "vaga", "vagas")}
                </span>
              </span>
              {JANELAS.map((j) => {
                const a = avaliar(d.data, j, grupo);
                const quando = `${diaCurto(d.data)}, ${JANELA[j].toLowerCase()}`;
                const encaixe = a.ok && a.encaixe > 0;
                return (
                  <button
                    key={j}
                    type="button"
                    data-destino
                    disabled={!a.ok}
                    title={a.motivo}
                    onClick={() => onEscolher(d.data, j)}
                    aria-label={a.ok ? `${quando}${a.motivo ? ` (${a.motivo.toLowerCase()})` : ""}` : `${quando}: ${a.motivo?.toLowerCase()}`}
                    className={`h-11 md:h-9 min-w-[76px] px-2.5 rounded-controle border text-[13px] font-semibold transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
                      encaixe ? "border-atencao/40 text-atencao bg-cartao hover:bg-atencao-claro" : "border-linha-forte bg-cartao shadow-controle hover:bg-cinza-50"
                    }`}
                  >
                    {JANELA[j]}
                  </button>
                );
              })}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

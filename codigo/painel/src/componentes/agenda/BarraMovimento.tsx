import { useEffect, useRef, useState } from "react";
import { Botao } from "../ui/Basicos";
import { Icone } from "../Icone";

/**
 * Barra flutuante da Agenda (sprint SG), presa ao pé da tela (acima da barra do celular):
 * - resultado de um movimento com "Desfazer" (some sozinha em ~8 s; pausa com o mouse ou o foco em cima);
 * - confirmação de encaixe ("Lotado: encaixar mesmo assim?") — fica até a recepção decidir.
 */
export type Barra =
  | { tipo: "aviso"; id: number; tom: "ok" | "atencao" | "alerta"; texto: string; desfazer?: () => void }
  | {
      tipo: "encaixe";
      id: number;
      texto: string;
      onEncaixar: () => void;
      soQueCabem?: { texto: string; fazer: () => void };
      onCancelar: () => void;
    };

const DURACAO = 8000;

const TOM = {
  ok: { icone: "ok", cor: "text-ok" },
  atencao: { icone: "alerta", cor: "text-atencao" },
  alerta: { icone: "alerta", cor: "text-alerta" },
} as const;

export function BarraMovimento({ barra, onFechar }: { barra: Barra | null; onFechar: () => void }) {
  const [pausa, setPausa] = useState(false);
  const fechar = useRef(onFechar);
  useEffect(() => {
    fechar.current = onFechar;
  });

  useEffect(() => {
    if (!barra || barra.tipo !== "aviso" || pausa) return;
    const t = window.setTimeout(() => fechar.current(), DURACAO);
    return () => window.clearTimeout(t);
  }, [barra, pausa]);

  if (!barra) return null;

  const tom = barra.tipo === "encaixe" ? TOM.atencao : TOM[barra.tom];
  return (
    <div className="fixed inset-x-0 z-40 flex justify-center px-3 pointer-events-none bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-6">
      <div
        role={barra.tipo === "encaixe" || barra.tom === "alerta" ? "alert" : "status"}
        onMouseEnter={() => setPausa(true)}
        onMouseLeave={() => setPausa(false)}
        onFocus={() => setPausa(true)}
        onBlur={() => setPausa(false)}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          if (barra.tipo === "encaixe") barra.onCancelar();
          else onFechar();
        }}
        className="pointer-events-auto w-full max-w-[640px] flex flex-wrap items-center gap-x-3 gap-y-2 pl-4 pr-2 py-2 min-h-14 bg-cartao text-tinta border border-linha rounded-cartao elevacao"
      >
        <Icone nome={tom.icone} tamanho={18} className={`shrink-0 ${tom.cor}`} />
        <p className="flex-1 min-w-[180px] text-[14px] font-medium leading-snug">{barra.texto}</p>
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {barra.tipo === "encaixe" ? (
            <>
              <Botao variante="contorno" tamanho="denso" onClick={barra.onCancelar}>
                Cancelar
              </Botao>
              {barra.soQueCabem && (
                <Botao variante="contorno" tamanho="denso" onClick={barra.soQueCabem.fazer}>
                  {barra.soQueCabem.texto}
                </Botao>
              )}
              <Botao variante="primario" tamanho="denso" onClick={barra.onEncaixar} autoFocus>
                Encaixar
              </Botao>
            </>
          ) : (
            <>
              {barra.desfazer && (
                <Botao variante="contorno" tamanho="denso" icone="voltar" onClick={barra.desfazer}>
                  Desfazer
                </Botao>
              )}
              <button
                type="button"
                onClick={onFechar}
                aria-label="Fechar aviso"
                className="inline-grid place-items-center w-10 h-10 md:w-9 md:h-9 rounded-controle text-tinta-suave hover:text-tinta hover:bg-cinza-100"
              >
                <Icone nome="fechar" tamanho={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, type CSSProperties, type RefObject } from "react";
import type { MarcoISO, Perfil } from "@compartilhado/tipos";
import { Contagem } from "../ui/Basicos";
import { CartaoQuadro } from "./CartaoQuadro";
import { COLUNA_PRONTOS, type ColunaQuadro } from "./quadro";

const COLUNA_MIN_PX = 204;
const COLUNA_MAX_PX = 360;
const VAO_PX = 8;

/**
 * Quadro do computador (docs/painel-design.md §5.1): uma coluna fluida por etapa com carro, que
 * divide a largura; se não couber, rolagem horizontal nativa com sombra na borda que tem mais.
 */
export function QuadroColunas({
  colunas,
  agora,
  perfis,
  selecionadoId,
  onAbrir,
  refQuadro,
}: {
  colunas: ColunaQuadro[];
  agora: MarcoISO;
  perfis: Perfil[];
  selecionadoId: string | null;
  onAbrir: (osId: string, origem: HTMLButtonElement) => void;
  refQuadro: RefObject<HTMLDivElement | null>;
}) {
  const borda = useBordasRolagem(refQuadro);
  const n = colunas.length;
  const grade: CSSProperties = {
    gridTemplateColumns: `repeat(${n}, minmax(${COLUNA_MIN_PX}px, 1fr))`,
    maxWidth: n * COLUNA_MAX_PX + (n - 1) * VAO_PX,
    columnGap: VAO_PX,
  };

  return (
    <div className="relative">
      <div
        ref={refQuadro}
        role="region"
        aria-label="Quadro de produção por etapa"
        tabIndex={0}
        className="overflow-x-auto overscroll-x-contain pb-2 outline-none focus-visible:outline-2 focus-visible:outline-amarelo-escuro focus-visible:outline-offset-4 rounded-cartao"
      >
        <div className="grid items-start" style={grade}>
          {colunas.map((c) => (
            <Coluna key={c.id} coluna={c} agora={agora} perfis={perfis} selecionadoId={selecionadoId} onAbrir={onAbrir} />
          ))}
        </div>
      </div>
      {/* sombra interna na borda com mais colunas (no macOS a barra de rolagem some) */}
      <span aria-hidden="true" className={`pointer-events-none absolute inset-y-0 left-0 w-4 transition-opacity duration-150 ${borda.esquerda ? "opacity-100" : "opacity-0"}`} style={{ boxShadow: SOMBRA_ESQ }} />
      <span aria-hidden="true" className={`pointer-events-none absolute inset-y-0 right-0 w-4 transition-opacity duration-150 ${borda.direita ? "opacity-100" : "opacity-0"}`} style={{ boxShadow: SOMBRA_DIR }} />
    </div>
  );
}

const SOMBRA_COR = "color-mix(in srgb, var(--tema-tinta) 16%, transparent)";
const SOMBRA_ESQ = `inset 14px 0 12px -12px ${SOMBRA_COR}`;
const SOMBRA_DIR = `inset -14px 0 12px -12px ${SOMBRA_COR}`;

function Coluna({
  coluna: c,
  agora,
  perfis,
  selecionadoId,
  onAbrir,
}: {
  coluna: ColunaQuadro;
  agora: MarcoISO;
  perfis: Perfil[];
  selecionadoId: string | null;
  onAbrir: (osId: string, origem: HTMLButtonElement) => void;
}) {
  const pronto = c.id === COLUNA_PRONTOS;
  const execucao = c.itens.filter((i) => i.resumo.atual?.estado === "em_execucao").length;
  const fila = c.itens.filter((i) => i.resumo.atual?.estado === "na_fila").length;
  const parados = c.itens.filter((i) => i.impedido).length;
  const partes = pronto
    ? [`${c.itens.filter((i) => i.entregaHoje).length} para hoje`]
    : [execucao && `${execucao} em execução`, fila && `${fila} na fila`, parados && `${parados} ${parados === 1 ? "parado" : "parados"}`].filter(Boolean);

  return (
    <section aria-label={`${c.nome}: ${c.itens.length}`} className="min-w-0 flex flex-col rounded-cartao bg-cinza-100 p-1">
      <header className="px-2 pt-1.5 pb-2 min-w-0">
        <h2 className="flex items-center gap-2 min-w-0 text-[14px] font-semibold leading-tight">
          {pronto && <span aria-hidden="true" className="w-2 h-2 rounded-full bg-ok shrink-0" />}
          <span className="truncate" title={c.nome}>
            {c.nome}
          </span>
          <Contagem n={c.itens.length} tom={pronto ? "ok" : "neutro"} />
        </h2>
        <p className={`mt-1 text-[12px] numero truncate ${parados ? "text-tinta-suave" : "text-tinta-fraca"}`}>{partes.join(" · ") || " "}</p>
      </header>
      <ul className="m-0 p-0 flex flex-col gap-1">
        {c.itens.map((i) => (
          <CartaoQuadro key={i.v.os.id} item={i} agora={agora} perfis={perfis} selecionado={i.v.os.id === selecionadoId} onAbrir={onAbrir} />
        ))}
      </ul>
    </section>
  );
}

/** Quais bordas do quadro têm colunas escondidas (para a sombra indicar que dá para rolar). */
function useBordasRolagem(ref: RefObject<HTMLDivElement | null>) {
  const [estado, setEstado] = useState({ esquerda: false, direita: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const esquerda = el.scrollLeft > 2;
      const direita = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      setEstado((a) => (a.esquerda === esquerda && a.direita === direita ? a : { esquerda, direita }));
    };
    medir();
    el.addEventListener("scroll", medir, { passive: true });
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    if (el.firstElementChild) obs.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", medir);
      obs.disconnect();
    };
  }, [ref]);
  return estado;
}

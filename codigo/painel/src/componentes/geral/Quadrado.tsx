import type { ReactNode } from "react";
import { SUPERFICIE } from "../ui/Basicos";
import { Placa } from "../ui/Placa";

/**
 * Quadrado do Geral (revisão SG, item 1; docs/painel-design.md §5 "Geral"): título, número grande no canto,
 * uma linha de resumo e as PRÓPRIAS placas, cada uma com uma informação curta. O quadrado inteiro abre a lista
 * completa (gaveta). Fica em `alerta` só quando é problema e o número > 0; com 0 fica cinza, "Nada aqui", e não abre.
 *
 * Quantas placas cabem depende da largura do quadrado (container query), não da tela:
 * < 18rem → 1 coluna, até 2 · 18–25rem → 2 colunas, até 4 · ≥ 25rem → 3 colunas, até 6 · ≥ 40rem (quadrado largo) → 6 colunas.
 * Quando há mais carros que espaço, a última vaga vira "+N" (N = os que não aparecem), por faixa. Na faixa estreita
 * (celular) o "+N" fica ao lado da placa, não embaixo.
 */

export type TomInfo = "alerta" | "atencao" | "ok" | "neutro";

export interface ItemQuadrado {
  chave: string;
  /** Placa do carro; sem carro (despesa, título avulso), um texto curto no lugar. */
  placa?: string;
  texto?: string;
  info?: string;
  tom?: TomInfo;
}

const LIMITES = [2, 4, 6] as const; // por faixa de largura (1, 2, 3 colunas)
const MAX = 6;

// Visibilidade por faixa [estreita, média, larga]: classes literais para o Tailwind encontrar.
const VISIVEL: Record<string, string> = {
  "111": "flex",
  "011": "hidden @[18rem]:flex",
  "001": "hidden @[25rem]:flex",
  "010": "hidden @[18rem]:flex @[25rem]:hidden",
  "100": "flex @[18rem]:hidden",
  "110": "flex @[25rem]:hidden",
  "101": "flex @[18rem]:hidden @[25rem]:flex",
  "000": "hidden",
};

const COR_INFO: Record<TomInfo, string> = {
  alerta: "text-alerta font-medium",
  atencao: "text-atencao font-medium",
  ok: "text-ok font-medium",
  neutro: "text-tinta-suave",
};

/** Quantos itens aparecem na faixa: o limite, ou um a menos quando sobra (a vaga do "+N"). */
const cabe = (total: number, limite: number) => (total > limite ? limite - 1 : limite);

export function Quadrado({
  titulo,
  total,
  resumo,
  valor,
  itens,
  problema = false,
  onAbrir,
  largo = false,
  className = "",
}: {
  titulo: string;
  total: number;
  /** Linha curta abaixo do título ("6 em serviço · 2 prontos"). */
  resumo?: ReactNode;
  /** Valor em reais já formatado (quadrados de dinheiro). */
  valor?: string;
  itens: ItemQuadrado[];
  /** O número é um problema (parados, vencido): fica em alerta quando > 0. */
  problema?: boolean;
  onAbrir: () => void;
  /** Faixa de largura total (quadrado extra, ex.: "Prontos — cobrar franquia" da recepção): no computador, tudo numa linha. */
  largo?: boolean;
  className?: string;
}) {
  const vazio = total === 0;
  const alerta = problema && !vazio;
  const mostrados = itens.slice(0, MAX);
  const caps = LIMITES.map((l) => cabe(total, l));

  return (
    <section
      aria-label={titulo}
      className={`@container relative flex flex-col min-w-0 ${largo ? "lg:flex-row lg:items-center lg:gap-8" : ""} ${SUPERFICIE} p-3.5 md:p-5 transition-colors duration-150 ${
        alerta ? "border-alerta/40" : ""
      } ${vazio ? "" : "hover:border-linha-forte hover:bg-cinza-50 has-[button:focus-visible]:border-linha-forte"} ${className}`}
    >
      <header className={`flex items-start justify-between gap-2 md:gap-3 ${largo ? "lg:contents" : ""}`}>
        <div className={`min-w-0 ${largo ? "lg:w-[260px] lg:shrink-0" : ""}`}>
          <h2 className={`text-[14px] md:text-[15px] font-semibold leading-snug ${vazio ? "text-tinta-suave" : "text-tinta"}`}>
            {vazio ? (
              titulo
            ) : (
              <button
                type="button"
                onClick={onAbrir}
                aria-haspopup="dialog"
                className="text-left after:absolute after:inset-0 after:rounded-cartao focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-amarelo-escuro focus-visible:after:outline-offset-2 cursor-pointer"
              >
                {titulo}
                <span className="sr-only">
                  : {total}. Abrir a lista.
                </span>
              </button>
            )}
          </h2>
          {resumo && !vazio && <p className="mt-0.5 text-[12px] md:text-[13px] leading-snug text-tinta-suave numero">{resumo}</p>}
        </div>
        <span
          aria-hidden="true"
          className={`shrink-0 -mt-0.5 ${largo ? "lg:order-last lg:ml-auto lg:mt-0" : ""} text-[24px] md:text-[28px] font-semibold leading-none tracking-[-0.02em] numero ${
            alerta ? "text-alerta" : vazio ? "text-tinta-fraca" : "text-tinta"
          }`}
        >
          {total}
        </span>
      </header>

      {vazio ? (
        <p className="mt-3 md:mt-4 text-[13px] text-tinta-fraca">Nada aqui</p>
      ) : (
        <>
          {valor && <p className={`mt-2 md:mt-3 ${largo ? "lg:mt-0 lg:shrink-0" : ""} text-[16px] md:text-[18px] font-semibold leading-none numero ${alerta ? "text-alerta" : "text-tinta"}`}>{valor}</p>}
          <ul className={`mt-3 md:mt-4 ${largo ? "lg:mt-0 lg:flex-1" : ""} flex flex-wrap items-start gap-x-1.5 gap-y-2.5 @[18rem]:grid @[18rem]:grid-cols-2 @[18rem]:gap-x-3 @[25rem]:grid-cols-3 @[40rem]:grid-cols-6 md:gap-y-3`}>
            {mostrados.map((item, i) => (
              <li key={item.chave} className={`${VISIVEL[caps.map((c) => (i < c ? "1" : "0")).join("")]} flex-col gap-1 min-w-0 w-24 @[18rem]:w-auto`}>
                {item.placa ? (
                  <Placa placa={item.placa} />
                ) : (
                  <span className="block h-[27px] leading-[27px] max-w-full px-2 rounded-controle bg-cinza-100 text-[12px] font-semibold truncate">
                    {item.texto}
                  </span>
                )}
                {item.info && <span className={`text-[12px] leading-tight truncate numero ${COR_INFO[item.tom ?? "neutro"]}`}>{item.info}</span>}
              </li>
            ))}
            {LIMITES.map((limite, faixa) => {
              if (total <= limite) return null;
              const marca = LIMITES.map((_, f) => (f === faixa ? "1" : "0")).join("");
              return (
                <li key={`mais-${faixa}`} aria-hidden="true" className={`${VISIVEL[marca]} flex-col`}>
                  <span className="inline-flex items-center justify-center h-[27px] w-10 @[18rem]:w-12 rounded-[3px] bg-cinza-100 text-[13px] font-semibold text-tinta-suave numero">
                    +{total - caps[faixa]}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

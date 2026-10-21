import { Link } from "react-router-dom";
import type { ItemAfazer } from "../../dominio/contagens";
import { PAPEL } from "../../dominio/rotulos";
import { Icone } from "../Icone";
import { Botao, Contagem, SUPERFICIE } from "../ui/Basicos";
import { Placa } from "../ui/Placa";
import { partirAfazer, rotuloDestino } from "./listas";

/**
 * "Para fazer hoje" do Geral (revisão SG, item 1): lista enxuta abaixo dos quadrados — placa · o que fazer ·
 * há quanto tempo · quem faz · botão. Até 5 linhas; "Ver todos (N)" abre a gaveta com a lista inteira.
 */
const MAX = 5;

export function ParaFazerHoje({ itens, total, onVerTodos }: { itens: ItemAfazer[]; total: number; onVerTodos: () => void }) {
  return (
    <section aria-labelledby="geral-afazer" className="mt-8 md:mt-10">
      <header className="flex items-center justify-between gap-3 mb-3">
        <h2 id="geral-afazer" className="flex items-center gap-2 text-[16px] font-semibold">
          Para fazer hoje
          <Contagem n={total} />
        </h2>
        {total > MAX && (
          <Botao variante="fantasma" tamanho="denso" onClick={onVerTodos} aria-haspopup="dialog" className="-mr-3">
            Ver todos ({total})
          </Botao>
        )}
      </header>
      {total === 0 ? (
        <p className={`${SUPERFICIE} flex items-center gap-2.5 px-4 py-4 text-[14px] text-tinta-suave`}>
          <span aria-hidden="true" className="inline-block w-2 h-2 rounded-full bg-ok shrink-0" />
          Nada pendente para hoje.
        </p>
      ) : (
        <ul className={`${SUPERFICIE} overflow-hidden divide-y divide-linha`}>
          {itens.slice(0, MAX).map((i) => {
            const [oQue, quando] = partirAfazer(i);
            return (
              <li key={i.chave}>
                <Link
                  to={i.para}
                  className="group grid grid-cols-[96px_minmax(0,1fr)_auto] md:grid-cols-[96px_minmax(0,1fr)_96px_104px] items-center gap-x-3 md:gap-x-4 px-4 py-2.5 min-h-14 no-underline text-tinta hover:bg-cinza-50 transition-colors duration-150"
                >
                  <Placa placa={i.placa} />
                  <span className="min-w-0">
                    <span className="block text-[14px] leading-snug line-clamp-2 md:truncate">
                      <span className="font-medium">{oQue}</span>
                      {quando && <span className="hidden md:inline text-tinta-suave numero"> · {quando}</span>}
                    </span>
                    <span className="md:hidden block mt-0.5 text-[12px] text-tinta-suave numero">
                      {[quando, PAPEL[i.quem]].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="hidden md:block text-[13px] text-tinta-suave truncate">{PAPEL[i.quem]}</span>
                  <span className="inline-flex items-center justify-center gap-1 h-9 md:h-8 md:w-full px-2.5 rounded-controle border border-linha-forte bg-cartao shadow-controle text-[13px] font-semibold group-hover:border-tinta-fraca transition-colors duration-150">
                    <span className="hidden sm:inline">{rotuloDestino(i.para)}</span>
                    <Icone nome="seta" tamanho={14} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

import { useEffect, useId, useRef, type FormEvent, type ReactNode, type RefObject } from "react";
import { Icone } from "../Icone";
import { Botao } from "./Basicos";
import { Aviso } from "./Campos";

/**
 * Gaveta (painel lateral) — versão única do painel (docs/painel-design.md §3 "Gaveta").
 * `<dialog>` modal nativo: foco preso, Esc fecha, fundo `preto/25`, clique fora fecha.
 * Desktop: à direita, altura total, 480 px (`larga` = 760 px, para fluxos em passos). Celular: tela cheia.
 * Cabeçalho branco (título 16/600, descrição 13, fechar 36/44 px) · corpo rolável · rodapé fixo.
 * Rodapé padrão: erro + "Cancelar" (fantasma) + ação primária com verbo (`acao`); ou `rodape` livre.
 * Monte a gaveta só quando aberta ({aberta && <FormX/>}): o estado do formulário nasce limpo.
 */
export function Gaveta({
  titulo,
  descricao,
  onFechar,
  onEnviar,
  acao,
  enviando = false,
  erro,
  rodape,
  larga = false,
  antesDoTitulo,
  cabecalhoExtra,
  fundoCorpo = "cartao",
  corpoClassName = "flex flex-col gap-4",
  refCorpo,
  rotuloFechar = "Fechar",
  children,
}: {
  titulo: string;
  descricao?: ReactNode;
  onFechar: () => void;
  /** Com `onEnviar` o conteúdo vira um <form> (Enter envia; a gaveta já chama preventDefault). */
  onEnviar?: (e: FormEvent) => void;
  /** Texto do botão primário do rodapé padrão (verbo): "Registrar entrada". */
  acao?: string;
  enviando?: boolean;
  erro?: string;
  /** Rodapé próprio (substitui o padrão). */
  rodape?: ReactNode;
  larga?: boolean;
  /** Elemento à esquerda do título (ex.: a Placa do carro). */
  antesDoTitulo?: ReactNode;
  /** Linha abaixo do título, dentro do cabeçalho (ex.: passos). */
  cabecalhoExtra?: ReactNode;
  /** `papel` para corpos com cartões dentro (fluxo em passos). */
  fundoCorpo?: "cartao" | "papel";
  corpoClassName?: string;
  refCorpo?: RefObject<HTMLDivElement | null>;
  rotuloFechar?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const idDescricao = useId();
  const fechar = useRef(onFechar);
  useEffect(() => {
    fechar.current = onFechar;
  });

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const anterior = document.activeElement as HTMLElement | null;
    if (!d.open) d.showModal?.();
    // o primeiro campo recebe o foco (o botão Fechar vem antes no DOM)
    const primeiro =
      d.querySelector<HTMLElement>("[data-foco-inicial]") ??
      d.querySelector<HTMLElement>("input:not([type=hidden]):not([type=radio]):not([type=checkbox]), select, textarea");
    primeiro?.focus();
    const raiz = document.documentElement;
    const antes = raiz.style.overflow;
    raiz.style.overflow = "hidden";
    return () => {
      raiz.style.overflow = antes;
      if (d.open) d.close();
      anterior?.focus?.();
    };
  }, []);

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!enviando) onEnviar?.(e);
  }

  const cabecalho = (
    <header className="shrink-0 bg-cartao border-b border-linha">
      <div className="flex items-start gap-3 pl-5 pr-2.5 pt-4 pb-3.5">
        {antesDoTitulo && <div className="shrink-0">{antesDoTitulo}</div>}
        <div className="min-w-0 flex-1 pt-1">
          <h2 id={idTitulo} className="text-[16px] font-semibold leading-tight tracking-[-0.01em] text-tinta">
            {titulo}
          </h2>
          {descricao && (
            <p id={idDescricao} className="mt-1 text-[13px] leading-snug text-tinta-suave">
              {descricao}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => fechar.current()}
          aria-label={rotuloFechar}
          title={`${rotuloFechar} (Esc)`}
          className="shrink-0 inline-grid place-items-center w-11 h-11 md:w-9 md:h-9 rounded-controle text-tinta-suave hover:text-tinta hover:bg-cinza-100 transition-colors duration-150"
        >
          <Icone nome="fechar" tamanho={18} />
        </button>
      </div>
      {cabecalhoExtra}
    </header>
  );

  const corpo = (
    <div ref={refCorpo} className={`flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-5 ${fundoCorpo === "papel" ? "bg-papel" : "bg-cartao"} ${corpoClassName}`}>
      {children}
    </div>
  );

  const pe = (
    <footer className="shrink-0 bg-cartao border-t border-linha px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col gap-2">
      {rodape ?? (
        <>
          {erro && <Aviso tom="alerta">{erro}</Aviso>}
          <div className="flex items-center justify-end gap-2">
            <Botao variante="fantasma" onClick={() => fechar.current()} className="max-md:flex-1">
              Cancelar
            </Botao>
            {acao && (
              <Botao type="submit" variante="primario" disabled={enviando} className="max-md:flex-[2]">
                {enviando ? "Salvando…" : acao}
              </Botao>
            )}
          </div>
        </>
      )}
    </footer>
  );

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      aria-describedby={descricao ? idDescricao : undefined}
      onCancel={(e) => {
        e.preventDefault();
        fechar.current();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) fechar.current();
      }}
      className={`fixed inset-y-0 right-0 left-auto m-0 p-0 h-dvh max-h-dvh w-full max-w-full ${larga ? "md:w-[760px]" : "md:w-[480px]"} border-0 md:border-l md:border-linha bg-cartao text-tinta elevacao backdrop:bg-preto/25 overflow-hidden`}
    >
      {onEnviar ? (
        <form onSubmit={enviar} noValidate className="flex flex-col h-full">
          {cabecalho}
          {corpo}
          {pe}
        </form>
      ) : (
        <div className="flex flex-col h-full">
          {cabecalho}
          {corpo}
          {pe}
        </div>
      )}
    </dialog>
  );
}

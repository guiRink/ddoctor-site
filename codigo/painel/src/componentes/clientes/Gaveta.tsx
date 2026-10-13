import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { Icone } from "../Icone";

/**
 * Painel lateral (drawer) para cadastro e edição: 480 px à direita no desktop, tela cheia no celular.
 * Diálogo modal: Esc fecha, o foco vai para o primeiro campo e volta para quem abriu; Tab fica dentro.
 * Superfície branca com `elevacao` (só o que flutua tem sombra — docs/painel-design.md §2).
 */
export function Gaveta({
  titulo,
  descricao,
  onFechar,
  onEnviar,
  rodape,
  children,
}: {
  titulo: string;
  descricao?: ReactNode;
  onFechar: () => void;
  /** O corpo vira um <form>; o botão de enviar do rodapé usa type="submit". */
  onEnviar: (e: FormEvent) => void;
  rodape: ReactNode;
  children: ReactNode;
}) {
  const painel = useRef<HTMLFormElement>(null);
  const fechar = useRef(onFechar);
  useEffect(() => {
    fechar.current = onFechar;
  });

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const corpo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const primeiro =
      painel.current?.querySelector<HTMLElement>("[data-foco-inicial]") ??
      painel.current?.querySelector<HTMLElement>("input:not([type=hidden]):not([type=radio]), select, textarea");
    primeiro?.focus();

    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        fechar.current();
        return;
      }
      if (e.key !== "Tab" || !painel.current) return;
      const focaveis = [...painel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])")].filter(
        (el) => el.offsetParent !== null || el.getAttribute("type") === "radio",
      );
      if (focaveis.length === 0) return;
      const ini = focaveis[0];
      const fim = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === ini) {
        e.preventDefault();
        fim.focus();
      } else if (!e.shiftKey && document.activeElement === fim) {
        e.preventDefault();
        ini.focus();
      }
    }
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = corpo;
      anterior?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40" role="presentation">
      <button type="button" tabIndex={-1} aria-label="Fechar o painel" className="absolute inset-0 bg-preto/25 cursor-default" onClick={onFechar} />
      <form
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gaveta-titulo"
        onSubmit={onEnviar}
        noValidate
        className="absolute inset-0 md:inset-y-0 md:left-auto md:right-0 md:w-[480px] flex flex-col bg-cartao md:border-l md:border-linha elevacao"
      >
        <header className="shrink-0 flex items-start justify-between gap-3 px-5 pt-4 pb-3.5 border-b border-linha">
          <div className="min-w-0 pt-1">
            <h2 id="gaveta-titulo" className="text-[16px] font-semibold tracking-[-0.01em] text-tinta">
              {titulo}
            </h2>
            {descricao && <p className="mt-0.5 text-[13px] text-tinta-suave">{descricao}</p>}
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            title="Fechar (Esc)"
            className="shrink-0 -mr-2 inline-grid place-items-center w-11 h-11 md:w-9 md:h-9 rounded-controle text-tinta-suave hover:text-tinta hover:bg-cinza-100 transition-colors duration-150"
          >
            <Icone nome="fechar" tamanho={18} />
          </button>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
        <footer className="shrink-0 flex items-center justify-end gap-2 px-5 py-3 border-t border-linha bg-cartao pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {rodape}
        </footer>
      </form>
    </div>
  );
}

import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { Icone } from "../Icone";
import { Botao } from "../ui/Basicos";
import { Retorno } from "../gestao/Comuns";

/**
 * Painel lateral (gaveta) com formulário, em <dialog> modal nativo: foco preso, Esc fecha, fundo escurecido.
 * Desktop: 480 px à direita, altura total. Celular: tela cheia. Rodapé fixo com Cancelar + ação primária.
 * Monte a gaveta só quando estiver aberta ({aberta && <FormX/>}): o estado do formulário nasce limpo.
 * Candidato a ir para ui/ (usado por Estoque e Financeiro).
 */
export function Gaveta({
  titulo,
  descricao,
  onFechar,
  onEnviar,
  acao,
  enviando = false,
  erro,
  children,
}: {
  titulo: string;
  descricao?: ReactNode;
  onFechar: () => void;
  onEnviar: () => void;
  /** Texto do botão primário (verbo): "Registrar entrada". */
  acao: string;
  enviando?: boolean;
  erro?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const idDescricao = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal?.();
    // primeiro campo recebe o foco (o botão Fechar fica antes no DOM)
    d.querySelector<HTMLElement>("[data-foco-inicial], input:not([type=hidden]), select, textarea")?.focus();
    const raiz = document.documentElement;
    const antes = raiz.style.overflow;
    raiz.style.overflow = "hidden";
    return () => {
      raiz.style.overflow = antes;
      if (d.open) d.close();
    };
  }, []);

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!enviando) onEnviar();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      aria-describedby={descricao ? idDescricao : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onFechar();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
      className="fixed inset-y-0 right-0 left-auto m-0 p-0 h-dvh max-h-dvh w-full md:w-[480px] max-w-full border-0 md:border-l md:border-linha bg-cartao text-tinta elevacao backdrop:bg-preto/25"
    >
      <form onSubmit={enviar} noValidate className="flex flex-col h-full">
        <header className="flex items-start justify-between gap-3 pl-5 pr-2 pt-4 pb-4 border-b border-linha shrink-0">
          <div className="min-w-0 pt-1">
            <h2 id={idTitulo} className="text-[17px] font-semibold leading-tight">
              {titulo}
            </h2>
            {descricao && (
              <p id={idDescricao} className="mt-1 text-[13px] text-tinta-suave leading-snug">
                {descricao}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="inline-grid place-items-center shrink-0 w-11 h-11 md:w-9 md:h-9 rounded-controle text-tinta-suave hover:text-tinta hover:bg-cinza-100 transition-colors duration-150"
          >
            <Icone nome="fechar" tamanho={18} />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 flex flex-col gap-4">{children}</div>

        <footer className="shrink-0 border-t border-linha px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col gap-2">
          <Retorno erro={erro} />
          <div className="flex items-center justify-end gap-2">
            <Botao variante="fantasma" onClick={onFechar} className="max-md:flex-1">
              Cancelar
            </Botao>
            <Botao type="submit" variante="primario" disabled={enviando} className="max-md:flex-[2]">
              {enviando ? "Salvando…" : acao}
            </Botao>
          </div>
        </footer>
      </form>
    </dialog>
  );
}

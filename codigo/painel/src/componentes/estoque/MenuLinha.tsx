import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

export interface AcaoMenu {
  chave: string;
  texto: string;
  onClick: () => void;
  desabilitado?: boolean;
}

/**
 * Ações da linha num menu "⋯" (sprint SG: Entrada, Retirada e Editar não se repetem em cada linha).
 * O menu é `fixed` (a tabela rola na horizontal e cortaria um menu `absolute`); abre para baixo ou, sem espaço,
 * para cima. Teclado: Enter/Espaço/seta abre, setas e Home/End movem, Esc fecha e devolve o foco.
 * Botão 32 px no computador e 44 px no celular, com nome acessível ("Ações de <material>").
 */
export function MenuLinha({ rotulo, acoes }: { rotulo: string; acoes: AcaoMenu[] }) {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const itens = useRef<(HTMLButtonElement | null)[]>([]);
  const idMenu = useId();
  const ativas = acoes.filter((a) => !a.desabilitado);

  useLayoutEffect(() => {
    if (!aberto || !botao.current) return;
    const r = botao.current.getBoundingClientRect();
    const altura = menu.current?.offsetHeight ?? 44 * acoes.length + 8;
    const cabeEmbaixo = r.bottom + 4 + altura <= window.innerHeight - 8;
    setPos({ top: cabeEmbaixo ? r.bottom + 4 : Math.max(8, r.top - 4 - altura), right: Math.max(8, window.innerWidth - r.right) });
  }, [aberto, acoes.length]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !botao.current?.contains(e.target as Node)) setAberto(false);
    };
    const fechar = () => setAberto(false);
    document.addEventListener("pointerdown", fora);
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    return () => {
      document.removeEventListener("pointerdown", fora);
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
    };
  }, [aberto]);

  useEffect(() => {
    if (aberto && pos) itens.current.find(Boolean)?.focus();
  }, [aberto, pos]);

  const fechar = (devolverFoco = true) => {
    setAberto(false);
    setPos(null);
    if (devolverFoco) botao.current?.focus();
  };

  function tecla(e: KeyboardEvent<HTMLDivElement>) {
    const lista = itens.current.filter(Boolean) as HTMLButtonElement[];
    const i = lista.indexOf(document.activeElement as HTMLButtonElement);
    const ir = (n: number) => {
      e.preventDefault();
      lista[(n + lista.length) % lista.length]?.focus();
    };
    if (e.key === "Escape") {
      e.preventDefault();
      fechar();
    } else if (e.key === "ArrowDown") ir(i + 1);
    else if (e.key === "ArrowUp") ir(i - 1);
    else if (e.key === "Home") ir(0);
    else if (e.key === "End") ir(lista.length - 1);
    else if (e.key === "Tab") fechar(false);
  }

  return (
    <>
      <button
        ref={botao}
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idMenu : undefined}
        aria-label={rotulo}
        title="Ações"
        disabled={ativas.length === 0}
        onClick={() => (aberto ? fechar(false) : setAberto(true))}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setAberto(true);
          }
        }}
        className={`inline-grid place-items-center w-11 h-11 md:w-8 md:h-8 rounded-controle transition-colors duration-150 disabled:opacity-40 ${
          aberto ? "bg-cinza-100 text-tinta" : "text-tinta-suave hover:text-tinta hover:bg-cinza-100"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {aberto && (
        <div
          ref={menu}
          id={idMenu}
          role="menu"
          aria-label={rotulo}
          onKeyDown={tecla}
          style={pos ? { top: pos.top, right: pos.right } : { visibility: "hidden", top: 0, right: 0 }}
          className="fixed z-50 min-w-44 p-1 rounded-cartao bg-cartao border border-linha elevacao text-left"
        >
          {acoes.map((a, i) => (
            <button
              key={a.chave}
              ref={(el) => {
                itens.current[i] = a.desabilitado ? null : el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={a.desabilitado}
              onClick={() => {
                fechar();
                a.onClick();
              }}
              className="w-full flex items-center h-11 md:h-9 px-2.5 rounded-controle text-[14px] font-medium text-tinta text-left transition-colors duration-150 hover:bg-cinza-100 focus-visible:bg-cinza-100 disabled:text-tinta-fraca disabled:pointer-events-none"
            >
              {a.texto}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

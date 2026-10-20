import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Icone, type NomeIcone } from "../Icone";
import { Segmentado } from "./Campos";
import { useTema, type Tema } from "./tema";

const OPCOES: { valor: Tema; texto: string; icone: NomeIcone }[] = [
  { valor: "claro", texto: "Claro", icone: "sol" },
  { valor: "escuro", texto: "Escuro", icone: "lua" },
  { valor: "automatico", texto: "Automático", icone: "automatico" },
];

/**
 * Escolha do tema (Claro / Escuro / Automático), salva no aparelho.
 * - `menu` (barra lateral): botão só ícone 28 px ao lado do Sair; abre um menu para cima com as três opções.
 *   Teclado: Enter/Espaço/seta abre; setas e Home/End movem; Esc fecha e devolve o foco.
 * - `segmentos` (menu "Mais" do celular): controle segmentado de largura total com rótulo "Tema".
 */
export function SeletorTema({ variante = "menu" }: { variante?: "menu" | "segmentos" }) {
  const { tema, escolher } = useTema();
  if (variante === "segmentos") {
    return (
      <Segmentado
        nome="tema"
        legenda="Tema"
        larguraTotal
        valor={tema}
        onMudar={escolher}
        opcoes={OPCOES.map((o) => ({
          valor: o.valor,
          texto: (
            <>
              <Icone nome={o.icone} tamanho={16} className="shrink-0" />
              {o.texto}
            </>
          ),
        }))}
      />
    );
  }
  return <MenuTema tema={tema} escolher={escolher} />;
}

function MenuTema({ tema, escolher }: { tema: Tema; escolher: (t: Tema) => void }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const itens = useRef<(HTMLButtonElement | null)[]>([]);
  const idMenu = useId();
  const atual = OPCOES.find((o) => o.valor === tema) ?? OPCOES[2];

  // fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  // ao abrir, o foco vai para a opção atual
  useEffect(() => {
    if (aberto) itens.current[OPCOES.findIndex((o) => o.valor === tema)]?.focus();
  }, [aberto, tema]);

  const fechar = (devolverFoco = true) => {
    setAberto(false);
    if (devolverFoco) botao.current?.focus();
  };

  function teclaNoMenu(e: KeyboardEvent<HTMLDivElement>) {
    const lista = itens.current.filter(Boolean) as HTMLButtonElement[];
    const i = lista.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      fechar();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      lista[(i + 1) % lista.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      lista[(i - 1 + lista.length) % lista.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      lista[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      lista[lista.length - 1]?.focus();
    } else if (e.key === "Tab") {
      fechar(false);
    }
  }

  return (
    <div ref={raiz} className="relative shrink-0">
      <button
        ref={botao}
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idMenu : undefined}
        aria-label={`Tema: ${atual.texto}. Trocar tema`}
        title={`Tema: ${atual.texto}`}
        onClick={() => setAberto((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setAberto(true);
          }
        }}
        className={`inline-grid place-items-center w-7 h-7 rounded-controle transition-colors duration-150 ${
          aberto ? "bg-cinza-100 text-tinta" : "text-tinta-fraca hover:text-tinta hover:bg-cinza-100"
        }`}
      >
        <Icone nome={atual.icone} tamanho={16} />
      </button>
      {aberto && (
        <div
          id={idMenu}
          role="menu"
          aria-label="Tema"
          onKeyDown={teclaNoMenu}
          className="absolute bottom-full right-0 mb-2 z-40 w-44 p-1 rounded-cartao bg-cartao border border-linha elevacao"
        >
          {/* título só visual: dentro de role="menu" só cabem itens; o nome do menu vem do aria-label */}
          <div aria-hidden="true" className="px-2.5 h-7 flex items-center text-[12px] font-medium text-tinta-fraca">
            Tema
          </div>
          {OPCOES.map((o, i) => {
            const marcado = o.valor === tema;
            return (
              <button
                key={o.valor}
                ref={(el) => {
                  itens.current[i] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={marcado}
                tabIndex={-1}
                onClick={() => {
                  escolher(o.valor);
                  fechar();
                }}
                className={`w-full flex items-center gap-2.5 h-9 px-2.5 rounded-controle text-[14px] text-left transition-colors duration-150 hover:bg-cinza-100 focus-visible:bg-cinza-100 ${
                  marcado ? "text-tinta font-semibold" : "text-tinta-suave font-medium"
                }`}
              >
                <Icone nome={o.icone} tamanho={16} className={marcado ? "text-tinta" : "text-tinta-fraca"} />
                <span className="flex-1">{o.texto}</span>
                {marcado && <Icone nome="ok" tamanho={14} traco={2} className="text-tinta" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

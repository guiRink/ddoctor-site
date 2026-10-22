import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import type { Perfil } from "@compartilhado/tipos";
import { GRUPOS_MENU, MENU, PAPEL } from "../dominio/rotulos";
import { modulosDoMenu, podeEditar, podeVer, telaInicial } from "../dominio/permissoes";
import { useSessao } from "../dados/sessao";
import { Icone } from "./Icone";
import { iniciais } from "./ui/Basicos";
import { MarcaD } from "./ui/Marca";
import { SeletorTema } from "./ui/SeletorTema";

/**
 * Casca do painel: barra lateral (desktop), barra inferior (celular) e topo com a busca.
 * Revisão SH (pedido do dono): navegação amarela (`navegacao`) com texto preto; topo preto (`casca`) — o bloco
 * da marca no canto superior esquerdo e a barra da busca formam uma faixa preta contínua. Igual nos dois temas.
 * O menu muda por papel (modulosDoMenu); "Ver como" (demonstração) mora no menu do usuário — rodapé da barra
 * lateral no computador, "Mais" no celular.
 */
export function Layout() {
  const { perfil, perfis, trocarPerfil, podeVerComo, sair, saindo } = useSessao();
  const navegar = useNavigate();
  const [busca, setBusca] = useState("");
  const local = useLocation();
  // o menu "Mais" fecha sozinho ao trocar de tela: guarda a rota em que foi aberto
  const [maisAbertoEm, setMaisAbertoEm] = useState<string | null>(null);
  const maisAberto = maisAbertoEm === local.pathname;
  const setMaisAberto = (v: boolean | ((atual: boolean) => boolean)) =>
    setMaisAbertoEm((typeof v === "function" ? v(maisAberto) : v) ? local.pathname : null);
  const inicio = telaInicial(perfil.papel);
  // busca leva à lista de atendimentos: só para quem pode abrir Orçamentos
  const podeBuscar = podeVer(perfil.papel, "orcamentos");

  const itens = modulosDoMenu(perfil.papel).flatMap((modulo) => {
    const item = MENU.find((m) => m.modulo === modulo);
    return item ? [{ ...item, nome: item.nomePara?.[perfil.papel] ?? item.nome }] : [];
  });
  // celular: 4 atalhos + "Mais" (lista completa, tema, Ver como e Sair)
  const atalhos = itens.slice(0, 4);
  const grupos = GRUPOS_MENU;
  const verComo = (id: string) => {
    trocarPerfil(id);
    navegar("/");
  };
  const podeCriar = podeEditar(perfil.papel, "orcamentos");

  function buscar(e: FormEvent) {
    e.preventDefault();
    const termo = busca.trim();
    if (!termo) return;
    navegar(`/orcamentos?q=${encodeURIComponent(termo)}`);
  }

  return (
    <div className="min-h-svh md:grid md:grid-cols-[232px_minmax(0,1fr)]">
      {/* ---------------- barra lateral (desktop): amarela; o bloco da marca, preto, continua o topo */}
      <aside data-navegacao className="hidden md:flex md:flex-col bg-navegacao text-preto md:sticky md:top-0 md:h-svh min-w-0">
        <Link to={inicio} data-casca className="flex items-center gap-2.5 px-4 h-14 shrink-0 no-underline bg-casca text-casca-tinta shadow-[0_1px_0_var(--color-casca-borda)]">
          <MarcaD tamanho={28} />
          <span className="leading-none min-w-0">
            <span className="block font-semibold text-[15px] tracking-[-0.01em]">D doctor</span>
            <span className="block mt-1 text-[12px] text-casca-fraca">Painel da oficina</span>
          </span>
        </Link>
        <nav aria-label="Seções do painel" className="flex-1 overflow-y-auto px-3 pt-2 pb-3">
          {grupos.map((g) => {
            const doGrupo = itens.filter((i) => i.grupo === g.id);
            if (doGrupo.length === 0) return null;
            return (
              <div key={g.id} className="mt-3 first:mt-1">
                <p className="px-2.5 h-7 flex items-center text-[12px] font-semibold text-preto/70">{g.nome}</p>
                <div className="flex flex-col gap-px">
                  {doGrupo.map((item) => (
                    <NavLink
                      key={item.rota}
                      to={item.rota}
                      end={item.rota === "/producao"}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 h-9 px-2.5 rounded-controle text-[14px] no-underline transition-colors duration-150 ${
                          isActive ? "bg-preto text-amarelo font-semibold" : "text-preto font-medium hover:bg-preto/8"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icone nome={item.icone} className={`shrink-0 ${isActive ? "text-amarelo" : "text-preto/75"}`} traco={isActive ? 2 : 1.75} />
                          <span className="truncate">{item.nome}</span>
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="shrink-0 border-t border-preto/15 p-3">
          <div className="flex items-center gap-1">
            {/* "Ver como" só na demonstração; no banco real cada pessoa entra com o próprio login */}
            <MenuUsuario perfil={perfil} perfis={podeVerComo ? perfis : []} onVerComo={verComo} />
            <div className="flex items-center gap-0.5 shrink-0">
              <SeletorTema sobreNavegacao />
              <button
                type="button"
                onClick={sair}
                disabled={saindo}
                title="Sair"
                aria-label="Sair"
                className="inline-grid place-items-center w-7 h-7 rounded-controle text-preto/75 hover:text-preto hover:bg-preto/8 transition-colors duration-150"
              >
                <Icone nome="sair" tamanho={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ---------------- conteúdo */}
      <div className="min-w-0 flex flex-col min-h-svh">
        {/* fio inferior: invisível no claro (o preto já separa do fundo claro); `linha-forte` no escuro, onde o topo #111 se perde no fundo #0F0F10 */}
        <header className="sticky top-0 z-20 bg-casca text-casca-tinta shadow-[0_1px_0_var(--color-casca-borda)]">
          <div className="flex items-center gap-3 h-14 px-4 md:px-8 max-w-[1440px] mx-auto w-full">
            <Link to={inicio} className="md:hidden shrink-0 flex items-center gap-2.5 no-underline text-casca-tinta" aria-label="D doctor — início">
              <MarcaD tamanho={28} />
              {/* sem busca (produção) o topo tem espaço: entra o nome, como no bloco da marca do computador */}
              {!podeBuscar && <span className="font-semibold text-[15px] tracking-[-0.01em]">D doctor</span>}
            </Link>
            {!podeBuscar && <span className="flex-1" />}
            {podeBuscar && (
              <form onSubmit={buscar} role="search" className="flex-1 min-w-0 max-w-md">
                <label htmlFor="busca" className="sr-only">
                  Buscar por placa, protocolo ou cliente
                </label>
                <div className="flex items-center h-10 md:h-9 rounded-controle bg-casca-campo border border-casca-linha hover:border-casca-fraca focus-within:border-amarelo focus-within:ring-3 focus-within:ring-amarelo/30 transition-colors duration-150">
                  <span className="pl-3 text-casca-fraca">
                    <Icone nome="busca" tamanho={16} />
                  </span>
                  <input
                    id="busca"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar placa, protocolo ou cliente"
                    className="flex-1 min-w-0 h-full px-2.5 bg-transparent outline-none text-[14px] text-casca-tinta placeholder:text-casca-fraca"
                    autoComplete="off"
                  />
                </div>
              </form>
            )}
            <span className="hidden md:block flex-1" />
            {podeCriar && (
              <Link
                to="/orcamentos/novo"
                aria-label="Novo atendimento"
                className="inline-flex items-center justify-center gap-1.5 h-10 w-10 sm:w-auto md:h-9 sm:px-3.5 shrink-0 rounded-controle bg-amarelo text-preto text-[14px] font-semibold no-underline hover:bg-amarelo-escuro transition-colors duration-150"
              >
                <Icone nome="mais" tamanho={16} traco={2} />
                <span className="hidden sm:inline">Novo atendimento</span>
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 md:px-8 py-6 md:py-8 pb-28 md:pb-10">
          <Outlet />
        </main>

        {/* ---------------- barra inferior (celular): amarela, ícone + rótulo pretos; ativo = ícone numa pílula preta */}
        <nav
          aria-label="Seções do painel"
          data-navegacao
          className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-navegacao text-preto grid pb-[env(safe-area-inset-bottom)]"
          style={{ gridTemplateColumns: `repeat(${atalhos.length + 1}, minmax(0, 1fr))` }}
        >
          {atalhos.map((item) => (
            <NavLink
              key={item.rota}
              to={item.rota}
              end={item.rota === "/producao"}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 h-16 px-0.5 text-[11px] leading-[1.1] text-preto no-underline ${
                  isActive ? "font-bold" : "font-medium"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden="true"
                    className={`inline-grid place-items-center h-7 w-12 rounded-full transition-colors duration-150 ${isActive ? "bg-preto text-amarelo" : "text-preto/80"}`}
                  >
                    <Icone nome={item.icone} tamanho={20} className="shrink-0" traco={isActive ? 2 : 1.75} />
                  </span>
                  <span className="max-w-full text-center line-clamp-2 break-words">{item.nome}</span>
                </>
              )}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMaisAberto((v) => !v)}
            aria-expanded={maisAberto}
            aria-controls="menu-mais"
            className={`flex flex-col items-center justify-center gap-1 h-16 px-0.5 text-[11px] leading-[1.1] text-preto ${maisAberto ? "font-bold" : "font-medium"}`}
          >
            <span
              aria-hidden="true"
              className={`inline-grid place-items-center h-7 w-12 rounded-full transition-colors duration-150 ${maisAberto ? "bg-preto text-amarelo" : "text-preto/80"}`}
            >
              <Icone nome={maisAberto ? "fechar" : "ajustes"} tamanho={20} className="shrink-0" traco={maisAberto ? 2 : 1.75} />
            </span>
            <span>Mais</span>
          </button>
        </nav>

        {/* ---------------- menu "Mais" (celular) */}
        {maisAberto && (
          <div className="md:hidden fixed inset-0 z-20" role="presentation">
            <button type="button" aria-label="Fechar menu" className="absolute inset-0 bg-preto/30" onClick={() => setMaisAberto(false)} />
            <div
              id="menu-mais"
              role="dialog"
              aria-label="Todas as seções"
              className="absolute inset-x-0 bottom-16 mb-[env(safe-area-inset-bottom)] max-h-[75svh] overflow-y-auto bg-cartao rounded-t-xl border-t border-linha elevacao"
            >
              <nav aria-label="Todas as seções" className="p-2">
                {itens.map((item) => (
                  <NavLink
                    key={item.rota}
                    to={item.rota}
                    end={item.rota === "/producao"}
                    className={({ isActive }) =>
                      `flex items-center gap-3 h-12 px-3 rounded-controle text-[15px] no-underline ${
                        isActive ? "bg-amarelo text-preto font-semibold" : "text-tinta font-medium hover:bg-cinza-100"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icone nome={item.icone} className={isActive ? "text-preto" : "text-tinta-suave"} traco={isActive ? 2 : 1.75} />
                        {item.nome}
                      </>
                    )}
                  </NavLink>
                ))}
              </nav>
              <div className="border-t border-linha px-5 py-3 flex flex-col gap-3">
                <SeletorTema variante="segmentos" />
                {podeVerComo ? (
                  <label className="flex flex-col gap-1.5 text-[13px] font-medium text-tinta-suave">
                    Ver o painel como (demonstração)
                    <select
                      value={perfil.id}
                      onChange={(e) => verComo(e.target.value)}
                      className="h-11 px-3 bg-cartao border border-linha-forte text-tinta font-medium"
                    >
                      {perfis.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome} · {PAPEL[p.papel]}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="text-[13px] text-tinta-suave">
                    <span className="font-semibold text-tinta">{perfil.nome}</span> · {PAPEL[perfil.papel]}
                  </p>
                )}
                <button type="button" onClick={sair} disabled={saindo} className="flex items-center gap-2 h-11 text-[14px] font-medium text-tinta-suave disabled:opacity-40">
                  <Icone nome="sair" /> {saindo ? "Saindo…" : "Sair"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Menu do usuário (rodapé da barra lateral): avatar, nome e papel; abre para cima com "Ver o painel como"
 * (demonstração — no S1 o login decide o perfil e a lista some). Mesmo desenho e teclado do menu de tema.
 */
function MenuUsuario({ perfil, perfis, onVerComo }: { perfil: Perfil; perfis: Perfil[]; onVerComo: (id: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const itens = useRef<(HTMLButtonElement | null)[]>([]);
  const idMenu = useId();
  const podeTrocar = perfis.length > 1;

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  useEffect(() => {
    if (aberto) itens.current[Math.max(0, perfis.findIndex((p) => p.id === perfil.id))]?.focus();
  }, [aberto, perfis, perfil.id]);

  const fechar = (devolverFoco = true) => {
    setAberto(false);
    if (devolverFoco) botao.current?.focus();
  };

  function teclaNoMenu(e: KeyboardEvent<HTMLDivElement>) {
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

  const identidade = (
    <>
      <span className="inline-grid place-items-center w-8 h-8 rounded-full bg-preto text-amarelo text-[12px] font-semibold shrink-0">{iniciais(perfil.nome)}</span>
      <span className="min-w-0 flex-1 leading-tight text-left">
        <span className="block text-[13px] font-semibold text-preto truncate" title={perfil.nome}>
          {perfil.nome}
        </span>
        <span className="block text-[12px] font-medium text-preto/70">{PAPEL[perfil.papel]}</span>
      </span>
    </>
  );

  if (!podeTrocar) return <div className="flex items-center gap-2 px-1 min-w-0 flex-1">{identidade}</div>;

  return (
    <div ref={raiz} className="relative min-w-0 flex-1">
      <button
        ref={botao}
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idMenu : undefined}
        aria-label={`${perfil.nome}, ${PAPEL[perfil.papel]}. Ver o painel como outra pessoa`}
        onClick={() => setAberto((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setAberto(true);
          }
        }}
        className={`w-full flex items-center gap-2 h-11 px-1 rounded-controle transition-colors duration-150 ${aberto ? "bg-preto/12" : "hover:bg-preto/8"}`}
      >
        {identidade}
        <Icone nome="baixo" tamanho={14} className={`shrink-0 text-preto/70 transition-transform duration-150 ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && (
        <div
          id={idMenu}
          role="menu"
          aria-label="Ver o painel como"
          onKeyDown={teclaNoMenu}
          className="absolute bottom-full left-0 mb-2 z-40 w-[208px] max-h-[60svh] overflow-y-auto p-1 rounded-cartao bg-cartao border border-linha elevacao"
        >
          <div aria-hidden="true" className="px-2.5 h-7 flex items-center text-[12px] font-medium text-tinta-fraca">
            Ver o painel como
          </div>
          {perfis.map((p, i) => {
            const marcado = p.id === perfil.id;
            return (
              <button
                key={p.id}
                ref={(el) => {
                  itens.current[i] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={marcado}
                tabIndex={-1}
                onClick={() => {
                  fechar();
                  if (!marcado) onVerComo(p.id);
                }}
                className="w-full flex items-center gap-2.5 min-h-10 py-1 px-2.5 rounded-controle text-left transition-colors duration-150 hover:bg-cinza-100 focus-visible:bg-cinza-100"
              >
                <span className="min-w-0 flex-1 leading-tight">
                  <span className={`block text-[14px] truncate ${marcado ? "text-tinta font-semibold" : "text-tinta font-medium"}`}>{p.nome}</span>
                  <span className="block text-[12px] text-tinta-fraca">{PAPEL[p.papel]}</span>
                </span>
                {marcado && <Icone nome="ok" tamanho={14} traco={2} className="shrink-0 text-tinta" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { MENU, PAPEL } from "../dominio/rotulos";
import { podeEditar, podeVer } from "../dominio/permissoes";
import { useSessao } from "../dados/sessao";
import { Icone } from "./Icone";
import { iniciais } from "./ui/Basicos";
import { sairDaSessao } from "./PinGate";

/** Casca do painel: barra lateral (desktop), barra inferior (celular), topo com busca e "Ver como". */
export function Layout() {
  const { perfil, perfis, trocarPerfil } = useSessao();
  const navegar = useNavigate();
  const [busca, setBusca] = useState("");

  const itens = MENU.filter((m) => podeVer(perfil.papel, m.modulo));
  const grupos = [
    { id: "operacao", nome: "Operação" },
    { id: "gestao", nome: "Gestão" },
    { id: "sistema", nome: "Sistema" },
  ] as const;
  const podeCriar = podeEditar(perfil.papel, "orcamentos");

  function buscar(e: FormEvent) {
    e.preventDefault();
    const termo = busca.trim();
    if (!termo) return;
    navegar(`/orcamentos?q=${encodeURIComponent(termo)}`);
  }

  return (
    <div className="min-h-svh md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      {/* ---------------- barra lateral (desktop) */}
      <aside className="hidden md:flex md:flex-col bg-preto text-papel md:sticky md:top-0 md:h-svh min-w-0">
        <Link to="/geral" className="flex items-center gap-3 px-5 h-16 shrink-0 border-b border-linha-clara no-underline text-papel">
          <img src={`${import.meta.env.BASE_URL}logo-mark.svg`} alt="" width={30} height={30} />
          <span className="leading-none">
            <span className="block font-bold text-[18px] tracking-[-0.01em]">doctor</span>
            <span className="rotulo text-amarelo block mt-1">Painel da oficina</span>
          </span>
        </Link>
        <nav aria-label="Seções do painel" className="flex-1 overflow-y-auto py-3">
          {grupos.map((g) => {
            const doGrupo = itens.filter((i) => i.grupo === g.id);
            if (doGrupo.length === 0) return null;
            return (
              <div key={g.id} className="mb-4">
                <p className="rotulo text-papel-fraco px-5 mb-1">{g.nome}</p>
                {doGrupo.map((item) => (
                  <NavLink
                    key={item.rota}
                    to={item.rota}
                    end={item.rota === "/producao"}
                    className={({ isActive }) =>
                      `flex items-center gap-3 h-10 mx-2 px-3 text-[14px] font-semibold no-underline transition-colors duration-150 ${
                        isActive ? "bg-grafite-3 text-papel" : "text-papel-suave hover:text-papel hover:bg-grafite-2"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icone nome={item.icone} className={isActive ? "text-amarelo" : ""} />
                        <span>{item.nome}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="shrink-0 border-t border-linha-clara p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="inline-grid place-items-center w-9 h-9 bg-amarelo text-preto text-[12px] font-bold shrink-0">{iniciais(perfil.nome)}</span>
            <span className="min-w-0 leading-tight">
              <span className="block text-[14px] font-semibold truncate">{perfil.nome}</span>
              <span className="block text-[12px] text-papel-fraco">{PAPEL[perfil.papel]}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              sairDaSessao();
              window.location.reload();
            }}
            className="flex items-center gap-2 h-10 px-2 w-full text-[13px] font-semibold text-papel-fraco hover:text-papel"
          >
            <Icone nome="sair" /> Sair
          </button>
        </div>
      </aside>

      {/* ---------------- conteúdo */}
      <div className="min-w-0 flex flex-col min-h-svh">
        <header className="sticky top-0 z-20 bg-papel/95 backdrop-blur-[2px] border-b border-linha">
          <div className="flex items-center gap-3 h-16 px-4 md:px-8 max-w-[1440px] mx-auto w-full">
            <Link to="/geral" className="md:hidden shrink-0" aria-label="D doctor — início">
              <img src={`${import.meta.env.BASE_URL}logo-mark.svg`} alt="" width={28} height={28} />
            </Link>
            <form onSubmit={buscar} role="search" className="flex-1 min-w-0 max-w-xl">
              <label htmlFor="busca" className="sr-only">
                Buscar por placa, protocolo ou cliente
              </label>
              <div className="flex items-center h-11 bg-cartao border border-linha-forte focus-within:border-preto">
                <span className="pl-3 text-tinta-fraca">
                  <Icone nome="busca" />
                </span>
                <input
                  id="busca"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Placa, protocolo ou cliente"
                  className="flex-1 min-w-0 h-full px-3 bg-transparent outline-none placeholder:text-tinta-fraca"
                  autoComplete="off"
                />
              </div>
            </form>
            <label className="hidden lg:flex items-center gap-2 text-[13px] text-tinta-suave shrink-0">
              <span>Ver como</span>
              <select
                value={perfil.id}
                onChange={(e) => {
                  trocarPerfil(e.target.value);
                  navegar("/");
                }}
                className="h-11 px-3 bg-cartao border border-linha-forte font-semibold text-tinta"
                aria-label="Ver o painel como"
              >
                {perfis.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} · {PAPEL[p.papel]}
                  </option>
                ))}
              </select>
            </label>
            {podeCriar && (
              <Link
                to="/orcamentos/novo"
                aria-label="Novo atendimento"
                className="inline-flex items-center justify-center gap-2 h-11 px-4 shrink-0 bg-amarelo text-preto font-bold no-underline hover:bg-amarelo-escuro transition-colors duration-150"
              >
                <Icone nome="mais" />
                <span className="hidden sm:inline">Novo atendimento</span>
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 md:px-8 py-6 md:py-8 pb-28 md:pb-10">
          <Outlet />
        </main>

        {/* ---------------- barra inferior (celular) */}
        <nav
          aria-label="Seções do painel"
          className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-preto text-papel grid border-t border-linha-clara pb-[env(safe-area-inset-bottom)]"
          style={{ gridTemplateColumns: `repeat(${Math.min(itens.length, 5)}, minmax(0, 1fr))` }}
        >
          {itens.slice(0, 5).map((item) => (
            <NavLink
              key={item.rota}
              to={item.rota}
              end={item.rota === "/producao"}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 h-16 text-[11px] font-semibold no-underline ${
                  isActive ? "text-amarelo" : "text-papel-suave"
                }`
              }
            >
              <Icone nome={item.icone} tamanho={22} />
              <span className="truncate max-w-full px-1">{item.nome}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

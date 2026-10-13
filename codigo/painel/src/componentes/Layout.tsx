import { useEffect, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { MENU, PAPEL } from "../dominio/rotulos";
import { podeEditar, podeVer, telaInicial } from "../dominio/permissoes";
import { useSessao } from "../dados/sessao";
import { Icone } from "./Icone";
import { iniciais } from "./ui/Basicos";
import { sairDaSessao } from "./PinGate";

/** Casca do painel: barra lateral (desktop), barra inferior (celular), topo com busca e "Ver como". */
export function Layout() {
  const { perfil, perfis, trocarPerfil } = useSessao();
  const navegar = useNavigate();
  const [busca, setBusca] = useState("");
  const [maisAberto, setMaisAberto] = useState(false);
  const local = useLocation();
  useEffect(() => setMaisAberto(false), [local.pathname]);
  const inicio = telaInicial(perfil.papel);
  // busca leva à lista de atendimentos: só para quem pode abrir Orçamentos
  const podeBuscar = podeVer(perfil.papel, "orcamentos");

  const itens = MENU.filter((m) => podeVer(perfil.papel, m.modulo));
  // celular: 4 atalhos + "Mais" (lista completa, Ver como e Sair)
  const atalhos = itens.slice(0, 4);
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
        <Link to={inicio} className="flex items-center gap-3 px-5 h-16 shrink-0 border-b border-linha-clara no-underline text-papel">
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
            <Link to={inicio} className="md:hidden shrink-0" aria-label="D doctor — início">
              <img src={`${import.meta.env.BASE_URL}logo-mark.svg`} alt="" width={28} height={28} />
            </Link>
            {!podeBuscar && <span className="flex-1" />}
            {podeBuscar && <form onSubmit={buscar} role="search" className="flex-1 min-w-0 max-w-xl">
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
            </form>}
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
          style={{ gridTemplateColumns: `repeat(${atalhos.length + 1}, minmax(0, 1fr))` }}
        >
          {atalhos.map((item) => (
            <NavLink
              key={item.rota}
              to={item.rota}
              end={item.rota === "/producao"}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 h-16 px-0.5 text-[11px] font-semibold leading-[1.1] no-underline ${
                  isActive ? "text-amarelo" : "text-papel-suave"
                }`
              }
            >
              <Icone nome={item.icone} tamanho={22} className="shrink-0" />
              <span className="max-w-full text-center line-clamp-2 break-words">{item.nome}</span>
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMaisAberto((v) => !v)}
            aria-expanded={maisAberto}
            aria-controls="menu-mais"
            className={`flex flex-col items-center justify-center gap-1 h-16 px-0.5 text-[11px] font-semibold leading-[1.1] ${maisAberto ? "text-amarelo" : "text-papel-suave"}`}
          >
            <Icone nome={maisAberto ? "fechar" : "ajustes"} tamanho={22} className="shrink-0" />
            <span>Mais</span>
          </button>
        </nav>

        {/* ---------------- menu "Mais" (celular) */}
        {maisAberto && (
          <div className="md:hidden fixed inset-0 z-20" role="presentation">
            <button type="button" aria-label="Fechar menu" className="absolute inset-0 bg-preto/40" onClick={() => setMaisAberto(false)} />
            <div
              id="menu-mais"
              role="dialog"
              aria-label="Todas as seções"
              className="absolute inset-x-0 bottom-16 mb-[env(safe-area-inset-bottom)] max-h-[75svh] overflow-y-auto bg-preto text-papel border-t border-linha-clara"
            >
              <nav aria-label="Todas as seções" className="py-2">
                {itens.map((item) => (
                  <NavLink
                    key={item.rota}
                    to={item.rota}
                    end={item.rota === "/producao"}
                    className={({ isActive }) =>
                      `flex items-center gap-3 h-12 px-5 text-[15px] font-semibold no-underline ${isActive ? "text-amarelo" : "text-papel"}`
                    }
                  >
                    <Icone nome={item.icone} />
                    {item.nome}
                  </NavLink>
                ))}
              </nav>
              <div className="border-t border-linha-clara px-5 py-3 flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-[12px] text-papel-fraco">
                  Ver o painel como (demonstração)
                  <select
                    value={perfil.id}
                    onChange={(e) => {
                      trocarPerfil(e.target.value);
                      navegar("/");
                    }}
                    className="h-11 px-3 bg-grafite-2 border border-linha-clara text-papel font-semibold"
                  >
                    {perfis.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} · {PAPEL[p.papel]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    sairDaSessao();
                    window.location.reload();
                  }}
                  className="flex items-center gap-2 h-11 text-[14px] font-semibold text-papel"
                >
                  <Icone nome="sair" /> Sair
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

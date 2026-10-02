import { useState, type FormEvent } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { MENU } from "../dominio/rotulos";
import { normalizarPlaca } from "../dominio/regras";
import { Icone, type NomeIcone } from "./Icone";
import { sairDaSessao } from "./PinGate";

const ICONE_MENU: Record<(typeof MENU)[number]["rota"], NomeIcone> = {
  "/patio": "patio",
  "/atendimentos": "atendimentos",
  "/agenda": "agenda",
  "/pendencias": "pendencias",
  "/financeiro": "financeiro",
  "/ajustes": "ajustes",
};

export function Layout() {
  const navegar = useNavigate();
  const [busca, setBusca] = useState("");

  function buscar(e: FormEvent) {
    e.preventDefault();
    const termo = busca.trim();
    if (!termo) return;
    navegar(`/atendimentos?q=${encodeURIComponent(normalizarPlaca(termo).length >= 3 ? termo : termo)}`);
    setBusca("");
  }

  return (
    <div className="min-h-svh grid md:grid-cols-[232px_1fr]">
      <aside className="bg-preto text-papel flex md:flex-col md:min-h-svh md:sticky md:top-0 md:h-svh">
        <div className="hidden md:flex items-center gap-3 px-5 h-16 border-b border-linha-clara">
          <img src={`${import.meta.env.BASE_URL}logo-mark.svg`} alt="" width={28} height={28} />
          <div className="leading-none">
            <div className="font-bold text-[17px] tracking-[-0.02em]">doctor</div>
            <div className="rotulo text-amarelo mt-1">Painel</div>
          </div>
        </div>
        <nav aria-label="Seções do painel" className="flex md:flex-col w-full overflow-x-auto md:overflow-visible md:py-3">
          {MENU.map((item) => (
            <NavLink
              key={item.rota}
              to={item.rota}
              className={({ isActive }) =>
                `flex items-center gap-3 min-h-12 md:min-h-11 px-4 md:px-5 text-[13px] font-bold whitespace-nowrap border-l-0 md:border-l-4 ${
                  isActive
                    ? "text-amarelo md:border-amarelo bg-grafite md:bg-transparent"
                    : "text-papel-suave md:border-transparent hover:text-papel"
                }`
              }
            >
              <Icone nome={ICONE_MENU[item.rota]} />
              <span>{item.nome}</span>
            </NavLink>
          ))}
        </nav>
        <div className="hidden md:block mt-auto p-4 border-t border-linha-clara">
          <button
            type="button"
            onClick={() => {
              sairDaSessao();
              window.location.reload();
            }}
            className="flex items-center gap-2 min-h-11 text-[13px] font-bold text-papel-suave hover:text-papel"
          >
            <Icone nome="sair" /> Sair
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-10 bg-papel border-b border-linha h-14 md:h-16 flex items-center gap-3 px-4 md:px-8">
          <form onSubmit={buscar} role="search" className="flex-1 max-w-xl flex items-stretch border border-linha focus-within:border-preto">
            <label htmlFor="busca-placa" className="sr-only">
              Buscar por placa, protocolo ou cliente
            </label>
            <span className="flex items-center pl-3 text-tinta-suave">
              <Icone nome="busca" />
            </span>
            <input
              id="busca-placa"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Placa, protocolo ou cliente"
              className="flex-1 min-h-11 px-3 bg-transparent outline-none placeholder:text-tinta-suave"
              autoComplete="off"
            />
          </form>
          <NavLink to="/atendimentos/novo" className="inline-flex items-center gap-2 min-h-11 px-4 bg-amarelo text-preto text-[13px] font-extrabold uppercase tracking-[0.04em] hover:bg-preto hover:text-amarelo transition-colors">
            <Icone nome="mais" /> <span className="hidden sm:inline">Novo</span>
          </NavLink>
        </header>
        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

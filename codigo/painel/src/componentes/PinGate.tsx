import { useState, type FormEvent, type ReactNode } from "react";
import { MarcaD } from "./ui/Marca";
import { buildTemBanco, enderecoModo } from "../dados/modo";

/**
 * Trava simples por PIN guardado no navegador. NÃO é segurança: evita que alguém abra a tela
 * errada numa demonstração. Login de verdade chega com o Supabase (Sprint 4).
 */
const CHAVE_PIN = "ddoctor.pin";
const CHAVE_SESSAO = "ddoctor.autenticado";
const PIN_PADRAO = "3316";

export function pinAtual(): string {
  return localStorage.getItem(CHAVE_PIN) ?? PIN_PADRAO;
}

export function definirPin(novo: string) {
  localStorage.setItem(CHAVE_PIN, novo);
}

export function sairDaSessao() {
  sessionStorage.removeItem(CHAVE_SESSAO);
}

export function PinGate({ children }: { children: ReactNode }) {
  const [liberado, setLiberado] = useState(() => sessionStorage.getItem(CHAVE_SESSAO) === "1");
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");

  if (liberado) return <>{children}</>;

  function entrar(e: FormEvent) {
    e.preventDefault();
    if (pin === pinAtual()) {
      sessionStorage.setItem(CHAVE_SESSAO, "1");
      setLiberado(true);
    } else {
      setErro("PIN incorreto. Tente de novo.");
      setPin("");
    }
  }

  return (
    <div className="min-h-svh bg-papel text-tinta grid place-items-center p-6">
      <div className="w-full max-w-sm">
        <form onSubmit={entrar} className="w-full bg-cartao border border-linha rounded-xl shadow-cartao p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-8">
            <MarcaD tamanho={36} />
            <div className="leading-none">
              <div className="font-semibold text-[18px] tracking-[-0.01em]">D doctor</div>
              <div className="mt-1 text-[13px] text-tinta-suave">Painel de gestão</div>
            </div>
          </div>
          <label htmlFor="pin" className="block mb-1.5 text-[13px] font-medium text-tinta-suave">
            PIN de acesso
          </label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className={`w-full h-12 px-4 bg-cartao text-tinta text-[24px] tracking-[0.3em] border outline-none transition-colors duration-150 focus:border-tinta-fraca focus:ring-3 focus:ring-amarelo/30 ${
              erro ? "border-alerta" : "border-linha-forte"
            }`}
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? "pin-erro" : undefined}
            autoFocus
          />
          {erro && (
            <p id="pin-erro" role="alert" className="mt-2 text-[13px] text-alerta">
              {erro}
            </p>
          )}
          <button
            type="submit"
            className="mt-5 w-full h-11 rounded-controle bg-amarelo text-preto font-semibold text-[14px] hover:bg-amarelo-escuro transition-colors duration-150"
          >
            Entrar
          </button>
          <p className="mt-5 text-[13px] text-tinta-suave leading-relaxed">
            {buildTemBanco()
              ? "Demonstração com carros e clientes fictícios, só neste navegador."
              : "Acesso provisório por PIN. O PIN pode ser trocado em Ajustes depois de entrar."}
          </p>
        </form>
        {buildTemBanco() && (
          <p className="mt-5 text-center text-[13px] text-tinta-suave">
            Tem login da oficina?{" "}
            <a href={enderecoModo(false)} className="font-medium text-tinta underline underline-offset-2">
              Entrar com usuário e senha
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

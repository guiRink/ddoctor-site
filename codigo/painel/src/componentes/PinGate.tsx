import { useState, type FormEvent, type ReactNode } from "react";

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
    <div className="min-h-svh bg-preto text-papel grid place-items-center p-6">
      <form onSubmit={entrar} className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-10">
          <img src={`${import.meta.env.BASE_URL}logo-mark.svg`} alt="" width={40} height={40} />
          <div className="leading-none">
            <div className="font-bold text-2xl tracking-[-0.02em]">doctor</div>
            <div className="rotulo text-amarelo mt-1">Painel de gestão</div>
          </div>
        </div>
        <label htmlFor="pin" className="rotulo text-papel-suave block mb-2">
          PIN de acesso
        </label>
        <input
          id="pin"
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full min-h-14 px-4 bg-grafite text-papel text-2xl tracking-[0.3em] border border-linha-clara focus:border-amarelo outline-none"
          aria-describedby={erro ? "pin-erro" : undefined}
          autoFocus
        />
        {erro && (
          <p id="pin-erro" role="alert" className="mt-2 text-sm text-amarelo">
            {erro}
          </p>
        )}
        <button
          type="submit"
          className="mt-6 w-full min-h-12 bg-amarelo text-preto font-extrabold uppercase tracking-[0.04em] text-[13px] hover:bg-papel transition-colors"
        >
          Entrar
        </button>
        <p className="mt-6 text-sm text-papel-suave leading-relaxed">
          Acesso provisório por PIN. O PIN pode ser trocado em Ajustes depois de entrar.
        </p>
      </form>
    </div>
  );
}

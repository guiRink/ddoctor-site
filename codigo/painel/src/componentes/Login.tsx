import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useAutenticacao, useEntrar, type Acesso } from "../dados/autenticacao";
import { mensagemErro } from "../dados/hooks";
import { enderecoModo, modoDados } from "../dados/modo";
import { Botao, Esqueleto } from "./ui/Basicos";
import { MensagemErro } from "./ui/Campos";
import { MarcaD } from "./ui/Marca";
import { Icone } from "./Icone";
import { PinGate } from "./PinGate";

/**
 * Entrada do painel (sprint S1). Banco real: login por usuário ("diego") ou e-mail e senha (Supabase Auth).
 * Demonstração (`?demo=1` ou build sem banco): o PIN de sempre. Mesmo cartão do PIN (painel-design §3 "PIN"):
 * fundo `papel`, cartão branco raio 12 com a MarcaD, campos de 48 px e o botão primário de largura total.
 */
export function PortaoAcesso({ children }: { children: ReactNode }) {
  if (modoDados() === "memoria") return <PinGate>{children}</PinGate>;
  return <PortaoLogin>{children}</PortaoLogin>;
}

function PortaoLogin({ children }: { children: ReactNode }) {
  const auth = useAutenticacao();
  if (auth.carregando)
    return (
      <Fundo>
        <div className="w-full max-w-sm">
          <Esqueleto linhas={3} />
        </div>
      </Fundo>
    );
  if (!auth.usuarioId) return <Login />;
  return <>{children}</>;
}

// ------------------------------------------------------------------ peças comuns

const CLASSE_CAMPO_ENTRADA =
  "w-full h-12 px-4 bg-cartao border border-linha-forte shadow-controle text-[16px] text-tinta outline-none transition-[border-color,box-shadow] duration-150 hover:border-tinta-fraca focus:border-tinta-fraca focus:ring-[3px] focus:ring-amarelo/30 placeholder:text-tinta-fraca aria-[invalid=true]:border-alerta aria-[invalid=true]:focus:ring-alerta/15";

function Fundo({ children }: { children: ReactNode }) {
  return <div className="min-h-svh bg-papel text-tinta grid place-items-center p-6">{children}</div>;
}

function Cabecalho() {
  return (
    <div className="flex items-center gap-3 mb-8">
      <MarcaD tamanho={36} />
      <div className="leading-none">
        <div className="font-semibold text-[18px] tracking-[-0.01em]">D doctor</div>
        <div className="mt-1 text-[13px] text-tinta-suave">Painel de gestão</div>
      </div>
    </div>
  );
}

/** Passo a passo do primeiro dono (codigo/supabase/README.md → "Primeiro dono"). Feito uma vez, no Supabase. */
export function PassosPrimeiroAcesso() {
  return (
    <ol className="mt-2 flex flex-col gap-2 list-decimal pl-5 text-[13px] text-tinta-suave leading-relaxed marker:text-tinta-fraca">
      <li>
        No Supabase, em <strong className="font-semibold text-tinta">Authentication → Users → Add user</strong>, crie o e-mail e a senha do dono e marque{" "}
        <strong className="font-semibold text-tinta">Auto Confirm User</strong>.
      </li>
      <li>
        No <strong className="font-semibold text-tinta">SQL Editor</strong>, rode:
        <code className="mt-1 block px-2.5 py-2 rounded-controle bg-cinza-100 text-tinta text-[12px] leading-relaxed whitespace-pre overflow-x-auto">
          {"select public.definir_primeiro_dono(\n  'email@do.dono', 'Nome do dono');"}
        </code>
      </li>
      <li>Volte aqui e entre com esse e-mail e senha. Os logins da equipe o dono dá depois, na aba Equipe.</li>
    </ol>
  );
}

// ------------------------------------------------------------------ login

export function Login() {
  const entrar = useEntrar();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState<{ codigo: string; campo?: string } | null>(null);
  const [esqueci, setEsqueci] = useState(false);
  const id = useId();
  const idUsuario = `${id}-usuario`;
  const idSenha = `${id}-senha`;
  const idErro = `${id}-erro`;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const r = await entrar.mutateAsync({ texto: usuario, senha });
    if (!r.ok) {
      setErro({ codigo: r.codigo ?? "erro_desconhecido", campo: r.campo });
      // leva o foco para onde corrigir (leitor de tela anuncia a mensagem ligada ao campo)
      if (r.codigo === "login_invalido") setSenha("");
      document.getElementById(r.campo === "usuario" ? idUsuario : idSenha)?.focus();
    }
  }

  // erro de um campo fica embaixo dele; senha errada marca os dois; o resto (rede, bloqueio) acima do botão
  const erroUsuario = erro && (erro.campo === "usuario" || erro.codigo === "login_invalido");
  const erroSenha = erro && (erro.campo === "senha" || erro.codigo === "login_invalido");
  const mensagem = erro ? mensagemErro(erro.codigo) : "";

  return (
    <Fundo>
      <div className="w-full max-w-sm">
        <div className="bg-cartao border border-linha rounded-xl shadow-cartao">
          <form onSubmit={enviar} noValidate className="p-6 sm:p-8">
            <Cabecalho />
            <h1 className="sr-only">Entrar no painel</h1>
            <div>
              <label htmlFor={idUsuario} className="block mb-1.5 text-[13px] font-medium text-tinta-suave">
                Usuário ou e-mail
              </label>
              <input
                id={idUsuario}
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                aria-invalid={erroUsuario ? true : undefined}
                aria-describedby={erroUsuario ? idErro : undefined}
                className={CLASSE_CAMPO_ENTRADA}
                autoFocus
              />
              {erro?.campo === "usuario" && (
                <div role="alert">
                  <MensagemErro id={idErro}>{mensagem}</MensagemErro>
                </div>
              )}
            </div>
            <div className="mt-4">
              <label htmlFor={idSenha} className="block mb-1.5 text-[13px] font-medium text-tinta-suave">
                Senha
              </label>
              <div className="relative">
                <input
                  id={idSenha}
                  name="password"
                  type={verSenha ? "text" : "password"}
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  aria-invalid={erroSenha ? true : undefined}
                  aria-describedby={erroSenha ? idErro : undefined}
                  className={`${CLASSE_CAMPO_ENTRADA} pr-24`}
                />
                <button
                  type="button"
                  onClick={() => setVerSenha((v) => !v)}
                  aria-label={verSenha ? "Ocultar a senha" : "Mostrar a senha"}
                  aria-controls={idSenha}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 px-3 rounded-controle text-[13px] font-medium text-tinta-suave hover:text-tinta hover:bg-cinza-100 transition-colors duration-150"
                >
                  {verSenha ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>
            {erro && erro.campo !== "usuario" && (
              <div role="alert">
                <MensagemErro id={idErro}>{mensagem}</MensagemErro>
              </div>
            )}
            <Botao type="submit" variante="primario" className="mt-5 w-full" disabled={entrar.isPending}>
              {entrar.isPending ? "Entrando…" : "Entrar"}
            </Botao>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setEsqueci((v) => !v)}
                aria-expanded={esqueci}
                className="min-h-11 md:min-h-8 text-[13px] font-medium text-tinta-suave underline underline-offset-2 hover:text-tinta"
              >
                Esqueci a senha
              </button>
              {esqueci && (
                <p role="status" className="mt-1 text-[13px] text-tinta-suave leading-relaxed">
                  Peça ao dono para redefinir em <strong className="font-semibold text-tinta">Equipe</strong>. O painel não envia e-mail de recuperação.
                </p>
              )}
            </div>
          </form>
          <details className="group border-t border-linha px-6 sm:px-8 py-4">
            <summary className="flex items-center justify-between gap-2 min-h-11 md:min-h-8 cursor-pointer list-none text-[13px] font-medium text-tinta-suave hover:text-tinta">
              Primeiro acesso da oficina
              <Icone nome="baixo" tamanho={14} className="shrink-0 transition-transform duration-150 group-open:rotate-180" />
            </summary>
            <p className="mt-1 text-[13px] text-tinta-suave leading-relaxed">Ainda não existe dono com login? Faça uma vez:</p>
            <PassosPrimeiroAcesso />
          </details>
        </div>
        <p className="mt-5 text-center text-[13px] text-tinta-suave">
          Só quer conhecer o painel?{" "}
          <a href={enderecoModo(true)} className="font-medium text-tinta underline underline-offset-2">
            Ver demonstração
          </a>
        </p>
      </div>
    </Fundo>
  );
}

// ------------------------------------------------------------------ logado, mas sem acesso

export function SemAcesso({ acesso, email, onSair, saindo = false }: { acesso: Acesso; email?: string; onSair: () => void; saindo?: boolean }) {
  const desligado = acesso.estado === "inativo";
  return (
    <Fundo>
      <div className="w-full max-w-sm bg-cartao border border-linha rounded-xl shadow-cartao p-6 sm:p-8">
        <Cabecalho />
        <div className="flex items-start gap-3">
          <span className="inline-grid place-items-center w-10 h-10 shrink-0 rounded-cartao bg-alerta-claro text-alerta">
            <Icone nome="bloqueio" tamanho={20} />
          </span>
          <div className="min-w-0">
            <h1 className="text-[16px] font-semibold">Sem acesso — fale com o dono</h1>
            <p className="mt-1 text-[14px] text-tinta-suave leading-relaxed">
              {desligado
                ? `O cadastro de ${acesso.nome} está desligado ou com o login desativado.`
                : "Este login entrou, mas não está ligado a ninguém da equipe."}
            </p>
            {email && (
              <p className="mt-2 text-[13px] text-tinta-suave break-all">
                Entrou como <span className="font-medium text-tinta">{email}</span>
              </p>
            )}
          </div>
        </div>
        {!desligado && (
          <div className="mt-5 pt-4 border-t border-linha">
            <p className="text-[13px] font-medium text-tinta">É o primeiro acesso da oficina?</p>
            <PassosPrimeiroAcesso />
          </div>
        )}
        <Botao variante="contorno" icone="sair" className="mt-6 w-full" onClick={onSair} disabled={saindo}>
          {saindo ? "Saindo…" : "Sair"}
        </Botao>
      </div>
    </Fundo>
  );
}

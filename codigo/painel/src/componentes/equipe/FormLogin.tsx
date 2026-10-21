import { useId, useState } from "react";
import type { Perfil } from "@compartilhado/tipos";
import { DOMINIO_LOGIN, normalizarUsuario, sugerirUsuario } from "@compartilhado/dominio/equipe";
import { mensagemErro, useAcoes } from "../../dados/hooks";
import { LIMITES_SENHA, validarSenha } from "../../dados/repositorio";
import { Botao } from "../ui/Basicos";
import { Aviso, CLASSE_CAMPO, Grupo } from "../ui/Campos";
import { Gaveta } from "../ui/Gaveta";
import { Icone } from "../Icone";
import { gerarSenha } from "./modelo";

/**
 * Dar login, redefinir a senha ou tirar o login de um funcionário (só o dono). O dono escolhe o usuário (sugestão:
 * sugerirUsuario) e a senha (gerada, editável); depois de salvar, a tela mostra os dois UMA vez, com "Copiar", para
 * ele passar à pessoa. A senha não fica guardada no painel. No Supabase quem cria o usuário é a Edge Function
 * `equipe-login`; o Auth recebe o e-mail técnico "<usuario>@equipe.ddoctor.app".
 */
export function FormLogin({ perfil, perfis, souEu, onFechar, onFeito }: { perfil: Perfil; perfis: Perfil[]; souEu: boolean; onFechar: () => void; onFeito: (mensagem: string) => void }) {
  const acoes = useAcoes();
  const id = useId();
  const temLogin = Boolean(perfil.temLogin);
  const [usuario, setUsuario] = useState(perfil.usuario ?? sugerirUsuario(perfil.nome, perfis) ?? "");
  const [senha, setSenha] = useState(() => gerarSenha());
  const [erro, setErro] = useState<{ campo?: string; texto: string }>();
  const [feito, setFeito] = useState<{ usuario: string; senha: string } | null>(null);
  const [tirando, setTirando] = useState(false);

  async function enviar() {
    setErro(undefined);
    const erroSenha = validarSenha(senha);
    if (erroSenha) {
      setErro({ campo: "senha", texto: mensagemErro(erroSenha) });
      document.getElementById(`${id}-senha`)?.focus();
      return;
    }
    try {
      const r = await acoes.definirLogin.mutateAsync([perfil.id, { usuario, senha }]);
      if (!r.ok || !r.usuario) return setErro({ campo: r.campo, texto: mensagemErro(r.codigo) });
      setFeito({ usuario: r.usuario, senha });
    } catch {
      setErro({ texto: mensagemErro() });
    }
  }

  async function tirar() {
    setErro(undefined);
    try {
      const r = await acoes.removerLogin.mutateAsync([perfil.id]);
      if (!r.ok) return setErro({ texto: mensagemErro(r.codigo) });
      onFeito(`${perfil.nome} não entra mais no painel. O cadastro e o histórico continuam.`);
    } catch {
      setErro({ texto: mensagemErro() });
    }
  }

  if (feito) {
    return (
      <Gaveta
        titulo={temLogin ? "Senha redefinida" : "Login criado"}
        descricao={perfil.nome}
        onFechar={() => onFeito(temLogin ? `Senha de ${perfil.nome} redefinida.` : `${perfil.nome} já pode entrar no painel.`)}
        rodape={
          <div className="flex justify-end">
            <Botao variante="primario" className="max-md:flex-1" onClick={() => onFeito(temLogin ? `Senha de ${perfil.nome} redefinida.` : `${perfil.nome} já pode entrar no painel.`)}>
              Pronto
            </Botao>
          </div>
        }
      >
        <Aviso tom="ok">Passe o usuário e a senha para {perfil.nome.split(" ")[0]}. A senha não aparece de novo: se esquecer, é só redefinir aqui.</Aviso>
        <div className="rounded-cartao border border-linha bg-cinza-50 divide-y divide-linha">
          <Credencial rotulo="Usuário" valor={feito.usuario} />
          <Credencial rotulo="Senha" valor={feito.senha} />
        </div>
        <Copiar
          texto={`Painel D doctor\nUsuário: ${feito.usuario}\nSenha: ${feito.senha}`}
          rotulo="Copiar usuário e senha"
          rotuloFeito="Copiados"
          grande
        />
        <p className="text-[12px] text-tinta-fraca">
          Na tela de entrada a pessoa digita o usuário (não precisa de e-mail). Endereço técnico: {feito.usuario}@{DOMINIO_LOGIN}
        </p>
      </Gaveta>
    );
  }

  const usuarioNormal = normalizarUsuario(usuario);
  const erroDe = (campo: string) => (erro?.campo === campo ? erro.texto : undefined);

  return (
    <Gaveta
      titulo={temLogin ? `Login de ${perfil.nome}` : `Dar login a ${perfil.nome}`}
      descricao="Usuário e senha para entrar no painel. Você passa os dois para a pessoa."
      acao={temLogin ? "Salvar nova senha" : "Criar login"}
      onFechar={onFechar}
      onEnviar={enviar}
      enviando={acoes.definirLogin.isPending}
      erro={erro && !erro.campo ? erro.texto : undefined}
    >
      <Grupo
        id={`${id}-usuario`}
        rotulo="Usuário"
        erro={erroDe("usuario")}
        dica={
          <>
            Letras sem acento e números, de 3 a 30. <span className="text-tinta-fraca">Endereço técnico: {usuarioNormal || "usuario"}@{DOMINIO_LOGIN}</span>
          </>
        }
      >
        <input
          id={`${id}-usuario`}
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={Boolean(erroDe("usuario"))}
          aria-describedby={erroDe("usuario") ? `${id}-usuario-erro` : `${id}-usuario-dica`}
          className={`${CLASSE_CAMPO} font-medium`}
        />
      </Grupo>

      <Grupo
        id={`${id}-senha`}
        rotulo={temLogin ? "Nova senha" : "Senha"}
        erro={erroDe("senha")}
        dica={`Gerada para você; pode trocar. No mínimo ${LIMITES_SENHA.min} caracteres e no máximo ${LIMITES_SENHA.maxBytes} bytes (letra com acento conta 2, emoji 4). Ela aparece mais uma vez depois de salvar, para copiar.`}
        extra={
          <button
            type="button"
            onClick={() => setSenha(gerarSenha())}
            className="inline-flex items-center h-8 -my-1.5 px-2 rounded-controle text-[13px] font-medium text-tinta-suave hover:text-tinta hover:bg-cinza-100"
          >
            Gerar outra
          </button>
        }
      >
        <div className="flex gap-2">
          <input
            id={`${id}-senha`}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="new-password"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={Boolean(erroDe("senha"))}
            aria-describedby={erroDe("senha") ? `${id}-senha-erro` : `${id}-senha-dica`}
            className={`${CLASSE_CAMPO} font-medium tracking-[0.04em] numero`}
          />
          <Copiar texto={senha} rotulo="Copiar senha" rotuloFeito="Copiada" />
        </div>
      </Grupo>

      {temLogin && !souEu && (
        <section aria-labelledby={`${id}-tirar`} className="mt-2 pt-5 border-t border-linha flex flex-col gap-2">
          <h3 id={`${id}-tirar`} className="text-[14px] font-semibold">
            Tirar o login
          </h3>
          <p className="text-[13px] text-tinta-suave">A pessoa deixa de entrar no painel. O cadastro, o histórico e a folha continuam.</p>
          {!tirando ? (
            <Botao variante="perigo" tamanho="denso" className="self-start" onClick={() => setTirando(true)}>
              Tirar login
            </Botao>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Botao variante="perigo" tamanho="denso" onClick={tirar} disabled={acoes.removerLogin.isPending}>
                {acoes.removerLogin.isPending ? "Tirando…" : `Sim, tirar o login de ${perfil.nome.split(" ")[0]}`}
              </Botao>
              <Botao variante="fantasma" tamanho="denso" onClick={() => setTirando(false)}>
                Cancelar
              </Botao>
            </div>
          )}
        </section>
      )}
    </Gaveta>
  );
}

function Credencial({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="min-w-0">
        <span className="block text-[12px] text-tinta-suave">{rotulo}</span>
        <span className="block text-[18px] font-semibold tracking-[0.02em] numero break-all">{valor}</span>
      </span>
      <Copiar texto={valor} rotulo={`Copiar ${rotulo.toLowerCase()}`} rotuloFeito="Copiado" />
    </div>
  );
}

/** Botão "Copiar" que vira "Copiado" por 2 s; sem área de transferência, avisa. */
function Copiar({ texto, rotulo, rotuloFeito, grande = false }: { texto: string; rotulo: string; rotuloFeito: string; grande?: boolean }) {
  const [estado, setEstado] = useState<"" | "ok" | "falhou">("");
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setEstado("ok");
    } catch {
      setEstado("falhou");
    }
    setTimeout(() => setEstado(""), 2000);
  }
  if (grande)
    return (
      <Botao variante="contorno" icone={estado === "ok" ? "ok" : "copiar"} onClick={copiar} className="w-full" aria-live="polite">
        {estado === "ok" ? rotuloFeito : estado === "falhou" ? "Não consegui copiar; anote à mão" : rotulo}
      </Botao>
    );
  return (
    <Botao variante="contorno" tamanho="padrao" onClick={copiar} aria-label={rotulo} title={rotulo} className="shrink-0 gap-1.5">
      <Icone nome={estado === "ok" ? "ok" : "copiar"} tamanho={16} className={estado === "ok" ? "text-ok" : ""} />
      <span className="max-sm:sr-only text-[13px]" aria-live="polite">
        {estado === "ok" ? rotuloFeito : estado === "falhou" ? "Anote" : "Copiar"}
      </span>
    </Botao>
  );
}

import { useId, useState } from "react";
import type { Id, Papel, Perfil } from "@compartilhado/tipos";
import { reaisParaCentavos } from "@compartilhado/dominio/dinheiro";
import { FUNCOES_SUGERIDAS } from "@compartilhado/dominio/equipe";
import { mensagemErro, useAcoes } from "../../dados/hooks";
import { PAPEL, PERMISSAO_RESUMO } from "../../dominio/rotulos";
import { formatarTelefone, mascaraTelefone } from "../clientes/formato";
import { centavosParaCampo } from "../gestao/formato";
import { CLASSE_CAMPO, CampoComAfixo, Grupo, Marcador, OpcoesEmGrade } from "../ui/Campos";
import { Etiqueta } from "../ui/Estado";
import { Gaveta } from "../ui/Gaveta";
import { PERMISSOES, TOM_PERMISSAO, funcaoEPermissao } from "./modelo";

/**
 * Cadastrar ou editar um funcionário (gaveta). Nome, função (texto livre), telefone, admissão e ativo: quem gerencia
 * a equipe (dono e gerente). Permissão e salário: só o dono (podeEditarPapel / podeEditarSalario); para o gerente
 * aparecem como leitura. O login fica fora (FormLogin).
 */
export function FormFuncionario({
  perfil,
  podeEditarPapel,
  podeEditarSalario,
  onFechar,
  onFeito,
}: {
  /** Ausente = cadastro novo. */
  perfil?: Perfil;
  podeEditarPapel: boolean;
  podeEditarSalario: boolean;
  onFechar: () => void;
  onFeito: (id: Id, mensagem: string, novo: boolean) => void;
}) {
  const acoes = useAcoes();
  const id = useId();
  const novo = !perfil;
  const [nome, setNome] = useState(perfil?.nome ?? "");
  const [funcao, setFuncao] = useState(perfil?.funcao ?? "");
  const [papel, setPapel] = useState<Papel>(perfil?.papel ?? "producao");
  const [telefone, setTelefone] = useState(perfil?.telefone ? formatarTelefone(perfil.telefone) : "");
  const [admissao, setAdmissao] = useState(perfil?.admitidoEm ?? "");
  const [salario, setSalario] = useState(perfil?.salarioMensal !== undefined ? centavosParaCampo(perfil.salarioMensal) : "");
  const [ativo, setAtivo] = useState(perfil?.ativo ?? true);
  const [terminal, setTerminal] = useState(perfil?.usaTerminal ?? false);
  const [erro, setErro] = useState<{ campo?: string; texto: string }>();

  async function enviar() {
    setErro(undefined);
    let salarioMensal: number | undefined;
    if (podeEditarSalario && salario.trim()) {
      const c = reaisParaCentavos(salario);
      if (c === null || c < 0) return setErro({ campo: "salarioMensal", texto: mensagemErro("salario_invalido") });
      salarioMensal = c;
    }
    try {
      const r = await acoes.salvarFuncionario.mutateAsync([
        {
          id: perfil?.id,
          nome,
          funcao,
          papel,
          telefone,
          admitidoEm: admissao || undefined,
          // quem não edita salário não manda o campo (o repositório mantém o que está)
          ...(podeEditarSalario ? { salarioMensal } : {}),
          ativo,
          usaTerminal: papel === "producao" ? terminal : false,
        },
      ]);
      if (!r.ok || !r.id) return setErro({ campo: r.campo, texto: mensagemErro(r.codigo) });
      onFeito(r.id, novo ? `${nome.trim()} cadastrado.` : `Cadastro de ${nome.trim()} salvo.`, novo);
    } catch {
      setErro({ texto: mensagemErro() });
    }
  }

  const erroDe = (campo: string) => (erro?.campo === campo ? erro.texto : undefined);
  const erroGeral = erro && !["nome", "telefone", "salarioMensal", "admitidoEm"].includes(erro.campo ?? "") ? erro.texto : undefined;
  const papeis = PERMISSOES;

  return (
    <Gaveta
      titulo={novo ? "Cadastrar funcionário" : `Editar ${perfil.nome}`}
      descricao={novo ? "O login (usuário e senha) você dá depois de salvar." : funcaoEPermissao(perfil)}
      acao={novo ? "Cadastrar" : "Salvar"}
      onFechar={onFechar}
      onEnviar={enviar}
      enviando={acoes.salvarFuncionario.isPending}
      erro={erroGeral}
    >
      <Grupo id={`${id}-nome`} rotulo="Nome" erro={erroDe("nome")}>
        <input
          id={`${id}-nome`}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoComplete="off"
          aria-invalid={Boolean(erroDe("nome"))}
          aria-describedby={erroDe("nome") ? `${id}-nome-erro` : undefined}
          className={CLASSE_CAMPO}
        />
      </Grupo>

      <Grupo id={`${id}-funcao`} rotulo="Função" opcional dica="O ofício: Pintor, Funileiro, Recepção… Não muda o que a pessoa vê no painel.">
        <input
          id={`${id}-funcao`}
          value={funcao}
          onChange={(e) => setFuncao(e.target.value)}
          list={`${id}-funcoes`}
          autoComplete="off"
          aria-describedby={`${id}-funcao-dica`}
          className={CLASSE_CAMPO}
        />
        <datalist id={`${id}-funcoes`}>
          {FUNCOES_SUGERIDAS.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
      </Grupo>

      {podeEditarPapel ? (
        <div className="flex flex-col gap-2">
          <OpcoesEmGrade<Papel>
            nome={`${id}-papel`}
            legenda="Permissão no painel"
            colunas={3}
            opcoes={papeis.map((p) => ({ valor: p, texto: PAPEL[p] }))}
            valor={papel}
            onMudar={setPapel}
          />
          <p className="text-[13px] text-tinta-suave leading-snug" aria-live="polite">
            <strong className="font-semibold text-tinta">{PAPEL[papel]} vê:</strong> {papel !== "dispositivo" && PERMISSAO_RESUMO[papel]}
          </p>
          {erroDe("papel") && <p className="text-[13px] font-medium text-alerta">{erroDe("papel")}</p>}
        </div>
      ) : (
        <div>
          <p className="text-[13px] font-medium text-tinta-suave mb-1.5">Permissão no painel</p>
          <div className="flex flex-wrap items-center gap-2">
            <Etiqueta tom={TOM_PERMISSAO[papel]}>{PAPEL[papel]}</Etiqueta>
            <span className="text-[12px] text-tinta-suave">Só o dono troca a permissão.</span>
          </div>
        </div>
      )}

      {papel === "producao" && (
        <Marcador id={`${id}-terminal`} rotulo="Usa o terminal da oficina (em vez do celular próprio)" marcado={terminal} onMudar={setTerminal} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Grupo id={`${id}-tel`} rotulo="Telefone" opcional erro={erroDe("telefone")}>
          <input
            id={`${id}-tel`}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="(41) 99999-0000"
            value={telefone}
            onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
            aria-invalid={Boolean(erroDe("telefone"))}
            className={`${CLASSE_CAMPO} numero`}
          />
        </Grupo>
        <Grupo id={`${id}-admissao`} rotulo="Admissão" opcional erro={erroDe("admitidoEm")}>
          <input
            id={`${id}-admissao`}
            type="date"
            value={admissao}
            onChange={(e) => setAdmissao(e.target.value)}
            aria-invalid={Boolean(erroDe("admitidoEm"))}
            className={`${CLASSE_CAMPO} numero`}
          />
        </Grupo>
      </div>

      {podeEditarSalario && (
        <Grupo id={`${id}-salario`} rotulo="Salário mensal" opcional erro={erroDe("salarioMensal")} dica="Valor fixo do mês. Vazio = recebe só as comissões.">
          <CampoComAfixo
            id={`${id}-salario`}
            prefixo="R$"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={salario}
            onChange={(e) => setSalario(e.target.value)}
            aria-invalid={Boolean(erroDe("salarioMensal"))}
            aria-describedby={erroDe("salarioMensal") ? `${id}-salario-erro` : `${id}-salario-dica`}
          />
        </Grupo>
      )}

      {!novo && (
        <div className="rounded-cartao border border-linha bg-cinza-50 px-4 py-3">
          <Marcador id={`${id}-ativo`} rotulo="Ativo na oficina" marcado={ativo} onMudar={setAtivo} />
          <p className="mt-1 text-[12px] text-tinta-suave">
            {ativo ? "Desmarque quando a pessoa sair. O histórico e os pagamentos ficam guardados." : "Desligado: some das listas de responsável e da folha dos próximos meses."}
          </p>
        </div>
      )}
    </Gaveta>
  );
}


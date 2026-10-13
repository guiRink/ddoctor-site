import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Cliente, Endereco, Id, TipoPessoa } from "@compartilhado/tipos";
import { UFS } from "@compartilhado/tipos";
import { normalizarCEP, normalizarDocumento, tipoPorDocumento, validarDocumento } from "@compartilhado/dominio/documento";
import { mensagemErro, useAcoes, useClientes } from "../../dados/hooks";
import type { ClienteEntrada } from "../../dados/repositorio";
import { ERRO } from "../../dominio/rotulos";
import { Botao } from "../ui/Basicos";
import { Icone } from "../Icone";
import { CLASSE_AREA, CLASSE_CAMPO, Campo, Marcador, MensagemErro, SecaoForm, Segmentado } from "./Campos";
import { Gaveta } from "./Gaveta";
import { descrito, formatarTelefone, mascaraCEP, mascaraDocumento, mascaraTelefone, telefoneCompleto } from "./formato";

type Erros = Partial<Record<"nome" | "documento" | "telefone" | "whatsapp" | "email" | "cep" | "endereco", string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Código do repositório → campo que recebe a mensagem (o resto vai para o topo do painel). */
const CAMPO_DO_ERRO: Record<string, keyof Erros> = {
  nome_obrigatorio: "nome",
  documento_invalido: "documento",
  documento_duplicado: "documento",
  telefone_invalido: "telefone",
  email_invalido: "email",
  cep_invalido: "cep",
};

/**
 * Cadastro e edição de cliente no painel lateral (docs/concorrente-analise.md §3.1).
 * Seções: Identificação · Contato · Endereço · Observações. Documento validado ao sair do campo;
 * a validação final é a do repositório (códigos de erro → rotulos.ts ERRO).
 */
export function FormCliente({ cliente, onFechar, onSalvo }: { cliente?: Cliente; onFechar: () => void; onSalvo: (id: Id) => void }) {
  const acoes = useAcoes();
  const clientes = useClientes();
  const editando = Boolean(cliente);

  const [tipo, setTipo] = useState<TipoPessoa>(cliente?.tipoPessoa ?? (cliente?.documento && normalizarDocumento(cliente.documento).length === 14 ? "pj" : "pf"));
  const [documento, setDocumento] = useState(cliente?.documento ? mascaraDocumento(cliente.documento) : "");
  const [nome, setNome] = useState(cliente?.nome ?? "");
  const [telefone, setTelefone] = useState(formatarTelefone(cliente?.telefone));
  const [whatsIgual, setWhatsIgual] = useState(!cliente || (Boolean(cliente.whatsapp) && cliente.whatsapp === cliente.telefone));
  const [whatsapp, setWhatsapp] = useState(formatarTelefone(cliente?.whatsapp));
  const [email, setEmail] = useState(cliente?.email ?? "");
  const e0 = cliente?.endereco;
  const [cep, setCep] = useState(e0 ? mascaraCEP(e0.cep) : "");
  const [logradouro, setLogradouro] = useState(e0?.logradouro ?? "");
  const [numero, setNumero] = useState(e0?.numero ?? "");
  const [complemento, setComplemento] = useState(e0?.complemento ?? "");
  const [bairro, setBairro] = useState(e0?.bairro ?? "");
  const [cidade, setCidade] = useState(e0?.cidade ?? "");
  const [uf, setUf] = useState<string>(e0?.uf ?? "");
  const [observacoes, setObservacoes] = useState(cliente?.observacoes ?? "");
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState("");
  const [duplicadoId, setDuplicadoId] = useState<Id>();
  const enviando = acoes.salvarCliente.isPending;

  const limpar = (campo: keyof Erros) => erros[campo] && setErros((e) => ({ ...e, [campo]: undefined }));

  /** Outro cadastro com o mesmo documento (para oferecer o link em vez de só o erro). */
  function outroComDocumento(doc: string): Cliente | undefined {
    const n = normalizarDocumento(doc);
    if (!n) return undefined;
    return clientes.data?.find((r) => r.cliente.id !== cliente?.id && r.cliente.documento && normalizarDocumento(r.cliente.documento) === n)?.cliente;
  }

  /** Confere o documento; devolve o erro e o tipo efetivo (troca PF/PJ se o documento for válido no outro tipo). */
  function conferirDocumento(): { erro?: string; tipo: TipoPessoa } {
    if (!documento.trim()) return { tipo };
    const deduzido = tipoPorDocumento(documento);
    let efetivo = tipo;
    if (deduzido && deduzido !== tipo && validarDocumento(documento, deduzido)) {
      efetivo = deduzido;
      setTipo(deduzido);
      setDocumento(mascaraDocumento(documento, deduzido));
    } else if (!validarDocumento(documento, tipo)) return { erro: ERRO.documento_invalido, tipo };
    const outro = outroComDocumento(documento);
    if (outro) {
      setDuplicadoId(outro.id);
      return { erro: ERRO.documento_duplicado, tipo: efetivo };
    }
    return { tipo: efetivo };
  }

  function aoSairDoDocumento() {
    setDuplicadoId(undefined);
    const { erro } = conferirDocumento();
    setErros((e) => ({ ...e, documento: erro }));
  }

  const algumEndereco = [cep, logradouro, numero, complemento, bairro, cidade, uf].some((v) => v.trim());

  function validar(): { erros: Erros; tipo: TipoPessoa } {
    const e: Erros = {};
    const doc = conferirDocumento();
    if (!nome.trim()) e.nome = doc.tipo === "pj" ? "Informe a razão social." : "Informe o nome.";
    if (doc.erro) e.documento = doc.erro;
    if (!telefoneCompleto(telefone)) e.telefone = ERRO.telefone_invalido;
    if (!whatsIgual && !telefoneCompleto(whatsapp)) e.whatsapp = ERRO.telefone_invalido;
    if (email.trim() && !EMAIL.test(email.trim())) e.email = ERRO.email_invalido;
    if (algumEndereco) {
      if (!normalizarCEP(cep)) e.cep = ERRO.cep_invalido;
      if (!logradouro.trim() || !cidade.trim()) e.endereco = "Para guardar o endereço, preencha ao menos CEP, rua e cidade.";
    }
    return { erros: e, tipo: doc.tipo };
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErroGeral("");
    const { erros: e, tipo: tipoFinal } = validar();
    setErros(e);
    if (Object.values(e).some(Boolean)) {
      focarPrimeiro(e);
      return;
    }
    const endereco: Endereco | undefined = algumEndereco
      ? {
          cep,
          logradouro: logradouro.trim(),
          numero: numero.trim() || "s/n",
          complemento: complemento.trim() || undefined,
          bairro: bairro.trim(),
          cidade: cidade.trim(),
          uf,
        }
      : undefined;
    const entrada: ClienteEntrada = {
      ...(cliente ?? {}),
      id: cliente?.id,
      nome: nome.trim(),
      tipoPessoa: tipoFinal,
      documento: documento.trim() || undefined,
      telefone: telefone.trim() || undefined,
      whatsapp: (whatsIgual ? telefone : whatsapp).trim() || undefined,
      email: email.trim() || undefined,
      endereco,
      observacoes: observacoes.trim() || undefined,
    };
    try {
      const r = await acoes.salvarCliente.mutateAsync([entrada]);
      if (r.ok && r.id) {
        onSalvo(r.id);
        return;
      }
      const campo = r.codigo ? CAMPO_DO_ERRO[r.codigo] : undefined;
      if (campo) {
        if (r.codigo === "documento_duplicado") setDuplicadoId(outroComDocumento(documento)?.id);
        const novo = { [campo]: mensagemErro(r.codigo) };
        setErros(novo);
        focarPrimeiro(novo);
      } else setErroGeral(mensagemErro(r.codigo));
    } catch {
      setErroGeral(mensagemErro());
    }
  }

  const rotuloDoc = tipo === "pj" ? "CNPJ" : "CPF";

  return (
    <Gaveta
      titulo={editando ? "Editar cliente" : "Novo cliente"}
      descricao={editando ? cliente?.nome : "Só o nome é obrigatório. O resto pode vir depois."}
      onFechar={onFechar}
      onEnviar={salvar}
      rodape={
        <>
          <Botao variante="contorno" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" variante="primario" disabled={enviando} className="min-w-[148px]">
            {enviando ? "Salvando…" : editando ? "Salvar alterações" : "Cadastrar cliente"}
          </Botao>
        </>
      }
    >
      {erroGeral && (
        <p role="alert" className="mb-5 flex items-start gap-2 px-3 py-2.5 rounded-controle bg-alerta-claro text-alerta text-[13px] font-medium">
          <Icone nome="alerta" tamanho={16} className="mt-0.5 shrink-0" />
          {erroGeral}
        </p>
      )}

      <SecaoForm titulo="Identificação">
        <Segmentado
          nome="tipo-pessoa"
          legenda="Tipo de cliente"
          ocultarLegenda
          opcoes={[
            { valor: "pf", texto: "Pessoa física" },
            { valor: "pj", texto: "Pessoa jurídica" },
          ]}
          valor={tipo}
          onMudar={(t) => {
            setTipo(t);
            setDocumento((d) => mascaraDocumento(d, t));
            limpar("documento");
          }}
        />
        <Campo id="cli-nome" rotulo={tipo === "pj" ? "Razão social" : "Nome completo"} erro={erros.nome}>
          <input
            id="cli-nome"
            data-foco-inicial
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              limpar("nome");
            }}
            autoComplete="off"
            aria-invalid={Boolean(erros.nome)}
            aria-describedby={descrito("cli-nome", erros.nome)}
            className={CLASSE_CAMPO}
          />
        </Campo>
        <Campo
          id="cli-documento"
          rotulo={rotuloDoc}
          opcional
          erro={erros.documento}
          dica={tipo === "pj" ? "Aceita o CNPJ com letras (novo formato)." : undefined}
        >
          <input
            id="cli-documento"
            value={documento}
            onChange={(e) => {
              // PF marcado e digitou mais de 11 posições (ou letra): é CNPJ — troca o tipo sem cortar
              const bruto = normalizarDocumento(e.target.value);
              const virouPJ = tipo === "pf" && (bruto.length > 11 || /[A-Z]/.test(bruto));
              if (virouPJ) setTipo("pj");
              setDocumento(mascaraDocumento(e.target.value, virouPJ ? "pj" : tipo));
              limpar("documento");
              setDuplicadoId(undefined);
            }}
            onBlur={aoSairDoDocumento}
            inputMode={tipo === "pf" ? "numeric" : "text"}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder={tipo === "pj" ? "00.000.000/0000-00" : "000.000.000-00"}
            aria-invalid={Boolean(erros.documento)}
            aria-describedby={descrito("cli-documento", erros.documento, tipo === "pj")}
            className={`${CLASSE_CAMPO} numero`}
          />
          {duplicadoId && erros.documento && (
            <Link to={`/clientes/${duplicadoId}`} onClick={onFechar} className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-semibold text-tinta underline underline-offset-4">
              Abrir o cadastro existente
              <Icone nome="seta" tamanho={14} />
            </Link>
          )}
        </Campo>
      </SecaoForm>

      <SecaoForm titulo="Contato">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="cli-telefone" rotulo="Telefone" opcional erro={erros.telefone}>
            <input
              id="cli-telefone"
              type="tel"
              inputMode="tel"
              value={telefone}
              onChange={(e) => {
                setTelefone(mascaraTelefone(e.target.value));
                limpar("telefone");
              }}
              onBlur={() => !telefoneCompleto(telefone) && setErros((er) => ({ ...er, telefone: ERRO.telefone_invalido }))}
              placeholder="(41) 99999-0000"
              autoComplete="off"
              aria-invalid={Boolean(erros.telefone)}
              aria-describedby={descrito("cli-telefone", erros.telefone)}
              className={`${CLASSE_CAMPO} numero`}
            />
          </Campo>
          <Campo
            id="cli-whatsapp"
            rotulo="WhatsApp"
            erro={erros.whatsapp}
            extra={<Marcador id="cli-whats-igual" rotulo="Igual ao telefone" marcado={whatsIgual} onMudar={(v) => { setWhatsIgual(v); limpar("whatsapp"); }} />}
          >
            <input
              id="cli-whatsapp"
              type="tel"
              inputMode="tel"
              value={whatsIgual ? telefone : whatsapp}
              disabled={whatsIgual}
              onChange={(e) => {
                setWhatsapp(mascaraTelefone(e.target.value));
                limpar("whatsapp");
              }}
              placeholder="(41) 99999-0000"
              autoComplete="off"
              aria-invalid={Boolean(erros.whatsapp)}
              aria-describedby={descrito("cli-whatsapp", erros.whatsapp)}
              className={`${CLASSE_CAMPO} numero`}
            />
          </Campo>
        </div>
        <Campo id="cli-email" rotulo="E-mail" opcional erro={erros.email}>
          <input
            id="cli-email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              limpar("email");
            }}
            placeholder="nome@exemplo.com"
            autoComplete="off"
            aria-invalid={Boolean(erros.email)}
            aria-describedby={descrito("cli-email", erros.email)}
            className={CLASSE_CAMPO}
          />
        </Campo>
      </SecaoForm>

      <SecaoForm titulo="Endereço" descricao="Opcional. Se preencher, informe ao menos CEP, rua e cidade.">
        {(erros.cep || erros.endereco) && (
          <div role="alert" className="-mt-1 flex flex-col gap-1">
            {erros.cep && <MensagemErro id="cli-cep-erro">{erros.cep}</MensagemErro>}
            {erros.endereco && <MensagemErro id="cli-endereco-erro">{erros.endereco}</MensagemErro>}
          </div>
        )}
        <div className="grid gap-4 grid-cols-[112px_minmax(0,1fr)_76px] sm:grid-cols-[132px_minmax(0,1fr)_88px]">
          <Campo id="cli-cep" rotulo="CEP">
            <input
              id="cli-cep"
              inputMode="numeric"
              value={cep}
              onChange={(e) => {
                setCep(mascaraCEP(e.target.value));
                limpar("cep");
                limpar("endereco");
              }}
              onBlur={() => cep.trim() && !normalizarCEP(cep) && setErros((er) => ({ ...er, cep: ERRO.cep_invalido }))}
              placeholder="00000-000"
              autoComplete="off"
              aria-invalid={Boolean(erros.cep)}
              aria-describedby={descrito("cli-cep", erros.cep)}
              className={`${CLASSE_CAMPO} numero`}
            />
          </Campo>
          <Campo id="cli-cidade" rotulo="Cidade">
            <input id="cli-cidade" value={cidade} onChange={(e) => { setCidade(e.target.value); limpar("endereco"); }} autoComplete="off" className={CLASSE_CAMPO} />
          </Campo>
          <Campo id="cli-uf" rotulo="UF">
            <select id="cli-uf" value={uf} onChange={(e) => setUf(e.target.value)} className={`${CLASSE_CAMPO} px-2`}>
              <option value="">—</option>
              {UFS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <div className="grid gap-4 grid-cols-[minmax(0,1fr)_88px]">
          <Campo id="cli-logradouro" rotulo="Rua">
            <input id="cli-logradouro" aria-describedby={erros.endereco ? "cli-endereco-erro" : undefined} value={logradouro} onChange={(e) => { setLogradouro(e.target.value); limpar("endereco"); }} autoComplete="off" className={CLASSE_CAMPO} />
          </Campo>
          <Campo id="cli-numero" rotulo="Número">
            <input id="cli-numero" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="s/n" autoComplete="off" className={`${CLASSE_CAMPO} numero`} />
          </Campo>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="cli-complemento" rotulo="Complemento" opcional>
            <input id="cli-complemento" value={complemento} onChange={(e) => setComplemento(e.target.value)} placeholder="Apto, sala, bloco" autoComplete="off" className={CLASSE_CAMPO} />
          </Campo>
          <Campo id="cli-bairro" rotulo="Bairro">
            <input id="cli-bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} autoComplete="off" className={CLASSE_CAMPO} />
          </Campo>
        </div>
      </SecaoForm>

      <SecaoForm titulo="Observações">
        <Campo id="cli-obs" rotulo="Observações" ocultarRotulo>
          <textarea
            id="cli-obs"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={3}
            placeholder="Ex.: Prefere contato por WhatsApp à tarde."
            className={CLASSE_AREA}
          />
        </Campo>
      </SecaoForm>
    </Gaveta>
  );
}

const ORDEM: (keyof Erros)[] = ["nome", "documento", "telefone", "whatsapp", "email", "cep", "endereco"];
const ID_CAMPO: Record<keyof Erros, string> = {
  documento: "cli-documento",
  nome: "cli-nome",
  telefone: "cli-telefone",
  whatsapp: "cli-whatsapp",
  email: "cli-email",
  cep: "cli-cep",
  endereco: "cli-logradouro",
};

function focarPrimeiro(erros: Erros) {
  const primeiro = ORDEM.find((c) => erros[c]);
  if (primeiro) requestAnimationFrame(() => document.getElementById(ID_CAMPO[primeiro])?.focus());
}

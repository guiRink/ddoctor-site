import { useState } from "react";
import type { Fornecedor } from "@compartilhado/tipos";
import { formatarDocumento } from "@compartilhado/dominio/documento";
import { mensagemErro, useAcoes } from "../../dados/hooks";
import { Gaveta } from "../financeiro/Gaveta";
import { Area, Rotulado, CLASSE_ENTRADA } from "../financeiro/Campos";
import { telefoneBR } from "../agenda/formato";

/** Cadastro e edição de fornecedor (CNPJ/CPF validado no repositório). */
export function FormFornecedor({ fornecedor, onFechar, onFeito }: { fornecedor?: Fornecedor; onFechar: () => void; onFeito: (mensagem: string) => void }) {
  const acoes = useAcoes();
  const [nome, setNome] = useState(fornecedor?.nome ?? "");
  const [documento, setDocumento] = useState(fornecedor?.documento ? formatarDocumento(fornecedor.documento) : "");
  const [telefone, setTelefone] = useState(fornecedor?.telefone ? telefoneBR(fornecedor.telefone) : "");
  const [email, setEmail] = useState(fornecedor?.email ?? "");
  const [obs, setObs] = useState(fornecedor?.obs ?? "");
  const [erro, setErro] = useState<string>();

  async function enviar() {
    setErro(undefined);
    if (!nome.trim()) return setErro(mensagemErro("nome_obrigatorio"));
    try {
      const r = await acoes.salvarFornecedor.mutateAsync([
        {
          id: fornecedor?.id,
          nome: nome.trim(),
          documento: documento.trim() || undefined,
          telefone: telefone.trim() || undefined,
          email: email.trim() || undefined,
          obs: obs.trim() || undefined,
        },
      ]);
      if (!r.ok) return setErro(mensagemErro(r.codigo));
      onFeito(fornecedor ? `${nome.trim()} atualizado.` : `${nome.trim()} cadastrado.`);
    } catch {
      setErro(mensagemErro());
    }
  }

  return (
    <Gaveta
      titulo={fornecedor ? "Editar fornecedor" : "Novo fornecedor"}
      descricao="Usado nas entradas por compra e na lista de reposição."
      acao={fornecedor ? "Salvar alterações" : "Cadastrar fornecedor"}
      onFechar={onFechar}
      onEnviar={enviar}
      enviando={acoes.salvarFornecedor.isPending}
      erro={erro}
    >
      <Rotulado rotulo="Nome">
        <input value={nome} onChange={(e) => setNome(e.target.value)} className={CLASSE_ENTRADA} autoComplete="off" />
      </Rotulado>
      <Rotulado rotulo="CNPJ ou CPF" opcional>
        <input value={documento} onChange={(e) => setDocumento(e.target.value)} className={`${CLASSE_ENTRADA} numero`} inputMode="numeric" autoComplete="off" />
      </Rotulado>
      <div className="grid grid-cols-2 gap-3">
        <Rotulado rotulo="Telefone" opcional>
          <input value={telefone} onChange={(e) => setTelefone(e.target.value)} className={`${CLASSE_ENTRADA} numero`} inputMode="tel" autoComplete="off" placeholder="(41) 3300-0000" />
        </Rotulado>
        <Rotulado rotulo="E-mail" opcional>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={CLASSE_ENTRADA} autoComplete="off" />
        </Rotulado>
      </div>
      <Rotulado rotulo="Observação" opcional dica="Ex.: prazo de entrega, vendedor, condição de pagamento.">
        <Area value={obs} onChange={(e) => setObs(e.target.value)} />
      </Rotulado>
    </Gaveta>
  );
}

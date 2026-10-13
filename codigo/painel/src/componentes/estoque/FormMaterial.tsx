import { useId, useState } from "react";
import type { Fornecedor, Id, Material } from "@compartilhado/tipos";
import { formatarReais, reaisParaCentavos } from "@compartilhado/dominio/dinheiro";
import { mensagemErro, useAcoes } from "../../dados/hooks";
import { Gaveta } from "../ui/Gaveta";
import { CLASSE_ENTRADA, CampoComAfixo, Rotulado, Selecao } from "../ui/Campos";
import { formatarQtd, lerQuantidade } from "../financeiro/formato";

const UNIDADES = ["un", "L", "mL", "kg", "g", "folha", "rolo", "m", "par", "caixa"];

/** Cadastro e edição de material. Saldo inicial só na criação; depois, saldo e custo mudam por movimentação. */
export function FormMaterial({
  material,
  materiais,
  fornecedores,
  veDinheiro,
  onFechar,
  onFeito,
}: {
  material?: Material;
  materiais: Material[];
  fornecedores: Fornecedor[];
  veDinheiro: boolean;
  onFechar: () => void;
  onFeito: (mensagem: string) => void;
}) {
  const acoes = useAcoes();
  const idCategorias = useId();
  const idUnidades = useId();
  const editando = Boolean(material);
  const [nome, setNome] = useState(material?.nome ?? "");
  const [codigo, setCodigo] = useState(material?.codigo ?? "");
  const [marca, setMarca] = useState(material?.marca ?? "");
  const [categoria, setCategoria] = useState(material?.categoria ?? "");
  const [unidade, setUnidade] = useState(material?.unidade ?? "");
  const [minimo, setMinimo] = useState(material ? formatarQtd(material.saldoMinimo) : "");
  const [fornecedorId, setFornecedorId] = useState<Id>(material?.fornecedorId ?? "");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [custoInicial, setCustoInicial] = useState("");
  const [ativo, setAtivo] = useState(material?.ativo !== false);
  const [erro, setErro] = useState<string>();

  const categorias = [...new Set(materiais.map((m) => m.categoria))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  async function enviar() {
    setErro(undefined);
    if (!nome.trim()) return setErro(mensagemErro("nome_obrigatorio"));
    if (!unidade.trim()) return setErro(mensagemErro("unidade_obrigatoria"));
    const min = minimo.trim() ? lerQuantidade(minimo) : 0;
    if (min === null || min < 0) return setErro("Informe o estoque mínimo (0 se não houver).");
    const saldo = saldoInicial.trim() ? lerQuantidade(saldoInicial) : 0;
    if (saldo === null || saldo < 0) return setErro("Saldo inicial inválido.");
    const custo = custoInicial.trim() ? reaisParaCentavos(custoInicial) : 0;
    if (custo === null || custo < 0) return setErro("Custo unitário inválido.");
    const dados = {
      ...(material ? { ultimaConferenciaEm: material.ultimaConferenciaEm } : {}),
      id: material?.id,
      nome: nome.trim(),
      codigo: codigo.trim() || undefined,
      marca: marca.trim() || undefined,
      categoria: categoria.trim() || "Outros",
      unidade: unidade.trim(),
      saldoMinimo: min,
      fornecedorId: fornecedorId || undefined,
      ativo,
      ...(editando ? {} : { saldoEstimado: saldo, custoMedio: custo }),
    };
    try {
      const r = await acoes.salvarMaterial.mutateAsync([dados]);
      if (!r.ok) return setErro(mensagemErro(r.codigo));
      onFeito(editando ? `${dados.nome} atualizado.` : `${dados.nome} cadastrado.`);
    } catch {
      setErro(mensagemErro());
    }
  }

  return (
    <Gaveta
      titulo={editando ? "Editar material" : "Novo material"}
      descricao={
        editando
          ? "Saldo e custo médio mudam só por entrada, retirada ou ajuste."
          : "Cadastre o material uma vez; depois as compras e retiradas atualizam o saldo."
      }
      acao={editando ? "Salvar alterações" : "Cadastrar material"}
      onFechar={onFechar}
      onEnviar={enviar}
      enviando={acoes.salvarMaterial.isPending}
      erro={erro}
    >
      <Rotulado rotulo="Nome">
        <input value={nome} onChange={(e) => setNome(e.target.value)} className={CLASSE_ENTRADA} autoComplete="off" placeholder="Ex.: Lixa P1500" />
      </Rotulado>

      <div className="grid grid-cols-2 gap-3">
        <Rotulado rotulo="Código" opcional>
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} className={CLASSE_ENTRADA} autoComplete="off" />
        </Rotulado>
        <Rotulado rotulo="Marca" opcional>
          <input value={marca} onChange={(e) => setMarca(e.target.value)} className={CLASSE_ENTRADA} autoComplete="off" />
        </Rotulado>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Rotulado rotulo="Categoria">
          <input list={idCategorias} value={categoria} onChange={(e) => setCategoria(e.target.value)} className={CLASSE_ENTRADA} autoComplete="off" placeholder="Escolha ou digite" />
          <datalist id={idCategorias}>
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Rotulado>
        <Rotulado rotulo="Unidade">
          <input list={idUnidades} value={unidade} onChange={(e) => setUnidade(e.target.value)} className={CLASSE_ENTRADA} autoComplete="off" placeholder="un, L, kg…" />
          <datalist id={idUnidades}>
            {UNIDADES.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </Rotulado>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Rotulado rotulo="Estoque mínimo" dica="Abaixo disso entra na reposição.">
          <CampoComAfixo inputMode="decimal" autoComplete="off" value={minimo} onChange={(e) => setMinimo(e.target.value)} sufixo={unidade || undefined} placeholder="0" />
        </Rotulado>
        <Rotulado rotulo="Fornecedor" opcional>
          <Selecao value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
            <option value="">Sem fornecedor</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Selecao>
        </Rotulado>
      </div>

      {!editando && (
        <section className="flex flex-col gap-3 pt-4 border-t border-linha">
          <h3 className="text-[14px] font-semibold">Saldo inicial</h3>
          <p className="-mt-2 text-[13px] text-tinta-suave">O que já existe na prateleira hoje. Entra no extrato como “saldo inicial no cadastro”.</p>
          <div className="grid grid-cols-2 gap-3">
            <Rotulado rotulo="Quantidade" opcional>
              <CampoComAfixo inputMode="decimal" autoComplete="off" value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} sufixo={unidade || undefined} placeholder="0" />
            </Rotulado>
            {veDinheiro && (
              <Rotulado rotulo="Custo unitário" opcional dica="Vira o custo médio inicial.">
                <CampoComAfixo inputMode="decimal" autoComplete="off" prefixo="R$" value={custoInicial} onChange={(e) => setCustoInicial(e.target.value)} placeholder="0,00" />
              </Rotulado>
            )}
          </div>
        </section>
      )}

      {editando && material && (
        <section className="flex flex-col gap-3 pt-4 border-t border-linha">
          <dl className="m-0 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-[13px] font-medium text-tinta-suave">Saldo atual</dt>
              <dd className="m-0 mt-1 numero font-semibold">
                {formatarQtd(material.saldoEstimado)} {material.unidade}
              </dd>
            </div>
            {veDinheiro && (
              <div>
                <dt className="text-[13px] font-medium text-tinta-suave">Custo médio</dt>
                <dd className="m-0 mt-1 numero font-semibold">{formatarReais(material.custoMedio)}</dd>
              </div>
            )}
          </dl>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="mt-1 w-4 h-4" />
            <span>
              <span className="block text-[14px] font-medium">Material ativo</span>
              <span className="block text-[13px] text-tinta-suave">Inativo não aparece nas retiradas nem na reposição; o histórico fica.</span>
            </span>
          </label>
        </section>
      )}
    </Gaveta>
  );
}

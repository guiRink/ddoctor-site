import { useState } from "react";
import type { Fornecedor, Id, Material } from "@compartilhado/tipos";
import { custoMedioPonderado } from "@compartilhado/dominio/estoque";
import { formatarReais, reaisParaCentavos } from "@compartilhado/dominio/dinheiro";
import { mensagemErro, useAcoes } from "../../dados/hooks";
import { Gaveta } from "../ui/Gaveta";
import { AreaTexto, CLASSE_ENTRADA, CampoComAfixo, LinhaPrevia, Previa, Rotulado, Selecao } from "../ui/Campos";
import { formatarQtd, lerQuantidade, marcoDoDia } from "../financeiro/formato";
import { centavosParaCampo } from "../gestao/formato";
import { OpcoesMateriais } from "./OpcoesMateriais";

/** Entrada por compra: quantidade, custo unitário, fornecedor e data; prévia do novo custo médio. */
export function FormEntrada({
  materiais,
  fornecedores,
  materialInicial,
  hoje,
  veDinheiro,
  onFechar,
  onFeito,
}: {
  materiais: Material[];
  fornecedores: Fornecedor[];
  materialInicial?: Id;
  hoje: string;
  veDinheiro: boolean;
  onFechar: () => void;
  onFeito: (mensagem: string) => void;
}) {
  const acoes = useAcoes();
  const inicial = materiais.find((m) => m.id === materialInicial);
  const [materialId, setMaterialId] = useState<Id>(inicial?.id ?? "");
  const [quantidade, setQuantidade] = useState("");
  const [custo, setCusto] = useState(inicial ? centavosParaCampo(inicial.custoMedio) : "");
  const [fornecedorId, setFornecedorId] = useState<Id>(inicial?.fornecedorId ?? "");
  const [data, setData] = useState(hoje);
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState<string>();

  const material = materiais.find((m) => m.id === materialId);
  const q = lerQuantidade(quantidade);
  const c = custo.trim() ? reaisParaCentavos(custo) : null;
  const valida = material && q !== null && q > 0 && c !== null && c >= 0;

  function escolherMaterial(id: Id) {
    setMaterialId(id);
    const m = materiais.find((x) => x.id === id);
    if (m) {
      if (!custo.trim()) setCusto(centavosParaCampo(m.custoMedio));
      if (!fornecedorId && m.fornecedorId) setFornecedorId(m.fornecedorId);
    }
  }

  async function enviar() {
    setErro(undefined);
    if (!material) return setErro("Escolha o material.");
    if (q === null || q <= 0) return setErro(mensagemErro("quantidade_invalida"));
    if (c === null || c < 0) return setErro(mensagemErro("custo_obrigatorio"));
    if (!data || data > hoje) return setErro("Informe a data da compra (hoje ou antes).");
    try {
      const r = await acoes.movimentarEstoque.mutateAsync([
        {
          tipo: "entrada_compra",
          materialId: material.id,
          quantidade: q,
          custoUnitario: c,
          fornecedorId: fornecedorId || undefined,
          obs: obs.trim() || undefined,
          em: marcoDoDia(data, hoje),
        },
      ]);
      if (!r.ok) return setErro(mensagemErro(r.codigo));
      onFeito(`Entrada de ${formatarQtd(q)} ${material.unidade} de ${material.nome} registrada.`);
    } catch {
      setErro(mensagemErro());
    }
  }

  return (
    <Gaveta
      titulo="Entrada por compra"
      descricao="Soma ao saldo e recalcula o custo médio ponderado do material."
      acao="Registrar entrada"
      onFechar={onFechar}
      onEnviar={enviar}
      enviando={acoes.movimentarEstoque.isPending}
      erro={erro}
    >
      <Rotulado rotulo="Material">
        <Selecao value={materialId} onChange={(e) => escolherMaterial(e.target.value)} required>
          <option value="">Escolha o material…</option>
          <OpcoesMateriais materiais={materiais.filter((m) => m.ativo !== false || m.id === materialId)} />
        </Selecao>
      </Rotulado>

      <div className="grid grid-cols-2 gap-3">
        <Rotulado rotulo="Quantidade">
          <CampoComAfixo
            inputMode="decimal"
            autoComplete="off"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            sufixo={material?.unidade}
            placeholder="0"
          />
        </Rotulado>
        <Rotulado rotulo="Custo unitário">
          <CampoComAfixo inputMode="decimal" autoComplete="off" prefixo="R$" value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="0,00" />
        </Rotulado>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_168px] gap-3">
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
        <Rotulado rotulo="Data da compra">
          <input type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value)} className={`${CLASSE_ENTRADA} numero`} />
        </Rotulado>
      </div>

      <Rotulado rotulo="Observação" opcional dica="Ex.: número da nota fiscal.">
        <AreaTexto value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
      </Rotulado>

      {material && (
        <Previa titulo="Depois da entrada">
          <LinhaPrevia rotulo="Saldo">
            <span className="text-tinta-suave">{formatarQtd(material.saldoEstimado)}</span>
            {" → "}
            <strong className="font-semibold">
              {valida ? formatarQtd(material.saldoEstimado + q!) : "—"} {material.unidade}
            </strong>
          </LinhaPrevia>
          {veDinheiro && (
            <>
              <LinhaPrevia rotulo="Custo médio">
                <span className="text-tinta-suave">{formatarReais(material.custoMedio)}</span>
                {" → "}
                <strong className="font-semibold">
                  {valida ? formatarReais(custoMedioPonderado(material.saldoEstimado, material.custoMedio, q!, c!)) : "—"}
                </strong>
              </LinhaPrevia>
              <LinhaPrevia rotulo="Total da compra" forte>
                {valida ? formatarReais(Math.round(q! * c!)) : "—"}
              </LinhaPrevia>
            </>
          )}
        </Previa>
      )}
    </Gaveta>
  );
}

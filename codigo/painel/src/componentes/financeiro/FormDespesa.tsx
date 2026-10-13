import { useId, useState } from "react";
import type { CategoriaFinanceira, FormaPagamento, Fornecedor } from "@compartilhado/tipos";
import { formatarReais, reaisParaCentavos } from "@compartilhado/dominio/dinheiro";
import { mensagemErro, useAcoes } from "../../dados/hooks";
import { FORMA_PAGAMENTO } from "../../dominio/rotulos";
import { Gaveta } from "../ui/Gaveta";
import { AreaTexto, CLASSE_ENTRADA, CampoComAfixo, Rotulado, Selecao } from "../ui/Campos";
import { FORMAS_DESPESA } from "./modelo";

/** Lançamento de despesa (a pagar ou já paga). Categorias vêm de Ajustes (tipo despesa, ativas). */
export function FormDespesa({
  categorias,
  fornecedores,
  hoje,
  onFechar,
  onFeito,
}: {
  categorias: CategoriaFinanceira[];
  fornecedores: Fornecedor[];
  hoje: string;
  onFechar: () => void;
  onFeito: (mensagem: string) => void;
}) {
  const acoes = useAcoes();
  const idFornecedores = useId();
  const opcoes = categorias.filter((c) => c.tipo === "despesa" && c.ativa).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState(hoje);
  const [paga, setPaga] = useState(false);
  const [pagoEm, setPagoEm] = useState(hoje);
  const [forma, setForma] = useState<FormaPagamento | "">("");
  const [fornecedor, setFornecedor] = useState("");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState<string>();

  async function enviar() {
    setErro(undefined);
    if (!descricao.trim()) return setErro(mensagemErro("descricao_obrigatoria"));
    if (!categoriaId) return setErro(mensagemErro("categoria_invalida"));
    const centavos = reaisParaCentavos(valor);
    if (centavos === null || centavos <= 0) return setErro(mensagemErro("valor_invalido"));
    if (!vencimento) return setErro("Informe o vencimento.");
    if (paga && (!pagoEm || pagoEm > hoje)) return setErro("Informe a data do pagamento (hoje ou antes).");
    if (paga && !forma) return setErro(mensagemErro("forma_invalida"));
    try {
      const r = await acoes.criarDespesa.mutateAsync([
        {
          descricao: descricao.trim(),
          categoriaId,
          valorPrevisto: centavos,
          vencimento,
          pagoEm: paga ? pagoEm : undefined,
          valorPago: paga ? centavos : undefined,
          formaPagamento: paga && forma ? forma : undefined,
          fornecedor: fornecedor.trim() || undefined,
          obs: obs.trim() || undefined,
        },
      ]);
      if (!r.ok) return setErro(mensagemErro(r.codigo));
      onFeito(`Despesa “${descricao.trim()}” de ${formatarReais(centavos)} lançada${paga ? " como paga" : ""}.`);
    } catch {
      setErro(mensagemErro());
    }
  }

  return (
    <Gaveta
      titulo="Nova despesa"
      descricao="Conta a pagar da oficina. Marque como paga se já saiu do caixa."
      acao="Lançar despesa"
      onFechar={onFechar}
      onEnviar={enviar}
      enviando={acoes.criarDespesa.isPending}
      erro={erro}
    >
      <Rotulado rotulo="Descrição">
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className={CLASSE_ENTRADA} autoComplete="off" placeholder="Ex.: Conta de energia" />
      </Rotulado>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Rotulado rotulo="Categoria" dica="As categorias ficam em Ajustes.">
          <Selecao value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            <option value="">Escolha…</option>
            {opcoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Selecao>
        </Rotulado>
        <Rotulado rotulo="Valor">
          <CampoComAfixo inputMode="decimal" autoComplete="off" prefixo="R$" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
        </Rotulado>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[168px_minmax(0,1fr)] gap-3">
        <Rotulado rotulo="Vencimento">
          <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className={`${CLASSE_ENTRADA} numero`} />
        </Rotulado>
        <Rotulado rotulo="Fornecedor" opcional>
          <input list={idFornecedores} value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} className={CLASSE_ENTRADA} autoComplete="off" />
          <datalist id={idFornecedores}>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.nome} />
            ))}
          </datalist>
        </Rotulado>
      </div>

      <section className={`rounded-cartao border ${paga ? "border-linha-forte" : "border-linha"} px-4 py-3 flex flex-col gap-3`}>
        <label className="flex items-center gap-3 cursor-pointer min-h-8">
          <input type="checkbox" checked={paga} onChange={(e) => setPaga(e.target.checked)} className="w-4 h-4" />
          <span className="text-[14px] font-medium">Já foi paga</span>
        </label>
        {paga && (
          <div className="grid grid-cols-1 sm:grid-cols-[168px_minmax(0,1fr)] gap-3">
            <Rotulado rotulo="Pago em">
              <input type="date" value={pagoEm} max={hoje} onChange={(e) => setPagoEm(e.target.value)} className={`${CLASSE_ENTRADA} numero`} />
            </Rotulado>
            <Rotulado rotulo="Forma de pagamento" dica={forma === "dinheiro" ? "Entra no fechamento de caixa do dia." : undefined}>
              <Selecao value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento | "")}>
                <option value="">Escolha…</option>
                {FORMAS_DESPESA.map((f) => (
                  <option key={f} value={f}>
                    {FORMA_PAGAMENTO[f]}
                  </option>
                ))}
              </Selecao>
            </Rotulado>
          </div>
        )}
      </section>

      <Rotulado rotulo="Observação" opcional>
        <AreaTexto value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
      </Rotulado>
    </Gaveta>
  );
}

import { useState } from "react";
import type { Despesa, FormaPagamento } from "@compartilhado/tipos";
import { formatarReais, reaisParaCentavos } from "@compartilhado/dominio/dinheiro";
import { mensagemErro, useAcoes } from "../../dados/hooks";
import { FORMA_PAGAMENTO } from "../../dominio/rotulos";
import { centavosParaCampo, dataComSemana } from "../gestao/formato";
import { Etiqueta } from "../ui/Estado";
import { Gaveta } from "./Gaveta";
import { EntradaComAfixo, LinhaPrevia, Previa, Rotulado, CLASSE_ENTRADA } from "./Campos";
import { FORMAS_DESPESA, SITUACAO_DESPESA, prazoDespesa, situacaoDespesa } from "./modelo";

/** Baixa de uma despesa: valor pago, data e forma (dinheiro entra no caixa do dia). */
export function FormPagar({ despesa: d, hoje, onFechar, onFeito }: { despesa: Despesa; hoje: string; onFechar: () => void; onFeito: (m: string) => void }) {
  const acoes = useAcoes();
  const [valor, setValor] = useState(centavosParaCampo(d.valorPrevisto));
  const [data, setData] = useState(hoje);
  const [forma, setForma] = useState<FormaPagamento | "">("");
  const [erro, setErro] = useState<string>();
  const s = situacaoDespesa(d, hoje);

  async function enviar() {
    setErro(undefined);
    const centavos = reaisParaCentavos(valor);
    if (centavos === null || centavos <= 0) return setErro(mensagemErro("valor_invalido"));
    if (!data || data > hoje) return setErro("Informe a data do pagamento (hoje ou antes).");
    if (!forma) return setErro(mensagemErro("forma_invalida"));
    try {
      const r = await acoes.pagarDespesa.mutateAsync([d.id, centavos, data, forma]);
      if (!r.ok) return setErro(mensagemErro(r.codigo));
      onFeito(`“${d.descricao}” paga: ${formatarReais(centavos)} em ${FORMA_PAGAMENTO[forma].toLowerCase()}.`);
    } catch {
      setErro(mensagemErro());
    }
  }

  return (
    <Gaveta titulo="Pagar despesa" descricao={d.descricao} acao="Confirmar pagamento" onFechar={onFechar} onEnviar={enviar} enviando={acoes.pagarDespesa.isPending} erro={erro}>
      <Previa>
        <LinhaPrevia rotulo="Categoria">{d.categoria}</LinhaPrevia>
        {d.fornecedor && <LinhaPrevia rotulo="Fornecedor">{d.fornecedor}</LinhaPrevia>}
        <LinhaPrevia rotulo="Vencimento">
          {dataComSemana(d.vencimento)}{" "}
          <Etiqueta tom={SITUACAO_DESPESA[s].tom} className="ml-1 align-middle">
            {s === "a_vencer" ? prazoDespesa(d, hoje) : SITUACAO_DESPESA[s].texto}
          </Etiqueta>
        </LinhaPrevia>
        <LinhaPrevia rotulo="Valor previsto" forte>
          {formatarReais(d.valorPrevisto)}
        </LinhaPrevia>
      </Previa>

      <div className="grid grid-cols-2 gap-3">
        <Rotulado rotulo="Valor pago">
          <EntradaComAfixo inputMode="decimal" autoComplete="off" prefixo="R$" value={valor} onChange={(e) => setValor(e.target.value)} />
        </Rotulado>
        <Rotulado rotulo="Pago em">
          <input type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value)} className={`${CLASSE_ENTRADA} numero`} />
        </Rotulado>
      </div>

      <fieldset className="border-0 p-0 m-0 min-w-0">
        <legend className="text-[13px] font-medium text-tinta-suave mb-1.5">Forma de pagamento</legend>
        <div className="grid grid-cols-2 gap-2">
          {FORMAS_DESPESA.map((f) => (
            <label
              key={f}
              className={`flex items-center gap-2.5 h-11 md:h-10 px-3 rounded-controle border cursor-pointer transition-colors duration-150 ${
                forma === f ? "border-tinta bg-cinza-50" : "border-linha-forte hover:border-tinta-fraca"
              }`}
            >
              <input type="radio" name="forma-pagar" value={f} checked={forma === f} onChange={() => setForma(f)} />
              <span className="text-[14px] font-medium">{FORMA_PAGAMENTO[f]}</span>
            </label>
          ))}
        </div>
        {forma === "dinheiro" && <p className="mt-2 text-[12px] text-tinta-fraca">Pagamento em dinheiro entra como saída no fechamento de caixa do dia.</p>}
      </fieldset>
    </Gaveta>
  );
}

import { useState, type FormEvent } from "react";
import type { Despesa, FechamentoCaixa, Perfil, TituloReceber } from "@compartilhado/tipos";
import { calcularFechamento, valorPagoDespesa } from "@compartilhado/dominio/caixa";
import { formatarReais, reaisParaCentavos } from "@compartilhado/dominio/dinheiro";
import { normalizarFormaPagamento } from "@compartilhado/dominio/pagamentos";
import { mensagemErro, useAcoes } from "../../dados/hooks";
import { Botao, Cartao, Responsavel, SUPERFICIE, Vazio } from "../ui/Basicos";
import { CLASSE_LINHA, Td, Th } from "../ui/Tabela";
import { Retorno } from "../gestao/Comuns";
import { centavosParaCampo, dataComSemana } from "../gestao/formato";
import { Area, EntradaComAfixo, Rotulado, CLASSE_ENTRADA } from "./Campos";
import { horaDoMarco } from "./formato";

/** Fechamento de caixa do dia (só dinheiro em espécie) + fechamentos recentes. */
export function AbaCaixa({
  titulos,
  despesas,
  fechamentos,
  perfis,
  hoje,
  podeFechar,
}: {
  titulos: TituloReceber[];
  despesas: Despesa[];
  fechamentos: FechamentoCaixa[];
  perfis: Perfil[];
  hoje: string;
  podeFechar: boolean;
}) {
  const [data, setData] = useState(hoje);
  const fechado = fechamentos.find((f) => f.data === data);
  const pes = new Map(perfis.map((p) => [p.id, p.nome]));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-start">
      <section aria-labelledby="caixa-titulo" className={`${SUPERFICIE} overflow-hidden`}>
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-5 py-3 border-b border-linha">
          <h2 id="caixa-titulo" className="text-[14px] font-semibold">
            Fechamento de caixa
          </h2>
          <label className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-tinta-suave">Dia</span>
            <input type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value || hoje)} className={`${CLASSE_ENTRADA} md:h-9 w-[160px] numero`} />
          </label>
        </header>
        {fechado ? (
          <Fechado f={fechado} nome={fechado.fechadoPor ? pes.get(fechado.fechadoPor) : undefined} />
        ) : (
          <FormFechamento key={data} data={data} hoje={hoje} titulos={titulos} despesas={despesas} fechamentos={fechamentos} podeFechar={podeFechar} />
        )}
      </section>

      <Cartao titulo="Fechamentos recentes" contagem={fechamentos.length}>
        {fechamentos.length === 0 ? (
          <Vazio icone="relogio" titulo="Nenhum caixa fechado ainda" texto="Ao fim do dia, conte o dinheiro da gaveta e feche o caixa: a diferença fica registrada aqui." />
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[14px]">
            <caption className="sr-only">Fechamentos de caixa recentes</caption>
            <thead>
              <tr>
                <Th>Dia</Th>
                <Th direita>Esperado</Th>
                <Th direita>Contado</Th>
                <Th direita>Diferença</Th>
                <Th className="hidden md:table-cell">Fechado por</Th>
              </tr>
            </thead>
            <tbody>
              {fechamentos.slice(0, 15).map((f) => (
                <tr key={f.id} className={`${CLASSE_LINHA} ${f.data === data ? "bg-cinza-50" : ""}`}>
                  <Td className="whitespace-nowrap numero">
                    <button
                      type="button"
                      onClick={() => setData(f.data)}
                      aria-label={`Ver o fechamento de ${dataComSemana(f.data)}`}
                      className="font-medium hover:underline underline-offset-4 text-left"
                    >
                      {dataComSemana(f.data)}
                    </button>
                    {f.obs && (
                      <span className="block text-[12px] text-tinta-suave max-w-[220px] truncate whitespace-normal" title={f.obs}>
                        {f.obs}
                      </span>
                    )}
                  </Td>
                  <Td numero className="text-tinta-suave">
                    {formatarReais(f.esperado)}
                  </Td>
                  <Td numero>{formatarReais(f.contado)}</Td>
                  <Td numero>
                    <Diferenca valor={f.diferenca} curta />
                  </Td>
                  <Td className="hidden md:table-cell">{f.fechadoPor ? <Responsavel nome={pes.get(f.fechadoPor)} /> : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Cartao>
    </div>
  );
}

function Diferenca({ valor, curta = false }: { valor: number; curta?: boolean }) {
  if (valor === 0) return <span className="font-semibold text-ok">{curta ? "R$ 0,00" : "Sem diferença"}</span>;
  if (valor < 0)
    return (
      <span className="font-semibold text-alerta">
        {curta ? "−" : "Falta "}
        {formatarReais(-valor)}
      </span>
    );
  return (
    <span className="font-semibold text-atencao">
      {curta ? "+" : "Sobra "}
      {formatarReais(valor)}
    </span>
  );
}

function LinhaConta({ rotulo, valor, sinal, forte = false, dica }: { rotulo: string; valor: number; sinal?: "+" | "−"; forte?: boolean; dica?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-2 ${forte ? "border-t border-linha mt-1 pt-3" : ""}`}>
      <dt className="text-[14px] text-tinta-suave">
        {rotulo}
        {dica && <span className="block text-[12px] text-tinta-fraca">{dica}</span>}
      </dt>
      <dd className={`m-0 numero whitespace-nowrap ${forte ? "text-[18px] font-semibold" : "text-[15px]"}`}>
        {sinal && <span className="text-tinta-fraca mr-1">{sinal}</span>}
        {formatarReais(valor)}
      </dd>
    </div>
  );
}

function FormFechamento({
  data,
  hoje,
  titulos,
  despesas,
  fechamentos,
  podeFechar,
}: {
  data: string;
  hoje: string;
  titulos: TituloReceber[];
  despesas: Despesa[];
  fechamentos: FechamentoCaixa[];
  podeFechar: boolean;
}) {
  const acoes = useAcoes();
  const anterior = fechamentos.filter((f) => f.data < data).sort((a, b) => b.data.localeCompare(a.data))[0];
  const sugerido = anterior?.contado ?? 0;
  const [inicial, setInicial] = useState(centavosParaCampo(sugerido));
  const [contado, setContado] = useState("");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState<string>();
  const [ok, setOk] = useState<string>();

  const baixas = titulos.flatMap((t) => t.baixas.map((b) => ({ b, t })));
  const saldoInicial = reaisParaCentavos(inicial) ?? 0;
  const contadoC = contado.trim() ? reaisParaCentavos(contado) : null;
  const calc = calcularFechamento({ saldoInicial, contado: contadoC ?? 0, baixas: baixas.map((x) => x.b), despesas, data });
  const entradasDia = baixas.filter(({ b }) => b.recebidoEm === data && normalizarFormaPagamento(b.forma) === "dinheiro");
  const saidasDia = despesas.filter((d) => d.pagoEm === data && d.formaPagamento === "dinheiro");

  async function fechar(e: FormEvent) {
    e.preventDefault();
    setErro(undefined);
    const si = reaisParaCentavos(inicial);
    if (si === null || si < 0) return setErro("Informe o saldo inicial da gaveta (0 se vazia).");
    if (contadoC === null || contadoC < 0) return setErro("Conte o dinheiro da gaveta e informe o valor contado.");
    try {
      const r = await acoes.fecharCaixa.mutateAsync([{ data, contado: contadoC, saldoInicial: si, obs: obs.trim() || undefined }]);
      if (!r.ok) return setErro(mensagemErro(r.codigo));
      setOk("Caixa fechado.");
    } catch {
      setErro(mensagemErro());
    }
  }

  return (
    <form onSubmit={fechar} aria-label={`Fechamento de caixa de ${dataComSemana(data)}`} className="px-4 md:px-5 py-4 flex flex-col gap-4">
      <p className="text-[13px] text-tinta-suave">
        Só dinheiro em espécie. Pix, cartão e boleto não passam pela gaveta e ficam fora da conta.
      </p>

      <Rotulado
        rotulo="Saldo inicial da gaveta"
        dica={anterior ? `Sugerido: o contado no fechamento de ${dataComSemana(anterior.data)}.` : "Nenhum fechamento anterior: comece pelo troco deixado na gaveta."}
      >
        <EntradaComAfixo inputMode="decimal" autoComplete="off" prefixo="R$" value={inicial} onChange={(e) => setInicial(e.target.value)} disabled={!podeFechar} />
      </Rotulado>

      <dl className="m-0 flex flex-col">
        <LinhaConta rotulo="Entradas em dinheiro" sinal="+" valor={calc.entradasDinheiro} dica={`${entradasDia.length} ${entradasDia.length === 1 ? "recebimento" : "recebimentos"}`} />
        <LinhaConta rotulo="Saídas em dinheiro" sinal="−" valor={calc.saidasDinheiro} dica={`${saidasDia.length} ${saidasDia.length === 1 ? "despesa paga" : "despesas pagas"}`} />
        <LinhaConta rotulo="Esperado na gaveta" valor={calc.esperado} forte />
      </dl>

      {(entradasDia.length > 0 || saidasDia.length > 0) && (
        <details className="group rounded-cartao border border-linha bg-cinza-50">
          <summary className="cursor-pointer select-none px-3 h-10 flex items-center text-[13px] font-medium text-tinta-suave hover:text-tinta">
            Ver movimentos em dinheiro do dia
          </summary>
          <ul className="px-3 pb-2">
            {entradasDia.map(({ b, t }) => (
              <li key={b.id} className="flex items-baseline justify-between gap-3 py-1.5 border-t border-linha text-[13px]">
                <span className="min-w-0 truncate">{t.descricao}</span>
                <span className="numero text-ok whitespace-nowrap">+{formatarReais(b.valor)}</span>
              </li>
            ))}
            {saidasDia.map((d) => (
              <li key={d.id} className="flex items-baseline justify-between gap-3 py-1.5 border-t border-linha text-[13px]">
                <span className="min-w-0 truncate">{d.descricao}</span>
                <span className="numero whitespace-nowrap">−{formatarReais(valorPagoDespesa(d))}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {podeFechar ? (
        <>
          <Rotulado rotulo="Contado na gaveta">
            <EntradaComAfixo inputMode="decimal" autoComplete="off" prefixo="R$" value={contado} onChange={(e) => setContado(e.target.value)} placeholder="0,00" className="text-[16px]" />
          </Rotulado>

          <div
            className={`flex items-center justify-between gap-3 px-4 h-14 rounded-cartao border ${
              contadoC === null ? "border-linha bg-cinza-50" : calc.diferenca === 0 ? "border-ok/25 bg-ok-claro" : calc.diferenca < 0 ? "border-alerta/25 bg-alerta-claro" : "border-atencao/25 bg-atencao-claro"
            }`}
            aria-live="polite"
          >
            <span className="text-[14px] font-medium">Diferença</span>
            <span className="numero text-[18px]">{contadoC === null ? <span className="text-tinta-fraca">—</span> : <Diferenca valor={calc.diferenca} />}</span>
          </div>

          <Rotulado rotulo="Observação" opcional dica={contadoC !== null && calc.diferenca !== 0 ? "Explique a diferença (ex.: troco errado)." : undefined}>
            <Area value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </Rotulado>

          <div className="flex flex-col gap-2">
            <Retorno erro={erro} ok={ok} />
            <Botao type="submit" variante="primario" disabled={acoes.fecharCaixa.isPending} className="w-full md:w-auto md:self-end">
              {acoes.fecharCaixa.isPending ? "Fechando…" : `Fechar caixa de ${data === hoje ? "hoje" : dataComSemana(data)}`}
            </Botao>
          </div>
        </>
      ) : (
        <p className="text-[13px] text-tinta-suave">O fechamento é feito pelo dono ou pelo financeiro.</p>
      )}
    </form>
  );
}

function Fechado({ f, nome }: { f: FechamentoCaixa; nome?: string }) {
  return (
    <div className="px-4 md:px-5 py-4 flex flex-col gap-4">
      <p className="flex items-center gap-2 text-[14px]">
        <span className="inline-block w-2 h-2 rounded-full bg-ok" aria-hidden="true" />
        Caixa de <strong className="font-semibold">{dataComSemana(f.data)}</strong> fechado
        {nome && <> por {nome}</>} às <span className="numero">{horaDoMarco(f.fechadoEm)}</span>.
      </p>
      <dl className="m-0 flex flex-col">
        <LinhaConta rotulo="Saldo inicial" valor={f.saldoInicial} />
        <LinhaConta rotulo="Entradas em dinheiro" sinal="+" valor={f.entradasDinheiro} />
        <LinhaConta rotulo="Saídas em dinheiro" sinal="−" valor={f.saidasDinheiro} />
        <LinhaConta rotulo="Esperado" valor={f.esperado} forte />
        <LinhaConta rotulo="Contado" valor={f.contado} />
      </dl>
      <div
        className={`flex items-center justify-between gap-3 px-4 h-14 rounded-cartao border ${
          f.diferenca === 0 ? "border-ok/25 bg-ok-claro" : f.diferenca < 0 ? "border-alerta/25 bg-alerta-claro" : "border-atencao/25 bg-atencao-claro"
        }`}
      >
        <span className="text-[14px] font-medium">Diferença</span>
        <span className="numero text-[18px]">
          <Diferenca valor={f.diferenca} />
        </span>
      </div>
      {f.obs && <p className="text-[14px] text-tinta-suave break-words">“{f.obs}”</p>}
    </div>
  );
}

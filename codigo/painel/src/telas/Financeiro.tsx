import { formatISO } from "date-fns";
import { useAtendimentos } from "../dados/hooks";
import { aReceberEmAberto, custoTotal, diasEntre, formatarReais, receitaPrevista } from "../dominio/regras";
import type { Atendimento } from "../dominio/tipos";
import { Cabecalho, Carregando } from "../componentes/Pagina";
import { Vazio } from "../componentes/Vazio";

function Numero({ nome, valor, destaque }: { nome: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`border border-linha p-4 ${destaque ? "bg-preto text-papel" : "bg-white"}`}>
      <div className={`rotulo ${destaque ? "text-amarelo" : "text-tinta-suave"}`}>{nome}</div>
      <div className="mt-2 text-2xl md:text-3xl font-extrabold tabular-nums tracking-tight">{valor}</div>
    </div>
  );
}

export function Financeiro() {
  const lista = useAtendimentos();
  if (lista === undefined) return <Carregando />;
  const hoje = formatISO(new Date(), { representation: "date" });

  if (lista.length === 0) {
    return (
      <>
        <Cabecalho titulo="Financeiro" />
        <Vazio titulo="Sem movimento ainda." texto="Quando houver atendimentos com valor autorizado, franquia e custos, aqui aparecem receita prevista, margem e o que a Maxpar ainda não pagou." />
      </>
    );
  }

  const receita = lista.reduce((s, a) => s + receitaPrevista(a), 0);
  const custos = lista.reduce((s, a) => s + custoTotal(a), 0);
  const emAberto = lista.reduce((s, a) => s + aReceberEmAberto(a), 0);
  const franquiasPendentes = lista.filter((a) => a.franquia.valor && !a.franquia.paga && a.etapa !== "pago").reduce((s, a) => s + (a.franquia.valor ?? 0), 0);

  const porSeguradora = new Map<string, { qtd: number; receita: number; aberto: number; atraso: number }>();
  for (const a of lista) {
    const chave = a.seguradora ?? (a.origem === "particular" ? "Particular" : "Sem seguradora");
    const g = porSeguradora.get(chave) ?? { qtd: 0, receita: 0, aberto: 0, atraso: 0 };
    g.qtd += 1;
    g.receita += receitaPrevista(a);
    g.aberto += aReceberEmAberto(a);
    if (a.etapa === "documentacao_enviada" && a.documentacao.enviadaEm) g.atraso = Math.max(g.atraso, diasEntre(a.documentacao.enviadaEm, hoje));
    porSeguradora.set(chave, g);
  }

  const aguardandoPagamento: Atendimento[] = lista.filter((a) => a.etapa === "documentacao_enviada" && !a.documentacao.pagoEm);

  return (
    <>
      <Cabecalho titulo="Financeiro" resumo="Visão de todos os atendimentos em acompanhamento. Valores por carro ficam na ficha." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Numero nome="Receita prevista" valor={formatarReais(receita)} />
        <Numero nome="Custos (material + comissão)" valor={formatarReais(custos)} />
        <Numero nome="Margem prevista" valor={formatarReais(receita - custos)} destaque />
        <Numero nome="Maxpar/seguradoras a receber" valor={formatarReais(emAberto)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white border border-linha overflow-x-auto">
          <h2 className="titulo-condensado text-xl px-4 pt-4">Por seguradora</h2>
          <table className="w-full text-sm mt-3">
            <thead className="text-left bg-preto text-papel">
              <tr className="rotulo">
                <th className="px-4 py-2 font-bold">Seguradora</th>
                <th className="px-4 py-2 font-bold text-right">Carros</th>
                <th className="px-4 py-2 font-bold text-right">Receita</th>
                <th className="px-4 py-2 font-bold text-right">Em aberto</th>
              </tr>
            </thead>
            <tbody>
              {[...porSeguradora.entries()].sort((x, y) => y[1].receita - x[1].receita).map(([nome, g]) => (
                <tr key={nome} className="border-t border-linha">
                  <td className="px-4 py-2">{nome}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{g.qtd}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatarReais(g.receita)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatarReais(g.aberto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="bg-white border border-linha">
          <h2 className="titulo-condensado text-xl px-4 pt-4">Aguardando pagamento</h2>
          {aguardandoPagamento.length === 0 ? (
            <p className="px-4 py-4 text-sm text-tinta-suave">Nenhum atendimento com documentação enviada sem pagamento.</p>
          ) : (
            <ul className="m-0 mt-3 p-0 list-none">
              {aguardandoPagamento.map((a) => {
                const dias = a.documentacao.enviadaEm ? diasEntre(a.documentacao.enviadaEm, hoje) : 0;
                return (
                  <li key={a.id} className="border-t border-linha px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="font-extrabold tabular-nums">{a.placa.slice(0, 3)}-{a.placa.slice(3)}</span>
                    <span>{a.seguradora ?? "—"}{a.protocolo ? ` · ${a.protocolo}` : ""}</span>
                    <span className={`tabular-nums ${dias > 30 ? "text-alerta font-bold" : "text-tinta-suave"}`}>{dias} dias</span>
                    <span className="ml-auto tabular-nums font-bold">{formatarReais(a.financeiro.aReceberMaxpar)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="px-4 py-3 text-sm text-tinta-suave border-t border-linha">
            Franquias ainda não recebidas dos clientes: <span className="font-bold text-tinta tabular-nums">{formatarReais(franquiasPendentes)}</span>
          </p>
        </section>
      </div>
      <p className="mt-6 text-sm text-tinta-suave">Margem por carro, visão por mês, aging e exportação CSV chegam no Sprint 3. Este resumo soma {lista.length} atendimento(s); margem aqui considera apenas custos lançados.</p>
    </>
  );
}

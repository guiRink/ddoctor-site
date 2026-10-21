import type { CategoriaFinanceira, Despesa, TituloReceber } from "@compartilhado/tipos";
import { despesasPorCategoria, faturamentoPorForma } from "@compartilhado/dominio/relatorios";
import { formatarReais, somaCentavos } from "@compartilhado/dominio/dinheiro";
import { somarDias } from "@compartilhado/dominio/fuso";
import { Cartao, Vazio } from "../ui/Basicos";
import { Etiqueta } from "../ui/Estado";
import { dataComSemana } from "../gestao/formato";
import { BarrasLista, RodapeTotal } from "./BarrasLista";
import { rotuloForma } from "./formato";
import { AcaoTexto } from "../ui/Campos";
import { SITUACAO_DESPESA, prazoDespesa, situacaoDespesa } from "./modelo";

export function AbaResumo({
  mes,
  nomeMes,
  titulos,
  despesas,
  categorias,
  hoje,
  podePagar,
  onPagar,
  onVerDespesas,
}: {
  mes: string;
  nomeMes: string;
  titulos: TituloReceber[];
  despesas: Despesa[];
  categorias: CategoriaFinanceira[];
  hoje: string;
  podePagar: boolean;
  onPagar: (d: Despesa) => void;
  onVerDespesas: () => void;
}) {
  const formas = faturamentoPorForma(titulos, mes);
  const porCategoria = despesasPorCategoria(despesas, mes, categorias);
  const totalEntradas = somaCentavos(formas.map((f) => f.valor));
  const totalSaidas = somaCentavos(porCategoria.map((c) => c.valor));
  // o que pede ação: vencidas e vencendo nos próximos 7 dias (independe da competência escolhida)
  const proximas = despesas
    .filter((d) => !d.pagoEm && d.vencimento <= somarDias(hoje, 7))
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <Cartao titulo="Entradas por forma de pagamento" contagem={formas.length || undefined}>
          {formas.length === 0 ? (
            <Vazio icone="recebiveis" titulo={`Nada recebido em ${nomeMes}`} texto="Recebimentos de A receber e da ficha da OS." />
          ) : (
            <>
              <BarrasLista
                legenda="Entradas por forma de pagamento"
                itens={formas.map((f) => ({
                  chave: f.forma,
                  rotulo: f.forma === "outra" ? "Outra forma" : rotuloForma(f.forma),
                  valor: f.valor,
                  texto: formatarReais(f.valor),
                  detalhe: `${f.quantidade} ${f.quantidade === 1 ? "recebimento" : "recebimentos"}`,
                }))}
              />
              <RodapeTotal rotulo="Total recebido" valor={formatarReais(totalEntradas)} />
            </>
          )}
        </Cartao>

        <Cartao titulo="Despesas pagas por categoria" contagem={porCategoria.length || undefined}>
          {porCategoria.length === 0 ? (
            <Vazio icone="financeiro" titulo={`Nenhuma despesa paga em ${nomeMes}`} texto="Lance as despesas em “Nova despesa” e marque como paga quando sair do caixa." />
          ) : (
            <>
              <BarrasLista
                legenda="Despesas pagas por categoria"
                itens={porCategoria.map((c) => ({
                  chave: c.categoriaId ?? c.categoria,
                  rotulo: c.categoria,
                  valor: c.valor,
                  texto: formatarReais(c.valor),
                  detalhe: `${c.quantidade} ${c.quantidade === 1 ? "despesa" : "despesas"}`,
                }))}
              />
              <RodapeTotal rotulo="Total pago" valor={formatarReais(totalSaidas)} />
            </>
          )}
        </Cartao>
      </div>

      <Cartao
        titulo="A pagar — vencidas e próximos 7 dias"
        contagem={proximas.length}
        acao={
          <button type="button" onClick={onVerDespesas} className="text-[13px] font-medium text-tinta-suave hover:text-tinta underline-offset-4 hover:underline">
            Ver todas as despesas
          </button>
        }
      >
        {proximas.length === 0 ? (
          <Vazio titulo="Nada vencendo" texto="Nenhuma despesa vencida nem com vencimento nos próximos 7 dias." />
        ) : (
          <ul>
            {proximas.map((d) => {
              const s = situacaoDespesa(d, hoje);
              return (
                <li
                  key={d.id}
                  className={`grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[120px_minmax(0,1fr)_140px_120px_auto] items-center gap-x-4 gap-y-1 px-4 py-2.5 min-h-14 border-b border-linha last:border-b-0 ${s === "vencida" ? "bg-alerta-claro/50" : ""}`}
                >
                  <span className="numero text-[13px] order-2 md:order-none">
                    <span className="font-medium">{dataComSemana(d.vencimento)}</span>
                    <span className="md:block text-[12px] text-tinta-suave"> {prazoDespesa(d, hoje)}</span>
                  </span>
                  <span className="min-w-0 order-1 md:order-none">
                    <span className="block font-medium truncate">{d.descricao}</span>
                    <span className="block text-[12px] text-tinta-suave truncate">
                      {d.categoria}
                      {d.fornecedor && ` · ${d.fornecedor}`}
                    </span>
                  </span>
                  <span className="hidden md:inline-flex">
                    <Etiqueta tom={SITUACAO_DESPESA[s].tom}>{SITUACAO_DESPESA[s].texto}</Etiqueta>
                  </span>
                  <span className="numero font-semibold text-right whitespace-nowrap order-1 md:order-none">{formatarReais(d.valorPrevisto)}</span>
                  <span className="order-3 md:order-none text-right">
                    {podePagar && (
                      <AcaoTexto onClick={() => onPagar(d)} rotulo={`Pagar ${d.descricao}`}>
                        Pagar
                      </AcaoTexto>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Cartao>
    </div>
  );
}

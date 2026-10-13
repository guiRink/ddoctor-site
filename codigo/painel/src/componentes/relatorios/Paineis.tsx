import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { ConfigOficina, DataISO } from "@compartilhado/tipos";
import { formatarReais } from "@compartilhado/dominio/dinheiro";
import { janelaDoDia } from "@compartilhado/dominio/expediente";
import { dataNoFuso } from "@compartilhado/dominio/fuso";
import { ESTADO_OS, FORMA_PAGAMENTO } from "../../dominio/rotulos";
import { BotaoLink, Cartao, Vazio } from "../ui/Basicos";
import { Etiqueta } from "../ui/Estado";
import { Linha, Tabela, Td, Th } from "../ui/Tabela";
import { PlacaOS } from "../gestao/Comuns";
import { dataCurta, diaCurto } from "../orcamentos/formato";
import { BarrasHorizontais, GraficoColunas } from "./Graficos";
import { nomeMesAno, percentual, quantidade, reaisCompacto } from "./formato";
import type { DadosRelatorio } from "./dados";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Barra fina de participação usada nas tabelas (escala comum: o maior = 100 %). */
function Participacao({ valor, maximo }: { valor: number; maximo: number }) {
  const largura = maximo > 0 ? Math.max(2, (valor / maximo) * 100) : 0;
  return (
    <span className="block h-1.5 w-full min-w-16 rounded-full bg-cinza-100" aria-hidden="true">
      <span className="block h-full rounded-full bg-tinta-suave" style={{ width: `${largura}%` }} />
    </span>
  );
}

function Nota({ children }: { children: ReactNode }) {
  return <p className="px-4 py-3 border-t border-linha text-[12px] text-tinta-suave">{children}</p>;
}

// ------------------------------------------------------------------ faturamento

export function PainelFaturamento({ d, hoje, config, podeAbrirRecebiveis }: { d: DadosRelatorio; hoje: DataISO; config: ConfigOficina; podeAbrirRecebiveis: boolean }) {
  if (d.baixas.length === 0)
    return (
      <Cartao>
        <Vazio
          icone="recebiveis"
          titulo={`Nenhum recebimento em ${nomeMesAno(d.mes)}`}
          texto="As baixas lançadas em Recebíveis e os pagamentos registrados na OS aparecem aqui."
          acao={podeAbrirRecebiveis ? <BotaoLink para="/recebiveis">Abrir recebíveis</BotaoLink> : undefined}
        />
      </Cartao>
    );
  const colunas = d.porDia.map((p) => ({
    chave: p.data,
    rotulo: String(Number(p.data.slice(8))),
    valor: p.valor,
    nome: diaCurto(p.data),
    destaque: p.data === hoje,
    apagada: janelaDoDia(p.data, config) === null,
  }));
  const melhor = d.porDia.reduce((a, b) => (b.valor > a.valor ? b : a), d.porDia[0]);
  return (
    <div className="grid gap-6 items-start xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Cartao titulo="Recebimentos por dia" acao={<span className="text-[13px] text-tinta-suave numero">{formatarReais(d.competencia.entradas)}</span>}>
        <div className="px-4 pt-4 pb-2">
          <GraficoColunas titulo={`Recebido por dia em ${nomeMesAno(d.mes)}`} colunas={colunas} formatar={formatarReais} formatarEixo={reaisCompacto} />
        </div>
        <Nota>
          Maior dia: <span className="font-medium text-tinta numero">{diaCurto(melhor.data)} · {formatarReais(melhor.valor)}</span> ·{" "}
          {plural(d.baixas.length, "recebimento", "recebimentos")} no mês
        </Nota>
      </Cartao>
      <Cartao titulo="Por forma de pagamento" contagem={d.porForma.length}>
        <BarrasHorizontais
          formatar={formatarReais}
          itens={d.porForma.map((f) => ({
            chave: f.forma,
            rotulo: f.forma === "outra" ? "Outra forma" : FORMA_PAGAMENTO[f.forma],
            valor: f.valor,
            detalhe: plural(f.quantidade, "recebimento", "recebimentos"),
          }))}
        />
      </Cartao>
    </div>
  );
}

// ------------------------------------------------------------------ despesas

export function PainelDespesas({ d, podeAbrirFinanceiro }: { d: DadosRelatorio; podeAbrirFinanceiro: boolean }) {
  if (d.despesasPagas.length === 0)
    return (
      <Cartao>
        <Vazio
          icone="financeiro"
          titulo={`Nenhuma despesa paga em ${nomeMesAno(d.mes)}`}
          texto="Despesas marcadas como pagas no Financeiro entram aqui, por categoria."
          acao={podeAbrirFinanceiro ? <BotaoLink para="/financeiro">Abrir o financeiro</BotaoLink> : undefined}
        />
      </Cartao>
    );
  return (
    <div className="grid gap-6 items-start xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      <Cartao titulo="Por categoria" contagem={d.porCategoria.length} acao={<span className="text-[13px] text-tinta-suave numero">{formatarReais(d.competencia.saidas)}</span>}>
        <BarrasHorizontais
          formatar={formatarReais}
          itens={d.porCategoria.map((c) => ({ chave: c.categoriaId ?? c.categoria, rotulo: c.categoria, valor: c.valor, detalhe: plural(c.quantidade, "despesa", "despesas") }))}
        />
      </Cartao>
      <Cartao titulo="Despesas pagas" contagem={d.despesasPagas.length}>
        <ul>
          {d.despesasPagas.map((x) => (
            <li key={x.id} className="flex items-start justify-between gap-4 px-4 py-3 border-b border-linha last:border-b-0">
              <span className="min-w-0">
                <span className="block font-medium truncate">{x.descricao}</span>
                <span className="block text-[13px] text-tinta-suave truncate numero">
                  {[dataCurta(x.pagoEm), x.nomeCategoria, x.fornecedor, x.formaPagamento && FORMA_PAGAMENTO[x.formaPagamento]].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="shrink-0 font-semibold numero">{formatarReais(x.pago)}</span>
            </li>
          ))}
        </ul>
      </Cartao>
    </div>
  );
}

// ------------------------------------------------------------------ ordens de serviço

export function PainelOS({ d, veCustos }: { d: DadosRelatorio; veCustos: boolean }) {
  const totalCriadas = d.porEstado.reduce((s, l) => s + l.quantidade, 0);
  const receitaEntregues = d.entregues.reduce((s, e) => s + e.rel.receita, 0);
  const custoEntregues = d.entregues.reduce((s, e) => s + (e.rel.custo ?? 0), 0);
  return (
    <div className="flex flex-col gap-6">
      <Cartao titulo="Entregues no mês" contagem={d.entregues.length} acao={d.ticket.ticket !== null ? <span className="text-[13px] text-tinta-suave numero">ticket médio {formatarReais(d.ticket.ticket)}</span> : undefined}>
        {d.entregues.length === 0 ? (
          <Vazio icone="carro" titulo={`Nenhuma OS entregue em ${nomeMesAno(d.mes)}`} texto="Quando a recepção registra a entrega do carro, a OS entra aqui com a receita e o custo." />
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full border-collapse text-[14px]">
                <caption className="sr-only">OS entregues em {nomeMesAno(d.mes)}</caption>
                <thead>
                  <tr>
                    <Th>Placa</Th>
                    <Th>Carro e cliente</Th>
                    <Th>Entregue</Th>
                    <Th direita>Receita</Th>
                    {veCustos && (
                      <>
                        <Th direita>Custo lançado</Th>
                        <Th direita>Margem</Th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {d.entregues.map(({ v, rel }) => {
                    const margem = rel.custo === undefined ? undefined : rel.receita - rel.custo;
                    return (
                      <Linha key={v.os.id}>
                        <Td>
                          <PlacaOS v={v} />
                        </Td>
                        <Td>
                          <span className="block font-medium">
                            {v.veiculo.modelo ?? "Modelo não informado"} <span className="font-normal text-tinta-fraca numero">· OS {v.os.numero}</span>
                          </span>
                          <span className="block text-[13px] text-tinta-suave">{v.cliente.nome}</span>
                        </Td>
                        <Td className="numero text-tinta-suave whitespace-nowrap">{v.os.entregueEm ? diaCurto(dataNoFuso(v.os.entregueEm)) : "—"}</Td>
                        <Td numero className="font-medium">
                          {formatarReais(rel.receita)}
                        </Td>
                        {veCustos && (
                          <>
                            <Td numero>{rel.custo === undefined ? <Etiqueta tom="atencao">sem custo lançado</Etiqueta> : formatarReais(rel.custo)}</Td>
                            <Td numero>
                              {margem === undefined ? (
                                <span className="text-tinta-fraca">—</span>
                              ) : (
                                <>
                                  <span className={`font-medium ${margem < 0 ? "text-alerta" : ""}`}>{formatarReais(margem)}</span>
                                  <span className="block text-[12px] text-tinta-suave">{percentual(rel.receita > 0 ? margem / rel.receita : null)}</span>
                                </>
                              )}
                            </Td>
                          </>
                        )}
                      </Linha>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-linha bg-cinza-50">
                    <Td colSpan={3} className="font-semibold">
                      Total
                    </Td>
                    <Td numero className="font-semibold">
                      {formatarReais(receitaEntregues)}
                    </Td>
                    {veCustos && (
                      <>
                        <Td numero className="font-semibold">
                          {formatarReais(custoEntregues)}
                        </Td>
                        <Td numero className="font-semibold">
                          {formatarReais(d.margem.margem)}
                          <span className="block text-[12px] font-normal text-tinta-suave">{percentual(d.margem.margemPct)}</span>
                        </Td>
                      </>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
            <ul className="md:hidden">
              {d.entregues.map(({ v, rel }) => {
                const margem = rel.custo === undefined ? undefined : rel.receita - rel.custo;
                return (
                  <li key={v.os.id} className="flex items-center gap-3 px-4 py-3 border-b border-linha last:border-b-0">
                    <PlacaOS v={v} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium truncate">{v.veiculo.modelo ?? "Modelo não informado"}</span>
                      <span className="block text-[13px] text-tinta-suave truncate">{v.cliente.nome}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-semibold numero">{formatarReais(rel.receita)}</span>
                      {veCustos && (
                        <span className={`block text-[12px] numero ${margem === undefined ? "text-atencao" : margem < 0 ? "text-alerta" : "text-tinta-suave"}`}>
                          {margem === undefined ? "sem custo" : `margem ${percentual(rel.receita > 0 ? margem / rel.receita : null)}`}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            {veCustos && d.margem.semCusto > 0 && (
              <Nota>
                <span className="text-atencao font-medium">
                  {plural(d.margem.semCusto, "OS sem custo lançado", "OS sem custo lançado")}
                </span>{" "}
                — a margem delas aparece cheia (receita inteira) e o total fica superestimado. Lance os custos na ficha da OS.
              </Nota>
            )}
          </>
        )}
      </Cartao>

      <Cartao titulo="Abertas no mês, por estado" contagem={totalCriadas}>
        {d.porEstado.length === 0 ? (
          <Vazio icone="orcamentos" titulo={`Nenhuma OS aberta em ${nomeMesAno(d.mes)}`} />
        ) : (
          <table className="w-full border-collapse text-[14px]">
            <caption className="sr-only">OS abertas no mês por estado atual</caption>
            <thead>
              <tr>
                <Th>Estado atual</Th>
                <Th direita>OS</Th>
                <Th direita>Receita</Th>
                {veCustos && <Th direita className="hidden md:table-cell">Custo lançado</Th>}
                {veCustos && <Th direita className="hidden md:table-cell">Margem</Th>}
              </tr>
            </thead>
            <tbody>
              {d.porEstado.map((l) => (
                <Linha key={l.estado}>
                  <Td>
                    <Etiqueta tom={ESTADO_OS[l.estado].tom}>{ESTADO_OS[l.estado].texto}</Etiqueta>
                  </Td>
                  <Td numero>{l.quantidade}</Td>
                  <Td numero>{formatarReais(l.receita)}</Td>
                  {veCustos && (
                    <Td numero className="hidden md:table-cell text-tinta-suave">
                      {formatarReais(l.custo)}
                    </Td>
                  )}
                  {veCustos && (
                    <Td numero className={`hidden md:table-cell ${l.margem < 0 ? "text-alerta" : ""}`}>
                      {l.custo > 0 ? formatarReais(l.margem) : <span className="text-tinta-fraca">—</span>}
                    </Td>
                  )}
                </Linha>
              ))}
            </tbody>
          </table>
        )}
        <Nota>Conta as OS criadas no mês, pelo estado em que estão hoje. Receita: títulos faturados ou, antes deles, o valor aprovado. Margem só onde há custo lançado.</Nota>
      </Cartao>
    </div>
  );
}

// ------------------------------------------------------------------ clientes

export function PainelClientes({ d, podeAbrirCliente }: { d: DadosRelatorio; podeAbrirCliente: boolean }) {
  if (d.clientes.length === 0)
    return (
      <Cartao>
        <Vazio icone="pessoa" titulo={`Nenhum cliente com OS entregue em ${nomeMesAno(d.mes)}`} texto="O ranking usa o valor das OS entregues no mês." />
      </Cartao>
    );
  const maximo = d.clientes[0]?.total ?? 0;
  return (
    <>
    <p className="mb-3 text-[13px] text-tinta-suave">Os dez maiores pelo valor das OS entregues no mês (títulos faturados ou valor aprovado).</p>
    <Tabela legenda={`Dez maiores clientes de ${nomeMesAno(d.mes)} pelo valor das OS entregues`}>
      <thead>
        <tr>
          <Th className="w-12">#</Th>
          <Th>Cliente</Th>
          <Th direita>OS</Th>
          <Th direita>Valor</Th>
          <Th className="hidden md:table-cell w-[30%]">
            <span className="sr-only">Participação</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {d.clientes.map((c, i) => (
          <Linha key={c.clienteId}>
            <Td numero className="text-left! text-tinta-fraca">
              {i + 1}
            </Td>
            <Td className="font-medium">
              {podeAbrirCliente ? (
                <Link to={`/clientes/${c.clienteId}`} className="text-tinta no-underline hover:underline underline-offset-4">
                  {c.nome}
                </Link>
              ) : (
                c.nome
              )}
            </Td>
            <Td numero className="text-tinta-suave">
              {c.quantidadeOS}
            </Td>
            <Td numero className="font-semibold">
              {formatarReais(c.total)}
            </Td>
            <Td className="hidden md:table-cell">
              <Participacao valor={c.total} maximo={maximo} />
            </Td>
          </Linha>
        ))}
      </tbody>
    </Tabela>
    </>
  );
}

// ------------------------------------------------------------------ materiais

export function PainelMateriais({ d, podeAbrirEstoque }: { d: DadosRelatorio; podeAbrirEstoque: boolean }) {
  if (d.materiais.length === 0)
    return (
      <Cartao>
        <Vazio
          icone="estoque"
          titulo={`Nenhum material consumido em ${nomeMesAno(d.mes)}`}
          texto="Retiradas para OS (lançadas como custo na ficha) e consumo interno do Estoque aparecem aqui."
          acao={podeAbrirEstoque ? <BotaoLink para="/estoque">Abrir o estoque</BotaoLink> : undefined}
        />
      </Cartao>
    );
  const maximo = d.materiais[0]?.custo ?? 0;
  const total = d.materiais.reduce((s, m) => s + m.custo, 0);
  return (
    <Tabela legenda={`Materiais consumidos em ${nomeMesAno(d.mes)}`}>
      <thead>
        <tr>
          <Th>Material</Th>
          <Th direita>Quantidade</Th>
          <Th direita>Custo</Th>
          <Th className="hidden md:table-cell w-[30%]">
            <span className="sr-only">Participação no custo</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {d.materiais.map((m) => (
          <Linha key={m.materialId}>
            <Td className="font-medium">{m.nome}</Td>
            <Td numero className="text-tinta-suave">
              {quantidade(m.quantidade)} {m.unidade}
            </Td>
            <Td numero className="font-semibold">
              {formatarReais(m.custo)}
            </Td>
            <Td className="hidden md:table-cell">
              <Participacao valor={m.custo} maximo={maximo} />
            </Td>
          </Linha>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t border-linha bg-cinza-50">
          <Td className="font-semibold">Total</Td>
          <Td />
          <Td numero className="font-semibold">
            {formatarReais(total)}
          </Td>
          <Td className="hidden md:table-cell" />
        </tr>
      </tfoot>
    </Tabela>
  );
}


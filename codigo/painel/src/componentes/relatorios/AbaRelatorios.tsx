import { useMemo } from "react";
import { formatarReais } from "@compartilhado/dominio/dinheiro";
import { dataNoFuso } from "@compartilhado/dominio/fuso";
import { margemEstimada, ticketMedio } from "@compartilhado/dominio/relatorios";
import type { OSVisao } from "../../dados/repositorio";
import { Botao, Cartao, FaixaIndicadores, Indicador, Vazio } from "../ui/Basicos";
import { Etiqueta } from "../ui/Estado";
import { Linha, Td, Th } from "../ui/Tabela";
import { PlacaOS } from "../gestao/Comuns";
import { diaCurto } from "../orcamentos/formato";
import { BarrasHorizontais } from "./Graficos";
import { baixarCsv, gerarCsv, reaisCsv } from "./csv";
import { nomeMesAno, percentual } from "./formato";
import { paraRelatorio } from "./montar";
import { diasDePatio, entreguesNoMes, faturadoPorSeguradora, negadosPorSeguradora, seguradoraDaOS, tempoMedioDePatio } from "./gestao";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const dias = (d: number | null) => (d === null ? "—" : `${d.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${d === 1 ? "dia" : "dias"}`);
const dataBr = (d?: string) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "");

/**
 * Aba Relatórios do Financeiro (sprint SG, item 12). Não repete entradas, saídas e resultado (estão no Resumo):
 * carros entregues, faturado por seguradora, tempo médio de pátio e itens negados por seguradora.
 * Custo e margem só para quem vê custos da OS (veCustos).
 */
export function AbaRelatorios({ oss, mes, veCustos }: { oss: OSVisao[]; mes: string; veCustos: boolean }) {
  const entregues = useMemo(() => entreguesNoMes(oss, mes), [oss, mes]);
  const rels = useMemo(() => new Map(oss.map((v) => [v.os.id, paraRelatorio(v)])), [oss]);
  const listaRels = useMemo(() => [...rels.values()], [rels]);
  const ticket = ticketMedio(listaRels, mes);
  const margem = margemEstimada(listaRels, mes);
  const patio = tempoMedioDePatio(entregues);
  const porSeguradora = faturadoPorSeguradora(entregues);
  const negados = negadosPorSeguradora(oss, mes);
  const totalNegados = negados.reduce((s, n) => s + n.itens, 0);
  const valorNegado = negados.reduce((s, n) => s + n.valor, 0);
  const nomeMes = nomeMesAno(mes);

  function exportar() {
    const linhas = [
      ["OS", "Placa", "Modelo", "Cliente", "Seguradora", "Entrada", "Entregue em", "Dias de pátio", "Receita (R$)", ...(veCustos ? ["Custo lançado (R$)", "Margem (R$)"] : [])],
      ...entregues.map((v) => {
        const rel = rels.get(v.os.id)!;
        return [
          v.os.numero,
          v.veiculo.placa,
          v.veiculo.modelo,
          v.cliente.nome,
          seguradoraDaOS(v),
          dataBr(v.os.entradaRealEm ? dataNoFuso(v.os.entradaRealEm) : undefined),
          dataBr(v.os.entregueEm ? dataNoFuso(v.os.entregueEm) : undefined),
          diasDePatio(v),
          reaisCsv(rel.receita),
          ...(veCustos ? [rel.custo === undefined ? "sem custo lançado" : reaisCsv(rel.custo), rel.custo === undefined ? "" : reaisCsv(rel.receita - rel.custo)] : []),
        ];
      }),
    ];
    baixarCsv(`carros-entregues-${mes}.csv`, gerarCsv(linhas));
  }

  return (
    <div className="flex flex-col gap-6">
      <FaixaIndicadores colunas={4}>
        <Indicador
          rotulo="Carros entregues"
          valor={entregues.length}
          detalhe={entregues.length ? `${formatarReais(ticket.total)} faturados` : "nenhum no mês"}
        />
        {veCustos ? (
          <Indicador
            rotulo="Margem estimada"
            valor={percentual(margem.margemPct)}
            alerta={margem.margem < 0}
            detalhe={
              margem.semCusto > 0 ? (
                <span className="text-atencao font-medium">{plural(margem.semCusto, "carro sem custo lançado", "carros sem custo lançado")}</span>
              ) : ticket.ticket !== null ? (
                `ticket médio ${formatarReais(ticket.ticket)}`
              ) : (
                "sem carro entregue"
              )
            }
          />
        ) : (
          <Indicador rotulo="Ticket médio" valor={<span className="whitespace-nowrap">{ticket.ticket === null ? "—" : formatarReais(ticket.ticket)}</span>} detalhe="por carro entregue" />
        )}
        <Indicador rotulo="Tempo médio de pátio" valor={<span className="whitespace-nowrap">{dias(patio.media)}</span>} detalhe="da entrada à entrega" />
        <Indicador
          rotulo="Itens negados"
          valor={totalNegados}
          detalhe={totalNegados ? `${formatarReais(valorNegado)} em ${plural(negados.reduce((s, n) => s + n.carros, 0), "carro", "carros")}` : "nenhum no mês"}
        />
      </FaixaIndicadores>

      <div className="grid gap-6 items-start lg:grid-cols-2">
        <Cartao titulo="Faturado por seguradora" contagem={porSeguradora.length || undefined}>
          {porSeguradora.length === 0 ? (
            <Vazio icone="recebiveis" titulo={`Nenhum carro entregue em ${nomeMes}`} />
          ) : (
            <BarrasHorizontais
              formatar={formatarReais}
              itens={porSeguradora.map((s) => ({ chave: s.seguradora, rotulo: s.seguradora, valor: s.valor, detalhe: plural(s.carros, "carro", "carros") }))}
            />
          )}
        </Cartao>
        <Cartao titulo="Itens negados por seguradora" contagem={negados.length || undefined}>
          {negados.length === 0 ? (
            <Vazio icone="ok" titulo={`Nenhum item negado em ${nomeMes}`} />
          ) : (
            <BarrasHorizontais
              formatar={(n) => plural(n, "item", "itens")}
              itens={negados.map((n) => ({
                chave: n.seguradora,
                rotulo: n.seguradora,
                valor: n.itens,
                detalhe: `${formatarReais(n.valor)} · ${plural(n.carros, "carro", "carros")}`,
              }))}
            />
          )}
        </Cartao>
      </div>

      <Cartao
        titulo="Carros entregues"
        contagem={entregues.length}
        acao={
          <Botao tamanho="denso" icone="documento" disabled={entregues.length === 0} onClick={exportar} aria-label={`Exportar carros entregues de ${nomeMes} em CSV`}>
            Exportar CSV
          </Botao>
        }
      >
        {entregues.length === 0 ? (
          <Vazio icone="carro" titulo={`Nenhum carro entregue em ${nomeMes}`} texto="Escolha outro mês no seletor acima." />
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse text-[14px]">
                <caption className="sr-only">Carros entregues em {nomeMes}</caption>
                <thead>
                  <tr>
                    <Th>Placa</Th>
                    <Th>Carro e cliente</Th>
                    <Th>Seguradora</Th>
                    <Th direita>Pátio</Th>
                    <Th>Entregue</Th>
                    <Th direita>Faturado</Th>
                    {veCustos && <Th direita>Margem</Th>}
                  </tr>
                </thead>
                <tbody>
                  {entregues.map((v) => {
                    const rel = rels.get(v.os.id)!;
                    const m = rel.custo === undefined ? undefined : rel.receita - rel.custo;
                    return (
                      <Linha key={v.os.id}>
                        <Td className="w-[112px]">
                          <PlacaOS v={v} />
                        </Td>
                        <Td className="max-w-[280px]">
                          <span className="block font-medium truncate">{v.veiculo.modelo ?? "Modelo não informado"}</span>
                          <span className="block text-[13px] text-tinta-suave truncate">{v.cliente.nome}</span>
                        </Td>
                        <Td className="whitespace-nowrap">{seguradoraDaOS(v)}</Td>
                        <Td numero className="whitespace-nowrap">{dias(diasDePatio(v))}</Td>
                        <Td className="numero text-tinta-suave whitespace-nowrap">{v.os.entregueEm ? diaCurto(dataNoFuso(v.os.entregueEm)) : "—"}</Td>
                        <Td numero className="font-medium">
                          {formatarReais(rel.receita)}
                        </Td>
                        {veCustos && (
                          <Td numero>
                            {m === undefined ? (
                              <Etiqueta tom="atencao">sem custo</Etiqueta>
                            ) : (
                              <>
                                <span className={`block font-medium ${m < 0 ? "text-alerta" : ""}`}>{formatarReais(m)}</span>
                                <span className="block text-[12px] text-tinta-suave">{percentual(rel.receita > 0 ? m / rel.receita : null)}</span>
                              </>
                            )}
                          </Td>
                        )}
                      </Linha>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="md:hidden">
              {entregues.map((v) => {
                const rel = rels.get(v.os.id)!;
                return (
                  <li key={v.os.id} className="flex items-center gap-3 px-4 py-3 border-b border-linha last:border-b-0">
                    <PlacaOS v={v} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium truncate">{v.veiculo.modelo ?? "Modelo não informado"}</span>
                      <span className="block text-[13px] text-tinta-suave truncate">
                        {seguradoraDaOS(v)} · {dias(diasDePatio(v))}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold numero">{formatarReais(rel.receita)}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Cartao>
    </div>
  );
}

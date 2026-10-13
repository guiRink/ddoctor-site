import { useMemo, useState } from "react";
import type { Pagador } from "@compartilhado/tipos";
import { formatarReais, somaCentavos } from "@compartilhado/dominio/dinheiro";
import { normalizarFormaPagamento } from "@compartilhado/dominio/pagamentos";
import type { OSVisao } from "../../dados/repositorio";
import { BotaoLink, SUPERFICIE, Vazio } from "../ui/Basicos";
import { GrupoFiltros } from "../ui/Filtros";
import { Linha, Tabela, Td, Th } from "../ui/Tabela";
import { PlacaOS } from "../gestao/Comuns";
import { TIPO_PAGADOR, dataComSemana, dataCurta } from "../gestao/formato";
import { rotuloForma } from "./formato";
import type { EntradaMes } from "./modelo";

export function AbaEntradas({
  entradas,
  oss,
  pagadores,
  nomeMes,
  hoje,
}: {
  entradas: EntradaMes[];
  oss: OSVisao[];
  pagadores: Pagador[];
  nomeMes: string;
  hoje: string;
}) {
  const [forma, setForma] = useState("todas");
  const porOS = useMemo(() => new Map(oss.map((v) => [v.os.id, v])), [oss]);
  const porPagador = useMemo(() => new Map(pagadores.map((p) => [p.id, p])), [pagadores]);
  const ano = hoje.slice(0, 4);

  const chave = (f: string) => normalizarFormaPagamento(f) ?? "outra";
  const formas = [...new Set(entradas.map((e) => chave(e.baixa.forma)))];
  const lista = entradas.filter((e) => forma === "todas" || chave(e.baixa.forma) === forma);
  const total = somaCentavos(lista.map((e) => e.baixa.valor));

  if (entradas.length === 0) {
    return (
      <div className={SUPERFICIE}>
        <Vazio
          icone="recebiveis"
          titulo={`Nenhuma entrada em ${nomeMes}`}
          texto="As entradas são as baixas dos títulos: registre os recebimentos em Recebíveis ou na ficha da OS."
          acao={
            <BotaoLink para="/recebiveis" tamanho="denso">
              Abrir Recebíveis
            </BotaoLink>
          }
        />
      </div>
    );
  }

  return (
    <>
      {formas.length > 1 && (
        <div className="mb-4">
          <GrupoFiltros<string>
            rotulo="Forma"
            valor={forma}
            onMudar={setForma}
            opcoes={[
              { valor: "todas", texto: "Todas", contagem: entradas.length },
              ...formas.map((f) => ({
                valor: f,
                texto: f === "outra" ? "Outra" : rotuloForma(f),
                contagem: entradas.filter((e) => chave(e.baixa.forma) === f).length,
              })),
            ]}
          />
        </div>
      )}

      <Tabela legenda={`Entradas de ${nomeMes}`} className="hidden md:block">
        <thead>
          <tr>
            <Th>Data</Th>
            <Th>OS</Th>
            <Th>Título</Th>
            <Th>Pagador</Th>
            <Th>Forma</Th>
            <Th direita>Valor</Th>
          </tr>
        </thead>
        <tbody>
          {lista.map(({ baixa, titulo }) => {
            const p = porPagador.get(titulo.pagadorId);
            return (
              <Linha key={baixa.id}>
                <Td className="whitespace-nowrap numero">{dataComSemana(baixa.recebidoEm)}</Td>
                <Td>
                  <PlacaOS v={porOS.get(titulo.osId)} />
                </Td>
                <Td className="max-w-[280px]">
                  <span className="block font-medium truncate" title={titulo.descricao}>
                    {titulo.descricao}
                  </span>
                  {baixa.obs && <span className="block text-[12px] text-tinta-suave truncate">{baixa.obs}</span>}
                </Td>
                <Td className="text-tinta-suave">
                  <span className="block truncate max-w-[200px]">{p?.nome ?? "—"}</span>
                  {p && !p.nome.toLowerCase().includes(TIPO_PAGADOR[p.tipo].toLowerCase()) && (
                    <span className="block text-[12px] text-tinta-fraca">{TIPO_PAGADOR[p.tipo]}</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap">
                  {rotuloForma(baixa.forma)}
                  {baixa.parcelas && baixa.parcelas > 1 && <span className="text-tinta-suave numero"> · {baixa.parcelas}×</span>}
                </Td>
                <Td numero className="font-semibold">
                  {formatarReais(baixa.valor)}
                </Td>
              </Linha>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-cinza-50">
            <td colSpan={5} className="h-12 px-3 text-[13px] font-medium text-tinta-suave border-t border-linha">
              Total {forma === "todas" ? "recebido" : `em ${forma === "outra" ? "outras formas" : rotuloForma(forma).toLowerCase()}`} · {lista.length}{" "}
              {lista.length === 1 ? "entrada" : "entradas"}
            </td>
            <td className="h-12 px-3 text-right numero text-[15px] font-semibold border-t border-linha whitespace-nowrap">{formatarReais(total)}</td>
          </tr>
        </tfoot>
      </Tabela>

      <ul className="md:hidden flex flex-col gap-2" aria-label={`Entradas de ${nomeMes}`}>
        {lista.map(({ baixa, titulo }) => {
          const v = porOS.get(titulo.osId);
          return (
            <li key={baixa.id} className={`${SUPERFICIE} p-4 flex items-center gap-3`}>
              <PlacaOS v={v} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium truncate">{titulo.descricao}</span>
                <span className="block text-[12px] text-tinta-suave numero">
                  {dataCurta(baixa.recebidoEm, ano)} · {rotuloForma(baixa.forma)}
                </span>
              </span>
              <span className="numero font-semibold whitespace-nowrap">{formatarReais(baixa.valor)}</span>
            </li>
          );
        })}
        <li className="flex items-baseline justify-between px-1 pt-1 text-[13px]">
          <span className="text-tinta-suave">Total</span>
          <span className="numero text-[15px] font-semibold">{formatarReais(total)}</span>
        </li>
      </ul>
    </>
  );
}

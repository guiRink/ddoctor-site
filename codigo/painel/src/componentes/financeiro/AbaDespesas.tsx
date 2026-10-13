import { useState } from "react";
import type { Despesa } from "@compartilhado/tipos";
import { formatarReais, somaCentavos } from "@compartilhado/dominio/dinheiro";
import { valorPagoDespesa } from "@compartilhado/dominio/caixa";
import { FORMA_PAGAMENTO } from "../../dominio/rotulos";
import { Botao, SUPERFICIE, Vazio } from "../ui/Basicos";
import { Etiqueta } from "../ui/Estado";
import { GrupoFiltros } from "../ui/Filtros";
import { Linha, Tabela, Td, Th } from "../ui/Tabela";
import { dataCurta } from "../gestao/formato";
import { BarraFerramentas } from "../ui/Abas";
import { Busca, FiltroSelecao } from "../ui/Campos";
import { SITUACAO_DESPESA, prazoDespesa, situacaoDespesa, type SituacaoDespesa } from "./modelo";

type Filtro = "todas" | "abertas" | "vencidas" | "pagas";

const semAcento = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function AbaDespesas({
  despesas,
  nomeMes,
  hoje,
  podePagar,
  onPagar,
  onNova,
}: {
  /** Já filtradas pela competência (despesasDaCompetencia). */
  despesas: Despesa[];
  nomeMes: string;
  hoje: string;
  podePagar: boolean;
  onPagar: (d: Despesa) => void;
  onNova: () => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [termo, setTermo] = useState("");
  const [categoria, setCategoria] = useState("");
  const ano = hoje.slice(0, 4);

  const categorias = [...new Set(despesas.map((d) => d.categoria))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const t = semAcento(termo.trim());
  const base = despesas.filter(
    (d) => (!categoria || d.categoria === categoria) && (!t || semAcento(`${d.descricao} ${d.fornecedor ?? ""} ${d.obs ?? ""}`).includes(t)),
  );
  const sit = (d: Despesa): SituacaoDespesa => situacaoDespesa(d, hoje);
  const passa = (d: Despesa, f: Filtro) =>
    f === "todas" || (f === "pagas" ? sit(d) === "paga" : f === "vencidas" ? sit(d) === "vencida" : sit(d) !== "paga");
  const conta = (f: Filtro) => base.filter((d) => passa(d, f)).length;
  const lista = base.filter((d) => passa(d, filtro));
  const totalAberto = somaCentavos(lista.filter((d) => !d.pagoEm).map((d) => d.valorPrevisto));
  const totalPago = somaCentavos(lista.map(valorPagoDespesa));

  if (despesas.length === 0) {
    return (
      <div className={SUPERFICIE}>
        <Vazio
          icone="financeiro"
          titulo={`Nenhuma despesa em ${nomeMes}`}
          texto="Lance aluguel, energia, compras de material e outras contas para acompanhar o que vence e o resultado do mês."
          acao={
            podePagar ? (
              <Botao variante="primario" icone="mais" onClick={onNova}>
                Nova despesa
              </Botao>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <>
      <BarraFerramentas
        filtros={
          <>
            <Busca valor={termo} onMudar={setTermo} rotulo="Buscar despesa" placeholder="Descrição ou fornecedor" />
            <FiltroSelecao rotulo="Categoria" valor={categoria} onMudar={setCategoria}>
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </FiltroSelecao>
          </>
        }
      />
      <div className="mb-4">
        <GrupoFiltros<Filtro>
          rotulo="Situação"
          valor={filtro}
          onMudar={setFiltro}
          opcoes={[
            { valor: "todas", texto: "Todas", contagem: conta("todas") },
            { valor: "abertas", texto: "Em aberto", contagem: conta("abertas") },
            { valor: "vencidas", texto: "Vencidas", contagem: conta("vencidas"), critico: conta("vencidas") > 0 },
            { valor: "pagas", texto: "Pagas", contagem: conta("pagas") },
          ]}
        />
      </div>

      {lista.length === 0 ? (
        <div className={SUPERFICIE}>
          <Vazio
            icone="busca"
            titulo={filtro === "vencidas" ? "Nenhuma despesa vencida" : "Nenhuma despesa com esses filtros"}
            texto={filtro === "vencidas" ? "Tudo em dia." : "Mude a busca, a categoria ou a situação."}
            acao={
              <Botao
                tamanho="denso"
                onClick={() => {
                  setFiltro("todas");
                  setTermo("");
                  setCategoria("");
                }}
              >
                Limpar filtros
              </Botao>
            }
          />
        </div>
      ) : (
        <>
          <Tabela legenda={`Despesas de ${nomeMes}`} className="hidden md:block">
            <thead>
              <tr>
                <Th>Vencimento</Th>
                <Th>Descrição</Th>
                <Th>Categoria</Th>
                <Th>Fornecedor</Th>
                <Th direita>Valor</Th>
                <Th>Situação</Th>
                {podePagar && (
                  <Th direita>
                    <span className="sr-only">Ação</span>
                  </Th>
                )}
              </tr>
            </thead>
            <tbody>
              {lista.map((d) => {
                const s = sit(d);
                return (
                  <Linha key={d.id} className={s === "vencida" ? "bg-alerta-claro/50" : ""}>
                    <Td className="whitespace-nowrap numero">
                      <span className="block">{dataCurta(d.vencimento, ano)}</span>
                      {s !== "paga" ? (
                        <span className={`block text-[12px] ${s === "vencida" ? "text-alerta" : "text-tinta-suave"}`}>{prazoDespesa(d, hoje)}</span>
                      ) : (
                        d.pagoEm && <span className="block text-[12px] text-tinta-suave">paga em {dataCurta(d.pagoEm, ano)}</span>
                      )}
                    </Td>
                    <Td className="max-w-[300px]">
                      <span className="block font-medium truncate" title={d.descricao}>
                        {d.descricao}
                      </span>
                      {d.obs && (
                        <span className="block text-[12px] text-tinta-suave truncate" title={d.obs}>
                          {d.obs}
                        </span>
                      )}
                    </Td>
                    <Td className="text-tinta-suave whitespace-nowrap">{d.categoria}</Td>
                    <Td className="text-tinta-suave max-w-[200px]">
                      <span className="block truncate">{d.fornecedor ?? "—"}</span>
                    </Td>
                    <Td numero>
                      <span className="block font-semibold">{formatarReais(d.pagoEm ? valorPagoDespesa(d) : d.valorPrevisto)}</span>
                      {d.pagoEm && (d.formaPagamento || d.valorPago !== d.valorPrevisto) && (
                        <span className="block text-[12px] font-normal text-tinta-suave">
                          {d.valorPago !== undefined && d.valorPago !== d.valorPrevisto ? `previsto ${formatarReais(d.valorPrevisto)}` : d.formaPagamento && FORMA_PAGAMENTO[d.formaPagamento]}
                        </span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <Etiqueta tom={SITUACAO_DESPESA[s].tom}>{SITUACAO_DESPESA[s].texto}</Etiqueta>
                    </Td>
                    {podePagar && (
                      <Td className="text-right w-[1%]">
                        {!d.pagoEm && (
                          <Botao tamanho="denso" onClick={() => onPagar(d)} aria-label={`Pagar ${d.descricao}`}>
                            Pagar
                          </Botao>
                        )}
                      </Td>
                    )}
                  </Linha>
                );
              })}
            </tbody>
          </Tabela>

          <ul className="md:hidden flex flex-col gap-2" aria-label={`Despesas de ${nomeMes}`}>
            {lista.map((d) => {
              const s = sit(d);
              return (
                <li key={d.id} className={`${SUPERFICIE} p-4 ${s === "vencida" ? "bg-alerta-claro/40" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block font-medium leading-snug">{d.descricao}</span>
                      <span className="block text-[12px] text-tinta-suave">
                        {d.categoria}
                        {d.fornecedor && ` · ${d.fornecedor}`}
                      </span>
                    </span>
                    <span className="numero font-semibold whitespace-nowrap">{formatarReais(d.pagoEm ? valorPagoDespesa(d) : d.valorPrevisto)}</span>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-[13px] numero">
                      <Etiqueta tom={SITUACAO_DESPESA[s].tom}>{SITUACAO_DESPESA[s].texto}</Etiqueta>
                      <span className="text-tinta-suave">
                        {d.pagoEm ? `em ${dataCurta(d.pagoEm, ano)}` : `vence ${dataCurta(d.vencimento, ano)}`}
                      </span>
                    </span>
                    {podePagar && !d.pagoEm && (
                      <Botao tamanho="denso" onClick={() => onPagar(d)} aria-label={`Pagar ${d.descricao}`}>
                        Pagar
                      </Botao>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-tinta-suave numero">
            <span>
              Em aberto na lista: <strong className="font-semibold text-tinta">{formatarReais(totalAberto)}</strong>
            </span>
            <span>
              Pago na lista: <strong className="font-semibold text-tinta">{formatarReais(totalPago)}</strong>
            </span>
          </p>
        </>
      )}
    </>
  );
}

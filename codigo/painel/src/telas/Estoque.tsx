import { useMemo, useState } from "react";
import type { Material } from "@compartilhado/tipos";
import { statusEstoque, type StatusEstoque } from "@compartilhado/dominio/estoque";
import { DIAS_CONFERENCIA_ESTOQUE_PADRAO } from "@compartilhado/dominio/config";
import { dataNoFuso, diferencaDias } from "@compartilhado/dominio/fuso";
import { useAgora, useMateriais } from "../dados/hooks";
import { useSessao } from "../dados/sessao";
import { podeEditar } from "../dominio/permissoes";
import { Botao, CabecalhoPagina, Vazio } from "../componentes/ui/Basicos";
import { Etiqueta, Provisorio } from "../componentes/ui/Estado";
import { EstadoConsultas } from "../componentes/gestao/Consultas";
import { GrupoFiltros } from "../componentes/ui/Filtros";
import { BarraSaldo } from "../componentes/gestao/Barras";
import { Linha, Tabela, Td, Th } from "../componentes/gestao/Tabela";
import { STATUS_ESTOQUE, dataCurta } from "../componentes/gestao/formato";

type Filtro = "todos" | StatusEstoque;
const ORDEM: StatusEstoque[] = ["zerado", "baixo", "conferir", "ok"];
const qtd = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export function Estoque() {
  const materiaisQ = useMateriais();
  return (
    <EstadoConsultas consultas={[materiaisQ]} linhas={7}>
      {() => <Conteudo materiais={materiaisQ.data!} />}
    </EstadoConsultas>
  );
}

function Conteudo({ materiais }: { materiais: Material[] }) {
  const agora = useAgora(60_000);
  const hoje = dataNoFuso(agora);
  const ano = hoje.slice(0, 4);
  const { perfil } = useSessao();
  const podeLancar = podeEditar(perfil.papel, "estoque");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const comStatus = useMemo(
    () =>
      materiais
        .map((m) => ({ m, status: statusEstoque(m, hoje) }))
        .sort((a, b) => ORDEM.indexOf(a.status) - ORDEM.indexOf(b.status) || a.m.nome.localeCompare(b.m.nome)),
    [materiais, hoje],
  );
  const contagem = (s: StatusEstoque) => comStatus.filter((x) => x.status === s).length;
  const lista = comStatus.filter((x) => filtro === "todos" || x.status === filtro);
  const repor = contagem("baixo") + contagem("zerado");

  return (
    <>
      <CabecalhoPagina
        titulo="Estoque"
        resumo={
          materiais.length ? (
            <>
              <span className="numero">{materiais.length}</span> materiais
              {repor > 0 && (
                <>
                  {" · "}
                  <strong className="text-atencao numero">
                    {repor} para repor
                  </strong>
                </>
              )}
              {contagem("conferir") > 0 && (
                <>
                  {" · "}
                  <span className="numero">{contagem("conferir")}</span> para conferir
                </>
              )}
            </>
          ) : undefined
        }
        acoes={
          podeLancar ? (
            <span className="flex flex-wrap items-center gap-2">
              <Botao tamanho="denso" icone="mais" disabled>
                Compra
              </Botao>
              <Botao tamanho="denso" disabled>
                Uso
              </Botao>
              <Botao tamanho="denso" disabled>
                Conferência
              </Botao>
              <span className="text-[12px] text-tinta-fraca">em breve</span>
            </span>
          ) : undefined
        }
      />

      <p className="mb-4 text-[13px] text-tinta-suave max-w-[90ch]">
        O saldo é <strong className="text-tinta">estimado</strong>: última conferência + compras − usos lançados. Não é baixa fiscal. Material sem
        conferência há mais de <Provisorio>{DIAS_CONFERENCIA_ESTOQUE_PADRAO} dias</Provisorio> pede nova contagem (provisório — a confirmar).
      </p>

      {materiais.length === 0 ? (
        <div className="bg-cartao border border-linha">
          <Vazio
            icone="estoque"
            titulo="Nenhum material cadastrado"
            texto="O cadastro de materiais, as compras e as conferências chegam na etapa do financeiro. Até lá, a lista fica vazia."
          />
        </div>
      ) : (
        <>
          <div className="mb-3">
            <GrupoFiltros<Filtro>
              rotulo="Situação"
              valor={filtro}
              onMudar={setFiltro}
              opcoes={[
                { valor: "todos", texto: "Todos", contagem: comStatus.length },
                ...ORDEM.map((s) => ({ valor: s, texto: STATUS_ESTOQUE[s].texto, contagem: contagem(s) })),
              ]}
            />
          </div>

          {lista.length === 0 ? (
            <div className="bg-cartao border border-linha">
              <Vazio
                titulo={`Nenhum material com situação “${STATUS_ESTOQUE[filtro as StatusEstoque].texto}”`}
                texto="Bom sinal. Volte para todos os materiais para ver a lista completa."
                acao={
                  <Botao tamanho="denso" onClick={() => setFiltro("todos")}>
                    Ver todos
                  </Botao>
                }
              />
            </div>
          ) : (
            <>
              <Tabela legenda="Materiais em estoque" className="hidden md:block">
                <thead>
                  <tr>
                    <Th>Material</Th>
                    <Th>Categoria</Th>
                    <Th direita>Saldo estimado</Th>
                    <Th className="w-[22%]">
                      <span className="sr-only">Saldo em relação ao mínimo</span>
                    </Th>
                    <Th direita>Mínimo</Th>
                    <Th>Última conferência</Th>
                    <Th>Situação</Th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(({ m, status }) => (
                    <Linha key={m.id}>
                      <Td className="font-semibold">{m.nome}</Td>
                      <Td className="text-tinta-suave whitespace-nowrap">{m.categoria}</Td>
                      <Td numero>
                        <span className={`font-bold ${status === "zerado" ? "text-alerta" : status === "baixo" ? "text-atencao" : ""}`}>
                          {qtd.format(m.saldoEstimado)}
                        </span>{" "}
                        <span className="text-tinta-suave">{m.unidade}</span>
                      </Td>
                      <Td>
                        <BarraSaldo saldo={m.saldoEstimado} minimo={m.saldoMinimo} />
                      </Td>
                      <Td numero className="text-tinta-suave">
                        {qtd.format(m.saldoMinimo)} {m.unidade}
                      </Td>
                      <Td className="whitespace-nowrap">
                        <Conferencia data={m.ultimaConferenciaEm} hoje={hoje} ano={ano} />
                      </Td>
                      <Td>
                        <Etiqueta tom={STATUS_ESTOQUE[status].tom}>{STATUS_ESTOQUE[status].texto}</Etiqueta>
                      </Td>
                    </Linha>
                  ))}
                </tbody>
              </Tabela>

              <ul className="md:hidden flex flex-col gap-2" aria-label="Materiais em estoque">
                {lista.map(({ m, status }) => (
                  <li key={m.id} className="bg-cartao border border-linha p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-semibold leading-snug">{m.nome}</span>
                        <span className="block text-[12px] text-tinta-suave">{m.categoria}</span>
                      </span>
                      <Etiqueta tom={STATUS_ESTOQUE[status].tom}>{STATUS_ESTOQUE[status].texto}</Etiqueta>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between gap-3 numero">
                      <span>
                        <span className="text-[16px] font-bold">{qtd.format(m.saldoEstimado)}</span> <span className="text-tinta-suave">{m.unidade}</span>
                      </span>
                      <span className="text-[12px] text-tinta-suave">
                        mínimo {qtd.format(m.saldoMinimo)} {m.unidade}
                      </span>
                    </div>
                    <div className="mt-2">
                      <BarraSaldo saldo={m.saldoEstimado} minimo={m.saldoMinimo} />
                    </div>
                    <p className="mt-2.5 text-[12px] text-tinta-suave">
                      Conferido: <Conferencia data={m.ultimaConferenciaEm} hoje={hoje} ano={ano} inline />
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[12px] text-tinta-fraca">
                A barra mostra o saldo; o traço preto marca o mínimo.
              </p>
            </>
          )}
        </>
      )}
    </>
  );
}

function Conferencia({ data, hoje, ano, inline = false }: { data?: string; hoje: string; ano: string; inline?: boolean }) {
  if (!data) return <span className="text-atencao font-semibold">nunca conferido</span>;
  const dias = diferencaDias(data.slice(0, 10), hoje);
  const velho = dias > DIAS_CONFERENCIA_ESTOQUE_PADRAO;
  return (
    <span className="numero">
      <span className={inline ? "" : "block"}>{dataCurta(data, ano)}</span>
      {inline ? " · " : null}
      <span className={`${inline ? "" : "block"} text-[12px] ${velho ? "text-atencao font-semibold" : "text-tinta-suave"}`}>
        há {dias} {dias === 1 ? "dia" : "dias"}
      </span>
    </span>
  );
}

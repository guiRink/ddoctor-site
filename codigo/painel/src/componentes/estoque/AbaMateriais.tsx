import { useMemo, useState } from "react";
import type { Fornecedor, Id } from "@compartilhado/tipos";
import { formatarReais } from "@compartilhado/dominio/dinheiro";
import { DIAS_ESTOQUE_PARADO_PADRAO } from "@compartilhado/dominio/config";
import { Botao, SUPERFICIE, Vazio } from "../ui/Basicos";
import { Etiqueta, Provisorio } from "../ui/Estado";
import { GrupoFiltros } from "../ui/Filtros";
import { Linha, Tabela, Td, Th } from "../ui/Tabela";
import { BarraSaldo } from "../gestao/Barras";
import { BarraFerramentas } from "../ui/Abas";
import { Busca, FiltroSelecao } from "../ui/Campos";
import { MenuLinha } from "./MenuLinha";
import { formatarQtd } from "../financeiro/formato";
import { SITUACAO, combinaMaterial, passaSituacao, type FiltroSituacao, type LinhaMaterial } from "./modelo";

export type AcaoMaterial = "entrada" | "retirada" | "editar";

/**
 * Lista de materiais (sprint SG). `acabando`: só abaixo do mínimo e sem estoque (a vista que abre o Estoque),
 * sem filtro de situação — os dois números do topo já filtram. `todos`: todos os ativos, com Parado e Inativos.
 */
export type ModoLista = "acabando" | "todos";

export function AbaMateriais({
  modo,
  linhas,
  fornecedores,
  veDinheiro,
  podeLancar,
  onAcao,
  onExportar,
  onNovo,
}: {
  linhas: LinhaMaterial[];
  fornecedores: Fornecedor[];
  veDinheiro: boolean;
  podeLancar: boolean;
  onAcao: (acao: AcaoMaterial, materialId: Id) => void;
  onExportar: (linhas: LinhaMaterial[]) => void;
  onNovo: () => void;
  modo: ModoLista;
}) {
  const [termo, setTermo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [situacao, setSituacao] = useState<FiltroSituacao>("todos");

  const categorias = useMemo(() => [...new Set(linhas.map((l) => l.m.categoria))].sort((a, b) => a.localeCompare(b, "pt-BR")), [linhas]);
  const forn = useMemo(() => new Map(fornecedores.map((f) => [f.id, f.nome])), [fornecedores]);

  const base = linhas.filter((l) => combinaMaterial(l.m, termo) && (!categoria || l.m.categoria === categoria));
  const conta = (f: FiltroSituacao) => base.filter((l) => passaSituacao(l, f)).length;
  const lista = modo === "acabando" ? base : base.filter((l) => passaSituacao(l, situacao));
  const inativos = conta("inativos");
  const filtrando = Boolean(termo.trim() || categoria || (modo === "todos" && situacao !== "todos"));

  if (linhas.length === 0 && modo === "todos") {
    return (
      <div className={SUPERFICIE}>
        <Vazio
          icone="estoque"
          titulo="Nenhum material cadastrado"
          texto="Cadastre lixas, massas, vernizes e EPI com o estoque mínimo."
          acao={
            podeLancar ? (
              <Botao variante="primario" icone="mais" onClick={onNovo}>
                Novo material
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
            <Busca valor={termo} onMudar={setTermo} rotulo="Buscar material" placeholder="Nome, código, marca ou categoria" />
{modo === "todos" && (
              <FiltroSelecao rotulo="Categoria" valor={categoria} onMudar={setCategoria}>
                <option value="">Todas</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </FiltroSelecao>
            )}
          </>
        }
        acoes={
          <Botao tamanho="denso" icone="documento" onClick={() => onExportar(lista)} disabled={lista.length === 0}>
            Exportar CSV
          </Botao>
        }
      />
      {modo === "todos" && (
        <div className="mb-4">
          <GrupoFiltros<FiltroSituacao>
            rotulo="Situação"
            valor={situacao}
            onMudar={setSituacao}
            opcoes={[
              { valor: "todos", texto: "Ativos", contagem: conta("todos") },
              {
                valor: "parado",
                texto: (
                  <>
                    Parado <Provisorio>{DIAS_ESTOQUE_PARADO_PADRAO} d</Provisorio>
                  </>
                ),
                contagem: conta("parado"),
              },
              ...(inativos > 0 || situacao === "inativos" ? [{ valor: "inativos" as const, texto: "Inativos", contagem: inativos }] : []),
            ]}
          />
        </div>
      )}

      {lista.length === 0 ? (
        <div className={SUPERFICIE}>
          <Vazio
            icone={modo === "acabando" && !filtrando ? "ok" : "busca"}
            titulo={modo === "acabando" && !filtrando ? "Nada acabando" : filtrando ? "Nenhum material com esses filtros" : "Nada aqui"}
            texto={modo === "acabando" && !filtrando ? "Todos os materiais estão no mínimo ou acima." : "Mude a busca ou limpe os filtros."}
            acao={
              modo === "acabando" && !filtrando ? undefined : (
              <Botao
                tamanho="denso"
                onClick={() => {
                  setTermo("");
                  setCategoria("");
                  setSituacao("todos");
                }}
              >
                Limpar filtros
              </Botao>
              )
            }
          />
        </div>
      ) : (
        <>
          <Tabela legenda="Materiais em estoque" className="hidden md:block">
            <thead>
              <tr>
                <Th>Material</Th>
                <Th>{modo === "acabando" ? "Comprar de" : "Categoria"}</Th>
                <Th direita>Saldo</Th>
                <Th direita>Mínimo</Th>
                {veDinheiro && <Th direita>Custo médio</Th>}
                <Th>Situação</Th>
                {podeLancar && (
                  <Th direita>
                    <span className="sr-only">Ações</span>
                  </Th>
                )}
              </tr>
            </thead>
            <tbody>
              {lista.map((l) => (
                <Linha key={l.m.id} className={l.ativo ? "" : "text-tinta-fraca"}>
                  <Td className="max-w-[300px]">
                    <span className="block font-medium leading-snug truncate" title={l.m.nome}>
                      {l.m.nome}
                    </span>
                    <span className="block text-[12px] text-tinta-suave truncate">
                      {[modo === "acabando" && l.m.categoria, l.m.codigo && `cód. ${l.m.codigo}`, l.m.marca, modo === "todos" && l.m.fornecedorId && forn.get(l.m.fornecedorId)].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </Td>
                  <Td className="text-tinta-suave whitespace-nowrap">{modo === "acabando" ? (l.m.fornecedorId && forn.get(l.m.fornecedorId)) || "—" : l.m.categoria}</Td>
                  <Td numero className="w-[148px]">
                    <span className={`font-semibold ${l.situacao === "sem_estoque" ? "text-alerta" : l.situacao === "critico" ? "text-atencao" : ""}`}>
                      {formatarQtd(l.m.saldoEstimado)}
                    </span>{" "}
                    <span className="text-tinta-suave text-[13px]">{l.m.unidade}</span>
                    <span className="block mt-1.5 ml-auto w-[112px]">
                      <BarraSaldo saldo={l.m.saldoEstimado} minimo={l.m.saldoMinimo} />
                    </span>
                  </Td>
                  <Td numero className="text-tinta-suave">
                    {formatarQtd(l.m.saldoMinimo)}
                  </Td>
                  {veDinheiro && <Td numero>{formatarReais(l.m.custoMedio)}</Td>}
                  <Td>
                    <Situacao l={l} />
                  </Td>
                  {podeLancar && (
                    <Td className="text-right whitespace-nowrap w-[1%]">
                      <AcoesLinha l={l} onAcao={onAcao} />
                    </Td>
                  )}
                </Linha>
              ))}
            </tbody>
          </Tabela>

          <ul className="md:hidden flex flex-col gap-2" aria-label="Materiais em estoque">
            {lista.map((l) => (
              <li key={l.m.id} className={`${SUPERFICIE} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-medium leading-snug">{l.m.nome}</span>
                    <span className="block text-[12px] text-tinta-suave">
                      {[l.m.categoria, l.m.codigo && `cód. ${l.m.codigo}`, l.m.marca].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="flex items-center gap-1 shrink-0 -mt-1.5 -mr-2">
                    <Situacao l={l} />
                    {podeLancar && <AcoesLinha l={l} onAcao={onAcao} />}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-3 numero">
                  <span>
                    <span className={`text-[20px] font-semibold ${l.situacao === "sem_estoque" ? "text-alerta" : l.situacao === "critico" ? "text-atencao" : ""}`}>
                      {formatarQtd(l.m.saldoEstimado)}
                    </span>{" "}
                    <span className="text-tinta-suave">{l.m.unidade}</span>
                  </span>
                  <span className="text-[13px] text-tinta-suave">
                    mín. {formatarQtd(l.m.saldoMinimo)}
                    {veDinheiro && <> · {formatarReais(l.m.custoMedio)}</>}
                  </span>
                </div>
                <div className="mt-2">
                  <BarraSaldo saldo={l.m.saldoEstimado} minimo={l.m.saldoMinimo} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function Situacao({ l }: { l: LinhaMaterial }) {
  if (!l.ativo) return <Etiqueta tom="neutro">Inativo</Etiqueta>;
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {l.situacao !== "normal" && <Etiqueta tom={SITUACAO[l.situacao].tom}>{SITUACAO[l.situacao].texto}</Etiqueta>}
      {l.situacao === "normal" && !l.parado && <span className="text-[13px] text-tinta-suave">Normal</span>}
      {l.parado && (
        <Etiqueta tom="neutro" ponto>
          Parado{l.diasSemSaida !== null ? ` · ${l.diasSemSaida} d` : ""}
        </Etiqueta>
      )}
    </span>
  );
}

function AcoesLinha({ l, onAcao }: { l: LinhaMaterial; onAcao: (a: AcaoMaterial, id: Id) => void }) {
  return (
    <MenuLinha
      rotulo={`Ações de ${l.m.nome}`}
      acoes={[
        { chave: "entrada", texto: "Registrar entrada", onClick: () => onAcao("entrada", l.m.id) },
        { chave: "retirada", texto: "Registrar retirada", onClick: () => onAcao("retirada", l.m.id), desabilitado: !l.ativo },
        { chave: "editar", texto: "Editar material", onClick: () => onAcao("editar", l.m.id) },
      ]}
    />
  );
}

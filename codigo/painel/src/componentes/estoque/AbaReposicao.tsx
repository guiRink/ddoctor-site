import { useMemo } from "react";
import type { Fornecedor, Id, Material, MovimentoEstoque } from "@compartilhado/tipos";
import { listaReposicao } from "@compartilhado/dominio/estoque";
import { formatarReais, somaCentavos } from "@compartilhado/dominio/dinheiro";
import { Botao, SUPERFICIE, Vazio } from "../ui/Basicos";
import { Etiqueta } from "../ui/Estado";
import { Linha, Tabela, Td, Th } from "../ui/Tabela";
import { dataCurta } from "../gestao/formato";
import { telefoneBR } from "../agenda/formato";
import { formatarQtd } from "../financeiro/formato";
import { SITUACAO, ultimoCustoCompra } from "./modelo";

/** Materiais ativos abaixo do mínimo: quanto falta, último custo de compra e fornecedor. */
export function AbaReposicao({
  materiais,
  movimentos,
  fornecedores,
  hoje,
  veDinheiro,
  podeLancar,
  onEntrada,
}: {
  materiais: Material[];
  movimentos: MovimentoEstoque[];
  fornecedores: Fornecedor[];
  hoje: string;
  veDinheiro: boolean;
  podeLancar: boolean;
  onEntrada: (materialId: Id) => void;
}) {
  const itens = useMemo(() => listaReposicao(materiais), [materiais]);
  const ultimo = useMemo(() => ultimoCustoCompra(movimentos), [movimentos]);
  const forn = useMemo(() => new Map(fornecedores.map((f) => [f.id, f])), [fornecedores]);
  const total = somaCentavos(itens.map((i) => i.custoEstimado));
  const ano = hoje.slice(0, 4);

  if (itens.length === 0) {
    return (
      <div className={SUPERFICIE}>
        <Vazio
          icone="ok"
          titulo="Nada para repor"
          texto="Todos os materiais ativos estão no mínimo ou acima. Materiais sem estoque mínimo definido não entram nesta lista."
        />
      </div>
    );
  }

  // agrupado por fornecedor: a lista vira o pedido de compra de cada um
  const grupos = new Map<string, typeof itens>();
  for (const i of itens) {
    const chave = i.material.fornecedorId ?? "";
    grupos.set(chave, [...(grupos.get(chave) ?? []), i]);
  }
  const ordem = [...grupos.keys()].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : (forn.get(a)?.nome ?? "").localeCompare(forn.get(b)?.nome ?? "", "pt-BR")));

  return (
    <>
      <p className="mb-4 text-[14px] text-tinta-suave">
        <span className="numero font-semibold text-tinta">{itens.length}</span> {itens.length === 1 ? "material" : "materiais"} abaixo do mínimo
        {veDinheiro && (
          <>
            {" · "}reposição estimada em <span className="numero font-semibold text-tinta">{formatarReais(total)}</span> pelo custo médio
          </>
        )}
        . Agrupado por fornecedor.
      </p>

      <div className="flex flex-col gap-5">
        {ordem.map((chave) => {
          const f = forn.get(chave);
          const lista = grupos.get(chave)!;
          return (
            <section key={chave || "sem"} aria-label={f ? `Repor com ${f.nome}` : "Sem fornecedor definido"}>
              <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-2 px-1">
                <h3 className="text-[14px] font-semibold">
                  {f?.nome ?? "Sem fornecedor definido"} <span className="numero text-[13px] font-medium text-tinta-fraca ml-1">{lista.length}</span>
                </h3>
                {f && (
                  <span className="text-[13px] text-tinta-suave numero">
                    {[f.telefone && telefoneBR(f.telefone), f.email].filter(Boolean).join(" · ")}
                  </span>
                )}
              </header>

              <Tabela legenda={f ? `Repor com ${f.nome}` : "Repor — sem fornecedor"} fixa className="hidden md:block">
                <colgroup>
                  <col />
                  <col className="w-[150px]" />
                  <col className="w-[110px]" />
                  <col className="w-[110px]" />
                  {veDinheiro && <col className="w-[150px]" />}
                  {veDinheiro && <col className="w-[130px]" />}
                  {podeLancar && <col className="w-[160px]" />}
                </colgroup>
                <thead>
                  <tr>
                    <Th>Material</Th>
                    <Th>Situação</Th>
                    <Th direita>Saldo / mín.</Th>
                    <Th direita>Faltam</Th>
                    {veDinheiro && <Th direita>Último custo</Th>}
                    {veDinheiro && <Th direita>Estimado</Th>}
                    {podeLancar && (
                      <Th direita>
                        <span className="sr-only">Ação</span>
                      </Th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {lista.map((i) => {
                    const u = ultimo.get(i.material.id);
                    return (
                      <Linha key={i.material.id}>
                        <Td>
                          <span className="block font-medium truncate">{i.material.nome}</span>
                          <span className="block text-[12px] text-tinta-suave truncate">{i.material.categoria}</span>
                        </Td>
                        <Td>
                          <Etiqueta tom={SITUACAO[i.situacao].tom}>{SITUACAO[i.situacao].texto}</Etiqueta>
                        </Td>
                        <Td numero className="text-tinta-suave">
                          {formatarQtd(i.material.saldoEstimado)} / {formatarQtd(i.material.saldoMinimo)}
                        </Td>
                        <Td numero>
                          <span className="font-semibold">{formatarQtd(i.faltam)}</span> <span className="text-[13px] text-tinta-suave">{i.material.unidade}</span>
                        </Td>
                        {veDinheiro && (
                          <Td numero>
                            {u ? (
                              <>
                                <span className="block">{formatarReais(u.custo)}</span>
                                <span className="block text-[12px] text-tinta-fraca">em {dataCurta(u.em.slice(0, 10), ano)}</span>
                              </>
                            ) : (
                              <span className="text-tinta-fraca">sem compra</span>
                            )}
                          </Td>
                        )}
                        {veDinheiro && <Td numero>{formatarReais(i.custoEstimado)}</Td>}
                        {podeLancar && (
                          <Td className="text-right">
                            <Botao tamanho="denso" onClick={() => onEntrada(i.material.id)} aria-label={`Registrar entrada de ${i.material.nome}`}>
                              Registrar entrada
                            </Botao>
                          </Td>
                        )}
                      </Linha>
                    );
                  })}
                </tbody>
              </Tabela>

              <ul className="md:hidden flex flex-col gap-2" aria-label={f ? `Repor com ${f.nome}` : "Repor — sem fornecedor"}>
                {lista.map((i) => (
                  <li key={i.material.id} className={`${SUPERFICIE} p-4`}>
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-medium leading-snug">{i.material.nome}</span>
                        <span className="block text-[12px] text-tinta-suave numero">
                          saldo {formatarQtd(i.material.saldoEstimado)} · mín. {formatarQtd(i.material.saldoMinimo)} {i.material.unidade}
                        </span>
                      </span>
                      <Etiqueta tom={SITUACAO[i.situacao].tom}>{SITUACAO[i.situacao].texto}</Etiqueta>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between gap-3 numero">
                      <span>
                        Faltam <strong className="text-[18px] font-semibold">{formatarQtd(i.faltam)}</strong> <span className="text-tinta-suave">{i.material.unidade}</span>
                      </span>
                      {veDinheiro && <span className="text-[13px] text-tinta-suave">≈ {formatarReais(i.custoEstimado)}</span>}
                    </div>
                    {podeLancar && (
                      <Botao className="mt-3 w-full" tamanho="denso" onClick={() => onEntrada(i.material.id)} aria-label={`Registrar entrada de ${i.material.nome}`}>
                        Registrar entrada
                      </Botao>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}

import { useMemo, useState } from "react";
import type { Material, MovimentoEstoque, Perfil } from "@compartilhado/tipos";
import { consumoPorFuncionario } from "@compartilhado/dominio/estoque";
import { formatarReais, somaCentavos } from "@compartilhado/dominio/dinheiro";
import { somarDias } from "@compartilhado/dominio/fuso";
import { Responsavel, SUPERFICIE, Vazio } from "../ui/Basicos";
import { GrupoFiltros } from "../ui/Filtros";
import { formatarQtd } from "../financeiro/formato";
import { movimentosNoPeriodo } from "./modelo";

type Periodo = "30" | "90" | "tudo";
const ITENS_VISIVEIS = 4;

/** Retiradas (para OS e consumo interno) por funcionário no período, do maior custo para o menor. */
export function AbaConsumo({
  movimentos,
  materiais,
  perfis,
  hoje,
  veDinheiro,
}: {
  movimentos: MovimentoEstoque[];
  materiais: Material[];
  perfis: Perfil[];
  hoje: string;
  veDinheiro: boolean;
}) {
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const pes = useMemo(() => new Map(perfis.map((p) => [p.id, p])), [perfis]);

  const desde = periodo === "tudo" ? null : somarDias(hoje, -Number(periodo) + 1);
  const grupos = useMemo(() => consumoPorFuncionario(movimentosNoPeriodo(movimentos, desde), materiais), [movimentos, materiais, desde]);
  const max = Math.max(...grupos.map((g) => g.custo), 1);
  const total = somaCentavos(grupos.map((g) => g.custo));

  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <GrupoFiltros<Periodo>
          rotulo="Período"
          valor={periodo}
          onMudar={setPeriodo}
          opcoes={[
            { valor: "30", texto: "30 dias" },
            { valor: "90", texto: "90 dias" },
            { valor: "tudo", texto: "Tudo" },
          ]}
        />
        {veDinheiro && grupos.length > 0 && (
          <p className="text-[14px] text-tinta-suave">
            Total retirado <span className="numero font-semibold text-tinta">{formatarReais(total)}</span> pelo custo do material
          </p>
        )}
      </div>

      {grupos.length === 0 ? (
        <div className={SUPERFICIE}>
          <Vazio
            icone="funcionarios"
            titulo="Nenhuma retirada no período"
            texto="Retiradas para OS (na ficha da OS) e consumo interno com o nome de quem retirou aparecem aqui."
          />
        </div>
      ) : (
        <ul className={`${SUPERFICIE} overflow-hidden`} aria-label="Consumo de material por funcionário">
          {grupos.map((g) => {
            const chave = g.perfilId ?? "sem";
            const p = g.perfilId ? pes.get(g.perfilId) : undefined;
            const aberto = abertos.has(chave);
            const itens = aberto ? g.itens : g.itens.slice(0, ITENS_VISIVEIS);
            const pct = (g.custo / max) * 100;
            return (
              <li key={chave} className="px-4 md:px-5 py-4 border-b border-linha last:border-b-0">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[220px_minmax(0,1fr)_120px] items-start gap-x-5 gap-y-2">
                  <span className="min-w-0">
                    {p ? <Responsavel nome={p.nome} /> : <span className="text-[13px] font-medium text-tinta-suave">Sem funcionário informado</span>}
                    {p?.funcao && <span className="block pl-9 text-[12px] text-tinta-fraca">{p.funcao}</span>}
                  </span>
                  <span className="order-3 md:order-none col-span-2 md:col-span-1 md:mt-[11px] h-1.5 rounded-full bg-cinza-100" aria-hidden="true">
                    <span className="block h-full rounded-full bg-tinta-suave/80" style={{ width: `${Math.max(1.5, pct)}%` }} />
                  </span>
                  <span className="text-right numero md:mt-1">
                    {veDinheiro ? (
                      <span className="font-semibold">{formatarReais(g.custo)}</span>
                    ) : (
                      <span className="font-semibold">{g.itens.length} materiais</span>
                    )}
                  </span>
                </div>
                <ul className="mt-3 md:pl-[240px] flex flex-col gap-1" aria-label={`Materiais retirados por ${p?.nome ?? "funcionário não informado"}`}>
                  {itens.map((i) => (
                    <li key={i.materialId} className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="min-w-0 truncate text-tinta-suave">{i.nome}</span>
                      <span className="numero whitespace-nowrap">
                        {formatarQtd(i.quantidade)} <span className="text-tinta-fraca">{i.unidade}</span>
                        {veDinheiro && <span className="inline-block w-[92px] text-right text-tinta-suave">{formatarReais(i.custo)}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
                {g.itens.length > ITENS_VISIVEIS && (
                  <div className="mt-2 md:pl-[240px]">
                  <button
                    type="button"
                    aria-expanded={aberto}
                    onClick={() =>
                      setAbertos((s) => {
                        const n = new Set(s);
                        if (n.has(chave)) n.delete(chave);
                        else n.add(chave);
                        return n;
                      })
                    }
                    className="inline-flex items-center h-9 md:h-7 px-2 -ml-2 rounded-controle text-[13px] font-medium text-tinta-suave hover:text-tinta hover:bg-cinza-100 transition-colors duration-150"
                  >
                    {aberto ? "Mostrar menos" : `Mais ${g.itens.length - ITENS_VISIVEIS} materiais`}
                  </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

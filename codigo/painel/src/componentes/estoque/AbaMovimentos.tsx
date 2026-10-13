import { useMemo, useState } from "react";
import type { Fornecedor, Material, MovimentoEstoque, Perfil, TipoMovimentoEstoque } from "@compartilhado/tipos";
import { custoDoMovimento } from "@compartilhado/dominio/estoque";
import { formatarReais } from "@compartilhado/dominio/dinheiro";
import { dataNoFuso, somarDias } from "@compartilhado/dominio/fuso";
import type { OSVisao } from "../../dados/repositorio";
import { TIPO_MOVIMENTO_ESTOQUE } from "../../dominio/rotulos";
import { Botao, Responsavel, SUPERFICIE, Vazio } from "../ui/Basicos";
import { Etiqueta } from "../ui/Estado";
import { GrupoFiltros } from "../ui/Filtros";
import { Linha, Tabela, Td, Th } from "../ui/Tabela";
import { PlacaOS } from "../gestao/Comuns";
import { dataCurta } from "../gestao/formato";
import { BarraFerramentas } from "../ui/Abas";
import { Busca, FiltroSelecao } from "../ui/Campos";
import { formatarQtd, horaDoMarco } from "../financeiro/formato";
import { TOM_MOVIMENTO, combinaMaterial, movimentosNoPeriodo, quantidadeComSinal } from "./modelo";

type FiltroTipo = "todos" | TipoMovimentoEstoque;
type Periodo = "7" | "30" | "90" | "tudo";

const POR_PAGINA = 60;

export function AbaMovimentos({
  movimentos,
  materiais,
  perfis,
  fornecedores,
  oss,
  hoje,
  veDinheiro,
  onExportar,
}: {
  movimentos: MovimentoEstoque[];
  materiais: Material[];
  perfis: Perfil[];
  fornecedores: Fornecedor[];
  oss: OSVisao[];
  hoje: string;
  veDinheiro: boolean;
  onExportar: (lista: MovimentoEstoque[]) => void;
}) {
  const [tipo, setTipo] = useState<FiltroTipo>("todos");
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [termo, setTermo] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);

  const mat = useMemo(() => new Map(materiais.map((m) => [m.id, m])), [materiais]);
  const pes = useMemo(() => new Map(perfis.map((p) => [p.id, p.nome])), [perfis]);
  const forn = useMemo(() => new Map(fornecedores.map((f) => [f.id, f.nome])), [fornecedores]);
  const porOS = useMemo(() => new Map(oss.map((v) => [v.os.id, v])), [oss]);
  const ano = hoje.slice(0, 4);

  const desde = periodo === "tudo" ? null : somarDias(hoje, -Number(periodo) + 1);
  const doPeriodo = movimentosNoPeriodo(movimentos, desde).filter((m) => {
    const material = mat.get(m.materialId);
    return !termo.trim() || (material && combinaMaterial(material, termo));
  });
  const conta = (t: FiltroTipo) => (t === "todos" ? doPeriodo.length : doPeriodo.filter((m) => m.tipo === t).length);
  const lista = doPeriodo.filter((m) => tipo === "todos" || m.tipo === tipo);
  const visiveis = lista.slice(0, limite);

  return (
    <>
      <BarraFerramentas
        filtros={
          <>
            <Busca valor={termo} onMudar={setTermo} rotulo="Buscar material nas movimentações" placeholder="Material, código ou marca" />
            <FiltroSelecao rotulo="Período" valor={periodo} onMudar={(v) => setPeriodo(v as Periodo)}>
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="tudo">Tudo</option>
            </FiltroSelecao>
          </>
        }
        acoes={
          <Botao tamanho="denso" icone="documento" onClick={() => onExportar(lista)} disabled={lista.length === 0}>
            Exportar CSV
          </Botao>
        }
      />
      <div className="mb-4">
        <GrupoFiltros<FiltroTipo>
          rotulo="Tipo"
          valor={tipo}
          onMudar={(t) => {
            setTipo(t);
            setLimite(POR_PAGINA);
          }}
          opcoes={[
            { valor: "todos", texto: "Todos", contagem: conta("todos") },
            { valor: "entrada_compra", texto: "Entradas", contagem: conta("entrada_compra") },
            { valor: "saida_os", texto: "Retiradas para OS", contagem: conta("saida_os") },
            { valor: "consumo_interno", texto: "Consumo interno", contagem: conta("consumo_interno") },
            { valor: "ajuste", texto: "Ajustes", contagem: conta("ajuste") },
          ]}
        />
      </div>

      {lista.length === 0 ? (
        <div className={SUPERFICIE}>
          <Vazio
            icone="estoque"
            titulo="Nenhuma movimentação nesse período"
            texto="Amplie o período ou mude o tipo. Entradas e retiradas lançadas aparecem aqui, da mais recente para a mais antiga."
            acao={
              periodo !== "tudo" ? (
                <Botao tamanho="denso" onClick={() => setPeriodo("tudo")}>
                  Ver tudo
                </Botao>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <Tabela legenda="Movimentações de estoque" className="hidden md:block">
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>Tipo</Th>
                <Th>Material</Th>
                <Th direita>Quantidade</Th>
                {veDinheiro && <Th direita>Custo</Th>}
                <Th>OS</Th>
                <Th>Funcionário</Th>
                <Th>Observação</Th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((mov) => {
                const m = mat.get(mov.materialId);
                const q = quantidadeComSinal(mov);
                const detalhe = [mov.fornecedorId && forn.get(mov.fornecedorId), mov.obs].filter(Boolean).join(" · ");
                return (
                  <Linha key={mov.id}>
                    <Td className="whitespace-nowrap numero">
                      <span className="block">{dataCurta(dataNoFuso(mov.em), ano)}</span>
                      <span className="block text-[12px] text-tinta-fraca">{horaDoMarco(mov.em)}</span>
                    </Td>
                    <Td>
                      <Etiqueta tom={TOM_MOVIMENTO[mov.tipo]}>{TIPO_MOVIMENTO_ESTOQUE[mov.tipo]}</Etiqueta>
                    </Td>
                    <Td className="max-w-[200px]">
                      <span className="block font-medium truncate" title={m?.nome}>
                        {m?.nome ?? "Material removido"}
                      </span>
                    </Td>
                    <Td numero>
                      <span className={`font-semibold ${q > 0 ? "text-ok" : ""}`}>
                        {q > 0 ? "+" : q < 0 ? "−" : ""}
                        {formatarQtd(Math.abs(q))}
                      </span>{" "}
                      <span className="text-tinta-suave text-[13px]">{m?.unidade}</span>
                    </Td>
                    {veDinheiro && (
                      <Td numero>
                        {mov.tipo === "ajuste" ? (
                          <span className="text-tinta-fraca">—</span>
                        ) : (
                          <>
                            <span className="block">{formatarReais(custoDoMovimento(mov, m))}</span>
                            <span className="block text-[12px] text-tinta-fraca">{formatarReais(mov.custoUnitario ?? m?.custoMedio)} cada</span>
                          </>
                        )}
                      </Td>
                    )}
                    <Td>{mov.osId ? <PlacaOS v={porOS.get(mov.osId)} /> : <span className="text-tinta-fraca">—</span>}</Td>
                    <Td className="whitespace-nowrap">{mov.perfilId ? <Responsavel nome={pes.get(mov.perfilId)} /> : <span className="text-tinta-fraca">—</span>}</Td>
                    <Td className="max-w-[200px] text-tinta-suave text-[13px]">
                      <span className="block truncate" title={detalhe || undefined}>
                        {detalhe || <span className="text-tinta-fraca">—</span>}
                      </span>
                    </Td>
                  </Linha>
                );
              })}
            </tbody>
          </Tabela>

          <ul className="md:hidden flex flex-col gap-2" aria-label="Movimentações de estoque">
            {visiveis.map((mov) => {
              const m = mat.get(mov.materialId);
              const q = quantidadeComSinal(mov);
              const v = mov.osId ? porOS.get(mov.osId) : undefined;
              return (
                <li key={mov.id} className={`${SUPERFICIE} p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block font-medium leading-snug">{m?.nome ?? "Material removido"}</span>
                      <span className="block text-[12px] text-tinta-suave numero">
                        {dataCurta(dataNoFuso(mov.em), ano)} {horaDoMarco(mov.em)}
                        {mov.perfilId && ` · ${pes.get(mov.perfilId) ?? ""}`}
                      </span>
                    </span>
                    <span className={`numero font-semibold whitespace-nowrap ${q > 0 ? "text-ok" : ""}`}>
                      {q > 0 ? "+" : q < 0 ? "−" : ""}
                      {formatarQtd(Math.abs(q))} <span className="font-normal text-tinta-suave">{m?.unidade}</span>
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-3">
                    <Etiqueta tom={TOM_MOVIMENTO[mov.tipo]}>{TIPO_MOVIMENTO_ESTOQUE[mov.tipo]}</Etiqueta>
                    {v ? <PlacaOS v={v} /> : veDinheiro && mov.tipo !== "ajuste" ? <span className="numero text-[13px] text-tinta-suave">{formatarReais(custoDoMovimento(mov, m))}</span> : null}
                  </div>
                  {mov.obs && <p className="mt-2 text-[13px] text-tinta-suave break-words">{mov.obs}</p>}
                </li>
              );
            })}
          </ul>

          {lista.length > visiveis.length && (
            <div className="mt-3 flex items-center justify-center">
              <Botao tamanho="denso" onClick={() => setLimite((l) => l + POR_PAGINA)}>
                Mostrar mais ({lista.length - visiveis.length})
              </Botao>
            </div>
          )}
        </>
      )}
    </>
  );
}

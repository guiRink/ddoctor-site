import { useEffect, useMemo, useState } from "react";
import type { Fornecedor, Id, Material, MovimentoEstoque, Perfil } from "@compartilhado/tipos";
import { listaReposicao } from "@compartilhado/dominio/estoque";
import { formatarReais, somaCentavos } from "@compartilhado/dominio/dinheiro";
import { DIAS_ESTOQUE_PARADO_PADRAO } from "@compartilhado/dominio/config";
import { dataNoFuso } from "@compartilhado/dominio/fuso";
import { useAgora, useFornecedores, useMateriais, useMovimentos, useOSs, usePerfis } from "../dados/hooks";
import type { OSVisao } from "../dados/repositorio";
import { useSessao } from "../dados/sessao";
import { podeEditar, veCustosOS } from "../dominio/permissoes";
import { Botao, CabecalhoPagina, Esqueleto, FaixaIndicadores, Indicador } from "../componentes/ui/Basicos";
import { Provisorio } from "../componentes/ui/Estado";
import { EstadoConsultas } from "../componentes/gestao/Consultas";
import { Retorno } from "../componentes/gestao/Comuns";
import { Abas, PainelAba } from "../componentes/ui/Abas";
import { useParametro } from "../componentes/financeiro/useParametro";
import { AbaMateriais, type AcaoMaterial } from "../componentes/estoque/AbaMateriais";
import { AbaMovimentos } from "../componentes/estoque/AbaMovimentos";
import { AbaReposicao } from "../componentes/estoque/AbaReposicao";
import { AbaFornecedores } from "../componentes/estoque/AbaFornecedores";
import { AbaConsumo } from "../componentes/estoque/AbaConsumo";
import { FormEntrada } from "../componentes/estoque/FormEntrada";
import { FormRetirada } from "../componentes/estoque/FormRetirada";
import { FormMaterial } from "../componentes/estoque/FormMaterial";
import { FormFornecedor } from "../componentes/estoque/FormFornecedor";
import { baixarCsv, nomeArquivoCsv } from "../componentes/estoque/csv";
import { csvMateriais, csvMovimentos, linhasMateriais } from "../componentes/estoque/modelo";

const ABAS = ["materiais", "movimentacoes", "reposicao", "fornecedores", "consumo"] as const;
type AbaEstoque = (typeof ABAS)[number];

type Gaveta =
  | { tipo: "entrada"; materialId?: Id }
  | { tipo: "retirada"; materialId?: Id }
  | { tipo: "material"; material?: Material }
  | { tipo: "fornecedor"; fornecedor?: Fornecedor };

export function Estoque() {
  const materiaisQ = useMateriais();
  const movimentosQ = useMovimentos();
  const fornecedoresQ = useFornecedores();
  const perfisQ = usePerfis();
  const ossQ = useOSs();
  return (
    <EstadoConsultas
      consultas={[materiaisQ, movimentosQ, fornecedoresQ, perfisQ, ossQ]}
      esqueleto={
        <div className="flex flex-col gap-6" role="status" aria-label="Carregando o estoque">
          <div className="esqueleto h-14 w-64" />
          <div className="esqueleto h-24" />
          <Esqueleto linhas={7} altura="h-[52px]" />
        </div>
      }
    >
      {() => (
        <Conteudo
          materiais={materiaisQ.data!}
          movimentos={movimentosQ.data!}
          fornecedores={fornecedoresQ.data!}
          perfis={perfisQ.data!}
          oss={ossQ.data!}
        />
      )}
    </EstadoConsultas>
  );
}

function Conteudo({
  materiais,
  movimentos,
  fornecedores,
  perfis,
  oss,
}: {
  materiais: Material[];
  movimentos: MovimentoEstoque[];
  fornecedores: Fornecedor[];
  perfis: Perfil[];
  oss: OSVisao[];
}) {
  const agora = useAgora(60_000);
  const hoje = dataNoFuso(agora);
  const { perfil } = useSessao();
  const podeLancar = podeEditar(perfil.papel, "estoque");
  const veDinheiro = veCustosOS(perfil.papel);
  const [aba, setAba] = useParametro<AbaEstoque>("aba", ABAS, "materiais");
  const [gaveta, setGaveta] = useState<Gaveta | null>(null);
  const [aviso, setAviso] = useState<string>();

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(undefined), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  const linhas = useMemo(() => linhasMateriais(materiais, movimentos, agora), [materiais, movimentos, agora]);
  const ativos = linhas.filter((l) => l.ativo);
  const criticos = ativos.filter((l) => l.situacao === "critico").length;
  const semEstoque = ativos.filter((l) => l.situacao === "sem_estoque").length;
  const parados = ativos.filter((l) => l.parado);
  const reposicao = useMemo(() => listaReposicao(materiais), [materiais]);
  const valorEstoque = somaCentavos(ativos.map((l) => Math.round(Math.max(0, l.m.saldoEstimado) * l.m.custoMedio)));
  const valorParado = somaCentavos(parados.map((l) => Math.round(l.m.saldoEstimado * l.m.custoMedio)));
  const categorias = new Set(ativos.map((l) => l.m.categoria)).size;
  const numeroOS = useMemo(() => new Map(oss.map((v) => [v.os.id, `#${v.os.numero} ${v.veiculo.placa}`])), [oss]);

  const fechar = () => setGaveta(null);
  const feito = (msg: string) => {
    setGaveta(null);
    setAviso(msg);
  };

  function acaoMaterial(acao: AcaoMaterial, id: Id) {
    if (acao === "editar") setGaveta({ tipo: "material", material: materiais.find((m) => m.id === id) });
    else setGaveta({ tipo: acao, materialId: id });
  }

  const para = (a: AbaEstoque) => `/estoque?aba=${a}`;

  return (
    <>
      <CabecalhoPagina
        titulo="Estoque"
        resumo={
          <>
            Saldo estimado dos materiais da oficina, compras, retiradas e reposição.
          </>
        }
        acoes={
          podeLancar ? (
            <>
              <Botao variante="fantasma" icone="mais" onClick={() => setGaveta({ tipo: "material" })}>
                Novo material
              </Botao>
              <Botao onClick={() => setGaveta({ tipo: "retirada" })} disabled={materiais.length === 0}>
                Retirada
              </Botao>
              <Botao variante="primario" onClick={() => setGaveta({ tipo: "entrada" })} disabled={materiais.length === 0}>
                Entrada
              </Botao>
            </>
          ) : undefined
        }
      />

      <FaixaIndicadores colunas={veDinheiro ? 5 : 4} className="mb-6 max-md:[&>*:last-child:nth-child(odd)]:col-span-2 max-md:[&>*:last-child:nth-child(odd)]:border-r-0">
        <Indicador rotulo="Materiais ativos" valor={ativos.length} detalhe={`em ${categorias} ${categorias === 1 ? "categoria" : "categorias"}`} />
        <Indicador
          rotulo="Abaixo do mínimo"
          valor={criticos}
          alerta={criticos > 0}
          detalhe={veDinheiro && reposicao.length > 0 ? `repor ≈ ${formatarReais(somaCentavos(reposicao.map((r) => r.custoEstimado)))}` : "ver reposição"}
          para={para("reposicao")}
        />
        <Indicador rotulo="Sem estoque" valor={semEstoque} alerta={semEstoque > 0} detalhe={semEstoque > 0 ? "saldo zerado" : "nenhum zerado"} para={para("reposicao")} />
        <Indicador
          rotulo={
            <>
              Parado há <Provisorio>{DIAS_ESTOQUE_PARADO_PADRAO} dias</Provisorio>
            </>
          }
          valor={parados.length}
          detalhe={veDinheiro && parados.length > 0 ? `${formatarReais(valorParado)} sem giro` : "sem saída no período"}
        />
        {veDinheiro && <Indicador rotulo="Valor em estoque" valor={<span className="whitespace-nowrap">{formatarReais(valorEstoque)}</span>} detalhe="saldo × custo médio" />}
      </FaixaIndicadores>

      {aviso && (
        <div className="mb-4 flex items-center gap-2 px-4 h-11 rounded-cartao bg-ok-claro border border-ok/20">
          <Retorno ok={aviso} />
        </div>
      )}

      <Abas<AbaEstoque>
        rotulo="Seções do estoque"
        idBase="estoque"
        valor={aba}
        onMudar={setAba}
        abas={[
          { valor: "materiais", texto: "Materiais", contagem: ativos.length },
          { valor: "movimentacoes", texto: "Movimentações" },
          { valor: "reposicao", texto: "Reposição", contagem: reposicao.length, critico: true },
          { valor: "fornecedores", texto: "Fornecedores", contagem: fornecedores.length },
          { valor: "consumo", texto: "Consumo por funcionário" },
        ]}
      />

      <PainelAba idBase="estoque" valor={aba}>
        {aba === "materiais" && (
          <AbaMateriais
            linhas={linhas}
            fornecedores={fornecedores}
            veDinheiro={veDinheiro}
            podeLancar={podeLancar}
            onAcao={acaoMaterial}
            onNovo={() => setGaveta({ tipo: "material" })}
            onExportar={(l) => baixarCsv(nomeArquivoCsv("estoque-materiais", hoje), csvMateriais(l, fornecedores, veDinheiro))}
          />
        )}
        {aba === "movimentacoes" && (
          <AbaMovimentos
            movimentos={movimentos}
            materiais={materiais}
            perfis={perfis}
            fornecedores={fornecedores}
            oss={oss}
            hoje={hoje}
            veDinheiro={veDinheiro}
            onExportar={(l) =>
              baixarCsv(nomeArquivoCsv("estoque-movimentacoes", hoje), csvMovimentos(l, materiais, perfis, (id) => numeroOS.get(id), veDinheiro))
            }
          />
        )}
        {aba === "reposicao" && (
          <AbaReposicao
            materiais={materiais}
            movimentos={movimentos}
            fornecedores={fornecedores}
            hoje={hoje}
            veDinheiro={veDinheiro}
            podeLancar={podeLancar}
            onEntrada={(id) => setGaveta({ tipo: "entrada", materialId: id })}
          />
        )}
        {aba === "fornecedores" && (
          <AbaFornecedores
            fornecedores={fornecedores}
            materiais={materiais}
            podeLancar={podeLancar}
            onNovo={() => setGaveta({ tipo: "fornecedor" })}
            onEditar={(f) => setGaveta({ tipo: "fornecedor", fornecedor: f })}
          />
        )}
        {aba === "consumo" && <AbaConsumo movimentos={movimentos} materiais={materiais} perfis={perfis} hoje={hoje} veDinheiro={veDinheiro} />}
      </PainelAba>

      {podeLancar && gaveta?.tipo === "entrada" && (
        <FormEntrada
          materiais={materiais}
          fornecedores={fornecedores}
          materialInicial={gaveta.materialId}
          hoje={hoje}
          veDinheiro={veDinheiro}
          onFechar={fechar}
          onFeito={feito}
        />
      )}
      {podeLancar && gaveta?.tipo === "retirada" && (
        <FormRetirada materiais={materiais} perfis={perfis} materialInicial={gaveta.materialId} hoje={hoje} veDinheiro={veDinheiro} onFechar={fechar} onFeito={feito} />
      )}
      {podeLancar && gaveta?.tipo === "material" && (
        <FormMaterial material={gaveta.material} materiais={materiais} fornecedores={fornecedores} veDinheiro={veDinheiro} onFechar={fechar} onFeito={feito} />
      )}
      {podeLancar && gaveta?.tipo === "fornecedor" && <FormFornecedor fornecedor={gaveta.fornecedor} onFechar={fechar} onFeito={feito} />}
    </>
  );
}

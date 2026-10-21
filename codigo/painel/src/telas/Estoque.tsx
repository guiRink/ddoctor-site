import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Fornecedor, Id, Material, MovimentoEstoque, Perfil } from "@compartilhado/tipos";
import { listaReposicao } from "@compartilhado/dominio/estoque";
import { formatarReais, somaCentavos } from "@compartilhado/dominio/dinheiro";
import { dataNoFuso } from "@compartilhado/dominio/fuso";
import { useAgora, useFornecedores, useMateriais, useMovimentos, useOSs, usePerfis } from "../dados/hooks";
import type { OSVisao } from "../dados/repositorio";
import { useSessao } from "../dados/sessao";
import { podeEditar, veCustosOS } from "../dominio/permissoes";
import { Botao, CabecalhoPagina, Esqueleto, FaixaIndicadores, Indicador } from "../componentes/ui/Basicos";
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

// Sprint SG: abre em "Acabando"; "Lista de compra" é a antiga Reposição; o resto fica em abas secundárias.
const ABAS = ["acabando", "compra", "materiais", "movimentacoes", "fornecedores", "consumo"] as const;
type AbaEstoque = (typeof ABAS)[number];
const FILTROS_ACABANDO = ["todos", "sem_estoque"] as const;
type FiltroAcabando = (typeof FILTROS_ACABANDO)[number];

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
  const [aba, setAba] = useParametro<AbaEstoque>("aba", ABAS, "acabando");
  const [filtro] = useParametro<FiltroAcabando>("filtro", FILTROS_ACABANDO, "todos");
  const [gaveta, setGaveta] = useState<Gaveta | null>(null);
  const [aviso, setAviso] = useState<string>();

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(undefined), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  const linhas = useMemo(() => linhasMateriais(materiais, movimentos, agora), [materiais, movimentos, agora]);
  const ativos = linhas.filter((l) => l.ativo);
  const semEstoque = ativos.filter((l) => l.situacao === "sem_estoque").length;
  const acabando = ativos.filter((l) => l.situacao !== "normal");
  const reposicao = useMemo(() => listaReposicao(materiais), [materiais]);
  const filtroSemEstoque = aba === "acabando" && filtro === "sem_estoque";
  const naLista = filtroSemEstoque ? acabando.filter((l) => l.situacao === "sem_estoque") : acabando;
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


  return (
    <>
      <CabecalhoPagina
        titulo="Estoque"
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

      {/* os dois números são o filtro da vista "Acabando" */}
      <FaixaIndicadores colunas={2} className="mb-6 md:max-w-[560px]">
        <Indicador
          rotulo="Acabando"
          valor={acabando.length}
          alerta={acabando.length > 0}
          detalhe={
            acabando.length === 0
              ? "tudo no mínimo ou acima"
              : veDinheiro && reposicao.length > 0
                ? `comprar ≈ ${formatarReais(somaCentavos(reposicao.map((r) => r.custoEstimado)))}`
                : "abaixo do mínimo"
          }
          para="/estoque"
        />
        <Indicador
          rotulo="Sem estoque"
          valor={semEstoque}
          alerta={semEstoque > 0}
          detalhe={semEstoque > 0 ? "saldo zerado" : "nenhum zerado"}
          para="/estoque?filtro=sem_estoque"
        />
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
          { valor: "acabando", texto: "Acabando", contagem: acabando.length, critico: true },
          { valor: "compra", texto: "Lista de compra", contagem: reposicao.length },
          { valor: "materiais", texto: "Todos os materiais", contagem: ativos.length },
          { valor: "movimentacoes", texto: "Movimentações" },
          { valor: "fornecedores", texto: "Fornecedores", contagem: fornecedores.length },
          { valor: "consumo", texto: "Consumo por pessoa" },
        ]}
      />

      <PainelAba idBase="estoque" valor={aba}>
        {aba === "acabando" && (
          <>
            {filtroSemEstoque && (
              <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-tinta-suave">
                Só os sem estoque
                <Link to="/estoque" className="font-medium text-tinta underline underline-offset-4 decoration-linha-forte hover:decoration-tinta">
                  Ver todos acabando
                </Link>
              </p>
            )}
            <AbaMateriais
              key={filtro}
              modo="acabando"
              linhas={naLista}
              fornecedores={fornecedores}
              veDinheiro={veDinheiro}
              podeLancar={podeLancar}
              onAcao={acaoMaterial}
              onNovo={() => setGaveta({ tipo: "material" })}
              onExportar={(l) => baixarCsv(nomeArquivoCsv("estoque-acabando", hoje), csvMateriais(l, fornecedores, veDinheiro))}
            />
          </>
        )}
        {aba === "materiais" && (
          <AbaMateriais
            modo="todos"
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
        {aba === "compra" && (
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

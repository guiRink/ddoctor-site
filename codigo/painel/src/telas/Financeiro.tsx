import { useEffect, useMemo, useState } from "react";
import type { CategoriaFinanceira, Despesa, FechamentoCaixa, Fornecedor, Pagador, Perfil, TituloReceber } from "@compartilhado/tipos";
import { resumoCompetencia } from "@compartilhado/dominio/caixa";
import { formatarReais, somaCentavos } from "@compartilhado/dominio/dinheiro";
import { dataNoFuso, mesDe } from "@compartilhado/dominio/fuso";
import {
  useAgora,
  useCategorias,
  useDespesas,
  useFechamentos,
  useFornecedores,
  useOSs,
  usePagadores,
  usePerfis,
  useTitulos,
} from "../dados/hooks";
import type { OSVisao } from "../dados/repositorio";
import { useSessao } from "../dados/sessao";
import { podeEditar } from "../dominio/permissoes";
import { Botao, CabecalhoPagina, Esqueleto, FaixaIndicadores, Indicador } from "../componentes/ui/Basicos";
import { EstadoConsultas } from "../componentes/gestao/Consultas";
import { Retorno } from "../componentes/gestao/Comuns";
import { Abas, PainelAba } from "../componentes/ui/Abas";
import { SeletorPeriodo } from "../componentes/ui/Periodo";
import { useParametro } from "../componentes/financeiro/useParametro";
import { AbaResumo } from "../componentes/financeiro/AbaResumo";
import { AbaDespesas } from "../componentes/financeiro/AbaDespesas";
import { AbaEntradas } from "../componentes/financeiro/AbaEntradas";
import { AbaCaixa } from "../componentes/financeiro/AbaCaixa";
import { FormDespesa } from "../componentes/financeiro/FormDespesa";
import { FormPagar } from "../componentes/financeiro/FormPagar";
import { nomeCompetencia, somarMeses } from "../componentes/financeiro/formato";
import { despesasDaCompetencia, entradasDoMes } from "../componentes/financeiro/modelo";

const ABAS = ["resumo", "despesas", "entradas", "caixa"] as const;
type AbaFinanceiro = (typeof ABAS)[number];

export function Financeiro() {
  const titulosQ = useTitulos();
  const despesasQ = useDespesas();
  const ossQ = useOSs();
  const pagadoresQ = usePagadores();
  const categoriasQ = useCategorias();
  const fechamentosQ = useFechamentos();
  const perfisQ = usePerfis();
  const fornecedoresQ = useFornecedores();
  return (
    <EstadoConsultas
      consultas={[titulosQ, despesasQ, ossQ, pagadoresQ, categoriasQ, fechamentosQ, perfisQ, fornecedoresQ]}
      esqueleto={
        <div className="flex flex-col gap-6" role="status" aria-label="Carregando o financeiro">
          <div className="esqueleto h-14 w-72" />
          <div className="esqueleto h-24" />
          <Esqueleto linhas={6} altura="h-[52px]" />
        </div>
      }
    >
      {() => (
        <Conteudo
          titulos={titulosQ.data!}
          despesas={despesasQ.data!}
          oss={ossQ.data!}
          pagadores={pagadoresQ.data!}
          categorias={categoriasQ.data!}
          fechamentos={fechamentosQ.data!}
          perfis={perfisQ.data!}
          fornecedores={fornecedoresQ.data!}
        />
      )}
    </EstadoConsultas>
  );
}

function Conteudo({
  titulos,
  despesas,
  oss,
  pagadores,
  categorias,
  fechamentos,
  perfis,
  fornecedores,
}: {
  titulos: TituloReceber[];
  despesas: Despesa[];
  oss: OSVisao[];
  pagadores: Pagador[];
  categorias: CategoriaFinanceira[];
  fechamentos: FechamentoCaixa[];
  perfis: Perfil[];
  fornecedores: Fornecedor[];
}) {
  const agora = useAgora(60_000);
  const hoje = dataNoFuso(agora);
  const mesAtual = mesDe(hoje);
  const { perfil } = useSessao();
  const podePagar = podeEditar(perfil.papel, "financeiro");
  const [aba, setAba] = useParametro<AbaFinanceiro>("aba", ABAS, "resumo");
  const [mes, setMes] = useState(mesAtual);
  const [gaveta, setGaveta] = useState<{ tipo: "nova" } | { tipo: "pagar"; despesa: Despesa } | null>(null);
  const [aviso, setAviso] = useState<string>();

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(undefined), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  const resumo = useMemo(() => resumoCompetencia(mes, titulos, despesas), [mes, titulos, despesas]);
  const daCompetencia = useMemo(() => despesasDaCompetencia(despesas, mes, hoje), [despesas, mes, hoje]);
  const entradas = useMemo(() => entradasDoMes(titulos, mes), [titulos, mes]);
  const nome = nomeCompetencia(mes);
  const nomeCurto = nome.split(" de ")[0];
  const pagasNoMes = despesas.filter((d) => d.pagoEm && mesDe(d.pagoEm) === mes).length;
  const vencidas = despesas.filter((d) => !d.pagoEm && d.vencimento < hoje);
  const abertasNoMes = despesas.filter((d) => !d.pagoEm && mesDe(d.vencimento) === mes).length;

  const feito = (msg: string) => {
    setGaveta(null);
    setAviso(msg);
  };
  const para = (a: AbaFinanceiro) => `/financeiro?aba=${a}`;

  return (
    <>
      <CabecalhoPagina
        titulo="Financeiro"
        resumo={
          <>
            Competência de <strong className="font-semibold text-tinta">{nome}</strong> · o que entrou e saiu do caixa no mês.
          </>
        }
        acoes={
          <>
            <SeletorMes mes={mes} mesAtual={mesAtual} onMudar={setMes} />
            {podePagar && (
              <Botao variante="primario" icone="mais" onClick={() => setGaveta({ tipo: "nova" })}>
                Nova despesa
              </Botao>
            )}
          </>
        }
      />

      <FaixaIndicadores colunas={5} className="mb-6 max-md:[&>*:last-child:nth-child(odd)]:col-span-2 max-md:[&>*:last-child:nth-child(odd)]:border-r-0">
        <Indicador
          rotulo="Entradas"
          valor={<span className="whitespace-nowrap">{formatarReais(resumo.entradas)}</span>}
          detalhe={`${entradas.length} ${entradas.length === 1 ? "recebimento" : "recebimentos"}`}
          para={para("entradas")}
        />
        <Indicador
          rotulo="Saídas"
          valor={<span className="whitespace-nowrap">{formatarReais(resumo.saidas)}</span>}
          detalhe={`${pagasNoMes} ${pagasNoMes === 1 ? "despesa paga" : "despesas pagas"}`}
          para={para("despesas")}
        />
        <Indicador
          rotulo="Resultado"
          valor={<span className="whitespace-nowrap">{formatarReais(resumo.resultado)}</span>}
          alerta={resumo.resultado < 0}
          detalhe="entradas − saídas"
        />
        <Indicador
          rotulo="A pagar em aberto"
          valor={<span className="whitespace-nowrap">{formatarReais(resumo.aPagarEmAberto)}</span>}
          detalhe={
            mes === mesAtual && vencidas.length > 0 ? (
              <span className="text-alerta font-medium">
                {vencidas.length} {vencidas.length === 1 ? "vencida" : "vencidas"} · {formatarReais(somaCentavos(vencidas.map((d) => d.valorPrevisto)))}
              </span>
            ) : (
              `${abertasNoMes} ${abertasNoMes === 1 ? "despesa" : "despesas"} no mês`
            )
          }
          para={para("despesas")}
        />
        <Indicador
          rotulo="A receber em aberto"
          valor={<span className="whitespace-nowrap">{formatarReais(resumo.aReceberEmAberto)}</span>}
          detalhe="títulos com vencimento no mês"
          para="/recebiveis"
        />
      </FaixaIndicadores>

      {aviso && (
        <div className="mb-4 flex items-center gap-2 px-4 h-11 rounded-cartao bg-ok-claro border border-ok/20">
          <Retorno ok={aviso} />
        </div>
      )}

      <Abas<AbaFinanceiro>
        rotulo="Seções do financeiro"
        idBase="financeiro"
        valor={aba}
        onMudar={setAba}
        abas={[
          { valor: "resumo", texto: "Resumo" },
          { valor: "despesas", texto: "Despesas", contagem: daCompetencia.length },
          { valor: "entradas", texto: "Entradas", contagem: entradas.length },
          { valor: "caixa", texto: "Caixa do dia" },
        ]}
      />

      <PainelAba idBase="financeiro" valor={aba}>
        {aba === "resumo" && (
          <AbaResumo
            mes={mes}
            nomeMes={nomeCurto}
            titulos={titulos}
            despesas={despesas}
            categorias={categorias}
            hoje={hoje}
            podePagar={podePagar}
            onPagar={(d) => setGaveta({ tipo: "pagar", despesa: d })}
            onVerDespesas={() => setAba("despesas")}
          />
        )}
        {aba === "despesas" && (
          <AbaDespesas
            despesas={daCompetencia}
            nomeMes={nomeCurto}
            hoje={hoje}
            podePagar={podePagar}
            onPagar={(d) => setGaveta({ tipo: "pagar", despesa: d })}
            onNova={() => setGaveta({ tipo: "nova" })}
          />
        )}
        {aba === "entradas" && <AbaEntradas entradas={entradas} oss={oss} pagadores={pagadores} nomeMes={nomeCurto} hoje={hoje} />}
        {aba === "caixa" && <AbaCaixa titulos={titulos} despesas={despesas} fechamentos={fechamentos} perfis={perfis} hoje={hoje} podeFechar={podePagar} />}
      </PainelAba>

      {podePagar && gaveta?.tipo === "nova" && (
        <FormDespesa categorias={categorias} fornecedores={fornecedores} hoje={hoje} onFechar={() => setGaveta(null)} onFeito={feito} />
      )}
      {podePagar && gaveta?.tipo === "pagar" && <FormPagar despesa={gaveta.despesa} hoje={hoje} onFechar={() => setGaveta(null)} onFeito={feito} />}
    </>
  );
}

/** Competência: ← outubro de 2026 →, com atalho para o mês atual. */
function SeletorMes({ mes, mesAtual, onMudar }: { mes: string; mesAtual: string; onMudar: (m: string) => void }) {
  return (
    <SeletorPeriodo
      rotulo="Competência"
      texto={nomeCompetencia(mes)}
      onAnterior={() => onMudar(somarMeses(mes, -1))}
      onProximo={() => onMudar(somarMeses(mes, 1))}
      rotuloAnterior="Mês anterior"
      rotuloProximo="Próximo mês"
      atalho={mes !== mesAtual ? { texto: "Mês atual", onClick: () => onMudar(mesAtual) } : undefined}
    />
  );
}

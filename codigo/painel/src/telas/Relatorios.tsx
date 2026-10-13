import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { formatarReais } from "@compartilhado/dominio/dinheiro";
import { dataNoFuso } from "@compartilhado/dominio/fuso";
import { useCategorias, useConfig, useDespesas, useAgora, useMateriais, useMovimentos, useOSs, useTitulos } from "../dados/hooks";
import { useSessao } from "../dados/sessao";
import { podeVer, veCustosOS } from "../dominio/permissoes";
import { Botao, CabecalhoPagina, Erro, Esqueleto, FaixaIndicadores, Indicador } from "../componentes/ui/Basicos";
import { Abas, SeletorMes } from "../componentes/relatorios/Controles";
import { montarRelatorio } from "../componentes/relatorios/dados";
import { ABAS_RELATORIO, csvDaAba, type AbaRelatorio } from "../componentes/relatorios/exportar";
import { baixarCsv } from "../componentes/relatorios/csv";
import { nomeMesAno, percentual } from "../componentes/relatorios/formato";
import { PainelClientes, PainelDespesas, PainelFaturamento, PainelMateriais, PainelOS } from "../componentes/relatorios/Paineis";

/**
 * Relatórios do mês (concorrente-analise §3.8): faturamento por forma e por dia, despesas por categoria,
 * OS por estado, ticket médio e margem estimada, maiores clientes e materiais consumidos. Regime de caixa.
 * Mês e aba ficam na URL (?mes=2026-10&aba=despesas) para o link abrir no mesmo lugar.
 * Custos e margem só para quem vê custos da OS (veCustosOS).
 */
const MES_VALIDO = /^\d{4}-(0[1-9]|1[0-2])$/;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
/** Valor em reais no indicador: 22 px no celular (cabe em meia tela sem quebrar), 28 px no desktop. */
const Reais = ({ c }: { c: number | null }) => <span className="text-[22px] md:text-[28px] whitespace-nowrap">{c === null ? "—" : formatarReais(c)}</span>;

export function Relatorios() {
  const { perfil } = useSessao();
  const agora = useAgora(60_000);
  const hoje = dataNoFuso(agora);
  const mesAtual = hoje.slice(0, 7);
  const [params, setParams] = useSearchParams();
  const mesParam = params.get("mes");
  const mes = mesParam && MES_VALIDO.test(mesParam) && mesParam <= mesAtual ? mesParam : mesAtual;
  const abaParam = params.get("aba");
  const aba: AbaRelatorio = ABAS_RELATORIO.some((a) => a.chave === abaParam) ? (abaParam as AbaRelatorio) : "faturamento";
  const veCustos = veCustosOS(perfil.papel);

  const oss = useOSs();
  const titulos = useTitulos();
  const despesas = useDespesas();
  const categorias = useCategorias();
  const movimentos = useMovimentos();
  const materiais = useMateriais();
  const config = useConfig();
  const consultas = [oss, titulos, despesas, categorias, movimentos, materiais, config];

  function mudar(chave: "mes" | "aba", valor: string) {
    const novo = new URLSearchParams(params);
    novo.set(chave, valor);
    setParams(novo, { replace: true });
  }

  const cabecalho = (acoes?: ReactNode) => (
    <CabecalhoPagina
      titulo="Relatórios"
      resumo={`Regime de caixa: o que entrou e saiu de fato em ${nomeMesAno(mes)}.`}
      acoes={
        <>
          <SeletorMes mes={mes} maximo={mesAtual} onMudar={(m) => mudar("mes", m)} />
          {acoes}
        </>
      }
    />
  );

  if (consultas.some((c) => c.isError))
    return (
      <>
        {cabecalho()}
        <Erro mensagem="Não consegui carregar os relatórios." onTentar={() => consultas.forEach((c) => c.isError && c.refetch())} />
      </>
    );
  if (!oss.data || !titulos.data || !despesas.data || !categorias.data || !movimentos.data || !materiais.data || !config.data)
    return (
      <>
        {cabecalho()}
        <div className="esqueleto h-[184px] mb-8" />
        <Esqueleto linhas={4} altura="h-14" />
      </>
    );

  const d = montarRelatorio({
    mes,
    oss: oss.data,
    titulos: titulos.data,
    despesas: despesas.data,
    categorias: categorias.data,
    movimentos: movimentos.data,
    materiais: materiais.data,
  });
  const c = d.competencia;
  const nomeAba = ABAS_RELATORIO.find((a) => a.chave === aba)!.nome;
  const contagens: Record<AbaRelatorio, number> = {
    faturamento: d.baixas.length,
    despesas: d.despesasPagas.length,
    os: d.entregues.length,
    clientes: d.clientes.length,
    materiais: d.materiais.length,
  };
  const semLinhas = contagens[aba] === 0;

  return (
    <>
      {cabecalho(
        <Botao
          tamanho="denso"
          disabled={semLinhas}
          title={semLinhas ? "Nada para exportar neste mês" : undefined}
          aria-label={`Exportar ${nomeAba.toLowerCase()} de ${nomeMesAno(mes)} em CSV`}
          onClick={() => baixarCsv(`relatorio-${aba}-${mes}.csv`, csvDaAba(aba, d, veCustos))}
        >
          Exportar CSV
        </Botao>,
      )}

      <FaixaIndicadores
        colunas={3}
        className="mb-8 md:[&>*:nth-child(3n)]:border-r-0! md:[&>*:nth-child(n+4)]:border-t"
      >
        <Indicador rotulo="Recebido no mês" valor={<Reais c={c.entradas} />} detalhe={plural(d.baixas.length, "recebimento", "recebimentos")} />
        <Indicador rotulo="Despesas pagas" valor={<Reais c={c.saidas} />} detalhe={plural(d.despesasPagas.length, "despesa", "despesas")} />
        <Indicador rotulo="Resultado" valor={<Reais c={c.resultado} />} alerta={c.resultado < 0} detalhe="recebido − pago" />
        <Indicador rotulo="OS entregues" valor={d.ticket.quantidade} detalhe={d.ticket.quantidade ? `${formatarReais(d.ticket.total)} faturados` : "nenhuma no mês"} />
        <Indicador rotulo="Ticket médio" valor={<Reais c={d.ticket.ticket} />} detalhe="por OS entregue" />
        {veCustos ? (
          <Indicador
            rotulo="Margem estimada"
            valor={percentual(d.margem.margemPct)}
            alerta={d.margem.margem < 0}
            detalhe={
              d.margem.semCusto > 0 ? (
                <span className="text-atencao font-medium">{plural(d.margem.semCusto, "OS sem custo lançado", "OS sem custo lançado")} · superestimada</span>
              ) : d.margem.quantidade ? (
                `${formatarReais(d.margem.margem)} sobre ${formatarReais(d.margem.receita)}`
              ) : (
                "sem OS entregue"
              )
            }
          />
        ) : (
          <Indicador rotulo="A receber do mês" valor={<Reais c={c.aReceberEmAberto} />} detalhe="vencimento no mês, em aberto" />
        )}
      </FaixaIndicadores>

      <Abas
        rotulo="Seções do relatório"
        idPainel="relatorio-painel"
        abas={ABAS_RELATORIO.map((a) => ({ ...a, contagem: contagens[a.chave] }))}
        valor={aba}
        onMudar={(v) => mudar("aba", v)}
      />

      <div id="relatorio-painel" role="tabpanel" aria-labelledby={`aba-${aba}`}>
        {aba === "faturamento" && <PainelFaturamento d={d} hoje={hoje} config={config.data} podeAbrirRecebiveis={podeVer(perfil.papel, "recebiveis")} />}
        {aba === "despesas" && <PainelDespesas d={d} podeAbrirFinanceiro={podeVer(perfil.papel, "financeiro")} />}
        {aba === "os" && <PainelOS d={d} veCustos={veCustos} />}
        {aba === "clientes" && <PainelClientes d={d} podeAbrirCliente={podeVer(perfil.papel, "clientes")} />}
        {aba === "materiais" && <PainelMateriais d={d} podeAbrirEstoque={podeVer(perfil.papel, "estoque")} />}
      </div>
    </>
  );
}

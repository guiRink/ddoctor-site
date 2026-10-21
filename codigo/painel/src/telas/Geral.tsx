import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { AtendimentoExterno, MarcoISO, Papel } from "@compartilhado/tipos";
import { dataNoFuso, minutoDoDia, paraMs } from "@compartilhado/dominio/fuso";
import { mensagemErro, useAcoes, useAgendamentos, useAgora, useConfig, useDespesas, useOSs, usePagadores, usePerfis, useTiposReparo, useTitulos } from "../dados/hooks";
import type { OSVisao } from "../dados/repositorio";
import { useSessao } from "../dados/sessao";
import {
  aguardandoAgendamento,
  aguardandoAprovacao,
  aguardandoSeguradora,
  atrasados,
  dinheiroVencido,
  entramHoje,
  naOficina,
  parados,
  paraFazerHoje,
  prontosCobrarFranquia,
  saemHoje,
} from "../dominio/contagens";
import { podeEditar, telaInicial } from "../dominio/permissoes";
import { Botao, BotaoLink, Erro, SUPERFICIE, Vazio } from "../componentes/ui/Basicos";
import { Aviso } from "../componentes/ui/Campos";
import { Gaveta } from "../componentes/ui/Gaveta";
import { diaExtenso, marcoCurto } from "../componentes/orcamentos/formato";
import { mensagemAgendamento } from "../componentes/agenda/modelo";
import { ReceberCarro } from "../componentes/recepcao/ReceberCarro";
import { aPagarEm7Dias, recebidoNoMes, venceEm7Dias } from "../componentes/geral/dinheiro";
import { bloco, CHAVES_LISTA, conteudoLista, type Bloco, type ChaveLista, type DadosGeral } from "../componentes/geral/listas";
import { ListaGaveta } from "../componentes/geral/ListaGaveta";
import { ParaFazerHoje } from "../componentes/geral/ParaFazerHoje";
import { Quadrado } from "../componentes/geral/Quadrado";

/**
 * Geral — o dia da oficina em 5 segundos (revisão SH, pedido do dono: docs/revisao-sh/pedido-dono.md).
 * Quadrados só com número e rótulo (fundo branco); clicar abre a lista com as placas numa gaveta (tela cheia no
 * celular) com o MESMO total (`?lista=<chave>`). Três linhas:
 *   1. Na oficina · Entram hoje · Saem hoje (grandes);
 *   2. Atrasados · Parados (grandes; o dono quer zerados — "0" verde quando estão);
 *   3. Aguardando aprovação · Aguardando seguradora · Aguardando agendamento (+ Dinheiro vencido para dono/gestor).
 * Embaixo, "Para fazer hoje" com quem faz. Números de src/dominio/contagens.ts — os mesmos da Produção, da TV e de
 * Orçamentos. Recepção: mesma estrutura, sem Dinheiro vencido. Financeiro: os quadrados de dinheiro dele.
 * A produção começa em Minhas tarefas.
 */

const LINHA_1: ChaveLista[] = ["na_oficina", "entram_hoje", "saem_hoje"];
const LINHA_2: ChaveLista[] = ["atrasados", "parados"];
const LINHA_3: Partial<Record<Papel, ChaveLista[]>> = {
  dono: ["aguardando_aprovacao", "aguardando_seguradora", "aguardando_agendamento", "dinheiro_vencido"],
  gestor: ["aguardando_aprovacao", "aguardando_seguradora", "aguardando_agendamento", "dinheiro_vencido"],
  recepcao: ["aguardando_aprovacao", "aguardando_seguradora", "aguardando_agendamento"],
};
const FINANCEIRO: ChaveLista[] = ["dinheiro_vencido", "vence_7", "recebido_mes", "cobrar_franquia", "a_pagar_7"];

/** Chaves antigas de `?lista=` (sprint SG) continuam abrindo a lista certa. */
const LISTA_ANTIGA: Record<string, ChaveLista> = { esperando_seguradora: "aguardando_seguradora", para_agendar: "aguardando_agendamento" };

const TITULO_FRANQUIA_FINANCEIRO = "Franquia a cobrar";

const ehLista = (x: string | null): x is ChaveLista => Boolean(x && (CHAVES_LISTA as readonly string[]).includes(x));

export function Geral() {
  const { perfil } = useSessao();
  const papel = perfil.papel;
  const agora = useAgora();
  const oss = useOSs();
  const ags = useAgendamentos();
  const titulos = useTitulos();
  const config = useConfig();
  const perfis = usePerfis();
  const pagadores = usePagadores();
  const despesas = useDespesas();
  const tipos = useTiposReparo();
  const acoes = useAcoes();

  const [params, setParams] = useSearchParams();
  const navegar = useNavigate();
  const local = useLocation();
  const [receber, setReceber] = useState<OSVisao | null>(null);
  const [aviso, setAviso] = useState<{ tom: "ok" | "alerta"; texto: string } | null>(null);
  const [copiado, setCopiado] = useState<string | undefined>();
  // "Copiada" volta a "Copiar mensagem" depois de 2,5 s.
  useEffect(() => {
    if (!copiado) return;
    const t = window.setTimeout(() => setCopiado(undefined), 2500);
    return () => window.clearTimeout(t);
  }, [copiado]);

  const financeiro = papel === "financeiro";
  const consultas = financeiro ? [oss, titulos, config, perfis, pagadores, despesas, ags] : [oss, ags, titulos, config, perfis, pagadores];
  const pronto = consultas.every((c) => c.data !== undefined);

  const dados = useMemo<DadosGeral | null>(() => {
    if (!oss.data || !ags.data || !titulos.data || !config.data || !perfis.data || !pagadores.data) return null;
    const o = oss.data;
    return {
      agora,
      config: config.data,
      perfis: perfis.data,
      naOficina: naOficina(o, agora, config.data),
      entram: entramHoje(o, ags.data, agora),
      saem: saemHoje(o, agora, config.data, pagadores.data),
      atrasados: atrasados(o, agora, config.data),
      parados: parados(o, agora, config.data),
      aprovacao: aguardandoAprovacao(o, agora),
      seguradora: aguardandoSeguradora(o, agora),
      agendar: aguardandoAgendamento(o, ags.data, agora),
      vencido: dinheiroVencido(titulos.data, pagadores.data, o, agora),
      cobrar: prontosCobrarFranquia(o, pagadores.data),
      afazer: paraFazerHoje(o, ags.data, agora, config.data),
      aVencer: venceEm7Dias(titulos.data, pagadores.data, o, agora),
      aPagar: aPagarEm7Dias(despesas.data ?? [], agora),
      recebido: recebidoNoMes(titulos.data, pagadores.data, o, agora),
    };
  }, [oss.data, ags.data, titulos.data, config.data, perfis.data, pagadores.data, despesas.data, agora]);

  // A produção (e a TV) começam em outra tela; o Geral não é delas.
  if (papel === "producao" || papel === "dispositivo") return <Navigate to={telaInicial(papel)} replace />;

  const operacional = !financeiro;
  const linha3 = LINHA_3[papel] ?? LINHA_3.dono!;
  const chaves = financeiro ? FINANCEIRO : [...LINHA_1, ...LINHA_2, ...linha3];

  if (consultas.some((c) => c.isError)) {
    return (
      <>
        <Topo agora={agora} nome={perfil.nome} />
        <Erro mensagem="Não consegui carregar o resumo do dia." onTentar={() => consultas.forEach((c) => c.isError && c.refetch())} />
      </>
    );
  }
  if (!pronto || !dados) return <Carregando agora={agora} nome={perfil.nome} financeiro={financeiro} linha3={linha3.length} />;

  if (oss.data!.length === 0 && operacional) {
    return (
      <>
        <Topo agora={agora} nome={perfil.nome} />
        <div className={SUPERFICIE}>
          <Vazio
            icone="carro"
            titulo="Nenhum carro registrado ainda"
            texto="O primeiro atendimento aparece aqui."
            acao={
              <BotaoLink para="/orcamentos/novo" icone="mais">
                Novo atendimento
              </BotaoLink>
            }
          />
        </div>
      </>
    );
  }

  // ---------------------------------------------------------------- gaveta (lista do quadrado)

  const permitidas = new Set<ChaveLista>([...chaves, "cobrar_franquia", ...(operacional ? (["afazer"] as const) : [])]);
  const listaBruta = params.get("lista");
  const listaParam = listaBruta ? (LISTA_ANTIGA[listaBruta] ?? listaBruta) : null;
  const aberta = ehLista(listaParam) && permitidas.has(listaParam) ? listaParam : null;

  function abrir(chave: ChaveLista) {
    setAviso(null);
    const n = new URLSearchParams(params);
    n.set("lista", chave);
    setParams(n, { state: { listaDoGeral: true } });
  }
  function fechar() {
    // aberta por clique aqui: voltar desfaz o passo no histórico; por link direto: tira o parâmetro.
    if ((local.state as { listaDoGeral?: boolean } | null)?.listaDoGeral) navegar(-1);
    else {
      const n = new URLSearchParams(params);
      n.delete("lista");
      setParams(n, { replace: true });
    }
  }

  async function naoVeio(agendamentoId: string, placa: string) {
    const r = await acoes.marcarNaoCompareceu.mutateAsync([agendamentoId]);
    setAviso(r.ok ? { tom: "ok", texto: `${placa} marcado como não veio. Voltou para a fila da Agenda.` } : { tom: "alerta", texto: mensagemErro(r.codigo) });
  }

  async function copiar(v: OSVisao) {
    try {
      await navigator.clipboard.writeText(mensagemAgendamento(v));
      setCopiado(v.os.id);
    } catch {
      setAviso({ tom: "alerta", texto: "Não consegui copiar. Abra a Agenda para ver a mensagem." });
    }
  }

  const conteudo = aberta
    ? conteudoLista(aberta, dados, {
        podeReceber: podeEditar(papel, "orcamentos"),
        podeAgendar: podeEditar(papel, "agenda"),
        onReceber: (v) => {
          setReceber(v);
        },
        onNaoVeio: naoVeio,
        onCopiar: copiar,
        copiadoId: copiado,
        ocupado: acoes.marcarNaoCompareceu.isPending,
      })
    : null;
  if (conteudo && financeiro && aberta === "cobrar_franquia") conteudo.titulo = TITULO_FRANQUIA_FINANCEIRO;

  // ---------------------------------------------------------------- quadrados

  // No financeiro o quadrado é sobre dinheiro, não sobre o carro pronto.
  const blocoDe = (c: ChaveLista): Bloco => {
    const b = bloco(c, dados);
    return financeiro && c === "cobrar_franquia" ? { ...b, titulo: TITULO_FRANQUIA_FINANCEIRO } : b;
  };
  const quadrado = (c: ChaveLista, tamanho: "grande" | "medio", extra: { compacto?: boolean; className?: string } = {}) => {
    const b = blocoDe(c);
    return <Quadrado key={c} {...b} tamanho={tamanho} {...extra} onAbrir={() => abrir(c)} />;
  };
  // Linha 3: 2 por linha até lg; no computador, 3 (recepção) ou 4 (dono/gestor) lado a lado.
  const colunasLinha3 = linha3.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3";
  // Recepção (3 na linha 3): o terceiro ocupa a linha inteira no celular, para não sobrar um buraco.
  const classeLinha3 = (i: number) => (linha3.length % 2 === 1 && i === linha3.length - 1 ? "max-lg:col-span-2" : "");
  // Financeiro: 5 quadrados = 3 em cima e 2 mais largos embaixo (grade de 6 colunas).
  const classeFinanceiro = (i: number) => (i < 3 ? "lg:col-span-2" : "lg:col-span-3") + (i === 4 ? " max-lg:col-span-2" : "");

  return (
    <>
      <Topo agora={agora} nome={perfil.nome} leitura={operacional ? ultimaLeituraExterna(oss.data!) : undefined} />

      {aviso && !aberta && (
        <div className="mb-4">
          <Aviso tom={aviso.tom}>{aviso.texto}</Aviso>
        </div>
      )}

      {financeiro ? (
        <nav aria-label="O dinheiro da oficina" className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-6">
          {FINANCEIRO.map((c, i) => quadrado(c, i < 3 ? "grande" : "medio", { className: classeFinanceiro(i) }))}
        </nav>
      ) : (
        <nav aria-label="O dia da oficina" className="flex flex-col gap-3 md:gap-4">
          <div className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-3">{LINHA_1.map((c) => quadrado(c, "grande", { compacto: true }))}</div>
          <div className="grid gap-3 md:gap-4 grid-cols-2">{LINHA_2.map((c) => quadrado(c, "grande"))}</div>
          <div className={`grid gap-3 md:gap-4 grid-cols-2 ${colunasLinha3}`}>{linha3.map((c, i) => quadrado(c, "medio", { className: classeLinha3(i) }))}</div>
        </nav>
      )}

      {operacional && <ParaFazerHoje itens={dados.afazer.itens} total={dados.afazer.total} onVerTodos={() => abrir("afazer")} />}

      {aberta && conteudo && !receber && (
        <Gaveta
          titulo={conteudo.titulo}
          descricao={conteudo.descricao}
          larga
          onFechar={fechar}
          corpoClassName="p-0!"
          rodape={
            <div className="flex items-center justify-end md:justify-between gap-3">
              <p className="hidden md:block text-[13px] font-medium text-tinta-suave numero">{conteudo.total}</p>
              <div className="flex items-center gap-2">
                <Botao variante="fantasma" onClick={fechar}>
                  Fechar
                </Botao>
                {conteudo.destino && (
                  <BotaoLink para={conteudo.destino.para}>
                    {conteudo.destino.rotulo}
                  </BotaoLink>
                )}
              </div>
            </div>
          }
        >
          {aviso && (
            <div className="px-5 py-3 border-b border-linha">
              <Aviso tom={aviso.tom}>{aviso.texto}</Aviso>
            </div>
          )}
          {conteudo.linhas.length === 0 ? (
            <Vazio titulo="Nada aqui" texto="Esta lista está vazia agora." />
          ) : (
            <ListaGaveta colunas={conteudo.colunas} linhas={conteudo.linhas} larguraAcoes={conteudo.larguraAcoes} rotuloIdent={conteudo.rotuloIdent} larguraIdent={conteudo.larguraIdent} />
          )}
        </Gaveta>
      )}

      {receber && tipos.data && (
        <ReceberCarro
          v={receber}
          tipos={tipos.data}
          onFechar={() => setReceber(null)}
          onConcluido={(msg) => {
            setReceber(null);
            setAviso({ tom: "ok", texto: msg });
          }}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------------ cabeçalho

function saudacao(agora: MarcoISO): string {
  const min = minutoDoDia(agora);
  return min < 12 * 60 ? "Bom dia" : min < 18 * 60 ? "Boa tarde" : "Boa noite";
}

const UM_DIA = 86_400_000;

function Topo({ agora, nome, leitura }: { agora: MarcoISO; nome: string; leitura?: AtendimentoExterno }) {
  const lidoEm = leitura?.lidoEm;
  const antigo = lidoEm ? paraMs(agora) - paraMs(lidoEm) > UM_DIA : false;
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 mb-5 md:mb-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 min-w-0">
        <h1 className="titulo-pagina">{diaExtenso(dataNoFuso(agora))}</h1>
        <p className="text-[14px] text-tinta-suave">
          {saudacao(agora)}, {nome.split(" ")[0]}
        </p>
      </div>
      {lidoEm && (
        <p
          className={`text-[13px] numero ${antigo ? "text-atencao font-medium" : "text-tinta-fraca"}`}
          title={`Último registro do portal Maxpar (${leitura?.fonte === "manual" ? "registrado à mão" : "lido do portal"}) em ${marcoCurto(lidoEm)}${antigo ? " · mais de 24 h" : ""}`}
        >
          Maxpar: {marcoCurto(lidoEm)}
        </p>
      )}
    </header>
  );
}

function Carregando({ agora, nome, financeiro, linha3 }: { agora: MarcoISO; nome: string; financeiro: boolean; linha3: number }) {
  const caixa = (k: string, alto: boolean, className = "") => <div key={k} className={`esqueleto rounded-cartao! ${alto ? "h-[104px] md:h-[148px]" : "h-[104px] md:h-[120px]"} ${className}`} />;
  return (
    <>
      <Topo agora={agora} nome={nome} />
      <div role="status" aria-label="Carregando" className="flex flex-col gap-3 md:gap-4">
        {financeiro ? (
          <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-6">
            {Array.from({ length: 5 }, (_, i) => caixa(`f${i}`, i < 3, i < 3 ? "lg:col-span-2" : "lg:col-span-3"))}
          </div>
        ) : (
          <>
            <div className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-3">{[0, 1, 2].map((i) => caixa(`a${i}`, true))}</div>
            <div className="grid gap-3 md:gap-4 grid-cols-2">{[0, 1].map((i) => caixa(`b${i}`, true))}</div>
            <div className={`grid gap-3 md:gap-4 grid-cols-2 ${linha3 >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
              {Array.from({ length: linha3 }, (_, i) => caixa(`c${i}`, false))}
            </div>
          </>
        )}
      </div>
      {!financeiro && <div className="esqueleto mt-10 h-[224px] rounded-cartao!" />}
    </>
  );
}

function ultimaLeituraExterna(oss: OSVisao[]): AtendimentoExterno | undefined {
  return oss
    .flatMap((v) => v.atendimentos)
    .filter((a) => a.lidoEm)
    .sort((a, b) => (b.lidoEm ?? "").localeCompare(a.lidoEm ?? ""))[0];
}

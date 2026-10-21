import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { AtendimentoExterno, MarcoISO, Papel } from "@compartilhado/tipos";
import { dataNoFuso, minutoDoDia, paraMs } from "@compartilhado/dominio/fuso";
import { mensagemErro, useAcoes, useAgendamentos, useAgora, useConfig, useDespesas, useOSs, usePagadores, usePerfis, useTiposReparo, useTitulos } from "../dados/hooks";
import type { OSVisao } from "../dados/repositorio";
import { useSessao } from "../dados/sessao";
import {
  dinheiroVencido,
  entramHoje,
  esperandoSeguradora,
  naOficina,
  paradosEAtrasados,
  paraAgendar,
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
import { bloco, CHAVES_LISTA, conteudoLista, type ChaveLista, type DadosGeral } from "../componentes/geral/listas";
import { ListaGaveta } from "../componentes/geral/ListaGaveta";
import { ParaFazerHoje } from "../componentes/geral/ParaFazerHoje";
import { Quadrado } from "../componentes/geral/Quadrado";

/**
 * Geral — o dia da oficina em 5 segundos (revisão SG, item 1; docs/revisao-sg/sistemas-r2.md §3).
 * Elemento dominante: os 6 quadrados, cada um com o número e as próprias placas. Clicar abre a lista completa
 * numa gaveta (no celular, tela cheia) com o MESMO total. Embaixo, "Para fazer hoje" com quem faz.
 * Números de src/dominio/contagens.ts — os mesmos da Produção, da TV e de Atendimentos.
 * Por papel: dono/gestor os 6; recepção troca "Dinheiro vencido" por "Para agendar" (+ "Prontos — cobrar franquia");
 * financeiro vê os quadrados de dinheiro; a produção começa em Minhas tarefas.
 */

const QUADRADOS: Partial<Record<Papel, ChaveLista[]>> = {
  dono: ["na_oficina", "entram_hoje", "saem_hoje", "parados", "esperando_seguradora", "dinheiro_vencido"],
  gestor: ["na_oficina", "entram_hoje", "saem_hoje", "parados", "esperando_seguradora", "dinheiro_vencido"],
  recepcao: ["na_oficina", "entram_hoje", "saem_hoje", "parados", "esperando_seguradora", "para_agendar"],
  financeiro: ["dinheiro_vencido", "vence_7", "recebido_mes", "cobrar_franquia", "a_pagar_7"],
};

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
      parados: paradosEAtrasados(o, agora, config.data),
      esperando: esperandoSeguradora(o, agora),
      vencido: dinheiroVencido(titulos.data, pagadores.data, o, agora),
      agendar: paraAgendar(o, ags.data, agora),
      cobrar: prontosCobrarFranquia(o, pagadores.data),
      afazer: paraFazerHoje(o, ags.data, agora, config.data),
      aVencer: venceEm7Dias(titulos.data, pagadores.data, o, agora),
      aPagar: aPagarEm7Dias(despesas.data ?? [], agora),
      recebido: recebidoNoMes(titulos.data, pagadores.data, o, agora),
    };
  }, [oss.data, ags.data, titulos.data, config.data, perfis.data, pagadores.data, despesas.data, agora]);

  // A produção (e a TV) começam em outra tela; o Geral não é delas.
  if (papel === "producao" || papel === "dispositivo") return <Navigate to={telaInicial(papel)} replace />;

  const chaves = QUADRADOS[papel] ?? QUADRADOS.dono!;
  const operacional = !financeiro;

  if (consultas.some((c) => c.isError)) {
    return (
      <>
        <Topo agora={agora} nome={perfil.nome} />
        <Erro mensagem="Não consegui carregar o resumo do dia." onTentar={() => consultas.forEach((c) => c.isError && c.refetch())} />
      </>
    );
  }
  if (!pronto || !dados) return <Carregando agora={agora} nome={perfil.nome} quadrados={chaves.length} />;

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
  const listaParam = params.get("lista");
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
  const blocos = chaves.map((c) => {
    const b = bloco(c, dados);
    return financeiro && c === "cobrar_franquia" ? { ...b, titulo: TITULO_FRANQUIA_FINANCEIRO, resumo: b.total ? "carros prontos" : undefined } : b;
  });
  const cobrarExtra = papel === "recepcao" && dados.cobrar.total > 0 ? bloco("cobrar_franquia", dados) : null;
  // Financeiro: 5 quadrados = 3 em cima e 2 mais largos embaixo (grade de 6 colunas).
  const classeQuadrado = (i: number) => (financeiro ? (i < 3 ? "lg:col-span-2" : "lg:col-span-3") + (i === 4 ? " max-lg:col-span-2" : "") : "");

  return (
    <>
      <Topo agora={agora} nome={perfil.nome} leitura={operacional ? ultimaLeituraExterna(oss.data!) : undefined} />

      {aviso && !aberta && (
        <div className="mb-4">
          <Aviso tom={aviso.tom}>{aviso.texto}</Aviso>
        </div>
      )}

      <nav aria-label="O dia da oficina" className={`grid gap-3 md:gap-4 grid-cols-2 ${financeiro ? "lg:grid-cols-6" : "lg:grid-cols-3"}`}>
        {blocos.map((b, i) => (
          <Quadrado key={b.chave} {...b} onAbrir={() => abrir(b.chave)} className={classeQuadrado(i)} />
        ))}
        {cobrarExtra && <Quadrado {...cobrarExtra} largo onAbrir={() => abrir("cobrar_franquia")} className="col-span-2 lg:col-span-3" />}
      </nav>

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

function Carregando({ agora, nome, quadrados }: { agora: MarcoISO; nome: string; quadrados: number }) {
  return (
    <>
      <Topo agora={agora} nome={nome} />
      <div role="status" aria-label="Carregando" className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: quadrados }, (_, i) => (
          <div key={i} className="esqueleto h-[150px] md:h-[188px] rounded-cartao!" />
        ))}
      </div>
      <div className="esqueleto mt-10 h-[224px] rounded-cartao!" />
    </>
  );
}

function ultimaLeituraExterna(oss: OSVisao[]): AtendimentoExterno | undefined {
  return oss
    .flatMap((v) => v.atendimentos)
    .filter((a) => a.lidoEm)
    .sort((a, b) => (b.lidoEm ?? "").localeCompare(a.lidoEm ?? ""))[0];
}

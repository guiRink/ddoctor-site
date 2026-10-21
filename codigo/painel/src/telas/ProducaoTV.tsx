import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ReactNode } from "react";
import type { ConfigOficina } from "@compartilhado/tipos";
import { dataNoFuso } from "@compartilhado/dominio/fuso";
import { alertaCarroBase } from "@compartilhado/dominio/config";
import { ATUALIZACAO_MS, useAgora, useConfig, useOSs, usePerfis } from "../dados/hooks";
import { Icone, type NomeIcone } from "../componentes/Icone";
import { MarcaD } from "../componentes/ui/Marca";
import { CartaoTV } from "../componentes/producao/CartaoTV";
import { QuadradoTV } from "../componentes/producao/QuadradoTV";
import {
  ALTURA_TV,
  COLUNA_PRONTOS,
  COLUNA_SEM_ETAPA,
  NOME_FILTRO,
  contarItens,
  filtrarItens,
  formatarDataCurta,
  formatarHora,
  lerFiltro,
  montarColunas,
  montarItens,
  densidadeTV,
  gradeMosaico,
  ordenarMosaico,
  paginasTV,
} from "../componentes/producao/quadro";

const ATUALIZAR_MS = ATUALIZACAO_MS.tv; // 20 s (hooks.ts); o aviso "Tentando de novo a cada…" usa o mesmo número
const PAGINA_MS = 20_000;
const SEM_ATUALIZAR_MS = 60_000; // acima disso o rodapé avisa que o quadro pode estar desatualizado
const CABECALHO_PX = 104;
const RODAPE_PX = 56;
const CORPO_Y_PX = 40; // respiro vertical do corpo
const TITULO_COLUNA_PX = 60;
const COLUNA_MIN_PX = 236; // até 7 colunas em 1920 (placa g cabe); acima disso, páginas de colunas
const PLACA_TV_PX = 264 + 40; // placa tv + respiro do cartão: abaixo disso a placa encolhe
const VAO_PX = 20;
const VAO_CARTAO_PX = 12;
// mosaico (padrão): faixa de cima e rodapé um pouco mais baixos para caberem 5 linhas de quadrados (30 carros)
const MOSAICO_CABECALHO_PX = 100;
const MOSAICO_RODAPE_PX = 60;
const MOSAICO_CORPO_Y_PX = 32;
const MOSAICO_X_PX = 32;
const MOSAICO_VAO_PX = 14;

function useTamanhoTela() {
  const ler = () => ({ l: window.innerWidth, a: window.innerHeight });
  const [t, setT] = useState(ler);
  useEffect(() => {
    const f = () => setT(ler());
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return t;
}

/**
 * Quadro da TV da oficina (docs/painel-design.md §4 e §5.1): fundo preto, sem menu, sem cursor, sem foco e sem
 * rolagem; atualiza a cada 20 s. Padrão: **mosaico** de quadrados pintados pela cor do carro (pedido do dono, 2º
 * áudio). Alternativa: `?visao=etapas`, as colunas por etapa. Filtro fixo pela URL nas duas:
 * #/producao/tv?filtro=atrasados|vermelhos|laranjas|parados|hoje (impedidos, link antigo, cai em parados).
 */
export function ProducaoTV() {
  const [params] = useSearchParams();
  const visao = params.get("visao") ?? new URLSearchParams(window.location.search).get("visao");
  return visao === "etapas" ? <TVEtapas /> : <TVMosaico />;
}

/** Os dados da TV (os mesmos nas duas visões), recarregados a cada 20 s. */
function useDadosTV() {
  // atualização periódica pelo hook (também em segundo plano): o tempo real não chega ao papel `dispositivo`
  const consulta = useOSs("tv");
  const config = useConfig("tv");
  const agora = useAgora(ATUALIZAR_MS);
  const [params] = useSearchParams();
  const filtro = lerFiltro(params.get("filtro") ?? new URLSearchParams(window.location.search).get("filtro"));
  const itens = useMemo(
    () => (consulta.data && config.data ? montarItens(consulta.data, agora, config.data) : []),
    [consulta.data, config.data, agora],
  );
  const atualizadoEm = consulta.dataUpdatedAt;
  const desatualizado = atualizadoEm > 0 && Date.parse(agora) - atualizadoEm > SEM_ATUALIZAR_MS;
  return { consulta, config, agora, filtro, itens, atualizadoEm, desatualizado };
}

// ------------------------------------------------------------------ mosaico (padrão)

/**
 * Mosaico (pedido do dono, 2º áudio: "TV de 60 polegadas, quadradinhos com a placa e a etapa, em verde, laranja,
 * vermelho ou vermelho piscando"). Faixa de cima: contagem por cor + relógio. Corpo: um quadrado por carro, o pior
 * primeiro, a grade escolhe o maior quadrado que cabe (até 30 numa tela de 1920×1080; acima disso pagina a cada 20 s).
 * Rodapé: atualização, legenda das cores (com os dias úteis da base) e a página.
 */
function TVMosaico() {
  const { consulta, config, filtro, itens, atualizadoEm, desatualizado } = useDadosTV();
  const { l, a } = useTamanhoTela();
  const totais = contarItens(itens);
  const visiveis = useMemo(() => ordenarMosaico(filtrarItens(itens, filtro)), [itens, filtro]);

  const largura = l - 2 * MOSAICO_X_PX;
  const altura = a - MOSAICO_CABECALHO_PX - MOSAICO_RODAPE_PX - MOSAICO_CORPO_Y_PX;
  const grade = gradeMosaico(visiveis.length, largura, altura, MOSAICO_VAO_PX);
  const paginas = Math.max(1, Math.ceil(visiveis.length / grade.porPagina));
  const [tique, setTique] = useState(0);
  useEffect(() => {
    if (paginas < 2) return;
    const t = setInterval(() => setTique((p) => p + 1), PAGINA_MS);
    return () => clearInterval(t);
  }, [paginas]);
  const pagina = tique % paginas;
  const naPagina = visiveis.slice(pagina * grade.porPagina, (pagina + 1) * grade.porPagina);
  const piscar = config.data ? alertaCarroBase(config.data).piscarAtrasado : true;
  // quadrado largo: selos com texto; estreito: só o ícone (e a legenda do rodapé explica os ícones)
  const largo = grade.largura >= 380;

  return (
    <div data-tema="claro" className="fixed inset-0 bg-preto text-papel cursor-none select-none overflow-hidden flex flex-col">
      <header className="shrink-0 flex items-center gap-6 px-8 border-b border-linha-clara" style={{ height: MOSAICO_CABECALHO_PX }}>
        <div className="flex items-center gap-4 shrink-0">
          <MarcaD tamanho={52} />
          <h1 className="titulo text-[40px] leading-none">Produção</h1>
          {filtro !== "todos" && <ChipFiltro texto={NOME_FILTRO[filtro]} />}
        </div>
        {/* contagem por cor: a primeira coisa que o dono lê ("quantos vermelhos hoje?") */}
        <dl className="flex-1 min-w-0 flex justify-end items-center gap-3 m-0">
          {piscar || totais.piscando > 0 ? <ContaCor cor="piscando" valor={totais.piscando} um="atrasado" varios="atrasados" /> : null}
          <ContaCor cor="vermelho" valor={totais.vermelhos} um="vermelho" varios="vermelhos" />
          <ContaCor cor="laranja" valor={totais.laranjas} um="laranja" varios="laranjas" />
          <ContaCor cor="verde" valor={totais.verdes} um="verde" varios="verdes" />
          <ContaCor cor="pronto" valor={totais.prontos} um="pronto" varios="prontos" />
          {totais.parados > 0 && <ContaCor cor="parado" valor={totais.parados} um="parado" varios="parados" />}
        </dl>
        <Relogio />
      </header>

      <main className="flex-1 min-h-0" style={{ padding: `${MOSAICO_CORPO_Y_PX / 2}px ${MOSAICO_X_PX}px` }}>
        {consulta.isPending || config.isPending ? (
          <MosaicoCarregando colunas={grade.colunas} largura={grade.largura} altura={grade.altura} />
        ) : !consulta.data || !config.data ? (
          <Aviso icone="alerta" titulo="Sem conexão com o painel" texto={`Tentando de novo a cada ${ATUALIZAR_MS / 1000} segundos.`} />
        ) : visiveis.length === 0 ? (
          <Aviso
            icone="ok"
            titulo={filtro === "todos" ? "Nenhum carro na oficina agora" : `Nenhum carro em “${NOME_FILTRO[filtro].toLowerCase()}”`}
            texto={filtro === "todos" ? "Os carros aparecem aqui quando a recepção registra a entrada." : "Tudo em dia neste recorte."}
          />
        ) : (
          <ul
            className="m-0 p-0 list-none grid justify-center content-start"
            style={{
              gap: MOSAICO_VAO_PX,
              gridTemplateColumns: `repeat(${grade.colunas}, ${grade.largura}px)`,
              gridAutoRows: grade.altura,
            }}
          >
            {naPagina.map((i) => (
              <li key={i.v.os.id} className="grid min-w-0">
                <QuadradoTV item={i} densidade={grade.densidade} largo={largo} largura={grade.largura} />
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="shrink-0 flex items-center gap-8 px-8 border-t border-linha-clara text-[20px]" style={{ height: MOSAICO_RODAPE_PX }}>
        <Atualizado atualizadoEm={atualizadoEm} problema={desatualizado || consulta.isError} />
        {config.data && <LegendaCores config={config.data} comSelos={!largo} />}
        {paginas > 1 && (
          <div className="flex items-center gap-3 text-papel-suave numero shrink-0">
            <Paginas atual={pagina} total={paginas} />
          </div>
        )}
      </footer>
    </div>
  );
}

const PONTO_COR: Record<"piscando" | "vermelho" | "laranja" | "verde", string> = {
  piscando: "bg-carro-vermelho ring-4 ring-carro-vermelho/45 ring-offset-[3px] ring-offset-grafite-2",
  vermelho: "bg-carro-vermelho",
  laranja: "bg-carro-laranja",
  verde: "bg-carro-verde",
};

/** Os mesmos símbolos em 16 px, para as legendas do rodapé. */
const PONTO_LEGENDA: Record<keyof typeof PONTO_COR, string> = {
  piscando: "bg-carro-vermelho ring-2 ring-carro-vermelho/45 ring-offset-2 ring-offset-preto",
  vermelho: "bg-carro-vermelho",
  laranja: "bg-carro-laranja",
  verde: "bg-carro-verde",
};

/** Contagem de uma cor na faixa de cima: bolinha grande + número + nome. Zero fica apagado. */
function ContaCor({ cor, valor, um, varios }: { cor: keyof typeof PONTO_COR | "pronto" | "parado"; valor: number; um: string; varios: string }) {
  const zero = valor === 0;
  return (
    <div className={`flex items-center gap-2.5 h-16 pl-3.5 pr-5 rounded-full bg-grafite-2 shrink-0 ${zero ? "opacity-45" : ""}`}>
      {cor === "pronto" || cor === "parado" ? (
        <span aria-hidden="true" className="inline-grid place-items-center w-8 h-8 rounded-full bg-grafite-3 shrink-0">
          <Icone nome={cor === "pronto" ? "ok" : "bloqueio"} tamanho={20} traco={2.25} className={cor === "pronto" ? "text-ok" : "text-papel"} />
        </span>
      ) : (
        <span aria-hidden="true" className={`w-8 h-8 rounded-full shrink-0 ${PONTO_COR[cor]}`} />
      )}
      <dd className="m-0 text-[40px] font-semibold leading-none numero">{valor}</dd>
      <dt className="text-[20px] font-medium leading-none text-papel-suave whitespace-nowrap">{valor === 1 ? um : varios}</dt>
    </div>
  );
}

const diasTexto = (n: number) => (n === 0 ? "Entrega hoje" : `Entrega em até ${n} ${n === 1 ? "dia útil" : "dias úteis"}`);

/**
 * Legenda do rodapé: o que cada cor quer dizer (com os dias da base de Ajustes; "base provisória" enquanto o dono não
 * salvar) e, quando os quadrados só mostram o ícone dos selos, o que cada ícone é.
 */
function LegendaCores({ config, comSelos }: { config: ConfigOficina; comSelos: boolean }) {
  const base = alertaCarroBase(config);
  const itens: { simbolo: ReactNode; texto: ReactNode }[] = [
    ...(base.piscarAtrasado ? [{ simbolo: <Bolinha classe={PONTO_LEGENDA.piscando} />, texto: "Pisca: passou da entrega" }] : []),
    {
      simbolo: <Bolinha classe={PONTO_LEGENDA.vermelho} />,
      texto: `${base.piscarAtrasado ? "" : "Atrasado ou "}${base.piscarAtrasado ? diasTexto(base.vermelhoSemEtapaDiasAntes) : diasTexto(base.vermelhoSemEtapaDiasAntes).toLowerCase()}, nada concluído`,
    },
    { simbolo: <Bolinha classe={PONTO_LEGENDA.laranja} />, texto: diasTexto(base.laranjaDiasAntes) },
    { simbolo: <Bolinha classe={PONTO_LEGENDA.verde} />, texto: "No prazo" },
  ];
  const selos: { icone: NomeIcone; texto: string }[] = comSelos
    ? [
        { icone: "bloqueio", texto: "Parado" },
        { icone: "alerta", texto: "Urgente" },
        { icone: "ajustes", texto: "Prazo próprio" },
      ]
    : [];
  return (
    <ul className="flex-1 min-w-0 flex items-center justify-center gap-6 m-0 p-0 list-none text-papel-suave whitespace-nowrap text-[18px] overflow-hidden">
      {itens.map((i, k) => (
        <li key={k} className="flex items-center gap-2.5">
          {i.simbolo}
          <span>{i.texto}</span>
        </li>
      ))}
      {selos.length > 0 && <li aria-hidden="true" className="w-px h-6 bg-linha-clara" />}
      {selos.map((s) => (
        <li key={s.texto} className="flex items-center gap-2">
          <span className="inline-grid place-items-center w-7 h-7 rounded-full bg-grafite-3 text-papel">
            <Icone nome={s.icone} tamanho={16} traco={2} />
          </span>
          {s.texto}
        </li>
      ))}
      {!config.alertaCarro && <li className="text-papel-fraco">base provisória</li>}
    </ul>
  );
}

function Bolinha({ classe }: { classe: string }) {
  return <span aria-hidden="true" className={`w-4 h-4 rounded-full shrink-0 ${classe}`} />;
}

function MosaicoCarregando({ colunas, largura, altura }: { colunas: number; largura: number; altura: number }) {
  return (
    <div
      role="status"
      aria-label="Carregando o quadro"
      className="grid justify-center content-start"
      style={{ gap: MOSAICO_VAO_PX, gridTemplateColumns: `repeat(${colunas}, ${largura}px)`, gridAutoRows: altura }}
    >
      {Array.from({ length: colunas * 2 }, (_, k) => (
        <div key={k} className="rounded-cartao bg-grafite" />
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ peças comuns

function ChipFiltro({ texto }: { texto: string }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full bg-amarelo text-preto px-4 h-10 text-[20px] font-semibold">
      <Icone nome="filtro" tamanho={18} />
      Só {texto.toLowerCase()}
    </p>
  );
}

function Atualizado({ atualizadoEm, problema }: { atualizadoEm: number; problema: boolean }) {
  return (
    <p className={`shrink-0 numero font-medium ${problema ? "text-cartao bg-alerta rounded-full px-4 py-1" : "text-papel-suave"}`}>
      {atualizadoEm > 0 ? (
        <>
          {problema ? "Sem atualizar desde" : "Atualizado às"} {formatarHora(atualizadoEm)}
          {problema && " — verifique a conexão"}
        </>
      ) : (
        "Aguardando os dados…"
      )}
    </p>
  );
}

function Paginas({ atual, total, rotulo }: { atual: number; total: number; rotulo?: string }) {
  return (
    <>
      <span className="font-medium">{rotulo ? `${rotulo} ${atual + 1} de ${total}` : `${atual + 1}/${total}`}</span>
      <span className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`w-3 h-3 rounded-full ${i === atual ? "bg-amarelo" : "bg-grafite-3"}`} />
        ))}
      </span>
    </>
  );
}

// ------------------------------------------------------------------ por etapas (?visao=etapas)

/**
 * Visão por etapas (a anterior ao mosaico): todas as etapas com carro numa tela, em colunas fluidas; cada coluna
 * encolhe os cartões (cheio → médio → compacto) antes de paginar sozinha a cada 20 s (§5.1). O cabeçalho do cartão
 * vem pintado pela cor do carro. Contadores = contagens do Geral: Na oficina, Atrasados, Parados, Saem hoje.
 */
function TVEtapas() {
  const { consulta, config, filtro, itens, atualizadoEm, desatualizado } = useDadosTV();
  const perfisQ = usePerfis(true, "tv");
  const { l, a } = useTamanhoTela();
  const totais = contarItens(itens);
  const colunas = useMemo(() => montarColunas(filtrarItens(itens, filtro), consulta.data ?? []), [itens, filtro, consulta.data]);

  // colunas fluidas: todas as etapas com carro numa tela (até ~6); acima disso, páginas de colunas
  const alturaColuna = a - CABECALHO_PX - RODAPE_PX - CORPO_Y_PX - TITULO_COLUNA_PX;
  const colunasPorTela = Math.max(1, Math.floor((l - 64 + VAO_PX) / (COLUNA_MIN_PX + VAO_PX)));
  const paginasColunas = Math.max(1, Math.ceil(colunas.length / colunasPorTela));
  const [tique, setTique] = useState(0);
  const densidades = colunas.map((c) => densidadeTV(alturaColuna, c.itens.length, VAO_CARTAO_PX));
  const algumaColunaPagina = densidades.some((d, i) => d.porPagina < colunas[i].itens.length);
  useEffect(() => {
    if (paginasColunas < 2 && !algumaColunaPagina) return;
    const t = setInterval(() => setTique((p) => p + 1), PAGINA_MS);
    return () => clearInterval(t);
  }, [paginasColunas, algumaColunaPagina]);
  const { paginaColunas, paginaDaColuna } = paginasTV(tique, paginasColunas);
  const inicio = paginaColunas * colunasPorTela;
  const visiveis = colunas.slice(inicio, inicio + colunasPorTela).map((c, i) => ({ coluna: c, ...densidades[inicio + i] }));
  const estreito = (l - 64 - (visiveis.length - 1) * VAO_PX) / Math.max(1, visiveis.length) < PLACA_TV_PX;

  return (
    // escura por desenho em qualquer tema: o escopo claro mantém `text-papel`/`text-cartao` claros (docs/painel-design.md "Tema escuro")
    <div data-tema="claro" className="fixed inset-0 bg-preto text-papel cursor-none select-none overflow-hidden flex flex-col">
      {/* cabeçalho */}
      <header className="shrink-0 flex items-center gap-8 px-8 border-b border-linha-clara" style={{ height: CABECALHO_PX }}>
        <div className="flex items-center gap-5 shrink-0">
          <MarcaD tamanho={56} />
          <div className="flex items-center gap-5">
            <h1 className="titulo text-[52px] leading-none">Produção</h1>
            {filtro !== "todos" && <ChipFiltro texto={NOME_FILTRO[filtro]} />}
          </div>
        </div>

        <dl className="flex-1 flex justify-end items-center gap-3 m-0">
          <Contador nome="Na oficina" valor={totais.naOficina} detalhe={`${totais.emServico} em serviço · ${totais.prontos} ${totais.prontos === 1 ? "pronto" : "prontos"}`} />
          <Contador nome="Atrasados" valor={totais.atrasados} tom="alerta" />
          <Contador nome="Parados" valor={totais.parados} tom="atencao" />
          <Contador nome="Saem hoje" valor={totais.hoje} />
        </dl>

        <Relogio />
      </header>

      {/* corpo */}
      <main className="flex-1 min-h-0 px-8 py-5" style={{ paddingTop: CORPO_Y_PX / 2, paddingBottom: CORPO_Y_PX / 2 }}>
        {consulta.isPending || config.isPending ? (
          <Carregando colunas={Math.min(colunasPorTela, 5)} />
        ) : !consulta.data || !config.data ? (
          <Aviso icone="alerta" titulo="Sem conexão com o painel" texto={`Tentando de novo a cada ${ATUALIZAR_MS / 1000} segundos.`} />
        ) : colunas.length === 0 ? (
          <Aviso
            icone="ok"
            titulo={filtro === "todos" ? "Nenhum carro na oficina agora" : `Nenhum carro em “${NOME_FILTRO[filtro].toLowerCase()}”`}
            texto={filtro === "todos" ? "Os carros aparecem aqui quando a recepção registra a entrada." : "Tudo em dia neste recorte."}
          />
        ) : (
          <div className="h-full flex" style={{ gap: VAO_PX }}>
            {visiveis.map(({ coluna, densidade, porPagina }) => {
              const paginas = Math.max(1, Math.ceil(coluna.itens.length / porPagina));
              const pagina = paginaDaColuna(paginas);
              const itensPagina = coluna.itens.slice(pagina * porPagina, (pagina + 1) * porPagina);
              const pronto = coluna.id === COLUNA_PRONTOS;
              return (
                <section key={coluna.id} className="flex-1 min-w-0 max-w-[560px] flex flex-col">
                  <header className="shrink-0 flex items-center justify-between gap-3 border-b-2 border-linha-clara mb-3" style={{ height: TITULO_COLUNA_PX - 12 }}>
                    <h2 className={`flex items-center gap-3 min-w-0 titulo leading-none ${estreito ? "text-[28px]" : "text-[32px]"}`}>
                      {pronto && <span aria-hidden="true" className="w-3.5 h-3.5 rounded-full bg-ok shrink-0" />}
                      <span className="truncate">{pronto ? "Prontos" : coluna.id === COLUNA_SEM_ETAPA ? "Sem etapa" : coluna.nome}</span>
                    </h2>
                    <span className="flex items-center gap-3 shrink-0">
                      {paginas > 1 && (
                        <span className="text-[20px] font-medium text-papel-suave numero">
                          {pagina + 1}/{paginas}
                        </span>
                      )}
                      <span className="inline-grid place-items-center min-w-11 h-10 px-3 rounded-full bg-grafite-3 text-[24px] font-semibold text-papel numero leading-none">
                        {coluna.itens.length}
                      </span>
                    </span>
                  </header>
                  {/* altura fixa por densidade: cartões da mesma linha alinham entre colunas */}
                  <div className="flex-1 min-h-0 grid content-start" style={{ gap: VAO_CARTAO_PX, gridAutoRows: ALTURA_TV[densidade] }}>
                    {itensPagina.map((i) => (
                      <CartaoTV key={i.v.os.id} item={i} perfis={perfisQ.data ?? []} densidade={densidade} estreito={estreito} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* rodapé */}
      <footer className="shrink-0 flex items-center gap-8 px-8 border-t border-linha-clara text-[20px]" style={{ height: RODAPE_PX }}>
        <Atualizado atualizadoEm={atualizadoEm} problema={desatualizado || consulta.isError} />
        {/* o cabeçalho do cartão é a cor do carro (a mesma do mosaico) */}
        <ul className="flex-1 flex items-center justify-center gap-7 m-0 p-0 list-none text-papel-suave">
          <Legenda cor="bg-carro-verde" texto="No prazo" />
          <Legenda cor="bg-carro-laranja" texto="Atenção" />
          <Legenda cor="bg-carro-vermelho" texto="Sem etapa concluída" />
          <Legenda cor={PONTO_LEGENDA.piscando} texto="Atrasado" />
          <Legenda cor="bg-grafite-3" texto="Pronto" />
          <li className="flex items-center gap-2.5">
            <Icone nome="bloqueio" tamanho={20} className="text-papel" />
            Parado
          </li>
        </ul>
        <div className="flex items-center gap-3 text-papel-suave numero">
          {paginasColunas > 1 && <Paginas atual={paginaColunas} total={paginasColunas} rotulo="Etapas" />}
        </div>
      </footer>
    </div>
  );
}

/** Contador do cabeçalho. `tom`: quando > 0, o fundo vira o estado (atrasado em alerta, parado em atenção). */
function Contador({ nome, valor, detalhe, tom }: { nome: string; valor: number; detalhe?: string; tom?: "alerta" | "atencao" }) {
  const aceso = tom && valor > 0;
  return (
    <div className={`flex items-center gap-4 h-16 pl-6 pr-7 rounded-full ${aceso ? (tom === "alerta" ? "bg-alerta text-cartao" : "bg-atencao text-cartao") : "bg-grafite-2"}`}>
      <dt className={`leading-none whitespace-nowrap ${aceso ? "text-cartao" : "text-papel-suave"}`}>
        <span className="block text-[20px] font-medium">{nome}</span>
        {detalhe && <span className="block mt-1 text-[16px] numero">{detalhe}</span>}
      </dt>
      <dd className="m-0 text-[40px] font-semibold leading-none numero">{valor}</dd>
    </div>
  );
}

/** Relógio próprio (1 s) para não redesenhar o quadro inteiro a cada segundo. */
function Relogio() {
  const agora = useAgora(1_000);
  return (
    <div className="shrink-0 text-right pl-8 border-l border-linha-clara">
      <p className="text-[60px] font-semibold leading-none numero tracking-[-0.02em]">{formatarHora(agora)}</p>
      <p className="mt-1 text-[20px] text-papel-suave capitalize">{formatarDataCurta(dataNoFuso(agora))}</p>
    </div>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <li className="flex items-center gap-2.5">
      <span aria-hidden="true" className={`w-4 h-4 rounded-full ${cor}`} />
      {texto}
    </li>
  );
}

function Aviso({ icone, titulo, texto }: { icone: "ok" | "alerta"; titulo: string; texto: string }) {
  return (
    <div className="h-full grid place-content-center justify-items-center gap-5 text-center">
      <span className={`inline-grid place-items-center w-24 h-24 rounded-full ${icone === "alerta" ? "bg-alerta text-cartao" : "bg-grafite-2 text-amarelo"}`}>
        <Icone nome={icone} tamanho={48} />
      </span>
      <p className="titulo text-[48px] leading-tight">{titulo}</p>
      <p className="text-[24px] text-papel-suave">{texto}</p>
    </div>
  );
}

function Carregando({ colunas }: { colunas: number }) {
  return (
    <div role="status" aria-label="Carregando o quadro" className="h-full flex gap-5">
      {Array.from({ length: colunas }, (_, c) => (
        <div key={c} className="flex-1 flex flex-col gap-4">
          <div className="h-11 flex items-center">
            <div className="h-7 w-48 rounded-controle bg-grafite-2" />
          </div>
          <div className="flex-1 rounded-cartao bg-grafite" />
          <div className="flex-1 rounded-cartao bg-grafite" />
        </div>
      ))}
    </div>
  );
}

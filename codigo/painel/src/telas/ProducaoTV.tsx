import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { dataNoFuso } from "@compartilhado/dominio/fuso";
import { useAgora, useConfig, useOSs, usePerfis } from "../dados/hooks";
import { Icone } from "../componentes/Icone";
import { MarcaD } from "../componentes/ui/Marca";
import { CartaoTV } from "../componentes/producao/CartaoTV";
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
  paginasTV,
} from "../componentes/producao/quadro";

const ATUALIZAR_MS = 15_000;
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
 * Quadro da TV da oficina (docs/painel-design.md §4): fundo preto, sem menu, sem cursor, sem foco e
 * sem rolagem. Atualiza a cada 15 s. Todas as etapas com carro numa tela, em colunas fluidas; cada coluna
 * encolhe os cartões (cheio → médio → compacto) antes de paginar sozinha a cada 20 s (§5.1).
 * Filtro fixo pela URL: #/producao/tv?filtro=parados|hoje (atrasados/impedidos antigos caem em parados).
 * Os contadores são as contagens do Geral (src/dominio/contagens.ts): Na oficina, Parados e atrasados, Saem hoje.
 */
export function ProducaoTV() {
  const consulta = useOSs();
  const config = useConfig();
  const perfisQ = usePerfis();
  const agora = useAgora(ATUALIZAR_MS);
  const [params] = useSearchParams();
  const filtro = lerFiltro(params.get("filtro") ?? new URLSearchParams(window.location.search).get("filtro"));
  const { refetch } = consulta;
  const { l, a } = useTamanhoTela();

  useEffect(() => {
    const t = setInterval(() => refetch(), ATUALIZAR_MS);
    return () => clearInterval(t);
  }, [refetch]);

  const itens = useMemo(
    () => (consulta.data && config.data ? montarItens(consulta.data, agora, config.data) : []),
    [consulta.data, config.data, agora],
  );
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

  const atualizadoEm = consulta.dataUpdatedAt;
  const desatualizado = atualizadoEm > 0 && Date.parse(agora) - atualizadoEm > SEM_ATUALIZAR_MS;

  return (
    // escura por desenho em qualquer tema: o escopo claro mantém `text-papel`/`text-cartao` claros (docs/painel-design.md "Tema escuro")
    <div data-tema="claro" className="fixed inset-0 bg-preto text-papel cursor-none select-none overflow-hidden flex flex-col">
      {/* cabeçalho */}
      <header className="shrink-0 flex items-center gap-8 px-8 border-b border-linha-clara" style={{ height: CABECALHO_PX }}>
        <div className="flex items-center gap-5 shrink-0">
          <MarcaD tamanho={56} />
          <div className="flex items-center gap-5">
            <h1 className="titulo text-[52px] leading-none">Produção</h1>
            {filtro !== "todos" && (
              <p className="inline-flex items-center gap-2 rounded-full bg-amarelo text-preto px-4 h-10 text-[20px] font-semibold">
                <Icone nome="filtro" tamanho={18} />
                Só {NOME_FILTRO[filtro].toLowerCase()}
              </p>
            )}
          </div>
        </div>

        <dl className="flex-1 flex justify-end items-center gap-3 m-0">
          <Contador nome="Na oficina" valor={totais.naOficina} detalhe={`${totais.emServico} em serviço · ${totais.prontos} ${totais.prontos === 1 ? "pronto" : "prontos"}`} />
          <Contador nome="Parados e atrasados" valor={totais.parados} alerta />
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
        <p className={`numero font-medium ${desatualizado || consulta.isError ? "text-cartao bg-alerta rounded-full px-4 py-1" : "text-papel-suave"}`}>
          {atualizadoEm > 0 ? (
            <>
              {desatualizado || consulta.isError ? "Sem atualizar desde" : "Atualizado às"} {formatarHora(atualizadoEm)}
              {(desatualizado || consulta.isError) && " — verifique a conexão"}
            </>
          ) : (
            "Aguardando os dados…"
          )}
        </p>
        <ul className="flex-1 flex items-center justify-center gap-7 m-0 p-0 list-none text-papel-suave">
          <Legenda cor="bg-ok" texto="No prazo" />
          <Legenda cor="bg-atencao" texto="Atenção" />
          <Legenda cor="bg-alerta" texto="Atrasado" />
          <Legenda cor="bg-grafite-3" texto="Pronto" />
          <li className="flex items-center gap-2.5">
            <Icone nome="bloqueio" tamanho={20} className="text-papel" />
            Impedido
          </li>
        </ul>
        <div className="flex items-center gap-3 text-papel-suave numero">
          {paginasColunas > 1 && (
            <>
              <span className="font-medium">
                Etapas {paginaColunas + 1} de {paginasColunas}
              </span>
              <span className="flex gap-1.5" aria-hidden="true">
                {Array.from({ length: paginasColunas }, (_, i) => (
                  <span key={i} className={`w-3 h-3 rounded-full ${i === paginaColunas ? "bg-amarelo" : "bg-grafite-3"}`} />
                ))}
              </span>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

function Contador({ nome, valor, detalhe, alerta = false }: { nome: string; valor: number; detalhe?: string; alerta?: boolean }) {
  const vermelho = alerta && valor > 0;
  return (
    <div className={`flex items-center gap-4 h-16 pl-6 pr-7 rounded-full ${vermelho ? "bg-alerta text-cartao" : "bg-grafite-2"}`}>
      <dt className={`leading-none whitespace-nowrap ${vermelho ? "text-cartao" : "text-papel-suave"}`}>
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

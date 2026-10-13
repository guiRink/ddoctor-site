import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { dataNoFuso } from "@compartilhado/dominio/fuso";
import { useAgora, useConfig, useOSs, usePerfis } from "../dados/hooks";
import { Icone } from "../componentes/Icone";
import { CartaoTV } from "../componentes/producao/CartaoTV";
import {
  NOME_FILTRO,
  contarItens,
  filtrarItens,
  formatarDataCurta,
  formatarHora,
  lerFiltro,
  montarColunas,
  montarItens,
  type ColunaQuadro,
  type ItemQuadro,
} from "../componentes/producao/quadro";

const ATUALIZAR_MS = 15_000;
const PAGINA_MS = 20_000;
const SEM_ATUALIZAR_MS = 60_000; // acima disso o rodapé avisa que o quadro pode estar desatualizado
const CABECALHO_PX = 104;
const RODAPE_PX = 56;
const CORPO_Y_PX = 40; // respiro vertical do corpo
const TITULO_COLUNA_PX = 56;
const CARTAO_MIN_PX = 380;
const COLUNA_MIN_PX = 340;
const VAO_PX = 20;

/** Uma fatia de coluna que cabe na altura da tela (colunas longas continuam ao lado). */
interface Fatia {
  chave: string;
  nome: string;
  parte: number;
  partes: number;
  total: number;
  itens: ItemQuadro[];
}

function fatiar(colunas: ColunaQuadro[], porColuna: number): Fatia[] {
  return colunas.flatMap((c) => {
    const partes = Math.max(1, Math.ceil(c.itens.length / porColuna));
    return Array.from({ length: partes }, (_, i) => ({
      chave: `${c.id}-${i}`,
      nome: c.nome,
      parte: i + 1,
      partes,
      total: c.itens.length,
      itens: c.itens.slice(i * porColuna, (i + 1) * porColuna),
    }));
  });
}

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
 * sem rolagem. Atualiza a cada 15 s e, se não couber, troca de página a cada 20 s.
 * Filtro fixo pela URL: #/producao/tv?filtro=atrasados|hoje|impedidos.
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

  const porColuna = Math.max(1, Math.floor((a - CABECALHO_PX - RODAPE_PX - CORPO_Y_PX - TITULO_COLUNA_PX) / CARTAO_MIN_PX));
  const porPagina = Math.max(1, Math.floor((l - 64 + VAO_PX) / (COLUNA_MIN_PX + VAO_PX)));
  const fatias = fatiar(colunas, porColuna);
  const paginas = Math.max(1, Math.ceil(fatias.length / porPagina));

  const [pagina, setPagina] = useState(0);
  useEffect(() => {
    if (paginas < 2) return;
    const t = setInterval(() => setPagina((p) => p + 1), PAGINA_MS);
    return () => clearInterval(t);
  }, [paginas]);
  const atual = pagina % paginas;
  const visiveis = fatias.slice(atual * porPagina, (atual + 1) * porPagina);

  const atualizadoEm = consulta.dataUpdatedAt;
  const desatualizado = atualizadoEm > 0 && Date.parse(agora) - atualizadoEm > SEM_ATUALIZAR_MS;

  return (
    <div className="fixed inset-0 bg-preto text-papel cursor-none select-none overflow-hidden flex flex-col">
      {/* cabeçalho */}
      <header className="shrink-0 flex items-center gap-8 px-8 border-b border-linha-clara" style={{ height: CABECALHO_PX }}>
        <div className="flex items-center gap-5 shrink-0">
          <img src={`${import.meta.env.BASE_URL}logo-mark.svg`} alt="" width={64} height={64} />
          <div className="flex items-center gap-5">
            <h1 className="titulo-condensado text-[56px] leading-none">Produção</h1>
            {filtro !== "todos" && (
              <p className="inline-flex items-center gap-2 bg-amarelo text-preto px-2.5 h-8 text-[18px] font-bold uppercase tracking-[0.06em]">
                <Icone nome="filtro" tamanho={18} />
                Só {NOME_FILTRO[filtro].toLowerCase()}
              </p>
            )}
          </div>
        </div>

        <dl className="flex-1 flex justify-end items-stretch gap-3 m-0">
          <Contador nome="Na oficina" valor={totais.naOficina} />
          <Contador nome="Atrasados" valor={totais.atrasados} alerta />
          <Contador nome="Impedidos" valor={totais.impedidos} alerta />
          <Contador nome="Entregam hoje" valor={totais.hoje} />
        </dl>

        <Relogio />
      </header>

      {/* corpo */}
      <main className="flex-1 min-h-0 px-8 py-5" style={{ paddingTop: CORPO_Y_PX / 2, paddingBottom: CORPO_Y_PX / 2 }}>
        {consulta.isPending || config.isPending ? (
          <Carregando colunas={Math.min(porPagina, 5)} />
        ) : !consulta.data || !config.data ? (
          <Aviso icone="alerta" titulo="Sem conexão com o painel" texto={`Tentando de novo a cada ${ATUALIZAR_MS / 1000} segundos.`} />
        ) : fatias.length === 0 ? (
          <Aviso
            icone="ok"
            titulo={filtro === "todos" ? "Nenhum carro na produção agora" : `Nenhum carro em “${NOME_FILTRO[filtro].toLowerCase()}”`}
            texto={filtro === "todos" ? "Os carros aparecem aqui quando a recepção registra a entrada." : "Tudo em dia neste recorte."}
          />
        ) : (
          <div className="h-full flex gap-5">
            {visiveis.map((f) => (
              <section key={f.chave} className="flex-1 min-w-0 max-w-[460px] flex flex-col">
                <header className="shrink-0 flex items-end justify-between gap-3 border-b-4 border-papel pb-2 mb-3" style={{ height: TITULO_COLUNA_PX - 12 }}>
                  <h2 className="text-[32px] font-extrabold leading-none truncate">
                    {f.nome}
                    {f.parte > 1 && <span className="text-papel-suave font-bold"> (cont.)</span>}
                  </h2>
                  <span className="text-[24px] font-bold text-papel-suave numero leading-none whitespace-nowrap">
                    {f.total}
                  </span>
                </header>
                <div className="flex-1 min-h-0 grid gap-3" style={{ gridTemplateRows: `repeat(${porColuna}, minmax(0, 1fr))` }}>
                  {f.itens.map((i) => (
                    <CartaoTV key={i.v.os.id} item={i} agora={agora} perfis={perfisQ.data ?? []} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* rodapé */}
      <footer className="shrink-0 flex items-center gap-8 px-8 border-t border-linha-clara text-[20px]" style={{ height: RODAPE_PX }}>
        <p className={`numero font-semibold ${desatualizado || consulta.isError ? "text-cartao bg-alerta px-3 py-1" : "text-papel-suave"}`}>
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
          <Legenda cor="bg-alerta" texto="Atrasado ou impedido" />
          <Legenda cor="bg-grafite-3" texto="Pronto" />
        </ul>
        <div className="flex items-center gap-3 text-papel-suave numero">
          {paginas > 1 && (
            <>
              <span className="font-semibold">
                Página {atual + 1} de {paginas}
              </span>
              <span className="flex gap-1.5" aria-hidden="true">
                {Array.from({ length: paginas }, (_, i) => (
                  <span key={i} className={`w-3 h-3 ${i === atual ? "bg-amarelo" : "bg-grafite-3"}`} />
                ))}
              </span>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

function Contador({ nome, valor, alerta = false }: { nome: string; valor: number; alerta?: boolean }) {
  const vermelho = alerta && valor > 0;
  return (
    <div className={`flex flex-col justify-center min-w-[148px] px-5 py-2 ${vermelho ? "bg-alerta text-cartao" : "bg-grafite-2"}`}>
      <dt className={`text-[14px] font-bold uppercase tracking-[0.08em] leading-none ${vermelho ? "text-cartao" : "text-papel-suave"}`}>{nome}</dt>
      <dd className="m-0 mt-1.5 text-[48px] font-extrabold leading-none numero">{valor}</dd>
    </div>
  );
}

/** Relógio próprio (1 s) para não redesenhar o quadro inteiro a cada segundo. */
function Relogio() {
  const agora = useAgora(1_000);
  return (
    <div className="shrink-0 text-right pl-8 border-l border-linha-clara">
      <p className="text-[64px] font-extrabold leading-none numero tracking-[-0.02em]">{formatarHora(agora)}</p>
      <p className="mt-1 text-[20px] text-papel-suave capitalize">{formatarDataCurta(dataNoFuso(agora))}</p>
    </div>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <li className="flex items-center gap-2.5">
      <span aria-hidden="true" className={`w-5 h-5 ${cor}`} />
      {texto}
    </li>
  );
}

function Aviso({ icone, titulo, texto }: { icone: "ok" | "alerta"; titulo: string; texto: string }) {
  return (
    <div className="h-full grid place-content-center justify-items-center gap-5 text-center">
      <span className={`inline-grid place-items-center w-24 h-24 ${icone === "alerta" ? "bg-alerta text-cartao" : "bg-grafite-2 text-amarelo"}`}>
        <Icone nome={icone} tamanho={48} />
      </span>
      <p className="text-[48px] font-extrabold leading-tight">{titulo}</p>
      <p className="text-[24px] text-papel-suave">{texto}</p>
    </div>
  );
}

function Carregando({ colunas }: { colunas: number }) {
  return (
    <div role="status" aria-label="Carregando o quadro" className="h-full flex gap-5">
      {Array.from({ length: colunas }, (_, c) => (
        <div key={c} className="flex-1 flex flex-col gap-4">
          <div className="h-11 border-b-4 border-grafite-3" />
          <div className="flex-1 bg-grafite" />
          <div className="flex-1 bg-grafite" />
        </div>
      ))}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useHref, useSearchParams } from "react-router-dom";
import { useAgora, useConfig, useOSs, usePerfis } from "../dados/hooks";
import { useSessao } from "../dados/sessao";
import { podeEditar, podeVer } from "../dominio/permissoes";
import { Botao, BotaoExterno, BotaoLink, CabecalhoPagina, Contagem, Erro, SUPERFICIE, Vazio } from "../componentes/ui/Basicos";
import { GrupoFiltros } from "../componentes/ui/Filtros";
import { CartaoQuadro } from "../componentes/producao/CartaoQuadro";
import { PainelOS } from "../componentes/producao/PainelOS";
import {
  COLUNA_PRONTOS,
  FILTROS,
  NOME_FILTRO,
  contarItens,
  filtrarItens,
  lerFiltro,
  montarColunas,
  montarItens,
  type FiltroQuadro,
} from "../componentes/producao/quadro";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Produção — quadro do gestor (docs/painel-design.md §5: o quadro é o elemento dominante). */
export function Producao() {
  const consulta = useOSs();
  const config = useConfig();
  const perfisQ = usePerfis();
  const agora = useAgora(30_000);
  const { perfil } = useSessao();
  const [params, setParams] = useSearchParams();
  const hrefTV = useHref("/producao/tv");
  const origemFoco = useRef<HTMLButtonElement | null>(null);
  const quadro = useRef<HTMLDivElement>(null);
  const rolagem = useRolagemHorizontal(quadro);

  const filtro = lerFiltro(params.get("filtro"));
  const responsavel = params.get("responsavel") ?? "";
  const selecionadoId = params.get("os");
  const editar = podeEditar(perfil.papel, "producao");

  const mudar = useCallback(
    (chave: string, valor: string | null) =>
      setParams(
        (atual) => {
          const p = new URLSearchParams(atual);
          if (valor) p.set(chave, valor);
          else p.delete(chave);
          return p;
        },
        { replace: true },
      ),
    [setParams],
  );

  const fechar = useCallback(() => {
    mudar("os", null);
    // o cartão pode ter mudado de coluna (ex.: etapa dispensada); sem ele, o foco volta ao quadro
    if (origemFoco.current?.isConnected) origemFoco.current.focus();
    else quadro.current?.focus();
  }, [mudar]);

  const perfis = useMemo(() => perfisQ.data ?? [], [perfisQ.data]);
  const itens = useMemo(
    () => (consulta.data && config.data ? montarItens(consulta.data, agora, config.data) : []),
    [consulta.data, config.data, agora],
  );
  const filtrados = useMemo(() => filtrarItens(itens, filtro, responsavel || undefined), [itens, filtro, responsavel]);
  const colunas = useMemo(() => montarColunas(filtrados, consulta.data ?? []), [filtrados, consulta.data]);
  const totais = contarItens(itens);
  const porFiltro = (f: FiltroQuadro) => filtrarItens(itens, f, responsavel || undefined).length;
  const funcionarios = perfis.filter((p) => p.papel === "producao" && p.ativo);
  const selecionado = itens.find((i) => i.v.os.id === selecionadoId)?.v;

  const resumo = consulta.data ? (
    <span className="numero">
      {plural(totais.naOficina, "carro na oficina", "carros na oficina")}
      {totais.atrasados > 0 && <span className="text-alerta font-semibold"> · {plural(totais.atrasados, "atrasado", "atrasados")}</span>}
      {totais.impedidos > 0 && <span className="text-alerta font-semibold"> · {plural(totais.impedidos, "impedido", "impedidos")}</span>}
      {totais.prontos > 0 && <> · {plural(totais.prontos, "pronto para entrega", "prontos para entrega")}</>}
    </span>
  ) : undefined;

  return (
    <>
      <CabecalhoPagina
        titulo="Produção"
        resumo={resumo}
        acoes={
          podeVer(perfil.papel, "tv") && (
            <BotaoExterno href={hrefTV} icone="tv" className="max-md:hidden">
              Abrir quadro da TV
            </BotaoExterno>
          )
        }
      />

      {/* filtros */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 mb-5">
        <GrupoFiltros<FiltroQuadro>
          rotulo="Filtrar o quadro"
          mostrarRotulo={false}
          valor={filtro}
          onMudar={(f) => mudar("filtro", f === "todos" ? null : f)}
          opcoes={FILTROS.map((f) => {
            const n = porFiltro(f);
            return {
              valor: f,
              texto: NOME_FILTRO[f],
              contagem: consulta.data ? n : "–",
              critico: (f === "atrasados" || f === "impedidos") && n > 0,
            };
          })}
        />
        <label className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-tinta-suave">Responsável</span>
          <span className="relative inline-flex">
          <select
            value={responsavel}
            onChange={(e) => mudar("responsavel", e.target.value || null)}
            className="appearance-none h-11 md:h-9 pl-3 pr-9 bg-cartao border border-linha-forte shadow-controle text-[13px] font-medium text-tinta outline-none cursor-pointer hover:border-tinta-fraca focus:border-tinta-fraca focus:ring-[3px] focus:ring-amarelo/30 transition-colors duration-150"
          >
            <option value="">Todos</option>
            {funcionarios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} ({itens.filter((i) => i.responsavelId === p.id).length})
              </option>
            ))}
          </select>
          </span>
        </label>
        {(filtro !== "todos" || responsavel) && (
          <Botao tamanho="denso" variante="fantasma" icone="fechar" onClick={() => setParams({}, { replace: true })}>
            Limpar filtros
          </Botao>
        )}
        {(rolagem.esquerda || rolagem.direita) && (
          <div className="hidden md:flex items-center gap-1 ml-auto">
            <span className="text-[13px] text-tinta-suave mr-1.5">Mais colunas</span>
            <Botao tamanho="denso" variante="contorno" icone="voltar" aria-label="Rolar o quadro para a esquerda" disabled={!rolagem.esquerda} onClick={() => rolagem.rolar(-1)} />
            <Botao tamanho="denso" variante="contorno" icone="seta" aria-label="Rolar o quadro para a direita" disabled={!rolagem.direita} onClick={() => rolagem.rolar(1)} />
          </div>
        )}
      </div>

      {/* quadro */}
      {consulta.isPending || config.isPending ? (
        <QuadroCarregando />
      ) : consulta.isError || config.isError || !consulta.data ? (
        <Erro mensagem="Não consegui carregar o quadro de produção." onTentar={() => (consulta.refetch(), config.refetch())} />
      ) : itens.length === 0 ? (
        <div className={SUPERFICIE}>
          <Vazio
            icone="producao"
            titulo="Nenhum carro na oficina agora"
            texto="Os carros entram no quadro quando a recepção registra a entrada na ficha da OS. As etapas são geradas pelo tipo de reparo."
            acao={
              podeVer(perfil.papel, "agenda") ? (
                <BotaoLink para="/agenda" variante="secundario" icone="agenda">
                  Ver quem chega hoje
                </BotaoLink>
              ) : undefined
            }
          />
        </div>
      ) : colunas.length === 0 ? (
        <div className={SUPERFICIE}>
          <Vazio
            icone="filtro"
            titulo={filtro === "todos" ? "Nenhum carro com esse responsável" : `Nenhum carro em “${NOME_FILTRO[filtro]}”`}
            texto={filtro === "atrasados" || filtro === "impedidos" ? "Bom sinal: nada travado nesse recorte." : "Troque o filtro para ver os outros carros."}
            acao={
              <Botao variante="contorno" onClick={() => setParams({}, { replace: true })}>
                Ver todos os carros
              </Botao>
            }
          />
        </div>
      ) : (
        <div
          ref={quadro}
          role="region"
          aria-label="Quadro de produção por etapa"
          tabIndex={0}
          className={`flex flex-col gap-6 md:flex-row md:gap-3 md:overflow-x-auto md:pb-3 ${selecionado ? "md:pr-[420px]" : ""}`}
        >
          {colunas.map((c) => {
            const execucao = c.itens.filter((i) => i.resumo.atual?.estado === "em_execucao").length;
            const fila = c.itens.filter((i) => i.resumo.atual?.estado === "na_fila").length;
            const parados = c.itens.filter((i) => i.impedido).length;
            const partes = [execucao && `${execucao} em exec.`, parados && `${parados} ${parados === 1 ? "impedido" : "impedidos"}`, fila && `${fila} na fila`].filter(Boolean);
            const pronto = c.id === COLUNA_PRONTOS;
            return (
              <section key={c.id} aria-label={`${c.nome}: ${c.itens.length}`} className="md:w-[256px] md:shrink-0 min-w-0">
                <header className="flex items-center justify-between gap-2 h-10 mb-2 px-0.5">
                  <h2 className="flex items-center gap-2 min-w-0 text-[15px] font-semibold">
                    {pronto && <span aria-hidden="true" className="w-2 h-2 rounded-full bg-ok shrink-0" />}
                    <span className="truncate">{c.nome}</span>
                    <Contagem n={c.itens.length} tom={pronto ? "ok" : "neutro"} />
                  </h2>
                  {!pronto && partes.length > 0 && <span className="text-[12px] text-tinta-fraca numero whitespace-nowrap">{partes.join(" · ")}</span>}
                </header>
                <ul className="m-0 p-0 flex flex-col gap-2.5">
                  {c.itens.map((i) => (
                    <CartaoQuadro
                      key={i.v.os.id}
                      item={i}
                      agora={agora}
                      config={config.data!}
                      perfis={perfis}
                      selecionado={i.v.os.id === selecionadoId}
                      onAbrir={(id, origem) => {
                        origemFoco.current = origem;
                        mudar("os", id === selecionadoId ? null : id);
                      }}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {selecionado && config.data && (
        <PainelOS
          key={selecionado.os.id}
          v={selecionado}
          agora={agora}
          config={config.data}
          perfis={perfis}
          podeEditar={editar}
          podeAbrirFicha={podeVer(perfil.papel, "orcamentos")}
          onFechar={fechar}
        />
      )}
    </>
  );
}

function QuadroCarregando() {
  return (
    <div role="status" aria-label="Carregando o quadro" className="flex flex-col gap-6 md:flex-row md:gap-3 overflow-hidden">
      {[3, 2, 2, 1].map((n, c) => (
        <div key={c} className="md:w-[256px] md:shrink-0">
          <div className="h-10 mb-2 flex items-center">
            <div className="esqueleto h-4 w-28" />
          </div>
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: n }, (_, i) => (
              <div key={i} className="esqueleto h-[212px] rounded-cartao" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Indica se o quadro tem colunas escondidas à esquerda/direita (no macOS a barra de rolagem some). */
function useRolagemHorizontal(ref: RefObject<HTMLDivElement | null>) {
  const [estado, setEstado] = useState({ esquerda: false, direita: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const largo = window.matchMedia("(min-width: 768px)").matches;
      const esquerda = largo && el.scrollLeft > 4;
      const direita = largo && el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
      setEstado((a) => (a.esquerda === esquerda && a.direita === direita ? a : { esquerda, direita }));
    };
    medir();
    el.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => {
      el.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
      obs.disconnect();
    };
  });
  return {
    ...estado,
    rolar: (sentido: 1 | -1) =>
      ref.current?.scrollBy({
        left: sentido * 268,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      }),
  };
}

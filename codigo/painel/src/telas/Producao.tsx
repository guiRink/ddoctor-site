import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useHref, useSearchParams } from "react-router-dom";
import { useAgora, useConfig, useOSs, usePerfis } from "../dados/hooks";
import { useSessao } from "../dados/sessao";
import { podeEditar, podeVer } from "../dominio/permissoes";
import { Botao, BotaoLink, CabecalhoPagina, Erro, Vazio } from "../componentes/ui/Basicos";
import { Icone } from "../componentes/Icone";
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
            <a
              href={hrefTV}
              target="_blank"
              rel="noopener"
              className="hidden md:inline-flex items-center justify-center gap-2 h-11 px-4 font-bold no-underline bg-cartao text-tinta border border-linha-forte hover:border-preto transition-colors duration-150"
            >
              <Icone nome="tv" />
              Abrir quadro da TV
              <span className="sr-only">(abre em nova aba)</span>
            </a>
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
          <span className="rotulo text-tinta-fraca">Responsável</span>
          <select
            value={responsavel}
            onChange={(e) => mudar("responsavel", e.target.value || null)}
            className="h-11 md:h-9 px-2 bg-cartao border border-linha-forte font-semibold text-tinta"
          >
            <option value="">Todos</option>
            {funcionarios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} ({itens.filter((i) => i.responsavelId === p.id).length})
              </option>
            ))}
          </select>
        </label>
        {(filtro !== "todos" || responsavel) && (
          <Botao tamanho="denso" variante="fantasma" icone="fechar" onClick={() => setParams({}, { replace: true })}>
            Limpar filtros
          </Botao>
        )}
        {(rolagem.esquerda || rolagem.direita) && (
          <div className="hidden md:flex items-center gap-1 ml-auto">
            <span className="text-[12px] text-tinta-suave mr-1">Mais colunas</span>
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
        <div className="bg-cartao border border-linha">
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
        <div className="bg-cartao border border-linha">
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
                <header className={`flex items-baseline justify-between gap-2 h-11 mb-2.5 border-b-2 ${pronto ? "border-ok" : "border-preto"}`}>
                  <h2 className="text-[16px] font-bold truncate">{c.nome}</h2>
                  <span className="text-[12px] text-tinta-suave numero whitespace-nowrap">
                    {pronto ? (
                      <span className="text-[16px] font-bold text-tinta">{c.itens.length}</span>
                    ) : (
                      <>
                        {partes.join(" · ")}
                        <span className="ml-2 text-[16px] font-bold text-tinta">{c.itens.length}</span>
                      </>
                    )}
                  </span>
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
          <div className="h-11 mb-2.5 border-b-2 border-linha" />
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: n }, (_, i) => (
              <div key={i} className="esqueleto h-[212px]" />
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

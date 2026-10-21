import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useHref, useSearchParams } from "react-router-dom";
import { useAgora, useConfig, useOSs, usePerfis } from "../dados/hooks";
import { useSessao } from "../dados/sessao";
import { podeEditar, podeVer } from "../dominio/permissoes";
import { Botao, BotaoExterno, BotaoLink, Erro, SUPERFICIE, Vazio } from "../componentes/ui/Basicos";
import { GrupoFiltros } from "../componentes/ui/Filtros";
import { FiltroSelecao } from "../componentes/ui/Campos";
import { Abas, PainelAba } from "../componentes/ui/Abas";
import { CartaoQuadro } from "../componentes/producao/CartaoQuadro";
import { ListaProducao } from "../componentes/producao/ListaProducao";
import { PainelOS } from "../componentes/producao/PainelOS";
import { QuadroColunas } from "../componentes/producao/QuadroColunas";
import {
  CHAVE_VISAO,
  COLUNA_PRONTOS,
  COLUNA_SEM_ETAPA,
  FILTROS,
  NOME_FILTRO,
  contarItens,
  etapasSemCarro,
  filtrarItens,
  lerFiltro,
  lerVisao,
  montarColunas,
  montarItens,
  ordenarPorUrgencia,
  type FiltroQuadro,
  type VisaoProducao,
} from "../componentes/producao/quadro";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const TODAS = "__todas";

/**
 * Produção — quadro do gestor (docs/painel-design.md §5.1).
 * Computador: quadro de colunas fluidas ou lista por urgência (escolha salva no aparelho).
 * Celular: abas de etapa + lista de cartões grandes; o carro abre em tela cheia.
 */
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
  const largo = useLargo();
  const [visao, setVisao] = useVisao();

  const filtro = lerFiltro(params.get("filtro"));
  const responsavel = params.get("responsavel") ?? "";
  const etapaCelular = params.get("etapa") ?? TODAS;
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
  const limpar = () => setParams({}, { replace: true });

  const fechar = useCallback(() => {
    mudar("os", null);
    // o cartão pode ter mudado de coluna (ex.: etapa dispensada); sem ele, o foco volta ao quadro
    if (origemFoco.current?.isConnected) origemFoco.current.focus();
    else quadro.current?.focus();
  }, [mudar]);

  const abrir = useCallback(
    (id: string, origem: HTMLButtonElement) => {
      origemFoco.current = origem;
      mudar("os", id === selecionadoId ? null : id);
    },
    [mudar, selecionadoId],
  );

  const perfis = useMemo(() => perfisQ.data ?? [], [perfisQ.data]);
  const itens = useMemo(
    () => (consulta.data && config.data ? montarItens(consulta.data, agora, config.data) : []),
    [consulta.data, config.data, agora],
  );
  const filtrados = useMemo(() => filtrarItens(itens, filtro, responsavel || undefined), [itens, filtro, responsavel]);
  const colunas = useMemo(() => montarColunas(filtrados, consulta.data ?? []), [filtrados, consulta.data]);
  const porUrgencia = useMemo(() => ordenarPorUrgencia(filtrados), [filtrados]);
  const semCarro = useMemo(() => etapasSemCarro(itens, consulta.data ?? []), [itens, consulta.data]);
  const totais = contarItens(itens);
  const porFiltro = (f: FiltroQuadro) => filtrarItens(itens, f, responsavel || undefined).length;
  const funcionarios = perfis.filter((p) => p.papel === "producao" && p.ativo);
  const selecionado = itens.find((i) => i.v.os.id === selecionadoId)?.v;
  const filtrando = filtro !== "todos" || !!responsavel;
  const carregando = consulta.isPending || config.isPending;
  const erro = consulta.isError || config.isError || (!carregando && !consulta.data);

  // celular: aba de etapa (só etapas com carro); se a aba sumiu com o filtro, volta para "Todas"
  const colunaCelular = colunas.find((c) => c.id === etapaCelular);
  const abaCelular = colunaCelular ? etapaCelular : TODAS;
  const itensCelular = colunaCelular ? colunaCelular.itens : porUrgencia;

  // os mesmos números do Geral (src/dominio/contagens.ts): Na oficina = em serviço + prontos
  const resumo = consulta.data ? (
    <span className="numero">
      <span className="whitespace-nowrap">Na oficina {totais.naOficina}</span> · <span className="whitespace-nowrap">{totais.emServico} em serviço</span> ·{" "}
      <span className="whitespace-nowrap">{plural(totais.prontos, "pronto", "prontos")}</span>
      {totais.atrasados > 0 && <span className="text-alerta font-semibold"> · <span className="whitespace-nowrap">{plural(totais.atrasados, "atrasado", "atrasados")}</span></span>}
      {totais.parados > 0 && <span className="text-atencao font-semibold"> · <span className="whitespace-nowrap">{plural(totais.parados, "parado", "parados")}</span></span>}
    </span>
  ) : (
    <span className="inline-block esqueleto h-4 w-64 align-middle" />
  );

  const segmentos = (
    <GrupoFiltros<FiltroQuadro>
      rotulo="Filtrar a produção"
      mostrarRotulo={false}
      valor={filtro}
      onMudar={(f) => mudar("filtro", f === "todos" ? null : f)}
      opcoes={FILTROS.map((f) => {
        const n = porFiltro(f);
        return {
          valor: f,
          texto: NOME_FILTRO[f],
          contagem: consulta.data ? n : "–",
          critico: (f === "atrasados" || f === "vermelhos" || f === "parados") && n > 0,
        };
      })}
    />
  );
  const seletorResponsavel = (
    <FiltroSelecao rotulo="Responsável" valor={responsavel} onMudar={(v) => mudar("responsavel", v || null)}>
      <option value="">Todos</option>
      {funcionarios.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nome} ({itens.filter((i) => i.responsavelId === p.id).length})
        </option>
      ))}
    </FiltroSelecao>
  );
  const botaoLimpar = filtrando && (
    <Botao tamanho="denso" variante="fantasma" icone="fechar" onClick={limpar}>
      Limpar filtros
    </Botao>
  );

  let conteudo;
  if (carregando) conteudo = largo ? visao === "lista" ? <ListaCarregando /> : <QuadroCarregando /> : <CelularCarregando />;
  else if (erro) conteudo = <Erro mensagem="Não consegui carregar a produção." onTentar={() => (consulta.refetch(), config.refetch())} />;
  else if (itens.length === 0)
    conteudo = (
      <div className={SUPERFICIE}>
        <Vazio
          icone="producao"
          titulo="Nenhum carro na oficina agora"
          texto="Os carros aparecem aqui quando a recepção registra a entrada."
          acao={
            podeVer(perfil.papel, "agenda") ? (
              <BotaoLink para="/agenda" variante="secundario" icone="agenda">
                Ver quem chega hoje
              </BotaoLink>
            ) : undefined
          }
        />
      </div>
    );
  else if (filtrados.length === 0)
    conteudo = (
      <div className={SUPERFICIE}>
        <Vazio
          icone="filtro"
          titulo={filtro === "todos" ? "Nenhum carro com esse responsável" : `Nenhum carro em “${NOME_FILTRO[filtro]}”`}
          texto={
            filtro === "parados"
              ? "Nenhum carro parado."
              : filtro === "atrasados"
                ? "Tudo dentro do prazo."
                : filtro === "vermelhos"
                  ? "Nenhum carro perto da entrega sem etapa concluída."
                  : filtro === "laranjas"
                    ? "Nenhum carro perto da entrega com etapa por terminar."
                    : undefined
          }
          acao={
            <Botao variante="contorno" onClick={limpar}>
              Ver todos os carros
            </Botao>
          }
        />
      </div>
    );
  else if (largo)
    conteudo =
      visao === "lista" ? (
        <ListaProducao itens={porUrgencia} agora={agora} perfis={perfis} selecionadoId={selecionadoId} onAbrir={abrir} />
      ) : (
        <QuadroColunas colunas={colunas} agora={agora} perfis={perfis} selecionadoId={selecionadoId} onAbrir={abrir} refQuadro={quadro} />
      );
  else
    conteudo = (
      <>
        <div className="sticky top-14 z-10 mb-4">
          <Abas
            rotulo="Etapas"
            idBase="producao-etapa"
            className="mb-0 bg-papel"
            valor={abaCelular}
            onMudar={(v) => mudar("etapa", v === TODAS ? null : v)}
            abas={[
              { valor: TODAS, texto: "Todas", contagem: filtrados.length },
              ...colunas.map((c) => ({
                valor: c.id,
                texto: c.id === COLUNA_PRONTOS ? "Prontos" : c.id === COLUNA_SEM_ETAPA ? "Sem etapa" : c.nome,
                contagem: c.itens.length,
                critico: c.itens.some((i) => i.parado),
              })),
            ]}
          />
        </div>
        <PainelAba idBase="producao-etapa" valor={abaCelular}>
          <ul className="m-0 p-0 flex flex-col gap-3">
            {itensCelular.map((i) => (
              <CartaoQuadro
                key={i.v.os.id}
                item={i}
                agora={agora}
                perfis={perfis}
                selecionado={i.v.os.id === selecionadoId}
                onAbrir={abrir}
                variante="grande"
                mostrarEtapa={abaCelular === TODAS}
              />
            ))}
          </ul>
        </PainelAba>
      </>
    );

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 mb-5">
        <div className="min-w-0">
          <h1 className="titulo-pagina text-tinta">Produção</h1>
          <p className="mt-1 text-tinta-suave text-[14px]">{resumo}</p>
        </div>
        {largo && podeVer(perfil.papel, "tv") && (
          <BotaoExterno href={hrefTV} icone="tv">
            Abrir quadro da TV
          </BotaoExterno>
        )}
      </header>

      {/* barra de ferramentas: uma linha no computador; fileira rolável no celular */}
      {largo ? (
        <div className="flex items-center gap-x-4 gap-y-3 flex-wrap mb-3">
          {segmentos}
          {seletorResponsavel}
          {botaoLimpar}
          <div className="ml-auto">
            <GrupoFiltros<VisaoProducao>
              rotulo="Visão"
              mostrarRotulo={false}
              valor={visao}
              onMudar={setVisao}
              opcoes={[
                { valor: "quadro", texto: "Quadro" },
                { valor: "lista", texto: "Lista" },
              ]}
            />
          </div>
        </div>
      ) : (
        <div className="-mx-4 px-4 mb-3 overflow-x-auto">
          <div className="flex items-center gap-3 w-max pr-4">
            {segmentos}
            {seletorResponsavel}
            {botaoLimpar}
          </div>
        </div>
      )}

      {largo && !carregando && !erro && itens.length > 0 && (
        <p className="mb-4 text-[13px] text-tinta-suave min-h-5">
          {semCarro.length > 0 && (
            <>
              <span className="text-tinta-fraca">Sem carro agora:</span> {semCarro.join(" · ")}
            </>
          )}
        </p>
      )}

      {conteudo}

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

// ------------------------------------------------------------------ preferências da tela

const LARGO = "(min-width: 768px)";

/** Computador/tablet (quadro e lista) × celular (abas de etapa). */
function useLargo(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const m = window.matchMedia(LARGO);
      m.addEventListener("change", avisar);
      return () => m.removeEventListener("change", avisar);
    },
    () => window.matchMedia(LARGO).matches,
    () => true,
  );
}

/** Quadro ou Lista, salvo no aparelho. */
function useVisao(): [VisaoProducao, (v: VisaoProducao) => void] {
  const [visao, setVisao] = useState<VisaoProducao>(() => {
    try {
      return lerVisao(localStorage.getItem(CHAVE_VISAO));
    } catch {
      return "quadro";
    }
  });
  const mudar = useCallback((v: VisaoProducao) => {
    setVisao(v);
    try {
      localStorage.setItem(CHAVE_VISAO, v);
    } catch {
      /* sem armazenamento: vale só nesta visita */
    }
  }, []);
  return [visao, mudar];
}

// ------------------------------------------------------------------ esqueletos

function QuadroCarregando() {
  return (
    <div role="status" aria-label="Carregando o quadro" className="grid gap-3 overflow-hidden" style={{ gridTemplateColumns: "repeat(5, minmax(208px, 1fr))", maxWidth: 5 * 360 }}>
      {[3, 2, 2, 1, 2].map((n, c) => (
        <div key={c} className="rounded-cartao bg-cinza-100 p-1.5">
          <div className="px-1.5 pt-1 pb-2">
            <div className="esqueleto h-4 w-24" />
            <div className="esqueleto h-3 w-32 mt-2" />
          </div>
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: n }, (_, i) => (
              <div key={i} className="h-[118px] rounded-cartao bg-cartao border border-linha" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ListaCarregando() {
  return (
    <div role="status" aria-label="Carregando a lista" className={`${SUPERFICIE} overflow-hidden`}>
      <div className="h-10 border-b border-linha" />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-[60px] px-3 flex items-center gap-6 border-b border-linha last:border-b-0">
          <div className="esqueleto h-7 w-24" />
          <div className="esqueleto h-4 w-40" />
          <div className="esqueleto h-4 w-28" />
          <div className="esqueleto h-4 w-24 ml-auto" />
        </div>
      ))}
    </div>
  );
}

function CelularCarregando() {
  return (
    <div role="status" aria-label="Carregando a produção" className="flex flex-col gap-3">
      <div className="esqueleto h-11 w-full" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="esqueleto h-[188px] rounded-cartao" />
      ))}
    </div>
  );
}

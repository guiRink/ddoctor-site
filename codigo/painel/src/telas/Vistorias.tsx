import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { EstadoOS, FaseVistoria, Foto } from "@compartilhado/tipos";
import { paraMs } from "@compartilhado/dominio/fuso";
import { useOSs, usePerfis } from "../dados/hooks";
import type { OSVisao } from "../dados/repositorio";
import { useSessao } from "../dados/sessao";
import { acesso, podeAdicionarFoto, podeRemoverFoto, podeVer } from "../dominio/permissoes";
import { ESTADO_OS, FASE_VISTORIA } from "../dominio/rotulos";
import { Botao, CabecalhoPagina, Cartao, Erro, Esqueleto, SUPERFICIE, Vazio } from "../componentes/ui/Basicos";
import { Etiqueta } from "../componentes/ui/Estado";
import { Placa } from "../componentes/ui/Placa";
import { Icone } from "../componentes/Icone";
import { dataHora, plural } from "../componentes/agenda/formato";
import { useMidia } from "../componentes/agenda/useLargura";
import { FaixasPorFase, Miniatura } from "../componentes/vistorias/Galeria";
import { CapturaFoto } from "../componentes/fotos/CapturaFoto";
import { Segmentado } from "../componentes/ui/Campos";

type FaseInterna = Exclude<FaseVistoria, "externa">;
const FASES_CAPTURA: FaseInterna[] = ["entrada", "durante", "final"];
/** Carros que ainda recebem foto mesmo sem nenhuma: os que estão chegando, na oficina ou prontos. */
const ESTADOS_FOTOGRAFAVEIS: EstadoOS[] = ["agendada", "na_oficina", "pronta"];

/**
 * Vistorias: lista de carros com fotos à esquerda; à direita, as fotos por fase
 * (Entrada · Durante · Final · Maxpar). Produção vê só as OS em que tem etapa; financeiro só lê.
 * docs/painel-design.md §5 · informações §3.4 · arquitetura §9.1.
 */

function ultima(fotos: Foto[]): Foto | undefined {
  return fotos.reduce<Foto | undefined>((m, f) => (!m || paraMs(f.tiradaEm) > paraMs(m.tiradaEm) ? f : m), undefined);
}

/** Fase mais provável para a próxima foto: entrada antes da oficina, durante na produção, final depois. */
function faseSugerida(v: OSVisao): FaseInterna {
  if (v.os.estado === "pronta" || v.os.estado === "entregue" || v.os.estado === "encerrada") return "final";
  if (v.os.estado === "na_oficina" && v.fotos.some((f) => f.fase === "entrada")) return "durante";
  return "entrada";
}

export function Vistorias() {
  const { perfil } = useSessao();
  const oss = useOSs();
  const perfis = usePerfis();
  const largo = useMidia("(min-width: 1024px)");
  const [params] = useSearchParams();
  const osParam = params.get("os");
  const [filtro, setFiltro] = useState("");
  // painel "Adicionar fotos": aberto para uma OS, numa fase
  const [captura, setCaptura] = useState<{ osId: string; fase: FaseInterna } | null>(null);
  // enquanto uma foto prepara/envia, a fase e o "Fechar" ficam travados (trocar remontaria a captura no meio do envio)
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const fecharCaptura = () => {
    setCaptura(null);
    setEnviandoFoto(false);
  };
  const painelCaptura = useRef<HTMLDivElement>(null);
  const podeFotografar = podeAdicionarFoto(perfil.papel);

  const soProprias = acesso(perfil.papel, "vistorias") === "proprio";

  /** OS que o papel pode ver (produção: só onde tem etapa). */
  const visiveis = useMemo(
    () => (oss.data ?? []).filter(
        (v) => !soProprias || v.etapas.some((e) => e.responsavelId === perfil.id && e.estado !== "concluida" && e.estado !== "dispensada"),
      ),
    [oss.data, soProprias, perfil.id],
  );

  // quem tira foto também vê os carros ativos ainda sem foto (para fazer a vistoria de entrada)
  const comFotos = useMemo(
    () =>
      visiveis
        .filter((v) => v.fotos.length > 0 || (podeFotografar && ESTADOS_FOTOGRAFAVEIS.includes(v.os.estado)))
        .map((v) => ({ v, ultima: ultima(v.fotos) }))
        .sort(
          (a, b) =>
            (b.ultima ? paraMs(b.ultima.tiradaEm) : -Infinity) - (a.ultima ? paraMs(a.ultima.tiradaEm) : -Infinity) || b.v.os.numero - a.v.os.numero,
        ),
    [visiveis, podeFotografar],
  );
  const carrosComFoto = comFotos.filter((x) => x.v.fotos.length > 0).length;

  const termo = filtro.trim().toLowerCase().replace(/[\s-]/g, "");
  const filtrados = termo
    ? comFotos.filter(({ v }) => [v.veiculo.placa, v.veiculo.modelo ?? "", soProprias ? "" : v.cliente.nome, String(v.os.numero)].some((t) => t.toLowerCase().replace(/[\s-]/g, "").includes(termo)))
    : comFotos;

  const existe = osParam ? oss.data?.find((v) => v.os.id === osParam) : undefined;
  const permitido = osParam ? visiveis.find((v) => v.os.id === osParam) : undefined;
  const selecionado: OSVisao | undefined = osParam ? permitido : largo ? comFotos[0]?.v : undefined;

  const totalFotos = comFotos.reduce((s, x) => s + x.v.fotos.length, 0);
  const resumo = oss.data
    ? `${plural(carrosComFoto, "carro com fotos", "carros com fotos")} · ${plural(totalFotos, "foto", "fotos")}${soProprias ? " · só os carros em que você tem etapa" : ""}`
    : undefined;

  const capturaAberta = captura && selecionado && captura.osId === selecionado.os.id ? captura : null;
  // ao abrir o painel (botão do topo ou "Adicionar" de uma fase), ele entra na tela e recebe o foco
  const chaveCaptura = capturaAberta ? capturaAberta.osId : "";
  useEffect(() => {
    if (!chaveCaptura) return;
    painelCaptura.current?.scrollIntoView({ block: "nearest" });
    painelCaptura.current?.focus({ preventScroll: true });
  }, [chaveCaptura]);

  if (oss.isError || perfis.isError) {
    return (
      <>
        <CabecalhoPagina titulo="Vistorias" />
        <Erro
          mensagem="Não consegui carregar as fotos."
          onTentar={() => {
            oss.refetch();
            perfis.refetch();
          }}
        />
      </>
    );
  }

  // ------------------------------------------------------------ lista
  const lista = (
    <Cartao titulo="Carros" contagem={oss.isPending ? undefined : comFotos.length}>
      <div className="p-3 border-b border-linha">
        <label htmlFor="filtro-vistorias" className="sr-only">
          Filtrar por placa, modelo, cliente ou número da OS
        </label>
        <div className="flex items-center h-11 md:h-10 bg-cartao border border-linha-forte rounded-controle transition-[border-color,box-shadow] duration-150 focus-within:border-tinta-fraca focus-within:ring-[3px] focus-within:ring-amarelo/30">
          <span className="pl-3 text-tinta-fraca">
            <Icone nome="busca" tamanho={16} />
          </span>
          <input
            id="filtro-vistorias"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Placa, modelo ou cliente"
            autoComplete="off"
            className="flex-1 min-w-0 h-full px-2.5 bg-transparent outline-none placeholder:text-tinta-fraca focus-visible:outline-none"
          />
        </div>
      </div>
      {oss.isPending ? (
        <div className="p-3">
          <Esqueleto linhas={5} altura="h-14" />
        </div>
      ) : comFotos.length === 0 ? (
        <Vazio
          icone="camera"
          titulo={soProprias ? "Nenhuma foto nos seus carros" : "Nenhuma foto ainda"}
          texto={
            podeFotografar
              ? "Quando um carro for agendado ou entrar na oficina, ele aparece aqui para a vistoria de entrada."
              : "As fotos aparecem aqui quando a vistoria de entrada é feita ou a Maxpar traz as do segurado."
          }
        />
      ) : filtrados.length === 0 ? (
        <Vazio icone="busca" titulo="Nada encontrado" texto={`Nenhum carro com “${filtro.trim()}”. Confira a placa ou limpe o filtro.`} />
      ) : (
        <ul className="lg:max-h-[calc(100svh-280px)] lg:overflow-y-auto">
          {filtrados.map(({ v, ultima: u }) => {
            const ativo = selecionado?.os.id === v.os.id;
            return (
              <li key={v.os.id} className="border-b border-linha last:border-b-0">
                <Link
                  to={`/vistorias?os=${v.os.id}`}
                  aria-current={ativo ? "true" : undefined}
                  className={`flex items-center gap-3 px-4 py-3 min-h-16 no-underline text-tinta transition-colors duration-150 ${
                    ativo ? "bg-cinza-100" : "hover:bg-cinza-50"
                  }`}
                >
                  <Miniatura f={u} />
                  <span className="min-w-0 flex-1">
                    <Placa placa={v.veiculo.placa} tamanho="p" />
                    <span className="block mt-1.5 text-[13px] font-medium leading-tight truncate" title={v.veiculo.modelo}>
                      {v.veiculo.modelo ?? "Modelo não informado"}
                    </span>
                    <span className="block text-[12px] text-tinta-suave numero leading-tight">
                      {u ? `${plural(v.fotos.length, "foto", "fotos")} · última ${dataHora(u.tiradaEm)}` : "Sem fotos ainda"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Cartao>
  );

  // ------------------------------------------------------------ detalhe
  let detalhe;
  if (oss.isPending || perfis.isPending) {
    detalhe = <Esqueleto linhas={3} altura="h-48" />;
  } else if (osParam && !existe) {
    detalhe = (
      <Cartao>
        <Vazio icone="busca" titulo="Carro não encontrado" texto="Esse link aponta para uma OS que não existe mais. Escolha um carro na lista." />
      </Cartao>
    );
  } else if (osParam && !permitido) {
    detalhe = (
      <Cartao>
        <Vazio icone="bloqueio" titulo="Sem acesso às fotos deste carro" texto="Você vê as fotos dos carros em que tem etapa. Fale com o gestor se precisar." />
      </Cartao>
    );
  } else if (!selecionado) {
    detalhe = (
      <Cartao>
        <Vazio icone="camera" titulo="Escolha um carro" texto="Toque num carro da lista para ver as fotos de entrada, durante, final e as da Maxpar." />
      </Cartao>
    );
  } else {
    const v = selecionado;
    const estado = ESTADO_OS[v.os.estado];
    detalhe = (
      <section aria-labelledby="vistoria-carro" className={`${SUPERFICIE} overflow-hidden`}>
        <header className="flex flex-wrap items-start justify-between gap-4 p-4 border-b border-linha">
          <div className="flex items-start gap-4 min-w-0">
            <Placa placa={v.veiculo.placa} tamanho="m" />
            <div className="min-w-0">
              <h2 id="vistoria-carro" className="text-[20px] font-semibold tracking-[-0.01em] leading-tight break-words">
                {v.veiculo.modelo ?? "Modelo não informado"}
                {v.veiculo.cor && <span className="font-normal text-tinta-suave"> · {v.veiculo.cor}</span>}
              </h2>
              <p className="text-[13px] text-tinta-suave break-words">
                OS <span className="numero">{v.os.numero}</span>{!soProprias && <> · {v.cliente.nome}</>}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Etiqueta tom={estado.tom}>{estado.texto}</Etiqueta>
                {podeVer(perfil.papel, "orcamentos") && (
                  <Link to={`/orcamentos/${v.os.id}`} className="text-[13px] font-medium text-tinta underline underline-offset-4 decoration-linha-forte hover:decoration-tinta">
                    Abrir ficha
                  </Link>
                )}
              </div>
            </div>
          </div>
          {podeFotografar && v.os.estado !== "cancelada" && !capturaAberta && (
            <Botao variante="contorno" icone="camera" onClick={() => setCaptura({ osId: v.os.id, fase: faseSugerida(v) })}>
              Adicionar fotos
            </Botao>
          )}
        </header>
        {capturaAberta && (
          <div
            ref={painelCaptura}
            tabIndex={-1}
            role="group"
            aria-labelledby="titulo-captura"
            className="flex flex-col gap-4 p-4 border-b border-linha bg-cinza-50 outline-none scroll-mt-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 id="titulo-captura" className="text-[15px] font-semibold">
                  Adicionar fotos
                </h3>
                <p className="text-[13px] text-tinta-suave" aria-live="polite">
                  {enviandoFoto ? "Enviando foto… espere terminar para trocar a fase ou fechar." : "Escolha a fase e tire ou escolha as fotos. Pode mandar várias."}
                </p>
              </div>
              <Botao variante="fantasma" tamanho="denso" onClick={fecharCaptura} disabled={enviandoFoto}>
                Fechar
              </Botao>
            </div>
            <Segmentado
              nome="fase-captura"
              legenda="Fase da foto"
              opcoes={FASES_CAPTURA.map((f) => ({ valor: f, texto: FASE_VISTORIA[f] }))}
              valor={capturaAberta.fase}
              onMudar={(fase) => setCaptura({ osId: v.os.id, fase })}
              larguraTotal={!largo}
              desabilitado={enviandoFoto}
            />
            <CapturaFoto
              key={capturaAberta.fase}
              osId={v.os.id}
              fase={capturaAberta.fase}
              fotos={[]}
              podeRemover={() => false}
              rotulo={`Fotos de ${FASE_VISTORIA[capturaAberta.fase].toLowerCase()}`}
              mostrarProntas={false}
              onEstado={(e) => setEnviandoFoto(e.ocupado)}
            />
          </div>
        )}
        <div className="p-4">
          <FaixasPorFase
            fotos={v.fotos}
            perfis={perfis.data ?? []}
            podeRemover={(f) => podeRemoverFoto(perfil.papel, f, perfil.id)}
            onAdicionar={podeFotografar && v.os.estado !== "cancelada" && !enviandoFoto ? (fase) => setCaptura({ osId: v.os.id, fase }) : undefined}
          />
        </div>
      </section>
    );
  }

  // celular: lista OU detalhe (com voltar)
  if (!largo) {
    return (
      <>
        <CabecalhoPagina titulo="Vistorias" resumo={osParam ? undefined : resumo} />
        {osParam ? (
          <div className="flex flex-col gap-3">
            <Link to="/vistorias" className="inline-flex items-center gap-2 h-11 self-start font-medium no-underline text-tinta-suave hover:text-tinta">
              <Icone nome="voltar" tamanho={18} /> Voltar à lista
            </Link>
            {detalhe}
          </div>
        ) : (
          lista
        )}
      </>
    );
  }

  return (
    <>
      <CabecalhoPagina titulo="Vistorias" resumo={resumo} />
      <div className="grid gap-4 grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)] items-start">
        <aside aria-label="Carros com fotos" className="min-w-0">
          {lista}
        </aside>
        <div className="min-w-0">{detalhe}</div>
      </div>
    </>
  );
}

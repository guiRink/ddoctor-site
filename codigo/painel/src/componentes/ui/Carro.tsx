import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { ConfigOficina, EtapaOS, MarcoISO, Perfil, Semaforo as TipoSemaforo } from "@compartilhado/tipos";
import { etapaAtual, progressoEtapas, semaforoEtapa, semaforoOS } from "@compartilhado/dominio/semaforo";
import { formatarDuracao, tempoBloqueada, tempoEmExecucao, tempoEmFila } from "@compartilhado/dominio/tempos";
import type { OSVisao } from "../../dados/repositorio";
import { Placa } from "./Placa";
import { Responsavel } from "./Basicos";
import { Semaforo, corSemaforo } from "./Estado";

// ------------------------------------------------------------------ progresso das etapas

/**
 * Barra segmentada: uma fatia por etapa. Concluída = preto, atual = cor do semáforo,
 * dispensada = hachurada, futura = linha. Abaixo, "Etapa 3 de 5 · Pintura".
 */
export function ProgressoEtapas({
  etapas,
  semaforo,
  escuro = false,
  mostrarTexto = true,
}: {
  etapas: EtapaOS[];
  semaforo: TipoSemaforo;
  escuro?: boolean;
  mostrarTexto?: boolean;
}) {
  if (etapas.length === 0) return null;
  const atual = etapaAtual(etapas);
  const { concluidas, total } = progressoEtapas(etapas);
  return (
    <div className="min-w-0">
      <div className="flex gap-[3px]" aria-hidden="true">
        {etapas.map((e) => {
          let cor = escuro ? "bg-grafite-3" : "bg-linha";
          if (e.estado === "concluida") cor = escuro ? "bg-papel" : "bg-preto";
          else if (e.estado === "dispensada") cor = "hachurado";
          else if (atual && e.id === atual.id) cor = corSemaforo(semaforo === "neutro" ? "verde" : semaforo);
          return <span key={e.id} className={`h-1.5 flex-1 ${cor}`} />;
        })}
      </div>
      {mostrarTexto && (
        <p className={`mt-1.5 text-[12px] numero ${escuro ? "text-papel-suave" : "text-tinta-suave"}`}>
          {atual ? (
            <>
              Etapa {posicaoNaSequencia(etapas, atual.id)} de {total} · <span className={`font-semibold ${escuro ? "text-papel" : "text-tinta"}`}>{atual.nome}</span>
            </>
          ) : concluidas === total ? (
            "Todas as etapas concluídas"
          ) : (
            `${concluidas} de ${total} concluídas`
          )}
        </p>
      )}
    </div>
  );
}

/** Posição da etapa entre as que valem (dispensadas não contam), começando em 1. */
function posicaoNaSequencia(etapas: EtapaOS[], id: string): number {
  return etapas.filter((e) => e.estado !== "dispensada").findIndex((e) => e.id === id) + 1;
}

// ------------------------------------------------------------------ helpers de leitura

export function resumoProducao(v: OSVisao, agora: MarcoISO, config: ConfigOficina) {
  const atual = etapaAtual(v.etapas);
  const semaforo = v.etapas.length ? semaforoOS(v.os, v.etapas, agora, config) : "neutro";
  const semaforoAtual = atual ? semaforoEtapa(atual, agora, config) : "neutro";
  const bloqueada = atual?.estado === "bloqueada";
  return {
    atual,
    semaforo,
    semaforoAtual,
    bloqueada,
    fila: atual ? tempoEmFila(atual, agora) : 0,
    execucao: atual ? tempoEmExecucao(atual, agora) : 0,
    bloqueio: atual ? tempoBloqueada(atual, agora) : 0,
  };
}

export function nomePerfil(perfis: Perfil[], id?: string): string | undefined {
  return perfis.find((p) => p.id === id)?.nome;
}

// ------------------------------------------------------------------ linha de carro (listas)

/** Linha compacta para listas: placa, carro, cliente e um complemento à direita. */
export function LinhaCarro({ v, para, direita, detalhe }: { v: OSVisao; para?: string; direita?: ReactNode; detalhe?: ReactNode }) {
  const conteudo = (
    <>
      <Placa placa={v.veiculo.placa} tamanho="p" />
      {/* Em coluna estreita (< 24rem, ex.: celular) o complemento desce para baixo do texto, sem cortar o modelo. */}
      <span className="min-w-0 flex-1 flex flex-col items-start gap-1.5 @sm:flex-row @sm:items-center @sm:gap-3">
        <span className="min-w-0 w-full @sm:flex-1">
          <span className="block font-semibold truncate">{v.veiculo.modelo ?? "Modelo não informado"}</span>
          <span className="block text-[13px] leading-snug text-tinta-suave line-clamp-2">{detalhe ?? v.cliente.nome}</span>
        </span>
        {direita && <span className="shrink-0 flex items-center gap-2">{direita}</span>}
      </span>
    </>
  );
  const classe = "@container flex items-center gap-3 px-4 py-2.5 min-h-14 border-b border-linha last:border-b-0";
  if (!para) return <div className={classe}>{conteudo}</div>;
  return (
    <Link to={para} className={`${classe} no-underline text-tinta hover:bg-amarelo-claro transition-colors duration-150`}>
      {conteudo}
    </Link>
  );
}

// ------------------------------------------------------------------ cartão de OS (quadro de produção)

export function CartaoOS({
  v,
  agora,
  config,
  perfis,
  para,
  rodape,
}: {
  v: OSVisao;
  agora: MarcoISO;
  config: ConfigOficina;
  perfis: Perfil[];
  para?: string;
  rodape?: ReactNode;
}) {
  const r = resumoProducao(v, agora, config);
  const corpo = (
    <>
      <div className="flex items-start justify-between gap-2">
        <Placa placa={v.veiculo.placa} tamanho="m" />
        <Semaforo valor={r.semaforo} texto={r.bloqueada && r.semaforo === "vermelho" ? "Impedido" : undefined} />
      </div>
      <p className="mt-2.5 font-semibold leading-tight truncate">
        {v.veiculo.modelo}
        {v.veiculo.cor && <span className="font-normal text-tinta-suave"> · {v.veiculo.cor}</span>}
      </p>
      <p className="text-[13px] text-tinta-suave truncate">{v.tipoReparo?.nome ?? "Tipo de reparo não definido"}</p>
      <div className="mt-3">
        <ProgressoEtapas etapas={v.etapas} semaforo={r.semaforoAtual} />
      </div>
      {r.bloqueada && r.atual?.bloqueios.at(-1) && (
        <p className="mt-2 text-[12px] font-semibold text-alerta leading-snug">Impedimento: {r.atual.bloqueios.at(-1)!.motivo}</p>
      )}
      <div className="mt-3 pt-3 border-t border-linha flex items-center justify-between gap-2">
        <Responsavel nome={nomePerfil(perfis, r.atual?.responsavelId)} />
        {r.atual && (
          <span className="text-[12px] text-tinta-suave numero whitespace-nowrap">
            {r.atual.estado === "na_fila" ? `fila ${formatarDuracao(r.fila)}` : `exec. ${formatarDuracao(r.execucao)}`}
          </span>
        )}
      </div>
      {rodape}
    </>
  );
  const classe = "block bg-cartao border border-linha p-3.5 text-tinta";
  if (!para) return <article className={classe}>{corpo}</article>;
  return (
    <Link to={para} className={`${classe} no-underline hover:border-linha-forte transition-colors duration-150`}>
      {corpo}
    </Link>
  );
}

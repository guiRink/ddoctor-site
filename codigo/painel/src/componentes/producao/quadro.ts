// Montagem do quadro de produção (gestor e TV): colunas, classificação e ordem dos cartões.
// Só organiza para exibir; as regras (semáforo, tempos, etapa atual) vêm de @compartilhado/dominio.
import type { ConfigOficina, DataISO, EtapaOS, MarcoISO, Perfil, Semaforo } from "@compartilhado/tipos";
import { dataNoFuso, diaSemana, diferencaDias, FUSO, paraMs } from "@compartilhado/dominio/fuso";
import type { SituacaoCartao } from "@compartilhado/dominio/semaforo";
import type { OSVisao } from "../../dados/repositorio";
import { atrasados, naOficina, parados, saemHoje } from "../../dominio/contagens";
import { rotuloHaQuanto, rotuloPrazo } from "../../dominio/horarios";
import type { Tom } from "../ui/Estado";
import { resumoProducao } from "../ui/Carro";

export const COLUNA_PRONTOS = "__prontos";
export const COLUNA_SEM_ETAPA = "__sem_etapa";

// Filtros da Produção e da TV. "Atrasados", "Parados" e "Saem hoje" são as mesmas contagens do Geral
// (src/dominio/contagens.ts; revisão SH: atrasado = passou do prazo, parado = impedido). Um carro pode estar nos dois.
// Link antigo ?filtro=impedidos cai em "parados".
export type FiltroQuadro = "todos" | "atrasados" | "parados" | "hoje";
export const FILTROS: readonly FiltroQuadro[] = ["todos", "atrasados", "parados", "hoje"];
export const NOME_FILTRO: Record<FiltroQuadro, string> = {
  todos: "Todos",
  atrasados: "Atrasados",
  parados: "Parados",
  hoje: "Saem hoje",
};

export function lerFiltro(valor: string | null): FiltroQuadro {
  if (valor === "impedidos") return "parados";
  return FILTROS.includes(valor as FiltroQuadro) ? (valor as FiltroQuadro) : "todos";
}

/** Uma pílula por carro (situacaoCartao): texto, tom e a cor do segmento atual no progresso. */
export const SITUACAO: Record<SituacaoCartao, { texto: string; tom: Tom; cor: Semaforo }> = {
  impedido: { texto: "Parado", tom: "alerta", cor: "vermelho" },
  atrasado: { texto: "Atrasado", tom: "alerta", cor: "vermelho" },
  atencao: { texto: "Atenção", tom: "atencao", cor: "laranja" },
  no_prazo: { texto: "No prazo", tom: "ok", cor: "verde" },
  pronto: { texto: "Pronto", tom: "ok", cor: "neutro" },
};

export interface ItemQuadro {
  v: OSVisao;
  coluna: string;
  resumo: ReturnType<typeof resumoProducao>;
  /** A única situação do cartão (impedido vence atrasado e atenção). */
  situacao: SituacaoCartao;
  impedido: boolean;
  atrasado: boolean;
  /** Está em "Atrasados" (passou do prazo; contagens.atrasados). */
  emAtrasados: boolean;
  /** Está em "Parados" (etapa impedida; contagens.parados). */
  emParados: boolean;
  /** Pede atenção: está em Atrasados ou em Parados (fundo de alerta na lista). */
  parado: boolean;
  /** Está em "Saem hoje" (entrega prometida hoje). */
  entregaHoje: boolean;
  pronto: boolean;
  responsavelId?: string;
  /** Prazo da etapa atual legível: "hoje 16h", "amanhã 10h", "atrasado 3 h". */
  prazoEtapa?: string;
  etapaVencida: boolean;
  /** Entrega prometida legível: "hoje", "amanhã", "qui", "atrasado 1 dia". */
  entrega?: string;
  entregaVencida: boolean;
  /** Prontos: "há 5 h". */
  prontoHa?: string;
}

/**
 * Cartões do quadro = "Na oficina" (naOficina: na_oficina + pronta), com as marcas de "Saem hoje", "Atrasados" e
 * "Parados" tiradas das mesmas funções do Geral — os números batem em todas as telas.
 */
export function montarItens(oss: readonly OSVisao[], agora: MarcoISO, config: ConfigOficina): ItemQuadro[] {
  const hoje = dataNoFuso(agora);
  const agoraMs = paraMs(agora);
  const saem = new Set(saemHoje(oss, agora, config, []).itens.map((i) => i.v.os.id));
  const noAtraso = new Set(atrasados(oss, agora, config).itens.map((i) => i.v.os.id));
  const noParado = new Set(parados(oss, agora, config).itens.map((i) => i.v.os.id));
  return naOficina(oss, agora, config).itens.map(({ v, situacao }) => {
    const pronto = situacao === "pronto";
    const resumo = resumoProducao(v, agora, config);
    const etapa = pronto ? undefined : resumo.atual;
    const previsao = v.os.previsaoEntrega?.slice(0, 10);
    return {
      v,
      coluna: pronto ? COLUNA_PRONTOS : (etapa?.nome ?? COLUNA_SEM_ETAPA),
      resumo,
      situacao,
      impedido: situacao === "impedido",
      atrasado: situacao === "atrasado",
      emAtrasados: noAtraso.has(v.os.id),
      emParados: noParado.has(v.os.id),
      parado: noAtraso.has(v.os.id) || noParado.has(v.os.id),
      entregaHoje: saem.has(v.os.id),
      pronto,
      responsavelId: etapa?.responsavelId,
      prazoEtapa: etapa?.prazoEm ? rotuloPrazo(etapa.prazoEm, agora, config) : undefined,
      etapaVencida: Boolean(etapa?.prazoEm && agoraMs > paraMs(etapa.prazoEm)),
      entrega: previsao ? rotuloPrazo(previsao, agora, config) : undefined,
      entregaVencida: Boolean(previsao && hoje > previsao),
      prontoHa: pronto && v.os.prontaEm ? rotuloHaQuanto(v.os.prontaEm, agora) : undefined,
    };
  });
}

/**
 * Números do cabeçalho e dos filtros: total = emServico + prontos; atrasados e parados = as listas do Geral
 * (um carro impedido e vencido conta nas duas). atrasado/impedido do cartão continuam a situação única da pílula.
 */
export function contarItens(itens: readonly ItemQuadro[]) {
  const prontos = itens.filter((i) => i.pronto).length;
  return {
    naOficina: itens.length,
    emServico: itens.length - prontos,
    prontos,
    atrasados: itens.filter((i) => i.emAtrasados).length,
    parados: itens.filter((i) => i.emParados).length,
    hoje: itens.filter((i) => i.entregaHoje).length,
  };
}

export function filtrarItens(itens: readonly ItemQuadro[], filtro: FiltroQuadro, responsavelId?: string): ItemQuadro[] {
  return itens.filter((i) => {
    if (filtro === "atrasados" && !i.emAtrasados) return false;
    if (filtro === "parados" && !i.emParados) return false;
    if (filtro === "hoje" && !i.entregaHoje) return false;
    if (responsavelId && i.responsavelId !== responsavelId) return false;
    return true;
  });
}

const PESO: Record<SituacaoCartao, number> = { atrasado: 4, impedido: 3, atencao: 2, no_prazo: 1, pronto: 0 };

/** Pior situação primeiro (atrasado, impedido, atenção, no prazo); depois prioridade, prazo da etapa e entrega. */
export function compararItens(a: ItemQuadro, b: ItemQuadro): number {
  return (
    PESO[b.situacao] - PESO[a.situacao] ||
    b.v.os.prioridade - a.v.os.prioridade ||
    tempo(a.resumo.atual?.prazoEm) - tempo(b.resumo.atual?.prazoEm) ||
    (a.v.os.previsaoEntrega ?? "9").localeCompare(b.v.os.previsaoEntrega ?? "9") ||
    a.v.veiculo.placa.localeCompare(b.v.veiculo.placa)
  );
}

const tempo = (m?: MarcoISO) => (m ? paraMs(m) : Number.POSITIVE_INFINITY);

/**
 * Ordem lógica dos nomes de etapa a partir das sequências das próprias OS (cada OS traz as etapas
 * do seu tipo de reparo, em ordem). Junta as sequências por ordenação topológica; empates e ciclos
 * decidem pela posição relativa média (0 = início do fluxo, 1 = fim).
 */
export function ordemEtapas(sequencias: readonly (readonly string[])[]): string[] {
  const posicoes = new Map<string, number[]>();
  const saidas = new Map<string, Set<string>>();
  const entrada = new Map<string, number>();
  const garantir = (n: string) => {
    if (!posicoes.has(n)) {
      posicoes.set(n, []);
      saidas.set(n, new Set());
      entrada.set(n, 0);
    }
  };
  for (const seq of sequencias) {
    seq.forEach((nome, i) => {
      garantir(nome);
      posicoes.get(nome)!.push(seq.length > 1 ? i / (seq.length - 1) : 0.5);
      const ant = seq[i - 1];
      if (ant !== undefined && ant !== nome && !saidas.get(ant)!.has(nome)) {
        saidas.get(ant)!.add(nome);
        entrada.set(nome, entrada.get(nome)! + 1);
      }
    });
  }
  const media = (n: string) => {
    const p = posicoes.get(n)!;
    return p.reduce((s, x) => s + x, 0) / p.length;
  };
  const porMedia = (a: string, b: string) => media(a) - media(b) || a.localeCompare(b, "pt-BR");
  const resultado: string[] = [];
  const restantes = new Set(posicoes.keys());
  while (restantes.size) {
    const livres = [...restantes].filter((n) => entrada.get(n) === 0).sort(porMedia);
    // ciclo (ordens conflitantes entre tipos de reparo): solta o de menor posição média
    const proximo = livres[0] ?? [...restantes].sort(porMedia)[0];
    restantes.delete(proximo);
    resultado.push(proximo);
    for (const s of saidas.get(proximo)!) entrada.set(s, entrada.get(s)! - 1);
  }
  return resultado;
}

export interface ColunaQuadro {
  id: string;
  nome: string;
  itens: ItemQuadro[];
}

/** Nomes de etapa na ordem do fluxo, a partir das etapas de todas as OS. */
export function etapasDoFluxo(todas: readonly OSVisao[]): string[] {
  return ordemEtapas(todas.filter((v) => v.etapas.length).map((v) => [...v.etapas].sort((a, b) => a.ordem - b.ordem).map((e) => e.nome)));
}

/** Etapas do fluxo sem nenhum carro agora (para a linha "Sem carro agora", sem gastar largura). */
export function etapasSemCarro(itens: readonly ItemQuadro[], todas: readonly OSVisao[]): string[] {
  const ocupadas = new Set(itens.map((i) => i.coluna));
  return etapasDoFluxo(todas).filter((n) => !ocupadas.has(n));
}

/** Todos os cartões numa fila só, do mais urgente ao menos (lista e aba "Todas" do celular). */
export function ordenarPorUrgencia(itens: readonly ItemQuadro[]): ItemQuadro[] {
  return [...itens].sort((a, b) => Number(a.pronto) - Number(b.pronto) || compararItens(a, b));
}

/** Colunas não vazias na ordem do fluxo, com "Prontos para entrega" no fim. */
export function montarColunas(itens: readonly ItemQuadro[], todas: readonly OSVisao[]): ColunaQuadro[] {
  const ordem = etapasDoFluxo(todas);
  const ids = [COLUNA_SEM_ETAPA, ...ordem, COLUNA_PRONTOS];
  for (const i of itens) if (!ids.includes(i.coluna)) ids.splice(ids.length - 1, 0, i.coluna);
  return ids
    .map((id) => ({
      id,
      nome: id === COLUNA_PRONTOS ? "Prontos para entrega" : id === COLUNA_SEM_ETAPA ? "Sem etapa definida" : id,
      itens: itens.filter((i) => i.coluna === id).sort(compararItens),
    }))
    .filter((c) => c.itens.length > 0);
}

// ------------------------------------------------------------------ próximo carro (celular da produção)

const FECHADA: ReadonlySet<EtapaOS["estado"]> = new Set(["concluida", "dispensada"]);
const sem = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** A etapa é da função da pessoa? Palavra do nome da etapa (4+ letras) dentro da função ("Martelinho e funilaria"). */
export function etapaDaFuncao(nomeEtapa: string, funcao?: string): boolean {
  if (!funcao) return false;
  const f = sem(funcao);
  return sem(nomeEtapa)
    .split(/[^a-z]+/)
    .some((p) => p.length >= 4 && f.includes(p));
}

export interface ProximoCarro {
  v: OSVisao;
  etapa: EtapaOS;
  /** Etapas abertas antes da dele (a primeira é a que está sendo feita agora). */
  antes: EtapaOS[];
  /** Pela função (etapa sem responsável), e não por atribuição. */
  pelaFuncao: boolean;
  /** Quantos outros carros vêm depois para a pessoa. */
  depois: number;
}

/**
 * "Próximo carro pra mim": a etapa ainda aguardando, num carro na oficina, que é da pessoa —
 * atribuída a ela ou, sem responsável, da função dela. O que tem menos etapas abertas na frente vem
 * primeiro; empate: pior situação, depois a entrega mais cedo.
 */
export function proximoCarro(oss: readonly OSVisao[], pessoa: Pick<Perfil, "id" | "funcao">, agora: MarcoISO, config: ConfigOficina): ProximoCarro | undefined {
  const situacoes = new Map(naOficina(oss, agora, config).itens.map((i) => [i.v.os.id, i.situacao]));
  const candidatos: (ProximoCarro & { peso: number })[] = [];
  for (const v of oss) {
    if (v.os.estado !== "na_oficina") continue;
    const ordem = [...v.etapas].sort((a, b) => a.ordem - b.ordem);
    const minha = ordem.find(
      (e) => e.estado === "aguardando" && (e.responsavelId === pessoa.id || (!e.responsavelId && etapaDaFuncao(e.nome, pessoa.funcao))),
    );
    if (!minha) continue;
    const antes = ordem.filter((e) => e.ordem < minha.ordem && !FECHADA.has(e.estado));
    const situacao = situacoes.get(v.os.id) ?? "no_prazo";
    candidatos.push({ v, etapa: minha, antes, pelaFuncao: minha.responsavelId !== pessoa.id, depois: 0, peso: PESO[situacao] });
  }
  candidatos.sort(
    (a, b) =>
      a.antes.length - b.antes.length ||
      b.peso - a.peso ||
      (a.v.os.previsaoEntrega ?? "9").localeCompare(b.v.os.previsaoEntrega ?? "9") ||
      a.v.veiculo.placa.localeCompare(b.v.veiculo.placa),
  );
  const [primeiro] = candidatos;
  if (!primeiro) return undefined;
  const { peso: _peso, ...resto } = primeiro;
  void _peso;
  return { ...resto, depois: candidatos.length - 1 };
}

// ------------------------------------------------------------------ visão (quadro ou lista) e densidade da TV

export type VisaoProducao = "quadro" | "lista";
export const CHAVE_VISAO = "ddoctor.producao.visao";

export function lerVisao(valor: string | null | undefined): VisaoProducao {
  return valor === "lista" ? "lista" : "quadro";
}

/** Densidade do cartão da TV: o cartão encolhe antes de a coluna paginar. */
export type DensidadeTV = "cheio" | "medio" | "compacto";
/** Altura mínima de cada densidade (px, medida em 1920×1080). */
export const ALTURA_TV: Record<DensidadeTV, number> = { cheio: 372, medio: 222, compacto: 116 };

/**
 * Escolhe a maior densidade em que `n` cartões cabem na altura da coluna; se nem o compacto
 * couber, devolve quantos compactos cabem por página (a coluna pagina sozinha).
 */
export function densidadeTV(altura: number, n: number, vao: number): { densidade: DensidadeTV; porPagina: number } {
  const cabem = (h: number) => Math.max(1, Math.floor((altura + vao) / (h + vao)));
  for (const d of ["cheio", "medio", "compacto"] as const) {
    if (cabem(ALTURA_TV[d]) >= n) return { densidade: d, porPagina: n };
  }
  return { densidade: "compacto", porPagina: cabem(ALTURA_TV.compacto) };
}

/**
 * Páginas da TV num tique do relógio de páginas. O conjunto de colunas troca a cada tique; a página
 * de cada coluna só avança quando o conjunto dá a volta — assim toda página de toda coluna aparece
 * (com o mesmo contador para os dois, a 2ª página de uma coluna podia cair sempre no outro conjunto).
 */
export function paginasTV(tique: number, paginasColunas: number): { paginaColunas: number; paginaDaColuna: (paginas: number) => number } {
  const conjuntos = Math.max(1, paginasColunas);
  const volta = Math.floor(tique / conjuntos);
  return {
    paginaColunas: tique % conjuntos,
    paginaDaColuna: (paginas) => volta % Math.max(1, paginas),
  };
}

// ------------------------------------------------------------------ formatação de datas (fuso da oficina)

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "14:30" no fuso da oficina. */
export function formatarHora(marco: MarcoISO | number): string {
  return hora.format(typeof marco === "number" ? marco : paraMs(marco));
}

/** "hoje", "amanhã", "ontem" ou "qua 14/10". */
export function formatarDia(data: DataISO, agora: MarcoISO): string {
  const dif = diferencaDias(dataNoFuso(agora), data);
  if (dif === 0) return "hoje";
  if (dif === 1) return "amanhã";
  if (dif === -1) return "ontem";
  return formatarDataCurta(data);
}

/** "seg 12/10". */
export function formatarDataCurta(data: DataISO): string {
  const [, m, d] = data.split("-");
  return `${SEMANA[diaSemana(data)]} ${d}/${m}`;
}

/** Prazo de etapa: "hoje 16:30" ou "ter 13/10 10:00". */
export function formatarPrazo(marco: MarcoISO, agora: MarcoISO): string {
  return `${formatarDia(dataNoFuso(marco), agora)} ${formatarHora(marco)}`;
}

/** Prazo curto para cartão estreito: "18:41" se for hoje; "amanhã", "ontem" ou "22/10". */
export function formatarPrazoCurto(marco: MarcoISO, agora: MarcoISO): string {
  const dia = dataNoFuso(marco);
  const dif = diferencaDias(dataNoFuso(agora), dia);
  if (dif === 0) return formatarHora(marco);
  if (dif === 1) return "amanhã";
  if (dif === -1) return "ontem";
  const [, m, d] = dia.split("-");
  return `${d}/${m}`;
}

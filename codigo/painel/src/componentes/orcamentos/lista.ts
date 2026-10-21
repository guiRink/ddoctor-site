import { ORIGENS_OS, type DataISO, type EstadoOS, type MarcoISO, type OrigemOS } from "@compartilhado/tipos";
import { dataNoFuso, diferencaDias } from "@compartilhado/dominio/fuso";
import { normalizarPlaca } from "@compartilhado/dominio/placa";
import type { OSVisao } from "../../dados/repositorio";
import { valorDaLista, versaoAtual } from "./selecoes";
import { ESTADO_OS } from "../../dominio/rotulos";

/**
 * Lista de Orçamentos (sprint SG): filtros, ordenação e textos de tempo — tudo puro, sem React.
 * O estado dos filtros mora na URL: `?q=&estado=&valor=&tempo=&origem=&seguradora=&ordem=`
 * (dá para mandar o link). Dinheiro em centavos; dias contados no fuso da oficina.
 */

/** Nome da tela: o dono pediu de volta "Orçamentos" (revisão SH, docs/revisao-sh/pedido-dono.md). Troque aqui e vale para a tela inteira. */
export const TITULO_ATENDIMENTOS = "Orçamentos";

// ------------------------------------------------------------------ situações (abas)

export interface AbaEstado {
  chave: string;
  /** Nome da aba (plural, como a oficina fala). */
  nome: string;
  /** Uma linha sob as abas explicando o que é esse estado. */
  explicacao: string;
  estados: EstadoOS[];
}

/** Abas na ordem do fluxo do carro. `?estado=` aceita a chave ou estados separados por vírgula. */
export const ABAS_ESTADO: AbaEstado[] = [
  { chave: "todos", nome: "Todos", explicacao: "Todos os carros, do orçamento à entrega.", estados: [] },
  { chave: "rascunho", nome: "Em orçamento", explicacao: "Orçamento sendo montado; ainda não foi enviado.", estados: ["rascunho"] },
  {
    chave: "aguardando_aprovacao",
    nome: "Aguardando aprovação",
    explicacao: "Orçamento feito; falta a seguradora ou o cliente aprovar.",
    estados: ["aguardando_aprovacao"],
  },
  { chave: "aguardando_agendamento", nome: "Aguardando agendamento", explicacao: "Aprovado; falta marcar o dia de entrada.", estados: ["aguardando_agendamento"] },
  { chave: "agendada", nome: "Agendados", explicacao: "Com dia marcado para entrar na oficina.", estados: ["agendada"] },
  // Mesmo recorte de naOficina() (dominio/contagens): em serviço + prontos, o número do Geral, da Produção e da TV.
  {
    chave: "na_oficina",
    nome: "Na oficina",
    explicacao: "Carro dentro da oficina: em serviço ou pronto esperando o cliente buscar.",
    estados: ["na_oficina", "pronta"],
  },
  { chave: "pronta", nome: "Prontos", explicacao: "Serviço concluído; falta entregar ao cliente.", estados: ["pronta"] },
  { chave: "entregue", nome: "Entregues", explicacao: "Carro já entregue ao cliente (ou fechado).", estados: ["entregue", "encerrada"] },
  { chave: "cancelada", nome: "Cancelados", explicacao: "Atendimento cancelado.", estados: ["cancelada"] },
];

/** Nome da situação na linha, igual ao da aba (palavras da oficina; tom da etiqueta vem de ESTADO_OS). */
export const SITUACAO = Object.fromEntries(
  Object.entries(ESTADO_OS).map(([estado, r]) => [estado, r.texto]),
) as Record<EstadoOS, string>;

/** "1 de 2 autorizadas"; "1 de 1 autorizada"; sem peças = "sem peças". */
export function textoPecas(autorizadas: number, total: number): string {
  if (total <= 0) return "sem peças";
  return `${autorizadas} de ${total} autorizada${total > 1 ? "s" : ""}`;
}

const ORDEM_FLUXO: EstadoOS[] = [
  "rascunho",
  "aguardando_aprovacao",
  "aguardando_agendamento",
  "agendada",
  "na_oficina",
  "pronta",
  "entregue",
  "encerrada",
  "cancelada",
];

/** Estados de um `?estado=` (chave de aba ou lista com vírgula). Vazio = todos. */
export function estadosDaChave(chave: string): EstadoOS[] {
  if (!chave || chave === "todos") return [];
  const aba = ABAS_ESTADO.find((a) => a.chave === chave);
  if (aba) return aba.estados;
  return chave
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is EstadoOS => (ORDEM_FLUXO as string[]).includes(s));
}

/** Nome legível de um `?estado=` (aba ou lista de estados): "Prontos", "Na oficina + Pronto". */
export function nomeDoEstado(chave: string): string {
  const aba = ABAS_ESTADO.find((a) => a.chave === chave);
  if (aba) return aba.nome;
  return estadosDaChave(chave)
    .map((e) => SITUACAO[e])
    .join(" + ");
}

// ------------------------------------------------------------------ valor

export const FAIXAS_VALOR = [
  { valor: "ate500", texto: "Até R$ 500", min: 1, max: 50_000 },
  { valor: "500a1500", texto: "R$ 500 a 1.500", min: 50_001, max: 150_000 },
  { valor: "1500a5000", texto: "R$ 1.500 a 5.000", min: 150_001, max: 500_000 },
  { valor: "acima5000", texto: "Acima de R$ 5.000", min: 500_001, max: Infinity },
  { valor: "sem_valor", texto: "Sem valor", min: 0, max: 0 },
] as const;
export type FaixaValor = (typeof FAIXAS_VALOR)[number]["valor"];

/** Faixa de um valor em centavos. 0 (sem itens com valor) = "sem_valor"; R$ 500,00 cai em "até 500". */
export function faixaDoValor(centavos: number): FaixaValor {
  if (centavos <= 0) return "sem_valor";
  return FAIXAS_VALOR.find((f) => centavos >= f.min && centavos <= f.max)?.valor ?? "acima5000";
}

/** Valor que a lista mostra e usa para filtrar/ordenar: o autorizado ou, antes da aprovação, o orçado. */
export const valorDaOS = (v: OSVisao) => valorDaLista(versaoAtual(v));

// ------------------------------------------------------------------ tempo

export const FAIXAS_TEMPO = [
  { valor: "ate3", texto: "Até 3 dias", min: 0, max: 3 },
  { valor: "4a7", texto: "4 a 7 dias", min: 4, max: 7 },
  { valor: "8a15", texto: "8 a 15 dias", min: 8, max: 15 },
  { valor: "mais15", texto: "Mais de 15 dias", min: 16, max: Infinity },
] as const;
export type FaixaTempo = (typeof FAIXAS_TEMPO)[number]["valor"];

export function faixaDoTempo(dias: number): FaixaTempo {
  return FAIXAS_TEMPO.find((f) => dias >= f.min && dias <= f.max)?.valor ?? "mais15";
}

/** Dias corridos desde a abertura da OS (no fuso de São Paulo; aberta hoje = 0). */
export function diasDesdeAbertura(v: OSVisao, hoje: DataISO): number {
  return Math.max(0, diferencaDias(dataNoFuso(v.os.criadoEm), hoje));
}

/** "hoje", "há 1 dia", "há 5 dias". */
export function textoHa(dias: number): string {
  if (dias <= 0) return "hoje";
  return dias === 1 ? "há 1 dia" : `há ${dias} dias`;
}

const dataDe = (m?: MarcoISO | DataISO): DataISO | undefined => (m ? (m.length > 10 ? dataNoFuso(m) : m) : undefined);

export interface TempoSituacao {
  /** Dias corridos na situação atual (0 = mudou hoje). */
  dias: number;
  /** De quando conta: "desde a entrada", "desde a aprovação"… ou "desde a abertura" quando falta o marco. */
  desde: string;
  /** Para agendados: "entra hoje", "entra amanhã", "entra em 3 dias", "entrada atrasada há 2 dias". */
  extra?: string;
}

/**
 * Há quanto tempo o carro está na situação atual, pelo marco que a situação registra
 * (entrada, pronto, entrega, aprovação, orçamento). Sem marco, conta desde a abertura — e diz isso.
 */
export function tempoNaSituacao(v: OSVisao, hoje: DataISO): TempoSituacao {
  const versao = versaoAtual(v);
  const conta = (marco: MarcoISO | DataISO | undefined, desde: string): TempoSituacao | undefined => {
    const d = dataDe(marco);
    return d ? { dias: Math.max(0, diferencaDias(d, hoje)), desde } : undefined;
  };
  const abertura: TempoSituacao = { dias: diasDesdeAbertura(v, hoje), desde: "desde a abertura" };
  switch (v.os.estado) {
    case "aguardando_aprovacao":
      return conta(versao?.criadoEm, "desde o orçamento") ?? abertura;
    case "aguardando_agendamento":
      return conta(versao?.aprovacao?.aprovadoEm, "desde a aprovação") ?? abertura;
    case "agendada": {
      const data = v.agendamento?.data;
      if (!data) return abertura;
      const falta = diferencaDias(hoje, data);
      const extra = falta < 0 ? `entrada atrasada ${textoHa(-falta)}` : falta === 0 ? "entra hoje" : falta === 1 ? "entra amanhã" : `entra em ${falta} dias`;
      return { ...abertura, extra };
    }
    case "na_oficina":
      return conta(v.os.entradaRealEm, "desde a entrada") ?? abertura;
    case "pronta":
      return conta(v.os.prontaEm, "desde que ficou pronto") ?? abertura;
    case "entregue":
    case "encerrada":
      return conta(v.os.entregueEm, "desde a entrega") ?? abertura;
    default:
      return abertura;
  }
}

/** Situações em que o carro já saiu do fluxo: na ordem "mais parado", vão para o fim. */
const FORA_DO_FLUXO: ReadonlySet<EstadoOS> = new Set(["entregue", "encerrada", "cancelada"]);

// ------------------------------------------------------------------ busca

const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/**
 * Busca da página: placa (com ou sem hífen, maiúscula ou minúscula), cliente, protocolo, sinistro, modelo,
 * seguradora ou nº da OS. Acentos e caixa não importam.
 */
export function combinaTermo(v: OSVisao, termo: string): boolean {
  const t = semAcento(termo.trim());
  if (!t) return true;
  const placa = normalizarPlaca(termo);
  if (placa.length >= 3 && normalizarPlaca(v.veiculo.placa).includes(placa)) return true;
  const campos = [
    v.cliente.nome,
    v.veiculo.modelo ?? "",
    String(v.os.numero),
    ...v.atendimentos.flatMap((a) => [a.idExterno ?? "", a.seguradora, a.numeroSinistro ?? ""]),
  ];
  return campos.some((c) => semAcento(c).includes(t));
}

// ------------------------------------------------------------------ filtros na URL

/** A primeira é o padrão: o mais parado em cima. */
export const ORDENS = ["tempo_desc", "tempo_asc", "valor_desc", "valor_asc", "estado_asc", "estado_desc"] as const;
export type OrdemLista = (typeof ORDENS)[number];
export type ColunaOrdenavel = "valor" | "tempo" | "estado";

export const TEXTO_ORDEM: Record<OrdemLista, string> = {
  tempo_desc: "Mais parado primeiro",
  tempo_asc: "Mudou há menos tempo primeiro",
  valor_desc: "Maior valor primeiro",
  valor_asc: "Menor valor primeiro",
  estado_asc: "Situação, do orçamento à entrega",
  estado_desc: "Situação, da entrega ao orçamento",
};

export interface FiltrosLista {
  q: string;
  /** Chave de aba ("todos" quando sem filtro) ou lista de estados com vírgula. */
  estado: string;
  valor?: FaixaValor;
  tempo?: FaixaTempo;
  origem?: FiltroOrigem;
  seguradora?: string;
  ordem: OrdemLista;
}

/** `?origem=com_seguradora`: tudo que tem seguradora no meio (Maxpar, direta, Maxpar + particular) — sem particular. */
export const ORIGEM_COM_SEGURADORA = "com_seguradora";
export const NOME_COM_SEGURADORA = "Com seguradora (todas)";
export type FiltroOrigem = OrigemOS | typeof ORIGEM_COM_SEGURADORA;
export const ORIGENS_FILTRO: readonly FiltroOrigem[] = [...ORIGENS_OS, ORIGEM_COM_SEGURADORA];

/** A origem da OS passa no filtro? (sem filtro = passa) */
export function combinaOrigem(origem: OrigemOS, filtro: FiltroOrigem | undefined): boolean {
  if (!filtro) return true;
  return filtro === ORIGEM_COM_SEGURADORA ? origem !== "particular" : origem === filtro;
}

export const ORDEM_PADRAO: OrdemLista = "tempo_desc";
export const FILTROS_VAZIOS: FiltrosLista = { q: "", estado: "todos", ordem: ORDEM_PADRAO };

const de = <T extends string>(lista: readonly T[], v: string | null): T | undefined => (v && (lista as readonly string[]).includes(v) ? (v as T) : undefined);

/** Lê os filtros da URL; valor desconhecido é ignorado (link velho não quebra a tela). */
export function lerFiltros(params: URLSearchParams): FiltrosLista {
  const estado = params.get("estado")?.trim() || "todos";
  return {
    q: params.get("q") ?? "",
    estado: estadosDaChave(estado).length === 0 ? "todos" : estado,
    valor: de(FAIXAS_VALOR.map((f) => f.valor), params.get("valor")),
    tempo: de(FAIXAS_TEMPO.map((f) => f.valor), params.get("tempo")),
    origem: de(ORIGENS_FILTRO, params.get("origem")),
    seguradora: params.get("seguradora")?.trim() || undefined,
    ordem: de(ORDENS, params.get("ordem")) ?? ORDEM_PADRAO,
  };
}

const CHAVES_URL = ["q", "estado", "valor", "tempo", "origem", "seguradora", "ordem"] as const;

/** Escreve os filtros na URL, mantendo outros parâmetros (ex.: `dev`, `perfil`); omite os padrões. */
export function escreverFiltros(f: FiltrosLista, base: URLSearchParams = new URLSearchParams()): URLSearchParams {
  const p = new URLSearchParams(base);
  for (const k of CHAVES_URL) p.delete(k);
  if (f.q) p.set("q", f.q);
  if (f.estado && f.estado !== "todos") p.set("estado", f.estado);
  if (f.valor) p.set("valor", f.valor);
  if (f.tempo) p.set("tempo", f.tempo);
  if (f.origem) p.set("origem", f.origem);
  if (f.seguradora) p.set("seguradora", f.seguradora);
  if (f.ordem !== ORDEM_PADRAO) p.set("ordem", f.ordem);
  return p;
}

/** Clique no cabeçalho: 1º clique = maior valor / mais parado / ordem do fluxo; 2º inverte. */
export function alternarOrdem(atual: OrdemLista, coluna: ColunaOrdenavel): OrdemLista {
  const [primeira, segunda]: [OrdemLista, OrdemLista] =
    coluna === "valor" ? ["valor_desc", "valor_asc"] : coluna === "tempo" ? ["tempo_desc", "tempo_asc"] : ["estado_asc", "estado_desc"];
  return atual === primeira ? segunda : primeira;
}

/** Direção da coluna na ordem atual (para a seta e o `aria-sort`). */
export function direcaoDaColuna(ordem: OrdemLista, coluna: ColunaOrdenavel): "ascending" | "descending" | undefined {
  if (!ordem.startsWith(coluna)) return undefined;
  // tempo_desc = mais parado primeiro = mais dias primeiro
  return ordem.endsWith("_desc") ? "descending" : "ascending";
}

/** Quantos filtros (sem contar busca e ordem) estão ligados — número do botão "Filtros" no celular. */
export function quantosFiltros(f: FiltrosLista): number {
  return [f.estado !== "todos", f.valor, f.tempo, f.origem, f.seguradora].filter(Boolean).length;
}

export const temFiltroAtivo = (f: FiltrosLista) => quantosFiltros(f) > 0 || f.q.trim() !== "" || f.ordem !== ORDEM_PADRAO;

// ------------------------------------------------------------------ aplicar

/** Aplica tudo menos o estado (as contagens das abas usam isto). */
export function filtrarSemEstado(lista: readonly OSVisao[], f: FiltrosLista, hoje: DataISO): OSVisao[] {
  return lista.filter((v) => {
    if (!combinaTermo(v, f.q)) return false;
    if (f.valor && faixaDoValor(valorDaOS(v).valor) !== f.valor) return false;
    if (f.tempo && faixaDoTempo(tempoNaSituacao(v, hoje).dias) !== f.tempo) return false;
    if (!combinaOrigem(v.os.origem, f.origem)) return false;
    if (f.seguradora && !v.atendimentos.some((a) => semAcento(a.seguradora) === semAcento(f.seguradora!))) return false;
    return true;
  });
}

export function filtrarPorEstado(lista: readonly OSVisao[], chave: string): OSVisao[] {
  const estados = estadosDaChave(chave);
  return estados.length === 0 ? [...lista] : lista.filter((v) => estados.includes(v.os.estado));
}

/**
 * Ordena (cópia). Por tempo, quem já saiu do fluxo (entregue, fechado, cancelado) fica no fim, o entregue
 * por último no topo dessa parte. Empate desempata pelo mais antigo na abertura.
 */
export function ordenarLista(lista: readonly OSVisao[], ordem: OrdemLista, hoje: DataISO): OSVisao[] {
  const dias = new Map(lista.map((v) => [v.os.id, tempoNaSituacao(v, hoje).dias]));
  const d = (v: OSVisao) => dias.get(v.os.id) ?? 0;
  const porAntigo = (a: OSVisao, b: OSVisao) => a.os.criadoEm.localeCompare(b.os.criadoEm);
  const fora = (v: OSVisao) => Number(FORA_DO_FLUXO.has(v.os.estado));
  const porTempo = (sinal: 1 | -1) => (a: OSVisao, b: OSVisao) =>
    fora(a) - fora(b) || (fora(a) ? d(a) - d(b) : sinal * (d(b) - d(a))) || porAntigo(a, b);
  const fluxo = (v: OSVisao) => ORDEM_FLUXO.indexOf(v.os.estado);
  const cmp: Record<OrdemLista, (a: OSVisao, b: OSVisao) => number> = {
    tempo_desc: porTempo(1),
    tempo_asc: porTempo(-1),
    valor_desc: (a, b) => valorDaOS(b).valor - valorDaOS(a).valor || porAntigo(a, b),
    valor_asc: (a, b) => valorDaOS(a).valor - valorDaOS(b).valor || porAntigo(a, b),
    estado_asc: (a, b) => fluxo(a) - fluxo(b) || d(b) - d(a) || porAntigo(a, b),
    estado_desc: (a, b) => fluxo(b) - fluxo(a) || d(b) - d(a) || porAntigo(a, b),
  };
  return [...lista].sort(cmp[ordem]);
}

/** Soma dos valores da lista (autorizado ou orçado), em centavos — o rodapé "12 carros · R$ 18.400". */
export function somaDaLista(lista: readonly OSVisao[]): number {
  return lista.reduce((t, v) => t + valorDaOS(v).valor, 0);
}

/** Seguradoras presentes na lista (para o filtro), em ordem alfabética, sem repetir. Maxpar é plataforma, não seguradora. */
export function seguradorasDe(lista: readonly OSVisao[]): string[] {
  const nomes = new Map<string, string>();
  for (const v of lista) for (const a of v.atendimentos) if (a.seguradora.trim() && !/maxpar/i.test(a.seguradora)) nomes.set(semAcento(a.seguradora.trim()), a.seguradora.trim());
  return [...nomes.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

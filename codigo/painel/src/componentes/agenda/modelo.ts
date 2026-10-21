import type { Agendamento, CapacidadeDia, ConfigOficina, DataISO, EstadoOS, Id, Janela, MarcoISO } from "@compartilhado/tipos";
import { vagasOcupadas, vagasRestantes } from "@compartilhado/dominio/agenda";
import { janelaDoDia } from "@compartilhado/dominio/expediente";
import { dataNoFuso, diferencaDias, paraMs } from "@compartilhado/dominio/fuso";
import type { OSVisao } from "../../dados/repositorio";
import { naDia, periodoTexto, plural, primeiroNome } from "./formato";

// Montagem da visão da Agenda a partir dos dados. As regras (quem ocupa vaga, quanto sobra)
// são as do domínio compartilhado; aqui só se organiza por dia e período para a tela.

export const JANELAS: Janela[] = ["manha", "tarde"];
const MEIO_DIA = 12 * 60;

export interface ItemAgenda {
  ag: Agendamento;
  v?: OSVisao;
}

export interface DiaAgenda {
  data: DataISO;
  total: number;
  ocupadas: number;
  restantes: number;
  bloqueado?: string;
  /** Dia fora do expediente (ex.: domingo). */
  fechado: boolean;
  /** Períodos sem expediente (ex.: sábado à tarde). */
  periodosFechados: Janela[];
  hoje: boolean;
  passado: boolean;
  itens: Record<Janela, ItemAgenda[]>;
}

/** Agendamento que aparece na grade: confirmado ou proposta ainda válida. */
export function estaNaGrade(a: Agendamento, agora: MarcoISO): boolean {
  if (a.estado === "confirmado") return true;
  return a.estado === "proposto" && (!a.expiraEm || paraMs(agora) < paraMs(a.expiraEm));
}

/** Minutos até a proposta expirar (negativo = já expirou); undefined se não expira. */
export function minutosParaExpirar(a: Agendamento, agora: MarcoISO): number | undefined {
  if (!a.expiraEm) return undefined;
  return (paraMs(a.expiraEm) - paraMs(agora)) / 60_000;
}

export function montarDias(
  capacidades: CapacidadeDia[],
  agendamentos: Agendamento[],
  oss: OSVisao[],
  config: ConfigOficina,
  agora: MarcoISO,
  hoje: DataISO,
  ignorarId?: Id,
): DiaAgenda[] {
  const porOS = new Map(oss.map((v) => [v.os.id, v]));
  return capacidades.map((c) => {
    const janela = janelaDoDia(c.data, config);
    const doDia = agendamentos.filter((a) => a.data === c.data && estaNaGrade(a, agora));
    const itens: Record<Janela, ItemAgenda[]> = { manha: [], tarde: [] };
    for (const ag of doDia) itens[ag.janela].push({ ag, v: porOS.get(ag.osId) });
    const periodosFechados: Janela[] = [];
    if (janela && janela.inicio >= MEIO_DIA) periodosFechados.push("manha");
    if (janela && janela.fim <= MEIO_DIA) periodosFechados.push("tarde");
    return {
      data: c.data,
      total: c.bloqueado ? 0 : c.vagasEntrada,
      ocupadas: vagasOcupadas(c.data, agendamentos, agora),
      restantes: vagasRestantes(c, agendamentos, agora, ignorarId),
      bloqueado: c.bloqueado,
      fechado: janela === null,
      periodosFechados,
      hoje: c.data === hoje,
      passado: c.data < hoje,
      itens,
    };
  });
}

/** O período aceita agendamento novo? (dia futuro ou hoje, aberto, não bloqueado, com vaga). */
export function periodoLivre(dia: DiaAgenda, janela: Janela): boolean {
  return !dia.passado && !dia.fechado && !dia.bloqueado && !dia.periodosFechados.includes(janela) && dia.restantes > 0;
}

export interface Vaga {
  data: DataISO;
  janela: Janela;
  restantes: number;
}

/** Próximos períodos com vaga, em ordem, sem repetir o horário atual (reagendamento). */
export function proximasVagas(dias: DiaAgenda[], limite: number, excluir?: { data: DataISO; janela: Janela }): Vaga[] {
  const lista: Vaga[] = [];
  for (const d of dias) {
    for (const j of JANELAS) {
      if (excluir && excluir.data === d.data && excluir.janela === j) continue;
      if (periodoLivre(d, j)) lista.push({ data: d.data, janela: j, restantes: d.restantes });
      if (lista.length >= limite) return lista;
    }
  }
  return lista;
}

/** Data em que a OS entrou na fila (aprovação confiável mais recente; senão, última atualização). */
export function aprovadaEm(v: OSVisao): MarcoISO {
  const datas = v.versoes.map((x) => x.aprovacao?.aprovadoEm).filter((x): x is string => Boolean(x));
  return datas.sort().at(-1) ?? v.os.atualizadoEm;
}

export function diasEsperando(v: OSVisao, hoje: DataISO): number {
  return Math.max(0, diferencaDias(dataNoFuso(aprovadaEm(v)), hoje));
}

export function textoOcupacao(dia: DiaAgenda): string {
  if (dia.bloqueado) return "Bloqueado";
  if (dia.fechado) return "Fechado";
  return `${dia.ocupadas} de ${plural(dia.total, "vaga", "vagas")}`;
}


/** Texto curto para o WhatsApp enquanto a Calia não tem API (modo manual, informações §3.3). */
export function mensagemAgendamento(v: OSVisao, vaga?: Vaga): string {
  const nome = primeiroNome(v.cliente.nome);
  const protocolo = v.atendimentos.find((a) => a.idExterno)?.idExterno;
  const carro = v.veiculo.modelo ? `o seu ${v.veiculo.modelo}` : "o seu carro";
  const abertura = protocolo ? `Sua autorização do protocolo ${protocolo} saiu.` : "Seu orçamento foi aprovado.";
  const pergunta = vaga ? `Podemos receber ${carro} ${naDia(vaga.data)} ${periodoTexto(vaga.janela)}?` : `Qual dia fica melhor para trazer ${carro}?`;
  return `Olá, ${nome}! Aqui é da D doctor. ${abertura} ${pergunta}`;
}

// ------------------------------------------------------------------ arrastar e mover (sprint SG)

/** Algo que pode ser movido na Agenda: um agendamento da grade ou um carro da fila (agendar). */
export interface Movel {
  /** "ag:<agendamentoId>" (grade) ou "os:<osId>" (fila). */
  chave: string;
  osId: Id;
  /** Ausente = vem da fila "Aguardando agendamento" (soltar = agendar). */
  agendamentoId?: Id;
  data?: DataISO;
  janela?: Janela;
  placa: string;
  modelo?: string;
}

export const JA_ESTA_AQUI = "Já está aqui";

export interface AvaliacaoDestino {
  /** Dá para soltar aqui (talvez com encaixe). */
  ok: boolean;
  /** Motivo curto: por que não dá ("Lotado" nunca recusa — vira encaixe) ou o aviso de encaixe. */
  motivo?: string;
  /** Quantos do grupo cabem nas vagas livres do dia. */
  cabem: number;
  /** Quantos do grupo mudariam de lugar (os que já estão neste turno não contam). */
  total: number;
  /** Quantos passariam da capacidade (encaixe: a recepção confirma em um toque). */
  encaixe: number;
}

/**
 * O destino (dia + turno) aceita o grupo? Mesmas regras da escrita (repositório): data passada,
 * dia sem expediente, dia bloqueado e turno fechado recusam. Falta de vaga não recusa: vira
 * **encaixe** (a recepção confirma; plano SG). Quem já está no mesmo dia (só troca manhã/tarde)
 * não ocupa vaga nova; os demais entram nas vagas na ordem do grupo.
 */
export function avaliarDestino(dia: DiaAgenda | undefined, janela: Janela, grupo: readonly Movel[]): AvaliacaoDestino {
  const movem = dia ? grupo.filter((m) => !(m.data === dia.data && m.janela === janela)) : [...grupo];
  const total = movem.length;
  const nao = (motivo: string): AvaliacaoDestino => ({ ok: false, motivo, cabem: 0, total, encaixe: 0 });
  if (!dia) return nao("Fora da agenda");
  if (total === 0) return nao(JA_ESTA_AQUI);
  if (dia.passado) return nao("Data passada");
  if (dia.bloqueado) return nao("Dia bloqueado");
  if (dia.fechado) return nao("Sem expediente");
  if (dia.periodosFechados.includes(janela)) return nao(janela === "tarde" ? "Fechado à tarde" : "Fechado de manhã");
  const precisam = movem.filter((m) => m.data !== dia.data).length;
  const cabem = total - precisam + Math.min(precisam, dia.restantes);
  const encaixe = total - cabem;
  const motivo = encaixe === 0 ? undefined : cabem === 0 ? "Lotado — encaixe" : `Cabem ${cabem} de ${total}`;
  return { ok: true, cabem, total, encaixe, motivo };
}

/** Separa o grupo entre os que vão (cabem no destino) e os que ficam onde estão. */
export function separarQueCabem(dia: DiaAgenda, janela: Janela, grupo: readonly Movel[]): { vao: Movel[]; ficam: Movel[] } {
  const vao: Movel[] = [];
  const ficam: Movel[] = [];
  let vagas = dia.restantes;
  for (const m of grupo) {
    if (m.data === dia.data && m.janela === janela) continue; // já está aqui
    if (m.data === dia.data) vao.push(m);
    else if (vagas > 0) {
      vao.push(m);
      vagas--;
    } else ficam.push(m);
  }
  return { vao, ficam };
}

const ARRASTAVEL: readonly EstadoOS[] = ["aguardando_agendamento", "agendada"];

/** O carro ainda pode mudar de dia? Depois que entrou na oficina (ou foi cancelado), não. */
export function podeMover(v: OSVisao | undefined): boolean {
  return Boolean(v && ARRASTAVEL.includes(v.os.estado));
}

/** "Marcos Silva Souza" → "Marcos S." (cartão da grade). */
export function clienteCurto(nome: string | undefined): string {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[partes.length - 1][0].toUpperCase()}.`;
}

/** Ordem de leitura da grade (dia a dia, manhã e depois tarde) — base do Shift+clique. */
export function chavesEmOrdem(dias: readonly DiaAgenda[], incluir: (item: ItemAgenda) => boolean): string[] {
  return dias.flatMap((d) => JANELAS.flatMap((j) => d.itens[j].filter(incluir).map((it) => `ag:${it.ag.id}`)));
}

/** Seleção com Shift: do item âncora até o clicado (inclusive), na ordem dada; soma à seleção atual. */
export function selecionarIntervalo(ordem: readonly string[], atual: readonly string[], ancora: string | null, alvo: string): string[] {
  const i = ancora ? ordem.indexOf(ancora) : -1;
  const k = ordem.indexOf(alvo);
  if (i < 0 || k < 0) return atual.includes(alvo) ? [...atual] : [...atual, alvo];
  const faixa = ordem.slice(Math.min(i, k), Math.max(i, k) + 1);
  return [...atual, ...faixa.filter((c) => !atual.includes(c))];
}

const TECNICA_CURTA: Record<string, string> = {
  sra: "SRA",
  martelinho: "martelinho",
  pintura: "pintura",
  funilaria: "funilaria",
  polimento: "polimento",
  outro: "outro",
};

/**
 * Tamanho do serviço para o cartão ("2 peças · martelinho"): peças da versão aprovada mais recente
 * (ou da última), sem as negadas e dispensadas; técnica mais frequente primeiro (até duas).
 */
export function tamanhoServico(v: OSVisao | undefined): string | undefined {
  if (!v || v.versoes.length === 0) return undefined;
  const ordenadas = [...v.versoes].sort((a, b) => b.numeroVersao - a.numeroVersao);
  const versao = ordenadas.find((x) => x.aprovacao) ?? ordenadas[0];
  const itens = versao.itens.filter((i) => i.statusItem !== "negado" && i.statusItem !== "dispensado");
  if (itens.length === 0) return undefined;
  const conta = new Map<string, number>();
  for (const i of itens) conta.set(i.tecnica, (conta.get(i.tecnica) ?? 0) + 1);
  const tecnicas = [...conta.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => TECNICA_CURTA[t] ?? t);
  const tec = tecnicas.length > 2 ? `${tecnicas[0]} + ${tecnicas.length - 1}` : tecnicas.join(" + ");
  return `${plural(itens.length, "peça", "peças")} · ${tec}`;
}

/** Carros com entrega prometida no dia que ainda não saíram (na oficina ou prontos) — "Saem". */
export function saidasDoDia(oss: readonly OSVisao[], data: DataISO): OSVisao[] {
  return oss.filter((v) => v.os.previsaoEntrega === data && (v.os.estado === "na_oficina" || v.os.estado === "pronta"));
}


/** Mensagem para avisar o cliente de um carro confirmado que mudou de dia/turno (plano SG). */
export function mensagemNovoHorario(v: OSVisao, data: DataISO, janela: Janela): string {
  const nome = primeiroNome(v.cliente.nome);
  const carro = v.veiculo.modelo ? `o seu ${v.veiculo.modelo}` : "o seu carro";
  return `Olá, ${nome}! Aqui é da D doctor. Precisamos mudar o horário para receber ${carro}: pode ser ${naDia(data)} ${periodoTexto(janela)}?`;
}

/**
 * Quem paga, curto, para o cartão: a seguradora (HDI, Liberty…) ou "Particular" — nunca "Maxpar"
 * (plano SG). Sem permissão de ver seguradora, só "Seguradora".
 */
export function origemCurta(v: OSVisao | undefined, veSeguradora: boolean): string | undefined {
  if (!v) return undefined;
  if (v.os.origem === "particular") return "Particular";
  const seg = veSeguradora ? v.atendimentos.find((a) => a.seguradora)?.seguradora : undefined;
  const nome = seg ?? "Seguradora";
  return v.os.origem === "misto" ? `${nome} + particular` : nome;
}

/** A partir de quantos carros no turno o cartão da grade fica compacto (placa + modelo). */
export const COMPACTAR_A_PARTIR = 3;

export function movelDe(item: ItemAgenda): Movel {
  return {
    chave: `ag:${item.ag.id}`,
    osId: item.ag.osId,
    agendamentoId: item.ag.id,
    data: item.ag.data,
    janela: item.ag.janela,
    placa: item.v?.veiculo.placa ?? "",
    modelo: item.v?.veiculo.modelo,
  };
}

export function movelDaFila(v: OSVisao): Movel {
  return { chave: `os:${v.os.id}`, osId: v.os.id, placa: v.veiculo.placa, modelo: v.veiculo.modelo };
}

import type { Agendamento, CapacidadeDia, ConfigOficina, DataISO, Id, Janela, MarcoISO } from "@compartilhado/tipos";
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


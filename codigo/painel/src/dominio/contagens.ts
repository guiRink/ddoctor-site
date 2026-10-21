// Contagens únicas do painel (revisão SG, item 2): um número e um nome para cada coisa, em todas as telas.
// Geral, Produção, TV e Orçamentos leem daqui; cada função devolve { total, itens } com o que a lista precisa,
// e total === itens.length (todo número abre a própria lista). Funções puras: `agora` e config por parâmetro.
import type { Agendamento, Centavos, ConfigOficina, CorCarro, DataISO, EstadoOS, EtapaOS, Id, Janela, MarcoISO, OrcamentoVersao, Pagador, Papel, PendenciaExterna, TituloReceber } from "@compartilhado/tipos";
import { DIAS_PRONTO_NAO_BUSCOU_PADRAO, DIAS_VISTORIA_VENCENDO_PADRAO } from "@compartilhado/dominio/config";
import { somaCentavos } from "@compartilhado/dominio/dinheiro";
import { estadoTitulo, saldoTitulo } from "@compartilhado/dominio/financeiro";
import { compararMarcos, dataNoFuso, diferencaDias, paraMs } from "@compartilhado/dominio/fuso";
import { clienteDeveOS } from "@compartilhado/dominio/pagamentos";
import { etapaAtual, situacaoCartao, type SituacaoCartao } from "@compartilhado/dominio/semaforo";
import { PESO_COR_CARRO, corDoCarro } from "@compartilhado/dominio/corCarro";
import { CORES_CARRO } from "@compartilhado/tipos";
import type { OSVisao } from "../dados/repositorio";
import { rotuloHaQuanto, rotuloPrazo, rotuloHorario } from "./horarios";
import { TIPO_PENDENCIA } from "./rotulos";
import { ehNomeDeSeguradora, nomeSeguradora, seguradoraDaOS } from "./seguradora";

export interface Contagem<T> {
  total: number;
  itens: T[];
}

const lista = <T>(itens: T[]): Contagem<T> => ({ total: itens.length, itens });

const MS_DIA = 86_400_000;
const FECHADAS: ReadonlySet<EtapaOS["estado"]> = new Set(["concluida", "dispensada"]);
const PENDENCIA_ABERTA: ReadonlySet<PendenciaExterna["estado"]> = new Set(["aberta", "em_andamento"]);
const ANTES_DA_ENTRADA: ReadonlySet<EstadoOS> = new Set(["rascunho", "aguardando_aprovacao", "aguardando_agendamento", "agendada"]);
const EM_ABERTO: ReadonlySet<EstadoOS> = new Set([...ANTES_DA_ENTRADA, "na_oficina", "pronta"]);

/** Versão vigente (a mais nova; o repositório entrega v.versoes da mais nova para a mais antiga). */
const versaoAtual = (v: OSVisao): OrcamentoVersao | undefined => v.versoes[0];
const placa = (v: OSVisao) => v.veiculo.placa;
const telefoneDe = (v: OSVisao) => v.cliente.telefone || v.cliente.whatsapp || undefined;
/** Etapas da OS ainda por fazer, em ordem. */
const restantes = (v: OSVisao) => [...v.etapas].filter((e) => !FECHADAS.has(e.estado)).sort((a, b) => a.ordem - b.ordem);

/**
 * Quanto o CLIENTE ainda paga na retirada — a mesma conta da ficha (clienteDeveOS): versão aprovada vigente,
 * franquia + complemento (seguradora) ou max(aprovado, títulos do cliente) (particular), menos o que ele já pagou.
 */
export function clienteDeve(v: OSVisao, pagadores: readonly Pagador[]): Centavos {
  return clienteDeveOS({ origem: v.os.origem, versoes: v.versoes, titulos: v.titulos, pagadores }).falta;
}

// ---------------------------------------------------------------- Na oficina

export interface ItemNaOficina {
  v: OSVisao;
  situacao: SituacaoCartao;
  etapa?: EtapaOS; // etapa atual (ausente se pronto)
  responsavelId?: Id;
  entrega?: DataISO; // entrega prometida
  prontoHaDias?: number; // só prontos (dias corridos desde prontaEm)
  naoBuscou: boolean; // pronto há DIAS_PRONTO_NAO_BUSCOU_PADRAO dias ou mais
}

const PESO_SITUACAO: Record<SituacaoCartao, number> = { atrasado: 0, impedido: 1, atencao: 2, no_prazo: 3, pronto: 4 };

/**
 * "Na oficina" = OS em na_oficina + pronta (o mesmo número no Geral, na Produção, na TV e em Orçamentos).
 * emServico + prontos = total. Ordem: atrasados, impedidos, atenção, no prazo, prontos (o mais antigo primeiro).
 */
export function naOficina(
  oss: readonly OSVisao[],
  agora: MarcoISO,
  config: ConfigOficina,
  diasNaoBuscou: number = DIAS_PRONTO_NAO_BUSCOU_PADRAO,
): Contagem<ItemNaOficina> & { emServico: number; prontos: number } {
  const hoje = dataNoFuso(agora);
  const itens: ItemNaOficina[] = [];
  for (const v of oss) {
    const situacao = situacaoCartao(v.os, v.etapas, agora, config);
    if (!situacao) continue;
    const etapa = situacao === "pronto" ? undefined : (etapaAtual(v.etapas) ?? undefined);
    const prontoHaDias = situacao === "pronto" && v.os.prontaEm ? Math.max(0, diferencaDias(dataNoFuso(v.os.prontaEm), hoje)) : undefined;
    itens.push({
      v,
      situacao,
      etapa,
      responsavelId: etapa?.responsavelId,
      entrega: v.os.previsaoEntrega,
      prontoHaDias,
      naoBuscou: prontoHaDias !== undefined && prontoHaDias >= diasNaoBuscou,
    });
  }
  itens.sort(
    (a, b) =>
      PESO_SITUACAO[a.situacao] - PESO_SITUACAO[b.situacao] ||
      (b.prontoHaDias ?? 0) - (a.prontoHaDias ?? 0) ||
      b.v.os.prioridade - a.v.os.prioridade ||
      (a.entrega ?? "9").localeCompare(b.entrega ?? "9") ||
      placa(a.v).localeCompare(placa(b.v)),
  );
  const prontos = itens.filter((i) => i.situacao === "pronto").length;
  return { ...lista(itens), emServico: itens.length - prontos, prontos };
}

// ---------------------------------------------------------------- Entram hoje

export interface ItemEntrada {
  v: OSVisao;
  ag: Agendamento;
  janela: Janela;
  confirmado: boolean; // false = horário proposto ainda não confirmado
  telefone?: string;
}

/** Proposta ainda vale (sem expiraEm não expira sozinha, como em agenda.ts). */
const propostaValida = (a: Agendamento, agoraMs: number) => a.estado === "proposto" && (!a.expiraEm || agoraMs < paraMs(a.expiraEm));

/** Agendamentos de hoje (confirmados ou propostos válidos) de carros que ainda não entraram. Manhã antes da tarde. */
export function entramHoje(
  oss: readonly OSVisao[],
  agendamentos: readonly Agendamento[],
  agora: MarcoISO,
): Contagem<ItemEntrada> & { confirmados: number; manha: number; tarde: number } {
  const hoje = dataNoFuso(agora);
  const agoraMs = paraMs(agora);
  const porId = new Map(oss.map((v) => [v.os.id, v]));
  const itens: ItemEntrada[] = [];
  for (const ag of agendamentos) {
    if (ag.data !== hoje || !(ag.estado === "confirmado" || propostaValida(ag, agoraMs))) continue;
    const v = porId.get(ag.osId);
    if (!v || (v.os.estado !== "agendada" && v.os.estado !== "aguardando_agendamento")) continue;
    itens.push({ v, ag, janela: ag.janela, confirmado: ag.estado === "confirmado", telefone: telefoneDe(v) });
  }
  itens.sort((a, b) => (a.janela === b.janela ? placa(a.v).localeCompare(placa(b.v)) : a.janela === "manha" ? -1 : 1));
  return {
    ...lista(itens),
    confirmados: itens.filter((i) => i.confirmado).length,
    manha: itens.filter((i) => i.janela === "manha").length,
    tarde: itens.filter((i) => i.janela === "tarde").length,
  };
}

// ---------------------------------------------------------------- Saem hoje

export interface ItemSaida {
  v: OSVisao;
  pronto: boolean;
  situacao: SituacaoCartao;
  etapa?: EtapaOS;
  etapasRestantes: number;
  /** O que falta: "" se pronto; "Polimento", "Polimento e Montagem", "Preparação e mais 2". */
  falta: string;
  aCobrarCliente: Centavos; // franquia/complemento ou saldo particular a receber na retirada
}

/** Texto curto do que falta a partir das etapas restantes. */
export function textoFalta(etapas: readonly EtapaOS[]): string {
  const nomes = etapas.map((e) => e.nome);
  if (nomes.length === 0) return "";
  if (nomes.length === 1) return nomes[0];
  if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`;
  return `${nomes[0]} e mais ${nomes.length - 1}`;
}

/** Entrega prometida hoje (na oficina ou pronta). Prontos primeiro (para "Registrar entrega"), depois o pior. */
export function saemHoje(
  oss: readonly OSVisao[],
  agora: MarcoISO,
  config: ConfigOficina,
  pagadores: readonly Pagador[],
): Contagem<ItemSaida> & { prontos: number; emServico: number } {
  const hoje = dataNoFuso(agora);
  const itens: ItemSaida[] = [];
  for (const v of oss) {
    if (v.os.previsaoEntrega?.slice(0, 10) !== hoje) continue;
    const situacao = situacaoCartao(v.os, v.etapas, agora, config);
    if (!situacao) continue;
    const pronto = situacao === "pronto";
    const faltam = pronto ? [] : restantes(v);
    itens.push({
      v,
      pronto,
      situacao,
      etapa: pronto ? undefined : (etapaAtual(v.etapas) ?? undefined),
      etapasRestantes: faltam.length,
      falta: textoFalta(faltam),
      aCobrarCliente: clienteDeve(v, pagadores),
    });
  }
  itens.sort((a, b) => Number(b.pronto) - Number(a.pronto) || PESO_SITUACAO[a.situacao] - PESO_SITUACAO[b.situacao] || placa(a.v).localeCompare(placa(b.v)));
  const prontos = itens.filter((i) => i.pronto).length;
  return { ...lista(itens), prontos, emServico: itens.length - prontos };
}

// ---------------------------------------------------------------- Atrasados e Parados
//
// Pedido do dono (revisão SH, docs/revisao-sh/pedido-dono.md): "atrasados é quando a gente passou do prazo e parado
// é quando a gente tá guardando uma peça ou algo do tipo; são duas situações diferentes". São duas listas
// independentes, só de carros em serviço (na_oficina; pronto não está atrasado nem parado). Um carro impedido cuja
// entrega prometida (ou etapa) já passou do prazo aparece NAS DUAS — cada lista responde a uma pergunta
// ("passou do prazo?" / "está travado?"), e o dono quer as duas zeradas. A pílula do cartão continua única
// (situacaoCartao: impedido vence atrasado).

const ehEmServico = (v: OSVisao) => v.os.estado === "na_oficina";
/** Etapas em andamento (na fila, em execução ou bloqueada), em ordem. */
const ativasDe = (v: OSVisao) => restantes(v).filter((e) => e.estado !== "aguardando");

export interface ItemAtrasado {
  v: OSVisao;
  /** "Entrega prometida passou" (a entrega vence a etapa) ou "Pintura passou do prazo". */
  motivo: string;
  /** Data da entrega prometida ou prazo da etapa. */
  desde: MarcoISO | DataISO;
  haQuanto: string; // "atrasado 2 dias", "atrasado 1 h"
  entregaVencida: boolean;
  /** Etapa que passou do prazo (ou a atual, quando só a entrega venceu). */
  etapa?: EtapaOS;
  responsavelId?: Id;
  /** Também está em Parados (etapa impedida). */
  parado: boolean;
  quemResolve: Papel; // produção
}

/**
 * "Atrasados" = passou do prazo: carro em serviço com a entrega prometida vencida (hoje > previsão) ou com uma etapa
 * em andamento além do prazo (agora > prazoEm). Para carro não impedido é exatamente situacaoCartao "atrasado".
 * O mais antigo primeiro.
 */
export function atrasados(oss: readonly OSVisao[], agora: MarcoISO, config: ConfigOficina): Contagem<ItemAtrasado> {
  const hoje = dataNoFuso(agora);
  const agoraMs = paraMs(agora);
  const itens: ItemAtrasado[] = [];
  for (const v of oss) {
    if (!ehEmServico(v)) continue;
    const previsao = v.os.previsaoEntrega?.slice(0, 10);
    const entregaVencida = Boolean(previsao && hoje > previsao);
    const ativas = ativasDe(v);
    const vencida = ativas.find((e) => e.prazoEm && agoraMs > paraMs(e.prazoEm));
    if (!entregaVencida && !vencida) continue;
    const etapa = vencida ?? etapaAtual(v.etapas) ?? undefined;
    const parado = ativas.some((e) => e.estado === "bloqueada");
    const base = { v, entregaVencida, etapa, responsavelId: etapa?.responsavelId, parado, quemResolve: "producao" as const };
    if (entregaVencida && previsao) {
      itens.push({ ...base, motivo: "Entrega prometida passou", desde: previsao, haQuanto: rotuloPrazo(previsao, agora, config) });
    } else {
      const desde = vencida!.prazoEm!;
      itens.push({ ...base, motivo: `${vencida!.nome} passou do prazo`, desde, haQuanto: rotuloPrazo(desde, agora, config) });
    }
  }
  itens.sort((a, b) => paraMs(a.desde) - paraMs(b.desde) || placa(a.v).localeCompare(placa(b.v)));
  return lista(itens);
}

export interface ItemParado {
  v: OSVisao;
  /** Motivo do impedimento ("Aguardando peça", "Falta de material"). */
  motivo: string;
  /** Início do impedimento. */
  desde: MarcoISO;
  haQuanto: string; // "há 5 h", "há 2 dias"
  /** Etapa impedida. */
  etapa?: EtapaOS;
  responsavelId?: Id;
  /** Também está em Atrasados (passou do prazo). */
  atrasado: boolean;
  quemResolve: Papel; // dono (destravar: peça, autorização, material)
}

/**
 * "Parados" = travado: carro em serviço com etapa impedida (bloqueada — aguardando peça, material, autorização),
 * exatamente situacaoCartao "impedido". Motivo e início do impedimento aberto (sem bloqueio aberto: início da etapa ou
 * última atualização da OS, motivo "Parado"; bloqueio já encerrado não conta). O parado há mais tempo primeiro.
 */
export function parados(oss: readonly OSVisao[], agora: MarcoISO, config: ConfigOficina): Contagem<ItemParado> {
  const noAtraso = new Set(atrasados(oss, agora, config).itens.map((i) => i.v.os.id));
  const itens: ItemParado[] = [];
  for (const v of oss) {
    if (!ehEmServico(v)) continue;
    const etapa = restantes(v).find((e) => e.estado === "bloqueada");
    if (!etapa) continue;
    // só o impedimento ABERTO: um bloqueio já encerrado traria data e motivo antigos
    const bloqueio = etapa.bloqueios.find((b) => !b.fimEm);
    const desde = bloqueio?.inicioEm ?? etapa.iniciadaEm ?? v.os.atualizadoEm;
    itens.push({
      v,
      motivo: bloqueio?.motivo?.trim() || "Parado",
      desde,
      haQuanto: rotuloHaQuanto(desde, agora),
      etapa,
      responsavelId: etapa.responsavelId,
      atrasado: noAtraso.has(v.os.id),
      quemResolve: "dono",
    });
  }
  itens.sort((a, b) => paraMs(a.desde) - paraMs(b.desde) || placa(a.v).localeCompare(placa(b.v)));
  return lista(itens);
}

// ---------------------------------------------------------------- Cor do carro (pedido do dono, 2º áudio)

export interface ItemCor {
  v: OSVisao;
  cor: CorCarro;
  /** "Entrega amanhã · 2 de 4 etapas", "Atrasado 2 dias", "Pronto". */
  motivo: string;
  diasUteisParaEntrega: number | null;
  /** Etapa atual (placa + etapa no mosaico da TV); ausente se pronto. */
  etapa?: EtapaOS;
  /** Selo à parte: etapa impedida (a cor não muda por isso). */
  parado: boolean;
  /** prioridade 2 (o dono marcou "urgente"). */
  urgente: boolean;
  /** O carro tem prazo/alerta próprio (OS.alerta). */
  personalizado: boolean;
  pronto: boolean;
}

/**
 * Carros "Na oficina" pintados pela cor (corDoCarro) e a contagem por cor, para o mosaico da TV e o Geral.
 * Por padrão inclui os prontos (verdes, "Pronto"), então total = naOficina().total; `incluirProntos: false` deixa só
 * os em serviço. Coerente com Atrasados: todo vermelho piscando (entrega vencida) está em atrasados().
 * Ordem: pior cor primeiro; depois menos dias úteis para a entrega, urgente, placa; prontos por último.
 */
export function porCor(
  oss: readonly OSVisao[],
  agora: MarcoISO,
  config: ConfigOficina,
  opcoes: { incluirProntos?: boolean } = {},
): Contagem<ItemCor> & { porCor: Record<CorCarro, number> } {
  const incluirProntos = opcoes.incluirProntos ?? true;
  const itens: ItemCor[] = [];
  for (const v of oss) {
    const pronto = v.os.estado === "pronta";
    if (!ehEmServico(v) && !(pronto && incluirProntos)) continue;
    const c = corDoCarro(v.os, v.etapas, agora, config);
    itens.push({
      v,
      cor: c.cor,
      motivo: c.motivo,
      diasUteisParaEntrega: c.diasUteisParaEntrega,
      etapa: pronto ? undefined : (etapaAtual(v.etapas) ?? undefined),
      parado: !pronto && v.etapas.some((e) => e.estado === "bloqueada"),
      urgente: v.os.prioridade === 2,
      personalizado: c.personalizado,
      pronto,
    });
  }
  itens.sort(
    (a, b) =>
      Number(a.pronto) - Number(b.pronto) ||
      PESO_COR_CARRO[b.cor] - PESO_COR_CARRO[a.cor] ||
      (a.diasUteisParaEntrega ?? Infinity) - (b.diasUteisParaEntrega ?? Infinity) ||
      Number(b.urgente) - Number(a.urgente) ||
      placa(a.v).localeCompare(placa(b.v)),
  );
  const contagem = Object.fromEntries(CORES_CARRO.map((cor) => [cor, itens.filter((i) => i.cor === cor).length])) as Record<CorCarro, number>;
  return { ...lista(itens), porCor: contagem };
}

// ---------------------------------------------------------------- Aguardando aprovação e Aguardando seguradora

export interface ItemAguardandoAprovacao {
  v: OSVisao;
  /** Seguradora (HDI, Liberty…; nunca "Maxpar") ou "Particular" — seguradoraDaOS. */
  pagador: string;
  particular: boolean;
  protocolo?: string;
  desde: DataISO; // envio do orçamento (versão vigente) ou abertura do atendimento
  dias: number;
  valorOrcado: Centavos; // Σ itens não dispensados nem negados da versão vigente
}

/**
 * "Aguardando aprovação" = todo orçamento feito e ainda não aprovado (estado aguardando_aprovacao), particular ou
 * de seguradora; cada OS conta um ("se eu fiz 10 orçamentos, aparece 10"). Decisão SH: o rascunho ("Em orçamento")
 * NÃO entra, mesmo com itens — ainda não foi feito/enviado a ninguém (o atendimento novo já nasce aguardando
 * aprovação) — e assim o número é o mesmo da aba "Aguardando aprovação" de Orçamentos. Aprovado, passa para
 * "Aguardando agendamento". O mais antigo primeiro.
 */
export function aguardandoAprovacao(
  oss: readonly OSVisao[],
  agora: MarcoISO,
): Contagem<ItemAguardandoAprovacao> & { maisAntigoDias: number; deSeguradora: number; particulares: number } {
  const hoje = dataNoFuso(agora);
  const itens: ItemAguardandoAprovacao[] = [];
  for (const v of oss) {
    if (v.os.estado !== "aguardando_aprovacao") continue;
    const at = v.atendimentos[0];
    const versao = versaoAtual(v);
    const desde = versao ? dataNoFuso(versao.criadoEm) : (at?.aberturaEm ?? dataNoFuso(v.os.criadoEm));
    const valorOrcado = somaCentavos((versao?.itens ?? []).filter((i) => i.statusItem !== "dispensado" && i.statusItem !== "negado").map((i) => i.valor));
    const particular = v.os.origem === "particular";
    itens.push({ v, pagador: seguradoraDaOS(v), particular, protocolo: particular ? undefined : at?.idExterno, desde, dias: Math.max(0, diferencaDias(desde, hoje)), valorOrcado });
  }
  itens.sort((a, b) => b.dias - a.dias || placa(a.v).localeCompare(placa(b.v)));
  const particulares = itens.filter((i) => i.particular).length;
  return { ...lista(itens), maisAntigoDias: itens[0]?.dias ?? 0, deSeguradora: itens.length - particulares, particulares };
}

/** "Aguardando seguradora" = os de "Aguardando aprovação" que dependem da seguradora (não particulares). */
export function aguardandoSeguradora(oss: readonly OSVisao[], agora: MarcoISO): Contagem<ItemAguardandoAprovacao> & { maisAntigoDias: number } {
  const itens = aguardandoAprovacao(oss, agora).itens.filter((i) => !i.particular);
  return { ...lista(itens), maisAntigoDias: itens[0]?.dias ?? 0 };
}

// ---------------------------------------------------------------- Dinheiro vencido

export type TipoDevedor = "seguradora" | "cliente" | "outro";

export interface Devedor {
  tipo: TipoDevedor;
  /** Seguradora do atendimento (HDI, Liberty…), nunca "Maxpar"; cliente pelo nome. */
  nome: string;
}

export interface ItemVencido {
  t: TituloReceber;
  v?: OSVisao;
  saldo: Centavos;
  diasAtraso: number;
  devedor: Devedor;
}

export interface GrupoDevedor extends Devedor {
  valor: Centavos;
  titulos: number;
}

/** Quem deve o título: pagador maxpar/seguradora → seguradora do atendimento (regra de seguradoraDaOS, nunca "Maxpar"); cliente → nome do cliente. */
export function devedorDoTitulo(t: TituloReceber, pagadores: readonly Pagador[], v?: OSVisao): Devedor {
  const p = pagadores.find((x) => x.id === t.pagadorId);
  if (p?.tipo === "cliente") return { tipo: "cliente", nome: v?.cliente.nome ?? p.nome };
  if (p?.tipo === "maxpar" || p?.tipo === "seguradora") {
    const seguradora = v ? nomeSeguradora(v) : undefined;
    return { tipo: "seguradora", nome: seguradora ?? (p.tipo === "seguradora" && ehNomeDeSeguradora(p.nome) ? p.nome : "Seguradora") };
  }
  return { tipo: "outro", nome: p?.nome ?? "Outro" };
}

/** Títulos vencidos com saldo, o mais antigo primeiro, e a soma por quem deve (maior primeiro). */
export function dinheiroVencido(
  titulos: readonly TituloReceber[],
  pagadores: readonly Pagador[],
  oss: readonly OSVisao[],
  agora: MarcoISO,
): Contagem<ItemVencido> & { valor: Centavos; porDevedor: GrupoDevedor[] } {
  const hoje = dataNoFuso(agora);
  const porId = new Map(oss.map((v) => [v.os.id, v]));
  const itens: ItemVencido[] = [];
  for (const t of titulos) {
    if (estadoTitulo(t, hoje) !== "vencido") continue;
    const saldo = saldoTitulo(t);
    if (saldo <= 0) continue;
    const v = porId.get(t.osId);
    itens.push({ t, v, saldo, diasAtraso: diferencaDias(t.vencimento, hoje), devedor: devedorDoTitulo(t, pagadores, v) });
  }
  itens.sort((a, b) => a.t.vencimento.localeCompare(b.t.vencimento) || b.saldo - a.saldo);
  const grupos = new Map<string, GrupoDevedor>();
  for (const i of itens) {
    const chave = `${i.devedor.tipo}:${i.devedor.nome}`;
    const g = grupos.get(chave) ?? { ...i.devedor, valor: 0, titulos: 0 };
    g.valor += i.saldo;
    g.titulos += 1;
    grupos.set(chave, g);
  }
  const porDevedor = [...grupos.values()].sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, "pt-BR"));
  return { ...lista(itens), valor: somaCentavos(itens.map((i) => i.saldo)), porDevedor };
}

// ---------------------------------------------------------------- Aguardando agendamento

export interface ItemAguardandoAgendamento {
  v: OSVisao;
  telefone?: string;
  semTelefone: boolean;
  proposta?: Agendamento; // horário proposto ainda válido (esperando o cliente)
  aprovadoEm?: MarcoISO;
  dias: number; // desde a aprovação (ou a criação da OS)
}

const propostaDa = (osId: Id, agendamentos: readonly Agendamento[], agoraMs: number) =>
  agendamentos.filter((a) => a.osId === osId && propostaValida(a, agoraMs)).sort((a, b) => a.data.localeCompare(b.data))[0];

/**
 * "Aguardando agendamento" = orçamento aprovado e sem dia de entrada marcado (estado aguardando_agendamento; a fila
 * da recepção), com telefone e há quantos dias foi aprovado. A aprovada há mais tempo primeiro.
 */
export function aguardandoAgendamento(
  oss: readonly OSVisao[],
  agendamentos: readonly Agendamento[],
  agora: MarcoISO,
): Contagem<ItemAguardandoAgendamento> & { maisAntigoDias: number; semTelefone: number } {
  const agoraMs = paraMs(agora);
  const itens: ItemAguardandoAgendamento[] = oss
    .filter((v) => v.os.estado === "aguardando_agendamento")
    .map((v) => {
      const aprovadoEm = versaoAtual(v)?.aprovacao?.aprovadoEm;
      const desde = aprovadoEm ?? v.os.criadoEm;
      const telefone = telefoneDe(v);
      return { v, telefone, semTelefone: !telefone, proposta: propostaDa(v.os.id, agendamentos, agoraMs), aprovadoEm, dias: Math.max(0, Math.floor((agoraMs - paraMs(desde)) / MS_DIA)) };
    });
  itens.sort((a, b) => compararMarcos(a.aprovadoEm ?? a.v.os.criadoEm, b.aprovadoEm ?? b.v.os.criadoEm) || placa(a.v).localeCompare(placa(b.v)));
  return { ...lista(itens), maisAntigoDias: itens[0]?.dias ?? 0, semTelefone: itens.filter((i) => i.semTelefone).length };
}

// ---------------------------------------------------------------- Para fazer hoje

export type TipoAfazer = "proposta_expirando" | "vistoria_vencendo" | "pendencia_portal" | "agendar" | "sem_telefone";

export interface ItemAfazer {
  chave: string; // única na lista (para React)
  tipo: TipoAfazer;
  v: OSVisao;
  placa: string;
  texto: string; // "Vistoria vence amanhã", "Reenviar documentação no portal · há 4 dias"
  quem: Papel; // recepcao | dono | financeiro (rótulo em PAPEL de rotulos.ts)
  para: string; // rota de destino no painel
  quando?: MarcoISO | DataISO; // prazo ou início, para ordenar
}

const ORDEM_AFAZER: Record<TipoAfazer, number> = { proposta_expirando: 0, vistoria_vencendo: 1, pendencia_portal: 2, agendar: 3, sem_telefone: 4 };

/**
 * O que a equipe tem de fazer hoje, com quem faz e para onde ir: pendências no portal (Maxpar) abertas,
 * vistoria vencendo (limite a até `diasVistoria` dias, antes da entrada), horário proposto expirando em 24 h
 * (ou já expirado e sem resposta), aprovado sem agendar (com telefone) e OS em aberto sem telefone do cliente.
 * Cada OS aparece no máximo uma vez por tipo; "sem telefone" substitui "agendar".
 */
export function paraFazerHoje(
  oss: readonly OSVisao[],
  agendamentos: readonly Agendamento[],
  agora: MarcoISO,
  config: ConfigOficina,
  diasVistoria: number = DIAS_VISTORIA_VENCENDO_PADRAO,
): Contagem<ItemAfazer> {
  const hoje = dataNoFuso(agora);
  const agoraMs = paraMs(agora);
  const porId = new Map(oss.map((v) => [v.os.id, v]));
  const itens: ItemAfazer[] = [];
  const item = (tipo: TipoAfazer, v: OSVisao, texto: string, para: string, quando?: string, sufixo = ""): ItemAfazer => ({
    chave: `${tipo}:${v.os.id}${sufixo}`,
    tipo,
    v,
    placa: placa(v),
    texto,
    quem: "recepcao",
    para,
    quando,
  });

  for (const ag of agendamentos) {
    if (ag.estado !== "proposto" || !ag.expiraEm) continue;
    const v = porId.get(ag.osId);
    if (!v || !EM_ABERTO.has(v.os.estado)) continue;
    const restaMs = paraMs(ag.expiraEm) - agoraMs;
    if (restaMs > MS_DIA) continue;
    const texto = restaMs <= 0 ? "Horário proposto expirou · remarcar" : `Horário proposto expira ${rotuloHorario(ag.expiraEm, agora)}`;
    itens.push(item("proposta_expirando", v, texto, "/agenda", ag.expiraEm, `:${ag.id}`));
  }

  for (const v of oss) {
    if (ANTES_DA_ENTRADA.has(v.os.estado)) {
      const limite = v.atendimentos.map((a) => a.limiteVistoriaEm).filter((d): d is DataISO => Boolean(d)).sort()[0];
      if (limite) {
        const dias = diferencaDias(hoje, limite);
        if (dias <= diasVistoria) {
          const texto = dias < 0 ? `Vistoria vencida ${rotuloHaQuanto(limite, agora)}` : `Vistoria vence ${rotuloPrazo(limite, agora, config)}`;
          itens.push(item("vistoria_vencendo", v, texto, `/orcamentos/${v.os.id}`, limite));
        }
      }
    }
    for (const p of v.pendencias) {
      if (!PENDENCIA_ABERTA.has(p.estado)) continue;
      const acao = TIPO_PENDENCIA[p.tipo];
      const texto = `${acao}${/portal/i.test(acao) ? "" : " no portal"} · ${rotuloHaQuanto(p.criadaEm, agora)}`;
      itens.push(item("pendencia_portal", v, texto, `/orcamentos/${v.os.id}`, p.criadaEm, `:${p.id}`));
    }
    if (!EM_ABERTO.has(v.os.estado)) continue;
    if (!telefoneDe(v)) {
      const texto = v.os.origem === "particular" ? "Sem telefone · completar cadastro" : "Sem telefone · pedir à seguradora";
      itens.push(item("sem_telefone", v, texto, `/clientes/${v.cliente.id}`, v.os.criadoEm));
    } else if (v.os.estado === "aguardando_agendamento" && !propostaDa(v.os.id, agendamentos, agoraMs)) {
      const desde = versaoAtual(v)?.aprovacao?.aprovadoEm ?? v.os.criadoEm;
      itens.push(item("agendar", v, `Ligar para agendar · aprovado ${rotuloHaQuanto(desde, agora)}`, "/agenda", desde));
    }
  }

  itens.sort(
    (a, b) =>
      ORDEM_AFAZER[a.tipo] - ORDEM_AFAZER[b.tipo] ||
      (a.quando && b.quando ? paraMs(a.quando) - paraMs(b.quando) : 0) ||
      a.placa.localeCompare(b.placa),
  );
  return lista(itens);
}

// ---------------------------------------------------------------- Prontos com franquia a cobrar

export interface ItemCobrarCliente {
  v: OSVisao;
  valor: Centavos;
  tipo: "franquia" | "servico"; // franquia/complemento (seguradora) ou serviço particular
}

/** Carros prontos em que o cliente ainda deve pagar na retirada. Maior valor primeiro. */
export function prontosCobrarFranquia(oss: readonly OSVisao[], pagadores: readonly Pagador[]): Contagem<ItemCobrarCliente> & { valor: Centavos } {
  const itens: ItemCobrarCliente[] = oss
    .filter((v) => v.os.estado === "pronta")
    .map((v) => ({ v, valor: clienteDeve(v, pagadores), tipo: v.os.origem === "particular" ? ("servico" as const) : ("franquia" as const) }))
    .filter((i) => i.valor > 0)
    .sort((a, b) => b.valor - a.valor || placa(a.v).localeCompare(placa(b.v)));
  return { ...lista(itens), valor: somaCentavos(itens.map((i) => i.valor)) };
}

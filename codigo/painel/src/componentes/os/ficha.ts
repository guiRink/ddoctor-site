// Leituras da ficha da OS (sem componentes): o que o cliente deve, a entrega prometida, a contagem das
// etapas e o que falta antes de entregar o carro. As regras de dinheiro vêm do domínio (pagamentos/custos).
import type { Centavos, DataISO, EstadoOS, EtapaOS, MarcoISO, Pagador } from "@compartilhado/tipos";
import { receitaOS } from "@compartilhado/dominio/custos";
import { formatarReais, somaCentavos } from "@compartilhado/dominio/dinheiro";
import { dataNoFuso, diferencaDias } from "@compartilhado/dominio/fuso";
import { titulosDoCliente, valorEsperadoCliente } from "@compartilhado/dominio/pagamentos";
import { etapaAtual } from "@compartilhado/dominio/semaforo";
import type { OSVisao } from "../../dados/repositorio";

// ------------------------------------------------------------------ cliente deve

export interface ClienteDeve {
  /** O que compõe a conta do cliente: "Franquia", "Complemento particular" ou "Serviço particular". */
  partes: { nome: string; valor: Centavos }[];
  total: Centavos;
  pago: Centavos;
  falta: Centavos;
  /** Seguradora sem franquia (sinistro de terceiro): o cliente não paga nada na oficina. */
  semFranquia: boolean;
}

/**
 * Quanto o cliente paga na oficina, desde a aprovação: particular = valor aprovado; com seguradora =
 * franquia + complemento particular (valorEsperadoCliente). Pago = baixas dos títulos do cliente.
 * Se já há título do cliente maior que o esperado, vale o título. Sem orçamento aprovado nem título: null.
 */
export function clienteDeve(v: OSVisao, pagadores: readonly Pagador[]): ClienteDeve | null {
  const receita = receitaOS({ versoes: v.versoes, titulos: v.titulos });
  const vigente = v.versoes.find((x) => x.id === receita.versaoId);
  const doCliente = titulosDoCliente(v.titulos, pagadores).filter((t) => t.estado !== "cancelado");
  if (!vigente && doCliente.length === 0) return null;

  const esperado = valorEsperadoCliente(v.os.origem, vigente);
  const cobrado = somaCentavos(doCliente.map((t) => t.valor));
  const total = Math.max(esperado, cobrado);
  const pago = somaCentavos(doCliente.flatMap((t) => t.baixas.map((b) => b.valor)));

  const partes: ClienteDeve["partes"] = [];
  if (v.os.origem === "particular") {
    partes.push({ nome: "Serviço particular", valor: total });
  } else {
    const franquia = Math.max(0, vigente?.franquia ?? 0);
    const complemento = Math.max(0, vigente?.complementoParticular ?? 0);
    if (franquia > 0) partes.push({ nome: "Franquia", valor: franquia });
    if (complemento > 0) partes.push({ nome: "Complemento particular", valor: complemento });
    const resto = total - franquia - complemento;
    if (resto > 0) partes.push({ nome: "Outros valores", valor: resto });
  }
  return {
    partes,
    total,
    pago,
    falta: Math.max(0, total - pago),
    semFranquia: v.os.origem !== "particular" && total === 0,
  };
}

/** "Franquia de R$ 160,00 não paga", "Franquia: faltam R$ 60,00", "Faltam R$ 300,00 do cliente (franquia e complemento)". */
export function textoFaltaCliente(d: ClienteDeve): string {
  if (d.falta <= 0) return "";
  if (d.partes.length === 1) {
    const [p] = d.partes;
    if (d.pago === 0) return `${p.nome} de ${formatarReais(p.valor)} não paga`;
    return `${p.nome}: faltam ${formatarReais(d.falta)}`;
  }
  const nomes = d.partes.map((p) => p.nome.toLowerCase().replace(" particular", "")).join(" e ");
  return `Faltam ${formatarReais(d.falta)} do cliente (${nomes})`;
}

// ------------------------------------------------------------------ entrega prometida

export interface Prometido {
  data: DataISO;
  /** "hoje", "amanhã", "em 3 dias", "atrasado 2 dias", "entregue". */
  relativo: string;
  tom: "amarelo" | "neutro" | "alerta" | "ok";
}

const DEPOIS_DA_ENTREGA: EstadoOS[] = ["entregue", "encerrada"];

/** Data prometida ao cliente com a distância até hoje. Depois da entrega não conta atraso. */
export function prometidoAoCliente(previsao: DataISO | undefined, estado: EstadoOS, agora: MarcoISO): Prometido | null {
  if (!previsao || estado === "cancelada") return null;
  if (DEPOIS_DA_ENTREGA.includes(estado)) return { data: previsao, relativo: "entregue", tom: "ok" };
  const dias = diferencaDias(dataNoFuso(agora), previsao);
  if (dias === 0) return { data: previsao, relativo: "hoje", tom: "amarelo" };
  if (dias === 1) return { data: previsao, relativo: "amanhã", tom: "neutro" };
  if (dias > 1) return { data: previsao, relativo: `em ${dias} dias`, tom: "neutro" };
  const atraso = -dias;
  return { data: previsao, relativo: `atrasado ${atraso} ${atraso === 1 ? "dia" : "dias"}`, tom: "alerta" };
}

// ------------------------------------------------------------------ etapas

/** Número de cada etapa entre as que valem (dispensada = null), para a lista bater com "de 3". */
export function numerosEtapas(etapas: readonly EtapaOS[]): Map<string, number | null> {
  const mapa = new Map<string, number | null>();
  let n = 0;
  [...etapas]
    .sort((a, b) => a.ordem - b.ordem)
    .forEach((e) => mapa.set(e.id, e.estado === "dispensada" ? null : ++n));
  return mapa;
}

/** "Etapa 2 de 3 (1 dispensada)", "3 de 3 feitas", "1 de 3 feitas (1 dispensada)". */
export function textoEtapas(etapas: readonly EtapaOS[]): string {
  if (etapas.length === 0) return "";
  const validas = etapas.filter((e) => e.estado !== "dispensada");
  const dispensadas = etapas.length - validas.length;
  const sufixo = dispensadas > 0 ? ` (${dispensadas} ${dispensadas === 1 ? "dispensada" : "dispensadas"})` : "";
  const atual = etapaAtual(etapas);
  if (atual) return `Etapa ${numerosEtapas(etapas).get(atual.id)} de ${validas.length}${sufixo}`;
  const feitas = validas.filter((e) => e.estado === "concluida").length;
  return `${feitas} de ${validas.length} feitas${sufixo}`;
}

// ------------------------------------------------------------------ antes de entregar

export interface FaltaEntrega {
  tipo: "pagamento" | "foto";
  texto: string;
}

/** O que falta para entregar o carro (avisa, não trava): pagamento do cliente e foto de saída (fase final). */
export function faltasParaEntregar(v: OSVisao, deve: ClienteDeve | null): FaltaEntrega[] {
  const faltas: FaltaEntrega[] = [];
  if (deve && deve.falta > 0) faltas.push({ tipo: "pagamento", texto: textoFaltaCliente(deve) });
  if (!v.fotos.some((f) => f.fase === "final")) faltas.push({ tipo: "foto", texto: "Nenhuma foto de saída" });
  return faltas;
}

// ------------------------------------------------------------------ ação amarela do topo

export type AcaoPrimaria = "aprovacao" | "agendar" | "receber" | "pagamento" | "entrega";

/**
 * A única ação amarela da Próxima ação, por estado. Pronto com o cliente devendo: primeiro receber, depois
 * entregar. A aba Pagamentos usa isto para não pôr um segundo botão amarelo na tela.
 */
export function acaoPrimariaDoTopo(estado: EstadoOS, faltaCliente: Centavos): AcaoPrimaria | null {
  switch (estado) {
    case "aguardando_aprovacao":
      return "aprovacao";
    case "aguardando_agendamento":
      return "agendar";
    case "agendada":
      return "receber";
    case "pronta":
      return faltaCliente > 0 ? "pagamento" : "entrega";
    case "entregue":
      return faltaCliente > 0 ? "pagamento" : null;
    default:
      return null;
  }
}

import { differenceInCalendarDays, parseISO } from "date-fns";
import { ETAPAS, type Atendimento, type Etapa, type Pendencia } from "./tipos";

/** Posição da etapa no fluxo (0 = aguardando autorização … 8 = pago). */
export function ordemEtapa(etapa: Etapa): number {
  return ETAPAS.indexOf(etapa);
}

export function etapaAnteriorA(a: Etapa, b: Etapa): boolean {
  return ordemEtapa(a) < ordemEtapa(b);
}

/** Etapas em que o carro ainda não foi entregue ao cliente. */
export function emAberto(atendimento: Atendimento): boolean {
  return etapaAnteriorA(atendimento.etapa, "entregue");
}

/** Etapas em que o carro está fisicamente na oficina. */
export function estaNaOficina(atendimento: Atendimento): boolean {
  return atendimento.etapa === "no_patio" || atendimento.etapa === "pronto";
}

export function diasEntre(deISO: string, ateISO: string): number {
  return differenceInCalendarDays(parseISO(ateISO), parseISO(deISO));
}

export function diasNaEtapa(atendimento: Atendimento, hojeISO: string): number {
  return Math.max(0, diasEntre(atendimento.etapaDesde.slice(0, 10), hojeISO));
}

/** Limites (em dias) que viram pendência. Ajustáveis depois do levantamento com a oficina. */
export const LIMITES = {
  diasSemAutorizacao: 3,
  diasAvisoVistoria: 2,
  diasPagamentoMaxpar: 30,
} as const;

/** Previsão que vale para o cliente: a prometida a ele; se não houver, a do portal. */
export function previsaoEfetiva(atendimento: Atendimento): string | undefined {
  return atendimento.previsaoCliente ?? atendimento.previsaoPortal;
}

export function entregaAtrasada(atendimento: Atendimento, hojeISO: string): boolean {
  const previsao = previsaoEfetiva(atendimento);
  if (!previsao || !emAberto(atendimento)) return false;
  return diasEntre(previsao, hojeISO) > 0;
}

export function pendencias(atendimento: Atendimento, hojeISO: string): Pendencia[] {
  const lista: Pendencia[] = [];
  const doc = atendimento.documentacao;

  if (atendimento.etapa === "aguardando_autorizacao") {
    if (diasEntre(atendimento.abertura, hojeISO) > LIMITES.diasSemAutorizacao) lista.push("sem_autorizacao");
    if (atendimento.limiteVistoria) {
      const faltam = diasEntre(hojeISO, atendimento.limiteVistoria);
      if (faltam <= LIMITES.diasAvisoVistoria) lista.push("vistoria_vencendo");
    }
  }

  if (entregaAtrasada(atendimento, hojeISO)) lista.push("entrega_atrasada");

  const ultimaRecusa = doc.recusas.at(-1);
  if (ultimaRecusa && (!doc.enviadaEm || doc.enviadaEm < ultimaRecusa.data) && atendimento.etapa !== "pago") {
    lista.push("documentacao_recusada");
  }

  if (
    atendimento.etapa === "documentacao_enviada" &&
    doc.enviadaEm &&
    !doc.pagoEm &&
    diasEntre(doc.enviadaEm, hojeISO) > LIMITES.diasPagamentoMaxpar
  ) {
    lista.push("pagamento_atrasado");
  }

  return lista;
}

/** Total que a oficina deve receber pelo carro: Maxpar + franquia do cliente + complemento particular. */
export function receitaPrevista(atendimento: Atendimento): number {
  const { aReceberMaxpar = 0 } = atendimento.financeiro;
  const franquia = atendimento.franquia.valor ?? 0;
  const complemento = atendimento.complemento ?? 0;
  return aReceberMaxpar + franquia + complemento;
}

export function custoTotal(atendimento: Atendimento): number {
  const { custoMaterial = 0, comissao = 0 } = atendimento.financeiro;
  return custoMaterial + comissao;
}

export function margem(atendimento: Atendimento): number {
  return receitaPrevista(atendimento) - custoTotal(atendimento);
}

/** O que a Maxpar/seguradora ainda deve pela mão de obra autorizada (qualquer etapa, até cair o pagamento). */
export function aReceberEmAberto(atendimento: Atendimento): number {
  if (atendimento.origem === "particular") return 0;
  if (atendimento.etapa === "pago" || atendimento.documentacao.pagoEm) return 0;
  return atendimento.financeiro.aReceberMaxpar ?? 0;
}

/** Placa Mercosul (ABC1D23) ou antiga (ABC1234), sem hífen, maiúscula. */
export function normalizarPlaca(valor: string): string {
  return valor.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
}

export function placaValida(valor: string): boolean {
  return /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(normalizarPlaca(valor));
}

export function formatarPlaca(valor: string): string {
  const p = normalizarPlaca(valor);
  return p.length === 7 ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
}

export function formatarReais(valor: number | undefined): string {
  if (valor === undefined || Number.isNaN(valor)) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Nome da seguradora de uma OS (revisão SG): uma regra só para Relatórios, Financeiro, Geral e Agenda.
// A Maxpar é o portal por onde o atendimento chega, nunca "a seguradora" — o nome mostrado é HDI, Liberty…
import type { OSVisao } from "../dados/repositorio";

const MAXPAR = /maxpar/i;

/** O nome conta como seguradora? (vazio ou "Maxpar…" não conta) */
export const ehNomeDeSeguradora = (nome: string | undefined): nome is string => !!nome?.trim() && !MAXPAR.test(nome);

/** Primeira seguradora de verdade dos atendimentos da OS (sem a Maxpar); nenhuma, undefined. */
export function nomeSeguradora(v: Pick<OSVisao, "atendimentos">): string | undefined {
  return v.atendimentos.map((a) => a.seguradora?.trim()).find(ehNomeDeSeguradora);
}

/** Quem paga o serviço da OS, pelo nome que a oficina usa: a seguradora (HDI, Liberty…), nunca a Maxpar; sem seguro, "Particular". */
export function seguradoraDaOS(v: Pick<OSVisao, "os" | "atendimentos">): string {
  const nome = nomeSeguradora(v);
  if (nome) return nome;
  return v.os.origem === "particular" ? "Particular" : "Seguradora não informada";
}

// Monta as entradas mínimas do domínio de relatórios (OSRelatorio) a partir da visão da OS.
// Só agrega o que o repositório já entrega; as contas ficam em @compartilhado/dominio/relatorios.
import type { Centavos } from "@compartilhado/tipos";
import type { OSRelatorio } from "@compartilhado/dominio/relatorios";
import { valorAprovado } from "@compartilhado/dominio/financeiro";
import { somaCentavos } from "@compartilhado/dominio/dinheiro";
import type { OSVisao } from "../../dados/repositorio";

/**
 * Receita da OS: soma dos títulos não cancelados (o que foi faturado); sem título, o valor aprovado
 * da versão aprovada mais recente; sem aprovação, 0. Custo: soma dos lançamentos; sem lançamento, ausente.
 */
export function receitaDaOS(v: OSVisao): Centavos {
  const titulos = v.titulos.filter((t) => t.estado !== "cancelado");
  if (titulos.length) return somaCentavos(titulos.map((t) => t.valor));
  const aprovada = v.versoes.find((x) => x.estado === "aprovado");
  return aprovada ? valorAprovado(aprovada) : 0;
}

export function paraRelatorio(v: OSVisao): OSRelatorio {
  return {
    id: v.os.id,
    clienteId: v.cliente.id,
    estado: v.os.estado,
    criadoEm: v.os.criadoEm,
    entregueEm: v.os.entregueEm,
    receita: receitaDaOS(v),
    custo: v.custos.length ? somaCentavos(v.custos.map((c) => c.total)) : undefined,
  };
}

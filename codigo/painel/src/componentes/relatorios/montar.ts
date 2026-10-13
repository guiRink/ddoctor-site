// Monta as entradas mínimas do domínio de relatórios (OSRelatorio) a partir da visão da OS.
// Só agrega o que o repositório já entrega; as contas ficam em @compartilhado/dominio/relatorios.
import type { Centavos } from "@compartilhado/tipos";
import type { OSRelatorio } from "@compartilhado/dominio/relatorios";
import { receitaOS } from "@compartilhado/dominio/custos";
import { somaCentavos } from "@compartilhado/dominio/dinheiro";
import type { OSVisao } from "../../dados/repositorio";

/**
 * Receita da OS: a mesma da Ficha e do Resultado — receitaOS (versão vigente aprovada: autorizado +
 * complemento; sem aprovação, 0). Custo: soma dos lançamentos; sem lançamento, ausente.
 */
export function receitaDaOS(v: OSVisao): Centavos {
  return receitaOS({ versoes: v.versoes, titulos: v.titulos }).valor;
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

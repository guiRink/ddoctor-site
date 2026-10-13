// Custos lançados na OS (insumos, mão de obra, terceiros, outros) e o resultado da OS.
// Dinheiro em centavos inteiros; cada lançamento arredonda ao centavo uma única vez.
import type { Centavos, CustoOS } from "../tipos";
import { arredondarCentavos, somaCentavos } from "./dinheiro";

export type ModoMaoDeObra = "hora" | "minuto" | "fixo";

/**
 * Custo de mão de obra: "hora" = minutos/60 × valor da hora; "minuto" = minutos × valor do minuto;
 * "fixo" = valor (minutos ignorados). Minutos ou valor negativos/não finitos lançam erro.
 */
export function custoMaoDeObra(entrada: { modo: ModoMaoDeObra; minutos: number; valorUnitario: Centavos }): Centavos {
  const { modo, minutos, valorUnitario } = entrada;
  if (!Number.isFinite(valorUnitario) || valorUnitario < 0) throw new Error(`valor_invalido: ${valorUnitario}`);
  if (modo === "fixo") return Math.round(valorUnitario);
  if (!Number.isFinite(minutos) || minutos < 0) throw new Error(`minutos_invalidos: ${minutos}`);
  return arredondarCentavos(modo === "hora" ? (minutos * valorUnitario) / 60 : minutos * valorUnitario);
}

/** Total de um lançamento: quantidade × custo unitário, arredondado ao centavo. */
export function totalCusto(quantidade: number, custoUnitario: Centavos): Centavos {
  return arredondarCentavos(quantidade * custoUnitario);
}

export interface ResultadoOS {
  receita: Centavos; // valor dos serviços − desconto (nunca negativo)
  custoInsumos: Centavos;
  custoMaoDeObra: Centavos;
  custoTerceiros: Centavos;
  custoOutros: Centavos;
  custoTotal: Centavos;
  margem: Centavos;
  /** Fração da receita (0,35 = 35 %); null quando a receita é 0. */
  margemPct: number | null;
}

/** Resultado da OS: receita líquida do desconto menos a soma dos custos lançados (campo `total`). */
export function resultadoOS(valorServicos: Centavos, desconto: Centavos, custos: readonly CustoOS[]): ResultadoOS {
  const receita = Math.max(0, valorServicos - Math.max(0, desconto));
  const soma = (tipo: CustoOS["tipo"]) => somaCentavos(custos.filter((c) => c.tipo === tipo).map((c) => c.total));
  const custoInsumos = soma("insumo");
  const custoMaoDeObraTotal = soma("mao_de_obra");
  const custoTerceiros = soma("terceiro");
  const custoOutros = soma("outro");
  const custoTotal = custoInsumos + custoMaoDeObraTotal + custoTerceiros + custoOutros;
  const margem = receita - custoTotal;
  return {
    receita,
    custoInsumos,
    custoMaoDeObra: custoMaoDeObraTotal,
    custoTerceiros,
    custoOutros,
    custoTotal,
    margem,
    margemPct: receita > 0 ? margem / receita : null,
  };
}

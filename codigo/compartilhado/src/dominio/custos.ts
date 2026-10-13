// Custos lançados na OS (insumos, mão de obra, terceiros, outros) e o resultado da OS.
// Dinheiro em centavos inteiros; cada lançamento arredonda ao centavo uma única vez.
import type { Centavos, CustoOS, Id, OrcamentoVersao, TituloReceber } from "../tipos";
import { arredondarCentavos, somaCentavos } from "./dinheiro";
import { valorAprovado } from "./financeiro";
import { falha, type Resultado } from "./resultado";

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

/**
 * Lançamento de mão de obra válido: valor unitário inteiro > 0; em "hora"/"minuto", minutos > 0;
 * total > 0 (mão de obra de R$ 0,00 não é custo). Devolve o total calculado por custoMaoDeObra.
 */
export function validarMaoDeObra(entrada: {
  modo: ModoMaoDeObra;
  minutos: number;
  valorUnitario: Centavos;
}): Resultado<"valor_invalido" | "minutos_invalidos", { total: Centavos }> {
  const { modo, minutos, valorUnitario } = entrada;
  if (!Number.isInteger(valorUnitario) || valorUnitario <= 0) return falha("valor_invalido");
  if (modo !== "fixo" && (!Number.isFinite(minutos) || minutos <= 0)) return falha("minutos_invalidos");
  const total = custoMaoDeObra(entrada);
  if (total <= 0) return falha("valor_invalido");
  return { ok: true, total };
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

export interface ReceitaOS {
  /** Receita da OS = autorizado + complemento. 0 enquanto não há versão aprovada. */
  valor: Centavos;
  /** Há versão aprovada? Sem ela a receita é 0 e a UI mostra "sem aprovação". */
  aprovada: boolean;
  /** valorAprovado(versão vigente aprovada): itens autorizados (externo) ou não negados/dispensados (interno). Inclui a franquia. */
  autorizado: Centavos;
  /** Complemento particular da versão externa (o cliente paga à parte). Em orçamento interno é 0 (já está nos itens). */
  complemento: Centavos;
  /** Σ títulos não cancelados: só para conferência ("faturado"); NUNCA entra em `valor` (títulos podem ser parciais). */
  faturado: Centavos;
  versaoId?: Id;
}

/**
 * Receita única da OS (Ficha, Resultado, Relatórios): versão vigente aprovada — a de maior numeroVersao
 * com estado "aprovado" — valor autorizado + complemento particular. Não soma títulos: um título
 * parcial (ex.: "Particular/franquia" criado no primeiro pagamento) subestimaria a receita.
 */
export function receitaOS(entrada: { versoes: readonly OrcamentoVersao[]; titulos: readonly TituloReceber[] }): ReceitaOS {
  const faturado = somaCentavos(entrada.titulos.filter((t) => t.estado !== "cancelado").map((t) => t.valor));
  const vigente = entrada.versoes.filter((v) => v.estado === "aprovado").sort((a, b) => b.numeroVersao - a.numeroVersao)[0];
  if (!vigente) return { valor: 0, aprovada: false, autorizado: 0, complemento: 0, faturado };
  const autorizado = valorAprovado(vigente);
  const complemento = vigente.tipo === "externo" ? Math.max(0, vigente.complementoParticular ?? 0) : 0;
  return { valor: autorizado + complemento, aprovada: true, autorizado, complemento, faturado, versaoId: vigente.id };
}

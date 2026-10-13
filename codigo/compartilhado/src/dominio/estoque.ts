// Situação do material no estoque. Prioridade: zerado > baixo > conferir > ok.
import type { Centavos, DataISO, Id, MarcoISO, Material, MovimentoEstoque, TipoMovimentoEstoque } from "../tipos";
import { arredondarCentavos } from "./dinheiro";
import { DIAS_CONFERENCIA_ESTOQUE_PADRAO, DIAS_ESTOQUE_PARADO_PADRAO } from "./config";
import { dataNoFuso, diferencaDias } from "./fuso";
import { falha, type Resultado } from "./resultado";

export type StatusEstoque = "ok" | "baixo" | "zerado" | "conferir";

/**
 * zerado: saldo ≤ 0; baixo: saldo < mínimo; conferir: nunca conferido ou última conferência
 * há mais de `diasConferencia` dias (padrão 90, provisório). `hoje` entra por parâmetro.
 */
export function statusEstoque(
  material: Material,
  hoje: DataISO,
  diasConferencia: number = DIAS_CONFERENCIA_ESTOQUE_PADRAO,
): StatusEstoque {
  if (material.saldoEstimado <= 0) return "zerado";
  if (material.saldoEstimado < material.saldoMinimo) return "baixo";
  if (!material.ultimaConferenciaEm || diferencaDias(material.ultimaConferenciaEm.slice(0, 10), hoje) > diasConferencia)
    return "conferir";
  return "ok";
}

// ---------------------------------------------------------------- movimentações

/** Tipos que tiram material do estoque (retirada para OS e consumo interno). */
export const TIPOS_SAIDA: ReadonlySet<TipoMovimentoEstoque> = new Set(["saida_os", "consumo_interno"]);

/** Sinal do movimento no saldo: +1 entrada, −1 saída; ajuste conforme `sentido` (null se faltar). */
export function sinalMovimento(mov: Pick<MovimentoEstoque, "tipo" | "sentido">): 1 | -1 | null {
  if (mov.tipo === "entrada_compra") return 1;
  if (TIPOS_SAIDA.has(mov.tipo)) return -1;
  if (mov.sentido === "mais") return 1;
  if (mov.sentido === "menos") return -1;
  return null;
}

/**
 * Custo médio ponderado depois de uma entrada, arredondado ao centavo:
 * (saldo × custo médio + qtd × custo da entrada) / (saldo + qtd). Saldo ≤ 0 não pesa (vale o custo da entrada).
 */
export function custoMedioPonderado(
  saldoAtual: number,
  custoMedioAtual: Centavos,
  qtdEntrada: number,
  custoEntrada: Centavos,
): Centavos {
  const saldo = Math.max(0, saldoAtual);
  const total = saldo + qtdEntrada;
  if (total <= 0) return Math.round(custoEntrada);
  return arredondarCentavos((saldo * custoMedioAtual + qtdEntrada * custoEntrada) / total);
}

export type CodigoMovimento =
  | "quantidade_invalida"
  | "custo_obrigatorio"
  | "sentido_obrigatorio"
  | "motivo_obrigatorio"
  | "material_divergente"
  | "material_inativo"
  | "saldo_insuficiente";

/** Arredonda a 3 casas para não acumular erro de ponto flutuante em kg/L. */
const qtd = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Aplica o movimento ao material e devolve o material com saldo e custo médio novos.
 * - entrada_compra: exige custoUnitario inteiro ≥ 0; recalcula o custo médio ponderado.
 * - saida_os / consumo_interno: recusa quantidade maior que o saldo (`saldo_insuficiente`); custo médio não muda.
 * - ajuste: exige `sentido` e motivo em `obs`; ajuste "menos" também não passa do saldo; custo médio não muda.
 * Material inativo não recebe saída (entrada e ajuste continuam permitidos).
 */
export function aplicarMovimento(material: Material, mov: MovimentoEstoque): Resultado<CodigoMovimento, { material: Material }> {
  if (mov.materialId !== material.id) return falha("material_divergente");
  if (!Number.isFinite(mov.quantidade) || mov.quantidade <= 0) return falha("quantidade_invalida");
  const sinal = sinalMovimento(mov);
  if (mov.tipo === "ajuste") {
    if (sinal === null) return falha("sentido_obrigatorio");
    if (!mov.obs?.trim()) return falha("motivo_obrigatorio");
  }
  if (mov.tipo === "entrada_compra") {
    const c = mov.custoUnitario;
    if (c === undefined || !Number.isInteger(c) || c < 0) return falha("custo_obrigatorio");
    return {
      ok: true,
      material: {
        ...material,
        saldoEstimado: qtd(material.saldoEstimado + mov.quantidade),
        custoMedio: custoMedioPonderado(material.saldoEstimado, material.custoMedio, mov.quantidade, c),
      },
    };
  }
  if (sinal === -1) {
    if (TIPOS_SAIDA.has(mov.tipo) && material.ativo === false) return falha("material_inativo");
    if (qtd(mov.quantidade) > qtd(material.saldoEstimado)) return falha("saldo_insuficiente");
  }
  return { ok: true, material: { ...material, saldoEstimado: qtd(material.saldoEstimado + sinal! * mov.quantidade) } };
}

export type SituacaoMaterial = "sem_estoque" | "critico" | "normal";

/** sem_estoque: saldo ≤ 0; critico: abaixo do mínimo (igual ao mínimo é normal); normal: o resto. */
export function situacaoMaterial(material: Pick<Material, "saldoEstimado" | "saldoMinimo">): SituacaoMaterial {
  if (material.saldoEstimado <= 0) return "sem_estoque";
  if (material.saldoEstimado < material.saldoMinimo) return "critico";
  return "normal";
}

const dataDoMov = (m: Pick<MovimentoEstoque, "em">): DataISO => dataNoFuso(m.em);

/**
 * Dias desde a última saída do material (no fuso da oficina). Sem saída registrada, conta desde o
 * movimento mais antigo do material; sem movimento algum, desde a última conferência; senão null.
 */
export function diasSemSaida(material: Material, movimentos: readonly MovimentoEstoque[], agora: MarcoISO): number | null {
  const meus = movimentos.filter((m) => m.materialId === material.id);
  const saidas = meus.filter((m) => TIPOS_SAIDA.has(m.tipo)).map(dataDoMov).sort();
  let ref: DataISO | undefined = saidas.at(-1);
  if (!ref) ref = meus.map(dataDoMov).sort()[0];
  if (!ref) ref = material.ultimaConferenciaEm?.slice(0, 10);
  return ref ? diferencaDias(ref, dataNoFuso(agora)) : null;
}

/**
 * Estoque parado: material ativo com saldo > 0 e sem saída há `dias` dias ou mais (padrão 90, provisório).
 * Sem nenhuma referência de data, não é marcado como parado.
 */
export function estoqueParado(
  material: Material,
  movimentos: readonly MovimentoEstoque[],
  agora: MarcoISO,
  dias: number = DIAS_ESTOQUE_PARADO_PADRAO,
): boolean {
  if (material.ativo === false || material.saldoEstimado <= 0) return false;
  const d = diasSemSaida(material, movimentos, agora);
  return d !== null && d >= dias;
}

/** Custo de uma saída: custo unitário gravado no movimento ou, na falta, o custo médio do material. */
export function custoDoMovimento(mov: MovimentoEstoque, material?: Pick<Material, "custoMedio">): Centavos {
  return arredondarCentavos(mov.quantidade * (mov.custoUnitario ?? material?.custoMedio ?? 0));
}

export interface ConsumoFuncionario {
  perfilId: Id | null; // null = retirada sem funcionário informado
  custo: Centavos;
  itens: Array<{ materialId: Id; nome: string; unidade: string; quantidade: number; custo: Centavos }>;
}

/** Saídas (para OS e consumo interno) agrupadas por funcionário e material, do maior custo para o menor. */
export function consumoPorFuncionario(
  movimentos: readonly MovimentoEstoque[],
  materiais: readonly Material[],
): ConsumoFuncionario[] {
  const porId = new Map(materiais.map((m) => [m.id, m]));
  const grupos = new Map<Id | null, Map<Id, ConsumoFuncionario["itens"][number]>>();
  for (const mov of movimentos) {
    if (!TIPOS_SAIDA.has(mov.tipo)) continue;
    const mat = porId.get(mov.materialId);
    const chave = mov.perfilId ?? null;
    const itens = grupos.get(chave) ?? new Map();
    const item = itens.get(mov.materialId) ?? {
      materialId: mov.materialId,
      nome: mat?.nome ?? mov.materialId,
      unidade: mat?.unidade ?? "",
      quantidade: 0,
      custo: 0,
    };
    item.quantidade = qtd(item.quantidade + mov.quantidade);
    item.custo += custoDoMovimento(mov, mat);
    itens.set(mov.materialId, item);
    grupos.set(chave, itens);
  }
  return [...grupos]
    .map(([perfilId, itens]) => {
      const lista = [...itens.values()].sort((a, b) => b.custo - a.custo || a.nome.localeCompare(b.nome, "pt-BR"));
      return { perfilId, custo: lista.reduce((s, i) => s + i.custo, 0), itens: lista };
    })
    .sort((a, b) => b.custo - a.custo);
}

export interface ItemReposicao {
  material: Material;
  situacao: Exclude<SituacaoMaterial, "normal">;
  /** Quanto falta para voltar ao mínimo (saldo negativo conta como 0). */
  faltam: number;
  custoEstimado: Centavos; // faltam × custo médio
}

/** Materiais ativos abaixo do mínimo: sem estoque primeiro, depois críticos; dentro de cada grupo, por nome. */
export function listaReposicao(materiais: readonly Material[]): ItemReposicao[] {
  const ordem = { sem_estoque: 0, critico: 1 } as const;
  return materiais
    .filter((m) => m.ativo !== false)
    .map((m) => ({ m, s: situacaoMaterial(m) }))
    .filter((x): x is { m: Material; s: ItemReposicao["situacao"] } => x.s !== "normal" && x.m.saldoMinimo > 0)
    .map(({ m, s }) => {
      const faltam = qtd(m.saldoMinimo - Math.max(0, m.saldoEstimado));
      return { material: m, situacao: s, faltam, custoEstimado: arredondarCentavos(faltam * m.custoMedio) };
    })
    .sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || a.material.nome.localeCompare(b.material.nome, "pt-BR"));
}

import type { EstadoOS, Id, ModeloEtapaItem, TipoReparo } from "../tipos";
import { falha, type Resultado } from "./resultado";

/**
 * Etapas comuns para montar um tipo de reparo (categoria de serviço) sem digitar tudo. Nomes e prazos
 * vêm dos tipos provisórios do demo (questionário 1.1, L09): são sugestão, o dono ajusta ao salvar.
 */
export const ETAPAS_SUGERIDAS: readonly Omit<ModeloEtapaItem, "ordem">[] = [
  { nome: "Desmontagem", prazoPadraoHoras: 2, dispensavel: true, exigeFoto: false, exigeContagemPecas: false },
  { nome: "Funilaria", prazoPadraoHoras: 4, dispensavel: true, exigeFoto: true, exigeContagemPecas: true },
  { nome: "Martelinho", prazoPadraoHoras: 4, dispensavel: false, exigeFoto: true, exigeContagemPecas: true },
  { nome: "Preparação", prazoPadraoHoras: 4, dispensavel: false, exigeFoto: false, exigeContagemPecas: false },
  { nome: "Pintura", prazoPadraoHoras: 8, dispensavel: false, exigeFoto: true, exigeContagemPecas: true },
  { nome: "Pintura localizada", prazoPadraoHoras: 4, dispensavel: false, exigeFoto: true, exigeContagemPecas: true },
  { nome: "Polimento", prazoPadraoHoras: 2, dispensavel: false, exigeFoto: false, exigeContagemPecas: false },
  { nome: "Montagem", prazoPadraoHoras: 2, dispensavel: false, exigeFoto: true, exigeContagemPecas: false },
  { nome: "Montagem e revisão", prazoPadraoHoras: 2, dispensavel: false, exigeFoto: true, exigeContagemPecas: false },
  { nome: "Higienização", prazoPadraoHoras: 3, dispensavel: true, exigeFoto: true, exigeContagemPecas: false },
  { nome: "Lavagem", prazoPadraoHoras: 1, dispensavel: true, exigeFoto: false, exigeContagemPecas: false },
];

/** Limites sensatos de um tipo de reparo. */
export const LIMITES_TIPO_REPARO = { maxEtapas: 20, maxPrazoHoras: 200, maxNome: 60 } as const;

export interface TipoReparoEntrada {
  id?: Id;
  nome: string;
  etapas: ModeloEtapaItem[];
}

export type CodigoTipoReparo = "nome_obrigatorio" | "nome_duplicado" | "sem_etapas" | "etapa_invalida" | "ordem_invalida" | "prazo_invalido";

/** Chave de comparação de nomes: sem acento, sem caixa, espaços colapsados. */
export const chaveNome = (t: string): string => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Valida e normaliza um tipo de reparo: nome obrigatório e único na oficina (sem acento/caixa; o próprio id
 * não conta), 1 a 20 etapas com nome, ordens exatamente 1..n (sem buraco nem repetição) e prazo > 0 h
 * (até 200 h). Devolve as etapas ordenadas, com nomes aparados e flags booleanas.
 */
export function validarTipoReparo(
  entrada: TipoReparoEntrada,
  existentes: readonly Pick<TipoReparo, "id" | "nome">[],
): Resultado<CodigoTipoReparo, { nome: string; etapas: ModeloEtapaItem[] }> {
  const nome = entrada.nome?.replace(/\s+/g, " ").trim() ?? "";
  if (!nome || nome.length > LIMITES_TIPO_REPARO.maxNome) return falha("nome_obrigatorio");
  if (existentes.some((t) => t.id !== entrada.id && chaveNome(t.nome) === chaveNome(nome))) return falha("nome_duplicado");
  const etapas = entrada.etapas ?? [];
  if (etapas.length === 0) return falha("sem_etapas");
  if (etapas.length > LIMITES_TIPO_REPARO.maxEtapas) return falha("etapa_invalida");
  const ordenadas = [...etapas].sort((a, b) => a.ordem - b.ordem);
  const limpas: ModeloEtapaItem[] = [];
  for (let i = 0; i < ordenadas.length; i++) {
    const e = ordenadas[i];
    if (e.ordem !== i + 1) return falha("ordem_invalida");
    const n = e.nome?.replace(/\s+/g, " ").trim();
    if (!n || n.length > LIMITES_TIPO_REPARO.maxNome) return falha("etapa_invalida");
    if (typeof e.prazoPadraoHoras !== "number" || !Number.isFinite(e.prazoPadraoHoras) || e.prazoPadraoHoras <= 0 || e.prazoPadraoHoras > LIMITES_TIPO_REPARO.maxPrazoHoras)
      return falha("prazo_invalido");
    limpas.push({
      ordem: i + 1,
      nome: n,
      prazoPadraoHoras: e.prazoPadraoHoras,
      dispensavel: Boolean(e.dispensavel),
      exigeFoto: Boolean(e.exigeFoto),
      exigeContagemPecas: Boolean(e.exigeContagemPecas),
    });
  }
  return { ok: true, nome, etapas: limpas };
}

/** OS que já saíram do fluxo: não seguram a categoria (dá para arquivar). */
const FORA_DO_FLUXO: ReadonlySet<EstadoOS> = new Set(["entregue", "encerrada", "cancelada"]);

/**
 * Quantas OS em aberto (não entregues, encerradas nem canceladas) usam a categoria. Com alguma, ela não pode
 * ser arquivada: o carro ainda vai passar pelas etapas dela.
 */
export function usoTipoReparo(tipoId: Id, oss: readonly { tipoReparoId?: Id; estado: EstadoOS }[]): number {
  return oss.filter((o) => o.tipoReparoId === tipoId && !FORA_DO_FLUXO.has(o.estado)).length;
}

/** Categoria disponível na escolha do serviço (as arquivadas ficam de fora). */
export const tipoReparoAtivo = (t: Pick<TipoReparo, "ativo">): boolean => t.ativo !== false;

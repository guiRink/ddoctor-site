// Comissões por serviço (sprint S1, pedido do dono: "pintura concluída = R$ 40"). Funções puras; dinheiro em centavos.
//
// Quem ganha: o `responsavelId` da etapa CONCLUÍDA no mês (mês do `concluidaEm` no fuso da oficina).
// Não paga: etapa dispensada, etapa sem responsável, etapa de OS cancelada (provisório — a confirmar com o dono).
// Qual regra: a ativa mais específica — tipo+etapa (3) > só etapa (2) > só tipo (1). Uma regra "só tipo" paga
// CADA etapa concluída das OS desse tipo (provisório: "por tipo de reparo inteiro" ainda não diz se paga uma vez
// por carro nem a quem; a confirmar com o dono). Valor 0 na mais específica anula a geral (linha não sai).
import type { Centavos, EtapaOS, Id, MarcoISO, OS, RegraComissao, Veiculo } from "../tipos";
import { mesDe, paraMs } from "./fuso";
import { chaveNome } from "./tiposReparo";

/** Teto de sanidade por etapa: R$ 100.000,00 (erro de digitação, não regra da oficina). */
export const VALOR_MAXIMO_COMISSAO: Centavos = 10_000_000;

/** O que comissoesDoPeriodo precisa de cada OS (a OSVisao do painel serve como está). */
export interface OSComissao {
  os: Pick<OS, "id" | "tipoReparoId" | "estado">;
  veiculo?: Pick<Veiculo, "placa">;
  etapas: readonly EtapaOS[];
}

export interface LinhaComissao {
  perfilId: Id;
  osId: Id;
  placa?: string;
  etapaId: Id;
  /** Nome da etapa como está na OS ("Pintura"). */
  etapa: string;
  concluidaEm: MarcoISO;
  valor: Centavos;
  regraId: Id;
}

export interface TotalComissaoPessoa {
  perfilId: Id;
  quantidade: number;
  total: Centavos;
}

export interface ComissoesDoPeriodo {
  /** Mais recente primeiro. */
  linhas: LinhaComissao[];
  /** Maior total primeiro (empate: perfilId). */
  porPessoa: TotalComissaoPessoa[];
  total: Centavos;
}

function especificidade(r: RegraComissao): number {
  const etapa = Boolean(r.etapaNome?.trim());
  const tipo = Boolean(r.tipoReparoId);
  return etapa && tipo ? 3 : etapa ? 2 : tipo ? 1 : 0;
}

/**
 * Regra que vale para uma etapa (nome comparado sem acento, caixa nem espaços extras) de uma OS do tipo dado.
 * Só ativas e com alvo; empate na mesma especificidade: a primeira da lista.
 */
export function regraDaEtapa(etapaNome: string, tipoReparoId: Id | undefined, regras: readonly RegraComissao[]): RegraComissao | undefined {
  const nome = chaveNome(etapaNome);
  let melhor: RegraComissao | undefined;
  let melhorNivel = 0;
  for (const r of regras) {
    if (!r.ativa) continue;
    const nivel = especificidade(r);
    if (nivel === 0) continue;
    if (r.etapaNome?.trim() && chaveNome(r.etapaNome) !== nome) continue;
    if (r.tipoReparoId && r.tipoReparoId !== tipoReparoId) continue;
    if (nivel > melhorNivel) {
      melhor = r;
      melhorNivel = nivel;
    }
  }
  return melhor;
}

/**
 * Comissões do mês "AAAA-MM": uma linha por etapa concluída que paga (> 0), com totais por pessoa.
 * `perfilId` filtra uma pessoa só.
 */
export function comissoesDoPeriodo(
  oss: readonly OSComissao[],
  regras: readonly RegraComissao[] | undefined,
  mes: string,
  perfilId?: Id,
): ComissoesDoPeriodo {
  if (!/^\d{4}-\d{2}$/.test(mes)) throw new Error(`mes_invalido: ${mes}`);
  const linhas: LinhaComissao[] = [];
  const ativas = (regras ?? []).filter((r) => r.ativa);
  if (ativas.length) {
    for (const v of oss) {
      if (v.os.estado === "cancelada") continue;
      for (const e of v.etapas) {
        if (e.estado !== "concluida" || !e.concluidaEm || !e.responsavelId) continue;
        if (perfilId && e.responsavelId !== perfilId) continue;
        if (mesDe(e.concluidaEm) !== mes) continue;
        const regra = regraDaEtapa(e.nome, v.os.tipoReparoId, ativas);
        if (!regra || !(regra.valor > 0)) continue;
        linhas.push({
          perfilId: e.responsavelId,
          osId: v.os.id,
          ...(v.veiculo?.placa ? { placa: v.veiculo.placa } : {}),
          etapaId: e.id,
          etapa: e.nome,
          concluidaEm: e.concluidaEm,
          valor: Math.round(regra.valor),
          regraId: regra.id,
        });
      }
    }
  }
  linhas.sort((a, b) => paraMs(b.concluidaEm) - paraMs(a.concluidaEm));
  const mapa = new Map<Id, TotalComissaoPessoa>();
  for (const l of linhas) {
    const g = mapa.get(l.perfilId) ?? { perfilId: l.perfilId, quantidade: 0, total: 0 };
    g.quantidade++;
    g.total += l.valor;
    mapa.set(l.perfilId, g);
  }
  const porPessoa = [...mapa.values()].sort((a, b) => b.total - a.total || a.perfilId.localeCompare(b.perfilId));
  return { linhas, porPessoa, total: linhas.reduce((s, l) => s + l.valor, 0) };
}

export interface RegraComissaoEntrada {
  id?: Id;
  etapaNome?: string;
  tipoReparoId?: Id;
  valor: Centavos;
  ativa?: boolean;
  descricao?: string;
}

export type CodigoRegraComissao = "alvo_obrigatorio" | "valor_invalido" | "regra_duplicada";

/**
 * Valida uma regra em Ajustes → Comissões: precisa de etapa e/ou tipo (alvo_obrigatorio); valor inteiro em
 * centavos de 0 a VALOR_MAXIMO_COMISSAO (valor_invalido); não pode haver outra ATIVA com o mesmo alvo
 * (regra_duplicada; a própria, pelo id, não conta). Devolve a regra aparada (sem id se for nova).
 */
export function validarRegraComissao(
  entrada: RegraComissaoEntrada,
  existentes: readonly RegraComissao[] = [],
): { ok: true; regra: Omit<RegraComissao, "id"> & { id?: Id } } | { ok: false; codigo: CodigoRegraComissao; campo: string } {
  const etapaNome = entrada.etapaNome?.replace(/\s+/g, " ").trim() || undefined;
  const tipoReparoId = entrada.tipoReparoId || undefined;
  if (!etapaNome && !tipoReparoId) return { ok: false, codigo: "alvo_obrigatorio", campo: "etapaNome" };
  const v = entrada.valor;
  if (!Number.isInteger(v) || v < 0 || v > VALOR_MAXIMO_COMISSAO) return { ok: false, codigo: "valor_invalido", campo: "valor" };
  const ativa = entrada.ativa ?? true;
  if (ativa) {
    const chave = etapaNome ? chaveNome(etapaNome) : "";
    const dup = existentes.some(
      (r) =>
        r.ativa &&
        r.id !== entrada.id &&
        (r.tipoReparoId || undefined) === tipoReparoId &&
        (r.etapaNome?.trim() ? chaveNome(r.etapaNome) : "") === chave,
    );
    if (dup) return { ok: false, codigo: "regra_duplicada", campo: etapaNome ? "etapaNome" : "tipoReparoId" };
  }
  const descricao = entrada.descricao?.trim();
  return {
    ok: true,
    regra: {
      ...(entrada.id ? { id: entrada.id } : {}),
      ...(etapaNome ? { etapaNome } : {}),
      ...(tipoReparoId ? { tipoReparoId } : {}),
      valor: v,
      ativa,
      ...(descricao ? { descricao } : {}),
    },
  };
}

// Montagem das linhas da tela de Estoque sobre as regras de @compartilhado/dominio/estoque (sem regra nova).
import type { DataISO, Fornecedor, MarcoISO, Material, MovimentoEstoque, Perfil } from "@compartilhado/tipos";
import { custoDoMovimento, diasSemSaida, estoqueParado, sinalMovimento, situacaoMaterial, type SituacaoMaterial } from "@compartilhado/dominio/estoque";
import { dataNoFuso } from "@compartilhado/dominio/fuso";
import { TIPO_MOVIMENTO_ESTOQUE } from "../../dominio/rotulos";
import type { Tom } from "../ui/Estado";
import { horaDoMarco } from "../financeiro/formato";
import { centavosCsv, gerarCsv, numeroCsv } from "./csv";

export interface LinhaMaterial {
  m: Material;
  ativo: boolean;
  situacao: SituacaoMaterial;
  parado: boolean;
  diasSemSaida: number | null;
}

export type FiltroSituacao = "todos" | "critico" | "sem_estoque" | "parado" | "inativos";

export const SITUACAO: Record<SituacaoMaterial, { texto: string; tom: Tom }> = {
  sem_estoque: { texto: "Sem estoque", tom: "alerta" },
  critico: { texto: "Abaixo do mínimo", tom: "atencao" },
  normal: { texto: "Normal", tom: "neutro" },
};

export const TOM_MOVIMENTO: Record<MovimentoEstoque["tipo"], Tom> = {
  entrada_compra: "ok",
  saida_os: "escuro",
  consumo_interno: "neutro",
  ajuste: "atencao",
};

const ORDEM: Record<SituacaoMaterial, number> = { sem_estoque: 0, critico: 1, normal: 2 };

/** Linhas com situação e "parado"; ordem: sem estoque, abaixo do mínimo, normal; inativos no fim; por nome. */
export function linhasMateriais(materiais: readonly Material[], movimentos: readonly MovimentoEstoque[], agora: MarcoISO): LinhaMaterial[] {
  return materiais
    .map((m) => ({
      m,
      ativo: m.ativo !== false,
      situacao: situacaoMaterial(m),
      parado: estoqueParado(m, movimentos, agora),
      diasSemSaida: diasSemSaida(m, movimentos, agora),
    }))
    .sort(
      (a, b) =>
        Number(b.ativo) - Number(a.ativo) || ORDEM[a.situacao] - ORDEM[b.situacao] || a.m.nome.localeCompare(b.m.nome, "pt-BR"),
    );
}

const semAcento = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Busca por nome, código, marca ou categoria (sem acento, sem caixa). */
export function combinaMaterial(m: Material, termo: string): boolean {
  const t = semAcento(termo.trim());
  if (!t) return true;
  return [m.nome, m.codigo, m.marca, m.categoria].some((c) => c && semAcento(c).includes(t));
}

export function passaSituacao(l: LinhaMaterial, f: FiltroSituacao): boolean {
  if (f === "inativos") return !l.ativo;
  if (!l.ativo) return false;
  if (f === "todos") return true;
  if (f === "parado") return l.parado;
  return l.situacao === f;
}

/** Último custo de compra por material (entrada mais recente). */
export function ultimoCustoCompra(movimentos: readonly MovimentoEstoque[]): Map<string, { custo: number; em: MarcoISO }> {
  const mapa = new Map<string, { custo: number; em: MarcoISO }>();
  for (const mov of movimentos) {
    if (mov.tipo !== "entrada_compra" || mov.custoUnitario === undefined) continue;
    const atual = mapa.get(mov.materialId);
    if (!atual || mov.em > atual.em) mapa.set(mov.materialId, { custo: mov.custoUnitario, em: mov.em });
  }
  return mapa;
}

/** Quantidade com sinal do movimento (ajuste sem sentido conta como 0). */
export const quantidadeComSinal = (mov: MovimentoEstoque) => (sinalMovimento(mov) ?? 0) * mov.quantidade;

/** Movimentos do período [desde, hoje] por data no fuso; `desde` ausente = tudo. */
export function movimentosNoPeriodo(movimentos: readonly MovimentoEstoque[], desde: DataISO | null): MovimentoEstoque[] {
  if (!desde) return [...movimentos];
  return movimentos.filter((m) => dataNoFuso(m.em) >= desde);
}

// ---------------------------------------------------------------- CSV

export function csvMateriais(linhas: readonly LinhaMaterial[], fornecedores: readonly Fornecedor[], veDinheiro: boolean): string {
  const forn = new Map(fornecedores.map((f) => [f.id, f.nome]));
  const cab = ["Material", "Código", "Marca", "Categoria", "Unidade", "Saldo", "Mínimo", ...(veDinheiro ? ["Custo médio (R$)", "Valor em estoque (R$)"] : []), "Situação", "Parado", "Fornecedor", "Ativo"];
  return gerarCsv(
    cab,
    linhas.map(({ m, situacao, parado, ativo }) => [
      m.nome,
      m.codigo,
      m.marca,
      m.categoria,
      m.unidade,
      numeroCsv(m.saldoEstimado),
      numeroCsv(m.saldoMinimo),
      ...(veDinheiro ? [centavosCsv(m.custoMedio), centavosCsv(Math.round(Math.max(0, m.saldoEstimado) * m.custoMedio))] : []),
      SITUACAO[situacao].texto,
      parado ? "sim" : "não",
      m.fornecedorId ? forn.get(m.fornecedorId) : "",
      ativo ? "sim" : "não",
    ]),
  );
}

export function csvMovimentos(
  movimentos: readonly MovimentoEstoque[],
  materiais: readonly Material[],
  perfis: readonly Perfil[],
  numeroOS: (osId: string) => string | undefined,
  veDinheiro: boolean,
): string {
  const mat = new Map(materiais.map((m) => [m.id, m]));
  const pes = new Map(perfis.map((p) => [p.id, p.nome]));
  const cab = ["Data", "Hora", "Tipo", "Material", "Quantidade", "Unidade", ...(veDinheiro ? ["Custo unitário (R$)", "Custo total (R$)"] : []), "OS", "Funcionário", "Observação"];
  return gerarCsv(
    cab,
    movimentos.map((mov) => {
      const m = mat.get(mov.materialId);
      const hora = horaDoMarco(mov.em);
      return [
        dataNoFuso(mov.em),
        hora,
        TIPO_MOVIMENTO_ESTOQUE[mov.tipo],
        m?.nome ?? mov.materialId,
        numeroCsv(quantidadeComSinal(mov)),
        m?.unidade,
        ...(veDinheiro ? [centavosCsv(mov.custoUnitario ?? m?.custoMedio), centavosCsv(custoDoMovimento(mov, m))] : []),
        mov.osId ? numeroOS(mov.osId) : "",
        mov.perfilId ? pes.get(mov.perfilId) : "",
        mov.obs,
      ];
    }),
  );
}

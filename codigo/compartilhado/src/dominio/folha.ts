// Folha de pagamento do mês (sprint S1): salário fixo + comissões por serviço + ajustes. Funções puras, centavos.
//
// Quem entra: todo perfil ATIVO que não é "dispositivo" (TV), admitido até o fim do mês. Desligado (ativo=false)
// só aparece se tiver comissão, ajuste ou pagamento no mês — com salário 0 (provisório: proporcional/rescisão
// é acerto do dono pelo ajuste; a confirmar). Admitido no meio do mês recebe o salário inteiro (provisório).
// Já pago: a linha mostra os valores congelados do PagamentoFolha (o que foi pago não muda depois).
import type { Centavos, DataISO, Despesa, Id, Papel, PagamentoFolha, Perfil } from "../tipos";
import type { ComissoesDoPeriodo, LinhaComissao, TotalComissaoPessoa } from "./comissoes";
import { dataISOValida, mesDe } from "./fuso";

/** Categoria de despesa que o pagamento da folha gera (pedido do S1). */
export const CATEGORIA_SALARIOS = "Salários";

export interface LinhaFolha {
  perfilId: Id;
  nome: string;
  funcao?: string;
  papel: Papel;
  ativo: boolean;
  mes: string;
  salario: Centavos;
  comissoes: Centavos;
  quantidadeComissoes: number;
  ajustes: Centavos;
  total: Centavos; // salario + comissoes + ajustes
  pago: boolean;
  pagamento?: PagamentoFolha;
}

type EntradaComissoes = ComissoesDoPeriodo | readonly LinhaComissao[] | readonly TotalComissaoPessoa[];

function totaisPorPessoa(c: EntradaComissoes): Map<Id, { total: Centavos; quantidade: number }> {
  const mapa = new Map<Id, { total: Centavos; quantidade: number }>();
  const lista = Array.isArray(c) ? c : (c as ComissoesDoPeriodo).porPessoa;
  for (const item of lista as ReadonlyArray<LinhaComissao | TotalComissaoPessoa>) {
    const g = mapa.get(item.perfilId) ?? { total: 0, quantidade: 0 };
    if ("valor" in item) {
      g.total += item.valor;
      g.quantidade++;
    } else {
      g.total += item.total;
      g.quantidade += item.quantidade;
    }
    mapa.set(item.perfilId, g);
  }
  return mapa;
}

/**
 * Uma linha por funcionário do mês "AAAA-MM": salário (salarioMensal ?? 0) + comissões (de comissoesDoPeriodo) +
 * ajustes (por perfilId; senão o do pagamento salvo; senão 0) = total. Ordem: nome (pt-BR).
 */
export function calcularFolha(
  perfis: readonly Perfil[],
  comissoes: EntradaComissoes,
  mes: string,
  ajustes?: Readonly<Record<Id, Centavos>>,
  pagamentos: readonly PagamentoFolha[] = [],
): LinhaFolha[] {
  if (!/^\d{4}-\d{2}$/.test(mes)) throw new Error(`mes_invalido: ${mes}`);
  const porPessoa = totaisPorPessoa(comissoes);
  const linhas: LinhaFolha[] = [];
  for (const p of perfis) {
    if (p.papel === "dispositivo") continue;
    if (p.admitidoEm && mesDe(p.admitidoEm) > mes) continue;
    const pagamento = pagamentos.find((g) => g.perfilId === p.id && g.mes === mes);
    const base = { perfilId: p.id, nome: p.nome, ...(p.funcao ? { funcao: p.funcao } : {}), papel: p.papel, ativo: p.ativo, mes };
    if (pagamento?.pagoEm) {
      linhas.push({
        ...base,
        salario: pagamento.salario,
        comissoes: pagamento.comissoes,
        quantidadeComissoes: porPessoa.get(p.id)?.quantidade ?? 0,
        ajustes: pagamento.ajustes ?? 0,
        total: pagamento.total,
        pago: true,
        pagamento,
      });
      continue;
    }
    const c = porPessoa.get(p.id) ?? { total: 0, quantidade: 0 };
    const ajuste = Math.round(ajustes?.[p.id] ?? pagamento?.ajustes ?? 0);
    if (!p.ativo && c.total === 0 && ajuste === 0 && !pagamento) continue;
    const salario = p.ativo ? Math.round(p.salarioMensal ?? 0) : 0;
    linhas.push({
      ...base,
      salario,
      comissoes: c.total,
      quantidadeComissoes: c.quantidade,
      ajustes: ajuste,
      total: salario + c.total + ajuste,
      pago: false,
      ...(pagamento ? { pagamento } : {}),
    });
  }
  return linhas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export interface TotaisFolha {
  salarios: Centavos;
  comissoes: Centavos;
  ajustes: Centavos;
  total: Centavos;
  pago: Centavos;
  aPagar: Centavos;
}

export function totaisFolha(linhas: readonly LinhaFolha[]): TotaisFolha {
  const t: TotaisFolha = { salarios: 0, comissoes: 0, ajustes: 0, total: 0, pago: 0, aPagar: 0 };
  for (const l of linhas) {
    t.salarios += l.salario;
    t.comissoes += l.comissoes;
    t.ajustes += l.ajustes;
    t.total += l.total;
    if (l.pago) t.pago += l.total;
    else t.aPagar += l.total;
  }
  return t;
}

export type CodigoPagamentoFolha = "ja_pago" | "total_invalido" | "data_invalida";

/**
 * Marca a linha como paga: congela salário, comissões, ajustes e total num PagamentoFolha. Recusa linha já paga
 * (ja_pago), total negativo (total_invalido; desconto maior que o devido) e data inexistente (data_invalida).
 */
export function pagarLinhaFolha(
  linha: LinhaFolha,
  dados: { id: Id; pagoEm: DataISO; despesaId?: Id; obs?: string },
): { ok: true; pagamento: PagamentoFolha } | { ok: false; codigo: CodigoPagamentoFolha } {
  if (linha.pago) return { ok: false, codigo: "ja_pago" };
  if (!dataISOValida(dados.pagoEm)) return { ok: false, codigo: "data_invalida" };
  if (!Number.isInteger(linha.total) || linha.total < 0) return { ok: false, codigo: "total_invalido" };
  const obs = dados.obs?.trim();
  return {
    ok: true,
    pagamento: {
      id: dados.id,
      perfilId: linha.perfilId,
      mes: linha.mes,
      salario: linha.salario,
      comissoes: linha.comissoes,
      ...(linha.ajustes ? { ajustes: linha.ajustes } : {}),
      total: linha.total,
      pagoEm: dados.pagoEm,
      ...(dados.despesaId ? { despesaId: dados.despesaId } : {}),
      ...(obs ? { obs } : {}),
    },
  };
}

/** "2026-10" → "10/2026". */
const mesCurto = (mes: string) => `${mes.slice(5, 7)}/${mes.slice(0, 4)}`;

/**
 * Despesa "Salários" já paga que o pagamento gera (sem id). Total 0 não vira despesa (null).
 * `categoriaId` = id da categoria "Salários" do cadastro, se houver.
 */
export function despesaDaFolha(pagamento: PagamentoFolha, nome: string, categoriaId?: Id): Omit<Despesa, "id"> | null {
  if (!pagamento.pagoEm || !(pagamento.total > 0)) return null;
  return {
    categoria: CATEGORIA_SALARIOS,
    ...(categoriaId ? { categoriaId } : {}),
    descricao: `Folha ${mesCurto(pagamento.mes)} · ${nome}`,
    valorPrevisto: pagamento.total,
    vencimento: pagamento.pagoEm,
    pagoEm: pagamento.pagoEm,
    valorPago: pagamento.total,
  };
}

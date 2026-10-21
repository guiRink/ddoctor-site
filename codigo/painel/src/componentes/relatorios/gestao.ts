// Números de gestão da aba Relatórios do Financeiro (sprint SG, plano item 12): carros entregues, faturado por
// seguradora, tempo médio de pátio e itens negados por seguradora. Só agrega o que a visão da OS já traz.
// TODO(dominio-regras): se estes números forem para o worker ou para outra tela, mover para @compartilhado/dominio/relatorios.
import type { Centavos, OrcamentoVersao } from "@compartilhado/tipos";
import { somaCentavos } from "@compartilhado/dominio/dinheiro";
import { mesDe, paraMs } from "@compartilhado/dominio/fuso";
import type { OSVisao } from "../../dados/repositorio";
import { seguradoraDaOS } from "../../dominio/seguradora";
import { receitaDaOS } from "./montar";

const DIA_MS = 24 * 60 * 60 * 1000;

/** Dias corridos da entrada no pátio até a entrega (1 casa); sem as duas datas, null. */
export function diasDePatio(v: Pick<OSVisao, "os">): number | null {
  const { entradaRealEm, entregueEm } = v.os;
  if (!entradaRealEm || !entregueEm) return null;
  const dias = (paraMs(entregueEm) - paraMs(entradaRealEm)) / DIA_MS;
  return dias < 0 ? null : Math.round(dias * 10) / 10;
}

/** Média dos dias de pátio das OS (ignora as sem data); nenhuma, null. */
export function tempoMedioDePatio(oss: readonly Pick<OSVisao, "os">[]): { media: number | null; quantidade: number } {
  const dias = oss.map(diasDePatio).filter((d): d is number => d !== null);
  if (dias.length === 0) return { media: null, quantidade: 0 };
  return { media: Math.round((dias.reduce((s, d) => s + d, 0) / dias.length) * 10) / 10, quantidade: dias.length };
}

/** OS entregues no mês (sem as canceladas), da entrega mais antiga para a mais nova. */
export function entreguesNoMes(oss: readonly OSVisao[], mes: string): OSVisao[] {
  return oss
    .filter((v) => v.os.estado !== "cancelada" && v.os.entregueEm && mesDe(v.os.entregueEm) === mes)
    .sort((a, b) => (a.os.entregueEm ?? "").localeCompare(b.os.entregueEm ?? ""));
}

export interface LinhaSeguradora {
  seguradora: string;
  carros: number;
  valor: Centavos;
}

/** Faturado (receita da OS, a mesma da ficha) dos carros entregues, por seguradora; maior valor primeiro. */
export function faturadoPorSeguradora(entregues: readonly OSVisao[]): LinhaSeguradora[] {
  const mapa = new Map<string, LinhaSeguradora>();
  for (const v of entregues) {
    const nome = seguradoraDaOS(v);
    const atual = mapa.get(nome) ?? { seguradora: nome, carros: 0, valor: 0 };
    atual.carros += 1;
    atual.valor += receitaDaOS(v);
    mapa.set(nome, atual);
  }
  return [...mapa.values()].sort((a, b) => b.valor - a.valor || a.seguradora.localeCompare(b.seguradora, "pt-BR"));
}

/** Versão externa que vale (a última enviada, aprovada ou recusada); rascunho e substituída não contam. */
function versaoExternaVigente(versoes: readonly OrcamentoVersao[]): OrcamentoVersao | undefined {
  return versoes
    .filter((x) => x.tipo === "externo" && x.estado !== "rascunho" && x.estado !== "substituido")
    .sort((a, b) => b.numeroVersao - a.numeroVersao)[0];
}

export interface LinhaNegados {
  seguradora: string;
  itens: number;
  carros: number;
  valor: Centavos;
}

/**
 * Itens (peças) negados pela seguradora na versão externa vigente das OS abertas no mês, por seguradora;
 * mais itens primeiro. Particular não entra (não há quem negue).
 */
export function negadosPorSeguradora(oss: readonly OSVisao[], mes: string): LinhaNegados[] {
  const mapa = new Map<string, LinhaNegados>();
  for (const v of oss) {
    if (mesDe(v.os.criadoEm) !== mes) continue;
    const negados = versaoExternaVigente(v.versoes)?.itens.filter((i) => i.statusItem === "negado") ?? [];
    if (negados.length === 0) continue;
    const nome = seguradoraDaOS(v);
    const atual = mapa.get(nome) ?? { seguradora: nome, itens: 0, carros: 0, valor: 0 };
    atual.itens += negados.length;
    atual.carros += 1;
    atual.valor += somaCentavos(negados.map((i) => i.valor));
    mapa.set(nome, atual);
  }
  return [...mapa.values()].sort((a, b) => b.itens - a.itens || b.valor - a.valor || a.seguradora.localeCompare(b.seguradora, "pt-BR"));
}

// Seleções de leitura do planejamento no Geral (produção prevista e calendário de entregas).
// Só agregam a visão da OS; a distribuição por dia útil e a capacidade ficam em
// @compartilhado/dominio/producao (producaoPrevista, proximosDiasUteis).
import type { DataISO, EstadoOS } from "@compartilhado/tipos";
import type { ItemPrevisto } from "@compartilhado/dominio/producao";
import type { OSVisao } from "../../dados/repositorio";
import { contagemPecas, versaoAtual } from "../orcamentos/selecoes";

/** OS que ainda têm trabalho de produção pela frente. */
const A_PRODUZIR: ReadonlySet<EstadoOS> = new Set(["aguardando_agendamento", "agendada", "na_oficina"]);
/** OS em aberto que ainda vão sair da oficina (inclui as prontas esperando o cliente). */
const A_ENTREGAR: ReadonlySet<EstadoOS> = new Set(["aguardando_agendamento", "agendada", "na_oficina", "pronta"]);

/** Peças da OS: itens autorizados da versão vigente; sem autorização registrada, as solicitadas não negadas. */
export function pecasDaOS(v: OSVisao): number {
  const c = contagemPecas(versaoAtual(v));
  return c.autorizadas || Math.max(0, c.total - c.negadas);
}

export type ItemProducao = ItemPrevisto & { v: OSVisao };

/** Itens da produção prevista: OS ainda a produzir, com a previsão de entrega e as peças. */
export function itensProducao(oss: readonly OSVisao[]): ItemProducao[] {
  return oss.filter((v) => A_PRODUZIR.has(v.os.estado)).map((v) => ({ v, previsaoEntrega: v.os.previsaoEntrega, pecas: pecasDaOS(v) }));
}

export interface EntregaPrevista {
  v: OSVisao;
  data: DataISO;
  pecas: number;
}

/** Entregas previstas do mês "AAAA-MM" (OS em aberto com previsão no mês), agrupadas por dia. */
export function entregasDoMes(oss: readonly OSVisao[], mes: string): Map<DataISO, EntregaPrevista[]> {
  const mapa = new Map<DataISO, EntregaPrevista[]>();
  for (const v of oss) {
    const data = v.os.previsaoEntrega?.slice(0, 10);
    if (!data || !A_ENTREGAR.has(v.os.estado) || !data.startsWith(mes)) continue;
    const lista = mapa.get(data) ?? [];
    lista.push({ v, data, pecas: pecasDaOS(v) });
    mapa.set(data, lista);
  }
  for (const lista of mapa.values()) lista.sort((a, b) => a.v.veiculo.placa.localeCompare(b.v.veiculo.placa));
  return mapa;
}

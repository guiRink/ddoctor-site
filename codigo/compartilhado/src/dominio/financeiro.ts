// Recebíveis e margem. Dinheiro em centavos; datas de negócio AAAA-MM-DD.
import type { Baixa, Centavos, ConfigOficina, DataISO, EstadoTitulo, Id, OrcamentoVersao, OS, Pagador, TituloReceber } from "../tipos";
import { somaCentavos } from "./dinheiro";
import { diaSemana, diferencaDias, somarDias } from "./fuso";
import { falha, type Resultado } from "./resultado";

const FECHADO: ReadonlySet<EstadoTitulo> = new Set(["recebido", "cancelado"]);

/** valor − Σ baixas; título cancelado tem saldo 0. */
export function saldoTitulo(t: TituloReceber): Centavos {
  if (t.estado === "cancelado") return 0;
  return t.valor - somaCentavos(t.baixas.map((b) => b.valor));
}

/** "vencido" é derivado (não gravado): vencimento < hoje e estado ∉ (recebido, cancelado). */
export function estadoTitulo(t: TituloReceber, hoje: DataISO): EstadoTitulo | "vencido" {
  if (FECHADO.has(t.estado)) return t.estado;
  return t.vencimento < hoje ? "vencido" : t.estado;
}

export type FaixaAging = "a_vencer" | "0_30" | "31_60" | "61_mais";

/** Dias de atraso (hoje − vencimento): ≤ 0 a vencer; 1–30; 31–60; 61+. Recebido/cancelado → null. */
export function faixaAging(t: TituloReceber, hoje: DataISO): FaixaAging | null {
  if (FECHADO.has(t.estado)) return null;
  const atraso = diferencaDias(t.vencimento, hoje);
  if (atraso <= 0) return "a_vencer";
  if (atraso <= 30) return "0_30";
  if (atraso <= 60) return "31_60";
  return "61_mais";
}

export type CodigoBaixa = "baixa_maior_que_saldo" | "valor_invalido" | "transicao_invalida";

/** Registra a baixa: parcial se sobra saldo, recebido se zera. Nunca acima do saldo. */
export function aplicarBaixa(t: TituloReceber, baixa: Baixa): Resultado<CodigoBaixa, { titulo: TituloReceber }> {
  if (FECHADO.has(t.estado)) return falha("transicao_invalida");
  if (!Number.isInteger(baixa.valor) || baixa.valor <= 0) return falha("valor_invalido");
  const saldo = saldoTitulo(t);
  if (baixa.valor > saldo) return falha("baixa_maior_que_saldo");
  return {
    ok: true,
    titulo: { ...t, baixas: [...t.baixas, { ...baixa }], estado: baixa.valor === saldo ? "recebido" : "parcial" },
  };
}

/** Data-base do título conforme a regra do pagador; null se o marco ainda não aconteceu. */
export function dataBaseTitulo(
  pagador: Pagador,
  marcos: { nfEmitidaEm?: DataISO; entregueEm?: DataISO; servicoRealizadoEm?: DataISO },
): DataISO | null {
  const base = pagador.prazo.base;
  const valor = base === "nf" ? marcos.nfEmitidaEm : base === "entrega" ? marcos.entregueEm : marcos.servicoRealizadoEm;
  return valor ? valor.slice(0, 10) : null;
}

/**
 * Vencimento = dataBase + prazo do pagador. Dias úteis aqui são bancários (seg–sex),
 * independentes do expediente da oficina; feriados ainda não entram (provisório).
 * `_config` fica reservado para a lista de feriados.
 */
export function vencimentoPorRegra(pagador: Pagador, dataBase: DataISO, _config?: ConfigOficina): DataISO {
  const { dias, diasUteis } = pagador.prazo;
  if (!diasUteis) return somarDias(dataBase, dias);
  let d = dataBase;
  for (let contados = 0; contados < dias; ) {
    d = somarDias(d, 1);
    const ds = diaSemana(d);
    if (ds !== 0 && ds !== 6) contados++;
  }
  return d;
}

export type TipoTitulo = "franquia" | "complemento" | "mao_obra_autorizada" | "particular" | "peca";

export interface TituloSugerido {
  osId: Id;
  pagadorId: Id;
  tipo: TipoTitulo;
  descricao: string;
  valor: Centavos;
}

export type CodigoTitulos = "versao_nao_aprovada" | "sem_pagador";

/**
 * Valor aprovado da versão: itens "autorizado". Em orçamento interno (aprovado pelo cliente como um todo)
 * contam também os "solicitado" e "reanalise" (só negado/dispensado ficam fora).
 */
export function valorAprovado(versao: OrcamentoVersao): Centavos {
  const conta =
    versao.tipo === "interno"
      ? (s: string) => s !== "negado" && s !== "dispensado"
      : (s: string) => s === "autorizado";
  return somaCentavos(versao.itens.filter((i) => conta(i.statusItem)).map((i) => i.valor));
}

/**
 * Títulos sugeridos na entrega (o financeiro confirma):
 * - particular: um título "particular" com o valor aprovado → cliente;
 * - com assistência/seguradora: franquia → cliente; mão de obra autorizada − franquia (se o pagador
 *   desconta; ausente = desconta, provisório) senão o total → Maxpar/seguradora; complemento → cliente.
 * `pagadorExternoId` escolhe o pagador da mão de obra (obrigatório em seguradora_direta; nas demais,
 * o padrão é o primeiro pagador do tipo "maxpar"). Títulos de valor zero não são sugeridos.
 */
export function titulosSugeridos(
  os: OS,
  versaoAprovada: OrcamentoVersao,
  pagadores: readonly Pagador[],
  pagadorExternoId?: Id,
): Resultado<CodigoTitulos, { titulos: TituloSugerido[] }> {
  if (versaoAprovada.estado !== "aprovado") return falha("versao_nao_aprovada");
  const cliente = pagadores.find((p) => p.tipo === "cliente");
  const titulos: TituloSugerido[] = [];
  const aprovado = valorAprovado(versaoAprovada);

  if (os.origem === "particular") {
    if (!cliente) return falha("sem_pagador");
    if (aprovado > 0)
      titulos.push({ osId: os.id, pagadorId: cliente.id, tipo: "particular", descricao: "Serviço particular", valor: aprovado });
    return { ok: true, titulos };
  }

  const externo = pagadorExternoId
    ? pagadores.find((p) => p.id === pagadorExternoId)
    : os.origem === "seguradora_direta"
      ? undefined
      : pagadores.find((p) => p.tipo === "maxpar");
  const franquia = versaoAprovada.franquia ?? 0;
  const complemento = versaoAprovada.complementoParticular ?? 0;
  if (!externo || ((franquia > 0 || complemento > 0) && !cliente)) return falha("sem_pagador");

  if (franquia > 0)
    titulos.push({ osId: os.id, pagadorId: cliente!.id, tipo: "franquia", descricao: "Franquia", valor: franquia });
  const descontar = externo.descontaFranquia ?? true;
  const maoDeObra = Math.max(0, descontar ? aprovado - franquia : aprovado);
  if (maoDeObra > 0)
    titulos.push({
      osId: os.id,
      pagadorId: externo.id,
      tipo: "mao_obra_autorizada",
      descricao: `Mão de obra autorizada — ${externo.nome}`,
      valor: maoDeObra,
    });
  if (complemento > 0)
    titulos.push({ osId: os.id, pagadorId: cliente!.id, tipo: "complemento", descricao: "Complemento particular", valor: complemento });
  return { ok: true, titulos };
}

/** Custo de material por uso estimado: quantidade × custo médio, arredondado ao centavo. */
export function custoUsoEstimado(quantidade: number, custoMedio: Centavos): Centavos {
  return Math.round(quantidade * custoMedio);
}

/**
 * Margem da OS = Σ títulos não cancelados − Σ custos (material estimado, comissão…).
 * `prevista` = ainda há título não recebido (rótulo "prevista" na UI). percentual em fração (0,35), null sem receita.
 */
export function margemOS(
  titulos: readonly TituloReceber[],
  custos: ReadonlyArray<{ valor: Centavos }>,
): { receita: Centavos; custo: Centavos; margem: Centavos; percentual: number | null; prevista: boolean } {
  const validos = titulos.filter((t) => t.estado !== "cancelado");
  const receita = somaCentavos(validos.map((t) => t.valor));
  const custo = somaCentavos(custos.map((c) => c.valor));
  const margem = receita - custo;
  return {
    receita,
    custo,
    margem,
    percentual: receita > 0 ? margem / receita : null,
    prevista: validos.length === 0 || validos.some((t) => t.estado !== "recebido"),
  };
}

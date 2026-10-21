import type { AlertaCarroConfig, CampoConfig, CategoriaFinanceira, ChecklistItem, ConfigOficina } from "../tipos";
import { CAMPOS_CONFIG } from "../tipos";
import { minutosDeHora } from "./fuso";
import { falha } from "./resultado";

/**
 * Configuração padrão enquanto o dono não confirma (docs/painel-informacoes.md §4–5).
 * Todos os valores são provisórios: expediente seg–sex 8h–18h e sáb 8h–12h sem almoço,
 * laranja com 80 % do prazo da etapa consumido (laranjaAntesHoras = 8 só para etapa sem prazoHoras),
 * vermelho com impedimento há mais de 4 h úteis,
 * 4 entradas/dia, 12 carros simultâneos (só aviso) e 10 peças/dia na produção prevista.
 */
export const CONFIG_PADRAO: ConfigOficina = {
  expediente: { diasSemana: [1, 2, 3, 4, 5, 6], inicio: "08:00", fim: "18:00", sabadoFim: "12:00" },
  semaforo: { laranjaAntesHoras: 8, vermelhoBloqueioHoras: 4, laranjaFracao: 0.8 },
  capacidadePadrao: { vagasEntrada: 4, carrosSimultaneos: 12, pecasDia: 10 },
  provisorio: true,
};

/**
 * Base da cor do carro (pedido do dono, 2º áudio; docs/revisao-sh/pedido-dono-2.md). Provisório até o dono salvar
 * em Ajustes: laranja e vermelho-sem-etapa a 1 dia útil da entrega (hoje ou amanhã), atrasado pisca, prazo sugerido
 * de 10 dias úteis (o exemplo do áudio).
 */
export const ALERTA_CARRO_PADRAO: Readonly<AlertaCarroConfig> = {
  laranjaDiasAntes: 1,
  vermelhoSemEtapaDiasAntes: 1,
  piscarAtrasado: true,
  prazoPadraoDiasUteis: 10,
};

/** Limites (inteiros) do alerta do carro, na configuração e no ajuste por carro. Fora disso: valor_invalido. */
export const LIMITES_ALERTA = {
  laranjaDiasAntes: { min: 0, max: 60 },
  vermelhoSemEtapaDiasAntes: { min: 0, max: 60 },
  prazoDiasUteis: { min: 0, max: 60 },
  prazoPadraoDiasUteis: { min: 1, max: 60 },
} as const;

/** Base do alerta da configuração, completando o que faltar com ALERTA_CARRO_PADRAO (provisório). */
export function alertaCarroBase(config: Pick<ConfigOficina, "alertaCarro">): Required<AlertaCarroConfig> {
  const a = config.alertaCarro;
  const inteiro = (v: unknown, lim: { min: number; max: number }, padrao: number) =>
    typeof v === "number" && Number.isInteger(v) && v >= lim.min && v <= lim.max ? v : padrao;
  return {
    laranjaDiasAntes: inteiro(a?.laranjaDiasAntes, LIMITES_ALERTA.laranjaDiasAntes, ALERTA_CARRO_PADRAO.laranjaDiasAntes),
    vermelhoSemEtapaDiasAntes: inteiro(a?.vermelhoSemEtapaDiasAntes, LIMITES_ALERTA.vermelhoSemEtapaDiasAntes, ALERTA_CARRO_PADRAO.vermelhoSemEtapaDiasAntes),
    piscarAtrasado: typeof a?.piscarAtrasado === "boolean" ? a.piscarAtrasado : ALERTA_CARRO_PADRAO.piscarAtrasado,
    prazoPadraoDiasUteis: inteiro(a?.prazoPadraoDiasUteis, LIMITES_ALERTA.prazoPadraoDiasUteis, ALERTA_CARRO_PADRAO.prazoPadraoDiasUteis!),
  };
}

/** Laranja quando já passou esta fração do prazo da etapa (provisório: 0,8; revisão SG, a confirmar com o dono). */
export const LARANJA_FRACAO_PADRAO = 0.8;

/** Pronto há esta quantidade de dias ou mais sem o cliente buscar: "cliente não buscou" (provisório: 2). */
export const DIAS_PRONTO_NAO_BUSCOU_PADRAO = 2;

/** Vistoria com limite a até esta quantidade de dias entra em "Para fazer hoje" (provisório: 2, painel-informacoes §5). */
export const DIAS_VISTORIA_VENCENDO_PADRAO = 2;

/** Fração do prazo da configuração (0 < f ≤ 1); fora disso ou ausente, o padrão provisório. */
export function laranjaFracao(config: Pick<ConfigOficina, "semaforo">): number {
  const f = config.semaforo.laranjaFracao;
  return typeof f === "number" && f > 0 && f <= 1 ? f : LARANJA_FRACAO_PADRAO;
}

/** Folga somada aos prazos das etapas para sugerir a previsão de entrega (provisório: 20 %). */
export const FOLGA_PREVISAO_PADRAO = 0.2;

/** Dias sem conferência de estoque que pedem nova contagem (provisório: 90). */
export const DIAS_CONFERENCIA_ESTOQUE_PADRAO = 90;

/** Peças por dia útil que a oficina dá conta (provisório: 10, valor visto no sistema concorrente; a confirmar). */
export const CAPACIDADE_PECAS_DIA_PADRAO = 10;

/** Dias sem saída que caracterizam estoque parado (provisório: 90). */
export const DIAS_ESTOQUE_PARADO_PADRAO = 90;

/**
 * Checklist de entrada genérico (provisório, a confirmar com o dono). Ids estáveis: a recepção grava
 * `checklist[id] = true`; desativar um item em Ajustes não apaga o que já foi marcado.
 */
export const CHECKLIST_PADRAO: readonly ChecklistItem[] = [
  ["doc_crlv", "Documentos e chaves", "Documento do veículo (CRLV)"],
  ["chave_principal", "Documentos e chaves", "Chave principal"],
  ["chave_reserva", "Documentos e chaves", "Chave reserva"],
  ["manual", "Documentos e chaves", "Manual do proprietário"],
  ["controle_alarme", "Documentos e chaves", "Controle de alarme ou portão"],
  ["estepe", "Itens de série", "Estepe"],
  ["macaco", "Itens de série", "Macaco"],
  ["chave_roda", "Itens de série", "Chave de roda"],
  ["triangulo", "Itens de série", "Triângulo"],
  ["tapetes", "Itens de série", "Tapetes"],
  ["antena", "Itens de série", "Antena"],
  ["farois", "Funcionamento", "Faróis e lanternas"],
  ["setas_freio", "Funcionamento", "Setas e luz de freio"],
  ["vidros_travas", "Funcionamento", "Vidros e travas elétricas"],
  ["ar_condicionado", "Funcionamento", "Ar-condicionado"],
  ["painel_alertas", "Funcionamento", "Painel sem luz de advertência"],
  ["parabrisa", "Conservação", "Para-brisa sem trinca"],
  ["retrovisores", "Conservação", "Retrovisores inteiros"],
  ["rodas_pneus", "Conservação", "Rodas e pneus"],
  ["interior", "Conservação", "Interior sem danos"],
  ["objetos_valor", "Conservação", "Sem objetos de valor no veículo"],
].map(([id, grupo, nome]) => ({ id, grupo, nome, ativo: true }));

/**
 * Categorias financeiras iniciais (provisório). Despesas: lista sugerida em docs/painel-informacoes.md §4;
 * receitas: separação mínima por origem do dinheiro. O dono ajusta em Ajustes → Financeiro.
 */
export const CATEGORIAS_PADRAO: readonly CategoriaFinanceira[] = [
  ["rec_particular", "Serviços particulares", "receita"],
  ["rec_seguradora", "Assistência / seguradora", "receita"],
  ["rec_franquia", "Franquias", "receita"],
  ["rec_outras", "Outras receitas", "receita"],
  ["desp_aluguel", "Aluguel", "despesa"],
  ["desp_energia_agua", "Energia e água", "despesa"],
  ["desp_mat_pintura", "Material de pintura", "despesa"],
  ["desp_mat_polimento", "Material de polimento", "despesa"],
  ["desp_ferramentas", "Ferramentas", "despesa"],
  ["desp_salarios", "Salários e pró-labore", "despesa"],
  ["desp_comissoes", "Comissões", "despesa"],
  ["desp_terceiros", "Serviços de terceiros", "despesa"],
  ["desp_marketing", "Marketing", "despesa"],
  ["desp_impostos", "Impostos", "despesa"],
  ["desp_manutencao", "Manutenção", "despesa"],
  ["desp_outras", "Outras despesas", "despesa"],
].map(([id, nome, tipo]) => ({ id, nome, tipo: tipo as CategoriaFinanceira["tipo"], ativa: true }));

/** Capacidade de peças/dia da configuração, com o padrão provisório. */
export function capacidadePecasDia(config: Pick<ConfigOficina, "capacidadePadrao">): number {
  return config.capacidadePadrao.pecasDia ?? CAPACIDADE_PECAS_DIA_PADRAO;
}

/** Itens do checklist de entrada da configuração (ou o padrão provisório). */
export function itensChecklist(config: Pick<ConfigOficina, "checklist">): readonly ChecklistItem[] {
  return config.checklist ?? CHECKLIST_PADRAO;
}

// ---------------------------------------------------------------- edição da configuração (Ajustes)

/** Limites aceitos ao editar a capacidade e o semáforo (inteiros). Fora disso: valor_invalido. */
export const LIMITES_CONFIG = {
  vagasEntrada: { min: 1, max: 30 },
  carrosSimultaneos: { min: 1, max: 60 },
  pecasDia: { min: 1, max: 200 },
  laranjaAntesHoras: { min: 1, max: 80 },
  vermelhoBloqueioHoras: { min: 1, max: 80 },
} as const;

/** Fração do prazo da etapa em que o cartão fica laranja, ao editar em Ajustes: 50 % a 95 % (revisão SG). */
export const LIMITES_LARANJA_FRACAO = { min: 0.5, max: 0.95 } as const;

export interface ConfigParcial {
  capacidadePadrao?: { vagasEntrada?: number; carrosSimultaneos?: number; pecasDia?: number };
  expediente?: ConfigOficina["expediente"];
  semaforo?: Partial<ConfigOficina["semaforo"]>;
  /** Base da cor do carro; os campos ausentes mantêm o valor atual (ou o padrão provisório). */
  alertaCarro?: Partial<AlertaCarroConfig>;
}

export type CodigoConfig = "valor_invalido" | "expediente_invalido" | "nada_a_salvar";

/** Falha traz o `campo` que não passou (para a tela marcar o campo certo). */
export type ResultadoConfig =
  | { ok: true; config: ConfigOficina; campos: CampoConfig[] }
  | { ok: false; codigo: CodigoConfig; campo?: string };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function inteiroEntre(v: unknown, lim: { min: number; max: number }): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= lim.min && v <= lim.max;
}

/** O campo ainda é "provisório — a confirmar"? (confirmado por campo vence o `provisorio` geral). */
export function campoConfigProvisorio(config: Pick<ConfigOficina, "provisorio" | "confirmado">, campo: CampoConfig): boolean {
  return config.provisorio && !config.confirmado?.[campo];
}

/**
 * Aplica uma edição parcial da configuração. Valida inteiros dentro de LIMITES_CONFIG (valor_invalido, com o
 * `campo` que falhou) e o expediente (dias 0–6 sem repetir, "HH:MM", início antes do fim: expediente_invalido).
 * Cada campo salvo vira confirmado; o `provisorio` geral cai quando todos os CAMPOS_CONFIG estão confirmados.
 */
export function aplicarConfig(config: ConfigOficina, parcial: ConfigParcial): ResultadoConfig {
  const campos: CampoConfig[] = [];
  let capacidadePadrao = config.capacidadePadrao;
  let semaforo = config.semaforo;
  let expediente = config.expediente;
  let alertaCarro = config.alertaCarro;

  const cap = parcial.capacidadePadrao;
  if (cap) {
    for (const campo of ["vagasEntrada", "carrosSimultaneos", "pecasDia"] as const) {
      if (cap[campo] === undefined) continue;
      if (!inteiroEntre(cap[campo], LIMITES_CONFIG[campo])) return { ok: false, codigo: "valor_invalido", campo };
      capacidadePadrao = { ...capacidadePadrao, [campo]: cap[campo] };
      campos.push(campo);
    }
  }
  const sem = parcial.semaforo;
  if (sem) {
    let mudou = false;
    for (const campo of ["laranjaAntesHoras", "vermelhoBloqueioHoras"] as const) {
      if (sem[campo] === undefined) continue;
      if (!inteiroEntre(sem[campo], LIMITES_CONFIG[campo])) return { ok: false, codigo: "valor_invalido", campo };
      semaforo = { ...semaforo, [campo]: sem[campo] };
      mudou = true;
    }
    if (sem.laranjaFracao !== undefined) {
      const f = sem.laranjaFracao;
      if (typeof f !== "number" || !Number.isFinite(f) || f < LIMITES_LARANJA_FRACAO.min || f > LIMITES_LARANJA_FRACAO.max)
        return { ok: false, codigo: "valor_invalido", campo: "laranjaFracao" };
      semaforo = { ...semaforo, laranjaFracao: Math.round(f * 100) / 100 };
      mudou = true;
    }
    if (mudou) campos.push("semaforo");
  }
  const exp = parcial.expediente;
  if (exp) {
    const dias = exp.diasSemana;
    const diasOk =
      Array.isArray(dias) && dias.length > 0 && new Set(dias).size === dias.length && dias.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (!diasOk || !HHMM.test(exp.inicio ?? "") || !HHMM.test(exp.fim ?? "")) return { ok: false, codigo: "expediente_invalido", campo: "expediente" };
    if (minutosDeHora(exp.inicio) >= minutosDeHora(exp.fim)) return { ok: false, codigo: "expediente_invalido", campo: "expediente" };
    if (exp.sabadoFim !== undefined && (!HHMM.test(exp.sabadoFim) || minutosDeHora(exp.sabadoFim) <= minutosDeHora(exp.inicio)))
      return { ok: false, codigo: "expediente_invalido", campo: "sabadoFim" };
    expediente = { diasSemana: [...dias].sort((a, b) => a - b), inicio: exp.inicio, fim: exp.fim, ...(exp.sabadoFim ? { sabadoFim: exp.sabadoFim } : {}) };
    campos.push("expediente");
  }
  const al = parcial.alertaCarro;
  if (al) {
    let novo: AlertaCarroConfig = { ...alertaCarroBase(config) };
    let mudou = false;
    for (const campo of ["laranjaDiasAntes", "vermelhoSemEtapaDiasAntes", "prazoPadraoDiasUteis"] as const) {
      if (al[campo] === undefined) continue;
      if (!inteiroEntre(al[campo], LIMITES_ALERTA[campo])) return { ok: false, codigo: "valor_invalido", campo };
      novo = { ...novo, [campo]: al[campo] };
      mudou = true;
    }
    if (al.piscarAtrasado !== undefined) {
      if (typeof al.piscarAtrasado !== "boolean") return { ok: false, codigo: "valor_invalido", campo: "piscarAtrasado" };
      novo = { ...novo, piscarAtrasado: al.piscarAtrasado };
      mudou = true;
    }
    if (mudou) {
      alertaCarro = novo;
      campos.push("alertaCarro");
    }
  }
  if (campos.length === 0) return falha("nada_a_salvar");

  const confirmado = { ...config.confirmado };
  for (const c of campos) confirmado[c] = true;
  const todos = CAMPOS_CONFIG.every((c) => confirmado[c]);
  return { ok: true, campos, config: { ...config, capacidadePadrao, semaforo, expediente, ...(alertaCarro ? { alertaCarro } : {}), confirmado, provisorio: config.provisorio && !todos } };
}

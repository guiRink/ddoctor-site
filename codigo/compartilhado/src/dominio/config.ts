import type { CampoConfig, CategoriaFinanceira, ChecklistItem, ConfigOficina } from "../tipos";
import { CAMPOS_CONFIG } from "../tipos";
import { minutosDeHora } from "./fuso";
import { falha } from "./resultado";

/**
 * Configuração padrão enquanto o dono não confirma (docs/painel-informacoes.md §4–5).
 * Todos os valores são provisórios: expediente seg–sex 8h–18h e sáb 8h–12h sem almoço,
 * laranja a 8 h úteis do prazo, vermelho com impedimento há mais de 4 h úteis,
 * 4 entradas/dia, 12 carros simultâneos (só aviso) e 10 peças/dia na produção prevista.
 */
export const CONFIG_PADRAO: ConfigOficina = {
  expediente: { diasSemana: [1, 2, 3, 4, 5, 6], inicio: "08:00", fim: "18:00", sabadoFim: "12:00" },
  semaforo: { laranjaAntesHoras: 8, vermelhoBloqueioHoras: 4 },
  capacidadePadrao: { vagasEntrada: 4, carrosSimultaneos: 12, pecasDia: 10 },
  provisorio: true,
};

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

export interface ConfigParcial {
  capacidadePadrao?: { vagasEntrada?: number; carrosSimultaneos?: number; pecasDia?: number };
  expediente?: ConfigOficina["expediente"];
  semaforo?: Partial<ConfigOficina["semaforo"]>;
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
  if (campos.length === 0) return falha("nada_a_salvar");

  const confirmado = { ...config.confirmado };
  for (const c of campos) confirmado[c] = true;
  const todos = CAMPOS_CONFIG.every((c) => confirmado[c]);
  return { ok: true, campos, config: { ...config, capacidadePadrao, semaforo, expediente, confirmado, provisorio: config.provisorio && !todos } };
}

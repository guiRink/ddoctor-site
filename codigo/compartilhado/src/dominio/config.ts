import type { CategoriaFinanceira, ChecklistItem, ConfigOficina } from "../tipos";

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

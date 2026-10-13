import type { ConfigOficina } from "../tipos";

/**
 * Configuração padrão enquanto o dono não confirma (docs/painel-informacoes.md §4–5).
 * Todos os valores são provisórios: expediente seg–sex 8h–18h e sáb 8h–12h sem almoço,
 * laranja a 8 h úteis do prazo, vermelho com impedimento há mais de 4 h úteis,
 * 4 entradas/dia e 12 carros simultâneos (só aviso).
 */
export const CONFIG_PADRAO: ConfigOficina = {
  expediente: { diasSemana: [1, 2, 3, 4, 5, 6], inicio: "08:00", fim: "18:00", sabadoFim: "12:00" },
  semaforo: { laranjaAntesHoras: 8, vermelhoBloqueioHoras: 4 },
  capacidadePadrao: { vagasEntrada: 4, carrosSimultaneos: 12 },
  provisorio: true,
};

/** Folga somada aos prazos das etapas para sugerir a previsão de entrega (provisório: 20 %). */
export const FOLGA_PREVISAO_PADRAO = 0.2;

/** Dias sem conferência de estoque que pedem nova contagem (provisório: 90). */
export const DIAS_CONFERENCIA_ESTOQUE_PADRAO = 90;

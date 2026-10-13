import type {
  EstadoAgendamento,
  EstadoEtapa,
  EstadoOS,
  EstadoTitulo,
  EstadoVersao,
  FaseVistoria,
  OrigemOS,
  Papel,
  StatusExterno,
  StatusItem,
  Tecnica,
  TipoPendencia,
} from "@compartilhado/tipos";
import type { Tom } from "../componentes/ui/Estado";
import type { NomeIcone } from "../componentes/Icone";
import type { Modulo } from "./permissoes";

// Rótulos pt-BR centralizados (CLAUDE.md). Cada estado tem texto e tom de cor (docs/painel-design.md §2).

export const ESTADO_OS: Record<EstadoOS, { texto: string; tom: Tom }> = {
  rascunho: { texto: "Rascunho", tom: "neutro" },
  aguardando_aprovacao: { texto: "Aguardando aprovação", tom: "neutro" },
  aguardando_agendamento: { texto: "Aguardando agendamento", tom: "amarelo" },
  agendada: { texto: "Agendado", tom: "escuro" },
  na_oficina: { texto: "Na oficina", tom: "escuro" },
  pronta: { texto: "Pronto para entrega", tom: "ok" },
  entregue: { texto: "Entregue", tom: "neutro" },
  encerrada: { texto: "Encerrado", tom: "ok" },
  cancelada: { texto: "Cancelado", tom: "neutro" },
};

export const ESTADO_VERSAO: Record<EstadoVersao, { texto: string; tom: Tom }> = {
  rascunho: { texto: "Rascunho", tom: "neutro" },
  enviado: { texto: "Enviado", tom: "neutro" },
  aprovado: { texto: "Aprovado", tom: "ok" },
  recusado: { texto: "Recusado", tom: "alerta" },
  substituido: { texto: "Substituído", tom: "neutro" },
};

export const STATUS_EXTERNO: Record<StatusExterno, { texto: string; tom: Tom }> = {
  aguardando_autorizacao: { texto: "Aguardando autorização", tom: "neutro" },
  autorizado: { texto: "Autorizado", tom: "ok" },
  parcialmente_autorizado: { texto: "Autorizado em parte", tom: "atencao" },
  negado: { texto: "Negado", tom: "alerta" },
  aguardando_peca: { texto: "Aguardando peça", tom: "atencao" },
  servico_realizado: { texto: "Serviço realizado", tom: "neutro" },
  pago: { texto: "Pago", tom: "ok" },
  cancelado: { texto: "Cancelado", tom: "neutro" },
  desconhecido: { texto: "Status não reconhecido", tom: "atencao" },
};

export const STATUS_ITEM: Record<StatusItem, { texto: string; tom: Tom }> = {
  solicitado: { texto: "Solicitada", tom: "neutro" },
  autorizado: { texto: "Autorizada", tom: "ok" },
  negado: { texto: "Negada", tom: "alerta" },
  reanalise: { texto: "Em reanálise", tom: "atencao" },
  dispensado: { texto: "Dispensada", tom: "neutro" },
};

export const ESTADO_ETAPA: Record<EstadoEtapa, { texto: string; tom: Tom }> = {
  aguardando: { texto: "Aguardando", tom: "neutro" },
  na_fila: { texto: "Na fila", tom: "neutro" },
  em_execucao: { texto: "Em execução", tom: "amarelo" },
  bloqueada: { texto: "Impedida", tom: "alerta" },
  concluida: { texto: "Concluída", tom: "ok" },
  dispensada: { texto: "Dispensada", tom: "neutro" },
};

export const ESTADO_AGENDAMENTO: Record<EstadoAgendamento, { texto: string; tom: Tom }> = {
  pendente: { texto: "Pendente", tom: "neutro" },
  contatando: { texto: "Calia contatando", tom: "maxpar" },
  proposto: { texto: "Horário proposto", tom: "atencao" },
  confirmado: { texto: "Confirmado", tom: "ok" },
  cancelado: { texto: "Cancelado", tom: "neutro" },
  nao_compareceu: { texto: "Não compareceu", tom: "alerta" },
  realizado: { texto: "Realizado", tom: "neutro" },
};

export const ESTADO_TITULO: Record<EstadoTitulo | "vencido", { texto: string; tom: Tom }> = {
  previsto: { texto: "Previsto", tom: "neutro" },
  emitido: { texto: "A receber", tom: "neutro" },
  parcial: { texto: "Recebido em parte", tom: "atencao" },
  recebido: { texto: "Recebido", tom: "ok" },
  cancelado: { texto: "Cancelado", tom: "neutro" },
  vencido: { texto: "Vencido", tom: "alerta" },
};

export const ORIGEM_OS: Record<OrigemOS, string> = {
  maxpar: "Maxpar",
  seguradora_direta: "Seguradora direta",
  particular: "Particular",
  misto: "Maxpar + particular",
};

export const TECNICA: Record<Tecnica, string> = {
  sra: "SRA (arranhões)",
  martelinho: "Martelinho",
  pintura: "Pintura",
  funilaria: "Funilaria",
  polimento: "Polimento",
  outro: "Outro",
};

export const FASE_VISTORIA: Record<FaseVistoria, string> = {
  entrada: "Entrada",
  durante: "Durante",
  final: "Final",
  externa: "Maxpar (segurado)",
};

export const TIPO_PENDENCIA: Record<TipoPendencia, string> = {
  encerrar_portal: "Encerrar no portal",
  enviar_documentacao: "Enviar documentação",
  reenviar_documentacao: "Reenviar documentação",
  solicitar_reanalise: "Pedir reanálise",
  atualizar_previsao: "Atualizar previsão no portal",
  outro: "Outra ação no portal",
};

export const PAPEL: Record<Papel, string> = {
  dono: "Dono",
  gestor: "Gestor",
  recepcao: "Recepção",
  producao: "Produção",
  financeiro: "Financeiro",
  dispositivo: "TV",
};

export const JANELA = { manha: "Manhã", tarde: "Tarde" } as const;

/** Códigos de erro do domínio/banco → mensagem para a pessoa. */
export const ERRO: Record<string, string> = {
  sem_vaga: "Não há vaga nesse período. Escolha outro dia ou outro período.",
  dia_bloqueado: "Esse dia está bloqueado na agenda.",
  motivo_obrigatorio: "Informe o motivo.",
  transicao_invalida: "Essa ação não vale para o estado atual.",
  foto_obrigatoria: "Essa etapa exige foto antes de concluir.",
  contagem_obrigatoria: "Informe quantas peças foram feitas.",
  nao_responsavel: "Essa etapa é de outra pessoa.",
  baixa_maior_que_saldo: "O valor é maior que o saldo do título.",
  sem_tipo_reparo: "Escolha o tipo de reparo para gerar as etapas.",
  aprovacao_nao_confiavel: "A aprovação ainda não foi confirmada.",
  etapas_pendentes: "Ainda há etapas em aberto.",
  sem_itens: "Inclua ao menos uma peça.",
  placa_invalida: "Placa inválida. Use 7 caracteres, como ABC1D23.",
};

export const MENU: { modulo: Modulo; rota: string; nome: string; icone: NomeIcone; grupo: "operacao" | "gestao" | "sistema" }[] = [
  { modulo: "geral", rota: "/geral", nome: "Geral", icone: "geral", grupo: "operacao" },
  { modulo: "orcamentos", rota: "/orcamentos", nome: "Orçamentos", icone: "orcamentos", grupo: "operacao" },
  { modulo: "agenda", rota: "/agenda", nome: "Agenda", icone: "agenda", grupo: "operacao" },
  { modulo: "producao", rota: "/producao", nome: "Produção", icone: "producao", grupo: "operacao" },
  { modulo: "minhas_tarefas", rota: "/producao/eu", nome: "Minhas tarefas", icone: "celular", grupo: "operacao" },
  { modulo: "vistorias", rota: "/vistorias", nome: "Vistorias", icone: "vistorias", grupo: "operacao" },
  { modulo: "funcionarios", rota: "/funcionarios", nome: "Funcionários", icone: "funcionarios", grupo: "gestao" },
  { modulo: "estoque", rota: "/estoque", nome: "Estoque", icone: "estoque", grupo: "gestao" },
  { modulo: "recebiveis", rota: "/recebiveis", nome: "Recebíveis", icone: "recebiveis", grupo: "gestao" },
  { modulo: "financeiro", rota: "/financeiro", nome: "Financeiro", icone: "financeiro", grupo: "gestao" },
  { modulo: "tv", rota: "/producao/tv", nome: "Quadro da TV", icone: "tv", grupo: "sistema" },
  { modulo: "ajustes", rota: "/ajustes", nome: "Ajustes", icone: "ajustes", grupo: "sistema" },
];

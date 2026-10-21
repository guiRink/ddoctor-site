import type {
  FormaPagamento,
  NivelCombustivel,
  TamanhoAvaria,
  TipoAvaria,
  TipoCustoOS,
  TipoMovimentoEstoque,
  TipoPessoa,
  VistaAvaria,
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

// Nomes da oficina (sprint SG; voz do dono no SH), os mesmos das situações da tela Orçamentos (orcamentos/lista.ts).
export const ESTADO_OS: Record<EstadoOS, { texto: string; tom: Tom }> = {
  rascunho: { texto: "Em orçamento", tom: "neutro" },
  // espera de terceiro / falta da oficina: atenção suave (pílula clara com ponto); amarelo fica só para ação
  aguardando_aprovacao: { texto: "Aguardando aprovação", tom: "atencao" },
  aguardando_agendamento: { texto: "Aguardando agendamento", tom: "atencao" },
  agendada: { texto: "Agendado", tom: "escuro" },
  na_oficina: { texto: "Na oficina", tom: "escuro" },
  pronta: { texto: "Pronto", tom: "ok" },
  entregue: { texto: "Entregue", tom: "neutro" },
  encerrada: { texto: "Fechado", tom: "ok" },
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

export const FORMA_PAGAMENTO: Record<FormaPagamento, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  debito: "Cartão de débito",
  credito: "Cartão de crédito",
  boleto: "Boleto",
  transferencia: "Transferência",
  seguradora: "Seguradora",
};

export const TIPO_PESSOA: Record<TipoPessoa, string> = { pf: "Pessoa física", pj: "Pessoa jurídica" };

export const TIPO_CUSTO_OS: Record<TipoCustoOS, string> = {
  insumo: "Insumo do estoque",
  mao_de_obra: "Mão de obra",
  terceiro: "Terceirizado",
  outro: "Outro custo",
};

export const TIPO_MOVIMENTO_ESTOQUE: Record<TipoMovimentoEstoque, string> = {
  entrada_compra: "Entrada (compra)",
  saida_os: "Retirada para OS",
  consumo_interno: "Consumo interno",
  ajuste: "Ajuste",
};

export const NIVEL_COMBUSTIVEL: Record<NivelCombustivel, string> = {
  reserva: "Reserva",
  "1/4": "1/4",
  "1/2": "1/2",
  "3/4": "3/4",
  cheio: "Cheio",
};

export const VISTA_AVARIA: Record<VistaAvaria, string> = {
  frente: "Frente",
  traseira: "Traseira",
  lateral_esquerda: "Lateral esquerda",
  lateral_direita: "Lateral direita",
  teto: "Teto",
};

export const TIPO_AVARIA: Record<TipoAvaria, string> = {
  amassado: "Amassado",
  risco: "Risco",
  pintura: "Pintura",
  vidro: "Vidro",
  outro: "Outro",
};

export const TAMANHO_AVARIA: Record<TamanhoAvaria, string> = { p: "Pequeno", m: "Médio", g: "Grande" };

/** Ações gravadas na auditoria (RegistroAuditoria.acao) → texto da tela de Auditoria. */
export const ACAO_AUDITORIA: Record<string, string> = {
  criar: "Criou",
  editar: "Editou",
  aprovar: "Aprovou",
  agendar: "Agendou",
  reagendar: "Reagendou",
  cancelar: "Cancelou",
  nao_compareceu: "Não compareceu",
  entrada: "Entrada",
  entrega: "Entrega",
  recepcao: "Recepção",
  baixa: "Recebimento",
  pagar: "Pagou",
  concluir: "Concluiu",
  atribuir: "Atribuiu",
  fechar_caixa: "Fechou o caixa",
  iniciada: "Iniciou etapa",
  "concluída": "Concluiu etapa",
  impedida: "Impedimento",
  retomada: "Retomou etapa",
  dispensada: "Dispensou etapa",
  lancar_custo: "Lançou custo",
  remover_custo: "Removeu custo",
  entrada_compra: "Entrada no estoque",
  consumo_interno: "Consumo interno",
  ajuste: "Ajuste de estoque",
  adicionar_foto: "Adicionou foto",
  remover_foto: "Removeu foto",
};

/** Rótulo da ação; ação desconhecida vira "Texto com espaços". */
export const rotuloAcao = (a: string): string => ACAO_AUDITORIA[a] ?? a.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

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
  valor_invalido: "Informe um valor maior que zero.",
  data_passada: "Essa data já passou. Escolha hoje ou um dia à frente.",
  dia_fechado: "A oficina não abre nesse dia ou período.",
  protocolo_duplicado: "Já existe um atendimento com esse protocolo nessa seguradora.",
  conflito_aberto: "Há uma divergência com a Maxpar a resolver antes.",
  pendencias_abertas: "Ainda há pendências abertas no portal.",
  etapa_nao_encontrada: "Etapa não encontrada. Atualize a tela.",
  sem_responsavel: "Defina quem vai fazer a etapa.",
  agendamento_nao_encontrado: "Agendamento não encontrado. Atualize a tela.",
  versao_nao_aprovada: "O orçamento ainda não foi aprovado.",
  sem_pagador: "Defina quem vai pagar.",
  // sprint SE: clientes, recepção, custos, estoque, caixa
  nome_obrigatorio: "Informe o nome.",
  descricao_obrigatoria: "Informe a descrição.",
  documento_invalido: "CPF ou CNPJ inválido. Confira os números.",
  documento_duplicado: "Já existe um cadastro com esse CPF ou CNPJ.",
  telefone_invalido: "Telefone inválido. Use DDD e número, como (41) 99999-0000.",
  email_invalido: "E-mail inválido.",
  cep_invalido: "CEP inválido. Use 8 números.",
  placa_duplicada: "Já existe um veículo com essa placa.",
  ano_invalido: "Ano do veículo inválido.",
  cliente_nao_encontrado: "Cliente não encontrado. Atualize a tela.",
  veiculo_nao_encontrado: "Veículo não encontrado. Atualize a tela.",
  os_nao_encontrada: "Ordem de serviço não encontrada. Atualize a tela.",
  km_invalido: "Quilometragem inválida.",
  posicao_invalida: "Marque a avaria dentro do desenho do carro.",
  checklist_invalido: "Cada item do checklist precisa de grupo e nome, sem repetir.",
  material_nao_encontrado: "Material não encontrado. Atualize a tela.",
  material_inativo: "Esse material está inativo e não pode sair do estoque.",
  material_divergente: "O movimento não é desse material.",
  saldo_insuficiente: "Quantidade maior que o saldo em estoque.",
  quantidade_invalida: "Informe uma quantidade maior que zero.",
  custo_obrigatorio: "Informe o custo unitário da compra.",
  sentido_obrigatorio: "Diga se o ajuste soma ou tira do estoque.",
  unidade_obrigatoria: "Informe a unidade (L, kg, un…).",
  tipo_invalido: "Tipo de movimentação inválido. A retirada para OS é feita na ficha da OS.",
  fornecedor_nao_encontrado: "Fornecedor não encontrado. Atualize a tela.",
  custo_nao_encontrado: "Custo não encontrado. Atualize a tela.",
  minutos_invalidos: "Informe os minutos trabalhados.",
  forma_invalida: "Escolha a forma de pagamento.",
  parcelas_invalidas: "Número de parcelas inválido.",
  despesa_nao_encontrada: "Despesa não encontrada. Atualize a tela.",
  categoria_invalida: "Escolha uma categoria de despesa válida.",
  categoria_duplicada: "Já existe uma categoria com esse nome.",
  caixa_ja_fechado: "O caixa deste dia já foi fechado. Lance com a data de hoje.",
  data_invalida: "Data inválida. Confira dia, mês e ano.",
  data_futura: "Essa data ainda não chegou. Use hoje ou um dia que já passou.",
  os_quitada: "Esta OS já está quitada.",
  os_fechada: "Esta OS já foi entregue, encerrada ou cancelada; a recepção não pode mais ser alterada.",
  // sprint SF: fotos reais, tipos de reparo e configuração editável
  arquivo_invalido: "Esse arquivo não é uma foto que o painel consiga abrir. Use JPG, PNG, WebP ou a câmera.",
  arquivo_grande: "Foto grande demais (acima de 25 MB). Tire de novo ou escolha outra.",
  fotos_temporarias: "Foto salva só nesta aba: o navegador não deixou guardar no aparelho (modo privado?). Ela some ao fechar.",
  foto_nao_encontrada: "Foto não encontrada. Atualize a tela.",
  foto_externa: "Foto da vistoria da Maxpar: não pode ser removida pelo painel.",
  foto_em_uso: "É a única foto que comprova uma etapa já concluída; não pode ser removida.",
  fase_invalida: "Escolha a fase da foto: entrada, durante ou final (foto de etapa: durante ou final).",
  nome_duplicado: "Já existe um tipo de reparo com esse nome.",
  sem_etapas: "Inclua ao menos uma etapa.",
  etapa_invalida: "Cada etapa precisa de nome (até 60 letras); no máximo 20 etapas.",
  ordem_invalida: "A ordem das etapas tem buraco ou repetição. Reorganize e salve de novo.",
  prazo_invalido: "Informe o prazo da etapa em horas, maior que zero (até 200 h).",
  tipo_nao_encontrado: "Tipo de reparo não encontrado. Atualize a tela.",
  expediente_invalido: "Expediente inválido: marque ao menos um dia e use início antes do fim (HH:MM).",
  nada_a_salvar: "Nada mudou para salvar.",
};

/**
 * Mensagem do valor_invalido de salvarConfig por campo (Resultado.campo), com os limites de LIMITES_CONFIG.
 * Uso: `ERRO_CAMPO_CONFIG[r.campo ?? ""] ?? mensagemErro(r.codigo)`.
 */
export const ERRO_CAMPO_CONFIG: Record<string, string> = {
  vagasEntrada: "Entradas por dia: um número inteiro de 1 a 30.",
  carrosSimultaneos: "Carros ao mesmo tempo: um número inteiro de 1 a 60.",
  pecasDia: "Peças por dia: um número inteiro de 1 a 200.",
  laranjaAntesHoras: "Laranja: um número inteiro de horas úteis, de 1 a 80.",
  laranjaPct: "Laranja: de 50 % a 95 % do prazo da etapa.",
  laranjaFracao: "Laranja: de 50 % a 95 % do prazo da etapa.",
  vermelhoBloqueioHoras: "Vermelho por impedimento: um número inteiro de horas úteis, de 1 a 80.",
  sabadoFim: "Fim do sábado: use HH:MM, depois do início do expediente.",
};

export type GrupoMenu = "operacao" | "dinheiro" | "gestao";

/** Grupos da barra lateral, na ordem (sprint SG: Operação · Dinheiro · Gestão). */
export const GRUPOS_MENU: { id: GrupoMenu; nome: string }[] = [
  { id: "operacao", nome: "Operação" },
  { id: "dinheiro", nome: "Dinheiro" },
  { id: "gestao", nome: "Gestão" },
];

/**
 * Itens do menu. Quais aparecem e em que ordem vem de `modulosDoMenu` (permissoes.ts); `nomePara` troca o nome
 * para um papel (a produção chama o quadro de "Quadro" e as vistorias de "Fotos"). Quadro da TV e Relatórios não
 * entram no menu (botão na Produção; aba do Financeiro).
 */
export const MENU: { modulo: Modulo; rota: string; nome: string; nomePara?: Partial<Record<Papel, string>>; icone: NomeIcone; grupo: GrupoMenu }[] = [
  { modulo: "minhas_tarefas", rota: "/producao/eu", nome: "Minhas tarefas", icone: "celular", grupo: "operacao" },
  { modulo: "geral", rota: "/geral", nome: "Geral", icone: "geral", grupo: "operacao" },
  { modulo: "orcamentos", rota: "/orcamentos", nome: "Orçamentos", icone: "orcamentos", grupo: "operacao" },
  { modulo: "agenda", rota: "/agenda", nome: "Agenda", icone: "agenda", grupo: "operacao" },
  { modulo: "producao", rota: "/producao", nome: "Produção", nomePara: { producao: "Quadro" }, icone: "producao", grupo: "operacao" },
  { modulo: "vistorias", rota: "/vistorias", nome: "Vistorias", nomePara: { producao: "Fotos" }, icone: "vistorias", grupo: "operacao" },
  { modulo: "clientes", rota: "/clientes", nome: "Clientes", icone: "pessoa", grupo: "operacao" },
  { modulo: "recebiveis", rota: "/recebiveis", nome: "A receber", icone: "recebiveis", grupo: "dinheiro" },
  { modulo: "financeiro", rota: "/financeiro", nome: "Financeiro", icone: "financeiro", grupo: "dinheiro" },
  { modulo: "funcionarios", rota: "/funcionarios", nome: "Equipe", icone: "funcionarios", grupo: "gestao" },
  { modulo: "estoque", rota: "/estoque", nome: "Estoque", icone: "estoque", grupo: "gestao" },
  { modulo: "ajustes", rota: "/ajustes", nome: "Ajustes", icone: "ajustes", grupo: "gestao" },
];

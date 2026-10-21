import type {
  CorCarro,
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
import type { SituacaoCartao } from "@compartilhado/dominio/semaforo";

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

/**
 * Pílula única do carro (situacaoCartao). "impedido" aparece como "Parado" — é como o dono chama (revisão SH).
 * O código continua "impedido"; só o rótulo de exibição mudou.
 */
export const SITUACAO_CARTAO: Record<SituacaoCartao, { texto: string; tom: Tom }> = {
  impedido: { texto: "Parado", tom: "alerta" },
  atrasado: { texto: "Atrasado", tom: "alerta" },
  atencao: { texto: "Atenção", tom: "atencao" },
  no_prazo: { texto: "No prazo", tom: "ok" },
  pronto: { texto: "Pronto", tom: "ok" },
};

/** Cor do carro (corDoCarro, pedido do dono, 2º áudio): nome para legenda, contagem e leitor de tela. */
export const COR_CARRO: Record<CorCarro, { texto: string; tom: Tom }> = {
  verde: { texto: "No prazo", tom: "ok" },
  laranja: { texto: "Atenção", tom: "atencao" },
  vermelho: { texto: "Sem etapa concluída", tom: "alerta" },
  vermelho_piscando: { texto: "Atrasado", tom: "alerta" },
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
  bloqueada: { texto: "Parada", tom: "alerta" },
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
  gestor: "Gerente",
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
  // sprint S1: equipe e folha
  remover: "Removeu",
  criar_login: "Deu login",
  trocar_senha: "Redefiniu a senha",
  tirar_login: "Tirou o login",
  ajuste_folha: "Ajuste na folha",
  pagar_folha: "Pagou a folha",
  // sprint S1: nomes gravados pelas funções do banco (Supabase)
  iniciar_etapa: "Iniciou etapa",
  concluir_etapa: "Concluiu etapa",
  bloquear_etapa: "Impedimento",
  retomar_etapa: "Retomou etapa",
  dispensar_etapa: "Dispensou etapa",
  alerta: "Alerta do carro",
  primeiro_dono: "Primeiro dono",
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
  // = COMPRESSAO_FOTO.maxBytesSalva (limite do bucket "fotos")
  foto_acima_limite: "A foto passou de 2 MB mesmo depois de reduzida no aparelho, e o servidor não aceita. Tire de novo ou escolha outra.",
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
  tipo_em_uso: "Há carro em aberto com essa categoria. Arquive depois que ele for entregue.",
  expediente_invalido: "Expediente inválido: marque ao menos um dia e use início antes do fim (HH:MM).",
  nada_a_salvar: "Nada mudou para salvar.",
  // sprint S1: equipe, login, comissões e folha
  sem_permissao: "O seu papel não pode fazer isso. Fale com o dono da oficina.",
  perfil_inexistente: "Funcionário não encontrado. Atualize a tela.",
  papel_invalido: "Escolha a permissão.",
  salario_invalido: "Salário inválido. Use o valor do mês em reais, como 2.800,00.",
  ultimo_dono: "A oficina precisa de ao menos um dono ativo. Dê a permissão de dono a outra pessoa antes.",
  usuario_obrigatorio: "Informe o usuário.",
  usuario_curto: "O usuário precisa de ao menos 3 letras ou números.",
  usuario_longo: "O usuário pode ter no máximo 30 caracteres.",
  usuario_invalido: "Use só letras sem acento, números, ponto, hífen ou sublinhado (começando e terminando com letra ou número).",
  usuario_em_uso: "Esse usuário já é de outra pessoa da oficina. Escolha outro.",
  senha_curta: "A senha precisa de ao menos 8 caracteres.",
  senha_longa: "Senha longa demais: o limite é 72 bytes (cada letra com acento conta 2, emoji conta 4). Encurte a senha.",
  proprio_login: "Você não pode tirar o seu próprio login.",
  alvo_obrigatorio: "Escolha a etapa ou o tipo de serviço que paga a comissão.",
  regra_duplicada: "Já existe uma comissão ligada para essa etapa e esse tipo de serviço. Edite a que existe.",
  regra_nao_encontrada: "Comissão não encontrada. Atualize a tela.",
  ajuste_invalido: "Ajuste inválido. Use reais, com sinal de menos para desconto, como -150,00.",
  total_invalido: "O desconto passa do valor a receber; o total do mês não pode ficar negativo.",
  ja_pago: "Isso já foi pago (folha do mês ou despesa já quitada)."
  config_invalida: "Configuração inválida: confira os dias e horários do expediente, o semáforo e a capacidade.",
  fora_da_folha: "Essa pessoa não entra na folha desse mês.",
  // sprint S1: banco real (Supabase), login e Edge Function equipe-login
  origem_invalida: "Escolha a origem do atendimento (Maxpar, seguradora direta, particular ou misto).",
  pendencia_nao_encontrada: "Pendência não encontrada. Atualize a tela.",
  saldo_so_por_movimento: "O saldo e o custo do material só mudam por movimentação de estoque.",
  registro_imutavel: "Esse registro não pode ser alterado depois de gravado. Faça um lançamento de correção.",
  registro_relacionado: "Um cadastro ligado a este não existe mais. Atualize a tela.",
  erro_desconhecido: "Não foi possível concluir a ação. Tente de novo.",
  sem_conexao: "Sem conexão com o servidor. Confira a internet e tente de novo.",
  sem_sessao: "A sua sessão terminou. Entre de novo.",
  config_nao_encontrada: "A configuração da oficina não foi encontrada no banco. Fale com quem cuida do sistema.",
  falha_auth: "O servidor de login recusou a mudança. Tente de novo em instantes.",
  falha_banco: "O banco recusou a mudança. Tente de novo em instantes.",
  acao_invalida: "Ação de login desconhecida. Atualize a página.",
  pedido_invalido: "Pedido inválido. Atualize a página e tente de novo.",
  metodo_invalido: "Pedido inválido. Atualize a página e tente de novo.",
  login_indisponivel: "O serviço que cria os logins da equipe ainda não está ativo no servidor. Fale com quem cuida do sistema.",
  login_nao_sincronizado: "Cadastro salvo, mas o login não foi atualizado no servidor. Abra a pessoa e salve de novo.",
  falha_envio_foto: "Não consegui enviar a foto. Confira a internet e tente de novo.",
  so_na_demonstracao: "Restaurar só existe na demonstração; o banco da oficina não é apagado pelo painel.",
  // tela de entrada (login)
  login_invalido: "Usuário ou senha incorretos.",
  login_bloqueado: "Esse login está desativado. Fale com o dono da oficina.",
  muitas_tentativas: "Muitas tentativas seguidas. Espere um minuto e tente de novo.",
  usuario_ou_email_invalido: "Digite o seu usuário (como diego) ou o seu e-mail.",
  senha_obrigatoria: "Digite a senha.",
};

/** Mensagem do valor da comissão (0 é válido: zera a regra geral para um caso). */
export const ERRO_VALOR_COMISSAO = "Valor da comissão: de R$ 0,00 a R$ 100.000,00 por etapa.";

/**
 * O que cada permissão vê no painel (Equipe → Editar), na voz do dono. Fonte: matriz de permissoes.ts (S1).
 * A TV ("dispositivo") não aparece: é aparelho, não pessoa.
 */
export const PERMISSAO_RESUMO: Record<Exclude<Papel, "dispositivo">, string> = {
  dono: "Tudo, inclusive o dinheiro, a folha e quem tem login.",
  gestor: "Quase tudo: carros, agenda, produção, equipe e estoque. Não vê o dinheiro (A receber, Financeiro, folha, custos).",
  recepcao: "Orçamentos, agenda, clientes e o quadro da produção.",
  producao: "As próprias tarefas no celular e o quadro da produção, sem valores nem telefone.",
  financeiro: "A receber, Financeiro, caixa, folha, relatórios e custos. Não mexe na produção.",
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
  vermelhoBloqueioHoras: "Vermelho quando parado: um número inteiro de horas úteis, de 1 a 80.",
  sabadoFim: "Fim do sábado: use HH:MM, depois do início do expediente.",
  // alerta do carro (Ajustes e ajuste por carro, salvarAlertaOS)
  laranjaDiasAntes: "Laranja: um número inteiro de dias úteis antes da entrega, de 0 a 60.",
  vermelhoSemEtapaDiasAntes: "Vermelho sem etapa concluída: um número inteiro de dias úteis antes da entrega, de 0 a 60.",
  prazoDiasUteis: "Prazo: um número inteiro de dias úteis, de 0 a 60.",
  prazoPadraoDiasUteis: "Prazo padrão: um número inteiro de dias úteis, de 1 a 60.",
  piscarAtrasado: "Piscar atrasado: ligado ou desligado.",
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
  { modulo: "equipe", rota: "/equipe", nome: "Equipe", icone: "funcionarios", grupo: "gestao" },
  { modulo: "estoque", rota: "/estoque", nome: "Estoque", icone: "estoque", grupo: "gestao" },
  { modulo: "ajustes", rota: "/ajustes", nome: "Ajustes", icone: "ajustes", grupo: "gestao" },
];

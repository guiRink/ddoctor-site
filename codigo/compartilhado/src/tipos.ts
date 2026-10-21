// Modelo de dados v2 do painel D doctor — espelha docs/painel-arquitetura.md §6.
// Fonte única dos enums e interfaces usados pelo painel (e, a partir do S5, pelo worker).
// Convenção: camelCase aqui; o RepositorioSupabase (S1) traduz para as colunas snake_case do banco.
// Datas de negócio em "AAAA-MM-DD"; marcos em ISO 8601 com fuso; dinheiro em CENTAVOS (inteiro).

export type Id = string;
export type DataISO = string; // AAAA-MM-DD
export type MarcoISO = string; // 2026-10-12T14:30:00-03:00
export type Centavos = number;

// ---------------------------------------------------------------- papéis

export const PAPEIS = ["dono", "gestor", "recepcao", "producao", "financeiro", "dispositivo"] as const;
export type Papel = (typeof PAPEIS)[number];

export interface Perfil {
  id: Id;
  nome: string;
  papel: Papel;
  funcao?: string; // ex.: "Funileiro", "Pintor"
  especialidade?: string;
  ativo: boolean;
  usaTerminal: boolean;
}

// ---------------------------------------------------------------- proveniência

export type Fonte = "maxpar_portal" | "maxpar_arquivo" | "manual" | "api";

export interface ProvenienciaCampo {
  fonte: Fonte;
  lidoEm?: MarcoISO;
  validadoPor?: Id;
  validadoEm?: MarcoISO;
}

// ---------------------------------------------------------------- cliente e veículo

export const TIPOS_PESSOA = ["pf", "pj"] as const;
export type TipoPessoa = (typeof TIPOS_PESSOA)[number];

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;
export type UF = (typeof UFS)[number];

export interface Endereco {
  cep: string; // 8 dígitos, sem máscara
  logradouro: string;
  numero: string; // texto: "s/n", "120A"
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: UF | (string & {});
}

export interface Cliente {
  id: Id;
  nome: string;
  tipoPessoa?: TipoPessoa;
  /** CPF (11) ou CNPJ (14) normalizado: só dígitos (CNPJ alfanumérico: dígitos e letras maiúsculas). */
  documento?: string;
  telefone?: string; // E.164 sem formatação: +5541999990000
  whatsapp?: string; // E.164 sem formatação
  email?: string;
  endereco?: Endereco;
  observacoes?: string;
  proveniencia?: Record<string, ProvenienciaCampo>;
  /**
   * Cadastro de DEMONSTRAÇÃO (seed/repositório em memória). Os telefones têm formato real mas são
   * inventados: a UI não gera link wa.me/tel: para cliente demo (pode cair num número de verdade).
   */
  demo?: boolean;
}

export interface Veiculo {
  id: Id;
  clienteId?: Id;
  placa: string; // normalizada, 7 caracteres
  marca?: string;
  modelo?: string;
  cor?: string;
  ano?: number;
  proveniencia?: Record<string, ProvenienciaCampo>;
}

// ---------------------------------------------------------------- atendimento externo (Maxpar / seguradora)

export const STATUS_EXTERNO = [
  "aguardando_autorizacao",
  "autorizado",
  "parcialmente_autorizado",
  "negado",
  "aguardando_peca",
  "servico_realizado",
  "pago",
  "cancelado",
  "desconhecido",
] as const;
export type StatusExterno = (typeof STATUS_EXTERNO)[number];

export interface AtendimentoExterno {
  id: Id;
  fonte: Fonte;
  seguradora: string;
  idExterno?: string; // protocolo
  numeroSinistro?: string;
  produto?: string;
  statusBruto?: string;
  statusNormalizado: StatusExterno;
  aberturaEm?: DataISO;
  limiteVistoriaEm?: DataISO;
  previsaoPortal?: DataISO;
  lidoEm?: MarcoISO;
  estadoConciliacao: "ok" | "pendente" | "conflito";
}

// ---------------------------------------------------------------- OS

export const ESTADOS_OS = [
  "rascunho",
  "aguardando_aprovacao",
  "aguardando_agendamento",
  "agendada",
  "na_oficina",
  "pronta",
  "entregue",
  "encerrada",
  "cancelada",
] as const;
export type EstadoOS = (typeof ESTADOS_OS)[number];

export const ORIGENS_OS = ["maxpar", "seguradora_direta", "particular", "misto"] as const;
export type OrigemOS = (typeof ORIGENS_OS)[number];

export interface OS {
  id: Id;
  numero: number; // sequencial legível por oficina
  veiculoId: Id;
  clienteId: Id;
  tipoReparoId?: Id;
  origem: OrigemOS;
  estado: EstadoOS;
  prioridade: 0 | 1 | 2; // 0 normal, 1 alta, 2 urgente
  atendimentosExternos: Id[];
  previsaoEntrega?: DataISO;
  entradaRealEm?: MarcoISO;
  prontaEm?: MarcoISO;
  entregueEm?: MarcoISO;
  box?: string;
  observacoes?: string;
  /** Recepção do veículo na entrada (km, combustível, checklist, mapa de avarias). */
  recepcao?: RecepcaoVeiculo;
  /**
   * Alerta próprio deste carro (pedido do dono, 2º áudio, revisão SH): ausente = base de config.alertaCarro.
   * prazoDiasUteis só registra o prazo combinado; a entrega prometida (previsaoEntrega) é recalculada ao salvar.
   */
  alerta?: AlertaOS;
  criadoEm: MarcoISO;
  atualizadoEm: MarcoISO;
  demo?: boolean;
}

/** Ajuste do alerta por carro (corDoCarro): cada campo presente vence a base da configuração. */
export interface AlertaOS {
  /** Prazo combinado em dias úteis, contado da entrada (ex.: 10). */
  prazoDiasUteis?: number;
  /** Fica laranja a partir de N dias úteis antes da entrega (com etapa concluída). */
  laranjaDiasAntes?: number;
  /** Fica vermelho a partir de N dias úteis antes da entrega se nenhuma etapa foi concluída. */
  vermelhoSemEtapaDiasAntes?: number;
}

/** Cor do carro no painel e na TV (pedido do dono, 2º áudio). Ordem de gravidade: verde < laranja < vermelho < vermelho_piscando. */
export const CORES_CARRO = ["verde", "laranja", "vermelho", "vermelho_piscando"] as const;
export type CorCarro = (typeof CORES_CARRO)[number];

// ---------------------------------------------------------------- recepção do veículo

export const NIVEIS_COMBUSTIVEL = ["reserva", "1/4", "1/2", "3/4", "cheio"] as const;
export type NivelCombustivel = (typeof NIVEIS_COMBUSTIVEL)[number];

export const VISTAS_AVARIA = ["frente", "traseira", "lateral_esquerda", "lateral_direita", "teto"] as const;
export type VistaAvaria = (typeof VISTAS_AVARIA)[number];

export const TIPOS_AVARIA = ["amassado", "risco", "pintura", "vidro", "outro"] as const;
export type TipoAvaria = (typeof TIPOS_AVARIA)[number];

export const TAMANHOS_AVARIA = ["p", "m", "g"] as const;
export type TamanhoAvaria = (typeof TAMANHOS_AVARIA)[number];

export interface Avaria {
  id: Id;
  vista: VistaAvaria;
  x: number; // 0..1 na largura do desenho
  y: number; // 0..1 na altura do desenho
  tipo: TipoAvaria;
  tamanho: TamanhoAvaria;
  obs?: string;
}

/** Item do checklist de entrada (cadastro em Ajustes; padrão em CHECKLIST_PADRAO, provisório). */
export interface ChecklistItem {
  id: Id;
  grupo: string;
  nome: string;
  ativo: boolean;
}

export interface RecepcaoVeiculo {
  km?: number;
  combustivel?: NivelCombustivel;
  reclamacao?: string; // relato do cliente
  obsInternas?: string; // não sai na impressão para o cliente
  checklist: Record<string, boolean>; // id do ChecklistItem → marcado
  avarias: Avaria[];
  /** Primeira gravação da recepção; não muda depois (carimbarRecepcao). */
  registradaEm?: MarcoISO;
  registradaPor?: Id;
  /** Última regravação (ausente se nunca foi editada). */
  atualizadaEm?: MarcoISO;
  atualizadaPor?: Id;
}

// ---------------------------------------------------------------- custos da OS

export const TIPOS_CUSTO_OS = ["insumo", "mao_de_obra", "terceiro", "outro"] as const;
export type TipoCustoOS = (typeof TIPOS_CUSTO_OS)[number];

export interface CustoOS {
  id: Id;
  osId: Id;
  tipo: TipoCustoOS;
  descricao: string;
  quantidade: number;
  unidade?: string;
  custoUnitario: Centavos;
  total: Centavos; // quantidade × custoUnitario, arredondado ao centavo (ou custoMaoDeObra)
  materialId?: Id; // insumo retirado do estoque
  perfilId?: Id; // funcionário que retirou ou apontou
  minutos?: number; // mão de obra
  fornecedor?: string; // terceirização
  lancadoEm: MarcoISO;
  lancadoPor?: Id;
}

// ---------------------------------------------------------------- orçamento

export const TECNICAS = ["sra", "martelinho", "pintura", "funilaria", "polimento", "outro"] as const;
export type Tecnica = (typeof TECNICAS)[number];

export const ESTADOS_VERSAO = ["rascunho", "enviado", "aprovado", "recusado", "substituido"] as const;
export type EstadoVersao = (typeof ESTADOS_VERSAO)[number];

export const STATUS_ITEM = ["solicitado", "autorizado", "negado", "reanalise", "dispensado"] as const;
export type StatusItem = (typeof STATUS_ITEM)[number];

export interface ItemOrcamento {
  id: Id;
  peca: string;
  tecnica: Tecnica;
  descricao?: string;
  valor: Centavos;
  statusItem: StatusItem;
}

export interface OrcamentoVersao {
  id: Id;
  osId: Id;
  tipo: "externo" | "interno";
  numeroVersao: number;
  fonte: Fonte;
  estado: EstadoVersao;
  itens: ItemOrcamento[];
  tetoCobertura?: Centavos;
  franquia?: Centavos;
  complementoParticular?: Centavos;
  criadoEm: MarcoISO;
  aprovacao?: {
    tipo: "externa" | "interna" | "cliente";
    aprovadoEm: MarcoISO;
    evidencia?: string;
    confiavel: boolean;
  };
}

// ---------------------------------------------------------------- produção

export const ESTADOS_ETAPA = ["aguardando", "na_fila", "em_execucao", "bloqueada", "concluida", "dispensada"] as const;
export type EstadoEtapa = (typeof ESTADOS_ETAPA)[number];

export interface ModeloEtapaItem {
  ordem: number;
  nome: string;
  prazoPadraoHoras: number;
  dispensavel: boolean;
  exigeFoto: boolean;
  exigeContagemPecas: boolean;
}

export interface TipoReparo {
  id: Id;
  nome: string;
  etapas: ModeloEtapaItem[];
  provisorio: boolean; // true enquanto o dono não confirmar (questionário 1.1)
  /** false = arquivada: some da escolha do serviço; as OS antigas continuam mostrando o nome. Ausente = ativa. */
  ativo?: boolean;
}

export interface Bloqueio {
  inicioEm: MarcoISO;
  fimEm?: MarcoISO;
  motivo: string;
}

export interface EtapaOS {
  id: Id;
  osId: Id;
  ordem: number;
  nome: string;
  estado: EstadoEtapa;
  responsavelId?: Id;
  prazoHoras: number;
  prazoEm?: MarcoISO;
  entrouFilaEm?: MarcoISO;
  iniciadaEm?: MarcoISO;
  concluidaEm?: MarcoISO;
  pecasPrevistas?: number;
  pecasFeitas?: number;
  motivoDispensa?: string;
  exigeFoto: boolean;
  // Acrescentado pelo dominio-regras: copiado do ModeloEtapaItem para que concluirEtapa exija a contagem.
  exigeContagemPecas?: boolean;
  bloqueios: Bloqueio[];
}

// ---------------------------------------------------------------- agenda

export const ESTADOS_AGENDAMENTO = [
  "pendente",
  "contatando",
  "proposto",
  "confirmado",
  "cancelado",
  "nao_compareceu",
  "realizado",
] as const;
export type EstadoAgendamento = (typeof ESTADOS_AGENDAMENTO)[number];

export type Janela = "manha" | "tarde";

export interface Agendamento {
  id: Id;
  osId: Id;
  data: DataISO;
  janela: Janela;
  estado: EstadoAgendamento;
  origem: "recepcao" | "calia" | "cliente";
  expiraEm?: MarcoISO;
  substituiId?: Id;
  motivoCancelamento?: string;
}

export interface CapacidadeDia {
  data: DataISO;
  vagasEntrada: number;
  bloqueado?: string; // motivo, se o dia está bloqueado
}

// ---------------------------------------------------------------- vistorias e fotos

export type FaseVistoria = "entrada" | "durante" | "final" | "externa";

export interface Foto {
  id: Id;
  osId: Id;
  fase: FaseVistoria;
  /** Etapa da produção que a foto comprova ("durante"/"final"); concluirEtapa exige uma se a etapa pede foto. */
  etapaId?: Id;
  legenda?: string;
  /** Imagem comprimida (~1600 px, ~200 KB). Demo antigo: imagem pública; memória: blob: URL; S1/S3: URL assinada (R2). */
  url: string;
  /** Miniatura (~320 px, ~20 KB) para listas e galerias; ausente = use `url`. */
  miniaturaUrl?: string;
  bytes?: number; // tamanho da imagem comprimida
  largura?: number; // px
  altura?: number; // px
  autorId?: Id;
  origem: "interna" | "maxpar";
  tiradaEm: MarcoISO;
  /** Quando a foto será apagada pela retenção (L28: entrega + 12 meses). Calculado na leitura. */
  expiraEm?: DataISO;
  /** true enquanto a OS não foi entregue: expiraEm é estimativa (previsão de entrega ou data da foto + 12 meses). */
  expiraProvisorio?: boolean;
}

// ---------------------------------------------------------------- pendências externas (ações no portal)

export const TIPOS_PENDENCIA = [
  "encerrar_portal",
  "enviar_documentacao",
  "reenviar_documentacao",
  "solicitar_reanalise",
  "atualizar_previsao",
  "outro",
] as const;
export type TipoPendencia = (typeof TIPOS_PENDENCIA)[number];

export interface PendenciaExterna {
  id: Id;
  osId: Id;
  tipo: TipoPendencia;
  descricao: string;
  estado: "aberta" | "em_andamento" | "concluida" | "cancelada";
  responsavelId?: Id;
  criadaEm: MarcoISO;
  concluidaEm?: MarcoISO;
}

// ---------------------------------------------------------------- financeiro

export interface Pagador {
  id: Id;
  nome: string;
  tipo: "seguradora" | "maxpar" | "cliente" | "outro";
  prazo: { dias: number; base: "nf" | "entrega" | "servico_realizado"; diasUteis: boolean; provisorio: boolean };
  // Acrescentado pelo dominio-regras: o título de mão de obra sai líquido da franquia (paga pelo cliente na oficina)?
  // Ausente = true (provisório, a confirmar com o dono).
  descontaFranquia?: boolean;
}

export const ESTADOS_TITULO = ["previsto", "emitido", "parcial", "recebido", "cancelado"] as const;
export type EstadoTitulo = (typeof ESTADOS_TITULO)[number];

export const FORMAS_PAGAMENTO = ["pix", "dinheiro", "debito", "credito", "boleto", "transferencia", "seguradora"] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

export interface Baixa {
  id: Id;
  valor: Centavos;
  recebidoEm: DataISO;
  /** Uma de FORMAS_PAGAMENTO; texto livre antigo ("Pix", "Transferência") continua aceito — use normalizarFormaPagamento. */
  forma: FormaPagamento | (string & {});
  parcelas?: number; // crédito parcelado
  obs?: string;
}

export interface TituloReceber {
  id: Id;
  osId: Id;
  pagadorId: Id;
  descricao: string;
  valor: Centavos;
  nfNumero?: string;
  nfEmitidaEm?: DataISO;
  vencimento: DataISO;
  estado: EstadoTitulo;
  baixas: Baixa[];
}

export interface CategoriaFinanceira {
  id: Id;
  nome: string;
  tipo: "receita" | "despesa";
  ativa: boolean;
}

export interface Despesa {
  id: Id;
  categoria: string; // nome (compatibilidade); prefira categoriaId
  categoriaId?: Id;
  descricao: string;
  fornecedor?: string;
  valorPrevisto: Centavos;
  vencimento: DataISO;
  pagoEm?: DataISO;
  valorPago?: Centavos;
  formaPagamento?: FormaPagamento;
  obs?: string;
}

export interface FechamentoCaixa {
  id: Id;
  data: DataISO;
  saldoInicial: Centavos;
  contado: Centavos;
  entradasDinheiro: Centavos;
  saidasDinheiro: Centavos;
  esperado: Centavos; // saldoInicial + entradas − saídas (só dinheiro)
  diferenca: Centavos; // contado − esperado (negativo = falta)
  obs?: string;
  fechadoPor?: Id;
  fechadoEm: MarcoISO;
}

// ---------------------------------------------------------------- estoque

export interface Fornecedor {
  id: Id;
  nome: string;
  documento?: string; // só dígitos
  telefone?: string;
  email?: string;
  obs?: string;
  /** Fornecedor de DEMONSTRAÇÃO: telefone inventado; a UI não gera link tel:/wa.me para ele. */
  demo?: boolean;
}

export interface Material {
  id: Id;
  nome: string;
  codigo?: string;
  marca?: string;
  categoria: string;
  unidade: string;
  saldoEstimado: number;
  saldoMinimo: number;
  ultimaConferenciaEm?: DataISO;
  custoMedio: Centavos;
  fornecedorId?: Id;
  ativo?: boolean; // ausente = ativo
}

export const TIPOS_MOVIMENTO_ESTOQUE = ["entrada_compra", "saida_os", "consumo_interno", "ajuste"] as const;
export type TipoMovimentoEstoque = (typeof TIPOS_MOVIMENTO_ESTOQUE)[number];

export interface MovimentoEstoque {
  id: Id;
  materialId: Id;
  tipo: TipoMovimentoEstoque;
  quantidade: number; // sempre positiva; o sentido vem do tipo (ajuste: campo `sentido`)
  /** Só em "ajuste": soma ("mais") ou subtrai ("menos") do saldo. */
  sentido?: "mais" | "menos";
  custoUnitario?: Centavos; // obrigatório em entrada_compra
  osId?: Id;
  perfilId?: Id; // quem retirou
  fornecedorId?: Id;
  obs?: string; // motivo, obrigatório em ajuste
  em: MarcoISO;
}

// ---------------------------------------------------------------- auditoria

export interface RegistroAuditoria {
  id: Id;
  em: MarcoISO;
  perfilId?: Id;
  acao: string; // ex.: "criar", "editar", "baixa", "ajuste_prazo"
  entidade: string; // ex.: "os", "titulo_receber", "material"
  entidadeId?: Id;
  resumo: string; // frase legível: "Baixa de R$ 300,00 no título #12"
}

// ---------------------------------------------------------------- configuração

export interface ConfigOficina {
  expediente: { diasSemana: number[]; inicio: string; fim: string; sabadoFim?: string }; // diasSemana: 0=dom … 6=sáb
  semaforo: {
    /** Legado (antes do SG): laranja a N h úteis do prazo. Só vale para etapa sem prazoHoras (> 0). */
    laranjaAntesHoras: number;
    vermelhoBloqueioHoras: number;
    /**
     * Fração do prazo da etapa já consumida a partir da qual o cartão fica laranja (0–1).
     * Ausente = LARANJA_FRACAO_PADRAO (0,8; provisório, a confirmar com o dono). Revisão SG, item 3.
     */
    laranjaFracao?: number;
  };
  capacidadePadrao: { vagasEntrada: number; carrosSimultaneos: number; pecasDia?: number };
  /**
   * Base da cor do carro (corDoCarro, pedido do dono, 2º áudio). Ausente = ALERTA_CARRO_PADRAO (provisório).
   * Cada carro pode ter o seu (OS.alerta).
   */
  alertaCarro?: AlertaCarroConfig;
  /** Itens do checklist de entrada; ausente = CHECKLIST_PADRAO (provisório). */
  checklist?: ChecklistItem[];
  /** Geral: true enquanto há valor não confirmado pelo dono. Por campo, veja `confirmado` (campoConfigProvisorio). */
  provisorio: boolean;
  /** Campos que o dono já confirmou em Ajustes (salvarConfig); ausente = segue o `provisorio` geral. */
  confirmado?: Partial<Record<CampoConfig, boolean>>;
}

export interface AlertaCarroConfig {
  /** Laranja a partir de N dias úteis antes da entrega (0 = só no dia). */
  laranjaDiasAntes: number;
  /** Vermelho a partir de N dias úteis antes da entrega quando nenhuma etapa foi concluída. */
  vermelhoSemEtapaDiasAntes: number;
  /** Atrasado (passou da entrega) pisca no painel e na TV. */
  piscarAtrasado: boolean;
  /** Prazo sugerido em dias úteis ao ajustar um carro (só sugestão de formulário; não inventa entrega). */
  prazoPadraoDiasUteis?: number;
}

/** Campos da configuração que o dono confirma um a um (cada um sai do "provisório — a confirmar" ao salvar). */
export const CAMPOS_CONFIG = ["vagasEntrada", "carrosSimultaneos", "pecasDia", "expediente", "semaforo", "alertaCarro"] as const;
export type CampoConfig = (typeof CAMPOS_CONFIG)[number];

export type Semaforo = "verde" | "laranja" | "vermelho" | "neutro";

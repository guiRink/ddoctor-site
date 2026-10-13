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

export interface Cliente {
  id: Id;
  nome: string;
  telefone?: string; // E.164 sem formatação: +5541999990000
  email?: string;
  proveniencia?: Record<string, ProvenienciaCampo>;
}

export interface Veiculo {
  id: Id;
  clienteId?: Id;
  placa: string; // normalizada, 7 caracteres
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
  criadoEm: MarcoISO;
  atualizadoEm: MarcoISO;
  demo?: boolean;
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
  legenda?: string;
  url: string; // no demo, imagem pública; no S3, URL assinada do Storage privado
  autorId?: Id;
  origem: "interna" | "maxpar";
  tiradaEm: MarcoISO;
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

export interface Baixa {
  id: Id;
  valor: Centavos;
  recebidoEm: DataISO;
  forma: string;
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

export interface Despesa {
  id: Id;
  categoria: string;
  descricao: string;
  fornecedor?: string;
  valorPrevisto: Centavos;
  vencimento: DataISO;
  pagoEm?: DataISO;
  valorPago?: Centavos;
}

export interface Material {
  id: Id;
  nome: string;
  categoria: string;
  unidade: string;
  saldoEstimado: number;
  saldoMinimo: number;
  ultimaConferenciaEm?: DataISO;
  custoMedio: Centavos;
}

// ---------------------------------------------------------------- configuração

export interface ConfigOficina {
  expediente: { diasSemana: number[]; inicio: string; fim: string; sabadoFim?: string }; // diasSemana: 0=dom … 6=sáb
  semaforo: { laranjaAntesHoras: number; vermelhoBloqueioHoras: number };
  capacidadePadrao: { vagasEntrada: number; carrosSimultaneos: number };
  provisorio: boolean;
}

export type Semaforo = "verde" | "laranja" | "vermelho" | "neutro";

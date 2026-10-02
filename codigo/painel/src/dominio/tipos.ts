// Modelo de dados v1 — ver docs/painel-plano.md §4.

export const ORIGENS = ["maxpar", "seguradora_direta", "particular"] as const;
export type Origem = (typeof ORIGENS)[number];

export const ETAPAS = [
  "aguardando_autorizacao",
  "autorizado",
  "aguardando_peca",
  "agendado",
  "no_patio",
  "pronto",
  "entregue",
  "documentacao_enviada",
  "pago",
] as const;
export type Etapa = (typeof ETAPAS)[number];

export const SUB_ETAPAS = [
  "desmontagem",
  "martelinho",
  "funilaria",
  "preparacao",
  "pintura",
  "montagem",
  "polimento",
] as const;
export type SubEtapaProducao = (typeof SUB_ETAPAS)[number];

export const TECNICAS = ["sra", "martelinho", "pintura", "funilaria"] as const;
export type Tecnica = (typeof TECNICAS)[number];

export interface Peca {
  id: string;
  nome: string;
  tecnica: Tecnica;
  solicitada: boolean;
  /** null = ainda sem resposta da Maxpar/seguradora */
  autorizada: boolean | null;
  valorAutorizado?: number;
  observacao?: string;
}

export interface Recusa {
  data: string;
  motivo: string;
}

export interface Contato {
  data: string;
  canal: "whatsapp" | "telefone" | "chat_portal" | "email" | "outro";
  quem: string;
  resumo: string;
  protocolo?: string;
}

export interface Documentacao {
  fotosAntes: boolean;
  fotosDepois: boolean;
  pdfOrdem: boolean;
  assinatura: boolean;
  nf: boolean;
  enviadaEm?: string;
  recusas: Recusa[];
  pagoEm?: string;
  valorPago?: number;
}

export interface Atendimento {
  id: string;
  /** número do atendimento/protocolo na Maxpar ou na seguradora */
  protocolo?: string;
  origem: Origem;
  seguradora?: string;
  produto?: string;
  placa: string;
  modelo?: string;
  cor?: string;
  cliente: { nome: string; telefone?: string };
  corretor?: string;
  /** datas em ISO (AAAA-MM-DD) */
  abertura: string;
  limiteVistoria?: string;
  pecas: Peca[];
  franquia: { valor?: number; paga: boolean; forma?: string };
  complemento?: number;
  etapa: Etapa;
  subEtapa?: SubEtapaProducao;
  box?: string;
  responsavel?: string;
  previsaoCliente?: string;
  previsaoPortal?: string;
  entregueEm?: string;
  documentacao: Documentacao;
  financeiro: { aReceberMaxpar?: number; custoMaterial?: number; comissao?: number };
  contatos: Contato[];
  observacoes?: string;
  /** quando a etapa atual começou (ISO) */
  etapaDesde: string;
  demo?: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export type Pendencia =
  | "sem_autorizacao"
  | "vistoria_vencendo"
  | "entrega_atrasada"
  | "documentacao_recusada"
  | "pagamento_atrasado";

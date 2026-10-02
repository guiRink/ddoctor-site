import type { Contato, Etapa, Origem, Pendencia, SubEtapaProducao, Tecnica } from "./tipos";

export const ROTULO_ETAPA: Record<Etapa, string> = {
  aguardando_autorizacao: "Aguardando autorização",
  autorizado: "Autorizado",
  aguardando_peca: "Aguardando peça",
  agendado: "Agendado",
  no_patio: "No pátio",
  pronto: "Pronto",
  entregue: "Entregue",
  documentacao_enviada: "Documentação enviada",
  pago: "Pago",
};

export const ROTULO_ETAPA_CURTO: Record<Etapa, string> = {
  aguardando_autorizacao: "Aguard. autorização",
  autorizado: "Autorizado",
  aguardando_peca: "Aguard. peça",
  agendado: "Agendado",
  no_patio: "No pátio",
  pronto: "Pronto",
  entregue: "Entregue",
  documentacao_enviada: "Doc. enviada",
  pago: "Pago",
};

export const ROTULO_SUB_ETAPA: Record<SubEtapaProducao, string> = {
  desmontagem: "Desmontagem",
  martelinho: "Martelinho",
  funilaria: "Funilaria",
  preparacao: "Preparação",
  pintura: "Pintura",
  montagem: "Montagem",
  polimento: "Polimento",
};

export const ROTULO_ORIGEM: Record<Origem, string> = {
  maxpar: "Maxpar",
  seguradora_direta: "Seguradora direta",
  particular: "Particular",
};

export const ROTULO_TECNICA: Record<Tecnica, string> = {
  sra: "SRA (arranhões)",
  martelinho: "Martelinho",
  pintura: "Pintura",
  funilaria: "Funilaria",
};

export const ROTULO_PENDENCIA: Record<Pendencia, string> = {
  sem_autorizacao: "Sem autorização",
  vistoria_vencendo: "Vistoria vencendo",
  entrega_atrasada: "Entrega atrasada",
  documentacao_recusada: "Documentação recusada",
  pagamento_atrasado: "Pagamento atrasado",
};

export const ROTULO_CANAL: Record<Contato["canal"], string> = {
  whatsapp: "WhatsApp",
  telefone: "Telefone",
  chat_portal: "Chat do portal",
  email: "E-mail",
  outro: "Outro",
};

export const MENU = [
  { rota: "/patio", nome: "Pátio" },
  { rota: "/atendimentos", nome: "Atendimentos" },
  { rota: "/agenda", nome: "Agenda" },
  { rota: "/pendencias", nome: "Pendências" },
  { rota: "/financeiro", nome: "Financeiro" },
  { rota: "/ajustes", nome: "Ajustes" },
] as const;

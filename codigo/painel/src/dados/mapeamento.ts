/**
 * Mapeamento banco (Supabase, snake_case) ↔ modelo do painel (camelCase, tipos.ts) — sprint S1.
 * Fonte do esquema: codigo/supabase/migrations/*.sql. Este arquivo é a ponte EXPLÍCITA que o RepositorioSupabase usa:
 *   - Linha*: o formato de cada tabela/view como o PostgREST devolve;
 *   - de*(): linha → tipo do painel; para*(): tipo do painel → colunas para insert/update direto;
 *   - SELECT_*: os selects com embedding (OSVisao sem N+1: um request só, a RLS de cada tabela decide o que vem);
 *   - RPC: nome e parâmetros de cada função do banco (todas devolvem { ok, codigo?, campo?, id?, ... });
 *   - codigoDoErro(): erro do PostgREST (constraint violada) → código de ERRO (rotulos.ts).
 * Convenções do banco: ids uuid; dinheiro em centavos (bigint → number); datas "AAAA-MM-DD"; marcos timestamptz
 * (o PostgREST devolve "2026-10-21T17:30:00+00:00"; marco() normaliza para o formato do painel no fuso da oficina);
 * colunas jsonb guardam o formato do TS sem tradução (recepcao, alerta, endereco, proveniencia, etapas do tipo, config).
 * Nada aqui importa @supabase/supabase-js: é só dado (o lint proíbe o SDK fora do repositório).
 */
import type {
  Agendamento,
  AlertaOS,
  AtendimentoExterno,
  Baixa,
  CapacidadeDia,
  CategoriaFinanceira,
  ChecklistItem,
  Cliente,
  ConfigOficina,
  CustoOS,
  Despesa,
  Endereco,
  EtapaOS,
  FechamentoCaixa,
  Fornecedor,
  Foto,
  Id,
  Material,
  ModeloEtapaItem,
  MovimentoEstoque,
  OrcamentoVersao,
  OS,
  Pagador,
  PagamentoFolha,
  PendenciaExterna,
  Perfil,
  ProvenienciaCampo,
  RecepcaoVeiculo,
  RegistroAuditoria,
  RegraComissao,
  TipoReparo,
  TituloReceber,
  Veiculo,
} from "@compartilhado/tipos";
import { formatarMarco, paraMs } from "@compartilhado/dominio/fuso";

// ---------------------------------------------------------------- utilitários

type Nulo<T> = T | null;
const indef = <T>(v: Nulo<T> | undefined): T | undefined => (v === null || v === undefined ? undefined : v);
/** timestamptz do PostgREST → "2026-10-12T14:30:00-03:00" (fuso da oficina). */
export const marco = (v: Nulo<string> | undefined): string | undefined => (v ? formatarMarco(paraMs(v)) : undefined);
const num = (v: Nulo<number | string> | undefined): number | undefined => (v === null || v === undefined ? undefined : Number(v));
/** Para colunas opcionais: undefined/"" vira null (o PostgREST grava null). */
const ouNulo = <T>(v: T | undefined): T | null => (v === undefined || (v as unknown) === "" ? null : v);

// ---------------------------------------------------------------- oficina e configuração

export interface LinhaConfigOficina {
  id: Id;
  oficina_id: Id;
  expediente: ConfigOficina["expediente"];
  semaforo: ConfigOficina["semaforo"];
  capacidade_padrao: ConfigOficina["capacidadePadrao"];
  alerta_carro: Nulo<NonNullable<ConfigOficina["alertaCarro"]>>;
  checklist: Nulo<ChecklistItem[]>;
  provisorio: boolean;
  confirmado: NonNullable<ConfigOficina["confirmado"]>;
}

/** config_oficina (+ regras de comissão de vw_regra_comissao, que moram em tabela própria com RLS de financeiro). */
export function deConfig(l: LinhaConfigOficina, comissoes?: RegraComissao[]): ConfigOficina {
  return {
    expediente: l.expediente,
    semaforo: l.semaforo,
    capacidadePadrao: l.capacidade_padrao,
    ...(l.alerta_carro ? { alertaCarro: l.alerta_carro } : {}),
    ...(l.checklist ? { checklist: l.checklist } : {}),
    ...(comissoes ? { comissoes } : {}),
    provisorio: l.provisorio,
    confirmado: l.confirmado ?? {},
  };
}

/** UPDATE de config_oficina (salvarConfig / salvarChecklistConfig; dono e gerente). Comissões NÃO vão aqui. */
export function paraConfig(c: ConfigOficina): Omit<LinhaConfigOficina, "id" | "oficina_id"> {
  return {
    expediente: c.expediente,
    semaforo: c.semaforo,
    capacidade_padrao: c.capacidadePadrao,
    alerta_carro: c.alertaCarro ?? null,
    checklist: c.checklist ?? null,
    provisorio: c.provisorio,
    confirmado: c.confirmado ?? {},
  };
}

// ---------------------------------------------------------------- equipe (vw_equipe), comissões e folha

/** vw_equipe: contato/login só para dono e gerente; salário só para dono e financeiro (null para os demais). */
export interface LinhaEquipe {
  id: Id;
  oficina_id: Id;
  nome: string;
  papel: Perfil["papel"];
  funcao: Nulo<string>;
  especialidade: Nulo<string>;
  ativo: boolean;
  usa_terminal: boolean;
  tem_login: boolean;
  usuario: Nulo<string>;
  email: Nulo<string>;
  telefone: Nulo<string>;
  admitido_em: Nulo<string>;
  salario_mensal: Nulo<number>;
}

export function dePerfil(l: LinhaEquipe): Perfil {
  return {
    id: l.id,
    nome: l.nome,
    papel: l.papel,
    funcao: indef(l.funcao),
    especialidade: indef(l.especialidade),
    ativo: l.ativo,
    usaTerminal: l.usa_terminal,
    temLogin: l.tem_login,
    usuario: indef(l.usuario),
    email: indef(l.email),
    telefone: indef(l.telefone),
    admitidoEm: indef(l.admitido_em),
    salarioMensal: num(l.salario_mensal),
  };
}

/** vw_regra_comissao: valor null para o gerente (vê as etapas, não o R$). Escrita direto na tabela regra_comissao (dono). */
export interface LinhaRegraComissao {
  id: Id;
  etapa_nome: Nulo<string>;
  tipo_reparo_id: Nulo<Id>;
  valor: Nulo<number>;
  ativa: boolean;
  descricao: Nulo<string>;
}

export function deRegraComissao(l: LinhaRegraComissao): RegraComissao {
  return {
    id: l.id,
    etapaNome: indef(l.etapa_nome),
    tipoReparoId: indef(l.tipo_reparo_id),
    valor: l.valor ?? 0,
    ativa: l.ativa,
    descricao: indef(l.descricao),
  };
}

/** INSERT/UPDATE em regra_comissao (constraints: alvo_obrigatorio, valor_invalido; índice regra_duplicada). */
export function paraRegraComissao(r: Omit<RegraComissao, "id">) {
  return {
    etapa_nome: ouNulo(r.etapaNome),
    tipo_reparo_id: ouNulo(r.tipoReparoId),
    valor: r.valor,
    ativa: r.ativa,
    descricao: ouNulo(r.descricao),
  };
}

export interface LinhaPagamentoFolha {
  id: Id;
  perfil_id: Id;
  mes: string;
  salario: number;
  comissoes: number;
  ajustes: Nulo<number>;
  total: number;
  pago_em: Nulo<string>;
  despesa_id: Nulo<Id>;
  obs: Nulo<string>;
}

export function dePagamentoFolha(l: LinhaPagamentoFolha): PagamentoFolha {
  return {
    id: l.id,
    perfilId: l.perfil_id,
    mes: l.mes,
    salario: Number(l.salario),
    comissoes: Number(l.comissoes),
    ajustes: num(l.ajustes),
    total: Number(l.total),
    pagoEm: indef(l.pago_em),
    despesaId: indef(l.despesa_id),
    obs: indef(l.obs),
  };
}

// ---------------------------------------------------------------- cliente e veículo

export interface LinhaCliente {
  id: Id;
  nome: string;
  tipo_pessoa: Nulo<"pf" | "pj">;
  documento: Nulo<string>;
  telefone: Nulo<string>;
  whatsapp: Nulo<string>;
  email: Nulo<string>;
  endereco: Nulo<Endereco>;
  observacoes: Nulo<string>;
  proveniencia: Nulo<Record<string, ProvenienciaCampo>>;
  demo: boolean;
}

export function deCliente(l: LinhaCliente): Cliente {
  return {
    id: l.id,
    nome: l.nome,
    tipoPessoa: indef(l.tipo_pessoa),
    documento: indef(l.documento),
    telefone: indef(l.telefone),
    whatsapp: indef(l.whatsapp),
    email: indef(l.email),
    endereco: indef(l.endereco),
    observacoes: indef(l.observacoes),
    proveniencia: indef(l.proveniencia),
    ...(l.demo ? { demo: true } : {}),
  };
}

/**
 * INSERT/UPDATE direto em cliente (salvarCliente). Mande já normalizado (documento só dígitos/maiúsculas, telefone
 * E.164, CEP 8 dígitos): as constraints documento_invalido, telefone_invalido, email_invalido, cep_invalido e o
 * índice documento_duplicado viram o código de erro em codigoDoErro().
 */
export function paraCliente(c: Omit<Cliente, "id">) {
  return {
    nome: c.nome,
    tipo_pessoa: ouNulo(c.tipoPessoa),
    documento: ouNulo(c.documento),
    telefone: ouNulo(c.telefone),
    whatsapp: ouNulo(c.whatsapp),
    email: ouNulo(c.email),
    endereco: c.endereco ?? null,
    observacoes: ouNulo(c.observacoes),
    proveniencia: c.proveniencia ?? null,
  };
}

export interface LinhaVeiculo {
  id: Id;
  cliente_id: Nulo<Id>;
  placa: string;
  marca: Nulo<string>;
  modelo: Nulo<string>;
  cor: Nulo<string>;
  ano: Nulo<number>;
  proveniencia: Nulo<Record<string, ProvenienciaCampo>>;
}

export function deVeiculo(l: LinhaVeiculo): Veiculo {
  return {
    id: l.id,
    clienteId: indef(l.cliente_id),
    placa: l.placa,
    marca: indef(l.marca),
    modelo: indef(l.modelo),
    cor: indef(l.cor),
    ano: indef(l.ano),
    proveniencia: indef(l.proveniencia),
  };
}

/** INSERT/UPDATE direto em veiculo (placa normalizada; placa_invalida, ano_invalido, placa_duplicada). */
export function paraVeiculo(v: Omit<Veiculo, "id">) {
  return {
    cliente_id: ouNulo(v.clienteId),
    placa: v.placa,
    marca: ouNulo(v.marca),
    modelo: ouNulo(v.modelo),
    cor: ouNulo(v.cor),
    ano: v.ano ?? null,
    proveniencia: v.proveniencia ?? null,
  };
}

// ---------------------------------------------------------------- atendimento externo

export interface LinhaAtendimentoExterno {
  id: Id;
  fonte: AtendimentoExterno["fonte"];
  seguradora: string;
  id_externo: Nulo<string>;
  numero_sinistro: Nulo<string>;
  produto: Nulo<string>;
  status_bruto: Nulo<string>;
  status_normalizado: AtendimentoExterno["statusNormalizado"];
  abertura_em: Nulo<string>;
  limite_vistoria_em: Nulo<string>;
  previsao_portal: Nulo<string>;
  lido_em: Nulo<string>;
  estado_conciliacao: AtendimentoExterno["estadoConciliacao"];
}

export function deAtendimento(l: LinhaAtendimentoExterno): AtendimentoExterno {
  return {
    id: l.id,
    fonte: l.fonte,
    seguradora: l.seguradora,
    idExterno: indef(l.id_externo),
    numeroSinistro: indef(l.numero_sinistro),
    produto: indef(l.produto),
    statusBruto: indef(l.status_bruto),
    statusNormalizado: l.status_normalizado,
    aberturaEm: indef(l.abertura_em),
    limiteVistoriaEm: indef(l.limite_vistoria_em),
    previsaoPortal: indef(l.previsao_portal),
    lidoEm: marco(l.lido_em),
    estadoConciliacao: l.estado_conciliacao,
  };
}

// ---------------------------------------------------------------- orçamento

export interface LinhaItemOrcamento {
  id: Id;
  ordem: number;
  peca: string;
  tecnica: OrcamentoVersao["itens"][number]["tecnica"];
  descricao: Nulo<string>;
  valor: number;
  status_item: OrcamentoVersao["itens"][number]["statusItem"];
}

export interface LinhaOrcamentoVersao {
  id: Id;
  os_id: Id;
  tipo: OrcamentoVersao["tipo"];
  numero_versao: number;
  fonte: OrcamentoVersao["fonte"];
  estado: OrcamentoVersao["estado"];
  teto_cobertura: Nulo<number>;
  franquia: Nulo<number>;
  complemento_particular: Nulo<number>;
  aprovacao_tipo: Nulo<"externa" | "interna" | "cliente">;
  aprovado_em: Nulo<string>;
  evidencia: Nulo<string>;
  confiavel: Nulo<boolean>;
  criado_em: string;
  item_orcamento?: LinhaItemOrcamento[];
}

export function deVersao(l: LinhaOrcamentoVersao): OrcamentoVersao {
  return {
    id: l.id,
    osId: l.os_id,
    tipo: l.tipo,
    numeroVersao: l.numero_versao,
    fonte: l.fonte,
    estado: l.estado,
    itens: [...(l.item_orcamento ?? [])]
      .sort((a, b) => a.ordem - b.ordem)
      .map((i) => ({ id: i.id, peca: i.peca, tecnica: i.tecnica, descricao: indef(i.descricao), valor: Number(i.valor), statusItem: i.status_item })),
    tetoCobertura: num(l.teto_cobertura),
    franquia: num(l.franquia),
    complementoParticular: num(l.complemento_particular),
    criadoEm: marco(l.criado_em)!,
    ...(l.aprovacao_tipo && l.aprovado_em
      ? { aprovacao: { tipo: l.aprovacao_tipo, aprovadoEm: marco(l.aprovado_em)!, evidencia: indef(l.evidencia), confiavel: Boolean(l.confiavel) } }
      : {}),
  };
}

// ---------------------------------------------------------------- produção

export interface LinhaBloqueio {
  inicio_em: string;
  fim_em: Nulo<string>;
  motivo: string;
}

export interface LinhaEtapa {
  id: Id;
  os_id: Id;
  ordem: number;
  nome: string;
  estado: EtapaOS["estado"];
  responsavel_id: Nulo<Id>;
  prazo_horas: number;
  prazo_em: Nulo<string>;
  entrou_fila_em: Nulo<string>;
  iniciada_em: Nulo<string>;
  concluida_em: Nulo<string>;
  pecas_previstas: Nulo<number>;
  pecas_feitas: Nulo<number>;
  motivo_dispensa: Nulo<string>;
  exige_foto: boolean;
  exige_contagem_pecas: boolean;
  bloqueio_etapa?: LinhaBloqueio[];
}

export function deEtapa(l: LinhaEtapa): EtapaOS {
  return {
    id: l.id,
    osId: l.os_id,
    ordem: l.ordem,
    nome: l.nome,
    estado: l.estado,
    responsavelId: indef(l.responsavel_id),
    prazoHoras: Number(l.prazo_horas),
    prazoEm: marco(l.prazo_em),
    entrouFilaEm: marco(l.entrou_fila_em),
    iniciadaEm: marco(l.iniciada_em),
    concluidaEm: marco(l.concluida_em),
    pecasPrevistas: indef(l.pecas_previstas),
    pecasFeitas: indef(l.pecas_feitas),
    motivoDispensa: indef(l.motivo_dispensa),
    exigeFoto: l.exige_foto,
    exigeContagemPecas: l.exige_contagem_pecas,
    bloqueios: [...(l.bloqueio_etapa ?? [])]
      .sort((a, b) => paraMs(a.inicio_em) - paraMs(b.inicio_em))
      .map((b) => ({ inicioEm: marco(b.inicio_em)!, fimEm: marco(b.fim_em), motivo: b.motivo })),
  };
}

export interface LinhaTipoReparo {
  id: Id;
  nome: string;
  etapas: ModeloEtapaItem[];
  provisorio: boolean;
  ativo: boolean;
  ordem: number;
}

/** tipo_reparo (ordenar por `ordem`, depois nome). Escrita só por RPC salvar_tipo_reparo / arquivar_tipo_reparo. */
export function deTipoReparo(l: LinhaTipoReparo): TipoReparo {
  return { id: l.id, nome: l.nome, etapas: l.etapas, provisorio: l.provisorio, ...(l.ativo ? {} : { ativo: false }) };
}

// ---------------------------------------------------------------- agenda

export interface LinhaAgendamento {
  id: Id;
  os_id: Id;
  data: string;
  janela: Agendamento["janela"];
  estado: Agendamento["estado"];
  origem: Agendamento["origem"];
  expira_em: Nulo<string>;
  substitui_id: Nulo<Id>;
  motivo_cancelamento: Nulo<string>;
}

export function deAgendamento(l: LinhaAgendamento): Agendamento {
  return {
    id: l.id,
    osId: l.os_id,
    data: l.data,
    janela: l.janela,
    estado: l.estado,
    origem: l.origem,
    expiraEm: marco(l.expira_em),
    substituiId: indef(l.substitui_id),
    motivoCancelamento: indef(l.motivo_cancelamento),
  };
}

/** capacidade_dia só traz as EXCEÇÕES; listarCapacidade completa os outros dias com config.capacidadePadrao.vagasEntrada. */
export interface LinhaCapacidade {
  data: string;
  vagas_entrada: number;
  bloqueado: Nulo<string>;
}

export function deCapacidade(l: LinhaCapacidade): CapacidadeDia {
  return { data: l.data, vagasEntrada: l.vagas_entrada, ...(l.bloqueado ? { bloqueado: l.bloqueado } : {}) };
}

// ---------------------------------------------------------------- fotos (Storage privado "fotos")

export const BUCKET_FOTOS = "fotos";
/** Caminho no bucket: <oficina_id>/<os_id>/<foto_id>.webp (miniatura: <foto_id>.min.webp). A política do Storage confere. */
export function caminhoFoto(oficinaId: Id, osId: Id, fotoId: Id, miniatura = false): string {
  return `${oficinaId}/${osId}/${fotoId}${miniatura ? ".min" : ""}.webp`;
}

export interface LinhaFoto {
  id: Id;
  os_id: Id;
  etapa_id: Nulo<Id>;
  fase: Foto["fase"];
  legenda: Nulo<string>;
  caminho: Nulo<string>;
  caminho_miniatura: Nulo<string>;
  url_externa: Nulo<string>;
  bytes: Nulo<number>;
  largura: Nulo<number>;
  altura: Nulo<number>;
  autor_id: Nulo<Id>;
  origem: Foto["origem"];
  tirada_em: string;
  removida_em: Nulo<string>;
}

/**
 * Foto sem a URL pronta: `url`/`miniaturaUrl` vêm de createSignedUrl(caminho) no repositório (ou url_externa: demo e
 * Maxpar). expiraEm é calculado na leitura (expiracaoFoto). Filtre removida_em is null no select.
 */
export function deFoto(l: LinhaFoto, urls: { url: string; miniaturaUrl?: string }): Foto {
  return {
    id: l.id,
    osId: l.os_id,
    fase: l.fase,
    etapaId: indef(l.etapa_id),
    legenda: indef(l.legenda),
    url: urls.url,
    miniaturaUrl: urls.miniaturaUrl,
    bytes: indef(l.bytes),
    largura: indef(l.largura),
    altura: indef(l.altura),
    autorId: indef(l.autor_id),
    origem: l.origem,
    tiradaEm: marco(l.tirada_em)!,
  };
}

// ---------------------------------------------------------------- pendências

export interface LinhaPendencia {
  id: Id;
  os_id: Id;
  tipo: PendenciaExterna["tipo"];
  descricao: string;
  estado: PendenciaExterna["estado"];
  responsavel_id: Nulo<Id>;
  criada_em: string;
  concluida_em: Nulo<string>;
}

export function dePendencia(l: LinhaPendencia): PendenciaExterna {
  return {
    id: l.id,
    osId: l.os_id,
    tipo: l.tipo,
    descricao: l.descricao,
    estado: l.estado,
    responsavelId: indef(l.responsavel_id),
    criadaEm: marco(l.criada_em)!,
    concluidaEm: marco(l.concluida_em),
  };
}

// ---------------------------------------------------------------- financeiro

export interface LinhaPagador {
  id: Id;
  nome: string;
  tipo: Pagador["tipo"];
  prazo_dias: number;
  prazo_base: Pagador["prazo"]["base"];
  prazo_dias_uteis: boolean;
  prazo_provisorio: boolean;
  desconta_franquia: Nulo<boolean>;
}

export function dePagador(l: LinhaPagador): Pagador {
  return {
    id: l.id,
    nome: l.nome,
    tipo: l.tipo,
    prazo: { dias: l.prazo_dias, base: l.prazo_base, diasUteis: l.prazo_dias_uteis, provisorio: l.prazo_provisorio },
    ...(l.desconta_franquia === null ? {} : { descontaFranquia: l.desconta_franquia }),
  };
}

export interface LinhaBaixa {
  id: Id;
  valor: number;
  recebido_em: string;
  forma: string;
  parcelas: Nulo<number>;
  obs: Nulo<string>;
  criado_em: string;
}

export interface LinhaTitulo {
  id: Id;
  os_id: Id;
  pagador_id: Id;
  descricao: string;
  valor: number;
  nf_numero: Nulo<string>;
  nf_emitida_em: Nulo<string>;
  vencimento: string;
  estado: TituloReceber["estado"];
  baixa?: LinhaBaixa[];
}

export function deBaixa(l: LinhaBaixa): Baixa {
  return { id: l.id, valor: Number(l.valor), recebidoEm: l.recebido_em, forma: l.forma, parcelas: indef(l.parcelas), obs: indef(l.obs) };
}

export function deTitulo(l: LinhaTitulo): TituloReceber {
  return {
    id: l.id,
    osId: l.os_id,
    pagadorId: l.pagador_id,
    descricao: l.descricao,
    valor: Number(l.valor),
    nfNumero: indef(l.nf_numero),
    nfEmitidaEm: indef(l.nf_emitida_em),
    vencimento: l.vencimento,
    estado: l.estado,
    baixas: [...(l.baixa ?? [])].sort((a, b) => a.recebido_em.localeCompare(b.recebido_em) || a.criado_em.localeCompare(b.criado_em)).map(deBaixa),
  };
}

export interface LinhaDespesa {
  id: Id;
  categoria_id: Nulo<Id>;
  categoria: string;
  descricao: string;
  fornecedor: Nulo<string>;
  valor_previsto: number;
  vencimento: string;
  pago_em: Nulo<string>;
  valor_pago: Nulo<number>;
  forma_pagamento: Nulo<NonNullable<Despesa["formaPagamento"]>>;
  obs: Nulo<string>;
}

export function deDespesa(l: LinhaDespesa): Despesa {
  return {
    id: l.id,
    categoria: l.categoria,
    categoriaId: indef(l.categoria_id),
    descricao: l.descricao,
    fornecedor: indef(l.fornecedor),
    valorPrevisto: Number(l.valor_previsto),
    vencimento: l.vencimento,
    pagoEm: indef(l.pago_em),
    valorPago: num(l.valor_pago),
    formaPagamento: indef(l.forma_pagamento),
    obs: indef(l.obs),
  };
}

export interface LinhaCategoria {
  id: Id;
  nome: string;
  tipo: CategoriaFinanceira["tipo"];
  ativa: boolean;
}

export const deCategoria = (l: LinhaCategoria): CategoriaFinanceira => ({ id: l.id, nome: l.nome, tipo: l.tipo, ativa: l.ativa });
/** INSERT/UPDATE direto em categoria_financeira (dono e financeiro; categoria_duplicada, categoria_invalida). */
export const paraCategoria = (c: Omit<CategoriaFinanceira, "id">) => ({ nome: c.nome, tipo: c.tipo, ativa: c.ativa });

export interface LinhaFechamento {
  id: Id;
  data: string;
  saldo_inicial: number;
  contado: number;
  entradas_dinheiro: number;
  saidas_dinheiro: number;
  esperado: number;
  diferenca: number;
  obs: Nulo<string>;
  fechado_por: Nulo<Id>;
  fechado_em: string;
}

export function deFechamento(l: LinhaFechamento): FechamentoCaixa {
  return {
    id: l.id,
    data: l.data,
    saldoInicial: Number(l.saldo_inicial),
    contado: Number(l.contado),
    entradasDinheiro: Number(l.entradas_dinheiro),
    saidasDinheiro: Number(l.saidas_dinheiro),
    esperado: Number(l.esperado),
    diferenca: Number(l.diferenca),
    obs: indef(l.obs),
    fechadoPor: indef(l.fechado_por),
    fechadoEm: marco(l.fechado_em)!,
  };
}

// ---------------------------------------------------------------- estoque e custos

export interface LinhaFornecedor {
  id: Id;
  nome: string;
  documento: Nulo<string>;
  telefone: Nulo<string>;
  email: Nulo<string>;
  obs: Nulo<string>;
  demo: boolean;
}

export function deFornecedor(l: LinhaFornecedor): Fornecedor {
  return {
    id: l.id,
    nome: l.nome,
    documento: indef(l.documento),
    telefone: indef(l.telefone),
    email: indef(l.email),
    obs: indef(l.obs),
    ...(l.demo ? { demo: true } : {}),
  };
}

/** INSERT/UPDATE direto em fornecedor (dono e gerente; documento_invalido, telefone_invalido, fornecedor_documento_duplicado). */
export const paraFornecedor = (f: Omit<Fornecedor, "id">) => ({
  nome: f.nome,
  documento: ouNulo(f.documento),
  telefone: ouNulo(f.telefone),
  email: ouNulo(f.email),
  obs: ouNulo(f.obs),
});

/** vw_material: custo_medio null para o gerente (veCustosOS). Escrita só por RPC salvar_material / movimentar_estoque. */
export interface LinhaMaterial {
  id: Id;
  nome: string;
  codigo: Nulo<string>;
  marca: Nulo<string>;
  categoria: string;
  unidade: string;
  saldo_estimado: number;
  saldo_minimo: number;
  ultima_conferencia_em: Nulo<string>;
  custo_medio: Nulo<number>;
  fornecedor_id: Nulo<Id>;
  ativo: boolean;
}

export function deMaterial(l: LinhaMaterial): Material {
  return {
    id: l.id,
    nome: l.nome,
    codigo: indef(l.codigo),
    marca: indef(l.marca),
    categoria: l.categoria,
    unidade: l.unidade,
    saldoEstimado: Number(l.saldo_estimado),
    saldoMinimo: Number(l.saldo_minimo),
    ultimaConferenciaEm: indef(l.ultima_conferencia_em),
    custoMedio: num(l.custo_medio) ?? 0, // gerente: 0 (a tela não mostra custo para quem não veCustosOS)
    fornecedorId: indef(l.fornecedor_id),
    ...(l.ativo ? {} : { ativo: false }),
  };
}

/** vw_movimento_estoque: custo_unitario null para o gerente. */
export interface LinhaMovimento {
  id: Id;
  material_id: Id;
  tipo: MovimentoEstoque["tipo"];
  quantidade: number;
  sentido: Nulo<"mais" | "menos">;
  custo_unitario: Nulo<number>;
  os_id: Nulo<Id>;
  perfil_id: Nulo<Id>;
  fornecedor_id: Nulo<Id>;
  obs: Nulo<string>;
  em: string;
}

export function deMovimento(l: LinhaMovimento): MovimentoEstoque {
  return {
    id: l.id,
    materialId: l.material_id,
    tipo: l.tipo,
    quantidade: Number(l.quantidade),
    sentido: indef(l.sentido),
    custoUnitario: num(l.custo_unitario),
    osId: indef(l.os_id),
    perfilId: indef(l.perfil_id),
    fornecedorId: indef(l.fornecedor_id),
    obs: indef(l.obs),
    em: marco(l.em)!,
  };
}

export interface LinhaCusto {
  id: Id;
  os_id: Id;
  tipo: CustoOS["tipo"];
  descricao: string;
  quantidade: number;
  unidade: Nulo<string>;
  custo_unitario: number;
  total: number;
  material_id: Nulo<Id>;
  perfil_id: Nulo<Id>;
  minutos: Nulo<number>;
  fornecedor: Nulo<string>;
  lancado_em: string;
  lancado_por: Nulo<Id>;
}

export function deCusto(l: LinhaCusto): CustoOS {
  return {
    id: l.id,
    osId: l.os_id,
    tipo: l.tipo,
    descricao: l.descricao,
    quantidade: Number(l.quantidade),
    unidade: indef(l.unidade),
    custoUnitario: Number(l.custo_unitario),
    total: Number(l.total),
    materialId: indef(l.material_id),
    perfilId: indef(l.perfil_id),
    minutos: indef(l.minutos),
    fornecedor: indef(l.fornecedor),
    lancadoEm: marco(l.lancado_em)!,
    lancadoPor: indef(l.lancado_por),
  };
}

// ---------------------------------------------------------------- auditoria (vw_auditoria)

export interface LinhaAuditoria {
  id: Id;
  em: string;
  perfil_id: Nulo<Id>;
  envolvido_id: Nulo<Id>;
  acao: string;
  entidade: string;
  entidade_id: Nulo<Id>;
  resumo: string;
}

/** Histórico do funcionário: filtre por perfil_id = X ou envolvido_id = X (or=(perfil_id.eq.X,envolvido_id.eq.X)). */
export function deAuditoria(l: LinhaAuditoria): RegistroAuditoria {
  return { id: l.id, em: marco(l.em)!, perfilId: indef(l.perfil_id), acao: l.acao, entidade: l.entidade, entidadeId: indef(l.entidade_id), resumo: l.resumo };
}

// ---------------------------------------------------------------- OS (OSVisao num select só)

export interface LinhaOS {
  id: Id;
  numero: number;
  veiculo_id: Id;
  cliente_id: Id;
  tipo_reparo_id: Nulo<Id>;
  origem: OS["origem"];
  estado: OS["estado"];
  prioridade: OS["prioridade"];
  previsao_entrega: Nulo<string>;
  entrada_real_em: Nulo<string>;
  pronta_em: Nulo<string>;
  entregue_em: Nulo<string>;
  box: Nulo<string>;
  observacoes: Nulo<string>;
  recepcao: Nulo<RecepcaoVeiculo>;
  alerta: Nulo<AlertaOS>;
  demo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export function deOS(l: LinhaOS, atendimentosExternos: Id[]): OS {
  return {
    id: l.id,
    numero: l.numero,
    veiculoId: l.veiculo_id,
    clienteId: l.cliente_id,
    tipoReparoId: indef(l.tipo_reparo_id),
    origem: l.origem,
    estado: l.estado,
    prioridade: l.prioridade,
    atendimentosExternos,
    previsaoEntrega: indef(l.previsao_entrega),
    entradaRealEm: marco(l.entrada_real_em),
    prontaEm: marco(l.pronta_em),
    entregueEm: marco(l.entregue_em),
    box: indef(l.box),
    observacoes: indef(l.observacoes),
    recepcao: indef(l.recepcao),
    alerta: indef(l.alerta),
    criadoEm: marco(l.criado_em)!,
    atualizadoEm: marco(l.atualizado_em)!,
    ...(l.demo ? { demo: true } : {}),
  };
}

/**
 * select da OSVisao com embedding (from("os").select(SELECT_OS_VISAO)). Cada tabela embutida passa pela própria RLS:
 * títulos/baixas vêm vazios para o gerente; custos só para dono e financeiro (veCustosOS); produção e TV NÃO usam
 * isto (não leem `os`): leem vw_producao (deProducao). Fotos: filtre .is("foto.removida_em", null).
 * Agendamento ativo = confirmado, ou proposto não expirado (escolha no repositório, como agendamentoAtivo).
 */
export const SELECT_OS_VISAO = [
  "*",
  "veiculo(*)",
  "cliente(*)",
  "tipo_reparo(*)",
  "os_atendimento_externo(atendimento_externo(*))",
  "orcamento_versao(*, item_orcamento(*))",
  "etapa_os(*, bloqueio_etapa(*))",
  "agendamento(*)",
  "pendencia_externa(*)",
  "titulo_receber(*, baixa(*))",
  "foto(*)",
  "custo_os(*)",
].join(", ");

export interface LinhaOSVisao extends LinhaOS {
  veiculo: LinhaVeiculo;
  cliente: LinhaCliente;
  tipo_reparo: Nulo<LinhaTipoReparo>;
  os_atendimento_externo: { atendimento_externo: LinhaAtendimentoExterno }[];
  orcamento_versao: LinhaOrcamentoVersao[];
  etapa_os: LinhaEtapa[];
  agendamento: LinhaAgendamento[];
  pendencia_externa: LinhaPendencia[];
  titulo_receber: LinhaTitulo[];
  foto: LinhaFoto[];
  custo_os: LinhaCusto[];
}

/** vw_producao (produção e TV): sem cliente, telefone, documento, valor nem seguradora. etapas/pecas já em camelCase. */
export interface LinhaProducao {
  id: Id;
  numero: number;
  estado: OS["estado"];
  origem: OS["origem"];
  prioridade: OS["prioridade"];
  previsao_entrega: Nulo<string>;
  entrada_real_em: Nulo<string>;
  pronta_em: Nulo<string>;
  box: Nulo<string>;
  alerta: Nulo<AlertaOS>;
  tipo_reparo_id: Nulo<Id>;
  tipo_reparo_nome: Nulo<string>;
  veiculo_id: Id;
  placa: string;
  marca: Nulo<string>;
  modelo: Nulo<string>;
  cor: Nulo<string>;
  agendada_para: Nulo<string>;
  agendada_janela: Nulo<"manha" | "tarde">;
  etapas: (Omit<EtapaOS, "bloqueios"> & { bloqueios: { inicioEm: string; fimEm?: string | null; motivo: string }[] })[];
  pecas: { id: Id; peca: string; tecnica: OrcamentoVersao["itens"][number]["tecnica"]; statusItem: OrcamentoVersao["itens"][number]["statusItem"] }[];
  criado_em: string;
  atualizado_em: string;
}

/** Etapas da vw_producao com marcos no formato do painel. */
export function etapasDeProducao(l: LinhaProducao): EtapaOS[] {
  return l.etapas.map((e) => ({
    ...e,
    responsavelId: e.responsavelId ?? undefined,
    prazoEm: marco(e.prazoEm),
    entrouFilaEm: marco(e.entrouFilaEm),
    iniciadaEm: marco(e.iniciadaEm),
    concluidaEm: marco(e.concluidaEm),
    pecasPrevistas: e.pecasPrevistas ?? undefined,
    pecasFeitas: e.pecasFeitas ?? undefined,
    motivoDispensa: e.motivoDispensa ?? undefined,
    bloqueios: e.bloqueios.map((b) => ({ inicioEm: marco(b.inicioEm)!, fimEm: marco(b.fimEm), motivo: b.motivo })),
  }));
}

// ---------------------------------------------------------------- funções do banco (RPC)

/**
 * Nome de cada função e o objeto de parâmetros (supabase.rpc(nome, params)). Todas devolvem jsonb
 * { ok, codigo?, campo?, id?, ...extra } — o mesmo Resultado do repositório. Datas de pagamento/despesa/caixa vão como
 * texto "AAAA-MM-DD" (o banco devolve data_invalida em vez de erro de tipo). Objetos jsonb vão no formato do TS.
 */
export const RPC = {
  iniciarEtapa: (etapaId: Id, responsavelId: Id) => ["iniciar_etapa", { p_etapa: etapaId, p_responsavel: responsavelId }] as const,
  concluirEtapa: (etapaId: Id, pecasFeitas?: number, fotoIds?: Id[]) =>
    ["concluir_etapa", { p_etapa: etapaId, p_pecas_feitas: pecasFeitas ?? null, p_foto_ids: fotoIds ?? null }] as const,
  bloquearEtapa: (etapaId: Id, motivo: string) => ["bloquear_etapa", { p_etapa: etapaId, p_motivo: motivo }] as const,
  retomarEtapa: (etapaId: Id) => ["retomar_etapa", { p_etapa: etapaId }] as const,
  dispensarEtapa: (etapaId: Id, motivo: string) => ["dispensar_etapa", { p_etapa: etapaId, p_motivo: motivo }] as const,
  atribuirResponsavel: (etapaId: Id, perfilId: Id) => ["atribuir_responsavel", { p_etapa: etapaId, p_perfil: perfilId }] as const,
  /** dados = NovoAtendimentoRapido; resposta traz osId (e osId da OS existente em protocolo_duplicado). */
  criarAtendimentoRapido: (dados: unknown) => ["criar_atendimento_rapido", { p_dados: dados }] as const,
  registrarAprovacao: (osId: Id, evidencia: string) => ["registrar_aprovacao", { p_os: osId, p_evidencia: evidencia }] as const,
  registrarEntrada: (osId: Id, tipoReparoId: Id, recepcao?: RecepcaoVeiculo) =>
    ["registrar_entrada", { p_os: osId, p_tipo_reparo: tipoReparoId, p_recepcao: recepcao ?? null }] as const,
  registrarEntrega: (osId: Id) => ["registrar_entrega", { p_os: osId }] as const,
  salvarRecepcao: (osId: Id, recepcao: RecepcaoVeiculo) => ["salvar_recepcao", { p_os: osId, p_recepcao: recepcao }] as const,
  /** alerta = EntradaAlertaOS (null = volta para a base); erro valor_invalido traz `campo`. */
  salvarAlertaOS: (osId: Id, alerta: unknown) => ["salvar_alerta_os", { p_os: osId, p_alerta: alerta }] as const,
  concluirPendencia: (pendenciaId: Id) => ["concluir_pendencia", { p_pendencia: pendenciaId }] as const,
  agendar: (osId: Id, data: string, janela: string, encaixe = false) => ["agendar", { p_os: osId, p_data: data, p_janela: janela, p_encaixe: encaixe }] as const,
  reagendar: (agendamentoId: Id, data: string, janela: string, encaixe = false) =>
    ["reagendar", { p_agendamento: agendamentoId, p_data: data, p_janela: janela, p_encaixe: encaixe }] as const,
  cancelarAgendamento: (agendamentoId: Id, motivo: string) => ["cancelar_agendamento", { p_agendamento: agendamentoId, p_motivo: motivo }] as const,
  marcarNaoCompareceu: (agendamentoId: Id) => ["marcar_nao_compareceu", { p_agendamento: agendamentoId }] as const,
  /** baixa = Omit<Baixa, "id"> (dono e financeiro). */
  aplicarBaixa: (tituloId: Id, baixa: unknown) => ["aplicar_baixa", { p_titulo: tituloId, p_baixa: baixa }] as const,
  /** pagamento = PagamentoOS (dono, financeiro e recepção — vePagamentosOS). */
  registrarPagamentoOS: (osId: Id, pagamento: unknown) => ["registrar_pagamento_os", { p_os: osId, p_pagamento: pagamento }] as const,
  /** despesa = DespesaEntrada. */
  criarDespesa: (despesa: unknown) => ["criar_despesa", { p_despesa: despesa }] as const,
  pagarDespesa: (despesaId: Id, valor: number, pagoEm: string, forma?: string) =>
    ["pagar_despesa", { p_despesa: despesaId, p_valor: valor, p_pago_em: pagoEm, p_forma: forma ?? null }] as const,
  /** dados = FechamentoEntrada. */
  fecharCaixa: (dados: unknown) => ["fechar_caixa", { p_dados: dados }] as const,
  /** mov = MovimentoEntrada (dono e gerente). */
  movimentarEstoque: (mov: unknown) => ["movimentar_estoque", { p_mov: mov }] as const,
  /** material = MaterialEntrada (dono e gerente). */
  salvarMaterial: (material: unknown) => ["salvar_material", { p_material: material }] as const,
  /** custo = NovoCustoOS (dono e financeiro). */
  lancarCusto: (osId: Id, custo: unknown) => ["lancar_custo", { p_os: osId, p_custo: custo }] as const,
  removerCusto: (custoId: Id) => ["remover_custo", { p_custo: custoId }] as const,
  /** tipo = TipoReparoEntrada. */
  salvarTipoReparo: (tipo: unknown) => ["salvar_tipo_reparo", { p_tipo: tipo }] as const,
  arquivarTipoReparo: (id: Id, arquivar: boolean) => ["arquivar_tipo_reparo", { p_id: id, p_arquivar: arquivar }] as const,
  /** foto = { id, fase, etapaId?, legenda?, caminho, caminhoMiniatura?, bytes?, largura?, altura? } — DEPOIS do upload. */
  adicionarFoto: (osId: Id, foto: unknown) => ["adicionar_foto", { p_os: osId, p_foto: foto }] as const,
  /** resposta traz `caminhos` para apagar no Storage (storage.from("fotos").remove(caminhos)). */
  removerFoto: (fotoId: Id) => ["remover_foto", { p_foto: fotoId }] as const,
  /** p = FuncionarioEntrada validada (validarFuncionario). Login/senha: Edge Function equipe-login. */
  salvarFuncionario: (p: unknown) => ["salvar_funcionario", { p }] as const,
  salvarAjusteFolha: (perfilId: Id, mes: string, ajustes: number, obs?: string) =>
    ["salvar_ajuste_folha", { p_perfil: perfilId, p_mes: mes, p_ajustes: ajustes, p_obs: obs ?? null }] as const,
  /** resposta traz despesaId. */
  pagarFolha: (perfilId: Id, mes: string, pagoEm: string, ajustes?: number) =>
    ["pagar_folha", { p_perfil: perfilId, p_mes: mes, p_pago_em: pagoEm, p_ajustes: ajustes ?? null }] as const,
  /** setof LinhaComissao em snake_case (perfil_id, os_id, placa, etapa_id, etapa, concluida_em, valor, regra_id); dono e financeiro. */
  comissoesDoMes: (mes: string) => ["comissoes_do_mes", { p_mes: mes }] as const,
};

/** Edge Function do login do funcionário (functions.invoke("equipe-login", { body })). */
export const EDGE_EQUIPE_LOGIN = "equipe-login";
export type CorpoEquipeLogin =
  | { acao: "definir"; perfilId: Id; usuario: string; senha: string }
  | { acao: "remover"; perfilId: Id }
  | { acao: "sincronizar"; perfilId: Id };

// ---------------------------------------------------------------- erros do PostgREST → código do painel

/** Constraint/índice → código de ERRO (rotulos.ts). Nomes iguais ao código não precisam estar aqui. */
const CONSTRAINT_PARA_CODIGO: Record<string, string> = {
  fornecedor_documento_duplicado: "documento_duplicado",
  whatsapp_invalido: "telefone_invalido",
  sem_etapas: "sem_etapas",
  foto_caminho_unico: "arquivo_invalido",
  os_numero_unico: "transicao_invalida",
};

/**
 * Erro de escrita direta (insert/update) → código. 23505 (único) e 23514 (check) trazem o nome da constraint na
 * mensagem; 42501 = RLS/permissão → sem_permissao; DD001 = regra do banco (a mensagem é o código).
 */
export function codigoDoErro(erro: { code?: string; message?: string; details?: string | null } | null | undefined): string {
  if (!erro) return "erro_desconhecido";
  if (erro.code === "42501") return "sem_permissao";
  if (erro.code === "DD001" || erro.code === "DD002") return (erro.message ?? "").split(":")[0].trim() || "transicao_invalida";
  if (erro.code === "23505" || erro.code === "23514") {
    const nome = /constraint "([^"]+)"/.exec(erro.message ?? "")?.[1] ?? "";
    return CONSTRAINT_PARA_CODIGO[nome] ?? (nome || "valor_invalido");
  }
  return "erro_desconhecido";
}

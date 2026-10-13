import type {
  Agendamento,
  AtendimentoExterno,
  Baixa,
  CapacidadeDia,
  CategoriaFinanceira,
  Centavos,
  ChecklistItem,
  Cliente,
  ConfigOficina,
  CustoOS,
  DataISO,
  Despesa,
  EtapaOS,
  FechamentoCaixa,
  FormaPagamento,
  Fornecedor,
  Foto,
  Id,
  Janela,
  MarcoISO,
  Material,
  MovimentoEstoque,
  OrcamentoVersao,
  OS,
  Pagador,
  PendenciaExterna,
  Perfil,
  RecepcaoVeiculo,
  RegistroAuditoria,
  Tecnica,
  TipoReparo,
  TituloReceber,
  Veiculo,
} from "@compartilhado/tipos";
import type { ModoMaoDeObra } from "@compartilhado/dominio/custos";

/**
 * Visão de leitura de uma OS com tudo o que as telas precisam (montada pelo repositório).
 * No Supabase (S1) vira uma consulta com joins / view; aqui é montada em memória.
 */
export interface OSVisao {
  os: OS;
  veiculo: Veiculo;
  cliente: Cliente;
  atendimentos: AtendimentoExterno[];
  versoes: OrcamentoVersao[];
  etapas: EtapaOS[];
  tipoReparo?: TipoReparo;
  agendamento?: Agendamento; // o ativo (não cancelado/realizado), se houver
  pendencias: PendenciaExterna[];
  titulos: TituloReceber[];
  fotos: Foto[];
  /**
   * Custos lançados (insumos, mão de obra, terceiros, outros). Só dono, gestor e financeiro veem (veCustosOS).
   * TODO(S1): sair da OSVisao. No Supabase a RLS não deixa recepção/produção lerem custo_os, então a visão
   * geral não pode trazê-los; as telas devem migrar para listarCustosOS (hook próprio, só para quem veCustosOS).
   * Mantido aqui até as telas migrarem (QA #5).
   */
  custos: CustoOS[];
}

export interface NovoAtendimentoRapido {
  placa: string;
  marca?: string;
  modelo?: string;
  cor?: string;
  /** Cliente já cadastrado; ausente = cria (ou reaproveita o cliente com o mesmo documento). */
  clienteId?: Id;
  clienteNome: string;
  documento?: string; // CPF ou CNPJ, com ou sem máscara
  telefone?: string;
  whatsapp?: string;
  email?: string;
  origem: OS["origem"];
  seguradora?: string;
  protocolo?: string;
  pecas: { peca: string; tecnica: Tecnica; valor?: number }[];
  observacoes?: string;
  recepcao?: RecepcaoVeiculo;
}

/**
 * Quantas linhas de auditoria a demonstração guarda (as mais antigas saem). A tela de Auditoria cita o
 * limite ("mostrando as últimas N ações"). No S1 a auditoria fica no banco, sem esse corte.
 */
export const LIMITE_AUDITORIA = 500;

export interface Resultado {
  ok: boolean;
  codigo?: string;
}

/** Linha da lista de clientes. */
export interface ClienteResumo {
  cliente: Cliente;
  veiculos: Veiculo[];
  quantidadeOS: number;
  ultimaOSEm?: MarcoISO; // criadoEm da OS mais recente
  totalPago: Centavos; // Σ baixas dos títulos do CLIENTE (pagador tipo "cliente") nas OS dele; seguradora/Maxpar fora
}

/** Ficha do cliente: veículos, histórico de OS e totais. */
export interface ClienteFicha extends ClienteResumo {
  oss: OSVisao[]; // da mais recente para a mais antiga
  saldoEmAberto: Centavos; // Σ saldo dos títulos do CLIENTE (pagador tipo "cliente") não cancelados
}

/** Cliente para criar (sem id) ou editar (com id). Documento e telefones entram com ou sem máscara. */
export type ClienteEntrada = Omit<Cliente, "id"> & { id?: Id };
export type VeiculoEntrada = Omit<Veiculo, "id"> & { id?: Id };
/** Saldo e custo médio só mudam por movimentação; na edição esses campos são ignorados. */
export type MaterialEntrada = Omit<Material, "id" | "saldoEstimado" | "custoMedio"> & {
  id?: Id;
  saldoEstimado?: number;
  custoMedio?: Centavos;
};
export type FornecedorEntrada = Omit<Fornecedor, "id"> & { id?: Id };
export type CategoriaEntrada = Omit<CategoriaFinanceira, "id"> & { id?: Id };
export type DespesaEntrada = Omit<Despesa, "id" | "categoria"> & { categoria?: string };

/** Lançamento de custo na OS. O total é calculado pelo domínio (custos.ts). */
export type NovoCustoOS =
  | {
      tipo: "insumo";
      materialId: Id;
      quantidade: number;
      perfilId?: Id; // quem retirou
      descricao?: string; // padrão: nome do material
    }
  | {
      tipo: "mao_de_obra";
      descricao: string;
      perfilId?: Id;
      modo: ModoMaoDeObra; // hora | minuto | fixo
      minutos: number; // ignorado em "fixo"
      valorUnitario: Centavos; // valor da hora, do minuto ou o valor fixo
    }
  | {
      tipo: "terceiro" | "outro";
      descricao: string;
      quantidade?: number; // padrão 1
      unidade?: string;
      custoUnitario: Centavos;
      fornecedor?: string;
      perfilId?: Id;
    };

export interface PagamentoOS {
  valor: Centavos;
  forma: FormaPagamento;
  recebidoEm: DataISO;
  parcelas?: number; // crédito parcelado
  obs?: string;
}

/** Movimentação manual do estoque (a retirada para OS é feita por lancarCusto). */
export type MovimentoEntrada = Omit<MovimentoEstoque, "id" | "em" | "tipo"> & {
  tipo: "entrada_compra" | "consumo_interno" | "ajuste";
  em?: MarcoISO;
};

export interface FechamentoEntrada {
  data: DataISO;
  contado: Centavos;
  /** Ausente = valor contado no último fechamento anterior (ou 0). */
  saldoInicial?: Centavos;
  obs?: string;
}

/**
 * Única porta de entrada dos dados (CLAUDE.md). Implementações: RepositorioMemoria (demo, hoje)
 * e RepositorioSupabase (S1). Telas usam só os hooks de src/dados/hooks.ts.
 */
export interface Repositorio {
  // leitura
  listarOS(): Promise<OSVisao[]>;
  obterOS(id: Id): Promise<OSVisao | null>;
  listarAgendamentos(): Promise<Agendamento[]>;
  listarCapacidade(inicio: DataISO, fim: DataISO): Promise<CapacidadeDia[]>;
  listarPerfis(): Promise<Perfil[]>;
  listarTiposReparo(): Promise<TipoReparo[]>;
  listarPagadores(): Promise<Pagador[]>;
  listarTitulos(): Promise<TituloReceber[]>;
  listarDespesas(): Promise<Despesa[]>;
  listarMateriais(): Promise<Material[]>;
  obterConfig(): Promise<ConfigOficina>;
  listarClientes(): Promise<ClienteResumo[]>;
  obterCliente(id: Id): Promise<ClienteFicha | null>;
  listarVeiculos(): Promise<Veiculo[]>;
  listarCustosOS(osId: Id): Promise<CustoOS[]>;
  listarMovimentos(): Promise<MovimentoEstoque[]>; // do mais recente para o mais antigo
  listarFornecedores(): Promise<Fornecedor[]>;
  listarCategorias(): Promise<CategoriaFinanceira[]>;
  listarFechamentos(): Promise<FechamentoCaixa[]>; // do mais recente para o mais antigo
  listarAuditoria(): Promise<RegistroAuditoria[]>; // do mais recente para o mais antigo

  // clientes, veículos e recepção
  salvarCliente(cliente: ClienteEntrada): Promise<Resultado & { id?: Id }>;
  salvarVeiculo(veiculo: VeiculoEntrada): Promise<Resultado & { id?: Id }>;
  salvarRecepcao(osId: Id, recepcao: RecepcaoVeiculo): Promise<Resultado>;

  // custos e pagamentos da OS
  lancarCusto(osId: Id, custo: NovoCustoOS): Promise<Resultado & { id?: Id }>;
  removerCusto(custoId: Id): Promise<Resultado>;
  registrarPagamentoOS(osId: Id, pagamento: PagamentoOS): Promise<Resultado & { id?: Id }>;

  // estoque
  movimentarEstoque(mov: MovimentoEntrada): Promise<Resultado & { id?: Id }>;
  salvarMaterial(material: MaterialEntrada): Promise<Resultado & { id?: Id }>;
  salvarFornecedor(fornecedor: FornecedorEntrada): Promise<Resultado & { id?: Id }>;

  // financeiro e ajustes
  criarDespesa(despesa: DespesaEntrada): Promise<Resultado & { id?: Id }>;
  salvarCategoria(categoria: CategoriaEntrada): Promise<Resultado & { id?: Id }>;
  fecharCaixa(dados: FechamentoEntrada): Promise<Resultado & { id?: Id }>;
  salvarChecklistConfig(itens: ChecklistItem[]): Promise<Resultado>;

  // produção
  iniciarEtapa(etapaId: Id, responsavelId: Id): Promise<Resultado>;
  concluirEtapa(etapaId: Id, dados: { pecasFeitas?: number; temFoto?: boolean }): Promise<Resultado>;
  bloquearEtapa(etapaId: Id, motivo: string): Promise<Resultado>;
  retomarEtapa(etapaId: Id): Promise<Resultado>;
  dispensarEtapa(etapaId: Id, motivo: string): Promise<Resultado>;
  atribuirResponsavel(etapaId: Id, perfilId: Id): Promise<Resultado>;

  // ciclo da OS
  criarAtendimentoRapido(dados: NovoAtendimentoRapido): Promise<Resultado & { osId?: Id }>;
  registrarAprovacao(osId: Id, evidencia: string): Promise<Resultado>;
  registrarEntrada(osId: Id, tipoReparoId: Id, recepcao?: RecepcaoVeiculo): Promise<Resultado>;
  registrarEntrega(osId: Id): Promise<Resultado>;

  // agenda
  agendar(osId: Id, data: DataISO, janela: Janela): Promise<Resultado>;
  reagendar(agendamentoId: Id, data: DataISO, janela: Janela): Promise<Resultado>;
  cancelarAgendamento(agendamentoId: Id, motivo: string): Promise<Resultado>;
  marcarNaoCompareceu(agendamentoId: Id): Promise<Resultado>;

  // pendências e financeiro
  concluirPendencia(pendenciaId: Id): Promise<Resultado>;
  aplicarBaixa(tituloId: Id, baixa: Omit<Baixa, "id">): Promise<Resultado>;
  pagarDespesa(despesaId: Id, valor: number, pagoEm: DataISO, forma?: FormaPagamento): Promise<Resultado>;

  // demonstração (grava uma linha de auditoria "restaurar")
  restaurarDemo(): Promise<void>;
}

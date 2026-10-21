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
  FaseVistoria,
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
  RegraComissao,
  Tecnica,
  TipoReparo,
  TituloReceber,
  Veiculo,
} from "@compartilhado/tipos";
import type { ModoMaoDeObra } from "@compartilhado/dominio/custos";
import type { ConfigParcial } from "@compartilhado/dominio/config";
import type { TipoReparoEntrada } from "@compartilhado/dominio/tiposReparo";
import type { EntradaAlertaOS } from "@compartilhado/dominio/corCarro";
import type { FuncionarioEntrada } from "@compartilhado/dominio/equipe";
import type { LinhaComissao, RegraComissaoEntrada } from "@compartilhado/dominio/comissoes";
import type { LinhaFolha, TotaisFolha } from "@compartilhado/dominio/folha";
import type { EventoFuncionario } from "@compartilhado/dominio/historicoFuncionario";

export type { ConfigParcial, EntradaAlertaOS, EventoFuncionario, FuncionarioEntrada, LinhaComissao, LinhaFolha, RegraComissaoEntrada, TipoReparoEntrada, TotaisFolha };

/** Folha de um mês "AAAA-MM" (Equipe → Folha e Financeiro → Folha): linhas, comissões que as formam e totais. */
export interface FolhaDoMes {
  mes: string;
  linhas: LinhaFolha[];
  /** Uma por etapa concluída que paga comissão no mês (mais recente primeiro). */
  comissoes: LinhaComissao[];
  totais: TotaisFolha;
}

/** Login que o dono dá ao funcionário: usuário curto ("diego") e a senha que ele passa à pessoa. */
export interface DadosLogin {
  usuario: string;
  senha: string;
}

/** Tamanho da senha do login do funcionário (provisório — a confirmar; o Supabase Auth pede 6+). */
export const LIMITES_SENHA = { min: 8, max: 72 } as const;

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
  /** url/miniaturaUrl prontas para <img> (blob: na memória, URL assinada no S1/S3); expiraEm calculado (L28). */
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

/**
 * Resultado de uma escrita. `ok: false` → `codigo` é o erro (mensagem em ERRO de rotulos.ts).
 * `ok: true` com `codigo` → deu certo, com AVISO (ex.: "fotos_temporarias"); a tela mostra a mensagem sem tratar como erro.
 */
export interface Resultado {
  ok: boolean;
  codigo?: string;
  /** Campo que falhou na validação (ex.: salvarConfig → "vagasEntrada"), para a tela marcar o campo. */
  campo?: string;
}

/** Foto nova da OS, já comprimida no aparelho (dados/fotos.ts → comprimirFoto). */
export interface NovaFoto {
  fase: Exclude<FaseVistoria, "externa">; // "externa" é a vistoria da Maxpar, que o painel só lê
  etapaId?: Id; // obrigatório na prática para comprovar a etapa (fase "durante" ou "final")
  legenda?: string;
  arquivo: Blob; // imagem comprimida (~1600 px)
  miniatura: Blob; // ~320 px
  largura?: number;
  altura?: number;
}

/** Conclusão de etapa. Com exigeFoto, a OS precisa de ao menos uma foto "durante"/"final" ligada à etapa. */
export interface DadosConclusaoEtapa {
  pecasFeitas?: number;
  /** Fotos da OS que comprovam a etapa; as ainda sem etapa passam a ser ligadas a ela. */
  fotoIds?: Id[];
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
 * Única porta de entrada dos dados (CLAUDE.md). Implementações: RepositorioMemoria (demonstração) e
 * RepositorioSupabase (banco real, S1); a escolha é de modo.ts. Telas usam só os hooks de src/dados/hooks.ts.
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

  // equipe, comissões e folha (sprint S1)
  /** Regras de comissão (config.comissoes). Valores em R$ só para quem podeVerFolha (o gerente vê só as etapas). */
  listarRegrasComissao(): Promise<RegraComissao[]>;
  /** Folha do mês: só dono e financeiro (podeVerFolha); outro papel recebe erro `sem_permissao`. */
  listarFolha(mes: string): Promise<FolhaDoMes>;
  /** Histórico do funcionário ("Concluiu Pintura · RKP1L34"), mais recente primeiro. Dono e gerente. */
  historicoFuncionario(perfilId: Id): Promise<EventoFuncionario[]>;

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
  /** Capacidade, expediente, semáforo e alerta do carro (alertaCarro); cada campo salvo deixa de ser provisório. Só dono e gestor (podeEditarConfig). */
  salvarConfig(parcial: ConfigParcial): Promise<Resultado>;
  /** Cria (sem id) ou edita um tipo de reparo / categoria de serviço. Não muda etapas de OS já geradas. */
  salvarTipoReparo(tipo: TipoReparoEntrada): Promise<Resultado & { id?: Id }>;
  /**
   * Arquiva (some da escolha do serviço; `ativo: false`) ou reativa uma categoria. Arquivar falha com
   * `tipo_em_uso` se alguma OS em aberto usa a categoria (usoTipoReparo). Mesma permissão de salvarTipoReparo.
   */
  arquivarTipoReparo(id: Id, arquivar: boolean): Promise<Resultado>;

  // fotos (comprimidas no aparelho; memória: IndexedDB; S1/S3: Cloudflare R2, L37)
  adicionarFoto(osId: Id, foto: NovaFoto): Promise<Resultado & { id?: Id; url?: string }>;
  removerFoto(fotoId: Id): Promise<Resultado>;

  // produção
  iniciarEtapa(etapaId: Id, responsavelId: Id): Promise<Resultado>;
  concluirEtapa(etapaId: Id, dados: DadosConclusaoEtapa): Promise<Resultado>;
  bloquearEtapa(etapaId: Id, motivo: string): Promise<Resultado>;
  retomarEtapa(etapaId: Id): Promise<Resultado>;
  dispensarEtapa(etapaId: Id, motivo: string): Promise<Resultado>;
  atribuirResponsavel(etapaId: Id, perfilId: Id): Promise<Resultado>;

  // ciclo da OS
  criarAtendimentoRapido(dados: NovoAtendimentoRapido): Promise<Resultado & { osId?: Id }>;
  registrarAprovacao(osId: Id, evidencia: string): Promise<Resultado>;
  registrarEntrada(osId: Id, tipoReparoId: Id, recepcao?: RecepcaoVeiculo): Promise<Resultado>;
  registrarEntrega(osId: Id): Promise<Resultado>;
  /**
   * Alerta próprio do carro (pedido do dono, 2º áudio): prazo em dias úteis (recalcula a entrega prometida a partir
   * da entrada, ou de hoje), "laranja/vermelho a partir de N dias úteis antes" e urgente (prioridade 2). `null` volta
   * o campo para a base. Inteiros 0–60 (valor_invalido + campo). Dono, gestor e recepção (podeEditarAlertaOS).
   */
  salvarAlertaOS(osId: Id, alerta: EntradaAlertaOS): Promise<Resultado>;

  // agenda
  /**
   * `encaixe` = a recepção confirmou passar da capacidade do dia (encaixe, sprint SG): só a falta de
   * vaga deixa de barrar; data passada, dia fechado e dia bloqueado continuam recusados.
   */
  agendar(osId: Id, data: DataISO, janela: Janela, encaixe?: boolean): Promise<Resultado>;
  reagendar(agendamentoId: Id, data: DataISO, janela: Janela, encaixe?: boolean): Promise<Resultado>;
  cancelarAgendamento(agendamentoId: Id, motivo: string): Promise<Resultado>;
  marcarNaoCompareceu(agendamentoId: Id): Promise<Resultado>;

  // pendências e financeiro
  concluirPendencia(pendenciaId: Id): Promise<Resultado>;
  aplicarBaixa(tituloId: Id, baixa: Omit<Baixa, "id">): Promise<Resultado>;
  pagarDespesa(despesaId: Id, valor: number, pagoEm: DataISO, forma?: FormaPagamento): Promise<Resultado>;

  // equipe, comissões e folha (sprint S1)
  /**
   * Cadastra (sem id) ou edita um funcionário (validarFuncionario). Quem gerencia a equipe (dono e gerente) muda
   * nome, função, telefone, admissão e ativo; a permissão (`papel`) só o dono (podeEditarPapel) e o salário só o
   * dono (podeEditarSalario) — senão `sem_permissao`. A oficina nunca fica sem dono ativo (`ultimo_dono`).
   * Login e senha não passam por aqui: definirLogin.
   */
  salvarFuncionario(entrada: FuncionarioEntrada): Promise<Resultado & { id?: Id }>;
  /**
   * Cria ou troca o login do funcionário (só o dono). No Supabase chama a Edge Function `equipe-login`, que usa a
   * service_role no servidor para criar/atualizar o usuário do Auth com o e-mail técnico emailDeLogin(usuario).
   * A senha nunca é guardada no painel nem na auditoria. Devolve o usuário normalizado e o e-mail técnico.
   */
  definirLogin(perfilId: Id, dados: DadosLogin): Promise<Resultado & { usuario?: string; email?: string }>;
  /** Tira o login (a pessoa deixa de entrar; o cadastro e o histórico ficam). Só o dono; não vale para si mesmo. */
  removerLogin(perfilId: Id): Promise<Resultado>;
  /** Cria ou edita uma regra de comissão (validarRegraComissao). Só o dono (podeEditarComissoes). */
  salvarRegraComissao(entrada: RegraComissaoEntrada): Promise<Resultado & { id?: Id }>;
  removerRegraComissao(id: Id): Promise<Resultado>;
  /**
   * Guarda o ajuste do mês (vale, desconto negativo, extra positivo) antes de pagar: rascunho de PagamentoFolha sem
   * `pagoEm`. Só o dono (podeEditarSalario); o financeiro paga com o ajuste que o dono deixou.
   */
  salvarAjusteFolha(perfilId: Id, mes: string, ajustes: Centavos, obs?: string): Promise<Resultado>;
  /**
   * Marca a folha do funcionário no mês como paga (pagarLinhaFolha) e lança a despesa paga em "Salários"
   * (despesaDaFolha). Dono e financeiro (podePagarFolha); `ajustes` diferente do salvo só o dono.
   */
  pagarFolha(perfilId: Id, mes: string, pagoEm: DataISO, ajustes?: Centavos): Promise<Resultado & { id?: Id; despesaId?: Id }>;

  // demonstração (grava uma linha de auditoria "restaurar"); no Supabase recusa com `so_na_demonstracao`
  restaurarDemo(): Promise<void>;

  /**
   * Tempo real (opcional): chama `aoMudar` quando OS, etapas, agenda, fotos ou pagamentos mudam em outro aparelho.
   * Devolve a função que cancela. Só o Supabase implementa (postgres_changes; a RLS filtra o que cada papel recebe).
   */
  assinarMudancas?(aoMudar: () => void): () => void;
}

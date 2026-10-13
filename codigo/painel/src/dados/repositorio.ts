import type {
  Agendamento,
  AtendimentoExterno,
  Baixa,
  CapacidadeDia,
  Cliente,
  ConfigOficina,
  DataISO,
  Despesa,
  EtapaOS,
  Foto,
  Id,
  Janela,
  Material,
  OrcamentoVersao,
  OS,
  Pagador,
  PendenciaExterna,
  Perfil,
  Tecnica,
  TipoReparo,
  TituloReceber,
  Veiculo,
} from "@compartilhado/tipos";

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
}

export interface NovoAtendimentoRapido {
  placa: string;
  modelo?: string;
  cor?: string;
  clienteNome: string;
  telefone?: string;
  origem: OS["origem"];
  seguradora?: string;
  protocolo?: string;
  pecas: { peca: string; tecnica: Tecnica; valor?: number }[];
  observacoes?: string;
}

export interface Resultado {
  ok: boolean;
  codigo?: string;
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
  registrarEntrada(osId: Id, tipoReparoId: Id): Promise<Resultado>;
  registrarEntrega(osId: Id): Promise<Resultado>;

  // agenda
  agendar(osId: Id, data: DataISO, janela: Janela): Promise<Resultado>;
  reagendar(agendamentoId: Id, data: DataISO, janela: Janela): Promise<Resultado>;
  cancelarAgendamento(agendamentoId: Id, motivo: string): Promise<Resultado>;
  marcarNaoCompareceu(agendamentoId: Id): Promise<Resultado>;

  // pendências e financeiro
  concluirPendencia(pendenciaId: Id): Promise<Resultado>;
  aplicarBaixa(tituloId: Id, baixa: Omit<Baixa, "id">): Promise<Resultado>;
  pagarDespesa(despesaId: Id, valor: number, pagoEm: DataISO): Promise<Resultado>;

  // demonstração
  restaurarDemo(): Promise<void>;
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Baixa, Centavos, ChecklistItem, DataISO, FormaPagamento, Id, Janela, RecepcaoVeiculo } from "@compartilhado/tipos";
import { ERRO } from "../dominio/rotulos";
import { repositorioMemoria } from "./repositorioMemoria";
import type {
  CategoriaEntrada,
  ClienteEntrada,
  ConfigParcial,
  DadosConclusaoEtapa,
  DadosLogin,
  DespesaEntrada,
  EntradaAlertaOS,
  FechamentoEntrada,
  FornecedorEntrada,
  FuncionarioEntrada,
  MaterialEntrada,
  MovimentoEntrada,
  NovoAtendimentoRapido,
  NovoCustoOS,
  NovaFoto,
  PagamentoOS,
  RegraComissaoEntrada,
  Repositorio,
  Resultado,
  TipoReparoEntrada,
  VeiculoEntrada,
} from "./repositorio";

/**
 * Hooks de dados — a ÚNICA forma de uma tela ler ou mudar dados (CLAUDE.md).
 * Hoje sobre o repositório em memória; no S1 troca para o RepositorioSupabase escolhendo por VITE_DADOS.
 */
export const repositorio: Repositorio = repositorioMemoria;

const CHAVE = ["oficina"] as const;

export const useOSs = () => useQuery({ queryKey: [...CHAVE, "os"], queryFn: () => repositorio.listarOS() });
export const useOS = (id: Id | undefined) =>
  useQuery({ queryKey: [...CHAVE, "os", id], queryFn: () => repositorio.obterOS(id!), enabled: Boolean(id) });
export const useAgendamentos = () => useQuery({ queryKey: [...CHAVE, "agendamentos"], queryFn: () => repositorio.listarAgendamentos() });
export const useCapacidade = (inicio: DataISO, fim: DataISO) =>
  useQuery({ queryKey: [...CHAVE, "capacidade", inicio, fim], queryFn: () => repositorio.listarCapacidade(inicio, fim) });
export const usePerfis = () => useQuery({ queryKey: [...CHAVE, "perfis"], queryFn: () => repositorio.listarPerfis() });
export const useTiposReparo = () => useQuery({ queryKey: [...CHAVE, "tipos"], queryFn: () => repositorio.listarTiposReparo() });
export const usePagadores = () => useQuery({ queryKey: [...CHAVE, "pagadores"], queryFn: () => repositorio.listarPagadores() });
export const useTitulos = () => useQuery({ queryKey: [...CHAVE, "titulos"], queryFn: () => repositorio.listarTitulos() });
export const useDespesas = () => useQuery({ queryKey: [...CHAVE, "despesas"], queryFn: () => repositorio.listarDespesas() });
export const useMateriais = () => useQuery({ queryKey: [...CHAVE, "materiais"], queryFn: () => repositorio.listarMateriais() });
export const useConfig = () => useQuery({ queryKey: [...CHAVE, "config"], queryFn: () => repositorio.obterConfig() });
export const useClientes = () => useQuery({ queryKey: [...CHAVE, "clientes"], queryFn: () => repositorio.listarClientes() });
export const useCliente = (id: Id | undefined) =>
  useQuery({ queryKey: [...CHAVE, "clientes", id], queryFn: () => repositorio.obterCliente(id!), enabled: Boolean(id) });
export const useVeiculos = () => useQuery({ queryKey: [...CHAVE, "veiculos"], queryFn: () => repositorio.listarVeiculos() });
export const useCustosOS = (osId: Id | undefined) =>
  useQuery({ queryKey: [...CHAVE, "custos", osId], queryFn: () => repositorio.listarCustosOS(osId!), enabled: Boolean(osId) });
export const useMovimentos = () => useQuery({ queryKey: [...CHAVE, "movimentos"], queryFn: () => repositorio.listarMovimentos() });
export const useFornecedores = () => useQuery({ queryKey: [...CHAVE, "fornecedores"], queryFn: () => repositorio.listarFornecedores() });
export const useCategorias = () => useQuery({ queryKey: [...CHAVE, "categorias"], queryFn: () => repositorio.listarCategorias() });
export const useFechamentos = () => useQuery({ queryKey: [...CHAVE, "fechamentos"], queryFn: () => repositorio.listarFechamentos() });
export const useAuditoria = () => useQuery({ queryKey: [...CHAVE, "auditoria"], queryFn: () => repositorio.listarAuditoria() });
// equipe (sprint S1)
export const useRegrasComissao = (habilitado = true) =>
  useQuery({ queryKey: [...CHAVE, "comissoes"], queryFn: () => repositorio.listarRegrasComissao(), enabled: habilitado });
/** Folha do mês: só para quem podeVerFolha (passe `habilitado` para não pedir o que a RLS recusa). */
export const useFolha = (mes: string, habilitado = true) =>
  useQuery({ queryKey: [...CHAVE, "folha", mes], queryFn: () => repositorio.listarFolha(mes), enabled: habilitado });
export const useHistoricoFuncionario = (perfilId: Id | undefined) =>
  useQuery({ queryKey: [...CHAVE, "historico", perfilId], queryFn: () => repositorio.historicoFuncionario(perfilId!), enabled: Boolean(perfilId) });

/** Relógio da tela: re-renderiza a cada `ms` para tempos e semáforos andarem sozinhos. */
export function useAgora(ms = 30_000): string {
  const [agora, setAgora] = useState(() => new Date().toISOString());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date().toISOString()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return agora;
}

/** Mensagem pt-BR para um código de erro do domínio/banco. */
export function mensagemErro(codigo?: string): string {
  return (codigo && ERRO[codigo]) || "Não foi possível concluir a ação. Tente de novo.";
}

/**
 * Ações (mutações). Cada uma devolve o Resultado; ao dar certo, invalida as consultas para
 * todas as telas (inclusive a TV) refletirem a mudança.
 */
export function useAcoes() {
  const qc = useQueryClient();
  const mut = <A extends unknown[], R extends Resultado = Resultado & { osId?: Id }>(fn: (...args: A) => Promise<R>) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMutation({
      mutationFn: (args: A) => fn(...args),
      onSuccess: (r) => {
        if (r.ok) qc.invalidateQueries({ queryKey: CHAVE });
      },
    });

  return {
    iniciarEtapa: mut((etapaId: Id, responsavelId: Id) => repositorio.iniciarEtapa(etapaId, responsavelId)),
    concluirEtapa: mut((etapaId: Id, dados: DadosConclusaoEtapa) => repositorio.concluirEtapa(etapaId, dados)),
    bloquearEtapa: mut((etapaId: Id, motivo: string) => repositorio.bloquearEtapa(etapaId, motivo)),
    retomarEtapa: mut((etapaId: Id) => repositorio.retomarEtapa(etapaId)),
    dispensarEtapa: mut((etapaId: Id, motivo: string) => repositorio.dispensarEtapa(etapaId, motivo)),
    atribuirResponsavel: mut((etapaId: Id, perfilId: Id) => repositorio.atribuirResponsavel(etapaId, perfilId)),
    criarAtendimentoRapido: mut((dados: NovoAtendimentoRapido) => repositorio.criarAtendimentoRapido(dados)),
    registrarAprovacao: mut((osId: Id, evidencia: string) => repositorio.registrarAprovacao(osId, evidencia)),
    registrarEntrada: mut((osId: Id, tipoReparoId: Id, recepcao?: RecepcaoVeiculo) => repositorio.registrarEntrada(osId, tipoReparoId, recepcao)),
    registrarEntrega: mut((osId: Id) => repositorio.registrarEntrega(osId)),
    salvarAlertaOS: mut((osId: Id, alerta: EntradaAlertaOS) => repositorio.salvarAlertaOS(osId, alerta)),
    agendar: mut((osId: Id, data: DataISO, janela: Janela, encaixe?: boolean) => repositorio.agendar(osId, data, janela, encaixe)),
    reagendar: mut((agendamentoId: Id, data: DataISO, janela: Janela, encaixe?: boolean) =>
      repositorio.reagendar(agendamentoId, data, janela, encaixe),
    ),
    cancelarAgendamento: mut((agendamentoId: Id, motivo: string) => repositorio.cancelarAgendamento(agendamentoId, motivo)),
    marcarNaoCompareceu: mut((agendamentoId: Id) => repositorio.marcarNaoCompareceu(agendamentoId)),
    concluirPendencia: mut((pendenciaId: Id) => repositorio.concluirPendencia(pendenciaId)),
    aplicarBaixa: mut((tituloId: Id, baixa: Omit<Baixa, "id">) => repositorio.aplicarBaixa(tituloId, baixa)),
    pagarDespesa: mut((despesaId: Id, valor: number, pagoEm: DataISO, forma?: FormaPagamento) =>
      repositorio.pagarDespesa(despesaId, valor, pagoEm, forma),
    ),
    // clientes, veículos e recepção
    salvarCliente: mut((cliente: ClienteEntrada) => repositorio.salvarCliente(cliente)),
    salvarVeiculo: mut((veiculo: VeiculoEntrada) => repositorio.salvarVeiculo(veiculo)),
    salvarRecepcao: mut((osId: Id, recepcao: RecepcaoVeiculo) => repositorio.salvarRecepcao(osId, recepcao)),
    // custos e pagamentos da OS
    lancarCusto: mut((osId: Id, custo: NovoCustoOS) => repositorio.lancarCusto(osId, custo)),
    removerCusto: mut((custoId: Id) => repositorio.removerCusto(custoId)),
    registrarPagamentoOS: mut((osId: Id, pagamento: PagamentoOS) => repositorio.registrarPagamentoOS(osId, pagamento)),
    // estoque
    movimentarEstoque: mut((mov: MovimentoEntrada) => repositorio.movimentarEstoque(mov)),
    salvarMaterial: mut((material: MaterialEntrada) => repositorio.salvarMaterial(material)),
    salvarFornecedor: mut((fornecedor: FornecedorEntrada) => repositorio.salvarFornecedor(fornecedor)),
    // financeiro e ajustes
    criarDespesa: mut((despesa: DespesaEntrada) => repositorio.criarDespesa(despesa)),
    salvarCategoria: mut((categoria: CategoriaEntrada) => repositorio.salvarCategoria(categoria)),
    fecharCaixa: mut((dados: FechamentoEntrada) => repositorio.fecharCaixa(dados)),
    salvarChecklistConfig: mut((itens: ChecklistItem[]) => repositorio.salvarChecklistConfig(itens)),
    salvarConfig: mut((parcial: ConfigParcial) => repositorio.salvarConfig(parcial)),
    salvarTipoReparo: mut((tipo: TipoReparoEntrada) => repositorio.salvarTipoReparo(tipo)),
    arquivarTipoReparo: mut((id: Id, arquivar: boolean) => repositorio.arquivarTipoReparo(id, arquivar)),
    // fotos: comprima antes com comprimirFoto (dados/fotos.ts); ok com codigo "fotos_temporarias" = aviso
    adicionarFoto: mut((osId: Id, foto: NovaFoto) => repositorio.adicionarFoto(osId, foto)),
    removerFoto: mut((fotoId: Id) => repositorio.removerFoto(fotoId)),
    // equipe, comissões e folha (sprint S1)
    salvarFuncionario: mut((entrada: FuncionarioEntrada) => repositorio.salvarFuncionario(entrada)),
    definirLogin: mut((perfilId: Id, dados: DadosLogin) => repositorio.definirLogin(perfilId, dados)),
    removerLogin: mut((perfilId: Id) => repositorio.removerLogin(perfilId)),
    salvarRegraComissao: mut((entrada: RegraComissaoEntrada) => repositorio.salvarRegraComissao(entrada)),
    removerRegraComissao: mut((id: Id) => repositorio.removerRegraComissao(id)),
    salvarAjusteFolha: mut((perfilId: Id, mes: string, ajustes: Centavos, obs?: string) => repositorio.salvarAjusteFolha(perfilId, mes, ajustes, obs)),
    pagarFolha: mut((perfilId: Id, mes: string, pagoEm: DataISO, ajustes?: Centavos) => repositorio.pagarFolha(perfilId, mes, pagoEm, ajustes)),
    restaurarDemo: mut(async () => {
      await repositorio.restaurarDemo();
      return { ok: true };
    }),
  };
}

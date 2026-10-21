import type { Agendamento, EtapaOS, Foto, Id, OrcamentoVersao, OS, Papel, Perfil, TipoReparo } from "@compartilhado/tipos";
import { COMPRESSAO_FOTO, FASES_FOTO_ETAPA, FASES_FOTO_INTERNA, expiracaoFoto } from "@compartilhado/dominio/fotos";
import { aplicarConfig } from "@compartilhado/dominio/config";
import { compararMarcos, paraMs, somarDias } from "@compartilhado/dominio/fuso";
import { resumoPagamentosCliente } from "@compartilhado/dominio/pagamentos";
import { validarFuncionario, validarMudancaPapel, validarUsuario } from "@compartilhado/dominio/equipe";
import { validarRegraComissao, type LinhaComissao } from "@compartilhado/dominio/comissoes";
import { calcularFolha, totaisFolha } from "@compartilhado/dominio/folha";
import { historicoFuncionario } from "@compartilhado/dominio/historicoFuncionario";
import { podeEditarComissoes, podeEditarPapel, podeEditarSalario } from "../dominio/permissoes";
import {
  BUCKET_FOTOS,
  EDGE_EQUIPE_LOGIN,
  RPC,
  caminhoFoto,
  codigoDoErro,
  deAgendamento,
  deAtendimento,
  deAuditoria,
  deCapacidade,
  deCategoria,
  deCliente,
  deConfig,
  deCusto,
  deDespesa,
  deEtapa,
  deFechamento,
  deFornecedor,
  deFoto,
  deMaterial,
  deMovimento,
  deOS,
  dePagador,
  dePagamentoFolha,
  dePendencia,
  dePerfil,
  deRegraComissao,
  deTipoReparo,
  deTitulo,
  deVeiculo,
  deVersao,
  etapasDeProducao,
  marco,
  paraCategoria,
  paraCliente,
  paraConfig,
  paraFornecedor,
  paraRegraComissao,
  paraVeiculo,
  SELECT_OS_VISAO,
  type CorpoEquipeLogin,
  type LinhaAgendamento,
  type LinhaAuditoria,
  type LinhaBloqueio,
  type LinhaCapacidade,
  type LinhaCategoria,
  type LinhaCliente,
  type LinhaConfigOficina,
  type LinhaCusto,
  type LinhaDespesa,
  type LinhaEquipe,
  type LinhaEtapa,
  type LinhaFechamento,
  type LinhaFornecedor,
  type LinhaFoto,
  type LinhaMaterial,
  type LinhaMovimento,
  type LinhaOSVisao,
  type LinhaPagador,
  type LinhaPagamentoFolha,
  type LinhaProducao,
  type LinhaRegraComissao,
  type LinhaTipoReparo,
  type LinhaTitulo,
  type LinhaVeiculo,
} from "./mapeamento";
import { limparChecklist, normalizarCliente, normalizarFornecedor, normalizarTelefone, normalizarVeiculo } from "./normalizar";
import type { ClienteSupabase } from "./supabase";
import { LIMITE_AUDITORIA, validarSenha, type ClienteFicha, type ClienteResumo, type FolhaDoMes, type OSVisao, type Repositorio, type Resultado } from "./repositorio";

/**
 * Repositório do banco real (sprint S1): a mesma interface do RepositorioMemoria, sobre o Supabase.
 *   - Leitura: selects com embedding (SELECT_OS_VISAO) e views de recorte. A RLS decide o que volta para cada papel;
 *     produção e TV leem vw_producao (sem cliente, telefone, valor nem seguradora) e recebem uma OSVisao reduzida.
 *   - Escrita de estado e dinheiro: funções do banco (supabase.rpc), que devolvem { ok, codigo?, campo?, id? }.
 *   - Cadastro simples (cliente, veículo, fornecedor, categoria, config, regra de comissão): insert/update direto;
 *     constraint violada → código de erro por codigoDoErro (mesmos códigos do ERRO de rotulos.ts).
 *   - Fotos: Storage privado "fotos" (sobe o arquivo e a miniatura, depois adicionar_foto); leitura por URL assinada.
 *   - Login da equipe: Edge Function equipe-login (a senha só passa nessa chamada; nunca é guardada).
 * Erro de leitura vira exceção com o código (a tela mostra "Tentar de novo"); erro de escrita vira { ok: false, codigo }.
 */

/** Erro de leitura com código de ERRO (rotulos.ts). */
export class ErroDados extends Error {
  readonly codigo: string;
  constructor(codigo: string, detalhe?: string) {
    super(detalhe ? `${codigo}: ${detalhe}` : codigo);
    this.name = "ErroDados";
    this.codigo = codigo;
  }
}

type ErroPostgrest = { code?: string; message?: string; details?: string | null } | null;
type Resposta = { data: unknown; error: ErroPostgrest };

/** Quem está logado (perfil ativo com login). */
interface Contexto {
  perfilId: Id;
  oficinaId: Id;
  papel: Papel;
}

/** Validade das URLs assinadas das fotos (1 h); renovadas quando faltam menos de 10 min. */
const VALIDADE_URL_S = 3600;
const RENOVAR_ANTES_MS = 10 * 60_000;

const PAPEIS_QUADRO: readonly Papel[] = ["producao", "dispositivo"];

/** Tabelas que, ao mudar, atualizam as telas abertas (tempo real; precisa da publicação supabase_realtime no banco). */
export const TABELAS_TEMPO_REAL = ["os", "etapa_os", "bloqueio_etapa", "agendamento", "foto", "pendencia_externa", "titulo_receber", "baixa"] as const;

/** uuid v4 (crypto.randomUUID só existe em contexto seguro; no celular pela rede local, http, não). */
export function novoUuid(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** jsonb { ok, codigo?, campo?, id?, ... } da função → Resultado (campos vazios saem). */
export function comoResultado(data: unknown): Resultado & Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, codigo: "erro_desconhecido" };
  const { ok, codigo, campo, ...resto } = data as Record<string, unknown>;
  return {
    ...resto,
    ok: ok === true,
    ...(typeof codigo === "string" && codigo ? { codigo } : ok === true ? {} : { codigo: "erro_desconhecido" }),
    ...(typeof campo === "string" && campo ? { campo } : {}),
  };
}

/** Erro do upload no Storage → código. */
function codigoDoUpload(erro: { message?: string; status?: number; statusCode?: string | number } | null): string {
  const status = Number(erro?.status ?? erro?.statusCode ?? 0);
  const msg = erro?.message ?? "";
  // o bucket "fotos" aceita até 2 MB (COMPRESSAO_FOTO.maxBytesSalva)
  if (status === 413 || /maximum allowed size|too large|payload too large/i.test(msg)) return "foto_acima_limite";
  if (status === 415 || /mime/i.test(msg)) return "arquivo_invalido";
  if (status === 401 || status === 403 || /row-level security|unauthorized|not authorized/i.test(msg)) return "sem_permissao";
  return "falha_envio_foto";
}

const ehImagem = (b: unknown): b is Blob => typeof Blob !== "undefined" && b instanceof Blob && b.size > 0 && b.type.startsWith("image/");

/** Proposta da Calia vencida não conta como agendamento ativo (igual ao repositório em memória). */
function agendamentoAtivo(a: Agendamento, agoraMs: number): boolean {
  if (a.estado === "confirmado") return true;
  if (a.estado === "proposto") return !a.expiraEm || paraMs(a.expiraEm) > agoraMs;
  return false;
}

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export function criarRepositorioSupabase(sb: ClienteSupabase): Repositorio {
  // ------------------------------------------------------------ contexto da sessão

  let contextoPromessa: Promise<Contexto> | null = null;
  const urls = new Map<string, { url: string; expira: number }>();
  // trocou de usuário (ou saiu): esquece o contexto e as URLs assinadas
  sb.auth.onAuthStateChange((evento) => {
    if (evento === "TOKEN_REFRESHED") return;
    contextoPromessa = null;
    urls.clear();
  });

  function contexto(): Promise<Contexto> {
    contextoPromessa ??= (async () => {
      const { data: s } = await sb.auth.getSession();
      const uid = s.session?.user.id;
      if (!uid) throw new ErroDados("sem_sessao");
      const r = (await sb
        .from("perfil")
        .select("id, oficina_id, papel, ativo, login_desativado_em")
        .eq("auth_user_id", uid)
        .maybeSingle()) as Resposta;
      if (r.error) throw new ErroDados(codigoDoErro(r.error), r.error.message);
      const p = r.data as { id: Id; oficina_id: Id; papel: Papel; ativo: boolean; login_desativado_em: string | null } | null;
      if (!p || !p.ativo || p.login_desativado_em) throw new ErroDados("sem_permissao");
      return { perfilId: p.id, oficinaId: p.oficina_id, papel: p.papel };
    })().catch((e) => {
      contextoPromessa = null;
      throw e;
    });
    return contextoPromessa;
  }

  /** Resposta de leitura → dado (ou exceção com código). */
  async function ler<T>(consulta: PromiseLike<Resposta>): Promise<T> {
    const { data, error } = await consulta;
    if (error) throw new ErroDados(codigoDoErro(error), error.message);
    return data as T;
  }

  /** Chama uma função do banco. Erro do PostgREST (rede, permissão) também vira Resultado. */
  async function rpc([nome, params]: readonly [string, Record<string, unknown>]): Promise<Resultado & Record<string, unknown>> {
    const { data, error } = (await sb.rpc(nome, params)) as Resposta;
    if (error) return { ok: false, codigo: codigoDoErro(error) };
    return comoResultado(data);
  }

  /** Insert/update direto que devolve o id gravado; 0 linhas (RLS ou não existe) → `naoAchou`. */
  async function gravar(consulta: PromiseLike<Resposta>, naoAchou: string): Promise<Resultado & { id?: Id }> {
    const { data, error } = await consulta;
    if (error) return { ok: false, codigo: codigoDoErro(error) };
    const linhas = (Array.isArray(data) ? data : data ? [data] : []) as { id: Id }[];
    if (!linhas.length) return { ok: false, codigo: naoAchou };
    return { ok: true, id: linhas[0].id };
  }

  /** Edge Function equipe-login: a resposta de erro (4xx) traz { ok: false, codigo } no corpo. */
  async function equipeLogin(corpo: CorpoEquipeLogin): Promise<Resultado & Record<string, unknown>> {
    const { data, error } = await sb.functions.invoke(EDGE_EQUIPE_LOGIN, { body: corpo });
    if (!error) return comoResultado(data);
    const resposta = (error as { context?: unknown }).context;
    if (resposta && typeof (resposta as Response).json === "function") {
      try {
        const corpoErro = await (resposta as Response).clone().json();
        if (corpoErro && typeof corpoErro === "object" && "codigo" in corpoErro) return comoResultado(corpoErro);
      } catch {
        /* corpo sem JSON: cai no status */
      }
      if ((resposta as Response).status === 404) return { ok: false, codigo: "login_indisponivel" };
    }
    if ((error as Error).name === "FunctionsFetchError") {
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      return { ok: false, codigo: offline ? "sem_conexao" : "login_indisponivel" };
    }
    if ((error as Error).name === "FunctionsRelayError") return { ok: false, codigo: "login_indisponivel" };
    return { ok: false, codigo: "erro_desconhecido" };
  }

  // ------------------------------------------------------------ fotos: URLs assinadas em lote, com cache

  async function assinar(caminhos: (string | null | undefined)[]): Promise<Map<string, string>> {
    const agora = Date.now();
    const unicos = [...new Set(caminhos.filter((c): c is string => Boolean(c)))];
    const faltam = unicos.filter((c) => {
      const u = urls.get(c);
      return !u || u.expira - agora < RENOVAR_ANTES_MS;
    });
    for (let i = 0; i < faltam.length; i += 200) {
      const lote = faltam.slice(i, i + 200);
      const { data, error } = await sb.storage.from(BUCKET_FOTOS).createSignedUrls(lote, VALIDADE_URL_S);
      if (error) {
        // sem URL a tela mostra "foto indisponível"; a próxima leitura tenta de novo
        console.warn("[fotos] não consegui assinar as URLs", error.message);
        continue;
      }
      for (const d of data ?? []) if (d.path && d.signedUrl) urls.set(d.path, { url: d.signedUrl, expira: agora + VALIDADE_URL_S * 1000 });
    }
    const mapa = new Map<string, string>();
    for (const c of unicos) {
      const u = urls.get(c);
      if (u) mapa.set(c, u.url);
    }
    return mapa;
  }

  function fotoLida(l: LinhaFoto, os: Pick<OS, "entregueEm" | "previsaoEntrega"> | undefined, assinadas: Map<string, string>): Foto {
    const url = l.url_externa ?? (l.caminho ? (assinadas.get(l.caminho) ?? "") : "");
    const miniaturaUrl = l.caminho_miniatura ? (assinadas.get(l.caminho_miniatura) ?? url) : undefined;
    const foto = deFoto(l, { url, miniaturaUrl });
    const { expiraEm, provisorio } = expiracaoFoto(foto, os);
    return { ...foto, expiraEm, expiraProvisorio: provisorio };
  }

  const caminhosDe = (fotos: LinhaFoto[]) => fotos.flatMap((f) => (f.url_externa ? [] : [f.caminho, f.caminho_miniatura]));

  // ------------------------------------------------------------ OSVisao

  /** Linha do select com embedding → OSVisao (fotos removidas ficam de fora; agendamento = o ativo mais próximo). */
  function visaoDe(l: LinhaOSVisao, assinadas: Map<string, string>, agoraMs: number): OSVisao | null {
    if (!l.veiculo || !l.cliente) return null;
    const vinculos = (l.os_atendimento_externo ?? []).flatMap((x) => (x.atendimento_externo ? [x.atendimento_externo] : []));
    const os = deOS(l, vinculos.map((a) => a.id));
    const agendamento = (l.agendamento ?? [])
      .map(deAgendamento)
      .filter((a) => agendamentoAtivo(a, agoraMs))
      .sort((a, b) => a.data.localeCompare(b.data))[0];
    return {
      os,
      veiculo: deVeiculo(l.veiculo),
      cliente: deCliente(l.cliente),
      atendimentos: vinculos.map(deAtendimento),
      versoes: (l.orcamento_versao ?? []).map(deVersao).sort((a, b) => b.numeroVersao - a.numeroVersao),
      etapas: (l.etapa_os ?? []).map(deEtapa).sort((a, b) => a.ordem - b.ordem),
      tipoReparo: l.tipo_reparo ? deTipoReparo(l.tipo_reparo) : undefined,
      agendamento,
      pendencias: (l.pendencia_externa ?? []).map(dePendencia),
      titulos: (l.titulo_receber ?? []).map(deTitulo),
      fotos: (l.foto ?? []).filter((f) => !f.removida_em).map((f) => fotoLida(f, os, assinadas)),
      custos: (l.custo_os ?? []).map(deCusto).sort((a, b) => compararMarcos(a.lancadoEm, b.lancadoEm)),
    };
  }

  async function visoes(linhas: LinhaOSVisao[]): Promise<OSVisao[]> {
    const assinadas = await assinar(linhas.flatMap((l) => caminhosDe((l.foto ?? []).filter((f) => !f.removida_em))));
    const agora = Date.now();
    return linhas.map((l) => visaoDe(l, assinadas, agora)).filter((v): v is OSVisao => v !== null);
  }

  /**
   * OSVisao reduzida da produção e da TV (vw_producao): sem cliente, valores, títulos, custos nem seguradora.
   * As peças entram como uma versão "aprovada" com valor 0 (o quadro mostra peça e técnica, nunca valor).
   */
  function visaoProducao(l: LinhaProducao, tipos: TipoReparo[], fotos: Foto[]): OSVisao {
    const criadoEm = marco(l.criado_em)!;
    const os: OS = {
      id: l.id,
      numero: l.numero,
      veiculoId: l.veiculo_id,
      clienteId: "",
      tipoReparoId: l.tipo_reparo_id ?? undefined,
      origem: l.origem,
      estado: l.estado,
      prioridade: l.prioridade,
      atendimentosExternos: [],
      previsaoEntrega: l.previsao_entrega ?? undefined,
      entradaRealEm: marco(l.entrada_real_em),
      prontaEm: marco(l.pronta_em),
      box: l.box ?? undefined,
      alerta: l.alerta ?? undefined,
      criadoEm,
      atualizadoEm: marco(l.atualizado_em)!,
    };
    const versao: OrcamentoVersao = {
      id: `${l.id}-pecas`,
      osId: l.id,
      tipo: "interno",
      numeroVersao: 1,
      fonte: "manual",
      estado: "aprovado",
      itens: (l.pecas ?? []).map((p) => ({ id: p.id, peca: p.peca, tecnica: p.tecnica, valor: 0, statusItem: p.statusItem })),
      criadoEm,
    };
    const tipo = l.tipo_reparo_id
      ? (tipos.find((t) => t.id === l.tipo_reparo_id) ?? { id: l.tipo_reparo_id, nome: l.tipo_reparo_nome ?? "", etapas: [], provisorio: false })
      : undefined;
    return {
      os,
      veiculo: { id: l.veiculo_id, placa: l.placa, marca: l.marca ?? undefined, modelo: l.modelo ?? undefined, cor: l.cor ?? undefined },
      cliente: { id: "", nome: "" },
      atendimentos: [],
      versoes: l.pecas?.length ? [versao] : [],
      etapas: etapasDeProducao(l).sort((a, b) => a.ordem - b.ordem),
      tipoReparo: tipo,
      agendamento: l.agendada_para
        ? { id: `${l.id}-agenda`, osId: l.id, data: l.agendada_para, janela: l.agendada_janela ?? "manha", estado: "confirmado", origem: "recepcao" }
        : undefined,
      pendencias: [],
      titulos: [],
      fotos: fotos.filter((f) => f.osId === l.id),
      custos: [],
    };
  }

  async function listarProducao(c: Contexto, id?: Id): Promise<OSVisao[]> {
    let q = sb.from("vw_producao").select("*").order("numero");
    if (id) q = q.eq("id", id);
    const [linhas, tipos] = await Promise.all([ler<LinhaProducao[]>(q), repo.listarTiposReparo()]);
    let fotos: Foto[] = [];
    // a produção lê as fotos das OS do quadro; a TV não lê fotos
    if (c.papel === "producao" && linhas.length) {
      const lf = await ler<LinhaFoto[]>(
        sb
          .from("foto")
          .select("*")
          .in(
            "os_id",
            linhas.map((l) => l.id),
          )
          .is("removida_em", null),
      );
      const assinadas = await assinar(caminhosDe(lf));
      const porId = new Map(linhas.map((l) => [l.id, l]));
      fotos = lf.map((f) => {
        const l = porId.get(f.os_id);
        return fotoLida(f, l ? { previsaoEntrega: l.previsao_entrega ?? undefined } : undefined, assinadas);
      });
    }
    return linhas.map((l) => visaoProducao(l, tipos, fotos));
  }

  const selectOS = () => sb.from("os").select(SELECT_OS_VISAO).is("foto.removida_em", null);

  // ------------------------------------------------------------ equipe e folha

  async function folhaDoMes(mes: string): Promise<FolhaDoMes> {
    if (!MES.test(mes)) throw new ErroDados("data_invalida", mes);
    const [perfis, comissoesBrutas, pagamentos] = await Promise.all([
      repo.listarPerfis(),
      ler<{ perfil_id: Id; os_id: Id; placa: string | null; etapa_id: Id; etapa: string; concluida_em: string; valor: number; regra_id: Id }[]>(
        sb.rpc(...RPC.comissoesDoMes(mes)),
      ),
      ler<LinhaPagamentoFolha[]>(sb.from("pagamento_folha").select("*").eq("mes", mes)),
    ]);
    const comissoes: LinhaComissao[] = (comissoesBrutas ?? []).map((l) => ({
      perfilId: l.perfil_id,
      osId: l.os_id,
      ...(l.placa ? { placa: l.placa } : {}),
      etapaId: l.etapa_id,
      etapa: l.etapa,
      concluidaEm: marco(l.concluida_em)!,
      valor: Number(l.valor),
      regraId: l.regra_id,
    }));
    const linhas = calcularFolha(perfis, comissoes, mes, undefined, pagamentos.map(dePagamentoFolha));
    return { mes, linhas, comissoes, totais: totaisFolha(linhas) };
  }

  // ------------------------------------------------------------ o repositório

  const repo: Repositorio & { assinarMudancas: (aoMudar: () => void) => () => void } = {
    async listarOS() {
      const c = await contexto();
      if (PAPEIS_QUADRO.includes(c.papel)) return listarProducao(c);
      return visoes(await ler<LinhaOSVisao[]>(selectOS().order("numero")));
    },
    async obterOS(id) {
      const c = await contexto();
      if (PAPEIS_QUADRO.includes(c.papel)) return (await listarProducao(c, id))[0] ?? null;
      const linha = await ler<LinhaOSVisao | null>(selectOS().eq("id", id).maybeSingle());
      return linha ? ((await visoes([linha]))[0] ?? null) : null;
    },
    async listarAgendamentos() {
      return (await ler<LinhaAgendamento[]>(sb.from("agendamento").select("*").order("data"))).map(deAgendamento);
    },
    async listarCapacidade(inicio, fim) {
      const [config, excecoes] = await Promise.all([
        repo.obterConfig(),
        ler<LinhaCapacidade[]>(sb.from("capacidade_dia").select("data, vagas_entrada, bloqueado").gte("data", inicio).lte("data", fim)),
      ]);
      const porData = new Map(excecoes.map((l) => [l.data, deCapacidade(l)]));
      const dias = [];
      for (let data = inicio; data <= fim; data = somarDias(data, 1)) dias.push(porData.get(data) ?? { data, vagasEntrada: config.capacidadePadrao.vagasEntrada });
      return dias;
    },
    async listarPerfis() {
      return (await ler<LinhaEquipe[]>(sb.from("vw_equipe").select("*").order("nome"))).map(dePerfil);
    },
    async listarTiposReparo() {
      return (await ler<LinhaTipoReparo[]>(sb.from("tipo_reparo").select("*").order("ordem").order("nome"))).map(deTipoReparo);
    },
    async listarPagadores() {
      return (await ler<LinhaPagador[]>(sb.from("pagador").select("*").order("nome"))).map(dePagador);
    },
    async listarTitulos() {
      return (await ler<LinhaTitulo[]>(sb.from("titulo_receber").select("*, baixa(*)").order("vencimento"))).map(deTitulo);
    },
    async listarDespesas() {
      return (await ler<LinhaDespesa[]>(sb.from("despesa").select("*").order("vencimento"))).map(deDespesa);
    },
    async listarMateriais() {
      return (await ler<LinhaMaterial[]>(sb.from("vw_material").select("*").order("nome"))).map(deMaterial);
    },
    async obterConfig() {
      const [linha, regras] = await Promise.all([
        ler<LinhaConfigOficina | null>(sb.from("config_oficina").select("*").maybeSingle()),
        ler<LinhaRegraComissao[]>(sb.from("vw_regra_comissao").select("*").order("criado_em")),
      ]);
      if (!linha) throw new ErroDados("config_nao_encontrada");
      return deConfig(linha, regras.map(deRegraComissao));
    },
    async listarClientes() {
      const [linhas, pagadores] = await Promise.all([
        ler<(LinhaCliente & { veiculo: LinhaVeiculo[]; os: { id: Id; criado_em: string; titulo_receber: LinhaTitulo[] }[] })[]>(
          sb.from("cliente").select("*, veiculo(*), os(id, criado_em, titulo_receber(*, baixa(*)))"),
        ),
        repo.listarPagadores(),
      ]);
      return linhas
        .map(
          (l): ClienteResumo => ({
            cliente: deCliente(l),
            veiculos: (l.veiculo ?? []).map(deVeiculo),
            quantidadeOS: (l.os ?? []).length,
            ultimaOSEm: (l.os ?? []).map((o) => marco(o.criado_em)!).sort(compararMarcos).at(-1),
            totalPago: resumoPagamentosCliente((l.os ?? []).flatMap((o) => (o.titulo_receber ?? []).map(deTitulo)), pagadores).recebido,
          }),
        )
        .sort((a, b) => a.cliente.nome.localeCompare(b.cliente.nome, "pt-BR"));
    },
    async obterCliente(id): Promise<ClienteFicha | null> {
      const [linha, pagadores] = await Promise.all([
        ler<(LinhaCliente & { veiculo: LinhaVeiculo[] }) | null>(sb.from("cliente").select("*, veiculo(*)").eq("id", id).maybeSingle()),
        repo.listarPagadores(),
      ]);
      if (!linha) return null;
      const oss = (await visoes(await ler<LinhaOSVisao[]>(selectOS().eq("cliente_id", id)))).sort((a, b) => compararMarcos(b.os.criadoEm, a.os.criadoEm));
      const titulos = oss.flatMap((v) => v.titulos);
      const resumo = resumoPagamentosCliente(titulos, pagadores);
      return {
        cliente: deCliente(linha),
        veiculos: (linha.veiculo ?? []).map(deVeiculo),
        quantidadeOS: oss.length,
        ultimaOSEm: oss[0]?.os.criadoEm,
        totalPago: resumo.recebido,
        oss,
        saldoEmAberto: resumo.saldo,
      };
    },
    async listarVeiculos() {
      return (await ler<LinhaVeiculo[]>(sb.from("veiculo").select("*").order("placa"))).map(deVeiculo);
    },
    async listarCustosOS(osId) {
      return (await ler<LinhaCusto[]>(sb.from("custo_os").select("*").eq("os_id", osId).order("lancado_em"))).map(deCusto);
    },
    async listarMovimentos() {
      return (await ler<LinhaMovimento[]>(sb.from("vw_movimento_estoque").select("*").order("em", { ascending: false }))).map(deMovimento);
    },
    async listarFornecedores() {
      return (await ler<LinhaFornecedor[]>(sb.from("fornecedor").select("*")))
        .map(deFornecedor)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
    async listarCategorias() {
      return (await ler<LinhaCategoria[]>(sb.from("categoria_financeira").select("*").order("nome"))).map(deCategoria);
    },
    async listarFechamentos() {
      return (await ler<LinhaFechamento[]>(sb.from("fechamento_caixa").select("*").order("data", { ascending: false }))).map(deFechamento);
    },
    async listarAuditoria() {
      return (
        await ler<LinhaAuditoria[]>(
          sb
            .from("vw_auditoria")
            .select("id, em, perfil_id, envolvido_id, acao, entidade, entidade_id, resumo")
            .order("em", { ascending: false })
            .limit(LIMITE_AUDITORIA),
        )
      ).map(deAuditoria);
    },

    // ------------------------------------------------------------ equipe, comissões e folha (leitura)
    async listarRegrasComissao() {
      return (await ler<LinhaRegraComissao[]>(sb.from("vw_regra_comissao").select("*").order("criado_em"))).map(deRegraComissao);
    },
    listarFolha: folhaDoMes,
    async historicoFuncionario(perfilId) {
      const [oss, auditoria] = await Promise.all([
        ler<
          {
            id: Id;
            tipo_reparo_id: Id | null;
            estado: OS["estado"];
            veiculo: { placa: string } | null;
            etapa_os: (LinhaEtapa & { bloqueio_etapa?: LinhaBloqueio[] })[];
            foto: Pick<LinhaFoto, "id" | "os_id" | "etapa_id" | "autor_id" | "tirada_em" | "origem" | "removida_em">[];
          }[]
        >(
          sb
            .from("os")
            .select("id, tipo_reparo_id, estado, veiculo(placa), etapa_os(*, bloqueio_etapa(*)), foto(id, os_id, etapa_id, autor_id, tirada_em, origem, removida_em)")
            .is("foto.removida_em", null),
        ),
        ler<LinhaAuditoria[]>(
          sb
            .from("vw_auditoria")
            .select("id, em, perfil_id, envolvido_id, acao, entidade, entidade_id, resumo")
            .eq("perfil_id", perfilId)
            .order("em", { ascending: false })
            .limit(LIMITE_AUDITORIA),
        ),
      ]);
      const lista = oss.map((o) => ({
        os: { id: o.id, tipoReparoId: o.tipo_reparo_id ?? undefined, estado: o.estado },
        veiculo: o.veiculo ? { placa: o.veiculo.placa } : undefined,
        etapas: (o.etapa_os ?? []).map(deEtapa) as EtapaOS[],
        fotos: (o.foto ?? [])
          .filter((f) => !f.removida_em)
          .map((f) => ({ id: f.id, osId: f.os_id, etapaId: f.etapa_id ?? undefined, autorId: f.autor_id ?? undefined, tiradaEm: marco(f.tirada_em)!, origem: f.origem })),
      }));
      return historicoFuncionario(perfilId, lista, auditoria.map(deAuditoria));
    },

    // ------------------------------------------------------------ produção
    iniciarEtapa: (etapaId, responsavelId) => rpc(RPC.iniciarEtapa(etapaId, responsavelId)),
    concluirEtapa: (etapaId, dados) => rpc(RPC.concluirEtapa(etapaId, dados.pecasFeitas, dados.fotoIds)),
    bloquearEtapa: (etapaId, motivo) => rpc(RPC.bloquearEtapa(etapaId, motivo)),
    retomarEtapa: (etapaId) => rpc(RPC.retomarEtapa(etapaId)),
    dispensarEtapa: (etapaId, motivo) => rpc(RPC.dispensarEtapa(etapaId, motivo)),
    atribuirResponsavel: (etapaId, perfilId) => rpc(RPC.atribuirResponsavel(etapaId, perfilId)),

    // ------------------------------------------------------------ ciclo da OS
    async criarAtendimentoRapido(dados) {
      const r = await rpc(RPC.criarAtendimentoRapido(dados));
      const osId = typeof r.osId === "string" ? r.osId : r.ok && typeof r.id === "string" ? r.id : undefined;
      return { ok: r.ok, ...(r.codigo ? { codigo: r.codigo } : {}), ...(osId ? { osId } : {}) };
    },
    registrarAprovacao: (osId, evidencia) => rpc(RPC.registrarAprovacao(osId, evidencia)),
    registrarEntrada: (osId, tipoReparoId, recepcao) => rpc(RPC.registrarEntrada(osId, tipoReparoId, recepcao)),
    registrarEntrega: (osId) => rpc(RPC.registrarEntrega(osId)),
    salvarRecepcao: (osId, recepcao) => rpc(RPC.salvarRecepcao(osId, recepcao)),
    salvarAlertaOS: (osId, alerta) => rpc(RPC.salvarAlertaOS(osId, alerta)),

    // ------------------------------------------------------------ agenda
    agendar: (osId, data, janela, encaixe = false) => rpc(RPC.agendar(osId, data, janela, encaixe)),
    reagendar: (agendamentoId, data, janela, encaixe = false) => rpc(RPC.reagendar(agendamentoId, data, janela, encaixe)),
    cancelarAgendamento: (agendamentoId, motivo) => rpc(RPC.cancelarAgendamento(agendamentoId, motivo)),
    marcarNaoCompareceu: (agendamentoId) => rpc(RPC.marcarNaoCompareceu(agendamentoId)),

    // ------------------------------------------------------------ pendências e financeiro
    concluirPendencia: (pendenciaId) => rpc(RPC.concluirPendencia(pendenciaId)),
    aplicarBaixa: (tituloId, baixa) => rpc(RPC.aplicarBaixa(tituloId, baixa)),
    pagarDespesa: (despesaId, valor, pagoEm, forma) => rpc(RPC.pagarDespesa(despesaId, valor, pagoEm, forma)),

    // ------------------------------------------------------------ clientes, veículos e recepção
    async salvarCliente(entrada) {
      const { id, ...dados } = entrada;
      const r = normalizarCliente(dados);
      if (!r.ok) return r;
      const linha: Partial<ReturnType<typeof paraCliente>> = paraCliente(r.cliente);
      // edição sem proveniência na entrada não apaga a que já está gravada
      if (id && !("proveniencia" in entrada)) delete linha.proveniencia;
      return id
        ? gravar(sb.from("cliente").update(linha).eq("id", id).select("id"), "cliente_nao_encontrado")
        : gravar(sb.from("cliente").insert(linha).select("id"), "sem_permissao");
    },
    async salvarVeiculo(entrada) {
      const { id, ...dados } = entrada;
      const r = normalizarVeiculo(dados);
      if (!r.ok) return r;
      const linha: Partial<ReturnType<typeof paraVeiculo>> = paraVeiculo(r.veiculo);
      if (id && !("proveniencia" in entrada)) delete linha.proveniencia;
      const g = id
        ? await gravar(sb.from("veiculo").update(linha).eq("id", id).select("id"), "veiculo_nao_encontrado")
        : await gravar(sb.from("veiculo").insert(linha).select("id"), "sem_permissao");
      // chave estrangeira do cliente: o cliente escolhido não existe mais
      return g.codigo === "registro_relacionado" ? { ok: false, codigo: "cliente_nao_encontrado" } : g;
    },

    // ------------------------------------------------------------ custos e pagamentos da OS
    lancarCusto: (osId, custo) => rpc(RPC.lancarCusto(osId, custo)),
    removerCusto: (custoId) => rpc(RPC.removerCusto(custoId)),
    registrarPagamentoOS: (osId, pagamento) => rpc(RPC.registrarPagamentoOS(osId, pagamento)),

    // ------------------------------------------------------------ estoque
    movimentarEstoque: (mov) => rpc(RPC.movimentarEstoque(mov)),
    salvarMaterial: (material) => rpc(RPC.salvarMaterial(material)),
    async salvarFornecedor(entrada) {
      const { id, ...dados } = entrada;
      const r = normalizarFornecedor(dados);
      if (!r.ok) return r;
      const linha = paraFornecedor(r.fornecedor);
      return id
        ? gravar(sb.from("fornecedor").update(linha).eq("id", id).select("id"), "fornecedor_nao_encontrado")
        : gravar(sb.from("fornecedor").insert(linha).select("id"), "sem_permissao");
    },

    // ------------------------------------------------------------ financeiro e ajustes
    criarDespesa: (despesa) => rpc(RPC.criarDespesa(despesa)),
    async salvarCategoria(entrada) {
      const { id, ...dados } = entrada;
      const nome = dados.nome?.trim();
      if (!nome) return { ok: false, codigo: "nome_obrigatorio" };
      if (dados.tipo !== "receita" && dados.tipo !== "despesa") return { ok: false, codigo: "categoria_invalida" };
      const linha = paraCategoria({ ...dados, nome });
      return id
        ? gravar(sb.from("categoria_financeira").update(linha).eq("id", id).select("id"), "categoria_invalida")
        : gravar(sb.from("categoria_financeira").insert(linha).select("id"), "sem_permissao");
    },
    fecharCaixa: (dados) => rpc(RPC.fecharCaixa(dados)),
    async salvarChecklistConfig(itens) {
      const r = limparChecklist(itens, () => `ck-${novoUuid().slice(0, 8)}`);
      if (!r.ok) return r;
      const c = await contexto();
      const g = await gravar(sb.from("config_oficina").update({ checklist: r.itens }).eq("oficina_id", c.oficinaId).select("id"), "sem_permissao");
      return g.ok ? { ok: true } : g;
    },
    async salvarConfig(parcial) {
      const [atual, c] = await Promise.all([repo.obterConfig(), contexto()]);
      const r = aplicarConfig(atual, parcial);
      if (!r.ok) return { ok: false, codigo: r.codigo, campo: r.campo };
      const g = await gravar(sb.from("config_oficina").update(paraConfig(r.config)).eq("oficina_id", c.oficinaId).select("id"), "sem_permissao");
      return g.ok ? { ok: true } : g;
    },
    salvarTipoReparo: (tipo) => rpc(RPC.salvarTipoReparo(tipo)),
    arquivarTipoReparo: (id, arquivar) => rpc(RPC.arquivarTipoReparo(id, arquivar)),

    // ------------------------------------------------------------ fotos
    async adicionarFoto(osId, nova) {
      if (!FASES_FOTO_INTERNA.includes(nova.fase)) return { ok: false, codigo: "fase_invalida" };
      if (nova.etapaId && !FASES_FOTO_ETAPA.includes(nova.fase)) return { ok: false, codigo: "fase_invalida" };
      if (!ehImagem(nova.arquivo) || !ehImagem(nova.miniatura)) return { ok: false, codigo: "arquivo_invalido" };
      if (nova.arquivo.size > COMPRESSAO_FOTO.maxBytesSalva || nova.miniatura.size > COMPRESSAO_FOTO.maxBytesSalva) return { ok: false, codigo: "foto_acima_limite" };
      let c: Contexto;
      try {
        c = await contexto();
      } catch (e) {
        return { ok: false, codigo: e instanceof ErroDados ? e.codigo : "erro_desconhecido" };
      }
      const id = novoUuid();
      const caminho = caminhoFoto(c.oficinaId, osId, id);
      const caminhoMiniatura = caminhoFoto(c.oficinaId, osId, id, true);
      const balde = sb.storage.from(BUCKET_FOTOS);
      const opcoes = (b: Blob) => ({ contentType: b.type, upsert: false, cacheControl: "31536000" });
      const enviada = await balde.upload(caminho, nova.arquivo, opcoes(nova.arquivo));
      if (enviada.error) return { ok: false, codigo: codigoDoUpload(enviada.error as never) };
      const mini = await balde.upload(caminhoMiniatura, nova.miniatura, opcoes(nova.miniatura));
      if (mini.error) {
        await balde.remove([caminho]);
        return { ok: false, codigo: codigoDoUpload(mini.error as never) };
      }
      const r = await rpc(
        RPC.adicionarFoto(osId, {
          id,
          fase: nova.fase,
          etapaId: nova.etapaId,
          legenda: nova.legenda?.trim().slice(0, 120) || undefined,
          caminho,
          caminhoMiniatura,
          bytes: nova.arquivo.size,
          largura: nova.largura,
          altura: nova.altura,
        }),
      );
      if (!r.ok) {
        // arquivo órfão: a política do Storage deixa quem subiu apagar
        await balde.remove([caminho, caminhoMiniatura]);
        return { ok: false, codigo: r.codigo };
      }
      const assinadas = await assinar([caminho]);
      return { ok: true, id, url: assinadas.get(caminho) ?? "" };
    },
    async removerFoto(fotoId) {
      const r = await rpc(RPC.removerFoto(fotoId));
      if (!r.ok) return { ok: false, codigo: r.codigo };
      const caminhos = Array.isArray(r.caminhos) ? (r.caminhos as string[]) : [];
      if (caminhos.length) {
        // se falhar, o arquivo fica marcado como removido e a limpeza do worker apaga depois
        const { error } = await sb.storage.from(BUCKET_FOTOS).remove(caminhos);
        if (error) console.warn("[fotos] a foto saiu da OS, mas o arquivo não foi apagado agora", error.message);
        for (const c of caminhos) urls.delete(c);
      }
      return { ok: true };
    },

    // ------------------------------------------------------------ equipe, comissões e folha (escrita)
    async salvarFuncionario(entrada) {
      let c: Contexto;
      let perfis: Perfil[];
      try {
        [c, perfis] = await Promise.all([contexto(), repo.listarPerfis()]);
      } catch (e) {
        return { ok: false, codigo: e instanceof ErroDados ? e.codigo : "erro_desconhecido" };
      }
      const existente = entrada.id ? perfis.find((p) => p.id === entrada.id) : undefined;
      if (entrada.id && !existente) return { ok: false, codigo: "perfil_inexistente" };
      const veSalario = podeEditarSalario(c.papel);
      if (!veSalario && entrada.salarioMensal !== undefined && entrada.salarioMensal !== existente?.salarioMensal)
        return { ok: false, codigo: "sem_permissao", campo: "salarioMensal" };
      const telefone = normalizarTelefone(entrada.telefone);
      if (telefone === null) return { ok: false, codigo: "telefone_invalido", campo: "telefone" };
      // login não passa por aqui (definirLogin): usuário e e-mail atuais ficam como estão
      const v = validarFuncionario(
        { ...entrada, telefone, usuario: undefined, email: undefined, salarioMensal: veSalario ? entrada.salarioMensal : undefined },
        perfis,
      );
      if (!v.ok) return { ok: false, codigo: v.codigo, campo: v.campo };
      if (existente) {
        const m = validarMudancaPapel(existente.id, { papel: v.funcionario.papel, ativo: v.funcionario.ativo }, perfis);
        if (!m.ok) return { ok: false, codigo: m.codigo, campo: m.codigo === "ultimo_dono" ? "papel" : undefined };
      }
      const { salarioMensal, ...f } = v.funcionario;
      const p: Record<string, unknown> = {
        ...f,
        ...(entrada.id ? { id: entrada.id } : {}),
        ...(existente?.usuario ? { usuario: existente.usuario } : {}),
        ...(existente?.email ? { email: existente.email } : {}),
        // só o dono manda o salário (null apaga); para os outros a chave nem vai
        ...(veSalario ? { salarioMensal: salarioMensal ?? null } : {}),
      };
      const r = await rpc(RPC.salvarFuncionario(p));
      if (!r.ok) return { ok: false, codigo: r.codigo, ...(r.campo ? { campo: r.campo } : {}) };
      const id = typeof r.id === "string" ? r.id : entrada.id;
      // ligou/desligou alguém com login: o Auth acompanha (perfil inativo = login bloqueado)
      if (existente?.temLogin && existente.ativo !== v.funcionario.ativo && id) {
        const s = await equipeLogin({ acao: "sincronizar", perfilId: id });
        if (!s.ok) return { ok: true, id, codigo: "login_nao_sincronizado" };
      }
      return { ok: true, id };
    },
    async definirLogin(perfilId, dados) {
      let c: Contexto;
      let perfis: Perfil[];
      try {
        [c, perfis] = await Promise.all([contexto(), repo.listarPerfis()]);
      } catch (e) {
        return { ok: false, codigo: e instanceof ErroDados ? e.codigo : "erro_desconhecido" };
      }
      if (!podeEditarPapel(c.papel)) return { ok: false, codigo: "sem_permissao" };
      if (!perfis.some((p) => p.id === perfilId)) return { ok: false, codigo: "perfil_inexistente" };
      const u = validarUsuario(dados.usuario, perfis, perfilId);
      if (!u.ok) return { ok: false, codigo: u.codigo, campo: "usuario" };
      const senha = dados.senha ?? "";
      const erroSenha = validarSenha(senha);
      if (erroSenha) return { ok: false, codigo: erroSenha, campo: "senha" };
      const r = await equipeLogin({ acao: "definir", perfilId, usuario: u.usuario, senha });
      if (!r.ok) return { ok: false, codigo: r.codigo, ...(r.codigo?.startsWith("usuario_") ? { campo: "usuario" } : r.codigo?.startsWith("senha_") ? { campo: "senha" } : {}) };
      return { ok: true, usuario: typeof r.usuario === "string" ? r.usuario : u.usuario, ...(typeof r.email === "string" ? { email: r.email } : {}) };
    },
    async removerLogin(perfilId) {
      let c: Contexto;
      try {
        c = await contexto();
      } catch (e) {
        return { ok: false, codigo: e instanceof ErroDados ? e.codigo : "erro_desconhecido" };
      }
      if (!podeEditarPapel(c.papel)) return { ok: false, codigo: "sem_permissao" };
      if (perfilId === c.perfilId) return { ok: false, codigo: "proprio_login" };
      const r = await equipeLogin({ acao: "remover", perfilId });
      return r.ok ? { ok: true } : { ok: false, codigo: r.codigo };
    },
    async salvarRegraComissao(entrada) {
      let c: Contexto;
      let regras;
      let tipos;
      try {
        [c, regras, tipos] = await Promise.all([contexto(), repo.listarRegrasComissao(), repo.listarTiposReparo()]);
      } catch (e) {
        return { ok: false, codigo: e instanceof ErroDados ? e.codigo : "erro_desconhecido" };
      }
      if (!podeEditarComissoes(c.papel)) return { ok: false, codigo: "sem_permissao" };
      if (entrada.id && !regras.some((r) => r.id === entrada.id)) return { ok: false, codigo: "regra_nao_encontrada" };
      if (entrada.tipoReparoId && !tipos.some((t) => t.id === entrada.tipoReparoId)) return { ok: false, codigo: "tipo_nao_encontrado", campo: "tipoReparoId" };
      const r = validarRegraComissao(entrada, regras);
      if (!r.ok) return { ok: false, codigo: r.codigo, campo: r.campo };
      const linha = paraRegraComissao(r.regra);
      return entrada.id
        ? gravar(sb.from("regra_comissao").update(linha).eq("id", entrada.id).select("id"), "regra_nao_encontrada")
        : gravar(sb.from("regra_comissao").insert(linha).select("id"), "sem_permissao");
    },
    async removerRegraComissao(id) {
      try {
        if (!podeEditarComissoes((await contexto()).papel)) return { ok: false, codigo: "sem_permissao" };
      } catch (e) {
        return { ok: false, codigo: e instanceof ErroDados ? e.codigo : "erro_desconhecido" };
      }
      const g = await gravar(sb.from("regra_comissao").delete().eq("id", id).select("id"), "regra_nao_encontrada");
      return g.ok ? { ok: true } : g;
    },
    async salvarAjusteFolha(perfilId, mes, ajustes, obs) {
      if (!MES.test(mes)) return { ok: false, codigo: "data_invalida" };
      return rpc(RPC.salvarAjusteFolha(perfilId, mes, ajustes, obs));
    },
    async pagarFolha(perfilId, mes, pagoEm, ajustes) {
      if (!MES.test(mes)) return { ok: false, codigo: "data_invalida" };
      const r = await rpc(RPC.pagarFolha(perfilId, mes, pagoEm, ajustes));
      if (!r.ok) return { ok: false, codigo: r.codigo, ...(r.campo ? { campo: r.campo } : {}) };
      return { ok: true, ...(typeof r.id === "string" ? { id: r.id } : {}), ...(typeof r.despesaId === "string" ? { despesaId: r.despesaId } : {}) };
    },

    async restaurarDemo() {
      // o banco da oficina nunca é apagado pelo painel
      throw new ErroDados("so_na_demonstracao");
    },

    /** Avisa quando OS, etapas, agenda, fotos ou pagamentos mudam (outra pessoa, outro aparelho). */
    assinarMudancas(aoMudar) {
      const canal = sb.channel("painel-mudancas");
      for (const tabela of TABELAS_TEMPO_REAL) canal.on("postgres_changes", { event: "*", schema: "public", table: tabela }, () => aoMudar());
      canal.subscribe();
      return () => {
        void sb.removeChannel(canal);
      };
    },
  };
  return repo;
}

import type { Agendamento, CampoConfig, Cliente, CustoOS, EstadoOS, EtapaOS, Foto, Id, Janela, Material, MovimentoEstoque, OS, RecepcaoVeiculo, RegistroAuditoria, TituloReceber } from "@compartilhado/tipos";
import { FORMAS_PAGAMENTO } from "@compartilhado/tipos";
import { normalizarPlaca, placaValida } from "@compartilhado/dominio/placa";
import { bloquearEtapa, concluirEtapa, dispensarEtapa, gerarEtapas, iniciarEtapa, previsaoEntregaSugerida, retomarEtapa, transicaoOS, type ContextoTransicaoOS } from "@compartilhado/dominio/os";
import { janelaDoDia } from "@compartilhado/dominio/expediente";
import { podeConfirmar, reagendar as reagendarDominio } from "@compartilhado/dominio/agenda";
import { aplicarBaixa as aplicarBaixaDominio, saldoTitulo, validarDataPrevista, validarDataRealizada } from "@compartilhado/dominio/financeiro";
import { compararMarcos, dataISOValida, dataNoFuso, formatarMarco, paraMs, somarDias } from "@compartilhado/dominio/fuso";
import { formatarReais } from "@compartilhado/dominio/dinheiro";
import { normalizarCEP, normalizarDocumento, tipoPorDocumento, validarDocumento } from "@compartilhado/dominio/documento";
import { carimbarRecepcao, recepcaoEditavel, validarAvaria } from "@compartilhado/dominio/recepcao";
import { totalCusto, validarMaoDeObra } from "@compartilhado/dominio/custos";
import { aplicarMovimento } from "@compartilhado/dominio/estoque";
import { calcularFechamento, checarCaixaAberto } from "@compartilhado/dominio/caixa";
import { resumoPagamentosCliente, saldoACobrarCliente } from "@compartilhado/dominio/pagamentos";
import { aplicarConfig } from "@compartilhado/dominio/config";
import { validarTipoReparo } from "@compartilhado/dominio/tiposReparo";
import { COMPRESSAO_FOTO, FASES_FOTO_ETAPA, FASES_FOTO_INTERNA, expiracaoFoto, fotosDaEtapa } from "@compartilhado/dominio/fotos";
import { FASE_VISTORIA } from "../dominio/rotulos";
import { gerarDemo, type EstadoDemo } from "./demo";
import { apagarBlobs, apagarOrfaos, guardarBlobs, lerBlobs, limparBlobs } from "./fotosLocais";
import { LIMITE_AUDITORIA, type ClienteFicha, type ClienteResumo, type NovoAtendimentoRapido, type OSVisao, type Repositorio, type Resultado } from "./repositorio";

/**
 * Repositório de demonstração: guarda tudo na memória do navegador (com cópia em localStorage para
 * os cliques sobreviverem a um recarregamento). Toda mudança passa pelas MESMAS regras de domínio
 * que o banco vai usar (codigo/compartilhado/src/dominio), então o comportamento da demo é o real.
 */
const CHAVE = "ddoctor.demo.v3";
/** Mesma chave do seletor "Ver como" (sessao.tsx): quem fez a ação, para a auditoria. No S1 vem do login. */
const CHAVE_PERFIL = "ddoctor.perfil";

/** Todo marco gravado sai no MESMO formato do demo: "2026-10-12T14:30:00-03:00" (fuso da oficina). */
function agora(): string {
  return formatarMarco(Date.now());
}
function hoje(): string {
  return dataNoFuso(Date.now());
}
function novoId(prefixo: string): string {
  return `${prefixo}-${Math.random().toString(36).slice(2, 9)}`;
}
const pausa = () => new Promise((r) => setTimeout(r, 80));

function carregar(): EstadoDemo {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) {
      const salvo = JSON.parse(bruto) as EstadoDemo;
      // demo de outro dia: regera para os prazos continuarem fazendo sentido
      if (salvo.versao === 3 && dataNoFuso(salvo.geradoEm) === dataNoFuso(agora())) return salvo;
    }
  } catch {
    /* sem armazenamento ou dado corrompido: regera */
  }
  return gerarDemo();
}

let estado: EstadoDemo = carregar();

function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch {
    /* segue só na memória */
  }
}

function visao(os: OS): OSVisao {
  const veiculo = estado.veiculos.find((v) => v.id === os.veiculoId)!;
  const cliente = estado.clientes.find((c) => c.id === os.clienteId)!;
  const agendamento = estado.agendamentos
    .filter((a) => a.osId === os.id && agendamentoAtivo(a))
    .sort((a, b) => a.data.localeCompare(b.data))[0];
  return {
    os,
    veiculo,
    cliente,
    atendimentos: estado.atendimentos.filter((a) => os.atendimentosExternos.includes(a.id)),
    versoes: estado.versoes.filter((v) => v.osId === os.id).sort((a, b) => b.numeroVersao - a.numeroVersao),
    etapas: estado.etapas.filter((e) => e.osId === os.id).sort((a, b) => a.ordem - b.ordem),
    tipoReparo: estado.tiposReparo.find((t) => t.id === os.tipoReparoId),
    agendamento,
    pendencias: estado.pendencias.filter((p) => p.osId === os.id),
    titulos: estado.titulos.filter((t) => t.osId === os.id),
    fotos: estado.fotos.filter((f) => f.osId === os.id).map((f) => fotoParaLeitura(f, os)),
    custos: estado.custos.filter((c) => c.osId === os.id).sort((a, b) => compararMarcos(a.lancadoEm, b.lancadoEm)),
  };
}

// ---------------------------------------------------------------- fotos guardadas no aparelho

/**
 * Fotos tiradas no painel guardam no estado só um marcador: "idb:<id>" (blobs no IndexedDB) ou
 * "sessao:<id>" (sem IndexedDB: só nesta aba). A leitura troca o marcador por blob: URLs (cache abaixo).
 * Fotos do demo antigo seguem com a URL pública.
 */
const PREFIXO_IDB = "idb:";
const PREFIXO_SESSAO = "sessao:";
const ehLocal = (f: Foto) => f.url.startsWith(PREFIXO_IDB) || f.url.startsWith(PREFIXO_SESSAO);
const urlsFoto = new Map<Id, { url: string; miniaturaUrl: string }>();

/** blob: URL da foto; se o navegador recusar, url vazia (a tela mostra "foto indisponível"). */
function criarUrl(blob: Blob): string {
  if (typeof URL.createObjectURL !== "function") return "";
  try {
    return URL.createObjectURL(blob);
  } catch (e) {
    console.warn("[fotos] não consegui criar a URL da foto", e);
    return "";
  }
}
function liberarUrls(id: Id) {
  const u = urlsFoto.get(id);
  if (u && typeof URL.revokeObjectURL === "function") {
    if (u.url) URL.revokeObjectURL(u.url);
    if (u.miniaturaUrl) URL.revokeObjectURL(u.miniaturaUrl);
  }
  urlsFoto.delete(id);
}

let limpezaFotosFeita = false;
let resolvendoFotos: Promise<void> = Promise.resolve();

/**
 * Garante blob: URLs para as fotos locais antes da leitura; foto "sessao:" perdida (aba recarregada) sai do estado.
 * Nunca rejeita: a cadeia é compartilhada por todas as leituras, e uma falha aqui (IndexedDB, blob) derrubaria
 * todas. Foto que falha fica com url vazia ("foto indisponível") e é tentada de novo na próxima leitura.
 */
function resolverFotos(): Promise<void> {
  resolvendoFotos = resolvendoFotos
    .then(async () => {
      const locais = estado.fotos.filter(ehLocal);
      if (!limpezaFotosFeita) {
        limpezaFotosFeita = true;
        try {
          await apagarOrfaos(new Set(locais.filter((f) => f.url.startsWith(PREFIXO_IDB)).map((f) => f.id)));
        } catch (e) {
          console.warn("[fotos] não consegui limpar fotos órfãs", e);
        }
      }
      const perdidas = new Set<Id>();
      for (const f of locais) {
        if (urlsFoto.has(f.id)) continue;
        try {
          const blobs = await lerBlobs(f.id);
          if (blobs) urlsFoto.set(f.id, { url: criarUrl(blobs.arquivo), miniaturaUrl: criarUrl(blobs.miniatura) });
          else if (f.url.startsWith(PREFIXO_SESSAO)) perdidas.add(f.id);
        } catch (e) {
          console.warn(`[fotos] não consegui ler a foto ${f.id}`, e);
        }
      }
      if (perdidas.size) {
        estado.fotos = estado.fotos.filter((f) => !perdidas.has(f.id));
        salvar();
      }
    })
    .catch((e) => {
      console.warn("[fotos] falha ao preparar as fotos; a leitura segue sem elas", e);
    });
  return resolvendoFotos;
}

/** Foto como as telas leem: URLs utilizáveis e a expiração pela retenção (L28). */
function fotoParaLeitura(f: Foto, os: OS): Foto {
  const { expiraEm, provisorio } = expiracaoFoto(f, os);
  const base = { ...f, expiraEm, expiraProvisorio: provisorio };
  if (!ehLocal(f)) return base;
  const u = urlsFoto.get(f.id);
  // blobs perdidos (armazenamento apagado): url vazia; a tela mostra "foto indisponível"
  return { ...base, url: u?.url ?? "", miniaturaUrl: u?.miniaturaUrl ?? "" };
}

const ehImagem = (b: unknown): b is Blob => typeof Blob !== "undefined" && b instanceof Blob && b.size > 0 && b.type.startsWith("image/");

// ---------------------------------------------------------------- auditoria

function perfilAtual(): Id | undefined {
  try {
    return localStorage.getItem(CHAVE_PERFIL) ?? "p-dono";
  } catch {
    return undefined;
  }
}

/** Toda escrita deixa uma linha legível (Ajustes → Auditoria). No S1, trigger no banco. */
function auditar(acao: string, entidade: string, entidadeId: Id | undefined, resumo: string) {
  const linha: RegistroAuditoria = { id: novoId("au"), em: agora(), perfilId: perfilAtual(), acao, entidade, entidadeId, resumo };
  estado.auditoria = [linha, ...estado.auditoria].slice(0, LIMITE_AUDITORIA);
}

const numeroOS = (osId: Id) => {
  const os = estado.oss.find((o) => o.id === osId);
  return os ? `OS #${os.numero}` : "OS";
};
const qtdTexto = (q: number) => q.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

// ---------------------------------------------------------------- normalização de contato

/** Telefone em E.164 sem formatação; 10–11 dígitos ganham +55. null = inválido. */
function normalizarTelefone(texto: string | undefined): string | null | undefined {
  if (!texto?.trim()) return undefined;
  const digitos = texto.replace(/\D/g, "");
  if (texto.trim().startsWith("+")) return digitos.length >= 12 && digitos.length <= 13 ? `+${digitos}` : null;
  if (digitos.length === 10 || digitos.length === 11) return `+55${digitos}`;
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) return `+${digitos}`;
  return null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valida e normaliza os dados de um cliente; recusa documento repetido em outro cadastro. */
function prepararCliente(entrada: Omit<Cliente, "id">, id?: Id): { ok: true; cliente: Omit<Cliente, "id"> } | { ok: false; codigo: string } {
  const nome = entrada.nome?.trim();
  if (!nome) return { ok: false, codigo: "nome_obrigatorio" };
  let documento: string | undefined;
  let tipoPessoa = entrada.tipoPessoa;
  if (entrada.documento?.trim()) {
    documento = normalizarDocumento(entrada.documento);
    if (!validarDocumento(documento, tipoPessoa ?? undefined)) return { ok: false, codigo: "documento_invalido" };
    tipoPessoa = tipoPessoa ?? tipoPorDocumento(documento) ?? undefined;
    if (estado.clientes.some((c) => c.id !== id && c.documento && normalizarDocumento(c.documento) === documento))
      return { ok: false, codigo: "documento_duplicado" };
  }
  const telefone = normalizarTelefone(entrada.telefone);
  const whatsapp = normalizarTelefone(entrada.whatsapp);
  if (telefone === null || whatsapp === null) return { ok: false, codigo: "telefone_invalido" };
  const email = entrada.email?.trim() || undefined;
  if (email && !EMAIL.test(email)) return { ok: false, codigo: "email_invalido" };
  let endereco = entrada.endereco;
  if (endereco) {
    const cep = normalizarCEP(endereco.cep ?? "");
    if (!cep) return { ok: false, codigo: "cep_invalido" };
    endereco = { ...endereco, cep, uf: endereco.uf?.toUpperCase() };
  }
  return { ok: true, cliente: { ...entrada, nome, documento, tipoPessoa, telefone, whatsapp, email, endereco } };
}

/** Valida a recepção e carimba: registradaEm/Por da primeira gravação ficam; regravação vira atualizadaEm/Por. */
function prepararRecepcao(recepcao: RecepcaoVeiculo, anterior?: RecepcaoVeiculo): { ok: true; recepcao: RecepcaoVeiculo } | { ok: false; codigo: string } {
  if (recepcao.km !== undefined && (!Number.isFinite(recepcao.km) || recepcao.km < 0)) return { ok: false, codigo: "km_invalido" };
  for (const a of recepcao.avarias ?? []) {
    const r = validarAvaria(a);
    if (!r.ok) return r;
  }
  const limpa: RecepcaoVeiculo = {
    ...recepcao,
    checklist: recepcao.checklist ?? {},
    avarias: (recepcao.avarias ?? []).map((a) => ({ ...a, id: a.id || novoId("av") })),
  };
  return { ok: true, recepcao: carimbarRecepcao(limpa, anterior, agora(), perfilAtual()) };
}

/** Grava o material e o movimento já validados pelo domínio. */
function gravarMovimento(material: Material, mov: MovimentoEstoque) {
  estado.materiais = estado.materiais.map((m) => (m.id === material.id ? material : m));
  estado.movimentos = [mov, ...estado.movimentos];
}

/** Títulos das OS do cliente (todos os pagadores); os totais do cliente filtram só o pagador "cliente". */
function titulosDasOS(clienteId: Id): TituloReceber[] {
  const ids = new Set(estado.oss.filter((o) => o.clienteId === clienteId).map((o) => o.id));
  return estado.titulos.filter((t) => ids.has(t.osId));
}

function resumoCliente(cliente: Cliente): ClienteResumo {
  const oss = estado.oss.filter((o) => o.clienteId === cliente.id);
  return {
    cliente,
    veiculos: estado.veiculos.filter((v) => v.clienteId === cliente.id),
    quantidadeOS: oss.length,
    ultimaOSEm: oss.map((o) => o.criadoEm).sort(compararMarcos).at(-1),
    // só o que o CLIENTE pagou (franquia, complemento, particular); o que a seguradora/Maxpar paga fica fora
    totalPago: resumoPagamentosCliente(titulosDasOS(cliente.id), estado.pagadores).recebido,
  };
}

/** Dinheiro lançado com a data de um dia cujo caixa já foi fechado → caixa_ja_fechado. */
function caixaAberto(forma: string | undefined, data: string | undefined): Resultado {
  return checarCaixaAberto(estado.fechamentos, forma, data);
}

function atualizarOS(id: Id, mudanca: Partial<OS>) {
  estado.oss = estado.oss.map((o) => (o.id === id ? { ...o, ...mudanca, atualizadoEm: agora() } : o));
}

/** Muda o estado da OS SEMPRE pela máquina de estados do domínio (§7.2). */
function mudarEstadoOS(os: OS, para: EstadoOS, contexto: ContextoTransicaoOS, extra: Partial<OS> = {}): Resultado {
  const r = transicaoOS(os, para, contexto);
  if (!r.ok) return { ok: false, codigo: r.codigo };
  atualizarOS(os.id, { ...extra, estado: para });
  return { ok: true };
}

function versaoVigente(osId: Id) {
  return estado.versoes.filter((v) => v.osId === osId).sort((a, b) => b.numeroVersao - a.numeroVersao)[0];
}

function conflitosAbertos(os: OS): number {
  return estado.atendimentos.filter((a) => os.atendimentosExternos.includes(a.id) && a.estadoConciliacao === "conflito").length;
}

/** Proposta da Calia vencida não ocupa vaga nem conta como ativa. */
function agendamentoAtivo(a: Agendamento, momento = agora()): boolean {
  if (a.estado === "confirmado") return true;
  if (a.estado === "proposto") return !a.expiraEm || paraMs(a.expiraEm) > paraMs(momento);
  return false;
}

/** A agenda só aceita hoje em diante, em dia e período em que a oficina abre. */
function dataAgendavel(data: string, janela: Janela): Resultado {
  if (data < dataNoFuso(agora())) return { ok: false, codigo: "data_passada" };
  const j = janelaDoDia(data, estado.config);
  if (!j) return { ok: false, codigo: "dia_fechado" };
  if (janela === "tarde" && j.fim <= 12 * 60) return { ok: false, codigo: "dia_fechado" };
  return { ok: true };
}

/** Aplica uma função de domínio sobre as etapas de uma OS e grava o resultado. */
function mudarEtapas(
  etapaId: Id,
  acao: string,
  fn: (etapas: EtapaOS[]) => { ok: true; etapas: EtapaOS[] } | { ok: false; codigo: string },
): Resultado {
  const etapa = estado.etapas.find((e) => e.id === etapaId);
  if (!etapa) return { ok: false, codigo: "transicao_invalida" };
  const daOS = estado.etapas.filter((e) => e.osId === etapa.osId).sort((a, b) => a.ordem - b.ordem);
  const r = fn(daOS);
  if (!r.ok) return { ok: false, codigo: r.codigo };
  estado.etapas = [...estado.etapas.filter((e) => e.osId !== etapa.osId), ...r.etapas];
  // última etapa concluída → OS pronta
  const abertas = r.etapas.filter((e) => !["concluida", "dispensada"].includes(e.estado));
  const os = estado.oss.find((o) => o.id === etapa.osId);
  if (os && abertas.length === 0 && os.estado === "na_oficina") mudarEstadoOS(os, "pronta", { etapas: r.etapas }, { prontaEm: agora() });
  else if (os) atualizarOS(os.id, {});
  auditar(acao, "etapa_os", etapaId, `Etapa "${etapa.nome}" ${acao} (${numeroOS(etapa.osId)})`);
  salvar();
  return { ok: true };
}

export const repositorioMemoria: Repositorio = {
  async listarOS() {
    await pausa();
    await resolverFotos();
    return estado.oss.map(visao);
  },
  async obterOS(id) {
    await pausa();
    await resolverFotos();
    const os = estado.oss.find((o) => o.id === id);
    return os ? visao(os) : null;
  },
  async listarAgendamentos() {
    await pausa();
    return estado.agendamentos;
  },
  async listarCapacidade(inicio, fim) {
    await pausa();
    const dias: { data: string; vagasEntrada: number; bloqueado?: string }[] = [];
    // datas em AAAA-MM-DD somadas no fuso da oficina (sem Date local, que pode pular um dia)
    for (let data = inicio; data <= fim; data = somarDias(data, 1)) {
      const excecao = estado.capacidades.find((c) => c.data === data);
      dias.push(excecao ?? { data, vagasEntrada: estado.config.capacidadePadrao.vagasEntrada });
    }
    return dias;
  },
  async listarPerfis() {
    return estado.perfis;
  },
  async listarTiposReparo() {
    return estado.tiposReparo;
  },
  async listarPagadores() {
    return estado.pagadores;
  },
  async listarTitulos() {
    await pausa();
    return estado.titulos;
  },
  async listarDespesas() {
    await pausa();
    return estado.despesas;
  },
  async listarMateriais() {
    await pausa();
    return estado.materiais;
  },
  async obterConfig() {
    return estado.config;
  },
  async listarClientes() {
    await pausa();
    return estado.clientes.map(resumoCliente).sort((a, b) => a.cliente.nome.localeCompare(b.cliente.nome, "pt-BR"));
  },
  async obterCliente(id): Promise<ClienteFicha | null> {
    await pausa();
    await resolverFotos();
    const cliente = estado.clientes.find((c) => c.id === id);
    if (!cliente) return null;
    const oss = estado.oss.filter((o) => o.clienteId === id).map(visao).sort((a, b) => compararMarcos(b.os.criadoEm, a.os.criadoEm));
    return { ...resumoCliente(cliente), oss, saldoEmAberto: resumoPagamentosCliente(titulosDasOS(id), estado.pagadores).saldo };
  },
  async listarVeiculos() {
    await pausa();
    return estado.veiculos;
  },
  async listarCustosOS(osId) {
    await pausa();
    return estado.custos.filter((c) => c.osId === osId).sort((a, b) => compararMarcos(a.lancadoEm, b.lancadoEm));
  },
  async listarMovimentos() {
    await pausa();
    return [...estado.movimentos].sort((a, b) => compararMarcos(b.em, a.em));
  },
  async listarFornecedores() {
    await pausa();
    return [...estado.fornecedores].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  },
  async listarCategorias() {
    await pausa();
    return estado.categorias;
  },
  async listarFechamentos() {
    await pausa();
    return [...estado.fechamentos].sort((a, b) => b.data.localeCompare(a.data));
  },
  async listarAuditoria() {
    await pausa();
    return [...estado.auditoria].sort((a, b) => compararMarcos(b.em, a.em));
  },

  // ------------------------------------------------------------ produção
  async iniciarEtapa(etapaId, responsavelId) {
    await pausa();
    return mudarEtapas(etapaId, "iniciada", (etapas) => iniciarEtapa(etapas, etapaId, responsavelId, agora()));
  },
  async concluirEtapa(etapaId, dados) {
    await pausa();
    const etapa = estado.etapas.find((e) => e.id === etapaId);
    if (!etapa) return { ok: false, codigo: "etapa_nao_encontrada" };
    // fotos indicadas: da mesma OS, "durante"/"final", sem etapa ou já desta etapa
    const indicadas = (dados.fotoIds ?? []).map((id) => estado.fotos.find((f) => f.id === id));
    if (indicadas.some((f) => !f || f.osId !== etapa.osId)) return { ok: false, codigo: "foto_nao_encontrada" };
    const ligar = (indicadas as Foto[]).filter((f) => FASES_FOTO_ETAPA.includes(f.fase) && (!f.etapaId || f.etapaId === etapaId));
    const temFoto = fotosDaEtapa(estado.fotos, etapa.osId, etapaId).length > 0 || ligar.length > 0;
    const r = mudarEtapas(etapaId, "concluída", (etapas) => concluirEtapa(etapas, etapaId, { pecasFeitas: dados.pecasFeitas, temFoto }, agora()));
    if (r.ok && ligar.length) {
      const ids = new Set(ligar.map((f) => f.id));
      estado.fotos = estado.fotos.map((f) => (ids.has(f.id) ? { ...f, etapaId } : f));
      salvar();
    }
    return r;
  },
  async bloquearEtapa(etapaId, motivo) {
    await pausa();
    return mudarEtapas(etapaId, "impedida", (etapas) => bloquearEtapa(etapas, etapaId, motivo, agora()));
  },
  async retomarEtapa(etapaId) {
    await pausa();
    return mudarEtapas(etapaId, "retomada", (etapas) => retomarEtapa(etapas, etapaId, agora()));
  },
  async dispensarEtapa(etapaId, motivo) {
    await pausa();
    return mudarEtapas(etapaId, "dispensada", (etapas) => dispensarEtapa(etapas, etapaId, motivo, agora()));
  },
  async atribuirResponsavel(etapaId, perfilId) {
    await pausa();
    estado.etapas = estado.etapas.map((e) => (e.id === etapaId ? { ...e, responsavelId: perfilId } : e));
    const et = estado.etapas.find((e) => e.id === etapaId);
    if (et) auditar("atribuir", "etapa_os", etapaId, `Etapa "${et.nome}" atribuída a ${estado.perfis.find((p) => p.id === perfilId)?.nome ?? perfilId} (${numeroOS(et.osId)})`);
    salvar();
    return { ok: true };
  },

  // ------------------------------------------------------------ ciclo da OS
  async criarAtendimentoRapido(dados: NovoAtendimentoRapido) {
    await pausa();
    const placa = normalizarPlaca(dados.placa);
    if (!placaValida(placa)) return { ok: false, codigo: "placa_invalida" };
    if (dados.pecas.length === 0) return { ok: false, codigo: "sem_itens" };
    // chave única do atendimento externo: oficina + seguradora + protocolo (arq. §6.2)
    if (dados.seguradora && dados.protocolo) {
      const existente = estado.atendimentos.find(
        (a) => a.seguradora === dados.seguradora && a.idExterno?.trim() === dados.protocolo!.trim(),
      );
      if (existente) {
        const osExistente = estado.oss.find((o) => o.atendimentosExternos.includes(existente.id));
        return { ok: false, codigo: "protocolo_duplicado", osId: osExistente?.id };
      }
    }
    let recepcao: RecepcaoVeiculo | undefined;
    if (dados.recepcao) {
      const r = prepararRecepcao(dados.recepcao);
      if (!r.ok) return r;
      recepcao = r.recepcao;
    }
    // cliente: o escolhido, o que já tem esse documento, ou um novo
    let clienteId: Id;
    if (dados.clienteId) {
      if (!estado.clientes.some((c) => c.id === dados.clienteId)) return { ok: false, codigo: "cliente_nao_encontrado" };
      clienteId = dados.clienteId;
    } else {
      const doc = dados.documento?.trim() ? normalizarDocumento(dados.documento) : undefined;
      const mesmoDoc = doc ? estado.clientes.find((c) => c.documento && normalizarDocumento(c.documento) === doc) : undefined;
      if (mesmoDoc) clienteId = mesmoDoc.id;
      else {
        const r = prepararCliente({ nome: dados.clienteNome, documento: dados.documento, telefone: dados.telefone, whatsapp: dados.whatsapp, email: dados.email });
        if (!r.ok) return r;
        clienteId = novoId("c");
        estado.clientes.push({ id: clienteId, ...r.cliente });
      }
    }
    // veículo: a placa é única na oficina; se já existe, reaproveita (completando o que faltar)
    const existente = estado.veiculos.find((v) => v.placa === placa);
    const veiculoId = existente?.id ?? novoId("v");
    if (existente) {
      estado.veiculos = estado.veiculos.map((v) =>
        v.id === existente.id
          ? { ...v, clienteId: v.clienteId ?? clienteId, marca: v.marca ?? dados.marca, modelo: v.modelo ?? dados.modelo, cor: v.cor ?? dados.cor }
          : v,
      );
    } else {
      estado.veiculos.push({ id: veiculoId, clienteId, placa, marca: dados.marca || undefined, modelo: dados.modelo, cor: dados.cor });
    }
    const osId = novoId("os");
    const momento = agora();
    const atendimentos: Id[] = [];
    if (dados.seguradora && dados.protocolo) {
      const atId = novoId("at");
      atendimentos.push(atId);
      estado.atendimentos.push({
        id: atId,
        fonte: "manual",
        seguradora: dados.seguradora,
        idExterno: dados.protocolo,
        statusNormalizado: "aguardando_autorizacao",
        aberturaEm: dataNoFuso(momento),
        lidoEm: momento,
        estadoConciliacao: "ok",
      });
    }
    estado.seqOS += 1;
    estado.oss.push({
      id: osId,
      numero: estado.seqOS,
      veiculoId,
      clienteId,
      origem: dados.origem,
      estado: "aguardando_aprovacao",
      prioridade: 0,
      atendimentosExternos: atendimentos,
      observacoes: dados.observacoes,
      recepcao,
      criadoEm: momento,
      atualizadoEm: momento,
      demo: true,
    });
    estado.versoes.push({
      id: novoId("ver"),
      osId,
      tipo: dados.origem === "particular" ? "interno" : "externo",
      numeroVersao: 1,
      fonte: "manual",
      estado: "enviado",
      itens: dados.pecas.map((p) => ({ id: novoId("it"), peca: p.peca, tecnica: p.tecnica, valor: p.valor ?? 0, statusItem: "solicitado" })),
      criadoEm: momento,
    });
    auditar("criar", "os", osId, `OS #${estado.seqOS} aberta para ${placa}`);
    salvar();
    return { ok: true, osId };
  },

  async registrarAprovacao(osId, evidencia) {
    await pausa();
    const os = estado.oss.find((o) => o.id === osId);
    if (!os || os.estado !== "aguardando_aprovacao") return { ok: false, codigo: "transicao_invalida" };
    if (!evidencia.trim()) return { ok: false, codigo: "motivo_obrigatorio" };
    const versao = versaoVigente(osId);
    if (!versao) return { ok: false, codigo: "sem_itens" };
    const aprovacao = { tipo: (versao.tipo === "interno" ? "cliente" : "externa") as "cliente" | "externa", aprovadoEm: agora(), evidencia, confiavel: true };
    const checagem = transicaoOS(os, "aguardando_agendamento", { versao: { ...versao, aprovacao }, conflitosAbertos: conflitosAbertos(os) });
    if (!checagem.ok) return { ok: false, codigo: checagem.codigo };
    estado.versoes = estado.versoes.map((v) =>
      v.id === versao.id
        ? {
            ...v,
            estado: "aprovado",
            itens: v.itens.map((i) => (i.statusItem === "solicitado" ? { ...i, statusItem: "autorizado" } : i)),
            aprovacao,
          }
        : v,
    );
    estado.atendimentos = estado.atendimentos.map((a) => (os.atendimentosExternos.includes(a.id) ? { ...a, statusNormalizado: "autorizado" } : a));
    atualizarOS(osId, { estado: "aguardando_agendamento" });
    auditar("aprovar", "os", osId, `Aprovação registrada na OS #${os.numero}: ${evidencia.trim()}`);
    salvar();
    return { ok: true };
  },

  async registrarEntrada(osId, tipoReparoId, recepcao) {
    await pausa();
    const os = estado.oss.find((o) => o.id === osId);
    const tipo = estado.tiposReparo.find((t) => t.id === tipoReparoId);
    if (!os) return { ok: false, codigo: "transicao_invalida" };
    if (!tipo) return { ok: false, codigo: "sem_tipo_reparo" };
    const checagem = transicaoOS(os, "na_oficina", { tipoReparoId });
    if (!checagem.ok) return { ok: false, codigo: checagem.codigo };
    let rec: RecepcaoVeiculo | undefined = os.recepcao;
    if (recepcao) {
      const r = prepararRecepcao(recepcao, os.recepcao);
      if (!r.ok) return r;
      rec = r.recepcao;
    }
    const momento = agora();
    const novas = gerarEtapas(tipo, osId, momento, estado.config).map((e, i) => ({ ...e, id: e.id || `${osId}-et-${i}` }));
    estado.etapas = [...estado.etapas.filter((e) => e.osId !== osId), ...novas];
    // o carro chegou: o agendamento confirmado vira "realizado" e qualquer proposta pendente é cancelada (libera a vaga)
    estado.agendamentos = estado.agendamentos.map((a): Agendamento => {
      if (a.osId !== osId) return a;
      if (a.estado === "confirmado") return { ...a, estado: "realizado" };
      if (a.estado === "proposto" || a.estado === "pendente" || a.estado === "contatando")
        return { ...a, estado: "cancelado", motivoCancelamento: "Carro entrou na oficina" };
      return a;
    });
    atualizarOS(osId, {
      estado: "na_oficina",
      tipoReparoId,
      entradaRealEm: momento,
      previsaoEntrega: os.previsaoEntrega ?? previsaoEntregaSugerida(tipo, momento, estado.config).data,
      recepcao: rec,
    });
    auditar("entrada", "os", osId, `Entrada do carro registrada na OS #${os.numero} (${tipo.nome})`);
    salvar();
    return { ok: true };
  },

  async registrarEntrega(osId) {
    await pausa();
    const os = estado.oss.find((o) => o.id === osId);
    if (!os) return { ok: false, codigo: "transicao_invalida" };
    const r = mudarEstadoOS(os, "entregue", {}, { entregueEm: agora() });
    if (!r.ok) return r;
    if (os.atendimentosExternos.length > 0) {
      estado.pendencias.push({
        id: novoId("pd"),
        osId,
        tipo: "encerrar_portal",
        descricao: "Marcar Serviço Realizado e enviar fotos, PDF e assinatura no portal",
        estado: "aberta",
        responsavelId: "p-recepcao",
        criadaEm: agora(),
      });
    }
    auditar("entrega", "os", osId, `Carro entregue (OS #${os.numero})`);
    salvar();
    return { ok: true };
  },

  // ------------------------------------------------------------ agenda
  async agendar(osId, data, janela) {
    await pausa();
    const os = estado.oss.find((o) => o.id === osId);
    if (!os || os.estado !== "aguardando_agendamento") return { ok: false, codigo: "transicao_invalida" };
    const valida = dataAgendavel(data, janela);
    if (!valida.ok) return valida;
    const capacidade = estado.capacidades.find((c) => c.data === data) ?? { data, vagasEntrada: estado.config.capacidadePadrao.vagasEntrada };
    // a proposta da própria OS (Calia) não conta como vaga ocupada ao confirmar
    const propria = estado.agendamentos.find((a) => a.osId === osId && a.estado === "proposto" && a.data === data);
    const r = podeConfirmar(capacidade, estado.agendamentos, agora(), propria?.id);
    if (!r.ok) return r;
    estado.agendamentos = estado.agendamentos
      .map((a) => (a.osId === osId && a.estado === "proposto" ? ({ ...a, estado: "cancelado", motivoCancelamento: "Substituído por agendamento da recepção" } as Agendamento) : a))
      .concat({ id: novoId("ag"), osId, data, janela, estado: "confirmado", origem: "recepcao" });
    mudarEstadoOS(os, "agendada", { agendamentoConfirmado: true });
    auditar("agendar", "agendamento", osId, `OS #${os.numero} agendada para ${data} (${janela === "manha" ? "manhã" : "tarde"})`);
    salvar();
    return { ok: true };
  },
  async reagendar(agendamentoId, data, janela) {
    await pausa();
    const valida = dataAgendavel(data, janela);
    if (!valida.ok) return valida;
    const capacidade = estado.capacidades.find((c) => c.data === data) ?? { data, vagasEntrada: estado.config.capacidadePadrao.vagasEntrada };
    const r = podeConfirmar(capacidade, estado.agendamentos.filter((a) => a.id !== agendamentoId), agora());
    if (!r.ok) return r;
    const nova = reagendarDominio(estado.agendamentos, agendamentoId, data, janela, agora());
    if (!nova.ok) return nova;
    estado.agendamentos = nova.agendamentos;
    auditar("reagendar", "agendamento", agendamentoId, `Agendamento movido para ${data} (${janela === "manha" ? "manhã" : "tarde"})`);
    salvar();
    return { ok: true };
  },
  async cancelarAgendamento(agendamentoId, motivo) {
    await pausa();
    if (!motivo.trim()) return { ok: false, codigo: "motivo_obrigatorio" };
    const ag = estado.agendamentos.find((a) => a.id === agendamentoId);
    if (!ag || !["confirmado", "proposto", "pendente", "contatando"].includes(ag.estado)) return { ok: false, codigo: "transicao_invalida" };
    estado.agendamentos = estado.agendamentos.map((a) => (a.id === agendamentoId ? { ...a, estado: "cancelado", motivoCancelamento: motivo } : a));
    // só uma OS agendada volta para a fila; OS já na oficina (ou além) não é tocada
    const os = estado.oss.find((o) => o.id === ag.osId);
    if (os?.estado === "agendada" && ag.estado === "confirmado") mudarEstadoOS(os, "aguardando_agendamento", { motivo });
    auditar("cancelar", "agendamento", agendamentoId, `Agendamento cancelado (${numeroOS(ag.osId)}): ${motivo.trim()}`);
    salvar();
    return { ok: true };
  },
  async marcarNaoCompareceu(agendamentoId) {
    await pausa();
    const ag = estado.agendamentos.find((a) => a.id === agendamentoId);
    if (!ag || ag.estado !== "confirmado") return { ok: false, codigo: "transicao_invalida" };
    estado.agendamentos = estado.agendamentos.map((a) => (a.id === agendamentoId ? { ...a, estado: "nao_compareceu" } : a));
    const os = estado.oss.find((o) => o.id === ag.osId);
    if (os?.estado === "agendada") mudarEstadoOS(os, "aguardando_agendamento", { motivo: "Cliente não compareceu" });
    auditar("nao_compareceu", "agendamento", agendamentoId, `Cliente não compareceu (${numeroOS(ag.osId)})`);
    salvar();
    return { ok: true };
  },

  // ------------------------------------------------------------ pendências e financeiro
  async concluirPendencia(pendenciaId) {
    await pausa();
    const pd = estado.pendencias.find((p) => p.id === pendenciaId);
    estado.pendencias = estado.pendencias.map((p) => (p.id === pendenciaId ? { ...p, estado: "concluida", concluidaEm: agora() } : p));
    if (pd) auditar("concluir", "pendencia_externa", pendenciaId, `Pendência no portal concluída (${numeroOS(pd.osId)})`);
    salvar();
    return { ok: true };
  },
  async aplicarBaixa(tituloId, baixa) {
    await pausa();
    const titulo = estado.titulos.find((t) => t.id === tituloId);
    if (!titulo) return { ok: false, codigo: "transicao_invalida" };
    const data = validarDataRealizada(baixa.recebidoEm, hoje());
    if (!data.ok) return data;
    const caixa = caixaAberto(baixa.forma, baixa.recebidoEm);
    if (!caixa.ok) return caixa;
    const r = aplicarBaixaDominio(titulo, { ...baixa, id: novoId("b") });
    if (!r.ok) return r;
    estado.titulos = estado.titulos.map((t) => (t.id === tituloId ? r.titulo : t));
    auditar("baixa", "titulo_receber", tituloId, `Baixa de ${formatarReais(baixa.valor)} em "${titulo.descricao}" (${numeroOS(titulo.osId)})`);
    salvar();
    return { ok: true };
  },
  async pagarDespesa(despesaId, valor, pagoEm, forma) {
    await pausa();
    const desp = estado.despesas.find((d) => d.id === despesaId);
    if (!desp) return { ok: false, codigo: "despesa_nao_encontrada" };
    if (!Number.isInteger(valor) || valor <= 0) return { ok: false, codigo: "valor_invalido" };
    if (forma && !FORMAS_PAGAMENTO.includes(forma)) return { ok: false, codigo: "forma_invalida" };
    const data = validarDataRealizada(pagoEm, hoje());
    if (!data.ok) return data;
    const caixa = caixaAberto(forma ?? desp.formaPagamento, pagoEm);
    if (!caixa.ok) return caixa;
    // a despesa já paga em dinheiro num dia fechado também não muda (a saída já foi conferida na gaveta)
    if (desp.pagoEm && desp.pagoEm !== pagoEm) {
      const antes = caixaAberto(desp.formaPagamento, desp.pagoEm);
      if (!antes.ok) return antes;
    }
    estado.despesas = estado.despesas.map((d) => (d.id === despesaId ? { ...d, pagoEm, valorPago: valor, formaPagamento: forma ?? d.formaPagamento } : d));
    auditar("pagar", "despesa", despesaId, `Despesa paga: ${desp.descricao}, ${formatarReais(valor)}`);
    salvar();
    return { ok: true };
  },

  // ------------------------------------------------------------ clientes, veículos e recepção
  async salvarCliente(entrada) {
    await pausa();
    const { id, ...dados } = entrada;
    if (id && !estado.clientes.some((c) => c.id === id)) return { ok: false, codigo: "cliente_nao_encontrado" };
    const r = prepararCliente(dados, id);
    if (!r.ok) return r;
    if (id) {
      estado.clientes = estado.clientes.map((c) => (c.id === id ? { ...c, ...r.cliente, id } : c));
      auditar("editar", "cliente", id, `Cadastro de ${r.cliente.nome} atualizado`);
      salvar();
      return { ok: true, id };
    }
    const novo = novoId("c");
    estado.clientes.push({ id: novo, ...r.cliente });
    auditar("criar", "cliente", novo, `Cliente ${r.cliente.nome} cadastrado`);
    salvar();
    return { ok: true, id: novo };
  },

  async salvarVeiculo(entrada) {
    await pausa();
    const { id, ...dados } = entrada;
    const placa = normalizarPlaca(dados.placa ?? "");
    if (!placaValida(placa)) return { ok: false, codigo: "placa_invalida" };
    if (id && !estado.veiculos.some((v) => v.id === id)) return { ok: false, codigo: "veiculo_nao_encontrado" };
    if (estado.veiculos.some((v) => v.id !== id && v.placa === placa)) return { ok: false, codigo: "placa_duplicada" };
    if (dados.clienteId && !estado.clientes.some((c) => c.id === dados.clienteId)) return { ok: false, codigo: "cliente_nao_encontrado" };
    if (dados.ano !== undefined && (!Number.isInteger(dados.ano) || dados.ano < 1950 || dados.ano > new Date().getFullYear() + 1))
      return { ok: false, codigo: "ano_invalido" };
    const limpo = { ...dados, placa, marca: dados.marca?.trim() || undefined, modelo: dados.modelo?.trim() || undefined, cor: dados.cor?.trim() || undefined };
    if (id) {
      estado.veiculos = estado.veiculos.map((v) => (v.id === id ? { ...v, ...limpo, id } : v));
      auditar("editar", "veiculo", id, `Veículo ${placa} atualizado`);
      salvar();
      return { ok: true, id };
    }
    const novo = novoId("v");
    estado.veiculos.push({ id: novo, ...limpo });
    auditar("criar", "veiculo", novo, `Veículo ${placa} cadastrado`);
    salvar();
    return { ok: true, id: novo };
  },

  async salvarRecepcao(osId, recepcao) {
    await pausa();
    const os = estado.oss.find((o) => o.id === osId);
    if (!os) return { ok: false, codigo: "os_nao_encontrada" };
    const editavel = recepcaoEditavel(os.estado);
    if (!editavel.ok) return editavel;
    const r = prepararRecepcao(recepcao, os.recepcao);
    if (!r.ok) return r;
    atualizarOS(osId, { recepcao: r.recepcao });
    auditar(
      "recepcao",
      "os",
      osId,
      `Recepção do veículo ${os.recepcao?.registradaEm ? "atualizada" : "registrada"} na OS #${os.numero} (${r.recepcao.avarias.length} avaria(s))`,
    );
    salvar();
    return { ok: true };
  },

  // ------------------------------------------------------------ custos e pagamentos da OS
  async lancarCusto(osId, novo) {
    await pausa();
    const os = estado.oss.find((o) => o.id === osId);
    if (!os) return { ok: false, codigo: "os_nao_encontrada" };
    if (os.estado === "cancelada") return { ok: false, codigo: "transicao_invalida" };
    const momento = agora();
    const id = novoId("cu");
    let custo: CustoOS;
    if (novo.tipo === "insumo") {
      const material = estado.materiais.find((m) => m.id === novo.materialId);
      if (!material) return { ok: false, codigo: "material_nao_encontrado" };
      const mov: MovimentoEstoque = {
        id: `mv-${id}`, // ligação com o custo: removerCusto devolve ao estoque
        materialId: material.id,
        tipo: "saida_os",
        quantidade: novo.quantidade,
        custoUnitario: material.custoMedio,
        osId,
        perfilId: novo.perfilId,
        em: momento,
      };
      const r = aplicarMovimento(material, mov);
      if (!r.ok) return r;
      gravarMovimento(r.material, mov);
      custo = {
        id,
        osId,
        tipo: "insumo",
        descricao: novo.descricao?.trim() || material.nome,
        quantidade: novo.quantidade,
        unidade: material.unidade,
        custoUnitario: material.custoMedio,
        total: totalCusto(novo.quantidade, material.custoMedio),
        materialId: material.id,
        perfilId: novo.perfilId,
        lancadoEm: momento,
        lancadoPor: perfilAtual(),
      };
    } else if (novo.tipo === "mao_de_obra") {
      if (!novo.descricao?.trim()) return { ok: false, codigo: "descricao_obrigatoria" };
      // R$ 0,00, valor quebrado ou sem minutos é recusado pelo domínio
      const mo = validarMaoDeObra({ modo: novo.modo, minutos: novo.minutos, valorUnitario: novo.valorUnitario });
      if (!mo.ok) return mo;
      const total = mo.total;
      const quantidade = novo.modo === "hora" ? Math.round((novo.minutos / 60) * 100) / 100 : novo.modo === "minuto" ? novo.minutos : 1;
      custo = {
        id,
        osId,
        tipo: "mao_de_obra",
        descricao: novo.descricao.trim(),
        quantidade,
        unidade: novo.modo === "hora" ? "h" : novo.modo === "minuto" ? "min" : undefined,
        custoUnitario: novo.valorUnitario,
        total,
        perfilId: novo.perfilId,
        minutos: novo.modo === "fixo" ? undefined : novo.minutos,
        lancadoEm: momento,
        lancadoPor: perfilAtual(),
      };
    } else {
      if (!novo.descricao?.trim()) return { ok: false, codigo: "descricao_obrigatoria" };
      const quantidade = novo.quantidade ?? 1;
      if (!Number.isFinite(quantidade) || quantidade <= 0) return { ok: false, codigo: "quantidade_invalida" };
      if (!Number.isInteger(novo.custoUnitario) || novo.custoUnitario <= 0) return { ok: false, codigo: "valor_invalido" };
      custo = {
        id,
        osId,
        tipo: novo.tipo,
        descricao: novo.descricao.trim(),
        quantidade,
        unidade: novo.unidade,
        custoUnitario: novo.custoUnitario,
        total: totalCusto(quantidade, novo.custoUnitario),
        fornecedor: novo.fornecedor?.trim() || undefined,
        perfilId: novo.perfilId,
        lancadoEm: momento,
        lancadoPor: perfilAtual(),
      };
    }
    estado.custos.push(custo);
    atualizarOS(osId, {});
    auditar(
      "lancar_custo",
      "custo_os",
      id,
      custo.tipo === "insumo"
        ? `Retirada de ${qtdTexto(custo.quantidade)} ${custo.unidade} de ${custo.descricao} para a OS #${os.numero} (${formatarReais(custo.total)})`
        : `Custo lançado na OS #${os.numero}: ${custo.descricao}, ${formatarReais(custo.total)}`,
    );
    salvar();
    return { ok: true, id };
  },

  async removerCusto(custoId) {
    await pausa();
    const custo = estado.custos.find((c) => c.id === custoId);
    if (!custo) return { ok: false, codigo: "custo_nao_encontrado" };
    if (custo.tipo === "insumo" && custo.materialId) {
      // devolve ao estoque com um movimento NOVO (ajuste "mais" ligado à OS): a retirada original fica no
      // extrato, que continua fechando com o saldo; relatórios de consumo descontam a devolução (ehDevolucaoOS)
      const material = estado.materiais.find((m) => m.id === custo.materialId);
      if (material) {
        const os = estado.oss.find((o) => o.id === custo.osId);
        const mov: MovimentoEstoque = {
          id: `mv-dev-${custo.id}`,
          materialId: material.id,
          tipo: "ajuste",
          sentido: "mais",
          quantidade: custo.quantidade,
          custoUnitario: custo.custoUnitario,
          osId: custo.osId,
          perfilId: custo.perfilId,
          obs: `Devolução do insumo da OS nº ${os?.numero ?? "?"}`,
          em: agora(),
        };
        const devolucao = aplicarMovimento(material, mov);
        if (!devolucao.ok) return devolucao;
        gravarMovimento(devolucao.material, mov);
      }
    }
    estado.custos = estado.custos.filter((c) => c.id !== custoId);
    atualizarOS(custo.osId, {});
    auditar(
      "remover_custo",
      "custo_os",
      custoId,
      custo.tipo === "insumo"
        ? `Custo removido da ${numeroOS(custo.osId)}: ${custo.descricao}; ${qtdTexto(custo.quantidade)} ${custo.unidade ?? ""} devolvido(s) ao estoque`
        : `Custo removido da ${numeroOS(custo.osId)}: ${custo.descricao}, ${formatarReais(custo.total)}`,
    );
    salvar();
    return { ok: true };
  },

  async registrarPagamentoOS(osId, pagamento) {
    await pausa();
    const os = estado.oss.find((o) => o.id === osId);
    if (!os) return { ok: false, codigo: "os_nao_encontrada" };
    if (os.estado === "cancelada") return { ok: false, codigo: "transicao_invalida" };
    if (!Number.isInteger(pagamento.valor) || pagamento.valor <= 0) return { ok: false, codigo: "valor_invalido" };
    if (!FORMAS_PAGAMENTO.includes(pagamento.forma)) return { ok: false, codigo: "forma_invalida" };
    if (pagamento.parcelas !== undefined && (!Number.isInteger(pagamento.parcelas) || pagamento.parcelas < 1))
      return { ok: false, codigo: "parcelas_invalidas" };
    const data = validarDataRealizada(pagamento.recebidoEm, hoje());
    if (!data.ok) return data;
    const caixa = caixaAberto(pagamento.forma, pagamento.recebidoEm);
    if (!caixa.ok) return caixa;
    const pagadorCliente = estado.pagadores.find((p) => p.tipo === "cliente");
    if (!pagadorCliente) return { ok: false, codigo: "sem_pagador" };
    // título do cliente em aberto (o de vencimento mais antigo); sem nenhum, cria "Particular/franquia"
    const doCliente = estado.titulos.filter((t) => t.osId === osId && t.pagadorId === pagadorCliente.id);
    let titulo: TituloReceber | undefined = doCliente
      .filter((t) => t.estado !== "recebido" && t.estado !== "cancelado" && saldoTitulo(t) > 0)
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0];
    let criado: TituloReceber | undefined;
    if (!titulo) {
      // saldo ainda não cobrado do cliente (particular = orçamento aprovado; com seguradora = franquia + complemento)
      const aCobrar = saldoACobrarCliente({ origem: os.origem, versao: versaoVigente(osId), titulosCliente: doCliente });
      if (aCobrar <= 0) return { ok: false, codigo: "os_quitada" };
      // o título nasce com o saldo a cobrar; pagamento acima dele cai em baixa_maior_que_saldo
      criado = {
        id: novoId("t"),
        osId,
        pagadorId: pagadorCliente.id,
        descricao: "Particular/franquia",
        valor: aCobrar,
        vencimento: pagamento.recebidoEm,
        estado: "emitido",
        baixas: [],
      };
      titulo = criado;
    }
    const r = aplicarBaixaDominio(titulo, {
      id: novoId("b"),
      valor: pagamento.valor,
      recebidoEm: pagamento.recebidoEm,
      forma: pagamento.forma,
      parcelas: pagamento.parcelas,
      obs: pagamento.obs?.trim() || undefined,
    });
    if (!r.ok) return r;
    estado.titulos = criado ? [...estado.titulos, r.titulo] : estado.titulos.map((t) => (t.id === r.titulo.id ? r.titulo : t));
    const parcelas = pagamento.parcelas && pagamento.parcelas > 1 ? ` em ${pagamento.parcelas}x` : "";
    auditar("baixa", "titulo_receber", r.titulo.id, `Pagamento de ${formatarReais(pagamento.valor)} (${pagamento.forma}${parcelas}) na OS #${os.numero}`);
    salvar();
    return { ok: true, id: r.titulo.id };
  },

  // ------------------------------------------------------------ estoque
  async movimentarEstoque(entrada) {
    await pausa();
    if (!["entrada_compra", "consumo_interno", "ajuste"].includes(entrada.tipo)) return { ok: false, codigo: "tipo_invalido" };
    const material = estado.materiais.find((m) => m.id === entrada.materialId);
    if (!material) return { ok: false, codigo: "material_nao_encontrado" };
    if (entrada.fornecedorId && !estado.fornecedores.some((f) => f.id === entrada.fornecedorId)) return { ok: false, codigo: "fornecedor_nao_encontrado" };
    const mov: MovimentoEstoque = { ...entrada, id: novoId("mv"), obs: entrada.obs?.trim() || undefined, em: entrada.em ?? agora() };
    const r = aplicarMovimento(material, mov);
    if (!r.ok) return r;
    gravarMovimento(r.material, mov);
    const q = `${qtdTexto(mov.quantidade)} ${material.unidade}`;
    auditar(
      mov.tipo,
      "material",
      material.id,
      mov.tipo === "entrada_compra"
        ? `Entrada de ${q} de ${material.nome} a ${formatarReais(mov.custoUnitario)} cada`
        : mov.tipo === "consumo_interno"
          ? `Consumo interno de ${q} de ${material.nome}`
          : `Ajuste de estoque (${mov.sentido === "mais" ? "+" : "−"}${q}) em ${material.nome}: ${mov.obs}`,
    );
    salvar();
    return { ok: true, id: mov.id };
  },

  async salvarMaterial(entrada) {
    await pausa();
    const { id, saldoEstimado, custoMedio, ...dados } = entrada;
    if (!dados.nome?.trim()) return { ok: false, codigo: "nome_obrigatorio" };
    if (!dados.unidade?.trim()) return { ok: false, codigo: "unidade_obrigatoria" };
    if (!Number.isFinite(dados.saldoMinimo) || dados.saldoMinimo < 0) return { ok: false, codigo: "quantidade_invalida" };
    if (dados.fornecedorId && !estado.fornecedores.some((f) => f.id === dados.fornecedorId)) return { ok: false, codigo: "fornecedor_nao_encontrado" };
    const limpo = { ...dados, nome: dados.nome.trim(), unidade: dados.unidade.trim(), categoria: dados.categoria?.trim() || "Outros" };
    if (id) {
      if (!estado.materiais.some((m) => m.id === id)) return { ok: false, codigo: "material_nao_encontrado" };
      // saldo e custo médio só mudam por movimentação
      estado.materiais = estado.materiais.map((m) => (m.id === id ? { ...m, ...limpo, id } : m));
      auditar("editar", "material", id, `Material ${limpo.nome} atualizado`);
      salvar();
      return { ok: true, id };
    }
    if ((saldoEstimado ?? 0) < 0 || (custoMedio ?? 0) < 0) return { ok: false, codigo: "quantidade_invalida" };
    const novo = novoId("m");
    let material: Material = { id: novo, ...limpo, saldoEstimado: 0, custoMedio: Math.round(custoMedio ?? 0) };
    estado.materiais.push(material);
    if (saldoEstimado && saldoEstimado > 0) {
      // saldo inicial entra como ajuste, para o extrato do material fechar com o saldo
      const mov: MovimentoEstoque = { id: novoId("mv"), materialId: novo, tipo: "ajuste", sentido: "mais", quantidade: saldoEstimado, obs: "Saldo inicial no cadastro", em: agora() };
      const r = aplicarMovimento(material, mov);
      if (!r.ok) return r;
      material = r.material;
      gravarMovimento(material, mov);
    }
    auditar("criar", "material", novo, `Material ${limpo.nome} cadastrado`);
    salvar();
    return { ok: true, id: novo };
  },

  async salvarFornecedor(entrada) {
    await pausa();
    const { id, ...dados } = entrada;
    const nome = dados.nome?.trim();
    if (!nome) return { ok: false, codigo: "nome_obrigatorio" };
    let documento: string | undefined;
    if (dados.documento?.trim()) {
      documento = normalizarDocumento(dados.documento);
      if (!validarDocumento(documento)) return { ok: false, codigo: "documento_invalido" };
      if (estado.fornecedores.some((f) => f.id !== id && f.documento === documento)) return { ok: false, codigo: "documento_duplicado" };
    }
    const telefone = normalizarTelefone(dados.telefone);
    if (telefone === null) return { ok: false, codigo: "telefone_invalido" };
    const email = dados.email?.trim() || undefined;
    if (email && !EMAIL.test(email)) return { ok: false, codigo: "email_invalido" };
    const limpo = { ...dados, nome, documento, telefone, email };
    if (id) {
      if (!estado.fornecedores.some((f) => f.id === id)) return { ok: false, codigo: "fornecedor_nao_encontrado" };
      estado.fornecedores = estado.fornecedores.map((f) => (f.id === id ? { ...f, ...limpo, id } : f));
      auditar("editar", "fornecedor", id, `Fornecedor ${nome} atualizado`);
      salvar();
      return { ok: true, id };
    }
    const novo = novoId("f");
    estado.fornecedores.push({ id: novo, ...limpo });
    auditar("criar", "fornecedor", novo, `Fornecedor ${nome} cadastrado`);
    salvar();
    return { ok: true, id: novo };
  },

  // ------------------------------------------------------------ financeiro e ajustes
  async criarDespesa(entrada) {
    await pausa();
    const descricao = entrada.descricao?.trim();
    if (!descricao) return { ok: false, codigo: "descricao_obrigatoria" };
    if (!Number.isInteger(entrada.valorPrevisto) || entrada.valorPrevisto <= 0) return { ok: false, codigo: "valor_invalido" };
    let categoria = entrada.categoria?.trim() ?? "";
    if (entrada.categoriaId) {
      const c = estado.categorias.find((x) => x.id === entrada.categoriaId);
      if (!c || c.tipo !== "despesa") return { ok: false, codigo: "categoria_invalida" };
      categoria = c.nome;
    }
    if (!categoria) return { ok: false, codigo: "categoria_invalida" };
    if (entrada.formaPagamento && !FORMAS_PAGAMENTO.includes(entrada.formaPagamento)) return { ok: false, codigo: "forma_invalida" };
    const venc = validarDataPrevista(entrada.vencimento);
    if (!venc.ok) return venc;
    if (entrada.pagoEm !== undefined) {
      const pago = validarDataRealizada(entrada.pagoEm, hoje());
      if (!pago.ok) return pago;
      const caixa = caixaAberto(entrada.formaPagamento, entrada.pagoEm);
      if (!caixa.ok) return caixa;
    }
    const valorPago = entrada.pagoEm ? (entrada.valorPago ?? entrada.valorPrevisto) : undefined;
    if (valorPago !== undefined && (!Number.isInteger(valorPago) || valorPago <= 0)) return { ok: false, codigo: "valor_invalido" };
    const id = novoId("d");
    estado.despesas.push({ ...entrada, id, descricao, categoria, valorPago, fornecedor: entrada.fornecedor?.trim() || undefined, obs: entrada.obs?.trim() || undefined });
    auditar("criar", "despesa", id, `Despesa lançada: ${descricao}, ${formatarReais(entrada.valorPrevisto)}${entrada.pagoEm ? " (paga)" : ""}`);
    salvar();
    return { ok: true, id };
  },

  async salvarCategoria(entrada) {
    await pausa();
    const { id, ...dados } = entrada;
    const nome = dados.nome?.trim();
    if (!nome) return { ok: false, codigo: "nome_obrigatorio" };
    if (dados.tipo !== "receita" && dados.tipo !== "despesa") return { ok: false, codigo: "categoria_invalida" };
    const chave = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    if (estado.categorias.some((c) => c.id !== id && c.tipo === dados.tipo && chave(c.nome) === chave(nome))) return { ok: false, codigo: "categoria_duplicada" };
    if (id) {
      const antiga = estado.categorias.find((c) => c.id === id);
      if (!antiga) return { ok: false, codigo: "categoria_invalida" };
      estado.categorias = estado.categorias.map((c) => (c.id === id ? { ...c, ...dados, nome, id } : c));
      // despesas guardam o nome por compatibilidade: renomear acompanha
      if (antiga.nome !== nome) estado.despesas = estado.despesas.map((d) => (d.categoriaId === id ? { ...d, categoria: nome } : d));
      auditar("editar", "categoria_financeira", id, `Categoria ${nome} atualizada${dados.ativa ? "" : " (inativa)"}`);
      salvar();
      return { ok: true, id };
    }
    const novo = novoId("cat");
    estado.categorias.push({ id: novo, ...dados, nome });
    auditar("criar", "categoria_financeira", novo, `Categoria ${nome} criada`);
    salvar();
    return { ok: true, id: novo };
  },

  async fecharCaixa(dados) {
    await pausa();
    if (!dataISOValida(dados.data)) return { ok: false, codigo: "data_invalida" };
    if (dados.data > hoje()) return { ok: false, codigo: "data_futura" };
    if (!Number.isInteger(dados.contado) || dados.contado < 0) return { ok: false, codigo: "valor_invalido" };
    if (estado.fechamentos.some((f) => f.data === dados.data)) return { ok: false, codigo: "caixa_ja_fechado" };
    const anterior = estado.fechamentos.filter((f) => f.data < dados.data).sort((a, b) => b.data.localeCompare(a.data))[0];
    const saldoInicial = dados.saldoInicial ?? anterior?.contado ?? 0;
    if (!Number.isInteger(saldoInicial) || saldoInicial < 0) return { ok: false, codigo: "valor_invalido" };
    const calculo = calcularFechamento({
      saldoInicial,
      contado: dados.contado,
      titulos: estado.titulos, // baixas de títulos cancelados ficam fora
      despesas: estado.despesas,
      data: dados.data,
    });
    const id = novoId("fc");
    estado.fechamentos = [{ id, ...calculo, obs: dados.obs?.trim() || undefined, fechadoPor: perfilAtual(), fechadoEm: agora() }, ...estado.fechamentos];
    const dif = calculo.diferenca === 0 ? "sem diferença" : calculo.diferenca < 0 ? `com falta de ${formatarReais(-calculo.diferenca)}` : `com sobra de ${formatarReais(calculo.diferenca)}`;
    auditar("fechar_caixa", "fechamento_caixa", id, `Fechamento de caixa de ${dados.data} ${dif}`);
    salvar();
    return { ok: true, id };
  },

  async salvarChecklistConfig(itens) {
    await pausa();
    const ids = new Set<string>();
    const limpos = [];
    for (const item of itens) {
      const nome = item.nome?.trim();
      const grupo = item.grupo?.trim();
      if (!nome || !grupo) return { ok: false, codigo: "checklist_invalido" };
      const id = item.id?.trim() || novoId("ck");
      if (ids.has(id)) return { ok: false, codigo: "checklist_invalido" };
      ids.add(id);
      limpos.push({ id, grupo, nome, ativo: item.ativo !== false });
    }
    estado.config = { ...estado.config, checklist: limpos };
    auditar("editar", "config_oficina", undefined, `Checklist de entrada salvo (${limpos.filter((i) => i.ativo).length} itens ativos)`);
    salvar();
    return { ok: true };
  },

  async salvarConfig(parcial) {
    await pausa();
    const antes = estado.config;
    const r = aplicarConfig(antes, parcial);
    if (!r.ok) return { ok: false, codigo: r.codigo, campo: r.campo };
    estado.config = r.config;
    const nomes: Record<CampoConfig, string> = {
      vagasEntrada: `entradas por dia ${antes.capacidadePadrao.vagasEntrada} → ${r.config.capacidadePadrao.vagasEntrada}`,
      carrosSimultaneos: `carros ao mesmo tempo ${antes.capacidadePadrao.carrosSimultaneos} → ${r.config.capacidadePadrao.carrosSimultaneos}`,
      pecasDia: `peças por dia ${antes.capacidadePadrao.pecasDia ?? "—"} → ${r.config.capacidadePadrao.pecasDia}`,
      expediente: `expediente ${r.config.expediente.inicio}–${r.config.expediente.fim}`,
      semaforo: `semáforo laranja ${r.config.semaforo.laranjaAntesHoras} h, vermelho ${r.config.semaforo.vermelhoBloqueioHoras} h`,
    };
    auditar("editar", "config_oficina", undefined, `Configuração confirmada: ${r.campos.map((c) => nomes[c]).join("; ")}`);
    salvar();
    return { ok: true };
  },

  async salvarTipoReparo(entrada) {
    await pausa();
    if (entrada.id && !estado.tiposReparo.some((t) => t.id === entrada.id)) return { ok: false, codigo: "tipo_nao_encontrado" };
    const r = validarTipoReparo(entrada, estado.tiposReparo);
    if (!r.ok) return r;
    // criado ou revisto por quem cuida da oficina: deixa de ser o modelo provisório do demo.
    // As OS que já entraram mantêm as etapas geradas na entrada.
    if (entrada.id) {
      const id = entrada.id;
      estado.tiposReparo = estado.tiposReparo.map((t) => (t.id === id ? { ...t, nome: r.nome, etapas: r.etapas, provisorio: false } : t));
      auditar("editar", "tipo_reparo", id, `Tipo de reparo ${r.nome} atualizado (${r.etapas.length} etapas)`);
      salvar();
      return { ok: true, id };
    }
    const id = novoId("tr");
    estado.tiposReparo = [...estado.tiposReparo, { id, nome: r.nome, etapas: r.etapas, provisorio: false }];
    auditar("criar", "tipo_reparo", id, `Tipo de reparo ${r.nome} criado (${r.etapas.map((e) => e.nome).join(", ")})`);
    salvar();
    return { ok: true, id };
  },

  // ------------------------------------------------------------ fotos
  async adicionarFoto(osId, nova) {
    await pausa();
    const os = estado.oss.find((o) => o.id === osId);
    if (!os) return { ok: false, codigo: "os_nao_encontrada" };
    if (os.estado === "cancelada") return { ok: false, codigo: "transicao_invalida" };
    if (!FASES_FOTO_INTERNA.includes(nova.fase)) return { ok: false, codigo: "fase_invalida" };
    if (nova.etapaId) {
      const etapa = estado.etapas.find((e) => e.id === nova.etapaId);
      if (!etapa || etapa.osId !== osId) return { ok: false, codigo: "etapa_nao_encontrada" };
      if (!FASES_FOTO_ETAPA.includes(nova.fase)) return { ok: false, codigo: "fase_invalida" };
    }
    if (!ehImagem(nova.arquivo) || !ehImagem(nova.miniatura)) return { ok: false, codigo: "arquivo_invalido" };
    if (nova.arquivo.size > COMPRESSAO_FOTO.maxBytesSalva || nova.miniatura.size > COMPRESSAO_FOTO.maxBytesSalva) return { ok: false, codigo: "arquivo_grande" };
    const id = novoId("f");
    const { persistente } = await guardarBlobs(id, { arquivo: nova.arquivo, miniatura: nova.miniatura });
    const urls = { url: criarUrl(nova.arquivo), miniaturaUrl: criarUrl(nova.miniatura) };
    urlsFoto.set(id, urls);
    const inteiro = (n: number | undefined) => (n !== undefined && Number.isInteger(n) && n > 0 ? n : undefined);
    estado.fotos = [
      ...estado.fotos,
      {
        id,
        osId,
        fase: nova.fase,
        etapaId: nova.etapaId,
        legenda: nova.legenda?.trim().slice(0, 120) || undefined,
        url: `${persistente ? PREFIXO_IDB : PREFIXO_SESSAO}${id}`,
        bytes: nova.arquivo.size,
        largura: inteiro(nova.largura),
        altura: inteiro(nova.altura),
        autorId: perfilAtual(),
        origem: "interna",
        tiradaEm: agora(),
      },
    ];
    const etapa = nova.etapaId ? estado.etapas.find((e) => e.id === nova.etapaId) : undefined;
    atualizarOS(osId, {});
    auditar("adicionar_foto", "foto", id, `Foto (${FASE_VISTORIA[nova.fase].toLowerCase()}${etapa ? `, ${etapa.nome}` : ""}) adicionada à OS #${os.numero}`);
    salvar();
    return persistente ? { ok: true, id, url: urls.url } : { ok: true, codigo: "fotos_temporarias", id, url: urls.url };
  },

  async removerFoto(fotoId) {
    await pausa();
    const foto = estado.fotos.find((f) => f.id === fotoId);
    if (!foto) return { ok: false, codigo: "foto_nao_encontrada" };
    if (foto.origem === "maxpar") return { ok: false, codigo: "foto_externa" };
    if (foto.etapaId) {
      const etapa = estado.etapas.find((e) => e.id === foto.etapaId);
      // a única foto que comprova uma etapa já concluída fica (a etapa foi aceita por causa dela)
      if (etapa?.exigeFoto && etapa.estado === "concluida" && fotosDaEtapa(estado.fotos, foto.osId, etapa.id).length <= 1)
        return { ok: false, codigo: "foto_em_uso" };
    }
    estado.fotos = estado.fotos.filter((f) => f.id !== fotoId);
    liberarUrls(fotoId);
    if (ehLocal(foto)) await apagarBlobs(fotoId);
    atualizarOS(foto.osId, {});
    auditar("remover_foto", "foto", fotoId, `Foto (${FASE_VISTORIA[foto.fase].toLowerCase()}) removida da ${numeroOS(foto.osId)}`);
    salvar();
    return { ok: true };
  },

  async restaurarDemo() {
    for (const id of [...urlsFoto.keys()]) liberarUrls(id);
    await limparBlobs();
    estado = gerarDemo();
    auditar("restaurar", "demo", undefined, "Demonstração restaurada: dados de exemplo gerados de novo");
    salvar();
  },
};

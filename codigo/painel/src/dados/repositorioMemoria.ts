import type { Agendamento, EstadoOS, EtapaOS, Id, Janela, OS } from "@compartilhado/tipos";
import { normalizarPlaca, placaValida } from "@compartilhado/dominio/placa";
import { bloquearEtapa, concluirEtapa, dispensarEtapa, gerarEtapas, iniciarEtapa, previsaoEntregaSugerida, retomarEtapa, transicaoOS, type ContextoTransicaoOS } from "@compartilhado/dominio/os";
import { janelaDoDia } from "@compartilhado/dominio/expediente";
import { podeConfirmar, reagendar as reagendarDominio } from "@compartilhado/dominio/agenda";
import { aplicarBaixa as aplicarBaixaDominio } from "@compartilhado/dominio/financeiro";
import { dataNoFuso, somarDias } from "@compartilhado/dominio/fuso";
import { gerarDemo, type EstadoDemo } from "./demo";
import type { NovoAtendimentoRapido, OSVisao, Repositorio, Resultado } from "./repositorio";

/**
 * Repositório de demonstração: guarda tudo na memória do navegador (com cópia em localStorage para
 * os cliques sobreviverem a um recarregamento). Toda mudança passa pelas MESMAS regras de domínio
 * que o banco vai usar (codigo/compartilhado/src/dominio), então o comportamento da demo é o real.
 */
const CHAVE = "ddoctor.demo.v2";

function agora(): string {
  return new Date().toISOString();
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
      if (salvo.versao === 2 && dataNoFuso(salvo.geradoEm) === dataNoFuso(agora())) return salvo;
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
    fotos: estado.fotos.filter((f) => f.osId === os.id),
  };
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
  if (a.estado === "proposto") return !a.expiraEm || a.expiraEm > momento;
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
function mudarEtapas(etapaId: Id, fn: (etapas: EtapaOS[]) => { ok: true; etapas: EtapaOS[] } | { ok: false; codigo: string }): Resultado {
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
  salvar();
  return { ok: true };
}

export const repositorioMemoria: Repositorio = {
  async listarOS() {
    await pausa();
    return estado.oss.map(visao);
  },
  async obterOS(id) {
    await pausa();
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

  // ------------------------------------------------------------ produção
  async iniciarEtapa(etapaId, responsavelId) {
    await pausa();
    return mudarEtapas(etapaId, (etapas) => iniciarEtapa(etapas, etapaId, responsavelId, agora()));
  },
  async concluirEtapa(etapaId, dados) {
    await pausa();
    return mudarEtapas(etapaId, (etapas) => concluirEtapa(etapas, etapaId, dados, agora()));
  },
  async bloquearEtapa(etapaId, motivo) {
    await pausa();
    return mudarEtapas(etapaId, (etapas) => bloquearEtapa(etapas, etapaId, motivo, agora()));
  },
  async retomarEtapa(etapaId) {
    await pausa();
    return mudarEtapas(etapaId, (etapas) => retomarEtapa(etapas, etapaId, agora()));
  },
  async dispensarEtapa(etapaId, motivo) {
    await pausa();
    return mudarEtapas(etapaId, (etapas) => dispensarEtapa(etapas, etapaId, motivo, agora()));
  },
  async atribuirResponsavel(etapaId, perfilId) {
    await pausa();
    estado.etapas = estado.etapas.map((e) => (e.id === etapaId ? { ...e, responsavelId: perfilId } : e));
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
    const clienteId = novoId("c");
    const veiculoId = novoId("v");
    const osId = novoId("os");
    const momento = agora();
    estado.clientes.push({ id: clienteId, nome: dados.clienteNome, telefone: dados.telefone || undefined });
    estado.veiculos.push({ id: veiculoId, clienteId, placa, modelo: dados.modelo, cor: dados.cor });
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
    salvar();
    return { ok: true };
  },

  async registrarEntrada(osId, tipoReparoId) {
    await pausa();
    const os = estado.oss.find((o) => o.id === osId);
    const tipo = estado.tiposReparo.find((t) => t.id === tipoReparoId);
    if (!os) return { ok: false, codigo: "transicao_invalida" };
    if (!tipo) return { ok: false, codigo: "sem_tipo_reparo" };
    const checagem = transicaoOS(os, "na_oficina", { tipoReparoId });
    if (!checagem.ok) return { ok: false, codigo: checagem.codigo };
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
    });
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
    salvar();
    return { ok: true };
  },

  // ------------------------------------------------------------ pendências e financeiro
  async concluirPendencia(pendenciaId) {
    await pausa();
    estado.pendencias = estado.pendencias.map((p) => (p.id === pendenciaId ? { ...p, estado: "concluida", concluidaEm: agora() } : p));
    salvar();
    return { ok: true };
  },
  async aplicarBaixa(tituloId, baixa) {
    await pausa();
    const titulo = estado.titulos.find((t) => t.id === tituloId);
    if (!titulo) return { ok: false, codigo: "transicao_invalida" };
    const r = aplicarBaixaDominio(titulo, { ...baixa, id: novoId("b") });
    if (!r.ok) return r;
    estado.titulos = estado.titulos.map((t) => (t.id === tituloId ? r.titulo : t));
    salvar();
    return { ok: true };
  },
  async pagarDespesa(despesaId, valor, pagoEm) {
    await pausa();
    estado.despesas = estado.despesas.map((d) => (d.id === despesaId ? { ...d, pagoEm, valorPago: valor } : d));
    salvar();
    return { ok: true };
  },

  async restaurarDemo() {
    estado = gerarDemo();
    salvar();
  },
};

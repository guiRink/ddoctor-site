import type { Agendamento, EtapaOS, Id, OS } from "@compartilhado/tipos";
import { normalizarPlaca, placaValida } from "@compartilhado/dominio/placa";
import { bloquearEtapa, concluirEtapa, dispensarEtapa, gerarEtapas, iniciarEtapa, previsaoEntregaSugerida, retomarEtapa } from "@compartilhado/dominio/os";
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
      if (salvo.versao === 2 && salvo.geradoEm.slice(0, 10) === agora().slice(0, 10)) return salvo;
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
    .filter((a) => a.osId === os.id && !["cancelado", "realizado", "nao_compareceu"].includes(a.estado))
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
  if (os && abertas.length === 0 && os.estado === "na_oficina") atualizarOS(os.id, { estado: "pronta", prontaEm: agora() });
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
    const versao = estado.versoes.filter((v) => v.osId === osId).sort((a, b) => b.numeroVersao - a.numeroVersao)[0];
    estado.versoes = estado.versoes.map((v) =>
      v.id === versao.id
        ? {
            ...v,
            estado: "aprovado",
            itens: v.itens.map((i) => (i.statusItem === "solicitado" ? { ...i, statusItem: "autorizado" } : i)),
            aprovacao: { tipo: v.tipo === "interno" ? "cliente" : "externa", aprovadoEm: agora(), evidencia, confiavel: true },
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
    if (!os || !["agendada", "aguardando_agendamento"].includes(os.estado)) return { ok: false, codigo: "transicao_invalida" };
    if (!tipo) return { ok: false, codigo: "sem_tipo_reparo" };
    const momento = agora();
    const novas = gerarEtapas(tipo, osId, momento, estado.config).map((e, i) => ({ ...e, id: e.id || `${osId}-et-${i}` }));
    estado.etapas = [...estado.etapas.filter((e) => e.osId !== osId), ...novas];
    estado.agendamentos = estado.agendamentos.map((a) =>
      a.osId === osId && a.estado === "confirmado" ? ({ ...a, estado: "realizado" } as Agendamento) : a,
    );
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
    if (!os || os.estado !== "pronta") return { ok: false, codigo: "transicao_invalida" };
    atualizarOS(osId, { estado: "entregue", entregueEm: agora() });
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
    const capacidade = estado.capacidades.find((c) => c.data === data) ?? { data, vagasEntrada: estado.config.capacidadePadrao.vagasEntrada };
    // a proposta da própria OS (Calia) não conta como vaga ocupada ao confirmar
    const propria = estado.agendamentos.find((a) => a.osId === osId && a.estado === "proposto" && a.data === data);
    const r = podeConfirmar(capacidade, estado.agendamentos, agora(), propria?.id);
    if (!r.ok) return r;
    estado.agendamentos = estado.agendamentos
      .map((a) => (a.osId === osId && a.estado === "proposto" ? ({ ...a, estado: "cancelado", motivoCancelamento: "Substituído por agendamento da recepção" } as Agendamento) : a))
      .concat({ id: novoId("ag"), osId, data, janela, estado: "confirmado", origem: "recepcao" });
    atualizarOS(osId, { estado: "agendada" });
    salvar();
    return { ok: true };
  },
  async reagendar(agendamentoId, data, janela) {
    await pausa();
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
    if (!ag) return { ok: false, codigo: "transicao_invalida" };
    estado.agendamentos = estado.agendamentos.map((a) => (a.id === agendamentoId ? { ...a, estado: "cancelado", motivoCancelamento: motivo } : a));
    atualizarOS(ag.osId, { estado: "aguardando_agendamento" });
    salvar();
    return { ok: true };
  },
  async marcarNaoCompareceu(agendamentoId) {
    await pausa();
    const ag = estado.agendamentos.find((a) => a.id === agendamentoId);
    if (!ag) return { ok: false, codigo: "transicao_invalida" };
    estado.agendamentos = estado.agendamentos.map((a) => (a.id === agendamentoId ? { ...a, estado: "nao_compareceu" } : a));
    atualizarOS(ag.osId, { estado: "aguardando_agendamento" });
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

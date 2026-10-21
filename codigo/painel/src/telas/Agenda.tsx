import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useSearchParams } from "react-router-dom";
import type { Agendamento, DataISO, Id, Janela } from "@compartilhado/tipos";
import { campoConfigProvisorio } from "@compartilhado/dominio/config";
import { dataNoFuso, somarDias } from "@compartilhado/dominio/fuso";
import { mensagemErro, useAcoes, useAgendamentos, useAgora, useCapacidade, useConfig, useOSs, useTiposReparo } from "../dados/hooks";
import type { OSVisao, Resultado } from "../dados/repositorio";
import { useSessao } from "../dados/sessao";
import { podeEditar, podeVer, veDadosSensiveis } from "../dominio/permissoes";
import { JANELA } from "../dominio/rotulos";
import { Botao, CabecalhoPagina, Cartao, Erro, Esqueleto } from "../componentes/ui/Basicos";
import { SeletorPeriodo } from "../componentes/ui/Periodo";
import { Provisorio } from "../componentes/ui/Estado";
import { Icone } from "../componentes/Icone";
import { ProvedorArrastar } from "../componentes/agenda/Arrastar";
import { PainelAvisar } from "../componentes/agenda/AvisarCliente";
import { BarraMovimento, type Barra } from "../componentes/agenda/BarraMovimento";
import { FilaAgendamento } from "../componentes/agenda/Fila";
import { diaCurto, diaMes, inicioDaSemana, plural } from "../componentes/agenda/formato";
import { GradeSemana, ListaDias } from "../componentes/agenda/Grade";
import {
  aprovadaEm,
  avaliarDestino,
  chavesEmOrdem,
  diasEsperando,
  estaNaGrade,
  montarDias,
  movelDaFila,
  movelDe,
  podeMover,
  proximasVagas,
  saidasDoDia,
  selecionarIntervalo,
  separarQueCabem,
  type AvaliacaoDestino,
  type ItemAgenda,
  type Movel,
} from "../componentes/agenda/modelo";
import { MoverPara } from "../componentes/agenda/MoverPara";
import { PainelAgendamento, PainelEscolha } from "../componentes/agenda/PainelAcao";
import { useMidia } from "../componentes/agenda/useLargura";

/**
 * Agenda (recepção, gestor, dono): semana seg–sáb × manhã/tarde com a ocupação de cada dia,
 * fila "Aguardando agendamento" à direita e ações no painel lateral (sem modal).
 * Sprint SG: arrastar e soltar (um carro ou vários pela caixinha) com Desfazer; encaixe acima da
 * capacidade com confirmação; "Mover para…" sem arrastar; "Não veio"; "Avisar cliente".
 * docs/painel-design.md §5 · informações §3.3 · arquitetura §7.2–7.3 · docs/revisao-sg/plano.md item 6.
 */

type Modo =
  | null
  | { tipo: "agendar"; osId: string }
  | { tipo: "reagendar"; agendamentoId: string }
  | { tipo: "ver"; agendamentoId: string }
  | { tipo: "avisar"; agendamentoId: string };

interface Aviso {
  tom: "ok" | "alerta";
  texto: string;
}

/** O que foi feito num movimento, para o Desfazer. */
type Feito =
  | { tipo: "reagendado"; osId: Id; placa: string; data: DataISO; janela: Janela }
  | { tipo: "agendado"; osId: Id; placa: string };

const SEMANAS_VAGAS = 4;
const CHAVE_AVISAR = "ddoctor.agenda.avisar";

function lerAvisar(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_AVISAR) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const quandoTexto = (data: DataISO, janela: Janela) => `${diaCurto(data)} · ${JANELA[janela].toLowerCase()}`;

export function Agenda() {
  const { perfil } = useSessao();
  const agora = useAgora();
  const hoje = dataNoFuso(agora);
  const largo = useMidia("(min-width: 1024px)");
  const [params] = useSearchParams();
  const osParam = params.get("os");

  const [semana, setSemana] = useState(() => inicioDaSemana(hoje));
  const fimSemana = somarDias(semana, 5);
  const [modo, setModo] = useState<Modo>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [barra, setBarra] = useState<Barra | null>(null);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [ancora, setAncora] = useState<string | null>(null);
  const [pendentes, setPendentes] = useState<Record<string, { data: DataISO; janela: Janela }>>({});
  const [moverAberto, setMoverAberto] = useState<string | null>(null);
  const [avisar, setAvisar] = useState<string[]>(lerAvisar);
  const arrastando = useRef(false);
  const contador = useRef(0);

  const oss = useOSs();
  const ags = useAgendamentos();
  const cap = useCapacidade(semana, fimSemana);
  const capProx = useCapacidade(hoje, somarDias(hoje, SEMANAS_VAGAS * 7 - 1));
  const config = useConfig();
  const tipos = useTiposReparo();
  const acoes = useAcoes();

  const edita = podeEditar(perfil.papel, "agenda");
  const sensiveis = veDadosSensiveis(perfil.papel);
  const consultas = [oss, ags, cap, config];
  const carregando = consultas.some((c) => c.isPending);
  const falhou = consultas.some((c) => c.isError);
  const ocupado = [acoes.agendar, acoes.reagendar, acoes.cancelarAgendamento, acoes.marcarNaoCompareceu].some((m) => m.isPending);

  // Desfazer roda depois de o movimento terminar: lê os agendamentos mais novos por aqui.
  const agsAtuais = useRef<Agendamento[]>([]);
  useEffect(() => {
    agsAtuais.current = ags.data ?? [];
  }, [ags.data]);

  useEffect(() => {
    try {
      if (avisar.length) localStorage.setItem(CHAVE_AVISAR, JSON.stringify(avisar));
      else localStorage.removeItem(CHAVE_AVISAR);
    } catch {
      /* sem armazenamento: o aviso vale só nesta aba */
    }
  }, [avisar]);

  // ?os=ID vindo da ficha: agenda o carro da fila ou abre o agendamento existente (uma vez por id;
  // ajuste de estado durante o render, sem efeito).
  const [tratado, setTratado] = useState<string | null>(null);
  if (osParam && tratado !== osParam && oss.data) {
    setTratado(osParam);
    const v = oss.data.find((x) => x.os.id === osParam);
    if (!v) {
      setAviso({ tom: "alerta", texto: "Não encontrei esse carro. Ele pode ter sido removido." });
    } else if (v.agendamento && (v.agendamento.estado === "confirmado" || v.agendamento.estado === "proposto")) {
      setSemana(inicioDaSemana(v.agendamento.data));
      setModo({ tipo: "ver", agendamentoId: v.agendamento.id });
    } else if (v.os.estado === "aguardando_agendamento") {
      setModo({ tipo: "agendar", osId: v.os.id });
    } else {
      setAviso({ tom: "alerta", texto: `A OS ${v.os.numero} não está esperando agendamento.` });
    }
  }

  // ------------------------------------------------------------ visão otimista (movimentos em envio)
  const agsVista = useMemo(() => {
    const lista = (ags.data ?? []).map((a) => {
      const p = pendentes[`ag:${a.id}`];
      return p ? { ...a, data: p.data, janela: p.janela } : a;
    });
    for (const [chave, p] of Object.entries(pendentes)) {
      if (!chave.startsWith("os:")) continue;
      const osId = chave.slice(3);
      lista.push({ id: `novo-${osId}`, osId, data: p.data, janela: p.janela, estado: "confirmado", origem: "recepcao" });
    }
    return lista;
  }, [ags.data, pendentes]);

  const emEnvio = useMemo(
    () => new Set(Object.keys(pendentes).map((c) => (c.startsWith("ag:") ? c.slice(3) : `novo-${c.slice(3)}`))),
    [pendentes],
  );

  const ignorarId = modo?.tipo === "reagendar" ? modo.agendamentoId : undefined;

  const dias = useMemo(
    () => (cap.data && oss.data && config.data && ags.data ? montarDias(cap.data, agsVista, oss.data, config.data, agora, hoje, ignorarId) : []),
    [cap.data, ags.data, agsVista, oss.data, config.data, agora, hoje, ignorarId],
  );
  const diasProx = useMemo(
    () => (capProx.data && oss.data && config.data && ags.data ? montarDias(capProx.data, agsVista, oss.data, config.data, agora, hoje, ignorarId) : []),
    [capProx.data, ags.data, agsVista, oss.data, config.data, agora, hoje, ignorarId],
  );

  const fila = useMemo(
    () =>
      (oss.data ?? [])
        .filter((v) => v.os.estado === "aguardando_agendamento" && !pendentes[`os:${v.os.id}`])
        .sort((a, b) => aprovadaEm(a).localeCompare(aprovadaEm(b)))
        .map((v) => ({ v, dias: diasEsperando(v, hoje) })),
    [oss.data, hoje, pendentes],
  );

  const saidas = useMemo(() => {
    const r: Record<DataISO, OSVisao[]> = {};
    for (const d of dias) r[d.data] = saidasDoDia(oss.data ?? [], d.data);
    return r;
  }, [dias, oss.data]);

  const agSelecionado: Agendamento | undefined =
    modo && modo.tipo !== "agendar" ? ags.data?.find((a) => a.id === modo.agendamentoId) : undefined;
  const vSelecionado = modo?.tipo === "agendar" ? oss.data?.find((v) => v.os.id === modo.osId) : oss.data?.find((v) => v.os.id === agSelecionado?.osId);
  const escolha = modo?.tipo === "agendar" || modo?.tipo === "reagendar" ? modo.tipo : null;

  // ------------------------------------------------------------ o que pode ser movido
  const movelPorChave = useCallback(
    (chave: string): Movel | undefined => {
      const porOS = (id: string) => oss.data?.find((v) => v.os.id === id);
      if (chave.startsWith("os:")) {
        const v = porOS(chave.slice(3));
        return v && v.os.estado === "aguardando_agendamento" ? movelDaFila(v) : undefined;
      }
      const ag = agsVista.find((a) => a.id === chave.slice(3));
      if (!ag || !estaNaGrade(ag, agora) || emEnvio.has(ag.id)) return undefined;
      const v = porOS(ag.osId);
      return podeMover(v) ? movelDe({ ag, v }) : undefined;
    },
    [oss.data, agsVista, agora, emEnvio],
  );

  const grupoMarcado = useMemo(() => marcados.map(movelPorChave).filter((m): m is Movel => Boolean(m)), [marcados, movelPorChave]);

  const grupoDe = useCallback(
    (chave: string): Movel[] => {
      if (marcados.includes(chave) && grupoMarcado.length > 0) return grupoMarcado;
      const m = movelPorChave(chave);
      return m ? [m] : [];
    },
    [marcados, grupoMarcado, movelPorChave],
  );

  const diaDe = useCallback((data: DataISO) => dias.find((d) => d.data === data) ?? diasProx.find((d) => d.data === data), [dias, diasProx]);

  const avaliar = useCallback(
    (data: DataISO, janela: Janela, grupo: Movel[]): AvaliacaoDestino => avaliarDestino(diaDe(data), janela, grupo),
    [diaDe],
  );

  // ------------------------------------------------------------ ações do painel
  async function executar(fn: () => Promise<Resultado>, sucesso: string, depois: Modo = null) {
    setAviso(null);
    try {
      const r = await fn();
      if (r.ok) {
        setAviso({ tom: "ok", texto: sucesso });
        setModo(depois);
      } else {
        setAviso({ tom: "alerta", texto: mensagemErro(r.codigo) });
      }
      return r.ok;
    } catch {
      setAviso({ tom: "alerta", texto: mensagemErro() });
      return false;
    }
  }

  const nomeCarro = vSelecionado ? `${vSelecionado.veiculo.modelo ?? "Carro"} (${vSelecionado.veiculo.placa})` : "Carro";

  function marcarAvisar(osIds: string[], ligar: boolean) {
    if (osIds.length === 0) return;
    setAvisar((atual) => (ligar ? [...new Set([...atual, ...osIds])] : atual.filter((id) => !osIds.includes(id))));
  }

  function escolherHorario(data: DataISO, janela: Janela) {
    const quando = `${diaCurto(data)}, ${JANELA[janela].toLowerCase()}`;
    if (modo?.tipo === "agendar") {
      void executar(() => acoes.agendar.mutateAsync([modo.osId, data, janela]), `${nomeCarro} agendado para ${quando}.`);
    } else if (modo?.tipo === "reagendar") {
      const confirmado = agSelecionado?.estado === "confirmado" ? agSelecionado.osId : undefined;
      void executar(() => acoes.reagendar.mutateAsync([modo.agendamentoId, data, janela]), `${nomeCarro} reagendado para ${quando}.`).then((ok) => {
        if (ok && confirmado) marcarAvisar([confirmado], true);
      });
    }
    if (data < semana || data > fimSemana) setSemana(inicioDaSemana(data));
  }

  // ------------------------------------------------------------ mover (arrastar, "Mover para…")
  const novaBarra = (b: Omit<Extract<Barra, { tipo: "aviso" }>, "id" | "tipo">) => setBarra({ tipo: "aviso", id: ++contador.current, ...b });

  function soltar(grupo: Movel[], data: DataISO, janela: Janela, a: AvaliacaoDestino) {
    setMoverAberto(null);
    if (a.encaixe === 0) {
      void executarMovimento(grupo, data, janela, false);
      return;
    }
    const quando = quandoTexto(data, janela);
    const dia = diaDe(data);
    const quem = a.total === 1 ? (grupo.find((m) => !(m.data === data && m.janela === janela))?.placa ?? "o carro") : `os ${a.total}`;
    setBarra({
      tipo: "encaixe",
      id: ++contador.current,
      texto: a.cabem === 0 ? `${quando} está lotado. Encaixar ${quem} mesmo assim?` : `Só ${a.cabem} de ${a.total} cabem em ${quando}. Encaixar todos?`,
      onEncaixar: () => void executarMovimento(grupo, data, janela, true),
      soQueCabem:
        a.cabem > 0 && dia
          ? {
              texto: `Só ${a.cabem}`,
              fazer: () => {
                const { vao, ficam } = separarQueCabem(dia, janela, grupo);
                void executarMovimento(vao, data, janela, false, ficam.length);
              },
            }
          : undefined,
      onCancelar: () => setBarra(null),
    });
  }

  async function executarMovimento(grupo: Movel[], data: DataISO, janela: Janela, encaixe: boolean, ficaram = 0) {
    const movem = grupo.filter((m) => !(m.data === data && m.janela === janela));
    if (movem.length === 0) return;
    setBarra(null);
    setAviso(null);
    setMarcados([]);
    setPendentes((p) => ({ ...p, ...Object.fromEntries(movem.map((m) => [m.chave, { data, janela }])) }));
    if (modo && modo.tipo !== "agendar" && movem.some((m) => m.agendamentoId === modo.agendamentoId)) setModo(null);

    const feitos: Feito[] = [];
    const erros: string[] = [];
    const avisarNovos: string[] = [];
    for (const m of movem) {
      try {
        if (m.agendamentoId) {
          const antes = agsAtuais.current.find((x) => x.id === m.agendamentoId);
          const r = await acoes.reagendar.mutateAsync([m.agendamentoId, data, janela, encaixe]);
          if (r.ok) {
            feitos.push({ tipo: "reagendado", osId: m.osId, placa: m.placa, data: m.data!, janela: m.janela! });
            if (antes?.estado === "confirmado") avisarNovos.push(m.osId);
          } else erros.push(`${m.placa}: ${mensagemErro(r.codigo)}`);
        } else {
          const r = await acoes.agendar.mutateAsync([m.osId, data, janela, encaixe]);
          if (r.ok) feitos.push({ tipo: "agendado", osId: m.osId, placa: m.placa });
          else erros.push(`${m.placa}: ${mensagemErro(r.codigo)}`);
        }
      } catch {
        erros.push(`${m.placa}: ${mensagemErro()}`);
      }
    }
    await Promise.all([ags.refetch(), oss.refetch()]);
    setPendentes((p) => {
      const n = { ...p };
      for (const m of movem) delete n[m.chave];
      return n;
    });
    marcarAvisar(avisarNovos, true);
    if (data < semana || data > fimSemana) setSemana(inicioDaSemana(data));

    const quando = quandoTexto(data, janela);
    const verbo = feitos.every((f) => f.tipo === "agendado") ? "agendado" : "movido";
    const partes: string[] = [];
    if (feitos.length === 1) partes.push(`${feitos[0].placa} ${verbo} para ${quando}${encaixe ? " (encaixe)" : ""}.`);
    else if (feitos.length > 1) partes.push(`${feitos.length} carros ${verbo}s para ${quando}${encaixe ? " (encaixe)" : ""}.`);
    if (ficaram > 0) partes.push(`${plural(ficaram, "carro ficou", "carros ficaram")} onde estava${ficaram > 1 ? "m" : ""} (sem vaga).`);
    if (erros.length > 0) partes.push(feitos.length === 0 ? `Não deu para mover. ${erros[0]}` : `${plural(erros.length, "não foi", "não foram")}: ${erros[0]}`);
    novaBarra({
      tom: erros.length > 0 ? (feitos.length === 0 ? "alerta" : "atencao") : ficaram > 0 ? "atencao" : "ok",
      texto: partes.join(" "),
      desfazer: feitos.length > 0 ? () => void desfazer(feitos) : undefined,
    });
  }

  async function desfazer(feitos: Feito[]) {
    setBarra(null);
    const erros: string[] = [];
    let ok = 0;
    for (const f of feitos) {
      const atual = agsAtuais.current.find((a) => a.osId === f.osId && (a.estado === "confirmado" || a.estado === "proposto"));
      if (!atual) {
        erros.push(`${f.placa}: não encontrei o agendamento.`);
        continue;
      }
      try {
        const r =
          f.tipo === "reagendado"
            ? await acoes.reagendar.mutateAsync([atual.id, f.data, f.janela, true])
            : await acoes.cancelarAgendamento.mutateAsync([atual.id, "Desfeito na agenda"]);
        if (r.ok) ok++;
        else erros.push(`${f.placa}: ${mensagemErro(r.codigo)}`);
      } catch {
        erros.push(`${f.placa}: ${mensagemErro()}`);
      }
    }
    await Promise.all([ags.refetch(), oss.refetch()]);
    marcarAvisar(
      feitos.map((f) => f.osId),
      false,
    );
    novaBarra(
      erros.length === 0
        ? { tom: "ok", texto: ok === 1 ? `Desfeito: ${feitos[0].placa} voltou para onde estava.` : `Desfeito: ${ok} carros voltaram para onde estavam.` }
        : { tom: ok ? "atencao" : "alerta", texto: `Não deu para desfazer tudo. ${erros[0]}` },
    );
  }

  async function naoVeio(item: ItemAgenda) {
    const placa = item.v?.veiculo.placa ?? "Carro";
    try {
      const r = await acoes.marcarNaoCompareceu.mutateAsync([item.ag.id]);
      novaBarra(r.ok ? { tom: "ok", texto: `${placa} marcado como não veio. Voltou para a fila.` } : { tom: "alerta", texto: mensagemErro(r.codigo) });
      if (r.ok && modo && modo.tipo !== "agendar" && modo.agendamentoId === item.ag.id) setModo(null);
    } catch {
      novaBarra({ tom: "alerta", texto: mensagemErro() });
    }
  }

  // ------------------------------------------------------------ seleção (caixinha; Ctrl/⌘ e Shift no clique)
  const ordemGrade = useMemo(() => chavesEmOrdem(dias, (it) => podeMover(it.v) && !emEnvio.has(it.ag.id)), [dias, emEnvio]);

  function alternar(chave: string) {
    setMarcados((atual) => (atual.includes(chave) ? atual.filter((c) => c !== chave) : [...atual, chave]));
    setAncora(chave);
  }

  function clicarCartao(item: ItemAgenda, e: MouseEvent | KeyboardEvent) {
    const chave = `ag:${item.ag.id}`;
    const movivel = edita && podeMover(item.v);
    if (movivel && (e.metaKey || e.ctrlKey)) return alternar(chave);
    if (movivel && e.shiftKey) {
      setMarcados((atual) => selecionarIntervalo(ordemGrade, atual, ancora, chave));
      setAncora(chave);
      return;
    }
    setAviso(null);
    setModo(modo?.tipo === "ver" && modo.agendamentoId === item.ag.id ? null : { tipo: "ver", agendamentoId: item.ag.id });
  }

  const temMarcados = marcados.length > 0;
  useEffect(() => {
    if (!temMarcados) return;
    const tecla = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !arrastando.current && !e.defaultPrevented) {
        setMarcados([]);
        setMoverAberto((m) => (m === "selecao" ? null : m));
      }
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [temMarcados]);

  function irPara(nova: DataISO) {
    setSemana(nova);
  }

  // ------------------------------------------------------------ estados de tela
  const navegacao = (
    <SeletorPeriodo
      rotulo="Semana"
      texto={`${diaMes(semana)} – ${diaMes(fimSemana)}`}
      onAnterior={() => irPara(somarDias(semana, -7))}
      onProximo={() => irPara(somarDias(semana, 7))}
      rotuloAnterior="Semana anterior"
      rotuloProximo="Próxima semana"
      larguraTexto="min-w-[124px]"
      atalho={semana !== inicioDaSemana(hoje) ? { texto: "Hoje", onClick: () => irPara(inicioDaSemana(hoje)) } : undefined}
    />
  );

  const capacidadePadrao = config.data?.capacidadePadrao;
  const naOficina = (oss.data ?? []).filter((v) => v.os.estado === "na_oficina").length;
  const marcadas = dias.reduce((s, d) => s + d.itens.manha.length + d.itens.tarde.length, 0);
  const livres = dias.filter((d) => !d.passado).reduce((s, d) => s + d.restantes, 0);
  const porDia = capacidadePadrao ? `${plural(capacidadePadrao.vagasEntrada, "entrada", "entradas")} por dia` : "";

  const resumo = capacidadePadrao ? (
    <>
      <span className="numero">{plural(marcadas, "entrada marcada", "entradas marcadas")}</span> nesta semana ·{" "}
      <span className="numero">{plural(livres, "vaga livre", "vagas livres")}</span> · padrão de{" "}
      {config.data && campoConfigProvisorio(config.data, "vagasEntrada") ? <Provisorio>{porDia}</Provisorio> : porDia}
    </>
  ) : undefined;

  const painel =
    modo && vSelecionado ? (
      modo.tipo === "avisar" && agSelecionado ? (
        <PainelAvisar
          key={`avisar-${agSelecionado.id}`}
          v={vSelecionado}
          ag={agSelecionado}
          veSensiveis={sensiveis}
          onFechar={() => setModo(null)}
          onAvisado={() => {
            marcarAvisar([vSelecionado.os.id], false);
            setModo(null);
            novaBarra({ tom: "ok", texto: `${vSelecionado.veiculo.placa}: cliente avisado.` });
          }}
        />
      ) : modo.tipo === "ver" && agSelecionado ? (
        <PainelAgendamento
          key={agSelecionado.id}
          ag={agSelecionado}
          v={vSelecionado}
          agora={agora}
          hoje={hoje}
          tipos={tipos.data ?? []}
          veSensiveis={sensiveis}
          podeEditar={edita}
          podeAbrirFicha={podeVer(perfil.papel, "orcamentos")}
          ocupado={ocupado}
          onFechar={() => setModo(null)}
          onReagendar={() => setModo({ tipo: "reagendar", agendamentoId: agSelecionado.id })}
          onEscolherOutro={() => setModo({ tipo: "agendar", osId: vSelecionado.os.id })}
          onConfirmarProposta={() =>
            executar(
              () => acoes.agendar.mutateAsync([vSelecionado.os.id, agSelecionado.data, agSelecionado.janela]),
              `${nomeCarro} confirmado para ${diaCurto(agSelecionado.data)}, ${JANELA[agSelecionado.janela].toLowerCase()}.`,
            )
          }
          onCancelar={(motivo) =>
            executar(() => acoes.cancelarAgendamento.mutateAsync([agSelecionado.id, motivo]), `Agendamento de ${nomeCarro} cancelado. O carro voltou para a fila.`)
          }
          onNaoCompareceu={() =>
            executar(() => acoes.marcarNaoCompareceu.mutateAsync([agSelecionado.id]), `${nomeCarro} marcado como não compareceu. Voltou para a fila.`)
          }
          onEntradaRegistrada={(mensagem) => {
            setAviso({ tom: "ok", texto: mensagem });
            setModo(null);
          }}
        />
      ) : modo.tipo === "agendar" || modo.tipo === "reagendar" ? (
        <PainelEscolha
          key={`${modo.tipo}-${vSelecionado.os.id}`}
          modo={modo.tipo}
          v={vSelecionado}
          atual={modo.tipo === "reagendar" ? agSelecionado : undefined}
          vagas={proximasVagas(diasProx, 6, modo.tipo === "reagendar" && agSelecionado ? agSelecionado : undefined)}
          veSensiveis={sensiveis}
          ocupado={ocupado}
          onEscolher={escolherHorario}
          onFechar={() => setModo(modo.tipo === "reagendar" ? { tipo: "ver", agendamentoId: modo.agendamentoId } : null)}
        />
      ) : null
    ) : null;

  const blocoAviso = aviso && (
    <div
      role={aviso.tom === "alerta" ? "alert" : "status"}
      className={`flex items-start justify-between gap-3 px-4 py-3 mb-4 rounded-cartao border ${
        aviso.tom === "ok" ? "bg-ok-claro text-ok border-ok/25" : "bg-alerta-claro text-alerta border-alerta/25"
      }`}
    >
      <p className="font-medium flex items-center gap-2">
        <Icone nome={aviso.tom === "ok" ? "ok" : "alerta"} />
        {aviso.texto}
      </p>
      <button type="button" onClick={() => setAviso(null)} aria-label="Fechar aviso" className="shrink-0 -my-1 inline-grid place-items-center w-8 h-8 rounded-controle hover:bg-cartao/60">
        <Icone nome="fechar" tamanho={16} />
      </button>
    </div>
  );

  if (falhou) {
    return (
      <>
        <CabecalhoPagina titulo="Agenda" acoes={navegacao} />
        <Erro mensagem="Não consegui carregar a agenda." onTentar={() => consultas.forEach((c) => c.refetch())} />
      </>
    );
  }

  const listaFila = (
    <Cartao titulo="Aguardando agendamento" contagem={carregando ? undefined : fila.length}>
      {carregando ? (
        <div className="p-4">
          <Esqueleto linhas={3} altura="h-24" />
        </div>
      ) : (
        <div className="lg:max-h-[calc(100svh-260px)] lg:overflow-y-auto">
          <FilaAgendamento
            itens={fila}
            agora={agora}
            veSensiveis={sensiveis}
            podeAgendar={edita}
            agendandoId={modo?.tipo === "agendar" ? modo.osId : undefined}
            primeiraVaga={proximasVagas(diasProx, 1)[0]}
            marcados={new Set(marcados)}
            onMarcar={alternar}
            onAgendar={(v) => {
              setAviso(null);
              setModo(modo?.tipo === "agendar" && modo.osId === v.os.id ? null : { tipo: "agendar", osId: v.os.id });
            }}
          />
        </div>
      )}
    </Cartao>
  );

  const moverCartao = (item: ItemAgenda) => {
    const chave = `ag:${item.ag.id}`;
    setMoverAberto((m) => (m === chave ? null : chave));
  };
  const grupoMover = moverAberto === "selecao" ? grupoMarcado : moverAberto ? grupoDe(moverAberto) : [];
  const conteudoMover =
    moverAberto && grupoMover.length > 0 ? (
      <MoverPara
        key={moverAberto}
        grupo={grupoMover}
        dias={diasProx}
        avaliar={avaliar}
        onFechar={() => setMoverAberto(null)}
        onEscolher={(data, janela) => soltar(grupoMover, data, janela, avaliar(data, janela, grupoMover))}
      />
    ) : null;

  const propsGrade = {
    dias,
    agora,
    hoje,
    selecionadoId: agSelecionado?.id,
    escolha,
    saidas,
    marcados: new Set(marcados),
    emEnvio,
    avisar: new Set(avisar),
    podeEditar: edita,
    veSeguradora: sensiveis,
    onSelecionar: (ag: Agendamento) => setModo({ tipo: "ver", agendamentoId: ag.id }),
    onClicarCartao: clicarCartao,
    onMarcar: alternar,
    onNaoVeio: (item: ItemAgenda) => void naoVeio(item),
    onAvisar: (item: ItemAgenda) => {
      setAviso(null);
      setModo({ tipo: "avisar", agendamentoId: item.ag.id });
    },
    onEscolher: escolherHorario,
    onMoverPara: largo ? undefined : moverCartao,
    moverAberto,
    conteudoMover: moverAberto !== "selecao" ? conteudoMover : null,
  };

  const grade = carregando ? (
    <Esqueleto linhas={largo ? 1 : 4} altura={largo ? "h-[420px]" : "h-28"} />
  ) : largo ? (
    <GradeSemana {...propsGrade} />
  ) : (
    <ListaDias {...propsGrade} />
  );

  const semanaVazia = !carregando && marcadas === 0 && !escolha;

  const barraSelecao = edita && grupoMarcado.length > 0 && (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-4 pr-2 py-2 rounded-cartao border border-tinta/25 bg-cartao shadow-cartao">
        <p className="text-[14px] font-semibold numero">
          {plural(grupoMarcado.length, "carro selecionado", "carros selecionados")}
          {largo && <span className="ml-2 font-normal text-[13px] text-tinta-suave">arraste um deles para mover todos</span>}
        </p>
        <div className="ml-auto flex items-center gap-1.5">
          <Botao
            variante="contorno"
            tamanho="denso"
            icone="agenda"
            aria-expanded={moverAberto === "selecao"}
            onClick={() => setMoverAberto((m) => (m === "selecao" ? null : "selecao"))}
          >
            Mover para…
          </Botao>
          <Botao variante="fantasma" tamanho="denso" onClick={() => setMarcados([])}>
            Limpar
          </Botao>
        </div>
      </div>
      {moverAberto === "selecao" && conteudoMover}
    </div>
  );

  return (
    <>
      <CabecalhoPagina titulo="Agenda" resumo={resumo} acoes={navegacao} />
      {blocoAviso}
      {capacidadePadrao && naOficina >= capacidadePadrao.carrosSimultaneos && (
        <p className="mb-4 px-4 py-2.5 rounded-cartao bg-atencao-claro text-atencao font-medium text-[13px] border border-atencao/25">
          {plural(naOficina, "carro", "carros")} na oficina — limite de{" "}
          {config.data && campoConfigProvisorio(config.data, "carrosSimultaneos") ? (
            <Provisorio>{capacidadePadrao.carrosSimultaneos}</Provisorio>
          ) : (
            capacidadePadrao.carrosSimultaneos
          )}
          .
        </p>
      )}

      <ProvedorArrastar
        habilitado={edita}
        grupoDe={grupoDe}
        avaliar={avaliar}
        descrever={quandoTexto}
        onSoltar={soltar}
        onRecusar={(texto) => novaBarra({ tom: "alerta", texto })}
        onMudar={(a) => {
          arrastando.current = a;
        }}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px] items-start">
          <div className="min-w-0 flex flex-col gap-3">
            {!largo && painel}
            {barraSelecao}
            {escolha && vSelecionado && (
              <p className="px-4 py-2.5 rounded-cartao bg-amarelo-claro border border-amarelo/60 text-amarelo-tinta text-[13px] font-medium">
                {escolha === "agendar" ? "Agendando" : "Reagendando"} {nomeCarro}: escolha um período com vaga.
              </p>
            )}
            {grade}
            {semanaVazia && (
              <p className="text-[13px] text-tinta-suave">
                Nenhum carro marcado nesta semana.{" "}
                {fila.length > 0 ? `${plural(fila.length, "carro espera", "carros esperam")} na fila — arraste para um dia ou use “Agendar”.` : "A fila também está vazia."}
              </p>
            )}
          </div>
          <aside aria-label="Fila e ações" className="min-w-0 flex flex-col gap-4">
            {largo && painel}
            {listaFila}
          </aside>
        </div>
      </ProvedorArrastar>
      <BarraMovimento barra={barra} onFechar={() => setBarra(null)} />
    </>
  );
}

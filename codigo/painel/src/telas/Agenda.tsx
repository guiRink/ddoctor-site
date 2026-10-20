import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Agendamento, DataISO, Janela } from "@compartilhado/tipos";
import { campoConfigProvisorio } from "@compartilhado/dominio/config";
import { dataNoFuso, somarDias } from "@compartilhado/dominio/fuso";
import { mensagemErro, useAcoes, useAgendamentos, useAgora, useCapacidade, useConfig, useOSs, useTiposReparo } from "../dados/hooks";
import type { Resultado } from "../dados/repositorio";
import { useSessao } from "../dados/sessao";
import { podeEditar, podeVer, veDadosSensiveis } from "../dominio/permissoes";
import { JANELA } from "../dominio/rotulos";
import { CabecalhoPagina, Cartao, Erro, Esqueleto } from "../componentes/ui/Basicos";
import { SeletorPeriodo } from "../componentes/ui/Periodo";
import { Provisorio } from "../componentes/ui/Estado";
import { Icone } from "../componentes/Icone";
import { FilaAgendamento } from "../componentes/agenda/Fila";
import { diaCurto, diaMes, inicioDaSemana, plural } from "../componentes/agenda/formato";
import { GradeSemana, ListaDias } from "../componentes/agenda/Grade";
import { diasEsperando, aprovadaEm, montarDias, proximasVagas } from "../componentes/agenda/modelo";
import { PainelAgendamento, PainelEscolha } from "../componentes/agenda/PainelAcao";
import { useMidia } from "../componentes/agenda/useLargura";

/**
 * Agenda (recepção, gestor, dono): semana seg–sáb × manhã/tarde com a ocupação de cada dia,
 * fila "Aguardando agendamento" à direita e ações no painel lateral (sem modal).
 * docs/painel-design.md §5 · informações §3.3 · arquitetura §7.2–7.3.
 */

type Modo =
  | null
  | { tipo: "agendar"; osId: string }
  | { tipo: "reagendar"; agendamentoId: string }
  | { tipo: "ver"; agendamentoId: string };

interface Aviso {
  tom: "ok" | "alerta";
  texto: string;
}

const SEMANAS_VAGAS = 4;

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

  const ignorarId = modo?.tipo === "reagendar" ? modo.agendamentoId : undefined;

  const dias = useMemo(
    () => (cap.data && ags.data && oss.data && config.data ? montarDias(cap.data, ags.data, oss.data, config.data, agora, hoje, ignorarId) : []),
    [cap.data, ags.data, oss.data, config.data, agora, hoje, ignorarId],
  );
  const diasProx = useMemo(
    () => (capProx.data && ags.data && oss.data && config.data ? montarDias(capProx.data, ags.data, oss.data, config.data, agora, hoje, ignorarId) : []),
    [capProx.data, ags.data, oss.data, config.data, agora, hoje, ignorarId],
  );

  const fila = useMemo(
    () =>
      (oss.data ?? [])
        .filter((v) => v.os.estado === "aguardando_agendamento")
        .sort((a, b) => aprovadaEm(a).localeCompare(aprovadaEm(b)))
        .map((v) => ({ v, dias: diasEsperando(v, hoje) })),
    [oss.data, hoje],
  );

  const agSelecionado: Agendamento | undefined =
    modo && modo.tipo !== "agendar" ? ags.data?.find((a) => a.id === modo.agendamentoId) : undefined;
  const vSelecionado = modo?.tipo === "agendar" ? oss.data?.find((v) => v.os.id === modo.osId) : oss.data?.find((v) => v.os.id === agSelecionado?.osId);
  const escolha = modo?.tipo === "agendar" || modo?.tipo === "reagendar" ? modo.tipo : null;

  // ------------------------------------------------------------ ações
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
    } catch {
      setAviso({ tom: "alerta", texto: mensagemErro() });
    }
  }

  const nomeCarro = vSelecionado ? `${vSelecionado.veiculo.modelo ?? "Carro"} (${vSelecionado.veiculo.placa})` : "Carro";

  function escolherHorario(data: DataISO, janela: Janela) {
    const quando = `${diaCurto(data)}, ${JANELA[janela].toLowerCase()}`;
    if (modo?.tipo === "agendar") {
      void executar(() => acoes.agendar.mutateAsync([modo.osId, data, janela]), `${nomeCarro} agendado para ${quando}.`);
    } else if (modo?.tipo === "reagendar") {
      void executar(() => acoes.reagendar.mutateAsync([modo.agendamentoId, data, janela]), `${nomeCarro} reagendado para ${quando}.`);
    }
    if (data < semana || data > fimSemana) setSemana(inicioDaSemana(data));
  }

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

  const resumo = capacidadePadrao ? (
    <>
      <span className="numero">{plural(marcadas, "entrada marcada", "entradas marcadas")}</span> nesta semana ·{" "}
      <span className="numero">{plural(livres, "vaga livre", "vagas livres")}</span> · padrão de{" "}
      {config.data && campoConfigProvisorio(config.data, "vagasEntrada") ? (
        <>
          <Provisorio>{plural(capacidadePadrao.vagasEntrada, "entrada", "entradas")} por dia</Provisorio>{" "}
          <span className="text-[12px] text-atencao font-medium">(provisório — a confirmar)</span>
        </>
      ) : (
        `${plural(capacidadePadrao.vagasEntrada, "entrada", "entradas")} por dia`
      )}
    </>
  ) : undefined;

  const painel =
    modo && vSelecionado ? (
      modo.tipo === "ver" && agSelecionado ? (
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
      ) : modo.tipo !== "ver" ? (
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
            onAgendar={(v) => {
              setAviso(null);
              setModo(modo?.tipo === "agendar" && modo.osId === v.os.id ? null : { tipo: "agendar", osId: v.os.id });
            }}
          />
        </div>
      )}
    </Cartao>
  );

  const propsGrade = {
    dias,
    agora,
    selecionadoId: agSelecionado?.id,
    escolha,
    onSelecionar: (ag: Agendamento) => {
      setAviso(null);
      setModo(modo?.tipo === "ver" && modo.agendamentoId === ag.id ? null : { tipo: "ver", agendamentoId: ag.id });
    },
    onEscolher: escolherHorario,
  };

  const grade = carregando ? (
    <Esqueleto linhas={largo ? 1 : 4} altura={largo ? "h-[420px]" : "h-28"} />
  ) : largo ? (
    <GradeSemana {...propsGrade} />
  ) : (
    <ListaDias {...propsGrade} />
  );

  const semanaVazia = !carregando && marcadas === 0 && !escolha;

  return (
    <>
      <CabecalhoPagina titulo="Agenda" resumo={resumo} acoes={navegacao} />
      {blocoAviso}
      {capacidadePadrao && naOficina >= capacidadePadrao.carrosSimultaneos && (
        <p className="mb-4 px-4 py-2.5 rounded-cartao bg-atencao-claro text-atencao font-medium text-[13px] border border-atencao/25">
          {plural(naOficina, "carro", "carros")} na oficina — limite de {capacidadePadrao.carrosSimultaneos}{" "}
          <span className="font-normal">
            {config.data && campoConfigProvisorio(config.data, "carrosSimultaneos") && "(provisório — a confirmar). "}
            Agendar continua possível; é só um aviso.
          </span>
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px] items-start">
        <div className="min-w-0 flex flex-col gap-3">
          {!largo && painel}
          {escolha && vSelecionado && (
            <p className="px-4 py-2.5 rounded-cartao bg-amarelo-claro border border-amarelo/60 text-amarelo-tinta text-[13px] font-medium">
              {escolha === "agendar" ? "Agendando" : "Reagendando"} {nomeCarro}: escolha um período com vaga.
            </p>
          )}
          {grade}
          {semanaVazia && (
            <p className="text-[13px] text-tinta-suave">
              Nenhum carro marcado nesta semana.{" "}
              {fila.length > 0 ? `Há ${plural(fila.length, "carro", "carros")} na fila — use “Agendar”.` : "A fila também está vazia."}
            </p>
          )}
        </div>
        <aside aria-label="Fila e ações" className="min-w-0 flex flex-col gap-4">
          {largo && painel}
          {listaFila}
        </aside>
      </div>
    </>
  );
}

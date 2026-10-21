import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import type { Agendamento, DataISO, Janela, MarcoISO } from "@compartilhado/tipos";
import { formatarDuracao } from "@compartilhado/dominio/tempos";
import type { OSVisao } from "../../dados/repositorio";
import { ESTADO_AGENDAMENTO, JANELA } from "../../dominio/rotulos";
import { Etiqueta } from "../ui/Estado";
import { SUPERFICIE } from "../ui/Basicos";
import { Placa } from "../ui/Placa";
import { Icone } from "../Icone";
import { MotivoAlvo } from "./Arrastar";
import { classesAlvo, useAlvo, useArrastar, useArrastavel } from "./ganchosArrastar";
import { diaCurto, diaMes, plural } from "./formato";
import { COMPACTAR_A_PARTIR, clienteCurto, minutosParaExpirar, movelDe, origemCurta, periodoLivre, podeMover, tamanhoServico, textoOcupacao, type DiaAgenda, type ItemAgenda } from "./modelo";

// Grade da semana (desktop) e lista por dia (celular) — docs/painel-design.md §5 Agenda.
// Sprint SG: cartões arrastáveis (um ou vários pela caixinha), compactos a partir de 3 por turno,
// vagas por turno e saídas prometidas no cabeçalho do dia, "Não veio" e "Avisar cliente" no cartão.

export type ModoEscolha = "agendar" | "reagendar" | null;

export interface PropsGrade {
  dias: DiaAgenda[];
  agora: MarcoISO;
  hoje: DataISO;
  selecionadoId?: string;
  escolha: ModoEscolha;
  /** Carros com entrega prometida em cada dia (ainda na oficina ou prontos). */
  saidas: Record<DataISO, OSVisao[]>;
  /** Chaves marcadas na caixinha ("ag:<id>"). */
  marcados: ReadonlySet<string>;
  /** Agendamentos com escrita em andamento (otimista): não arrastam. */
  emEnvio: ReadonlySet<string>;
  /** OS de carros confirmados que mudaram de dia e ainda não foram avisados. */
  avisar: ReadonlySet<string>;
  podeEditar: boolean;
  veSeguradora: boolean;
  onSelecionar: (ag: Agendamento) => void;
  onClicarCartao: (item: ItemAgenda, e: MouseEvent | KeyboardEvent) => void;
  onMarcar: (chave: string) => void;
  onNaoVeio: (item: ItemAgenda) => void;
  onAvisar: (item: ItemAgenda) => void;
  onEscolher: (data: string, janela: Janela) => void;
  /** Celular: abre o "Mover para…" do cartão (e devolve o conteúdo aberto, se for este). */
  onMoverPara?: (item: ItemAgenda) => void;
  moverAberto?: string | null;
  conteudoMover?: ReactNode;
}

// ------------------------------------------------------------------ peças pequenas

/** Barra de ocupação: um segmento por vaga (amarelo = ocupada, cinza = livre; vermelho quando lota). */
export function BarraOcupacao({ dia, sobreAmarelo = false }: { dia: DiaAgenda; sobreAmarelo?: boolean }) {
  const total = Math.max(dia.total, dia.ocupadas);
  if (total === 0) return <div aria-hidden="true" className="h-1.5 rounded-full hachurado" />;
  const lotado = dia.restantes === 0;
  const cheio = lotado ? "bg-alerta" : "bg-amarelo";
  const vazio = sobreAmarelo ? "bg-amarelo-tinta/15" : "bg-cinza-200";
  if (total > 12) {
    return (
      <div aria-hidden="true" className={`h-1.5 rounded-full overflow-hidden ${vazio}`}>
        <div className={`h-full rounded-full ${cheio}`} style={{ width: `${Math.min(100, (dia.ocupadas / total) * 100)}%` }} />
      </div>
    );
  }
  return (
    <div aria-hidden="true" className="flex gap-[3px]">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-1.5 flex-1 rounded-full ${i < dia.ocupadas ? cheio : vazio}`} />
      ))}
    </div>
  );
}

/** Estado do agendamento: Confirmado, ou proposta da Calia com o tempo até expirar. */
export function EstadoAgendamento({ ag, agora }: { ag: Agendamento; agora: MarcoISO }) {
  const e = ESTADO_AGENDAMENTO[ag.estado];
  if (ag.estado !== "proposto") return <Etiqueta tom={e.tom}>{e.texto}</Etiqueta>;
  const min = minutosParaExpirar(ag, agora);
  return (
    <span className="flex flex-col items-start gap-0.5 min-w-0">
      <Etiqueta tom={e.tom} className="whitespace-normal h-auto min-h-6 py-0.5 leading-tight">
        {ag.origem === "calia" ? "Proposto pela Calia" : e.texto}
      </Etiqueta>
      {min !== undefined && (
        <span className="text-[12px] text-atencao font-medium numero leading-tight">
          {min > 0 ? `expira em ${formatarDuracao(min)}` : "proposta expirada"}
        </span>
      )}
    </span>
  );
}

/** Proposta ainda não confirmada: ponto laranja + texto (cabe em 100 px). Confirmado não precisa de selo. */
function Proposta({ ag, agora }: { ag: Agendamento; agora: MarcoISO }) {
  const min = minutosParaExpirar(ag, agora);
  return (
    <span className="block text-[12px] font-medium leading-tight text-atencao">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="inline-block w-1.5 h-1.5 rounded-full shrink-0 bg-atencao" />
        {ag.origem === "calia" ? "Proposto pela Calia" : "Horário proposto"}
      </span>
      {min !== undefined && <span className="block numero font-normal mt-0.5">{min > 0 ? `expira em ${formatarDuracao(min)}` : "proposta expirada"}</span>}
    </span>
  );
}

/** Cadeado discreto (o ícone do painel não tem cadeado; traço igual ao do `Icone`). */
function Cadeado({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
    </svg>
  );
}

function rotuloCartao(item: ItemAgenda, movivel: boolean): string {
  const placa = item.v?.veiculo.placa ?? "";
  const modelo = item.v?.veiculo.modelo ?? "carro";
  const fim = movivel ? "Enter abre as ações; espaço pega para mover" : "Já entrou na oficina; Enter abre as ações";
  return `${placa} ${modelo}, ${diaCurto(item.ag.data)} ${JANELA[item.ag.janela].toLowerCase()}, ${ESTADO_AGENDAMENTO[item.ag.estado].texto}. ${fim}`;
}

/** Caixinha do cartão: sempre à vista (a recepção seleciona por ela, plano SG). Área de toque maior que o quadrado. */
function Caixinha({ marcado, placa, onMarcar, grande = false }: { marcado: boolean; placa: string; onMarcar: () => void; grande?: boolean }) {
  return (
    <label
      className={`relative z-10 inline-grid place-items-center shrink-0 cursor-pointer ${grande ? "w-11 h-11 -m-2" : "w-6 h-6 -m-1"}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={marcado}
        onChange={onMarcar}
        aria-label={`Selecionar ${placa} para mover`}
        className={`${grande ? "w-5 h-5" : "w-4 h-4"} cursor-pointer`}
      />
    </label>
  );
}

const ACAO_PEQUENA =
  "relative z-10 inline-flex items-center gap-1 h-6 px-1 -mx-1 rounded-controle text-[12px] font-semibold whitespace-nowrap transition-colors duration-150";

/**
 * Cartão do carro agendado. O botão principal cobre o cartão (clique abre as ações; espaço pega
 * para arrastar); caixinha e ações pequenas ficam por cima dele. Proposta tem borda tracejada.
 */
export function CartaoAgendamento({
  item,
  agora,
  hoje,
  aberto,
  marcado,
  enviando,
  avisar,
  compacto = false,
  linha = false,
  podeEditar,
  veSeguradora,
  onClicar,
  onMarcar,
  onNaoVeio,
  onAvisar,
  onMoverPara,
  moverAberto = false,
}: {
  item: ItemAgenda;
  agora: MarcoISO;
  hoje: DataISO;
  aberto: boolean;
  marcado: boolean;
  enviando: boolean;
  avisar: boolean;
  compacto?: boolean;
  linha?: boolean;
  podeEditar: boolean;
  veSeguradora: boolean;
  onClicar: (e: MouseEvent | KeyboardEvent) => void;
  onMarcar: () => void;
  onNaoVeio: () => void;
  onAvisar: () => void;
  onMoverPara?: () => void;
  moverAberto?: boolean;
}) {
  const { ag, v } = item;
  const movivel = podeMover(v);
  const arrasta = podeEditar && movivel && !enviando;
  const movel = movelDe(item);
  const { prender, prenderAtivador, atributos, ouvintes, levando, acabouDeArrastar } = useArrastavel(movel, !arrasta);
  const proposto = ag.estado === "proposto";
  const naoVeio = podeEditar && movivel && ag.estado === "confirmado" && ag.data <= hoje;
  const placa = v?.veiculo.placa ?? "";
  const origem = origemCurta(v, veSeguradora);
  const tamanho = tamanhoServico(v);
  const cliente = clienteCurto(v?.cliente.nome);

  const borda = aberto
    ? "border-amarelo-escuro bg-amarelo-claro ring-2 ring-amarelo/30"
    : marcado
      ? "border-tinta bg-cartao ring-1 ring-tinta/40"
      : `${proposto ? "border-dashed border-atencao" : "border-linha"} bg-cartao shadow-controle hover:border-linha-forte`;

  const clicar = (e: MouseEvent) => {
    if (acabouDeArrastar()) return;
    onClicar(e);
  };

  const trava =
    !movivel && v ? (
      <span className="relative z-10 inline-grid place-items-center w-6 h-6 -m-1 shrink-0 text-tinta-fraca" title="Já entrou na oficina: não muda de dia">
        <Cadeado />
        <span className="sr-only">Já entrou na oficina</span>
      </span>
    ) : null;

  const seletor = trava ?? (podeEditar && movivel ? <Caixinha marcado={marcado} placa={placa} onMarcar={onMarcar} grande={linha} /> : null);

  const acoes =
    podeEditar && (naoVeio || avisar) ? (
      <span className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
        {avisar && (
          <button
            type="button"
            onClick={onAvisar}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={`Avisar o cliente de ${placa}: o horário mudou`}
            className={`${ACAO_PEQUENA} text-atencao hover:bg-atencao-claro ${linha ? "h-9" : ""}`}
          >
            {linha && <Icone nome="telefone" tamanho={14} />}
            Avisar cliente
          </button>
        )}
        {naoVeio && (
          <button
            type="button"
            onClick={onNaoVeio}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={`${placa} não veio`}
            className={`${ACAO_PEQUENA} text-tinta-suave hover:text-tinta hover:bg-cinza-100 ${linha ? "h-9" : ""}`}
          >
            Não veio
          </button>
        )}
      </span>
    ) : null;

  const placaVisual = v ? (
    <span aria-hidden="true" className={linha || compacto ? "shrink-0" : "block w-full"}>
      <Placa placa={placa} tamanho="p" encolher={!linha && !compacto} />
    </span>
  ) : (
    <span className="text-[12px] text-tinta-fraca">OS removida</span>
  );

  const modelo = (
    <span aria-hidden="true" className="min-w-0 truncate text-[13px] font-semibold leading-tight" title={v?.veiculo.modelo}>
      {v?.veiculo.modelo ?? "Modelo não informado"}
    </span>
  );

  const detalhes = (
    <>
      {linha ? (
        <span aria-hidden="true" className="block text-[13px] text-tinta-suave leading-tight truncate" title={v?.cliente.nome}>
          {[v?.cliente.nome, origem].filter(Boolean).join(" · ")}
        </span>
      ) : (
        <>
          {cliente && (
            <span aria-hidden="true" className="block text-[12px] text-tinta-suave leading-tight truncate" title={v?.cliente.nome}>
              {cliente}
            </span>
          )}
          {origem && (
            <span aria-hidden="true" className="block text-[12px] text-tinta-suave leading-tight truncate" title={origem}>
              {origem}
            </span>
          )}
        </>
      )}
      {tamanho && (
        <span aria-hidden="true" className="block text-[12px] text-tinta leading-tight numero line-clamp-2 mt-0.5" title={tamanho}>
          {tamanho}
        </span>
      )}
      {proposto && (
        <span aria-hidden="true" className="block mt-1">
          <Proposta ag={ag} agora={agora} />
        </span>
      )}
    </>
  );

  return (
    <div
      ref={prender}
      {...ouvintes}
      className={`relative rounded-controle border ${borda} transition-colors duration-150 select-none ${arrasta ? "touch-manipulation" : ""} ${
        levando ? "opacity-40" : enviando ? "opacity-60" : ""
      }`}
    >
      <button
        ref={prenderAtivador}
        type="button"
        {...atributos}
        aria-label={rotuloCartao(item, movivel)}
        aria-pressed={aberto}
        onClick={clicar}
        className={`absolute inset-0 w-full h-full rounded-controle ${arrasta ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
      />
      {linha ? (
        <div className="flex items-start gap-3 px-3 py-2.5">
          <span className="pt-1">{seletor}</span>
          <span className="min-w-0 flex-1 flex flex-col gap-1">
            {placaVisual}
            <span className="flex min-w-0">{modelo}</span>
            {detalhes}
            {acoes}
          </span>
          {onMoverPara && podeEditar && movivel && (
            <button
              type="button"
              onClick={onMoverPara}
              aria-expanded={moverAberto}
              aria-label={`Mover ${placa} para outro dia`}
              className="relative z-10 shrink-0 inline-flex items-center gap-1.5 h-11 px-3 rounded-controle border border-linha-forte bg-cartao text-[13px] font-semibold shadow-controle hover:bg-cinza-50"
            >
              <Icone nome="agenda" tamanho={16} />
              Mover
            </button>
          )}
        </div>
      ) : compacto ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 p-1">
          {placaVisual}
          <span className="flex items-center gap-1.5 min-w-0 flex-1 basis-[88px] pl-0.5">
            {seletor}
            {modelo}
          </span>
          {acoes && <span className="basis-full">{acoes}</span>}
        </div>
      ) : (
        <div className="flex flex-col items-start gap-1 p-1.5">
          {placaVisual}
          <span className="flex items-center gap-1.5 min-w-0 w-full pl-0.5 mt-0.5">
            {seletor}
            {modelo}
          </span>
          <span className="block w-full min-w-0">{detalhes}</span>
          {acoes}
        </div>
      )}
      <span role="status" className="sr-only">
        {enviando ? `Movendo ${placa}…` : ""}
      </span>
    </div>
  );
}

/** Botão de horário quando a recepção está escolhendo onde agendar/reagendar (pelo painel). */
function BotaoPeriodo({
  dia,
  janela,
  escolha,
  onEscolher,
  largo = false,
}: {
  dia: DiaAgenda;
  janela: Janela;
  escolha: Exclude<ModoEscolha, null>;
  onEscolher: PropsGrade["onEscolher"];
  largo?: boolean;
}) {
  const livre = periodoLivre(dia, janela);
  const verbo = escolha === "agendar" ? "Agendar aqui" : "Mover para cá";
  const quando = `${diaCurto(dia.data)}, ${JANELA[janela].toLowerCase()}`;
  return (
    <button
      type="button"
      disabled={!livre}
      onClick={() => onEscolher(dia.data, janela)}
      aria-label={livre ? `${verbo}: ${quando} (${plural(dia.restantes, "vaga livre", "vagas livres")})` : `${quando}: sem vaga`}
      className={`w-full ${largo ? "h-11 text-[14px]" : "h-9 text-[13px]"} px-2 font-semibold rounded-controle border border-dashed transition-colors duration-150 ${
        livre
          ? "border-amarelo-escuro bg-amarelo-claro text-amarelo-tinta hover:bg-amarelo hover:text-preto hover:border-amarelo"
          : "border-linha-forte text-tinta-fraca cursor-not-allowed"
      }`}
    >
      {livre ? verbo : "Sem vaga"}
    </button>
  );
}

function AvisoFechado({ texto }: { texto: string }) {
  return <p className="px-1 text-[12px] text-tinta-fraca font-medium">{texto}</p>;
}

/** Quantos entram em cada turno (a vaga é do dia; plano SG: vagas por turno). Duas linhas curtas, cabem em 100 px. */
function PorTurno({ dia }: { dia: DiaAgenda }) {
  if (dia.bloqueado || dia.fechado) return null;
  const turnos = JANELAS_ROTULO.filter(({ janela }) => !dia.periodosFechados.includes(janela));
  return (
    <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 text-[12px] leading-[1.35] text-tinta-suave numero">
      {turnos.map(({ janela }) => (
        <div key={janela} className="contents">
          <dt>{JANELA[janela]}</dt>
          <dd className={`m-0 text-right ${dia.itens[janela].length ? "font-semibold text-tinta" : ""}`}>{dia.itens[janela].length}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Saídas prometidas do dia (é a saída que diz se cabe mais carro). As placas quebram linha inteiras. */
function Saidas({ lista, linha = false }: { lista: OSVisao[] | undefined; linha?: boolean }) {
  if (!lista || lista.length === 0) return null;
  return (
    <p className={`text-[12px] text-tinta-suave leading-[1.35] numero ${linha ? "mt-1.5" : "pt-1.5 mt-1.5 border-t border-linha"}`}>
      <span className="font-medium text-tinta mr-1">Saem</span>
      {lista.map((v, i) => (
        <span key={v.os.id} className="inline-block mr-1 whitespace-nowrap">
          {v.veiculo.placa}
          {i < lista.length - 1 ? "," : ""}
        </span>
      ))}
    </p>
  );
}

// ------------------------------------------------------------------ grade (recepção, ≥ 1024 px)

export function GradeSemana(p: PropsGrade) {
  const { dias, agora, hoje, selecionadoId, escolha, onEscolher } = p;
  return (
    <div
      className={`grid ${SUPERFICIE} overflow-hidden`}
      style={{ gridTemplateColumns: `28px repeat(${dias.length}, minmax(0, 1fr))`, gridTemplateRows: "auto minmax(150px, auto) minmax(150px, auto)" }}
    >
      <div style={{ gridColumn: 1, gridRow: 1 }} className="border-b border-linha" />
      {JANELAS_ROTULO.map(({ janela, linha }) => (
        <div
          key={janela}
          style={{ gridColumn: 1, gridRow: linha }}
          className={`flex items-center justify-center bg-cinza-50 ${linha === 3 ? "border-t border-linha" : ""}`}
        >
          <span className="rotulo text-tinta-suave [writing-mode:vertical-rl] rotate-180">{JANELA[janela]}</span>
        </div>
      ))}

      {dias.map((dia, i) => {
        const col = i + 2;
        const lotado = !dia.bloqueado && !dia.fechado && dia.total > 0 && dia.restantes === 0;
        const fundo = dia.bloqueado || dia.fechado ? "hachurado" : lotado ? "bg-alerta-claro/60" : dia.passado ? "bg-cinza-50" : dia.hoje ? "bg-amarelo-claro/35" : "";
        const cabecalho = dia.hoje ? "bg-amarelo-claro" : lotado ? "bg-alerta-claro" : "";
        const idCab = `dia-${dia.data}`;
        return (
          <div key={dia.data} role="group" aria-labelledby={idCab} className="contents">
            <div style={{ gridColumn: col, gridRow: 1 }} className={`relative border-l border-b border-linha px-3 pt-2.5 pb-2.5 min-w-0 ${cabecalho}`}>
              {dia.hoje && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-amarelo" />}
              <h3 id={idCab} className="leading-none">
                <span className={`rotulo block ${dia.hoje ? "text-amarelo-tinta" : dia.passado ? "text-tinta-fraca" : "text-tinta-suave"}`}>
                  {diaCurto(dia.data).split(" ")[0]}
                  {dia.hoje && " · hoje"}
                </span>
                <span className={`block mt-1 text-[20px] font-semibold tracking-[-0.01em] numero ${dia.passado ? "text-tinta-fraca" : ""}`}>{diaMes(dia.data)}</span>
              </h3>
              <p className={`mt-1.5 text-[12px] numero font-medium ${lotado ? "text-alerta" : dia.hoje ? "text-amarelo-tinta" : "text-tinta-suave"}`}>
                {lotado ? `Lotado · ${dia.ocupadas} de ${dia.total}` : textoOcupacao(dia)}
              </p>
              <div className="mt-1.5">
                <BarraOcupacao dia={dia} sobreAmarelo={dia.hoje} />
              </div>
              <div className="mt-2">
                <PorTurno dia={dia} />
                <Saidas lista={p.saidas[dia.data]} />
              </div>
            </div>

            {dia.bloqueado || dia.fechado ? (
              <CelulaFechada dia={dia} col={col} fundo={fundo} />
            ) : (
              JANELAS_ROTULO.map(({ janela, linha }) => {
                const fechado = dia.periodosFechados.includes(janela);
                const itens = dia.itens[janela];
                const compacto = itens.length >= COMPACTAR_A_PARTIR;
                return (
                  <CelulaGrade key={janela} dia={dia} janela={janela} linha={linha} col={col} fundo={fundo}>
                    {itens.map((item) => (
                      <CartaoDaGrade key={item.ag.id} item={item} p={p} compacto={compacto} aberto={item.ag.id === selecionadoId} agora={agora} hoje={hoje} />
                    ))}
                      {fechado && itens.length === 0 && <AvisoFechado texto={`Fechado à ${janela === "tarde" ? "tarde" : "manhã"}`} />}
                      {escolha && !fechado && !dia.passado && <BotaoPeriodo dia={dia} janela={janela} escolha={escolha} onEscolher={onEscolher} />}
                  </CelulaGrade>
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
}

function CelulaGrade({ dia, janela, linha, col, fundo, children }: { dia: DiaAgenda; janela: Janela; linha: number; col: number; fundo: string; children: ReactNode }) {
  const { prender, ...alvo } = useAlvo(dia.data, janela);
  const fechado = dia.periodosFechados.includes(janela);
  return (
    <div
      ref={prender}
      style={{ gridColumn: col, gridRow: linha }}
      className={`border-l border-linha p-1 flex flex-col gap-1 min-w-0 transition-colors duration-150 ${linha === 3 ? "border-t" : ""} ${fechado ? "hachurado" : fundo} ${classesAlvo(alvo)}`}
    >
      <MotivoAlvo alvo={alvo} />
      {children}
    </div>
  );
}

/** Dia inteiro sem expediente ou bloqueado: uma célula só (recusa o soltar com o motivo). */
function CelulaFechada({ dia, col, fundo }: { dia: DiaAgenda; col: number; fundo: string }) {
  const { prender, ...alvo } = useAlvo(dia.data, "manha");
  return (
    <div ref={prender} style={{ gridColumn: col, gridRow: "2 / 4" }} className={`border-l border-linha p-2.5 ${fundo} ${classesAlvo(alvo)}`}>
      <MotivoAlvo alvo={alvo} />
      <p className="bg-cartao border border-linha rounded-controle px-2.5 py-2 text-[12px] leading-snug">
        <span className="block font-medium text-alerta">{dia.bloqueado ? "Dia bloqueado" : "Sem expediente"}</span>
        {dia.bloqueado && <span className="block mt-0.5 text-tinta-suave break-words">{dia.bloqueado}</span>}
      </p>
    </div>
  );
}

function CartaoDaGrade({
  item,
  p,
  compacto,
  aberto,
  agora,
  hoje,
  linha = false,
}: {
  item: ItemAgenda;
  p: PropsGrade;
  compacto: boolean;
  aberto: boolean;
  agora: MarcoISO;
  hoje: DataISO;
  linha?: boolean;
}) {
  const chave = `ag:${item.ag.id}`;
  return (
    <CartaoAgendamento
      item={item}
      agora={agora}
      hoje={hoje}
      aberto={aberto}
      marcado={p.marcados.has(chave)}
      enviando={p.emEnvio.has(item.ag.id)}
      avisar={p.avisar.has(item.ag.osId)}
      compacto={compacto}
      linha={linha}
      podeEditar={p.podeEditar}
      veSeguradora={p.veSeguradora}
      onClicar={(e) => p.onClicarCartao(item, e)}
      onMarcar={() => p.onMarcar(chave)}
      onNaoVeio={() => p.onNaoVeio(item)}
      onAvisar={() => p.onAvisar(item)}
      onMoverPara={p.onMoverPara ? () => p.onMoverPara?.(item) : undefined}
      moverAberto={p.moverAberto === chave}
    />
  );
}

const JANELAS_ROTULO: { janela: Janela; linha: number }[] = [
  { janela: "manha", linha: 2 },
  { janela: "tarde", linha: 3 },
];

// ------------------------------------------------------------------ lista por dia (celular)

/** Turno da lista do celular: também recebe o soltar (toque longo no cartão e arrastar). */
function TurnoLista({ dia, janela, children }: { dia: DiaAgenda; janela: Janela; children: ReactNode }) {
  const { prender, ...alvo } = useAlvo(dia.data, janela);
  return (
    <div ref={prender} className={`flex flex-col gap-1.5 rounded-controle -m-1.5 p-1.5 transition-colors duration-150 ${classesAlvo(alvo)}`}>
      <p className="rotulo text-tinta-suave">
        {JANELA[janela]} <span className="numero text-tinta-fraca">{dia.itens[janela].length || ""}</span>
      </p>
      <MotivoAlvo alvo={alvo} />
      {children}
    </div>
  );
}

export function ListaDias(p: PropsGrade) {
  const { dias, agora, hoje, selecionadoId, escolha, onEscolher } = p;
  const arrastando = Boolean(useArrastar().grupo);
  return (
    <ol className="flex flex-col gap-3">
      {dias.map((dia) => {
        const lotado = !dia.bloqueado && !dia.fechado && dia.total > 0 && dia.restantes === 0;
        const vazio = dia.itens.manha.length + dia.itens.tarde.length === 0;
        return (
          <li
            key={dia.data}
            className={`border border-linha rounded-cartao shadow-cartao overflow-hidden ${dia.bloqueado || dia.fechado ? "hachurado" : lotado ? "bg-alerta-claro" : "bg-cartao"}`}
          >
            <div className={`relative px-3.5 py-3 border-b border-linha ${dia.hoje ? "bg-amarelo-claro" : "bg-cartao"}`}>
              {dia.hoje && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-amarelo" />}
              <div className="flex items-center justify-between gap-3">
                <h3 className={`flex items-center gap-2 text-[16px] font-semibold numero ${dia.passado ? "text-tinta-fraca" : ""}`}>
                  {diaCurto(dia.data)}
                  {dia.hoje && <span className="text-[13px] font-medium text-amarelo-tinta">hoje</span>}
                </h3>
                <div className="w-28 shrink-0">
                  <p className={`text-[12px] font-medium numero text-right ${lotado ? "text-alerta" : dia.hoje ? "text-amarelo-tinta" : "text-tinta-suave"}`}>
                    {lotado ? `Lotado · ${dia.ocupadas} de ${dia.total}` : textoOcupacao(dia)}
                  </p>
                  <div className="mt-1">
                    <BarraOcupacao dia={dia} sobreAmarelo={dia.hoje} />
                  </div>
                </div>
              </div>
              <Saidas lista={p.saidas[dia.data]} linha />
            </div>
            {dia.bloqueado || dia.fechado ? (
              <p className="m-3 bg-cartao border border-linha rounded-controle px-3 py-2 text-[13px]">
                <span className="block text-[12px] font-medium text-alerta">{dia.bloqueado ? "Dia bloqueado" : "Sem expediente"}</span>
                {dia.bloqueado && <span className="text-tinta-suave">{dia.bloqueado}</span>}
              </p>
            ) : vazio && !escolha ? (
              <VazioLista dia={dia} />
            ) : (
              <div className="flex flex-col gap-3 p-3.5">
                {JANELAS_ROTULO.map(({ janela }) => {
                  const fechado = dia.periodosFechados.includes(janela);
                  const itens = dia.itens[janela];
                  if (fechado || (itens.length === 0 && !arrastando && (!escolha || dia.passado))) return null;
                  return (
                    <TurnoLista key={janela} dia={dia} janela={janela}>
                      {itens.map((item) => (
                        <div key={item.ag.id} className="flex flex-col gap-2">
                          <CartaoDaGrade item={item} p={p} compacto={false} linha aberto={item.ag.id === selecionadoId} agora={agora} hoje={hoje} />
                          {p.moverAberto === `ag:${item.ag.id}` && p.conteudoMover}
                        </div>
                      ))}
                      {escolha && !dia.passado && <BotaoPeriodo dia={dia} janela={janela} escolha={escolha} onEscolher={onEscolher} largo />}
                    </TurnoLista>
                  );
                })}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Dia sem carro no celular: ainda recebe o soltar (manhã/tarde como alvos baixos). */
function VazioLista({ dia }: { dia: DiaAgenda }) {
  const arrastando = Boolean(useArrastar().grupo);
  if (!arrastando) return <p className="px-3.5 py-3 text-[13px] text-tinta-fraca">Nenhum carro agendado.</p>;
  return (
    <div className="grid grid-cols-2 gap-2 p-3">
      {JANELAS_ROTULO.filter(({ janela }) => !dia.periodosFechados.includes(janela)).map(({ janela }) => (
        <AlvoVazio key={janela} dia={dia} janela={janela} />
      ))}
    </div>
  );
}

function AlvoVazio({ dia, janela }: { dia: DiaAgenda; janela: Janela }) {
  const { prender, ...alvo } = useAlvo(dia.data, janela);
  return (
    <div ref={prender} className={`h-14 grid place-items-center rounded-controle border border-dashed border-linha-forte text-[13px] font-medium text-tinta-suave ${classesAlvo(alvo)}`}>
      {alvo.sobre && alvo.avaliacao?.motivo ? alvo.avaliacao.motivo : JANELA[janela]}
    </div>
  );
}

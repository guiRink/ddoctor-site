import type { Agendamento, Janela, MarcoISO } from "@compartilhado/tipos";
import { formatarDuracao } from "@compartilhado/dominio/tempos";
import { ESTADO_AGENDAMENTO, JANELA } from "../../dominio/rotulos";
import { Etiqueta } from "../ui/Estado";
import { Placa } from "../ui/Placa";
import { diaCurto, diaMes, plural } from "./formato";
import { minutosParaExpirar, periodoLivre, textoOcupacao, type DiaAgenda, type ItemAgenda } from "./modelo";

// Grade da semana (desktop) e lista por dia (celular) — docs/painel-design.md §5 Agenda.

export type ModoEscolha = "agendar" | "reagendar" | null;

export interface PropsGrade {
  dias: DiaAgenda[];
  agora: MarcoISO;
  selecionadoId?: string;
  escolha: ModoEscolha;
  onSelecionar: (ag: Agendamento) => void;
  onEscolher: (data: string, janela: Janela) => void;
}

// ------------------------------------------------------------------ peças pequenas

/** Barra de ocupação: um segmento por vaga (preto = ocupada; vermelho quando lota). */
export function BarraOcupacao({ dia, sobreAmarelo = false }: { dia: DiaAgenda; sobreAmarelo?: boolean }) {
  const total = Math.max(dia.total, dia.ocupadas);
  if (total === 0) return <div aria-hidden="true" className="h-1.5 hachurado" />;
  const lotado = dia.restantes === 0;
  const cheio = lotado ? "bg-alerta" : "bg-preto";
  const vazio = sobreAmarelo ? "bg-preto/15" : "bg-linha-forte/60";
  if (total > 12) {
    return (
      <div aria-hidden="true" className={`h-1.5 ${vazio}`}>
        <div className={`h-full ${cheio}`} style={{ width: `${Math.min(100, (dia.ocupadas / total) * 100)}%` }} />
      </div>
    );
  }
  return (
    <div aria-hidden="true" className="flex gap-[2px]">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-1.5 flex-1 ${i < dia.ocupadas ? cheio : vazio}`} />
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
        <span className="text-[12px] text-atencao font-semibold numero leading-tight">
          {min > 0 ? `expira em ${formatarDuracao(min)}` : "proposta expirada"}
        </span>
      )}
    </span>
  );
}

const COR_PONTO: Record<string, { ponto: string; texto: string }> = {
  ok: { ponto: "bg-ok", texto: "text-ok" },
  atencao: { ponto: "bg-atencao", texto: "text-atencao" },
  alerta: { ponto: "bg-alerta", texto: "text-alerta" },
};

/** Versão compacta do estado para o cartão da grade (ponto + texto, sem caixa-alta): cabe em 110 px. */
function EstadoCompacto({ ag, agora }: { ag: Agendamento; agora: MarcoISO }) {
  const e = ESTADO_AGENDAMENTO[ag.estado];
  const cor = COR_PONTO[e.tom] ?? { ponto: "bg-tinta-fraca", texto: "text-tinta-suave" };
  const min = ag.estado === "proposto" ? minutosParaExpirar(ag, agora) : undefined;
  return (
    <span className={`block text-[12px] font-semibold leading-tight ${cor.texto}`}>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className={`inline-block w-2 h-2 shrink-0 ${cor.ponto}`} />
        {ag.estado === "proposto" && ag.origem === "calia" ? "Proposto pela Calia" : e.texto}
      </span>
      {min !== undefined && <span className="block numero font-normal mt-0.5">{min > 0 ? `expira em ${formatarDuracao(min)}` : "proposta expirada"}</span>}
    </span>
  );
}

function rotuloCartao(item: ItemAgenda): string {
  const placa = item.v?.veiculo.placa ?? "";
  const modelo = item.v?.veiculo.modelo ?? "carro";
  return `${placa} ${modelo}, ${diaCurto(item.ag.data)} ${JANELA[item.ag.janela].toLowerCase()}, ${ESTADO_AGENDAMENTO[item.ag.estado].texto}. Abrir ações`;
}

/** Cartão do carro agendado. Proposta (ainda não confirmada) tem borda tracejada. */
export function CartaoAgendamento({
  item,
  agora,
  selecionado,
  linha = false,
  onSelecionar,
}: {
  item: ItemAgenda;
  agora: MarcoISO;
  selecionado: boolean;
  linha?: boolean;
  onSelecionar: () => void;
}) {
  const { ag, v } = item;
  const proposto = ag.estado === "proposto";
  const borda = selecionado ? "border-amarelo-escuro bg-amarelo-claro" : `${proposto ? "border-dashed border-atencao" : "border-linha-forte"} bg-cartao hover:bg-amarelo-claro`;
  return (
    <button
      type="button"
      aria-pressed={selecionado}
      aria-label={rotuloCartao(item)}
      onClick={onSelecionar}
      className={`w-full text-left border ${borda} transition-colors duration-150 ${
        linha ? "flex items-center gap-3 px-3 py-2.5 min-h-14" : "flex flex-col items-start gap-1.5 p-1.5"
      }`}
    >
      {v ? <Placa placa={v.veiculo.placa} tamanho="p" encolher={!linha} /> : <span className="text-[12px] text-tinta-fraca">OS removida</span>}
      <span className={`min-w-0 ${linha ? "flex-1" : "w-full"}`}>
        <span className="block text-[13px] font-semibold leading-tight truncate" title={v?.veiculo.modelo}>
          {v?.veiculo.modelo ?? "Modelo não informado"}
        </span>
        <span className="block text-[12px] text-tinta-suave leading-tight truncate" title={v?.cliente.nome}>
          {v?.cliente.nome}
        </span>
        <span className="block mt-1">
          <EstadoCompacto ag={ag} agora={agora} />
        </span>
      </span>
    </button>
  );
}

/** Botão de horário quando a recepção está escolhendo onde agendar/reagendar. */
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
      className={`w-full ${largo ? "h-11 text-[14px]" : "h-9 text-[13px]"} px-2 font-bold border border-dashed transition-colors duration-150 ${
        livre
          ? "border-preto bg-amarelo-claro text-preto hover:bg-amarelo"
          : "border-linha-forte text-tinta-fraca cursor-not-allowed"
      }`}
    >
      {livre ? verbo : "Sem vaga"}
    </button>
  );
}

function AvisoFechado({ texto }: { texto: string }) {
  return <p className="text-[12px] text-tinta-fraca font-semibold">{texto}</p>;
}

// ------------------------------------------------------------------ grade (recepção, ≥ 1024 px)

export function GradeSemana({ dias, agora, selecionadoId, escolha, onSelecionar, onEscolher }: PropsGrade) {
  return (
    <div
      className="grid bg-cartao border border-linha"
      style={{ gridTemplateColumns: `28px repeat(${dias.length}, minmax(0, 1fr))`, gridTemplateRows: "auto minmax(150px, auto) minmax(150px, auto)" }}
    >
      <div style={{ gridColumn: 1, gridRow: 1 }} className="border-b border-linha" />
      {JANELAS_ROTULO.map(({ janela, linha }) => (
        <div
          key={janela}
          style={{ gridColumn: 1, gridRow: linha }}
          className={`flex items-center justify-center bg-papel ${linha === 3 ? "border-t border-linha" : ""}`}
        >
          <span className="rotulo text-tinta-suave [writing-mode:vertical-rl] rotate-180">{JANELA[janela]}</span>
        </div>
      ))}

      {dias.map((dia, i) => {
        const col = i + 2;
        const lotado = !dia.bloqueado && !dia.fechado && dia.total > 0 && dia.restantes === 0;
        const fundo = dia.bloqueado || dia.fechado ? "hachurado" : lotado ? "bg-alerta-claro" : dia.passado ? "bg-papel/60" : "";
        const cabecalho = dia.hoje ? "bg-amarelo" : lotado ? "bg-alerta-claro" : "";
        const idCab = `dia-${dia.data}`;
        return (
          <div key={dia.data} role="group" aria-labelledby={idCab} className="contents">
            <div style={{ gridColumn: col, gridRow: 1 }} className={`border-l border-b border-linha px-2.5 pt-2 pb-2.5 ${cabecalho}`}>
              <h3 id={idCab} className="leading-none">
                <span className={`rotulo block ${dia.hoje ? "text-preto" : dia.passado ? "text-tinta-fraca" : "text-tinta-suave"}`}>
                  {diaCurto(dia.data).split(" ")[0]}
                  {dia.hoje && " · hoje"}
                </span>
                <span className={`block mt-1 text-[20px] font-bold numero ${dia.passado ? "text-tinta-fraca" : ""}`}>{diaMes(dia.data)}</span>
              </h3>
              <p className={`mt-1.5 text-[12px] numero font-semibold ${lotado ? "text-alerta" : dia.hoje ? "text-preto" : "text-tinta-suave"}`}>
                {lotado ? `Lotado · ${dia.ocupadas} de ${dia.total}` : textoOcupacao(dia)}
              </p>
              <div className="mt-1.5">
                <BarraOcupacao dia={dia} sobreAmarelo={dia.hoje} />
              </div>
            </div>

            {dia.bloqueado || dia.fechado ? (
              <div style={{ gridColumn: col, gridRow: "2 / 4" }} className={`border-l border-linha p-2.5 ${fundo}`}>
                <p className="bg-cartao border border-linha px-2 py-1.5 text-[12px] leading-snug">
                  <span className="rotulo block text-alerta">{dia.bloqueado ? "Dia bloqueado" : "Sem expediente"}</span>
                  {dia.bloqueado && <span className="block mt-0.5 text-tinta-suave break-words">{dia.bloqueado}</span>}
                </p>
              </div>
            ) : (
              JANELAS_ROTULO.map(({ janela, linha }) => {
                const fechado = dia.periodosFechados.includes(janela);
                return (
                  <div
                    key={janela}
                    style={{ gridColumn: col, gridRow: linha }}
                    className={`border-l border-linha p-1 flex flex-col gap-1.5 min-w-0 ${linha === 3 ? "border-t" : ""} ${fechado ? "hachurado" : fundo}`}
                  >
                    {dia.itens[janela].map((item) => (
                      <CartaoAgendamento
                        key={item.ag.id}
                        item={item}
                        agora={agora}
                        selecionado={item.ag.id === selecionadoId}
                        onSelecionar={() => onSelecionar(item.ag)}
                      />
                    ))}
                    {fechado && dia.itens[janela].length === 0 && <AvisoFechado texto={`Fechado à ${janela === "tarde" ? "tarde" : "manhã"}`} />}
                    {escolha && !fechado && !dia.passado && <BotaoPeriodo dia={dia} janela={janela} escolha={escolha} onEscolher={onEscolher} />}
                  </div>
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
}

const JANELAS_ROTULO: { janela: Janela; linha: number }[] = [
  { janela: "manha", linha: 2 },
  { janela: "tarde", linha: 3 },
];

// ------------------------------------------------------------------ lista por dia (celular)

export function ListaDias({ dias, agora, selecionadoId, escolha, onSelecionar, onEscolher }: PropsGrade) {
  return (
    <ol className="flex flex-col gap-3">
      {dias.map((dia) => {
        const lotado = !dia.bloqueado && !dia.fechado && dia.total > 0 && dia.restantes === 0;
        const vazio = dia.itens.manha.length + dia.itens.tarde.length === 0;
        return (
          <li key={dia.data} className={`border border-linha ${dia.bloqueado || dia.fechado ? "hachurado" : lotado ? "bg-alerta-claro" : "bg-cartao"}`}>
            <div className={`flex items-center justify-between gap-3 px-3 py-2.5 border-b border-linha ${dia.hoje ? "bg-amarelo" : ""}`}>
              <h3 className={`text-[16px] font-bold numero ${dia.passado ? "text-tinta-fraca" : ""}`}>
                {diaCurto(dia.data)}
                {dia.hoje && <span className="rotulo ml-2">Hoje</span>}
              </h3>
              <div className="w-28 shrink-0">
                <p className={`text-[12px] font-semibold numero text-right ${lotado ? "text-alerta" : ""}`}>
                  {lotado ? `Lotado · ${dia.ocupadas} de ${dia.total}` : textoOcupacao(dia)}
                </p>
                <div className="mt-1">
                  <BarraOcupacao dia={dia} sobreAmarelo={dia.hoje} />
                </div>
              </div>
            </div>
            {dia.bloqueado || dia.fechado ? (
              <p className="m-3 bg-cartao border border-linha px-3 py-2 text-[13px]">
                <span className="rotulo block text-alerta">{dia.bloqueado ? "Dia bloqueado" : "Sem expediente"}</span>
                {dia.bloqueado && <span className="text-tinta-suave">{dia.bloqueado}</span>}
              </p>
            ) : vazio && !escolha ? (
              <p className="px-3 py-3 text-[13px] text-tinta-fraca">Nenhum carro agendado.</p>
            ) : (
              <div className="flex flex-col gap-3 p-3">
                {JANELAS_ROTULO.map(({ janela }) => {
                  const fechado = dia.periodosFechados.includes(janela);
                  const itens = dia.itens[janela];
                  if (itens.length === 0 && (!escolha || fechado || dia.passado)) return null;
                  return (
                    <div key={janela} className="flex flex-col gap-1.5">
                      <p className="rotulo text-tinta-suave">{JANELA[janela]}</p>
                      {itens.map((item) => (
                        <CartaoAgendamento
                          key={item.ag.id}
                          item={item}
                          agora={agora}
                          linha
                          selecionado={item.ag.id === selecionadoId}
                          onSelecionar={() => onSelecionar(item.ag)}
                        />
                      ))}
                      {escolha && !fechado && !dia.passado && <BotaoPeriodo dia={dia} janela={janela} escolha={escolha} onEscolher={onEscolher} largo />}
                    </div>
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

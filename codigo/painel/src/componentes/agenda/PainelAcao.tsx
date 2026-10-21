import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Agendamento, DataISO, Janela, MarcoISO, TipoReparo } from "@compartilhado/tipos";
import type { OSVisao } from "../../dados/repositorio";
import { JANELA } from "../../dominio/rotulos";
import { Botao, SUPERFICIE } from "../ui/Basicos";
import { Placa } from "../ui/Placa";
import { Icone } from "../Icone";
import { ReceberCarro } from "../recepcao/ReceberCarro";
import { diaCurto, plural, telefoneBR } from "./formato";
import { EstadoAgendamento } from "./Grade";
import type { Vaga } from "./modelo";
import { Proveniencia } from "./Proveniencia";

// Painel lateral da Agenda (sem modal): ações sobre o carro selecionado ou escolha de horário.

const ORIGEM: Record<Agendamento["origem"], string> = { recepcao: "Recepção", calia: "Calia (WhatsApp)", cliente: "Cliente" };

const MOTIVOS_SUGERIDOS = [
  "Cliente pediu para cancelar",
  "Cliente não respondeu",
  "Autorização cancelada pela seguradora",
  "Carro levado a outra oficina",
];

export function Moldura({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  // Leva o foco ao painel ao abrir (no celular o painel fica acima da lista).
  useEffect(() => {
    ref.current?.focus({ preventScroll: false });
  }, [titulo]);
  return (
    <section aria-labelledby="painel-agenda-titulo" className={`${SUPERFICIE} overflow-hidden`}>
      <header className="flex items-center justify-between gap-3 pl-4 pr-1.5 h-12 border-b border-linha">
        <h2 id="painel-agenda-titulo" ref={ref} tabIndex={-1} className="text-[15px] font-semibold outline-none">
          {titulo}
        </h2>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar painel"
          className="inline-grid place-items-center w-9 h-9 rounded-controle text-tinta-suave hover:text-tinta hover:bg-cinza-100 transition-colors duration-150"
        >
          <Icone nome="fechar" />
        </button>
      </header>
      <div className="p-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

/** Cabeçalho do carro no painel. Com `agora`, mostra de onde veio o telefone (a fila não mostra: é ruído lá). */
export function CabecalhoCarro({ v, veSensiveis, agora }: { v: OSVisao; veSensiveis: boolean; agora?: MarcoISO }) {
  return (
    <div className="flex items-start gap-3">
      <Placa placa={v.veiculo.placa} tamanho="m" />
      <div className="min-w-0">
        <p className="font-semibold leading-tight break-words">
          {v.veiculo.modelo ?? "Modelo não informado"}
          {v.veiculo.cor && <span className="font-normal text-tinta-suave"> · {v.veiculo.cor}</span>}
        </p>
        <p className="text-[13px] text-tinta-suave break-words">{v.cliente.nome}</p>
        {veSensiveis && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] numero">
            {v.cliente.telefone ? telefoneBR(v.cliente.telefone) : <span className="text-atencao font-medium">Sem telefone · pedir à seguradora</span>}
            {v.cliente.telefone && agora && <Proveniencia prov={v.cliente.proveniencia?.telefone} agora={agora} />}
          </p>
        )}
      </div>
    </div>
  );
}

function ListaVagas({ vagas, verbo, ocupado, onEscolher }: { vagas: Vaga[]; verbo: string; ocupado: boolean; onEscolher: (d: DataISO, j: Janela) => void }) {
  if (vagas.length === 0) {
    return <p className="text-[13px] text-tinta-suave">Nenhuma vaga nas próximas 4 semanas. Avance a semana na grade ou fale com o gestor sobre a capacidade.</p>;
  }
  return (
    <div>
      <p className="text-[13px] font-medium text-tinta-suave mb-1.5">Próximas vagas</p>
      <ul className="border border-linha rounded-cartao overflow-hidden divide-y divide-linha">
        {vagas.map((vg) => (
          <li key={`${vg.data}-${vg.janela}`}>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => onEscolher(vg.data, vg.janela)}
              aria-label={`${verbo}: ${diaCurto(vg.data)}, ${JANELA[vg.janela].toLowerCase()} (${plural(vg.restantes, "vaga livre", "vagas livres")})`}
              className="w-full flex items-center justify-between gap-3 px-3 h-11 text-left hover:bg-cinza-50 transition-colors duration-150 disabled:opacity-40"
            >
              <span className="font-medium numero">
                {diaCurto(vg.data)} · {JANELA[vg.janela]}
              </span>
              <span className="text-[12px] text-tinta-suave numero">{plural(vg.restantes, "vaga", "vagas")}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ escolher horário (agendar / reagendar)

export function PainelEscolha({
  modo,
  v,
  atual,
  vagas,
  veSensiveis,
  ocupado,
  onEscolher,
  onFechar,
}: {
  modo: "agendar" | "reagendar";
  v: OSVisao;
  atual?: Agendamento;
  vagas: Vaga[];
  veSensiveis: boolean;
  ocupado: boolean;
  onEscolher: (d: DataISO, j: Janela) => void;
  onFechar: () => void;
}) {
  return (
    <Moldura titulo={modo === "agendar" ? "Agendar entrada" : "Reagendar"} onFechar={onFechar}>
      <CabecalhoCarro v={v} veSensiveis={veSensiveis} />
      {atual && (
        <p className="text-[13px]">
          <span className="text-[13px] font-medium text-tinta-suave block">Horário atual</span>
          <span className="font-semibold numero">
            {diaCurto(atual.data)} · {JANELA[atual.janela]}
          </span>
        </p>
      )}
      <p className="text-[13px] text-tinta-suave">
        Escolha o dia e o período na grade ({modo === "agendar" ? "“Agendar aqui”" : "“Mover para cá”"}) ou uma das vagas abaixo. Dias lotados ficam desabilitados.
      </p>
      <ListaVagas vagas={vagas} verbo={modo === "agendar" ? "Agendar" : "Mover para"} ocupado={ocupado} onEscolher={onEscolher} />
    </Moldura>
  );
}

// ------------------------------------------------------------------ carro agendado: ações

type Sub = null | "entrada" | "cancelar";

export function PainelAgendamento({
  ag,
  v,
  agora,
  hoje,
  tipos,
  veSensiveis,
  podeEditar,
  podeAbrirFicha,
  ocupado,
  onReagendar,
  onEscolherOutro,
  onConfirmarProposta,
  onCancelar,
  onNaoCompareceu,
  onEntradaRegistrada,
  onFechar,
}: {
  ag: Agendamento;
  v: OSVisao;
  agora: MarcoISO;
  hoje: DataISO;
  tipos: TipoReparo[];
  veSensiveis: boolean;
  podeEditar: boolean;
  podeAbrirFicha: boolean;
  ocupado: boolean;
  onReagendar: () => void;
  onEscolherOutro: () => void;
  onConfirmarProposta: () => void;
  onCancelar: (motivo: string) => void;
  onNaoCompareceu: () => void;
  /** Depois que "Receber o carro" registrou a entrada (com a mensagem de sucesso). */
  onEntradaRegistrada: (mensagem: string) => void;
  onFechar: () => void;
}) {
  const [sub, setSub] = useState<Sub>(null);
  const [motivo, setMotivo] = useState("");
  const [faltaMotivo, setFaltaMotivo] = useState(false);
  const idMotivo = useId();
  const idDicas = useId();
  const confirmado = ag.estado === "confirmado";
  const futuro = ag.data > hoje;

  function cancelar(e: FormEvent) {
    e.preventDefault();
    if (!motivo.trim()) {
      setFaltaMotivo(true);
      return;
    }
    onCancelar(motivo.trim());
  }

  return (
    <Moldura titulo={confirmado ? "Carro agendado" : "Horário proposto"} onFechar={onFechar}>
      <CabecalhoCarro v={v} veSensiveis={veSensiveis} agora={agora} />

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
        <dt className="text-[13px] font-medium text-tinta-suave self-center">Quando</dt>
        <dd className="m-0 font-semibold numero">
          {diaCurto(ag.data)} · {JANELA[ag.janela]}
        </dd>
        <dt className="text-[13px] font-medium text-tinta-suave self-center">Estado</dt>
        <dd className="m-0">
          <EstadoAgendamento ag={ag} agora={agora} />
        </dd>
        <dt className="text-[13px] font-medium text-tinta-suave self-center">Marcado por</dt>
        <dd className="m-0">{ORIGEM[ag.origem]}</dd>
      </dl>

      {podeAbrirFicha && (
        <Link to={`/orcamentos/${v.os.id}`} className="text-[13px] font-medium text-tinta underline underline-offset-4 decoration-linha-forte hover:decoration-tinta self-start">
          Abrir ficha da OS {v.os.numero}
        </Link>
      )}

      {podeEditar && (sub === null || sub === "entrada") && (
        <div className="flex flex-col gap-2 pt-4 border-t border-linha">
          {confirmado ? (
            <>
              <Botao variante="primario" icone="carro" onClick={() => setSub("entrada")} disabled={ocupado} aria-haspopup="dialog">
                Receber o carro
              </Botao>
              <Botao variante="contorno" icone="agenda" onClick={onReagendar} disabled={ocupado}>
                Reagendar
              </Botao>
              <Botao variante="contorno" icone="pessoa" onClick={onNaoCompareceu} disabled={ocupado || futuro} aria-describedby={futuro ? idDicas : undefined}>
                Não compareceu
              </Botao>
              {futuro && (
                <p id={idDicas} className="text-[12px] text-tinta-fraca -mt-1">
                  “Não compareceu” só a partir do dia agendado.
                </p>
              )}
            </>
          ) : (
            <>
              <Botao variante="primario" icone="ok" onClick={onConfirmarProposta} disabled={ocupado}>
                Confirmar este horário
              </Botao>
              <Botao variante="contorno" icone="agenda" onClick={onEscolherOutro} disabled={ocupado}>
                Escolher outro horário
              </Botao>
            </>
          )}
          <Botao variante="perigo" icone="fechar" onClick={() => setSub("cancelar")} disabled={ocupado}>
            {confirmado ? "Cancelar agendamento" : "Recusar proposta"}
          </Botao>
        </div>
      )}

      {sub === "entrada" && (
        <ReceberCarro
          v={v}
          tipos={tipos}
          onFechar={() => setSub(null)}
          onConcluido={(msg) => {
            setSub(null);
            onEntradaRegistrada(msg);
          }}
        />
      )}

      {sub === "cancelar" && (
        <form onSubmit={cancelar} noValidate className="flex flex-col gap-3 pt-3 border-t border-linha">
          <div>
            <label htmlFor={idMotivo} className="text-[13px] font-medium text-tinta-suave block mb-1.5">
              Motivo (obrigatório)
            </label>
            <input
              id={idMotivo}
              list={`${idMotivo}-lista`}
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                setFaltaMotivo(false);
              }}
              aria-invalid={faltaMotivo}
              aria-describedby={faltaMotivo ? `${idMotivo}-erro` : undefined}
              autoComplete="off"
              className={`w-full h-11 md:h-10 px-3 bg-cartao border outline-none ${faltaMotivo ? "border-alerta focus:ring-[3px] focus:ring-alerta/20" : "border-linha-forte focus:border-tinta-fraca focus:ring-[3px] focus:ring-amarelo/30"}`}
            />
            <datalist id={`${idMotivo}-lista`}>
              {MOTIVOS_SUGERIDOS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            {faltaMotivo && (
              <p id={`${idMotivo}-erro`} className="mt-1 text-[12px] font-medium text-alerta">
                Informe o motivo.
              </p>
            )}
          </div>
          <p className="text-[12px] text-tinta-suave">A vaga é liberada e o carro volta para a fila “Aguardando agendamento”.</p>
          <div className="flex flex-wrap gap-2">
            <Botao type="submit" variante="perigo" disabled={ocupado}>
              {confirmado ? "Cancelar agendamento" : "Recusar proposta"}
            </Botao>
            <Botao variante="fantasma" onClick={() => setSub(null)}>
              Voltar
            </Botao>
          </div>
        </form>
      )}
    </Moldura>
  );
}

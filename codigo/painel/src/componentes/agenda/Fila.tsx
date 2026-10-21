import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Agendamento, MarcoISO } from "@compartilhado/tipos";
import { rotuloHorario } from "../../dominio/horarios";
import type { OSVisao } from "../../dados/repositorio";
import { JANELA } from "../../dominio/rotulos";
import { Botao, Vazio } from "../ui/Basicos";
import { Etiqueta } from "../ui/Estado";
import { Placa } from "../ui/Placa";
import { Icone } from "../Icone";
import { diaCurto, telefoneBR } from "./formato";
import { EstadoAgendamento } from "./Grade";
import { mensagemAgendamento, minutosParaExpirar, movelDaFila, type Vaga } from "./modelo";
import { useArrastavel } from "./ganchosArrastar";

export interface ItemFila {
  v: OSVisao;
  dias: number;
}

/** Pegador (6 pontos): foco do teclado para arrastar o carro da fila até um dia. */
function Pegador() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
      {[7, 12, 17].flatMap((y) => [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.4} />))}
    </svg>
  );
}

/**
 * Item da fila arrastável até um dia da grade (soltar = agendar): pegador na borda esquerda
 * (foco do teclado) e caixinha antes da placa para mover vários.
 */
function ItemArrastavel({
  v,
  arrasta,
  marcado,
  onMarcar,
  className,
  children,
}: {
  v: OSVisao;
  arrasta: boolean;
  marcado: boolean;
  onMarcar: () => void;
  className: string;
  children: (caixinha: ReactNode) => ReactNode;
}) {
  const { prender, prenderAtivador, atributos, ouvintes, levando } = useArrastavel(movelDaFila(v), !arrasta);
  const caixinha = arrasta ? (
    <label className="inline-grid place-items-center w-6 h-6 -m-1 shrink-0 cursor-pointer" onPointerDown={(e) => e.stopPropagation()}>
      <input type="checkbox" checked={marcado} onChange={onMarcar} aria-label={`Selecionar ${v.veiculo.placa} para mover`} className="w-4 h-4 cursor-pointer" />
    </label>
  ) : null;
  return (
    <li
      ref={prender}
      {...ouvintes}
      className={`relative ${className} ${arrasta ? "pl-7 select-none touch-manipulation" : ""} ${levando ? "opacity-40" : ""} ${marcado ? "bg-cinza-50" : ""}`}
    >
      {arrasta && (
        <button
          ref={prenderAtivador}
          type="button"
          {...atributos}
          aria-label={`Arrastar ${v.veiculo.placa} para um dia da agenda (espaço pega, setas escolhem, espaço solta)`}
          title="Arraste até um dia da agenda"
          className="absolute left-0 inset-y-0 w-7 flex justify-center pt-[26px] text-tinta-fraca hover:text-tinta hover:bg-cinza-100 cursor-grab active:cursor-grabbing"
        >
          <Pegador />
        </button>
      )}
      {children(caixinha)}
    </li>
  );
}

/** Proposta na fila: "Proposto pela Calia · qui 22/10 · tarde" numa linha e "expira hoje 20h" embaixo. */
function PropostaFila({ ag, agora }: { ag: Agendamento; agora: MarcoISO }) {
  const min = minutosParaExpirar(ag, agora);
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Etiqueta tom="atencao">{ag.origem === "calia" ? "Proposto pela Calia" : "Horário proposto"}</Etiqueta>
        <span className="text-[13px] text-tinta numero">
          {diaCurto(ag.data)} · {JANELA[ag.janela].toLowerCase()}
        </span>
      </span>
      {min !== undefined && (
        <span className="text-[12px] font-medium text-atencao numero">{min > 0 && ag.expiraEm ? `expira ${rotuloHorario(ag.expiraEm, agora)}` : "proposta expirada"}</span>
      )}
    </div>
  );
}

export function FilaAgendamento({
  itens,
  agora,
  veSensiveis,
  podeAgendar,
  agendandoId,
  primeiraVaga,
  onAgendar,
  marcados,
  onMarcar,
}: {
  marcados: ReadonlySet<string>;
  onMarcar: (chave: string) => void;
  itens: ItemFila[];
  agora: MarcoISO;
  veSensiveis: boolean;
  podeAgendar: boolean;
  agendandoId?: string;
  primeiraVaga?: Vaga;
  onAgendar: (v: OSVisao) => void;
}) {
  const [copiado, setCopiado] = useState<{ id: string; ok: boolean; texto: string } | null>(null);
  const relogio = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(relogio.current), []);

  async function copiar(v: OSVisao) {
    const texto = mensagemAgendamento(v, primeiraVaga);
    let ok = false;
    try {
      await navigator.clipboard.writeText(texto);
      ok = true;
    } catch {
      ok = false; // sem permissão de área de transferência: mostra o texto para copiar à mão
    }
    setCopiado({ id: v.os.id, ok, texto });
    window.clearTimeout(relogio.current);
    if (ok) relogio.current = window.setTimeout(() => setCopiado(null), 2500);
  }

  if (itens.length === 0) {
    return (
      <Vazio
        titulo="Nenhum carro esperando agenda"
        texto="Quando uma autorização sair (ou o cliente aprovar o orçamento), o carro aparece aqui para agendar."
      />
    );
  }

  return (
    <ul className="divide-y divide-linha">
      {itens.map(({ v, dias }) => {
        const escolhendo = agendandoId === v.os.id;
        const telefone = v.cliente.telefone?.trim();
        const proposta = v.agendamento?.estado === "proposto" || v.agendamento?.estado === "contatando" ? v.agendamento : undefined;
        const msg = copiado?.id === v.os.id ? copiado : null;
        return (
          <ItemArrastavel
            key={v.os.id}
            v={v}
            arrasta={podeAgendar}
            marcado={marcados.has(`os:${v.os.id}`)}
            onMarcar={() => onMarcar(`os:${v.os.id}`)}
            className={`px-4 py-3.5 ${escolhendo ? "bg-amarelo-claro" : ""}`}
          >
            {(caixinha) => (
              <>
                <div className="flex items-center gap-2.5">
                  {caixinha}
                  <Placa placa={v.veiculo.placa} tamanho="p" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-tight truncate" title={v.veiculo.modelo}>
                      {v.veiculo.modelo ?? "Modelo não informado"}
                    </p>
                    <p className="text-[12px] text-tinta-suave leading-tight truncate" title={v.cliente.nome}>
                      {v.cliente.nome}
                    </p>
                    <p className="text-[12px] font-medium numero leading-tight text-tinta-suave">
                      <span className="sr-only">Esperando </span>
                      {dias === 0 ? "desde hoje" : `há ${dias} ${dias === 1 ? "dia" : "dias"}`}
                    </p>
                  </div>
                </div>

                {veSensiveis && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                    {telefone ? (
                      <span className="inline-flex items-center gap-1.5 numero">
                        <Icone nome="telefone" tamanho={14} className="text-tinta-fraca" />
                        {telefoneBR(telefone)}
                      </span>
                    ) : (
                      <Etiqueta tom="atencao" className="whitespace-normal h-auto min-h-6 py-0.5">
                        Sem telefone · pedir à seguradora
                      </Etiqueta>
                    )}
                  </div>
                )}

                {proposta && (
                  <div className="mt-2">
                    {proposta.estado === "proposto" ? (
                      <PropostaFila ag={proposta} agora={agora} />
                    ) : (
                      <EstadoAgendamento ag={proposta} agora={agora} />
                    )}
                  </div>
                )}

                {podeAgendar && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <Botao
                      variante="contorno"
                      tamanho="denso"
                      icone={escolhendo ? "fechar" : "agenda"}
                      onClick={() => onAgendar(v)}
                      aria-label={escolhendo ? `Parar de agendar ${v.veiculo.placa}` : `Agendar ${v.veiculo.placa} ${v.veiculo.modelo ?? ""}`.trim()}
                    >
                      {escolhendo ? "Parar" : "Agendar"}
                    </Botao>
                    {veSensiveis && (
                      <Botao
                        variante="contorno"
                        tamanho="denso"
                        icone={msg?.ok ? "ok" : "copiar"}
                        onClick={() => copiar(v)}
                        aria-label={`Copiar mensagem de agendamento para ${v.cliente.nome}`}
                      >
                        {msg?.ok ? "Copiada" : "Copiar mensagem"}
                      </Botao>
                    )}
                  </div>
                )}

                <p role="status" className="sr-only">
                  {msg?.ok ? "Mensagem copiada para a área de transferência." : ""}
                </p>
                {msg && !msg.ok && (
                  <div className="mt-2">
                    <label className="text-[13px] font-medium text-tinta-suave block mb-1.5" htmlFor={`msg-${v.os.id}`}>
                      Não consegui copiar sozinho. Copie o texto:
                    </label>
                    <textarea
                      id={`msg-${v.os.id}`}
                      readOnly
                      rows={4}
                      value={msg.texto}
                      onFocus={(e) => e.currentTarget.select()}
                      className="w-full p-2 text-[13px] bg-cartao border border-linha-forte focus:border-tinta-fraca focus:ring-[3px] focus:ring-amarelo/30 outline-none"
                    />
                  </div>
                )}
              </>
            )}
          </ItemArrastavel>
        );
      })}
    </ul>
  );
}

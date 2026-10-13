import { useEffect, useRef, useState } from "react";
import type { MarcoISO } from "@compartilhado/tipos";
import type { OSVisao } from "../../dados/repositorio";
import { JANELA } from "../../dominio/rotulos";
import { Botao, Vazio } from "../ui/Basicos";
import { Etiqueta } from "../ui/Estado";
import { Placa } from "../ui/Placa";
import { Icone } from "../Icone";
import { diaCurto, telefoneBR } from "./formato";
import { EstadoAgendamento } from "./Grade";
import { mensagemAgendamento, type Vaga } from "./modelo";
import { Proveniencia } from "./Proveniencia";

export interface ItemFila {
  v: OSVisao;
  dias: number;
}

export function FilaAgendamento({
  itens,
  agora,
  veSensiveis,
  podeAgendar,
  agendandoId,
  primeiraVaga,
  onAgendar,
}: {
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
          <li key={v.os.id} className={`px-4 py-3.5 ${escolhendo ? "bg-amarelo-claro" : ""}`}>
            <div className="flex items-start gap-3">
              <Placa placa={v.veiculo.placa} tamanho="p" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-tight truncate" title={v.veiculo.modelo}>
                  {v.veiculo.modelo ?? "Modelo não informado"}
                </p>
                <p className="text-[13px] text-tinta-suave leading-tight truncate" title={v.cliente.nome}>
                  {v.cliente.nome}
                </p>
              </div>
              <p className="shrink-0 text-[12px] font-medium numero text-right leading-tight text-tinta-suave">
                <span className="sr-only">Esperando </span>
                {dias === 0 ? "desde hoje" : `há ${dias} ${dias === 1 ? "dia" : "dias"}`}
              </p>
            </div>

            {veSensiveis && (
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                {telefone ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 numero">
                      <Icone nome="telefone" tamanho={14} className="text-tinta-fraca" />
                      {telefoneBR(telefone)}
                    </span>
                    <Proveniencia prov={v.cliente.proveniencia?.telefone} agora={agora} />
                  </>
                ) : (
                  <Etiqueta tom="atencao" className="whitespace-normal h-auto min-h-6 py-0.5">
                    Sem telefone — pedir à Maxpar
                  </Etiqueta>
                )}
              </div>
            )}

            {proposta && (
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                <EstadoAgendamento ag={proposta} agora={agora} />
                {proposta.estado === "proposto" && (
                  <span className="text-[12px] text-tinta-suave numero">
                    {diaCurto(proposta.data)} · {JANELA[proposta.janela].toLowerCase()}
                  </span>
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
          </li>
        );
      })}
    </ul>
  );
}

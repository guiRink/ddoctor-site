import { useId, useState } from "react";
import type { Agendamento } from "@compartilhado/tipos";
import type { OSVisao } from "../../dados/repositorio";
import { JANELA } from "../../dominio/rotulos";
import { Botao, BotaoExterno } from "../ui/Basicos";
import { linkWhatsAppComMensagem } from "../orcamento/documento";
import { diaCurto } from "./formato";
import { mensagemNovoHorario } from "./modelo";
import { CabecalhoCarro, Moldura } from "./PainelAcao";

/**
 * "Avisar cliente" (plano SG): o carro confirmado mudou de dia/turno e o cliente ainda não sabe.
 * Mensagem pronta para copiar ou abrir no WhatsApp (só cliente real — contatoClicavel); "Já avisei" tira o aviso do cartão.
 */
export function PainelAvisar({
  v,
  ag,
  veSensiveis,
  onAvisado,
  onFechar,
}: {
  v: OSVisao;
  ag: Agendamento;
  veSensiveis: boolean;
  onAvisado: () => void;
  onFechar: () => void;
}) {
  const id = useId();
  const texto = mensagemNovoHorario(v, ag.data, ag.janela);
  const [copiou, setCopiou] = useState<boolean | null>(null);
  const link = veSensiveis ? linkWhatsAppComMensagem(v, texto) : null;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiou(true);
    } catch {
      setCopiou(false);
    }
  }

  return (
    <Moldura titulo="Avisar cliente" onFechar={onFechar}>
      <CabecalhoCarro v={v} veSensiveis={veSensiveis} />
      <p className="text-[13px]">
        <span className="text-[13px] font-medium text-tinta-suave block">Novo horário</span>
        <span className="font-semibold numero">
          {diaCurto(ag.data)} · {JANELA[ag.janela]}
        </span>
      </p>
      <div>
        <label htmlFor={id} className="text-[13px] font-medium text-tinta-suave block mb-1.5">
          Mensagem
        </label>
        <textarea
          id={id}
          readOnly
          rows={4}
          value={texto}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full p-2.5 text-[13px] bg-cartao border border-linha-forte focus:border-tinta-fraca focus:ring-[3px] focus:ring-amarelo/30 outline-none"
        />
        <p role="status" className="mt-1 text-[12px] text-tinta-suave min-h-4">
          {copiou === true ? "Mensagem copiada." : copiou === false ? "Não consegui copiar sozinho: selecione o texto acima." : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Botao variante="contorno" icone={copiou ? "ok" : "copiar"} onClick={copiar}>
          {copiou ? "Copiada" : "Copiar mensagem"}
        </Botao>
        {link && (
          <BotaoExterno href={link} icone="whatsapp" classeIcone="text-ok">
            WhatsApp
          </BotaoExterno>
        )}
      </div>
      <div className="pt-3 border-t border-linha">
        <Botao variante="primario" icone="ok" onClick={onAvisado} className="w-full">
          Já avisei
        </Botao>
      </div>
    </Moldura>
  );
}

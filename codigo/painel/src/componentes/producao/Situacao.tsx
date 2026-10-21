import type { CorCarro } from "@compartilhado/tipos";
import type { SituacaoCartao } from "@compartilhado/dominio/semaforo";
import { Etiqueta } from "../ui/Estado";
import { Icone } from "../Icone";
import { SITUACAO } from "./quadro";

/**
 * A pílula única do carro (revisão SG, item 3): Parado · Atrasado · Atenção · No prazo · Pronto.
 * `compacta` tira o ponto e o respiro (cabe ao lado da Placa p em coluna de 204 px — §5.1).
 */
export function PilulaSituacao({ situacao, compacta = false, className = "" }: { situacao: SituacaoCartao; compacta?: boolean; className?: string }) {
  const s = SITUACAO[situacao];
  return (
    <Etiqueta tom={s.tom} ponto={!compacta} className={`shrink-0 ${compacta ? "px-2" : ""} ${className}`}>
      {s.texto}
    </Etiqueta>
  );
}

// ------------------------------------------------------------------ cor do carro (pedido do dono, 2º áudio)

/** Faixa do motivo: verde e laranja em tom suave; vermelho cheio ("vermelho urgente"); vermelho piscando pulsa. */
const FAIXA: Record<CorCarro, string> = {
  verde: "bg-ok-claro text-ok",
  laranja: "bg-atencao-claro text-atencao",
  vermelho: "bg-alerta text-cartao",
  vermelho_piscando: "bg-alerta text-cartao piscar-cartao",
};

const NOME_COR: Record<CorCarro, string> = { verde: "verde", laranja: "laranja", vermelho: "vermelho", vermelho_piscando: "vermelho piscando" };

/**
 * O motivo da cor do carro, escrito ("Entrega amanhã e nenhuma etapa concluída", "Atrasado 2 dias"), numa faixa da
 * cor. O leitor de tela ouve a cor antes. `prazoProprio`: o carro tem prazo/alerta próprio (ícone de ajustes no fim).
 */
export function MotivoCor({
  cor,
  motivo,
  prazoProprio = false,
  tamanho = "p",
  className = "",
}: {
  cor: CorCarro;
  motivo: string;
  prazoProprio?: boolean;
  tamanho?: "p" | "m";
  className?: string;
}) {
  return (
    <p
      className={`flex items-start gap-1.5 rounded-controle font-semibold leading-snug numero ${
        tamanho === "m" ? "px-2.5 py-1.5 text-[13px]" : "px-2 py-1 text-[12px]"
      } ${FAIXA[cor]} ${className}`}
    >
      <span aria-hidden="true" className={`shrink-0 rounded-full bg-current ${tamanho === "m" ? "w-2 h-2 mt-[6px]" : "w-1.5 h-1.5 mt-[6px]"}`} />
      <span className="min-w-0 flex-1">
        <span className="sr-only">Cor do carro: {NOME_COR[cor]}. </span>
        {motivo}
      </span>
      {prazoProprio && (
        <span title="Prazo próprio deste carro" className="shrink-0 mt-[2px]">
          <Icone nome="ajustes" tamanho={tamanho === "m" ? 14 : 13} />
          <span className="sr-only">Prazo próprio deste carro.</span>
        </span>
      )}
    </p>
  );
}

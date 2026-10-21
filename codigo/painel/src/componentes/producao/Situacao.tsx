import type { SituacaoCartao } from "@compartilhado/dominio/semaforo";
import { Etiqueta } from "../ui/Estado";
import { SITUACAO } from "./quadro";

/**
 * A pílula única do carro (revisão SG, item 3): Impedido · Atrasado · Atenção · No prazo · Pronto.
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

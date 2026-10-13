import type { Fonte, MarcoISO } from "@compartilhado/tipos";
import { Etiqueta } from "../ui/Estado";
import { marcoCurto, minutosEntre } from "./formato";

/**
 * De onde veio o dado (informações §6.1; design §3 "Proveniencia").
 * "Maxpar · lido 12/10 14:30" quando veio do leitor; "manual · registrado em 12/10 14:30" quando a
 * recepção copiou do portal. Fica vermelha com "desatualizado" quando a leitura passa de 24 h.
 * Candidato a ir para src/componentes/ui/ (pedido no relatório do SD).
 */
export function Proveniencia({
  fonte,
  lidoEm,
  agora,
  podeDesatualizar = true,
  className = "",
}: {
  fonte: Fonte;
  lidoEm?: MarcoISO;
  agora: MarcoISO;
  podeDesatualizar?: boolean;
  className?: string;
}) {
  const quando = lidoEm ? marcoCurto(lidoEm) : "sem data";
  const texto =
    fonte === "manual"
      ? `manual · registrado em ${quando}`
      : fonte === "api"
        ? `API · lido ${quando}`
        : `Maxpar · lido ${quando}`;
  const desatualizado = podeDesatualizar && lidoEm !== undefined && minutosEntre(lidoEm, agora) > 24 * 60;
  return (
    <Etiqueta
      tom={desatualizado ? "alerta" : "maxpar"}
      className={`normal-case tracking-normal font-semibold text-[11px] ${className}`}
    >
      <span>{texto}</span>
      {desatualizado && <span className="font-bold">· desatualizado</span>}
    </Etiqueta>
  );
}

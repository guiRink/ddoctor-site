import type { MarcoISO, ProvenienciaCampo } from "@compartilhado/tipos";
import { paraMs } from "@compartilhado/dominio/fuso";
import { dataHora } from "./formato";

const LIMITE_MS = 24 * 3_600_000;

/**
 * Etiqueta de proveniência (informações §6.1): "Maxpar · lido 12/10 14:30" em `maxpar`,
 * "manual · 12/10" quando digitado, vermelha com "desatualizado" se a leitura passou de 24 h.
 * Versão local: o componente comum `Proveniencia` de docs/painel-design.md §3 ainda não existe em ui/.
 */
export function Proveniencia({ prov, agora, className = "" }: { prov?: ProvenienciaCampo; agora: MarcoISO; className?: string }) {
  if (!prov) return null;
  const quando = prov.lidoEm ? dataHora(prov.lidoEm) : undefined;
  if (prov.fonte === "manual") {
    return <span className={`text-[11px] font-semibold text-tinta-fraca numero whitespace-nowrap ${className}`}>manual{quando ? ` · ${quando}` : ""}</span>;
  }
  const velho = prov.lidoEm ? paraMs(agora) - paraMs(prov.lidoEm) > LIMITE_MS : false;
  return (
    <span className={`text-[11px] font-semibold numero whitespace-nowrap ${velho ? "text-alerta" : "text-maxpar"} ${className}`}>
      Maxpar{quando ? ` · lido ${quando}` : ""}
      {velho && " · desatualizado"}
    </span>
  );
}

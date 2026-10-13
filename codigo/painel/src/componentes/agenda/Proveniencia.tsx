import type { MarcoISO, ProvenienciaCampo } from "@compartilhado/tipos";
import { Proveniencia as Etiqueta } from "../ui/Proveniencia";

/**
 * Adaptador da Agenda para a etiqueta comum (componentes/ui/Proveniencia.tsx).
 * Na Agenda, dado digitado (manual) nunca fica "desatualizado"; leitura da Maxpar fica após 24 h.
 */
export function Proveniencia({ prov, agora, className = "" }: { prov?: ProvenienciaCampo; agora: MarcoISO; className?: string }) {
  if (!prov) return null;
  return <Etiqueta fonte={prov.fonte} lidoEm={prov.lidoEm} agora={agora} podeDesatualizar={prov.fonte !== "manual"} className={className} />;
}

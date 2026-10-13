import type { Fonte, MarcoISO } from "@compartilhado/tipos";
import { dataNoFuso, minutoDoDia, paraMs } from "@compartilhado/dominio/fuso";

/**
 * De onde veio o dado — docs/painel-design.md §3 "Proveniencia" (informações §6.1).
 * Visual único para todas as abas:
 * - Maxpar/API: "Maxpar · lido 12/10 14:30" em azul `maxpar`;
 * - manual: "manual · 12/10 14:30" neutro (o azul é só da Maxpar);
 * - vermelha com "· desatualizado" quando a leitura passou de 24 h (se `podeDesatualizar`).
 * Quem decide se o dado pode ficar desatualizado é a tela (comportamento de cada aba preservado).
 */
const LIMITE_MS = 24 * 3_600_000;
const dois = (n: number) => String(n).padStart(2, "0");

function marcoCurto(marco: MarcoISO): string {
  const [, m, d] = dataNoFuso(marco).split("-");
  const min = Math.floor(minutoDoDia(marco));
  return `${d}/${m} ${dois(Math.floor(min / 60))}:${dois(min % 60)}`;
}

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
  const quando = lidoEm ? marcoCurto(lidoEm) : undefined;
  const texto =
    fonte === "manual"
      ? `manual${quando ? ` · ${quando}` : ""}`
      : `${fonte === "api" ? "API" : "Maxpar"} · ${quando ? `lido ${quando}` : "sem data"}`;
  const desatualizado = podeDesatualizar && lidoEm !== undefined && paraMs(agora) - paraMs(lidoEm) > LIMITE_MS;
  const tom = desatualizado
    ? "bg-alerta-claro text-alerta"
    : fonte === "manual"
      ? "bg-papel text-tinta-suave border border-linha"
      : "bg-[#E7ECF5] text-maxpar";
  return (
    <span
      className={`inline-flex items-center gap-1 h-6 px-2 text-[11px] font-semibold leading-none numero whitespace-nowrap ${tom} ${className}`}
      title={fonte === "manual" ? "Digitado no painel" : "Lido do portal"}
    >
      {texto}
      {desatualizado && <span className="font-bold">· desatualizado</span>}
    </span>
  );
}

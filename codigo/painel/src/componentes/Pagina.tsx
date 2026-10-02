import type { ReactNode } from "react";
import type { Etapa, Pendencia } from "../dominio/tipos";
import { ROTULO_ETAPA_CURTO, ROTULO_PENDENCIA } from "../dominio/rotulos";

export function Cabecalho({ titulo, resumo, acoes }: { titulo: string; resumo?: string; acoes?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6 md:mb-8">
      <div>
        <h1 className="titulo-condensado text-3xl md:text-5xl">{titulo}</h1>
        {resumo && <p className="mt-2 text-tinta-suave">{resumo}</p>}
      </div>
      {acoes && <div className="flex gap-2">{acoes}</div>}
    </div>
  );
}

const COR_ETAPA: Record<Etapa, string> = {
  aguardando_autorizacao: "bg-papel text-tinta border border-linha",
  autorizado: "bg-preto text-papel",
  aguardando_peca: "bg-papel text-tinta border border-linha",
  agendado: "bg-preto text-papel",
  no_patio: "bg-amarelo text-preto",
  pronto: "bg-amarelo text-preto",
  entregue: "bg-preto text-papel",
  documentacao_enviada: "bg-preto text-papel",
  pago: "bg-ok text-papel",
};

export function EtiquetaEtapa({ etapa }: { etapa: Etapa }) {
  return <span className={`rotulo inline-flex items-center px-2 py-1 ${COR_ETAPA[etapa]}`}>{ROTULO_ETAPA_CURTO[etapa]}</span>;
}

export function EtiquetaPendencia({ pendencia }: { pendencia: Pendencia }) {
  return <span className="rotulo inline-flex items-center px-2 py-1 bg-alerta text-papel">{ROTULO_PENDENCIA[pendencia]}</span>;
}

export function Carregando() {
  return (
    <p className="text-tinta-suave" role="status">
      Carregando…
    </p>
  );
}

export function Demo({ ativo }: { ativo?: boolean }) {
  if (!ativo) return null;
  return <span className="rotulo text-tinta-suave border border-linha px-1.5 py-0.5">demo</span>;
}

import type { MarcoISO, Perfil, Semaforo } from "@compartilhado/tipos";
import { formatarDuracao } from "@compartilhado/dominio/tempos";
import { progressoEtapas } from "@compartilhado/dominio/semaforo";
import { ProgressoEtapas, nomePerfil } from "../ui/Carro";
import { iniciais } from "../ui/Basicos";
import { Placa } from "../ui/Placa";
import { Icone } from "../Icone";
import { formatarDia, type ItemQuadro } from "./quadro";

const CABECALHO: Record<Semaforo, { fundo: string; texto: string }> = {
  verde: { fundo: "bg-ok", texto: "No prazo" },
  laranja: { fundo: "bg-atencao", texto: "Atenção" },
  vermelho: { fundo: "bg-alerta", texto: "Atrasado" },
  neutro: { fundo: "bg-grafite-3", texto: "Sem prazo" },
};

/**
 * Cartão da TV (1920×1080, lido a 3–4 m): cabeçalho pintado na cor do semáforo, placa grande,
 * responsável e tempos em 24 px+. Nunca mostra cliente, telefone, valores ou seguradora.
 */
export function CartaoTV({ item, agora, perfis }: { item: ItemQuadro; agora: MarcoISO; perfis: Perfil[] }) {
  const { v, resumo: r } = item;
  const etapa = r.atual;
  const cab = item.pronto
    ? { fundo: "bg-grafite-3", texto: "Pronto" }
    : item.impedido && item.semaforo === "vermelho"
      ? { fundo: "bg-alerta", texto: "Impedido" }
      : CABECALHO[item.semaforo];
  const estado = item.pronto ? "Para entrega" : etapa?.estado === "na_fila" ? "Na fila" : etapa?.estado === "bloqueada" ? `Parado ${formatarDuracao(r.bloqueio)}` : "Em execução";
  const bloqueio = item.impedido ? etapa?.bloqueios.find((b) => !b.fimEm) : undefined;
  const nome = nomePerfil(perfis, etapa?.responsavelId);
  const { total, atualIndex } = progressoEtapas(v.etapas);

  return (
    <article className="bg-grafite-2 flex flex-col min-h-0 overflow-hidden">
      <header className={`${cab.fundo} text-cartao flex items-center justify-between gap-3 h-11 px-5 shrink-0`}>
        <span className="flex items-center gap-2.5 text-[24px] font-extrabold uppercase tracking-[0.04em] leading-none whitespace-nowrap">
          {item.pronto && <Icone nome="ok" tamanho={24} />}
          {item.impedido && <Icone nome="bloqueio" tamanho={24} />}
          {cab.texto}
        </span>
        <span className="text-[20px] font-bold leading-none whitespace-nowrap">{estado}</span>
      </header>

      <div className="flex-1 min-h-0 flex flex-col px-5 pt-2.5 pb-2.5">
        <Placa placa={v.veiculo.placa} tamanho="tv" />
        <p className="mt-2 shrink-0 text-[32px] font-bold leading-[1.1] truncate">{v.veiculo.modelo ?? "Modelo não informado"}</p>
        <div className="shrink-0 flex items-center justify-between gap-3 min-w-0">
          <p className="text-[20px] text-papel-suave leading-snug truncate">
            {[v.veiculo.cor, v.tipoReparo?.nome].filter(Boolean).join(" · ") || "—"}
          </p>
          {v.os.prioridade === 2 && (
            <span className="shrink-0 bg-amarelo text-preto px-2 text-[16px] font-extrabold uppercase tracking-[0.04em] leading-7">Urgente</span>
          )}
        </div>

        {bloqueio ? (
          <p className="mt-2 shrink-0 flex items-center gap-2 text-[20px] font-semibold leading-snug min-w-0">
            <Icone nome="bloqueio" tamanho={20} className="shrink-0 text-alerta" />
            <span className="truncate">{bloqueio.motivo}</span>
          </p>
        ) : (
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <ProgressoEtapas etapas={v.etapas} semaforo={item.semaforo} escuro mostrarTexto={false} />
            </div>
            {!item.pronto && atualIndex !== null && (
              <span className="text-[20px] font-semibold text-papel-suave numero leading-none">
                {atualIndex + 1}/{total}
              </span>
            )}
          </div>
        )}

        {!item.pronto && (
          <div className="mt-2 flex items-center gap-3 min-w-0">
            {nome ? (
              <>
                <span aria-hidden="true" className="inline-grid place-items-center w-11 h-11 shrink-0 bg-papel text-preto text-[20px] font-bold">
                  {iniciais(nome)}
                </span>
                <span className="text-[24px] font-semibold truncate">{nome}</span>
              </>
            ) : (
              <span className="text-[24px] text-papel-fraco leading-[44px]">Sem responsável</span>
            )}
          </div>
        )}

        <dl className="mt-auto pt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-linha-clara numero">
          {item.pronto ? (
            <>
              <Numero nome="Peças" valor={pecasDaOS(v.etapas)} />
              <Numero nome="Entrega" valor={v.os.previsaoEntrega ? formatarDia(v.os.previsaoEntrega, agora) : "—"} />
            </>
          ) : (
            <>
              <Numero nome="Fila" valor={formatarDuracao(r.fila)} />
              <Numero nome="Execução" valor={etapa?.iniciadaEm ? formatarDuracao(r.execucao) : "—"} />
              <Numero nome="Peças" valor={etapa?.pecasPrevistas !== undefined ? `${etapa.pecasFeitas ?? 0}/${etapa.pecasPrevistas}` : "—"} />
              <Numero nome="Entrega" valor={v.os.previsaoEntrega ? formatarDia(v.os.previsaoEntrega, agora) : "—"} destaque={item.entregaHoje} />
            </>
          )}
        </dl>
      </div>
    </article>
  );
}

function Numero({ nome, valor, destaque = false }: { nome: string; valor: string; destaque?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[14px] font-bold uppercase tracking-[0.08em] text-papel-fraco leading-none">{nome}</dt>
      <dd className={`m-0 mt-1 text-[24px] font-bold leading-[1.1] truncate ${destaque ? "text-amarelo" : ""}`}>{valor}</dd>
    </div>
  );
}

/** Peças feitas/previstas somadas nas etapas que contam peças. */
function pecasDaOS(etapas: ItemQuadro["v"]["etapas"]): string {
  const com = etapas.filter((e) => e.pecasPrevistas !== undefined && e.estado !== "dispensada");
  if (!com.length) return "—";
  const ultima = com[com.length - 1];
  return `${ultima.pecasFeitas ?? 0}/${ultima.pecasPrevistas}`;
}


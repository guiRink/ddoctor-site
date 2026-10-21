import { progressoEtapas } from "@compartilhado/dominio/semaforo";
import { Placa } from "../ui/Placa";
import { Icone, type NomeIcone } from "../Icone";
import { FUNDO_CARRO, textoCurtoCor, type DensidadeMosaico, type ItemQuadro } from "./quadro";

const ESCALA: Record<DensidadeMosaico, { pad: string; linha: string; etapa: string; selo: string; icone: number; barra: string }> = {
  g: { pad: "px-6 py-5", linha: "text-[24px]", etapa: "text-[40px]", selo: "h-9 text-[20px] px-3.5", icone: 22, barra: "h-2.5" },
  m: { pad: "px-5 py-4", linha: "text-[24px]", etapa: "text-[32px]", selo: "h-8 text-[18px] px-3", icone: 20, barra: "h-2" },
  p: { pad: "px-4 py-3", linha: "text-[20px]", etapa: "text-[28px]", selo: "h-8 text-[16px] px-2.5", icone: 20, barra: "h-1.5" },
};

/**
 * Quadrado do mosaico da TV (docs/painel-design.md §5.1 "Mosaico"; pedido do dono, 2º áudio): pintado inteiro pela
 * cor do carro, com a Placa `tv`, a etapa atual grande e, pequeno em cima, "Entrega amanhã" / "Atrasado 2 dias".
 * Selos: Parado, Urgente e Prazo próprio (com texto se o quadrado for largo; só o ícone se for estreito — a legenda
 * do rodapé explica). Pronto: grafite, com o ícone de ok. Nunca mostra cliente, telefone, valores ou seguradora.
 */
export function QuadradoTV({ item, densidade, largo }: { item: ItemQuadro; densidade: DensidadeMosaico; largo: boolean }) {
  const { v } = item;
  const e = ESCALA[densidade];
  const etapa = item.pronto ? undefined : item.resumo.atual;
  const { concluidas, total } = progressoEtapas(v.etapas);
  const fundo = item.pronto ? "bg-grafite-2 text-papel" : FUNDO_CARRO[item.cor];
  const selos: { icone: NomeIcone; texto: string }[] = [];
  if (item.emParados) selos.push({ icone: "bloqueio", texto: "Parado" });
  if (v.os.prioridade === 2) selos.push({ icone: "alerta", texto: "Urgente" });
  if (item.personalizado) selos.push({ icone: "ajustes", texto: "Prazo próprio" });
  // só ícone quando o quadrado é estreito ou há selos demais para a linha
  const comTexto = largo && selos.length <= 2;

  return (
    <article className={`rounded-cartao overflow-hidden flex flex-col justify-between min-w-0 ${e.pad} ${fundo}`}>
      {/* linha de cima: quando entrega (ou quanto atrasou) + selos */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <p className={`${e.linha} font-semibold leading-none numero truncate`}>{textoCurtoCor(item)}</p>
        {selos.length > 0 && (
          <ul className="flex items-center gap-1.5 shrink-0 m-0 p-0 list-none">
            {selos.map((s) => (
              <li
                key={s.texto}
                title={s.texto}
                className={`inline-flex items-center justify-center gap-1.5 rounded-full font-semibold leading-none whitespace-nowrap ${
                  item.pronto ? "bg-grafite-3 text-papel" : "bg-preto/85 text-papel"
                } ${comTexto ? e.selo : densidade === "p" ? "w-8 h-8" : "w-9 h-9"}`}
              >
                <Icone nome={s.icone} tamanho={e.icone} traco={2} />
                {comTexto ? s.texto : <span className="sr-only">{s.texto}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Placa placa={v.veiculo.placa} tamanho="tv" encolher />

      {/* etapa atual, grande; o progresso diz "nada concluído" sem palavras */}
      <div className="min-w-0">
        <p className={`${e.etapa} titulo leading-[1.05] flex items-center gap-3 min-w-0`}>
          {item.pronto && <Icone nome="ok" tamanho={densidade === "p" ? 28 : 34} traco={2.25} className="shrink-0 text-ok" />}
          <span className="truncate">{item.pronto ? "Pronto" : (etapa?.nome ?? "Sem etapa")}</span>
          {!item.pronto && densidade === "p" && total > 0 && (
            <span className="ml-auto shrink-0 text-[20px] font-semibold numero opacity-80" aria-label={`${concluidas} de ${total} etapas concluídas`}>
              {concluidas}/{total}
            </span>
          )}
        </p>
        {!item.pronto && densidade !== "p" && total > 0 && (
          <div className="mt-2.5 flex gap-1.5" role="img" aria-label={`${concluidas} de ${total} etapas concluídas`}>
            {Array.from({ length: total }, (_, k) => (
              <span key={k} className={`flex-1 rounded-full bg-current ${e.barra} ${k < concluidas ? "" : "opacity-25"}`} />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

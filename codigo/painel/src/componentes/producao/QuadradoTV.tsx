import { progressoEtapas } from "@compartilhado/dominio/semaforo";
import { Placa } from "../ui/Placa";
import { Icone, type NomeIcone } from "../Icone";
import { nomeCarro } from "../os/formato";
import { FUNDO_CARRO, textoCurtoCor, type DensidadeMosaico, type ItemQuadro } from "./quadro";

const ESCALA: Record<DensidadeMosaico, { padX: number; padY: string; linha: string; etapa: string; selo: string; icone: number; barra: string }> = {
  g: { padX: 24, padY: "py-5", linha: "text-[24px]", etapa: "text-[40px]", selo: "h-9 text-[20px] px-3.5", icone: 22, barra: "h-2.5" },
  m: { padX: 20, padY: "py-4", linha: "text-[24px]", etapa: "text-[32px]", selo: "h-8 text-[18px] px-3", icone: 20, barra: "h-2" },
  p: { padX: 16, padY: "py-3", linha: "text-[20px]", etapa: "text-[28px]", selo: "h-8 text-[16px] px-2.5", icone: 20, barra: "h-1.5" },
};

/**
 * Placa ao lado do carro (pedido do dono, SI): o modelo fica com ~42 % da largura útil (no mínimo 107 px, o que cabe
 * "Range Rover" em 22 px condensado) e a placa com o resto, entre 150 px (quadrado de 297, 30 carros) e os 264 da
 * `Placa tv`. O modelo cresce com a coluna: 30 px se cabe "Range Rover Sport" numa linha, 28/26 se cabe "Range Rover", senão 22.
 */
const PLACA_TV = 264;
const PLACA_MIN = 150;
const COLUNA_MODELO_MIN = 107;
const VAO_PLACA = 12;
function medidas(largura: number, densidade: DensidadeMosaico) {
  const padX = largura < 340 ? 12 : ESCALA[densidade].padX;
  const interno = largura - 2 * padX;
  const alvo = Math.max(COLUNA_MODELO_MIN, Math.round(interno * 0.42));
  const placa = Math.max(PLACA_MIN, Math.min(PLACA_TV, interno - VAO_PLACA - alvo));
  const coluna = interno - VAO_PLACA - placa;
  const modelo =
    coluna >= 210
      ? { nome: "text-[30px]", cor: "text-[22px]" }
      : coluna >= 160
        ? { nome: "text-[28px]", cor: "text-[22px]" }
        : coluna >= 128
          ? { nome: "text-[26px]", cor: "text-[20px]" }
          : { nome: "text-[22px]", cor: "text-[18px]" };
  return { padX, zoom: placa / PLACA_TV, zoomSozinha: Math.min(1, interno / PLACA_TV), modelo };
}

/** "BMW X5" (marca + modelo sem repetir); se ficar longo ("Land Rover Range Rover Sport"), só o modelo. */
function carroTV(veiculo: { marca?: string; modelo?: string }): string {
  const completo = nomeCarro(veiculo);
  const modelo = veiculo.modelo?.trim();
  return modelo && completo.length > 18 ? modelo : completo;
}

/**
 * Quadrado do mosaico da TV (docs/painel-design.md §5.1 "Mosaico"; pedido do dono, 2º áudio): pintado inteiro pela
 * cor do carro: pequeno em cima, "Entrega amanhã" / "Atrasado 2 dias"; no meio a Placa e, à direita dela, o modelo
 * (forte, até 2 linhas) com a cor do carro embaixo, mais leve (pedido do dono, SI); embaixo a etapa atual, grande.
 * Selos: Parado, Urgente e Prazo próprio (com texto se o quadrado for largo; só o ícone se for estreito — a legenda
 * do rodapé explica). Pronto: grafite, com o ícone de ok. Nunca mostra cliente, telefone, valores ou seguradora.
 */
export function QuadradoTV({ item, densidade, largo, largura }: { item: ItemQuadro; densidade: DensidadeMosaico; largo: boolean; largura: number }) {
  const { v } = item;
  const e = ESCALA[densidade];
  const m = medidas(largura, densidade);
  const modelo = carroTV(v.veiculo);
  const cor = v.veiculo.cor?.trim();
  const temCarro = Boolean(modelo || cor);
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
    <article className={`rounded-cartao overflow-hidden flex flex-col justify-between min-w-0 ${e.padY} ${fundo}`} style={{ paddingInline: m.padX }}>
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

      {/* placa e, ao lado, o carro: modelo forte (condensado, até 2 linhas) e a cor embaixo, mais leve */}
      <div className="flex items-center min-w-0" style={{ gap: VAO_PLACA }}>
        {/* zoom (não transform): a placa ocupa no layout o tamanho que aparenta; sem modelo nem cor, volta a ser grande */}
        <span className="shrink-0 flex" style={{ zoom: temCarro ? m.zoom : m.zoomSozinha }}>
          <Placa placa={v.veiculo.placa} tamanho="tv" />
        </span>
        {temCarro && (
          <div className="min-w-0 flex-1">
            {modelo && (
              <p className={`${m.modelo.nome} font-semibold leading-[1.05] line-clamp-2 break-words`} style={{ fontVariationSettings: '"wdth" 75' }}>
                {modelo}
              </p>
            )}
            {cor && <p className={`${m.modelo.cor} font-medium leading-tight truncate ${modelo ? "mt-1" : ""}`}>{cor}</p>}
          </div>
        )}
      </div>

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

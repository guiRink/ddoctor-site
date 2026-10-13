import { useId, useRef, useState, type MouseEvent } from "react";
import {
  TAMANHOS_AVARIA,
  TIPOS_AVARIA,
  VISTAS_AVARIA,
  type Avaria,
  type TamanhoAvaria,
  type TipoAvaria,
  type VistaAvaria,
} from "@compartilhado/tipos";
import { validarAvaria } from "@compartilhado/dominio/recepcao";
import { TAMANHO_AVARIA, TIPO_AVARIA, VISTA_AVARIA } from "../../dominio/rotulos";
import { Icone } from "../Icone";
import { Segmentado } from "../os/Campos";
import { DesenhoCarro } from "./DesenhoCarro";

/**
 * Cor do marcador por tipo de avaria. Só tokens do painel: vermelho (amassado), laranja (risco),
 * preto (pintura), contorno (vidro) e cinza (outro). O texto do tipo sempre acompanha na lista e na legenda.
 */
const COR_TIPO: Record<TipoAvaria, string> = {
  amassado: "bg-alerta text-cartao",
  risco: "bg-atencao text-cartao",
  pintura: "bg-tinta text-cartao",
  vidro: "bg-cartao text-tinta ring-[1.5px] ring-inset ring-tinta",
  outro: "bg-tinta-suave text-cartao",
};

const DIAMETRO: Record<TamanhoAvaria, string> = {
  p: "w-5 h-5 text-[11px]",
  m: "w-6 h-6 text-[12px]",
  g: "w-[30px] h-[30px] text-[13px]",
};

/** Bolinha numerada no tipo e tamanho da avaria. */
export function Marcador({
  numero,
  tipo,
  tamanho = "m",
  selecionado = false,
  className = "",
}: {
  numero: number;
  tipo: TipoAvaria;
  tamanho?: TamanhoAvaria;
  selecionado?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-grid place-items-center shrink-0 rounded-full font-semibold leading-none numero shadow-[0_0_0_2px_#fff] ${COR_TIPO[tipo]} ${DIAMETRO[tamanho]} ${
        selecionado ? "outline-2 outline-offset-2 outline-amarelo-escuro" : ""
      } ${className}`}
    >
      {numero}
    </span>
  );
}

/** Legenda das cores por tipo. */
export function LegendaAvarias({ className = "" }: { className?: string }) {
  return (
    <ul aria-label="Legenda dos tipos de avaria" className={`flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-tinta-suave ${className}`}>
      {TIPOS_AVARIA.map((t) => (
        <li key={t} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={`inline-block w-2.5 h-2.5 rounded-full ${COR_TIPO[t]}`} />
          {TIPO_AVARIA[t]}
        </li>
      ))}
    </ul>
  );
}

function novoIdAvaria(): string {
  const aleatorio = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `av-${Date.now().toString(36)}-${aleatorio}`;
}

/** Uma vista com os marcadores por cima (leitura). Usada na impressão e nas miniaturas. */
export function VistaComMarcadores({
  vista,
  avarias,
  numeros,
  tamanhoFixo,
}: {
  vista: VistaAvaria;
  avarias: readonly Avaria[];
  /** Número de cada avaria (id → nº na lista completa). */
  numeros: Map<string, number>;
  /** Força um tamanho de marcador (ex.: "p" na impressão). */
  tamanhoFixo?: TamanhoAvaria;
}) {
  return (
    <div className="relative">
      <DesenhoCarro vista={vista} />
      {avarias
        .filter((a) => a.vista === vista)
        .map((a) => (
          <span key={a.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%` }}>
            <Marcador numero={numeros.get(a.id) ?? 0} tipo={a.tipo} tamanho={tamanhoFixo ?? a.tamanho} />
          </span>
        ))}
    </div>
  );
}

/** As 5 vistas lado a lado, só leitura (impressão e resumo). */
export function VistasAvarias({ avarias, colunas = 5 }: { avarias: readonly Avaria[]; colunas?: 3 | 5 }) {
  const numeros = new Map(avarias.map((a, i) => [a.id, i + 1]));
  return (
    <div className={`grid gap-3 ${colunas === 5 ? "grid-cols-5" : "grid-cols-3"}`}>
      {VISTAS_AVARIA.map((v) => (
        <figure key={v} className="m-0 min-w-0">
          <VistaComMarcadores vista={v} avarias={avarias} numeros={numeros} tamanhoFixo="p" />
          <figcaption className="mt-1 text-center text-[11px] text-tinta-suave">{VISTA_AVARIA[v]}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/**
 * Mapa de avarias: 5 vistas em abas; na edição, clicar no desenho marca uma avaria em (x, y) 0..1
 * com o tipo e o tamanho escolhidos. Marcadores numerados e coloridos por tipo; lista abaixo com
 * observação e remover. Pelo teclado, Enter no desenho marca no centro da vista (ajuste pela observação).
 */
export function MapaAvarias({
  avarias,
  onMudar,
  somenteLeitura = false,
  lado = false,
}: {
  avarias: readonly Avaria[];
  onMudar?: (a: Avaria[]) => void;
  somenteLeitura?: boolean;
  /** Desenho e lista lado a lado em telas largas (leitura na ficha). */
  lado?: boolean;
}) {
  const id = useId();
  const editavel = !somenteLeitura && Boolean(onMudar);
  const [vista, setVista] = useState<VistaAvaria>(() => avarias[0]?.vista ?? "lateral_esquerda");
  const [tipo, setTipo] = useState<TipoAvaria>("amassado");
  const [tamanho, setTamanho] = useState<TamanhoAvaria>("m");
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const quadro = useRef<HTMLSpanElement>(null);
  const numeros = new Map(avarias.map((a, i) => [a.id, i + 1]));
  const daVista = avarias.filter((a) => a.vista === vista);

  function marcar(e: MouseEvent<HTMLButtonElement>) {
    if (!onMudar || !quadro.current) return;
    const caixa = quadro.current.getBoundingClientRect();
    // detail 0 = ativado pelo teclado: marca no centro
    const x = e.detail === 0 ? 0.5 : (e.clientX - caixa.left) / caixa.width;
    const y = e.detail === 0 ? 0.5 : (e.clientY - caixa.top) / caixa.height;
    const nova: Avaria = { id: novoIdAvaria(), vista, x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, tipo, tamanho };
    if (!validarAvaria(nova).ok) return;
    onMudar([...avarias, nova]);
    setSelecionada(nova.id);
  }

  function atualizar(idAvaria: string, mudanca: Partial<Avaria>) {
    onMudar?.(avarias.map((a) => (a.id === idAvaria ? { ...a, ...mudanca } : a)));
  }

  const abas = (
    <div role="tablist" aria-label="Vista do carro" className="flex max-w-full overflow-x-auto gap-0.5 p-0.5 rounded-cartao bg-cinza-100">
      {VISTAS_AVARIA.map((v) => {
        const ativa = v === vista;
        const n = avarias.filter((a) => a.vista === v).length;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={ativa}
            onClick={() => setVista(v)}
            className={`shrink-0 inline-flex items-center gap-1.5 h-10 md:h-8 px-3 rounded-controle text-[13px] whitespace-nowrap transition-colors duration-150 ${
              ativa ? "bg-cartao text-tinta font-semibold shadow-[0_1px_2px_rgba(17,17,17,0.08)] ring-1 ring-linha" : "text-tinta-suave font-medium hover:text-tinta"
            }`}
          >
            {VISTA_AVARIA[v]}
            {n > 0 && <span className={`numero text-[12px] ${ativa ? "text-tinta-suave" : "text-tinta-fraca"}`}>{n}</span>}
          </button>
        );
      })}
    </div>
  );

  const marcadores = daVista.map((a) => (
    <span
      key={a.id}
      className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
      style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%` }}
    >
      <Marcador numero={numeros.get(a.id) ?? 0} tipo={a.tipo} tamanho={a.tamanho} selecionado={a.id === selecionada} />
    </span>
  ));

  const desenho = editavel ? (
    <div className="relative rounded-cartao border border-linha bg-cartao">
      <button
        type="button"
        onClick={marcar}
        aria-label={`Marcar ${TIPO_AVARIA[tipo].toLowerCase()} ${TAMANHO_AVARIA[tamanho].toLowerCase()} na vista ${VISTA_AVARIA[vista].toLowerCase()}`}
        aria-describedby={`${id}-dica`}
        className="relative block w-full px-4 py-3 cursor-crosshair rounded-cartao focus-visible:outline-offset-[-2px]"
      >
        <span ref={quadro} className="relative block">
          <DesenhoCarro vista={vista} />
          {marcadores}
        </span>
      </button>
      <p id={`${id}-dica`} className="absolute left-3 top-2.5 text-[12px] text-tinta-fraca pointer-events-none">
        Clique no desenho onde está a avaria
      </p>
    </div>
  ) : (
    <div className="rounded-cartao border border-linha bg-cartao px-4 py-3">
      <div className="relative" role="img" aria-label={`Vista ${VISTA_AVARIA[vista].toLowerCase()}: ${daVista.length === 0 ? "sem avarias" : `${daVista.length} avaria(s)`}`}>
        <DesenhoCarro vista={vista} />
        {marcadores}
      </div>
    </div>
  );

  const lista =
    avarias.length === 0 ? (
      <p className="text-[13px] text-tinta-suave">
        {editavel ? "Nenhuma avaria marcada. Escolha o tipo e o tamanho e clique no desenho." : "Nenhuma avaria registrada na entrada."}
      </p>
    ) : (
      <ol aria-label="Avarias marcadas" className="flex flex-col divide-y divide-linha border border-linha rounded-cartao bg-cartao overflow-hidden">
        {avarias.map((a) => {
          const n = numeros.get(a.id) ?? 0;
          const ativa = a.id === selecionada;
          return (
            <li key={a.id} className={`flex items-start gap-3 px-3 py-2.5 transition-colors duration-150 ${ativa ? "bg-cinza-50" : ""}`}>
              <button
                type="button"
                onClick={() => {
                  setVista(a.vista);
                  setSelecionada(a.id);
                }}
                aria-label={`Mostrar a avaria ${n} no desenho`}
                className="mt-0.5 -m-1 p-1 rounded-full"
              >
                <Marcador numero={n} tipo={a.tipo} tamanho="m" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium leading-snug">
                  {TIPO_AVARIA[a.tipo]} <span className="font-normal text-tinta-suave">· {TAMANHO_AVARIA[a.tamanho].toLowerCase()}</span>
                </p>
                <p className="text-[12px] text-tinta-suave">{VISTA_AVARIA[a.vista]}</p>
                {editavel ? (
                  <input
                    aria-label={`Observação da avaria ${n}`}
                    value={a.obs ?? ""}
                    maxLength={200}
                    placeholder="Observação (ex.: para-lama, 5 cm)"
                    onChange={(e) => atualizar(a.id, { obs: e.target.value || undefined })}
                    onFocus={() => {
                      setVista(a.vista);
                      setSelecionada(a.id);
                    }}
                    className="mt-2 w-full h-10 md:h-9 px-2.5 text-[13px] bg-cartao border border-linha-forte outline-none transition-colors duration-150 focus:border-tinta-fraca focus:ring-[3px] focus:ring-amarelo/30"
                  />
                ) : (
                  a.obs && <p className="mt-0.5 text-[13px] break-words">{a.obs}</p>
                )}
              </div>
              {editavel && (
                <button
                  type="button"
                  onClick={() => {
                    onMudar?.(avarias.filter((x) => x.id !== a.id));
                    if (selecionada === a.id) setSelecionada(null);
                  }}
                  aria-label={`Remover a avaria ${n}`}
                  className="inline-grid place-items-center shrink-0 w-11 h-11 md:w-9 md:h-9 -mr-1 rounded-controle text-tinta-suave hover:text-alerta hover:bg-alerta-claro transition-colors duration-150"
                >
                  <Icone nome="fechar" tamanho={16} />
                </button>
              )}
            </li>
          );
        })}
      </ol>
    );

  if (!editavel) {
    return (
      <div className={`grid gap-4 ${lado ? "lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start" : ""}`}>
        <div className="flex flex-col gap-3 min-w-0">
          {abas}
          {desenho}
          <LegendaAvarias />
        </div>
        <div className="min-w-0">{lista}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <Segmentado
          nome={`${id}-tipo`}
          rotulo="Tipo"
          valor={tipo}
          onMudar={setTipo}
          opcoes={TIPOS_AVARIA.map((t) => ({
            valor: t,
            texto: (
              <>
                <span aria-hidden="true" className={`inline-block w-2.5 h-2.5 rounded-full ${COR_TIPO[t]}`} />
                {TIPO_AVARIA[t]}
              </>
            ),
          }))}
        />
        <Segmentado
          nome={`${id}-tam`}
          rotulo="Tamanho"
          valor={tamanho}
          onMudar={setTamanho}
          opcoes={TAMANHOS_AVARIA.map((t) => ({ valor: t, texto: t.toUpperCase(), rotuloAcessivel: TAMANHO_AVARIA[t] }))}
        />
      </div>
      {abas}
      {desenho}
      {lista}
    </div>
  );
}

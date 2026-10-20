import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { FaseVistoria, Foto, Perfil } from "@compartilhado/tipos";
import { mensagemErro, useAcoes } from "../../dados/hooks";
import { FASE_VISTORIA } from "../../dominio/rotulos";
import { Botao, Contagem } from "../ui/Basicos";
import { Etiqueta } from "../ui/Estado";
import { Icone } from "../Icone";
import { dataHora } from "../agenda/formato";
import { FotoIndisponivel, ImagemFoto } from "../fotos/MiniaturasFoto";
import { DICA_EXPIRACAO, fonteMiniatura, textoExpiracao } from "../fotos/formato";

// Galeria de vistoria: faixas horizontais por fase e foto ampliada em <dialog> nativo.
// docs/painel-design.md §5 Vistorias · informações §3.4.

const FASES: FaseVistoria[] = ["entrada", "durante", "final", "externa"];

const VAZIO_FASE: Record<FaseVistoria, string> = {
  entrada: "Sem fotos de entrada ainda.",
  durante: "Sem fotos durante o serviço ainda.",
  final: "Sem fotos de saída ainda.",
  externa: "Nenhuma foto do segurado importada da Maxpar.",
};

function autorDe(f: Foto, perfis: Perfil[]): string {
  if (f.origem === "maxpar") return "Segurado (via Maxpar)";
  return perfis.find((p) => p.id === f.autorId)?.nome ?? "Autor não registrado";
}

function textoAlt(f: Foto): string {
  return `${FASE_VISTORIA[f.fase]}: ${f.legenda || "foto sem legenda"}`;
}

export function Miniatura({ f, className = "w-14 h-[42px] rounded-controle" }: { f?: Foto; className?: string }) {
  if (!f) {
    return (
      <span aria-hidden="true" className={`grid place-items-center bg-cinza-100 text-tinta-fraca shrink-0 ${className}`}>
        <Icone nome="camera" tamanho={16} />
      </span>
    );
  }
  return <ImagemFoto src={fonteMiniatura(f)} alt={textoAlt(f)} className={`shrink-0 ${className}`} compacto />;
}

function Legenda({ f, perfis }: { f: Foto; perfis: Perfil[] }) {
  return (
    <>
      <span className="block text-[13px] font-medium leading-snug line-clamp-2 break-words" title={f.legenda}>
        {f.legenda || <span className="text-tinta-fraca font-normal">Sem legenda</span>}
      </span>
      <span className="block mt-0.5 text-[12px] text-tinta-suave truncate">{autorDe(f, perfis)}</span>
      <span className="block text-[12px] text-tinta-suave numero">{dataHora(f.tiradaEm)}</span>
      {f.origem === "interna" && textoExpiracao(f) && (
        <span className="block mt-0.5 text-[12px] text-tinta-fraca numero truncate" title={DICA_EXPIRACAO}>
          {textoExpiracao(f)}
        </span>
      )}
    </>
  );
}

export function FaixasPorFase({
  fotos,
  perfis,
  podeRemover,
  onAdicionar,
}: {
  fotos: Foto[];
  perfis: Perfil[];
  /** Quem pode remover cada foto (podeRemoverFoto); ausente = ninguém. */
  podeRemover?: (f: Foto) => boolean;
  /** Abre a captura na fase (Entrada · Durante · Final); ausente = o papel não tira foto. */
  onAdicionar?: (fase: Exclude<FaseVistoria, "externa">) => void;
}) {
  const ordenadas = FASES.flatMap((fase) => fotos.filter((f) => f.fase === fase).sort((a, b) => a.tiradaEm.localeCompare(b.tiradaEm)));
  const [aberta, setAberta] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-5">
      {FASES.map((fase) => {
        const daFase = ordenadas.filter((f) => f.fase === fase);
        return (
          <section key={fase} aria-labelledby={`fase-${fase}`}>
            <h3 id={`fase-${fase}`} className="flex items-center gap-2 mb-2.5">
              <span className="text-[15px] font-semibold">{FASE_VISTORIA[fase]}</span>
              <Contagem n={daFase.length} />
              {fase === "externa" && <span className="text-[12px] text-tinta-suave font-normal">só leitura, importadas do portal</span>}
              {fase !== "externa" && onAdicionar && daFase.length > 0 && (
                <Botao variante="fantasma" tamanho="denso" icone="mais" className="ml-auto" onClick={() => onAdicionar(fase)} aria-label={`Adicionar foto: ${FASE_VISTORIA[fase]}`}>
                  Adicionar
                </Botao>
              )}
            </h3>
            {daFase.length === 0 ? (
              fase !== "externa" && onAdicionar ? (
                <button
                  type="button"
                  onClick={() => onAdicionar(fase)}
                  className="flex w-full items-center gap-2 h-20 px-4 rounded-cartao border border-dashed border-linha-forte text-tinta-suave text-[13px] text-left hover:bg-cinza-50 hover:text-tinta transition-colors duration-150"
                >
                  <Icone nome="camera" tamanho={16} className="shrink-0" />
                  <span>
                    {VAZIO_FASE[fase]} <span className="font-semibold text-tinta">Adicionar foto</span>
                  </span>
                </button>
              ) : (
                <p className="flex items-center gap-2 h-20 px-4 rounded-cartao border border-dashed border-linha-forte text-tinta-fraca text-[13px]">
                  <Icone nome="camera" tamanho={16} />
                  {VAZIO_FASE[fase]}
                </p>
              )
            ) : (
              <ul className="flex gap-3 overflow-x-auto pb-2 snap-x" aria-label={`Fotos: ${FASE_VISTORIA[fase]}`}>
                {daFase.map((f) => {
                  const indice = ordenadas.indexOf(f);
                  return (
                    <li key={f.id} className="w-[200px] shrink-0 snap-start">
                      <figure className="m-0 bg-cartao border border-linha rounded-cartao shadow-cartao overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setAberta(indice)}
                          aria-label={`Ampliar foto: ${f.legenda || FASE_VISTORIA[f.fase]}`}
                          className="relative block w-full group"
                        >
                          <ImagemFoto src={fonteMiniatura(f)} alt={textoAlt(f)} className="block w-full aspect-[4/3]" />
                          {f.origem === "maxpar" && (
                            <Etiqueta tom="maxpar" className="absolute left-2 top-2">
                              Maxpar
                            </Etiqueta>
                          )}
                          <span aria-hidden="true" className="absolute inset-0 bg-tinta/0 group-hover:bg-tinta/10 transition-colors duration-150" />
                        </button>
                        <figcaption className="px-2.5 py-2 border-t border-linha">
                          <Legenda f={f} perfis={perfis} />
                        </figcaption>
                      </figure>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      <FotoAmpliada fotos={ordenadas} perfis={perfis} indice={aberta} onTrocar={setAberta} podeRemover={podeRemover} />
    </div>
  );
}

/** Foto em tamanho grande num <dialog> nativo: Esc fecha, setas ← → trocam. */
function FotoAmpliada({
  fotos,
  perfis,
  indice,
  onTrocar,
  podeRemover,
}: {
  fotos: Foto[];
  perfis: Perfil[];
  indice: number | null;
  onTrocar: (i: number | null) => void;
  podeRemover?: (f: Foto) => boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const acoes = useAcoes();
  const aberto = indice !== null && fotos[indice] !== undefined;
  // confirmação e erro valem para a foto em que foram pedidos (trocar de foto zera)
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [erro, setErro] = useState<{ id: string; texto: string } | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal?.();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  const f = aberto ? fotos[indice] : undefined;
  const removivel = f ? (podeRemover?.(f) ?? false) : false;

  async function remover(alvo: Foto) {
    setErro(null);
    try {
      const r = await acoes.removerFoto.mutateAsync([alvo.id]);
      if (r.ok) {
        setConfirmar(null);
        onTrocar(null);
      } else setErro({ id: alvo.id, texto: mensagemErro(r.codigo) });
    } catch {
      setErro({ id: alvo.id, texto: mensagemErro() });
    }
  }

  const anterior = () => indice !== null && indice > 0 && onTrocar(indice - 1);
  const proxima = () => indice !== null && indice < fotos.length - 1 && onTrocar(indice + 1);

  function teclas(e: KeyboardEvent) {
    if (e.key === "ArrowLeft") anterior();
    if (e.key === "ArrowRight") proxima();
  }

  return (
    <dialog
      ref={ref}
      onClose={() => onTrocar(null)}
      onKeyDown={teclas}
      aria-label={f ? `Foto ampliada: ${textoAlt(f)}` : "Foto ampliada"}
      data-tema="claro"
      className="m-auto p-0 border-0 rounded-cartao overflow-hidden bg-preto text-papel w-[min(1200px,96vw)] max-h-[96svh] backdrop:bg-preto/85"
    >
      {f && indice !== null && (
        <div className="flex flex-col max-h-[96svh]">
          <div className="flex items-center justify-between gap-3 pl-4 h-12 border-b border-linha-clara shrink-0">
            <p className="text-[13px] numero text-papel-suave">
              <span className="font-semibold text-papel">{FASE_VISTORIA[f.fase]}</span> · foto {indice + 1} de {fotos.length}
            </p>
            <button
              type="button"
              autoFocus
              onClick={() => onTrocar(null)}
              aria-label="Fechar foto"
              className="inline-grid place-items-center w-12 h-12 text-papel-suave hover:text-papel hover:bg-grafite-2 transition-colors duration-150"
            >
              <Icone nome="fechar" />
            </button>
          </div>
          <div className="relative flex-1 min-h-0 grid place-items-center bg-preto">
            {f.url ? (
              <img src={f.url} alt={textoAlt(f)} className="max-w-full max-h-[calc(96svh-140px)] object-contain" />
            ) : (
              <FotoIndisponivel className="w-full h-[50svh]" cores="bg-grafite text-papel-suave" />
            )}
            <button
              type="button"
              onClick={anterior}
              disabled={indice === 0}
              aria-label="Foto anterior"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full grid place-items-center bg-preto/70 text-papel hover:bg-grafite-2 transition-colors duration-150 disabled:opacity-30"
            >
              <Icone nome="voltar" tamanho={22} />
            </button>
            <button
              type="button"
              onClick={proxima}
              disabled={indice === fotos.length - 1}
              aria-label="Próxima foto"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full grid place-items-center bg-preto/70 text-papel hover:bg-grafite-2 transition-colors duration-150 disabled:opacity-30"
            >
              <Icone nome="seta" tamanho={22} />
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 border-t border-linha-clara shrink-0">
            <p className="min-w-0">
              <span className="block font-medium break-words">{f.legenda || "Sem legenda"}</span>
              <span className="block text-[12px] text-papel-suave numero">
                {autorDe(f, perfis)} · {dataHora(f.tiradaEm)}
                {f.origem === "interna" && textoExpiracao(f) && (
                  <span title={DICA_EXPIRACAO}> · {textoExpiracao(f)!.replace("Apagada", "apagada")}</span>
                )}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {f.origem === "maxpar" && <Etiqueta tom="maxpar">Maxpar · importada</Etiqueta>}
              {removivel &&
                (confirmar === f.id ? (
                  <>
                    <span className="text-[13px] text-papel-suave">Remover esta foto?</span>
                    <button
                      type="button"
                      autoFocus
                      onClick={() => remover(f)}
                      disabled={acoes.removerFoto.isPending}
                      className="h-10 px-3 rounded-controle bg-alerta text-cartao text-[13px] font-semibold hover:opacity-90 transition-opacity duration-150 disabled:opacity-40"
                    >
                      {acoes.removerFoto.isPending ? "Removendo…" : "Remover"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmar(null)}
                      className="h-10 px-3 rounded-controle text-papel-suave text-[13px] font-medium hover:text-papel hover:bg-grafite-2 transition-colors duration-150"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => (setErro(null), setConfirmar(f.id))}
                    className="inline-flex items-center gap-2 h-10 px-3 rounded-controle border border-linha-clara text-papel-suave text-[13px] font-medium hover:text-papel hover:bg-grafite-2 transition-colors duration-150"
                  >
                    <Icone nome="fechar" tamanho={16} />
                    Remover foto
                  </button>
                ))}
            </div>
            {erro && erro.id === f.id && (
              // fundo preto: o texto vai numa pílula clara (alerta sobre alerta-claro ≈ 5,5:1); alerta direto no preto não passava
              <p role="alert" className="basis-full flex items-start gap-2 px-3 py-2 rounded-controle bg-alerta-claro text-alerta text-[13px] font-medium">
                <Icone nome="alerta" tamanho={16} className="mt-0.5 shrink-0" />
                {erro.texto}
              </p>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}

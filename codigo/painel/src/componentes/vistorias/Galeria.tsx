import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { FaseVistoria, Foto, Perfil } from "@compartilhado/tipos";
import { FASE_VISTORIA } from "../../dominio/rotulos";
import { Etiqueta } from "../ui/Estado";
import { Icone } from "../Icone";
import { dataHora } from "../agenda/formato";

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

/** Imagem com troca para aviso quando o arquivo não carrega (link vencido, sem rede). */
function Imagem({ f, className }: { f: Foto; className: string }) {
  const [falhou, setFalhou] = useState(false);
  if (falhou) {
    return (
      <span className={`grid place-items-center bg-cinza-100 text-tinta-fraca text-[12px] font-medium ${className}`}>
        <span className="flex flex-col items-center gap-1">
          <Icone nome="camera" />
          Foto indisponível
        </span>
      </span>
    );
  }
  return <img src={f.url} alt={textoAlt(f)} loading="lazy" decoding="async" onError={() => setFalhou(true)} className={`object-cover bg-cinza-100 ${className}`} />;
}

export function Miniatura({ f, className = "w-14 h-[42px] rounded-controle" }: { f?: Foto; className?: string }) {
  if (!f) {
    return (
      <span aria-hidden="true" className={`grid place-items-center bg-cinza-100 text-tinta-fraca shrink-0 ${className}`}>
        <Icone nome="camera" tamanho={16} />
      </span>
    );
  }
  return <Imagem f={f} className={`shrink-0 ${className}`} />;
}

function Legenda({ f, perfis }: { f: Foto; perfis: Perfil[] }) {
  return (
    <>
      <span className="block text-[13px] font-medium leading-snug line-clamp-2 break-words" title={f.legenda}>
        {f.legenda || <span className="text-tinta-fraca font-normal">Sem legenda</span>}
      </span>
      <span className="block mt-0.5 text-[12px] text-tinta-suave truncate">{autorDe(f, perfis)}</span>
      <span className="block text-[12px] text-tinta-suave numero">{dataHora(f.tiradaEm)}</span>
    </>
  );
}

export function FaixasPorFase({ fotos, perfis }: { fotos: Foto[]; perfis: Perfil[] }) {
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
              <span className="inline-grid place-items-center min-w-6 h-5 px-1.5 rounded-full bg-cinza-200 text-[12px] font-medium numero">{daFase.length}</span>
              {fase === "externa" && <span className="text-[12px] text-tinta-suave font-normal">só leitura, importadas do portal</span>}
            </h3>
            {daFase.length === 0 ? (
              <p className="flex items-center gap-2 h-20 px-4 rounded-cartao border border-dashed border-linha-forte text-tinta-fraca text-[13px]">
                <Icone nome="camera" tamanho={16} />
                {VAZIO_FASE[fase]}
              </p>
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
                          <Imagem f={f} className="block w-full aspect-[4/3]" />
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

      <FotoAmpliada fotos={ordenadas} perfis={perfis} indice={aberta} onTrocar={setAberta} />
    </div>
  );
}

/** Foto em tamanho grande num <dialog> nativo: Esc fecha, setas ← → trocam. */
function FotoAmpliada({
  fotos,
  perfis,
  indice,
  onTrocar,
}: {
  fotos: Foto[];
  perfis: Perfil[];
  indice: number | null;
  onTrocar: (i: number | null) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const aberto = indice !== null && fotos[indice] !== undefined;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal?.();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  const f = aberto ? fotos[indice] : undefined;
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
            <img src={f.url} alt={textoAlt(f)} className="max-w-full max-h-[calc(96svh-140px)] object-contain" />
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
              </span>
            </p>
            {f.origem === "maxpar" && <Etiqueta tom="maxpar">Maxpar · importada</Etiqueta>}
          </div>
        </div>
      )}
    </dialog>
  );
}

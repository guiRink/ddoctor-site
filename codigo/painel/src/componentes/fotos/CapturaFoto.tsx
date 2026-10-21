import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import type { FaseVistoria, Foto, Id } from "@compartilhado/tipos";
import { ErroFoto, comprimirFoto } from "../../dados/fotos";
import { mensagemErro, useAcoes } from "../../dados/hooks";
import { ERRO, FASE_VISTORIA } from "../../dominio/rotulos";
import { useMidia } from "../agenda/useLargura";
import { Botao } from "../ui/Basicos";
import { Aviso } from "../ui/Campos";
import { Icone } from "../Icone";
import { BotaoRemoverFoto, GradeMiniaturas, ImagemFoto } from "./MiniaturasFoto";
import { fonteMiniatura } from "./formato";

/**
 * Captura de foto da OS (sprint SF, pedido do dono): no celular "Tirar foto" abre a câmera e
 * "Escolher da galeria" abre a fototeca; no computador "Escolher arquivo" ou arrastar e soltar.
 * Cada foto é comprimida no aparelho (comprimirFoto) e enviada (adicionarFoto) uma de cada vez;
 * a miniatura aparece na hora com "Preparando foto…" e, pronta, ganha o "×" para remover.
 */

type Fase = Exclude<FaseVistoria, "externa">;

/** Erros em que tentar de novo com o mesmo arquivo não adianta. */
const SEM_NOVA_TENTATIVA = new Set(["arquivo_invalido", "arquivo_grande", "foto_acima_limite", "fase_invalida", "os_nao_encontrada", "etapa_nao_encontrada"]);

interface Pendente {
  chave: number;
  arquivo: File;
  previa: string; // blob: do original, só para a miniatura enquanto prepara
  estado: "preparando" | "enviando" | "pronta" | "erro";
  id?: Id; // depois de salva
  codigo?: string;
}

export interface EstadoCaptura {
  /** Fotos prontas (as já salvas recebidas em `fotos` + as recém-enviadas que a consulta ainda não trouxe). */
  ids: Id[];
  /** true enquanto alguma foto está sendo preparada ou enviada. */
  ocupado: boolean;
}

export function CapturaFoto({
  osId,
  fase,
  etapaId,
  fotos,
  podeRemover,
  rotulo = "Fotos",
  mostrarProntas = true,
  onEstado,
}: {
  osId: Id;
  fase: Fase;
  etapaId?: Id;
  /** Fotos já salvas que esta captura mostra (ex.: as da etapa). */
  fotos: Foto[];
  podeRemover: (f: Foto) => boolean;
  /** Nome acessível da lista de miniaturas e dos botões de remover. */
  rotulo?: string;
  /** false: a foto salva sai daqui (a tela já a mostra em outro lugar, ex.: a galeria) e conta em "N fotos adicionadas". */
  mostrarProntas?: boolean;
  onEstado?: (e: EstadoCaptura) => void;
}) {
  const acoes = useAcoes();
  const id = useId();
  const toque = useMidia("(pointer: coarse)");
  const camera = useRef<HTMLInputElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const contador = useRef(0);
  const fila = useRef<Promise<void>>(Promise.resolve());
  const previas = useRef(new Set<string>());
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [removendo, setRemovendo] = useState<Id | null>(null);
  const [erroRemover, setErroRemover] = useState("");
  const [temporaria, setTemporaria] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [adicionadas, setAdicionadas] = useState(0);

  // libera as prévias ao sair da tela
  useEffect(() => {
    const conjunto = previas.current;
    return () => conjunto.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const salvas = new Set(fotos.map((f) => f.id));
  // a recém-enviada sai da lista local quando a consulta já a trouxe
  const locais = pendentes.filter((p) => !(p.id && salvas.has(p.id)));
  const prontas = [...fotos.map((f) => f.id), ...locais.filter((p) => p.estado === "pronta" && p.id).map((p) => p.id!)];
  const ocupado = locais.some((p) => p.estado === "preparando" || p.estado === "enviando");
  const chaveEstado = `${prontas.join(",")}|${ocupado}`;

  const avisar = useRef(onEstado);
  useEffect(() => {
    avisar.current = onEstado;
  });
  useEffect(() => {
    const [lista, oc] = chaveEstado.split("|");
    avisar.current?.({ ids: lista ? lista.split(",") : [], ocupado: oc === "true" });
  }, [chaveEstado]);

  const mudar = (chave: number, dados: Partial<Pendente>) => setPendentes((ps) => ps.map((p) => (p.chave === chave ? { ...p, ...dados } : p)));

  async function processar(p: Pendente) {
    mudar(p.chave, { estado: "preparando", codigo: undefined });
    try {
      const f = await comprimirFoto(p.arquivo);
      mudar(p.chave, { estado: "enviando" });
      const r = await acoes.adicionarFoto.mutateAsync([osId, { fase, etapaId, arquivo: f.arquivo, miniatura: f.miniatura, largura: f.largura, altura: f.altura }]);
      if (!r.ok) {
        mudar(p.chave, { estado: "erro", codigo: r.codigo });
        return;
      }
      if (r.codigo === "fotos_temporarias") setTemporaria(true);
      if (mostrarProntas) mudar(p.chave, { estado: "pronta", id: r.id });
      else {
        descartar(p.chave);
        setAdicionadas((n) => n + 1);
      }
    } catch (e) {
      mudar(p.chave, { estado: "erro", codigo: e instanceof ErroFoto ? e.codigo : undefined });
    }
  }

  /** Uma de cada vez: a compressão da câmera pesa na memória do celular. */
  function enfileirar(p: Pendente) {
    fila.current = fila.current.then(() => processar(p));
  }

  function receber(lista: FileList | File[] | null) {
    const arquivos = Array.from(lista ?? []);
    if (!arquivos.length) return;
    setErroRemover("");
    setAdicionadas(0);
    const novos = arquivos.map<Pendente>((a) => {
      const previa = URL.createObjectURL(a);
      previas.current.add(previa);
      return { chave: ++contador.current, arquivo: a, previa, estado: "preparando" };
    });
    setPendentes((ps) => [...ps, ...novos]);
    novos.forEach(enfileirar);
  }

  function descartar(chave: number) {
    setPendentes((ps) => {
      const p = ps.find((x) => x.chave === chave);
      if (p) {
        URL.revokeObjectURL(p.previa);
        previas.current.delete(p.previa);
      }
      return ps.filter((x) => x.chave !== chave);
    });
  }

  async function remover(fotoId: Id, chave?: number) {
    setErroRemover("");
    setRemovendo(fotoId);
    try {
      const r = await acoes.removerFoto.mutateAsync([fotoId]);
      if (!r.ok) setErroRemover(mensagemErro(r.codigo));
      else if (chave !== undefined) descartar(chave);
    } catch {
      setErroRemover(mensagemErro());
    } finally {
      setRemovendo(null);
    }
  }

  function soltar(e: DragEvent) {
    e.preventDefault();
    setArrastando(false);
    receber(e.dataTransfer.files); // o que não for imagem vira erro legível (arquivo_invalido)
  }

  const comErro = locais.filter((p) => p.estado === "erro");
  const naGrade = locais.filter((p) => p.estado !== "erro");
  const total = fotos.length + naGrade.length;
  const ordem = (n: number) => `${rotulo}: foto ${n}`;

  return (
    <div className="flex flex-col gap-3">
      {/* entradas escondidas; os botões abaixo as acionam (teclado e leitor de tela usam os botões) */}
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        tabIndex={-1}
        aria-hidden="true"
        data-captura="camera"
        className="sr-only"
        onChange={(e) => {
          receber(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={arquivo}
        type="file"
        accept="image/*"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        data-captura="arquivo"
        className="sr-only"
        onChange={(e) => {
          receber(e.target.files);
          e.target.value = "";
        }}
      />

      {total > 0 && (
        <GradeMiniaturas rotulo={rotulo}>
          {fotos.map((f, i) => (
            <li key={f.id} className="relative aspect-[4/3] rounded-controle overflow-hidden border border-linha bg-cinza-100">
              <ImagemFoto src={fonteMiniatura(f)} alt={`${ordem(i + 1)}, ${FASE_VISTORIA[f.fase].toLowerCase()}`} className="block w-full h-full" compacto />
              {podeRemover(f) && (
                <BotaoRemoverFoto rotulo={`Remover ${ordem(i + 1).toLowerCase()}`} desabilitado={removendo !== null} onClick={() => remover(f.id)} />
              )}
              {removendo === f.id && <Faixa texto="Removendo…" />}
            </li>
          ))}
          {naGrade.map((p, i) => {
            const n = fotos.length + i + 1;
            return (
              <li key={p.chave} className="relative aspect-[4/3] rounded-controle overflow-hidden border border-linha bg-cinza-100">
                <ImagemFoto src={p.previa} alt={ordem(n)} className={`block w-full h-full ${p.estado === "pronta" ? "" : "opacity-60"}`} compacto />
                {p.estado === "pronta" && p.id ? (
                  <>
                    <BotaoRemoverFoto rotulo={`Remover ${ordem(n).toLowerCase()}`} desabilitado={removendo !== null} onClick={() => remover(p.id!, p.chave)} />
                    {removendo === p.id && <Faixa texto="Removendo…" />}
                  </>
                ) : (
                  <Faixa texto={p.estado === "enviando" ? "Enviando…" : "Preparando foto…"} carregando />
                )}
              </li>
            );
          })}
        </GradeMiniaturas>
      )}

      {comErro.length > 0 && (
        <ul className="m-0 p-0 list-none flex flex-col gap-2" aria-label="Fotos que não foram salvas">
          {comErro.map((p) => (
            <li key={p.chave} role="alert" className="flex items-start gap-3 p-2 pr-1 rounded-controle bg-alerta-claro border border-alerta/25">
              <span className="w-14 h-[42px] shrink-0 rounded-controle overflow-hidden">
                <ImagemFoto src={p.previa} alt="" className="block w-full h-full" compacto />
              </span>
              <span className="flex-1 min-w-0 text-[13px] leading-snug text-alerta">
                <span className="block font-semibold break-words">Não salvei {p.arquivo.name ? `“${p.arquivo.name}”` : "a foto"}</span>
                <span className="block font-medium">{mensagemErro(p.codigo)}</span>
              </span>
              <span className="flex shrink-0 items-center">
                {!SEM_NOVA_TENTATIVA.has(p.codigo ?? "") && (
                  <Botao variante="contorno" tamanho="denso" onClick={() => enfileirar(p)}>
                    Tentar de novo
                  </Botao>
                )}
                <button
                  type="button"
                  aria-label={`Descartar ${p.arquivo.name || "foto"}`}
                  onClick={() => descartar(p.chave)}
                  className="w-11 h-11 grid place-items-center rounded-controle text-alerta hover:bg-cartao/60 transition-colors duration-150"
                >
                  <Icone nome="fechar" tamanho={16} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {erroRemover && (
        <p role="alert" className="flex items-start gap-2 text-[13px] font-medium text-alerta">
          <Icone nome="alerta" tamanho={16} className="mt-0.5 shrink-0" />
          {erroRemover}
        </p>
      )}

      {toque ? (
        <div className="grid gap-2">
          <Botao variante="contorno" tamanho="grande" icone="camera" className="w-full" onClick={() => camera.current?.click()}>
            {mostrarProntas && total > 0 ? "Tirar outra foto" : "Tirar foto"}
          </Botao>
          <Botao variante="contorno" tamanho="grande" icone="mais" className="w-full" onClick={() => arquivo.current?.click()}>
            Escolher da galeria
          </Botao>
        </div>
      ) : (
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastando(false);
          }}
          onDrop={soltar}
          aria-describedby={`${id}-dica`}
          className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 min-h-16 rounded-cartao border border-dashed transition-colors duration-150 ${
            arrastando ? "border-amarelo-escuro bg-amarelo-claro" : "border-linha-forte bg-cinza-50"
          }`}
        >
          <Botao variante="contorno" icone="mais" onClick={() => arquivo.current?.click()}>
            {mostrarProntas && total > 0 ? "Escolher mais fotos" : "Escolher arquivo"}
          </Botao>
          <span id={`${id}-dica`} className="text-[13px] text-tinta-suave">
            {arrastando ? "Solte para adicionar." : "ou arraste as fotos para cá · JPG, PNG ou WebP, várias de uma vez"}
          </span>
        </div>
      )}

      {adicionadas > 0 && !ocupado && (
        <Aviso tom="ok">{adicionadas === 1 ? "1 foto adicionada. Ela já aparece abaixo." : `${adicionadas} fotos adicionadas. Elas já aparecem abaixo.`}</Aviso>
      )}

      {temporaria && (
        <p role="status" className="flex items-start gap-2 text-[13px] text-tinta-suave">
          <Icone nome="alerta" tamanho={16} className="mt-0.5 shrink-0 text-atencao" />
          {ERRO.fotos_temporarias}
        </p>
      )}
    </div>
  );
}

/** Faixa sobre a miniatura ("Preparando foto…", "Enviando…", "Removendo…"). */
function Faixa({ texto, carregando = false }: { texto: string; carregando?: boolean }) {
  return (
    <span role="status" className="absolute inset-x-0 bottom-0 flex flex-col bg-cartao/90 text-tinta">
      {carregando && <span aria-hidden="true" className="h-0.5 esqueleto rounded-none bg-tinta-fraca" />}
      <span className="px-2 py-1.5 text-[12px] font-medium leading-tight">{texto}</span>
    </span>
  );
}

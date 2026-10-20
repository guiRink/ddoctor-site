import { useEffect, useId, useRef, useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import type { Id, ModeloEtapaItem, TipoReparo } from "@compartilhado/tipos";
import { ETAPAS_SUGERIDAS, LIMITES_TIPO_REPARO, chaveNome, validarTipoReparo } from "@compartilhado/dominio/tiposReparo";
import { mensagemErro, useAcoes } from "../../dados/hooks";
import { Botao } from "../ui/Basicos";
import { CampoComAfixo, CLASSE_CAMPO, Grupo, LinhaPrevia, Marcador, MensagemErro, Previa } from "../ui/Campos";
import { Gaveta } from "../ui/Gaveta";
import { Icone } from "../Icone";

/**
 * Criar ou editar um tipo de reparo (a "categoria de serviço" do dono): nome e etapas na ordem da produção,
 * cada uma com prazo padrão em horas úteis e as marcas "pode ser dispensada", "exige foto" e "conta peças".
 * Atalho "Começar a partir de" copia as etapas de um tipo existente. Salva por `salvarTipoReparo`
 * (validação de `validarTipoReparo`) e devolve o id para o fluxo de origem marcar o tipo novo.
 * Abre como gaveta própria (portal no <body>), por cima de outra gaveta se for o caso (Receber o carro).
 */

interface Rascunho {
  chave: string;
  nome: string;
  prazo: string; // texto do campo ("1,5")
  dispensavel: boolean;
  exigeFoto: boolean;
  exigeContagemPecas: boolean;
  /** Mexeu no prazo ou nas marcas: escolher um nome sugerido não sobrescreve mais. */
  tocado: boolean;
}

let seq = 0;
const novaChave = () => `etapa-${++seq}`;

const vazia = (): Rascunho => ({ chave: novaChave(), nome: "", prazo: "", dispensavel: false, exigeFoto: false, exigeContagemPecas: false, tocado: false });

const deModelo = (e: Omit<ModeloEtapaItem, "ordem">, tocado = true): Rascunho => ({
  chave: novaChave(),
  nome: e.nome,
  prazo: String(e.prazoPadraoHoras).replace(".", ","),
  dispensavel: e.dispensavel,
  exigeFoto: e.exigeFoto,
  exigeContagemPecas: e.exigeContagemPecas,
  tocado,
});

const lerPrazo = (t: string): number => (t.trim() === "" ? NaN : Number(t.replace(",", ".")));
const prazoValido = (n: number) => Number.isFinite(n) && n > 0 && n <= LIMITES_TIPO_REPARO.maxPrazoHoras;
const horas = (n: number) => `${String(Math.round(n * 10) / 10).replace(".", ",")} h`;

export function FormTipoReparo({
  inicial,
  existentes,
  onFechar,
  onSalvo,
}: {
  /** Tipo a editar; ausente = categoria nova. */
  inicial?: TipoReparo;
  /** Tipos da oficina: modelos para copiar e conferência de nome repetido. */
  existentes: TipoReparo[];
  onFechar: () => void;
  /** Depois de salvar: id e dados do tipo, para quem abriu marcar/mostrar sem esperar a lista recarregar. */
  onSalvo: (tipo: TipoReparo) => void;
}) {
  const acoes = useAcoes();
  const id = useId();
  const idSugestoes = `${id}-sugestoes`;
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [etapas, setEtapas] = useState<Rascunho[]>(() =>
    inicial ? [...inicial.etapas].sort((a, b) => a.ordem - b.ordem).map((e) => deModelo(e)) : [vazia()],
  );
  const [modelo, setModelo] = useState<string>();
  const [tentou, setTentou] = useState(false);
  const [erroNomeServidor, setErroNomeServidor] = useState<string>();
  const [erro, setErro] = useState<string>();
  /** Campos candidatos a receber o foco depois do próximo render (o primeiro que existir e estiver habilitado). */
  const focar = useRef<string[]>([]);
  const salvando = acoes.salvarTipoReparo.isPending;

  // foco depois de adicionar, remover ou mover uma etapa (a ordem muda o DOM)
  useEffect(() => {
    if (focar.current.length === 0) return;
    const candidatos = focar.current;
    focar.current = [];
    for (const c of candidatos) {
      const el = document.getElementById(c) as HTMLButtonElement | HTMLInputElement | null;
      if (el && !el.disabled) return el.focus();
    }
  });

  // ------------------------------------------------------------ erros por campo (só depois da 1ª tentativa)
  const outros = existentes.filter((t) => t.id !== inicial?.id);
  const nomeLimpo = nome.replace(/\s+/g, " ").trim();
  const erroNome = !tentou
    ? erroNomeServidor
    : !nomeLimpo
      ? "Dê um nome à categoria (ex.: Martelinho de ouro)."
      : outros.some((t) => chaveNome(t.nome) === chaveNome(nomeLimpo))
        ? mensagemErro("nome_duplicado")
        : erroNomeServidor;
  const errosEtapa = (e: Rascunho) => ({
    nome: tentou && !e.nome.trim() ? "Dê um nome à etapa." : undefined,
    prazo: tentou && !prazoValido(lerPrazo(e.prazo)) ? `Maior que zero, até ${LIMITES_TIPO_REPARO.maxPrazoHoras} h.` : undefined,
  });
  const erroLista = tentou && etapas.length === 0 ? mensagemErro("sem_etapas") : undefined;

  // ------------------------------------------------------------ edição da lista
  function mudar(chave: string, parte: Partial<Rascunho>) {
    setErro(undefined);
    setEtapas((l) => l.map((e) => (e.chave === chave ? { ...e, ...parte } : e)));
  }
  function mudarNome(chave: string, texto: string) {
    const atual = etapas.find((e) => e.chave === chave);
    const sugerida = ETAPAS_SUGERIDAS.find((s) => chaveNome(s.nome) === chaveNome(texto));
    // nome sugerido numa etapa ainda não ajustada: traz prazo e marcas da sugestão
    if (sugerida && atual && !atual.tocado) {
      const m = deModelo(sugerida, false);
      mudar(chave, { nome: texto, prazo: m.prazo, dispensavel: m.dispensavel, exigeFoto: m.exigeFoto, exigeContagemPecas: m.exigeContagemPecas });
    } else mudar(chave, { nome: texto });
  }
  function mover(chave: string, delta: -1 | 1) {
    const i = etapas.findIndex((e) => e.chave === chave);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= etapas.length) return;
    const nova = [...etapas];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    // o foco fica no mesmo botão; se ele ficou desabilitado (chegou à ponta), vai para o outro
    const [mesmo, outro] = delta < 0 ? ["subir", "descer"] : ["descer", "subir"];
    focar.current = [`${id}-${chave}-${mesmo}`, `${id}-${chave}-${outro}`];
    setEtapas(nova);
  }
  function remover(chave: string) {
    const i = etapas.findIndex((e) => e.chave === chave);
    const resto = etapas.filter((e) => e.chave !== chave);
    const vizinha = resto[Math.min(i, resto.length - 1)];
    focar.current = vizinha ? [`${id}-${vizinha.chave}-nome`] : [`${id}-adicionar`];
    setErro(undefined);
    setEtapas(resto);
  }
  function adicionar() {
    const nova = vazia();
    focar.current = [`${id}-${nova.chave}-nome`];
    setEtapas((l) => [...l, nova]);
  }
  function copiar(t: TipoReparo) {
    setErro(undefined);
    setModelo(t.id);
    setEtapas([...t.etapas].sort((a, b) => a.ordem - b.ordem).map((e) => deModelo(e)));
  }

  // ------------------------------------------------------------ salvar
  async function salvar() {
    setTentou(true);
    setErro(undefined);
    setErroNomeServidor(undefined);
    const entrada = {
      id: inicial?.id,
      nome: nomeLimpo,
      etapas: etapas.map((e, i) => ({
        ordem: i + 1,
        nome: e.nome,
        prazoPadraoHoras: lerPrazo(e.prazo),
        dispensavel: e.dispensavel,
        exigeFoto: e.exigeFoto,
        exigeContagemPecas: e.exigeContagemPecas,
      })),
    };
    const v = validarTipoReparo(entrada, existentes);
    if (!v.ok) {
      // o campo com problema já aparece marcado; leva o foco até ele
      const primeiro = !nomeLimpo || v.codigo === "nome_duplicado" ? `${id}-nome` : focoDoErro(etapas, id);
      if (primeiro) document.getElementById(primeiro)?.focus();
      else setErro(mensagemErro(v.codigo));
      return;
    }
    try {
      const r = await acoes.salvarTipoReparo.mutateAsync([entrada]);
      if (!r.ok || !r.id) {
        if (r.codigo === "nome_duplicado" || r.codigo === "nome_obrigatorio") {
          setErroNomeServidor(mensagemErro(r.codigo));
          document.getElementById(`${id}-nome`)?.focus();
        } else setErro(mensagemErro(r.codigo));
        return;
      }
      onSalvo({ id: r.id as Id, nome: v.nome, etapas: v.etapas, provisorio: false });
    } catch {
      setErro(mensagemErro());
    }
  }

  // ------------------------------------------------------------ prévia
  const nomesPrevia = etapas.map((e) => e.nome.trim()).filter(Boolean);
  const totalHoras = etapas.reduce((s, e) => s + (prazoValido(lerPrazo(e.prazo)) ? lerPrazo(e.prazo) : 0), 0);
  const noLimite = etapas.length >= LIMITES_TIPO_REPARO.maxEtapas;
  const editando = Boolean(inicial);

  const gaveta = (
    <Gaveta
      titulo={editando ? `Editar ${inicial!.nome}` : "Nova categoria de serviço"}
      descricao={
        editando
          ? "Vale para os próximos carros. As OS que já entraram mantêm as etapas de quando foram recebidas."
          : "Para um serviço que ainda não existe. As etapas viram a fila da produção quando o carro entra."
      }
      onFechar={onFechar}
      onEnviar={salvar}
      acao={editando ? "Salvar alterações" : "Criar categoria"}
      enviando={salvando}
      erro={erro}
      corpoClassName="flex flex-col gap-6"
      rotuloFechar={editando ? "Fechar sem salvar" : "Fechar sem criar"}
    >
      <Grupo id={`${id}-nome`} rotulo="Nome da categoria" erro={erroNome} dica="Como aparece na escolha do serviço, na OS e na produção.">
        <input
          id={`${id}-nome`}
          data-foco-inicial
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            setErroNomeServidor(undefined);
          }}
          maxLength={LIMITES_TIPO_REPARO.maxNome}
          autoComplete="off"
          placeholder="Ex.: Vitrificação de pintura"
          aria-invalid={Boolean(erroNome)}
          aria-describedby={erroNome ? `${id}-nome-erro` : `${id}-nome-dica`}
          className={CLASSE_CAMPO}
        />
      </Grupo>

      {!editando && existentes.length > 0 && (
        <div role="group" aria-labelledby={`${id}-modelos`} className="min-w-0">
          <p id={`${id}-modelos`} className="mb-1.5 text-[13px] font-medium text-tinta-suave">
            Começar a partir de <span className="font-normal text-tinta-fraca">· opcional</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {existentes.map((t) => (
              <Botao
                key={t.id}
                tamanho="denso"
                variante="contorno"
                icone={modelo === t.id ? "ok" : "copiar"}
                aria-pressed={modelo === t.id}
                aria-label={`Copiar as etapas de ${t.nome}`}
                onClick={() => copiar(t)}
                className={modelo === t.id ? "border-tinta! ring-1 ring-tinta" : ""}
              >
                {t.nome}
              </Botao>
            ))}
          </div>
          <p className="mt-1.5 text-[12px] text-tinta-suave">Copia as etapas e prazos do tipo escolhido para você ajustar. Substitui as etapas abaixo.</p>
        </div>
      )}

      <section aria-labelledby={`${id}-etapas`} className="flex flex-col gap-3 min-w-0">
        <header>
          <h3 id={`${id}-etapas`} className="text-[14px] font-semibold text-tinta">
            Etapas <span className="ml-1 text-[13px] font-normal text-tinta-fraca numero">{etapas.length}</span>
          </h3>
          <p className="mt-0.5 text-[13px] text-tinta-suave">Na ordem em que o carro passa. O prazo conta só as horas do expediente.</p>
        </header>

        <datalist id={idSugestoes}>
          {ETAPAS_SUGERIDAS.map((s) => (
            <option key={s.nome} value={s.nome} />
          ))}
        </datalist>

        {etapas.length > 0 && (
          <ol className="flex flex-col gap-2.5">
            {etapas.map((e, i) => (
              <LinhaEtapa
                key={e.chave}
                base={`${id}-${e.chave}`}
                idSugestoes={idSugestoes}
                etapa={e}
                ordem={i + 1}
                ultimo={i === etapas.length - 1}
                erros={errosEtapa(e)}
                onNome={(t) => mudarNome(e.chave, t)}
                onMudar={(parte) => mudar(e.chave, { ...parte, tocado: true })}
                onMover={(d) => mover(e.chave, d)}
                onRemover={() => remover(e.chave)}
              />
            ))}
          </ol>
        )}
        {erroLista && <MensagemErro id={`${id}-lista-erro`}>{erroLista}</MensagemErro>}

        <div className="flex flex-wrap items-center gap-3">
          <Botao id={`${id}-adicionar`} tamanho="denso" variante="contorno" icone="mais" onClick={adicionar} disabled={noLimite}>
            Adicionar etapa
          </Botao>
          {noLimite && <span className="text-[12px] text-tinta-suave">No máximo {LIMITES_TIPO_REPARO.maxEtapas} etapas.</span>}
        </div>
      </section>

      <Previa titulo="Como fica na produção">
        <div className="pb-1.5">
          <dt className="sr-only">Sequência</dt>
          <dd className="m-0 text-[14px] font-medium leading-snug break-words">
            {nomesPrevia.length ? (
              nomesPrevia.map((n, i) => (
                <span key={`${n}-${i}`}>
                  {i > 0 && <span className="text-tinta-fraca"> → </span>}
                  {n}
                </span>
              ))
            ) : (
              <span className="font-normal text-tinta-fraca">Dê nome às etapas para ver a sequência.</span>
            )}
          </dd>
        </div>
        <LinhaPrevia rotulo="Etapas">{etapas.length}</LinhaPrevia>
        <LinhaPrevia rotulo="Prazo somado (horas úteis)">{horas(totalHoras)}</LinhaPrevia>
      </Previa>
    </Gaveta>
  );

  // Portal no <body>: não aninha <form> nem <dialog> no DOM de quem abriu. Os eventos sintéticos do React,
  // porém, sobem pela árvore de componentes: o Esc (cancel) e o envio param aqui para não fechar/enviar a
  // gaveta de baixo (Receber o carro).
  const parar = { onCancel: (e: SyntheticEvent) => e.stopPropagation(), onSubmit: (e: SyntheticEvent) => e.stopPropagation() };
  return createPortal(
    <div className="contents" {...parar}>
      {gaveta}
    </div>,
    document.body,
  );
}

/** Id do primeiro campo de etapa com problema (para levar o foco). */
function focoDoErro(etapas: Rascunho[], id: string): string | undefined {
  for (const e of etapas) {
    if (!e.nome.trim()) return `${id}-${e.chave}-nome`;
    if (!prazoValido(lerPrazo(e.prazo))) return `${id}-${e.chave}-prazo`;
  }
  return etapas.length === 0 ? `${id}-adicionar` : undefined;
}

// ------------------------------------------------------------------ uma etapa

function LinhaEtapa({
  base,
  idSugestoes,
  etapa,
  ordem,
  ultimo,
  erros,
  onNome,
  onMudar,
  onMover,
  onRemover,
}: {
  base: string;
  idSugestoes: string;
  etapa: Rascunho;
  ordem: number;
  ultimo: boolean;
  erros: { nome?: string; prazo?: string };
  onNome: (t: string) => void;
  onMudar: (parte: Partial<Rascunho>) => void;
  onMover: (delta: -1 | 1) => void;
  onRemover: () => void;
}) {
  const nomeLegivel = etapa.nome.trim() || `etapa ${ordem}`;
  const acao = "w-10 md:w-8 h-10 md:h-8 px-0! text-tinta-suave";
  return (
    <li className="min-w-0 rounded-cartao border border-linha bg-cartao px-3.5 pt-2.5 pb-3">
      <div className="flex items-center gap-2 mb-1">
        <span aria-hidden="true" className="inline-grid place-items-center shrink-0 w-5 h-5 rounded-full bg-cinza-200 text-[11px] font-semibold numero text-tinta-suave">
          {ordem}
        </span>
        <span className="flex-1 min-w-0 text-[13px] font-medium text-tinta-suave">Etapa {ordem}</span>
        <span className="flex items-center -mr-1.5">
          <Botao id={`${base}-subir`} variante="fantasma" tamanho="denso" aria-label={`Subir ${nomeLegivel}`} disabled={ordem === 1} onClick={() => onMover(-1)} className={acao}>
            <Icone nome="baixo" tamanho={16} className="rotate-180" />
          </Botao>
          <Botao id={`${base}-descer`} variante="fantasma" tamanho="denso" aria-label={`Descer ${nomeLegivel}`} disabled={ultimo} onClick={() => onMover(1)} className={acao}>
            <Icone nome="baixo" tamanho={16} />
          </Botao>
          <Botao variante="fantasma" tamanho="denso" aria-label={`Remover ${nomeLegivel}`} title="Remover etapa" onClick={onRemover} className={`${acao} hover:text-alerta!`}>
            <Icone nome="fechar" tamanho={16} />
          </Botao>
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3 items-start">
        <Grupo id={`${base}-nome`} rotulo="Nome" erro={erros.nome}>
          <input
            id={`${base}-nome`}
            list={idSugestoes}
            value={etapa.nome}
            onChange={(e) => onNome(e.target.value)}
            maxLength={LIMITES_TIPO_REPARO.maxNome}
            autoComplete="off"
            placeholder="Escolha ou digite"
            aria-invalid={Boolean(erros.nome)}
            aria-describedby={erros.nome ? `${base}-nome-erro` : undefined}
            className={CLASSE_CAMPO}
          />
        </Grupo>
        <Grupo id={`${base}-prazo`} rotulo="Prazo padrão" erro={erros.prazo}>
          <CampoComAfixo
            id={`${base}-prazo`}
            sufixo="h úteis"
            inputMode="decimal"
            autoComplete="off"
            value={etapa.prazo}
            onChange={(e) => onMudar({ prazo: e.target.value.replace(/[^\d,.]/g, "") })}
            aria-invalid={Boolean(erros.prazo)}
            aria-describedby={erros.prazo ? `${base}-prazo-erro` : undefined}
            className="pr-16!"
          />
        </Grupo>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-0.5">
        <Marcador id={`${base}-dispensavel`} rotulo="Pode ser dispensada" marcado={etapa.dispensavel} onMudar={(v) => onMudar({ dispensavel: v })} />
        <Marcador id={`${base}-foto`} rotulo="Exige foto" marcado={etapa.exigeFoto} onMudar={(v) => onMudar({ exigeFoto: v })} />
        <Marcador id={`${base}-pecas`} rotulo="Conta peças" marcado={etapa.exigeContagemPecas} onMudar={(v) => onMudar({ exigeContagemPecas: v })} />
      </div>
    </li>
  );
}

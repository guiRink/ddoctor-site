import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import type { ChecklistItem, ConfigOficina } from "@compartilhado/tipos";
import { itensChecklist } from "@compartilhado/dominio/config";
import { useConfig } from "../../dados/hooks";
import { mesmoNome, useEditorChecklist, type EditorChecklistEstado, type Rascunho } from "./editorChecklist";
import { Botao } from "../ui/Basicos";
import { MensagemErro } from "../ui/Campos";
import { Retorno } from "../gestao/Comuns";
import { CLASSE_CAMPO } from "../gestao/formato";
import { Icone } from "../Icone";
import { Consulta, Interruptor, NotaProvisoria, Secao } from "./Estrutura";


/** Checklist de entrada em Ajustes: o editor numa seção, com a barra de salvar grudada embaixo. */
export function Checklist({ podeEditar }: { podeEditar: boolean }) {
  const q = useConfig();
  return (
    <Consulta q={q}>
      {(c: ConfigOficina) => {
        const itens = itensChecklist(c);
        return <SecaoChecklist key={JSON.stringify(itens)} itens={itens} padrao={!c.checklist} podeEditar={podeEditar} />;
      }}
    </Consulta>
  );
}

function SecaoChecklist({ itens, padrao, podeEditar }: { itens: readonly ChecklistItem[]; padrao: boolean; podeEditar: boolean }) {
  const ed = useEditorChecklist(itens);
  const ativos = ed.lista.filter((i) => i.ativo).length;
  return (
    <Secao
      id="checklist"
      titulo="Checklist de entrada"
      descricao="O que a recepção confere quando o carro chega."
      nota={padrao ? <NotaProvisoria texto="lista genérica, a confirmar com a oficina" /> : <span className="numero">{ativos} itens ativos</span>}
    >
      <CorpoEditorChecklist ed={ed} podeEditar={podeEditar} />
      {podeEditar && (ed.alterado || ed.erro || ed.ok) && (
        <div className="sticky bottom-20 md:bottom-0 flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-linha bg-cartao/95 backdrop-blur-[2px]">
          <div className="text-[13px]">
            {ed.alterado ? <p className="font-medium">Alterações não salvas no checklist</p> : null}
            <Retorno erro={ed.erro} ok={ed.ok} />
          </div>
          {ed.alterado && (
            <span className="flex items-center gap-2">
              <Botao variante="fantasma" tamanho="denso" onClick={ed.descartar}>
                Descartar
              </Botao>
              <Botao variante="primario" tamanho="denso" onClick={ed.salvar} disabled={ed.salvando}>
                {ed.salvando ? "Salvando…" : "Salvar checklist"}
              </Botao>
            </span>
          )}
        </div>
      )}
    </Secao>
  );
}

/**
 * Miolo do editor (sem moldura nem botão de salvar): um bloco por grupo — cabeçalho com renomear e subir/descer
 * o grupo, os itens (interruptor, editar nome e grupo, subir/descer) e "Novo item"; no fim, "Novo grupo".
 * `compacto`: dentro da gaveta (padding 16 em vez de 20).
 */
export function CorpoEditorChecklist({ ed, podeEditar, compacto = false }: { ed: EditorChecklistEstado; podeEditar: boolean; compacto?: boolean }) {
  const [editando, setEditando] = useState<string | null>(null);
  const px = compacto ? "px-4" : "px-5";
  return (
    <>
      {ed.grupos.length === 0 && <p className={`${px} py-4 text-[13px] text-tinta-suave`}>Nenhum item no checklist. Crie o primeiro grupo abaixo.</p>}
      {ed.grupos.map((g, gi) => {
        const doGrupo = ed.lista.filter((i) => i.grupo === g);
        return (
          <section key={g} aria-label={`Grupo ${g}`} className="border-b border-linha last:border-b-0">
            <CabecalhoGrupo
              grupo={g}
              ativos={doGrupo.filter((i) => i.ativo).length}
              total={doGrupo.length}
              primeiro={gi === 0}
              ultimo={gi === ed.grupos.length - 1}
              podeEditar={podeEditar}
              px={px}
              onRenomear={(novo) => ed.renomearGrupo(g, novo)}
              onMover={(d) => ed.moverGrupo(g, d)}
            />
            <ul>
              {doGrupo.map((item, k) => (
                <LinhaItem
                  key={item.chave}
                  item={item}
                  grupos={ed.grupos}
                  primeiro={k === 0}
                  ultimo={k === doGrupo.length - 1}
                  podeEditar={podeEditar}
                  editando={editando === item.chave}
                  onEditar={(sim) => setEditando(sim ? item.chave : null)}
                  onSalvar={(nome, grupo) => {
                    ed.mudar(item.chave, { nome });
                    if (grupo !== item.grupo) ed.moverParaGrupo(item.chave, grupo);
                  }}
                  onAtivar={(v) => ed.mudar(item.chave, { ativo: v })}
                  onMover={(delta) => ed.mover(item.chave, delta)}
                  onRemover={() => ed.remover(item.chave)}
                />
              ))}
            </ul>
            {podeEditar && <AdicionarItem grupo={g} px={px} onAdicionar={(nome) => ed.adicionar(g, nome)} />}
          </section>
        );
      })}
      {podeEditar && <NovoGrupo grupos={ed.grupos} px={px} onCriar={(grupo, nome) => ed.adicionar(grupo, nome)} />}
    </>
  );
}

function CabecalhoGrupo({
  grupo,
  ativos,
  total,
  primeiro,
  ultimo,
  podeEditar,
  px,
  onRenomear,
  onMover,
}: {
  grupo: string;
  ativos: number;
  total: number;
  primeiro: boolean;
  ultimo: boolean;
  podeEditar: boolean;
  px: string;
  onRenomear: (novo: string) => string | undefined;
  onMover: (delta: -1 | 1) => void;
}) {
  const id = useId();
  const [renomeando, setRenomeando] = useState(false);
  const [texto, setTexto] = useState(grupo);
  const [erro, setErro] = useState<string>();
  function confirmar(e?: FormEvent) {
    e?.preventDefault();
    const r = onRenomear(texto);
    if (r) return setErro(r);
    setErro(undefined);
    setRenomeando(false);
  }
  function cancelar() {
    setTexto(grupo);
    setErro(undefined);
    setRenomeando(false);
  }
  if (renomeando)
    return (
      <form onSubmit={confirmar} className={`${px} pt-3 pb-2`} aria-label={`Renomear grupo ${grupo}`}>
        <div className="flex items-center gap-2">
          <label htmlFor={`${id}-grupo`} className="sr-only">
            Nome do grupo
          </label>
          <input
            id={`${id}-grupo`}
            autoFocus
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setErro(undefined);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                cancelar();
              }
            }}
            maxLength={40}
            aria-invalid={Boolean(erro)}
            aria-describedby={erro ? `${id}-erro` : undefined}
            className={`${CLASSE_CAMPO} flex-1 max-w-sm font-semibold`}
          />
          <Botao type="submit" tamanho="denso" className="max-md:h-11">
            OK
          </Botao>
          <Botao variante="fantasma" tamanho="denso" onClick={cancelar} className="max-md:h-11">
            Cancelar
          </Botao>
        </div>
        {erro && <MensagemErro id={`${id}-erro`}>{erro}</MensagemErro>}
      </form>
    );
  return (
    <header className={`group/grupo flex flex-wrap items-center gap-x-2 gap-y-0.5 ${px} pt-3 pb-1.5 min-h-12`}>
      <h3 className="flex flex-wrap items-baseline gap-x-2 flex-1 min-w-[10rem] text-[14px] font-semibold">
        <span className="break-words min-w-0">{grupo}</span>
        <span className="shrink-0 text-[12px] font-normal text-tinta-fraca numero">
          {ativos} de {total} ativos
        </span>
      </h3>
      {podeEditar && (
        <span className="flex items-center shrink-0 ml-auto transition-opacity duration-150 md:opacity-0 md:group-hover/grupo:opacity-100 md:focus-within:opacity-100">
          <Botao
            variante="fantasma"
            tamanho="denso"
            onClick={() => {
              setTexto(grupo);
              setRenomeando(true);
            }}
            aria-label={`Renomear grupo ${grupo}`}
          >
            Renomear
          </Botao>
          <Botao variante="fantasma" tamanho="denso" aria-label={`Subir grupo ${grupo}`} disabled={primeiro} onClick={() => onMover(-1)} className="w-10 md:w-9 px-0!">
            <Icone nome="baixo" tamanho={16} className="rotate-180 text-tinta-suave" />
          </Botao>
          <Botao variante="fantasma" tamanho="denso" aria-label={`Descer grupo ${grupo}`} disabled={ultimo} onClick={() => onMover(1)} className="w-10 md:w-9 px-0!">
            <Icone nome="baixo" tamanho={16} className="text-tinta-suave" />
          </Botao>
        </span>
      )}
    </header>
  );
}

function LinhaItem({
  item,
  grupos,
  primeiro,
  ultimo,
  podeEditar,
  editando,
  onEditar,
  onSalvar,
  onAtivar,
  onMover,
  onRemover,
}: {
  item: Rascunho;
  grupos: string[];
  primeiro: boolean;
  ultimo: boolean;
  podeEditar: boolean;
  editando: boolean;
  onEditar: (sim: boolean) => void;
  onSalvar: (nome: string, grupo: string) => void;
  onAtivar: (v: boolean) => void;
  onMover: (delta: -1 | 1) => void;
  onRemover: () => void;
}) {
  const id = useId();
  const [texto, setTexto] = useState(item.nome);
  const [grupo, setGrupo] = useState(item.grupo);
  function confirmar(e?: FormEvent) {
    e?.preventDefault();
    onSalvar(texto.trim() || item.nome, grupo);
    onEditar(false);
  }
  function cancelar() {
    setTexto(item.nome);
    setGrupo(item.grupo);
    onEditar(false);
  }
  function teclas(e: KeyboardEvent) {
    if (e.key === "Escape") {
      // não fecha a gaveta: só sai da edição do item
      e.preventDefault();
      e.stopPropagation();
      cancelar();
    }
  }
  const seta = "text-tinta-suave";

  if (editando)
    return (
      <li className="px-3 py-2.5 border-t border-linha first:border-t-0 bg-cinza-50">
        <form onSubmit={confirmar} onKeyDown={teclas} className="flex flex-wrap items-end gap-x-2 gap-y-2.5" aria-label={`Editar ${item.nome}`}>
          <label htmlFor={`${id}-nome`} className="flex flex-col gap-1 flex-[2] min-w-[12rem]">
            <span className="text-[12px] font-medium text-tinta-suave">Nome do item</span>
            <input id={`${id}-nome`} autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={80} className={CLASSE_CAMPO} />
          </label>
          {grupos.length > 1 && (
            <label htmlFor={`${id}-grupo`} className="flex flex-col gap-1 flex-1 min-w-[9rem]">
              <span className="text-[12px] font-medium text-tinta-suave">Grupo</span>
              <select id={`${id}-grupo`} value={grupo} onChange={(e) => setGrupo(e.target.value)} className={`${CLASSE_CAMPO} cursor-pointer`}>
                {grupos.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className="flex basis-full items-center justify-end gap-2">
            <Botao variante="fantasma" tamanho="denso" onClick={cancelar} className="max-md:h-11">
              Cancelar
            </Botao>
            <Botao type="submit" tamanho="denso" className="max-md:h-11">
              OK
            </Botao>
          </span>
        </form>
      </li>
    );

  return (
    <li className="group/linha flex items-center gap-2 pl-3 pr-3 min-h-11 border-t border-linha first:border-t-0 hover:bg-cinza-50 transition-colors duration-150">
      {podeEditar ? <Interruptor ligado={item.ativo} rotulo={`${item.ativo ? "Desativar" : "Ativar"} ${item.nome}`} onMudar={onAtivar} /> : <span className="w-3" />}
      <span className={`flex-1 min-w-0 py-2 text-[14px] break-words ${item.ativo ? "text-tinta" : "text-tinta-fraca line-through decoration-linha-forte"}`}>
        {item.nome}
        {!item.id && <span className="ml-2 text-[12px] text-tinta-suave no-underline">novo</span>}
      </span>
      {podeEditar && (
        <span className="flex items-center shrink-0 transition-opacity duration-150 md:opacity-0 md:group-hover/linha:opacity-100 md:focus-within:opacity-100">
          <Botao
            variante="fantasma"
            tamanho="denso"
            onClick={() => {
              setTexto(item.nome);
              setGrupo(item.grupo);
              onEditar(true);
            }}
            aria-label={`Editar ${item.nome}`}
          >
            Editar
          </Botao>
          {!item.id && (
            <Botao variante="fantasma" tamanho="denso" aria-label={`Remover ${item.nome}`} onClick={onRemover} className="w-10 md:w-9 px-0!">
              <Icone nome="fechar" tamanho={16} className={seta} />
            </Botao>
          )}
          <Botao variante="fantasma" tamanho="denso" aria-label={`Subir ${item.nome}`} disabled={primeiro} onClick={() => onMover(-1)} className="w-10 md:w-9 px-0!">
            <Icone nome="baixo" tamanho={16} className={`rotate-180 ${seta}`} />
          </Botao>
          <Botao variante="fantasma" tamanho="denso" aria-label={`Descer ${item.nome}`} disabled={ultimo} onClick={() => onMover(1)} className="w-10 md:w-9 px-0!">
            <Icone nome="baixo" tamanho={16} className={seta} />
          </Botao>
        </span>
      )}
    </li>
  );
}

function AdicionarItem({ grupo, px, onAdicionar }: { grupo: string; px: string; onAdicionar: (nome: string) => void }) {
  const id = useId();
  const [nome, setNome] = useState("");
  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    onAdicionar(nome.trim());
    setNome("");
  }
  return (
    <form onSubmit={enviar} className={`flex items-center gap-2 ${px} py-2.5 border-t border-linha`}>
      <label htmlFor={id} className="sr-only">
        Novo item em {grupo}
      </label>
      <input id={id} value={nome} onChange={(e) => setNome(e.target.value)} placeholder={`Novo item em ${grupo}`} maxLength={80} className={`${CLASSE_CAMPO} flex-1 min-w-0 max-w-md`} />
      <Botao type="submit" tamanho="denso" icone="mais" disabled={!nome.trim()} className="max-md:h-11">
        Adicionar
      </Botao>
    </form>
  );
}

function NovoGrupo({ grupos, px, onCriar }: { grupos: string[]; px: string; onCriar: (grupo: string, nome: string) => void }) {
  const id = useId();
  const [grupo, setGrupo] = useState("");
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string>();
  function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(undefined);
    if (!grupo.trim() || !nome.trim()) return setErro("Informe o nome do grupo e o primeiro item.");
    if (grupos.some((g) => mesmoNome(g, grupo))) return setErro("Esse grupo já existe: adicione o item nele.");
    onCriar(grupo.replace(/\s+/g, " ").trim(), nome.trim());
    setGrupo("");
    setNome("");
  }
  return (
    <form onSubmit={enviar} className={`flex flex-wrap items-end gap-3 ${px} py-4 bg-cinza-50 border-t border-linha`} aria-label="Novo grupo do checklist">
      <label className="flex flex-col gap-1.5 min-w-[11rem] flex-1" htmlFor={`${id}-grupo`}>
        <span className="text-[13px] font-medium text-tinta-suave">Novo grupo</span>
        <input id={`${id}-grupo`} value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="Ex.: Acessórios" maxLength={40} className={CLASSE_CAMPO} />
      </label>
      <label className="flex flex-col gap-1.5 min-w-[11rem] flex-1" htmlFor={`${id}-item`}>
        <span className="text-[13px] font-medium text-tinta-suave">Primeiro item</span>
        <input id={`${id}-item`} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Engate" maxLength={80} className={CLASSE_CAMPO} />
      </label>
      <Botao type="submit" tamanho="denso" icone="mais" className="max-md:h-11">
        Criar grupo
      </Botao>
      <div className="basis-full empty:hidden">
        <Retorno erro={erro} />
      </div>
    </form>
  );
}

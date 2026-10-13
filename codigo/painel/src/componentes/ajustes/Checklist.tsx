import { useState, type FormEvent, type KeyboardEvent } from "react";
import type { ChecklistItem, ConfigOficina } from "@compartilhado/tipos";
import { itensChecklist } from "@compartilhado/dominio/config";
import { mensagemErro, useAcoes, useConfig } from "../../dados/hooks";
import { Botao } from "../ui/Basicos";
import { Retorno } from "../gestao/Comuns";
import { CLASSE_CAMPO } from "../gestao/formato";
import { Icone } from "../Icone";
import { Consulta, Interruptor, NotaProvisoria, Secao } from "./Estrutura";

/** Item em edição: `chave` só para a tela; `id` vazio = item novo (o repositório gera o id). */
interface Rascunho {
  chave: string;
  id: string;
  grupo: string;
  nome: string;
  ativo: boolean;
}

let seq = 0;
const novaChave = () => `novo-${++seq}`;

/** Checklist de entrada: itens por grupo, ativar/desativar, renomear, adicionar e reordenar (salvarChecklistConfig). */
export function Checklist({ podeEditar }: { podeEditar: boolean }) {
  const q = useConfig();
  return (
    <Consulta q={q}>
      {(c: ConfigOficina) => {
        const itens = itensChecklist(c);
        return <EditorChecklist key={JSON.stringify(itens)} itens={itens} padrao={!c.checklist} podeEditar={podeEditar} />;
      }}
    </Consulta>
  );
}

function EditorChecklist({ itens, padrao, podeEditar }: { itens: readonly ChecklistItem[]; padrao: boolean; podeEditar: boolean }) {
  const acoes = useAcoes();
  const inicial = () => itens.map((i) => ({ ...i, chave: i.id }));
  const [lista, setLista] = useState<Rascunho[]>(inicial);
  const [editando, setEditando] = useState<string | null>(null);
  const [erro, setErro] = useState<string>();
  const [ok, setOk] = useState<string>();
  const alterado = JSON.stringify(lista.map(({ id, grupo, nome, ativo }) => ({ id, grupo, nome, ativo }))) !== JSON.stringify(itens.map(({ id, grupo, nome, ativo }) => ({ id, grupo, nome, ativo })));
  const grupos = [...new Set(lista.map((i) => i.grupo))];
  const ativos = lista.filter((i) => i.ativo).length;

  function mudar(chave: string, parte: Partial<Rascunho>) {
    setOk(undefined);
    setLista((l) => l.map((i) => (i.chave === chave ? { ...i, ...parte } : i)));
  }
  /** Troca de lugar com o vizinho do mesmo grupo (a lista é plana; a ordem dos grupos é a da 1ª aparição). */
  function mover(chave: string, delta: -1 | 1) {
    setOk(undefined);
    setLista((l) => {
      const i = l.findIndex((x) => x.chave === chave);
      const doGrupo = l.map((x, k) => (x.grupo === l[i].grupo ? k : -1)).filter((k) => k >= 0);
      const pos = doGrupo.indexOf(i);
      const alvo = doGrupo[pos + delta];
      if (alvo === undefined) return l;
      const nova = [...l];
      [nova[i], nova[alvo]] = [nova[alvo], nova[i]];
      return nova;
    });
  }
  function adicionar(grupo: string, nome: string) {
    setOk(undefined);
    setLista((l) => {
      const ultimo = l.map((x) => x.grupo).lastIndexOf(grupo);
      const item = { chave: novaChave(), id: "", grupo, nome, ativo: true };
      return ultimo < 0 ? [...l, item] : [...l.slice(0, ultimo + 1), item, ...l.slice(ultimo + 1)];
    });
  }

  async function salvar() {
    setErro(undefined);
    setOk(undefined);
    const r = await acoes.salvarChecklistConfig
      .mutateAsync([lista.map(({ id, grupo, nome, ativo }) => ({ id, grupo: grupo.trim(), nome: nome.trim(), ativo }))])
      .catch(() => ({ ok: false, codigo: undefined }));
    if (!r.ok) return setErro(mensagemErro(r.codigo));
    setOk("Checklist salvo. Vale para as próximas entradas.");
  }

  return (
    <Secao
      id="checklist"
      titulo="Checklist de entrada"
      descricao="O que a recepção confere quando o carro chega. Desativar tira o item das próximas entradas; o que já foi marcado nas OS antigas continua lá."
      nota={padrao ? <NotaProvisoria texto="lista genérica, a confirmar com a oficina" /> : <span className="numero">{ativos} itens ativos</span>}
    >
      {grupos.map((g) => {
        const doGrupo = lista.filter((i) => i.grupo === g);
        return (
          <div key={g} className="border-b border-linha last:border-b-0">
            <h3 className="flex items-baseline gap-2 px-5 pt-4 pb-2 text-[14px] font-semibold">
              {g}
              <span className="text-[12px] font-normal text-tinta-fraca numero">
                {doGrupo.filter((i) => i.ativo).length} de {doGrupo.length} ativos
              </span>
            </h3>
            <ul>
              {doGrupo.map((item, k) => (
                <LinhaItem
                  key={item.chave}
                  item={item}
                  primeiro={k === 0}
                  ultimo={k === doGrupo.length - 1}
                  podeEditar={podeEditar}
                  editando={editando === item.chave}
                  onEditar={(sim) => setEditando(sim ? item.chave : null)}
                  onMudar={(parte) => mudar(item.chave, parte)}
                  onMover={(delta) => mover(item.chave, delta)}
                />
              ))}
            </ul>
            {podeEditar && <AdicionarItem grupo={g} onAdicionar={(nome) => adicionar(g, nome)} />}
          </div>
        );
      })}
      {podeEditar && <NovoGrupo grupos={grupos} onCriar={(grupo, nome) => adicionar(grupo, nome)} />}
      {podeEditar && (alterado || erro || ok) && (
        <div className="sticky bottom-20 md:bottom-0 flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-linha bg-cartao/95 backdrop-blur-[2px]">
          <div className="text-[13px]">
            {alterado ? <p className="font-medium">Alterações não salvas no checklist</p> : null}
            <Retorno erro={erro} ok={ok} />
          </div>
          {alterado && (
            <span className="flex items-center gap-2">
              <Botao
                variante="fantasma"
                tamanho="denso"
                onClick={() => {
                  setLista(inicial());
                  setErro(undefined);
                  setEditando(null);
                }}
              >
                Descartar
              </Botao>
              <Botao variante="primario" tamanho="denso" onClick={salvar} disabled={acoes.salvarChecklistConfig.isPending}>
                {acoes.salvarChecklistConfig.isPending ? "Salvando…" : "Salvar checklist"}
              </Botao>
            </span>
          )}
        </div>
      )}
    </Secao>
  );
}

function LinhaItem({
  item,
  primeiro,
  ultimo,
  podeEditar,
  editando,
  onEditar,
  onMudar,
  onMover,
}: {
  item: Rascunho;
  primeiro: boolean;
  ultimo: boolean;
  podeEditar: boolean;
  editando: boolean;
  onEditar: (sim: boolean) => void;
  onMudar: (parte: Partial<Rascunho>) => void;
  onMover: (delta: -1 | 1) => void;
}) {
  const [texto, setTexto] = useState(item.nome);
  function confirmar() {
    if (texto.trim()) onMudar({ nome: texto.trim() });
    else setTexto(item.nome);
    onEditar(false);
  }
  function teclas(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmar();
    } else if (e.key === "Escape") {
      setTexto(item.nome);
      onEditar(false);
    }
  }
  const seta = "text-tinta-suave";
  return (
    <li className="group/linha flex items-center gap-2 pl-3 pr-3 min-h-11 border-t border-linha first:border-t-0 hover:bg-cinza-50 transition-colors duration-150">
      {podeEditar ? (
        <Interruptor ligado={item.ativo} rotulo={`${item.ativo ? "Desativar" : "Ativar"} ${item.nome}`} onMudar={(v) => onMudar({ ativo: v })} />
      ) : (
        <span className="w-3" />
      )}
      {editando ? (
        <span className="flex items-center gap-2 flex-1 min-w-0 py-1.5">
          <label htmlFor={`ck-${item.chave}`} className="sr-only">
            Nome do item
          </label>
          <input id={`ck-${item.chave}`} autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={teclas} maxLength={80} className={`${CLASSE_CAMPO} flex-1`} />
          <Botao tamanho="denso" onClick={confirmar}>
            OK
          </Botao>
        </span>
      ) : (
        <span className={`flex-1 min-w-0 py-2 text-[14px] ${item.ativo ? "text-tinta" : "text-tinta-fraca line-through decoration-linha-forte"}`}>
          {item.nome}
          {!item.id && <span className="ml-2 text-[12px] text-tinta-suave no-underline">novo</span>}
        </span>
      )}
      {podeEditar && !editando && (
        <span className="flex items-center shrink-0 transition-opacity duration-150 md:opacity-0 md:group-hover/linha:opacity-100 md:focus-within:opacity-100">
          <Botao variante="fantasma" tamanho="denso" onClick={() => onEditar(true)} aria-label={`Renomear ${item.nome}`}>
            Renomear
          </Botao>
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

function AdicionarItem({ grupo, onAdicionar }: { grupo: string; onAdicionar: (nome: string) => void }) {
  const [nome, setNome] = useState("");
  const id = `ck-novo-${grupo.replace(/\W+/g, "-")}`;
  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    onAdicionar(nome.trim());
    setNome("");
  }
  return (
    <form onSubmit={enviar} className="flex items-center gap-2 px-5 py-2.5 border-t border-linha">
      <label htmlFor={id} className="sr-only">
        Novo item em {grupo}
      </label>
      <input id={id} value={nome} onChange={(e) => setNome(e.target.value)} placeholder={`Novo item em ${grupo}`} maxLength={80} className={`${CLASSE_CAMPO} flex-1 max-w-md`} />
      <Botao type="submit" tamanho="denso" icone="mais" disabled={!nome.trim()} className="max-md:h-11">
        Adicionar
      </Botao>
    </form>
  );
}

function NovoGrupo({ grupos, onCriar }: { grupos: string[]; onCriar: (grupo: string, nome: string) => void }) {
  const [grupo, setGrupo] = useState("");
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string>();
  function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(undefined);
    if (!grupo.trim() || !nome.trim()) return setErro("Informe o nome do grupo e o primeiro item.");
    if (grupos.some((g) => g.toLowerCase() === grupo.trim().toLowerCase())) return setErro("Esse grupo já existe: adicione o item nele.");
    onCriar(grupo.trim(), nome.trim());
    setGrupo("");
    setNome("");
  }
  return (
    <form onSubmit={enviar} className="flex flex-wrap items-end gap-3 px-5 py-4 bg-cinza-50 border-t border-linha" aria-label="Novo grupo do checklist">
      <label className="flex flex-col gap-1.5 min-w-[12rem] flex-1" htmlFor="ck-grupo">
        <span className="text-[13px] font-medium text-tinta-suave">Novo grupo</span>
        <input id="ck-grupo" value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="Ex.: Acessórios" maxLength={40} className={CLASSE_CAMPO} />
      </label>
      <label className="flex flex-col gap-1.5 min-w-[12rem] flex-1" htmlFor="ck-grupo-item">
        <span className="text-[13px] font-medium text-tinta-suave">Primeiro item</span>
        <input id="ck-grupo-item" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Engate" maxLength={80} className={CLASSE_CAMPO} />
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

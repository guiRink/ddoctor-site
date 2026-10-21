import { useState } from "react";
import type { ChecklistItem } from "@compartilhado/tipos";
import { mensagemErro, useAcoes } from "../../dados/hooks";

/** Item em edição: `chave` só para a tela; `id` vazio = item novo (o repositório gera o id). */
export interface Rascunho {
  chave: string;
  id: string;
  grupo: string;
  nome: string;
  ativo: boolean;
}

let seq = 0;
const novaChave = () => `novo-${++seq}`;
export const mesmoNome = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const essencia = (l: readonly Pick<Rascunho, "id" | "grupo" | "nome" | "ativo">[]) => JSON.stringify(l.map(({ id, grupo, nome, ativo }) => ({ id, grupo, nome, ativo })));

/** Lista plana reagrupada: os itens de cada grupo juntos, na ordem dos grupos (1ª aparição ou `ordem`). */
function agrupar(l: Rascunho[], ordem?: string[]): Rascunho[] {
  const grupos = ordem ?? [...new Set(l.map((i) => i.grupo))];
  return grupos.flatMap((g) => l.filter((i) => i.grupo === g));
}

/**
 * Estado do editor do checklist de entrada (Ajustes e a gaveta "Editar checklist" do Receber o carro):
 * itens por grupo, ativar/desativar, renomear, mover de grupo, reordenar itens e grupos, criar e renomear grupo.
 * Os ids dos itens que continuam não mudam — é o que mantém as marcações de um carro em andamento.
 */
export function useEditorChecklist(itens: readonly ChecklistItem[]) {
  const acoes = useAcoes();
  const inicial = () => itens.map((i) => ({ ...i, chave: i.id }));
  const [lista, setLista] = useState<Rascunho[]>(inicial);
  const [erro, setErro] = useState<string>();
  const [ok, setOk] = useState<string>();
  const alterado = essencia(lista) !== essencia(itens);
  const grupos = [...new Set(lista.map((i) => i.grupo))];

  function alterar(f: (l: Rascunho[]) => Rascunho[]) {
    setOk(undefined);
    setErro(undefined);
    setLista(f);
  }

  return {
    lista,
    grupos,
    alterado,
    erro,
    ok,
    salvando: acoes.salvarChecklistConfig.isPending,
    mudar: (chave: string, parte: Partial<Rascunho>) => alterar((l) => l.map((i) => (i.chave === chave ? { ...i, ...parte } : i))),
    /** Troca de lugar com o vizinho do mesmo grupo. */
    mover: (chave: string, delta: -1 | 1) =>
      alterar((l) => {
        const i = l.findIndex((x) => x.chave === chave);
        const doGrupo = l.map((x, k) => (x.grupo === l[i].grupo ? k : -1)).filter((k) => k >= 0);
        const alvo = doGrupo[doGrupo.indexOf(i) + delta];
        if (alvo === undefined) return l;
        const nova = [...l];
        [nova[i], nova[alvo]] = [nova[alvo], nova[i]];
        return nova;
      }),
    /** Leva o item para o fim de outro grupo. */
    moverParaGrupo: (chave: string, grupo: string) =>
      alterar((l) => {
        const item = l.find((x) => x.chave === chave);
        if (!item || item.grupo === grupo) return l;
        const resto = l.filter((x) => x.chave !== chave);
        const ultimo = resto.map((x) => x.grupo).lastIndexOf(grupo);
        const movido = { ...item, grupo };
        return ultimo < 0 ? [...resto, movido] : [...resto.slice(0, ultimo + 1), movido, ...resto.slice(ultimo + 1)];
      }),
    moverGrupo: (grupo: string, delta: -1 | 1) =>
      alterar((l) => {
        const ordem = [...new Set(l.map((i) => i.grupo))];
        const i = ordem.indexOf(grupo);
        const j = i + delta;
        if (i < 0 || j < 0 || j >= ordem.length) return l;
        [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
        return agrupar(l, ordem);
      }),
    /** Devolve a mensagem de erro (nome vazio ou repetido) ou undefined se renomeou. */
    renomearGrupo: (antigo: string, novo: string): string | undefined => {
      const nome = novo.replace(/\s+/g, " ").trim();
      if (!nome) return "Dê um nome ao grupo.";
      if (nome === antigo) return undefined;
      if (grupos.some((g) => g !== antigo && mesmoNome(g, nome))) return "Já existe um grupo com esse nome.";
      alterar((l) => l.map((i) => (i.grupo === antigo ? { ...i, grupo: nome } : i)));
      return undefined;
    },
    adicionar: (grupo: string, nome: string) =>
      alterar((l) => {
        const ultimo = l.map((x) => x.grupo).lastIndexOf(grupo);
        const item = { chave: novaChave(), id: "", grupo, nome, ativo: true };
        return ultimo < 0 ? [...l, item] : [...l.slice(0, ultimo + 1), item, ...l.slice(ultimo + 1)];
      }),
    /** Só item novo (ainda sem id): os já salvos se desativam, para não sumir do histórico das OS. */
    remover: (chave: string) => alterar((l) => l.filter((i) => i.chave !== chave || i.id)),
    descartar: () => {
      setLista(inicial());
      setErro(undefined);
      setOk(undefined);
    },
    async salvar(): Promise<boolean> {
      setErro(undefined);
      setOk(undefined);
      const r = await acoes.salvarChecklistConfig
        .mutateAsync([lista.map(({ id, grupo, nome, ativo }) => ({ id, grupo: grupo.trim(), nome: nome.trim(), ativo }))])
        .catch(() => ({ ok: false, codigo: undefined }));
      if (!r.ok) {
        setErro(mensagemErro(r.codigo));
        return false;
      }
      setOk("Checklist salvo. Vale para as próximas entradas.");
      return true;
    },
  };
}

export type EditorChecklistEstado = ReturnType<typeof useEditorChecklist>;

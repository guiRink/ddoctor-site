import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { ChecklistItem } from "@compartilhado/tipos";
import { useEditorChecklist } from "./editorChecklist";

const itens: ChecklistItem[] = [
  { id: "a", grupo: "Documentos", nome: "CRLV", ativo: true },
  { id: "b", grupo: "Documentos", nome: "Chave", ativo: true },
  { id: "c", grupo: "Série", nome: "Estepe", ativo: true },
];

function montar() {
  const qc = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return renderHook(() => useEditorChecklist(itens), { wrapper }).result;
}

describe("editor do checklist", () => {
  it("renomeia grupo (recusa vazio e repetido) sem trocar os ids", () => {
    const r = montar();
    expect(r.current.renomearGrupo("Documentos", "  ")).toBe("Dê um nome ao grupo.");
    expect(r.current.renomearGrupo("Documentos", "série")).toBe("Já existe um grupo com esse nome.");
    act(() => void r.current.renomearGrupo("Documentos", "Documentos e chaves"));
    expect(r.current.grupos).toEqual(["Documentos e chaves", "Série"]);
    expect(r.current.lista.map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(r.current.alterado).toBe(true);
  });

  it("move item para o fim de outro grupo e reordena grupos", () => {
    const r = montar();
    act(() => r.current.moverParaGrupo("a", "Série"));
    expect(r.current.lista.map((i) => `${i.grupo}:${i.id}`)).toEqual(["Documentos:b", "Série:c", "Série:a"]);
    act(() => r.current.moverGrupo("Série", -1));
    expect(r.current.grupos).toEqual(["Série", "Documentos"]);
    expect(r.current.lista.map((i) => i.id)).toEqual(["c", "a", "b"]);
  });

  it("remove só item novo; descartar volta ao salvo", () => {
    const r = montar();
    act(() => r.current.adicionar("Série", "Macaco"));
    const novo = r.current.lista.find((i) => !i.id)!;
    act(() => r.current.remover("a"));
    expect(r.current.lista).toHaveLength(4);
    act(() => r.current.remover(novo.chave));
    expect(r.current.lista).toHaveLength(3);
    act(() => r.current.mudar("a", { ativo: false }));
    act(() => r.current.descartar());
    expect(r.current.alterado).toBe(false);
  });
});

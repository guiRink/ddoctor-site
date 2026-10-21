import { describe, expect, it } from "vitest";
import { CHAVE_DEMO, escolherModo, lerPedidoDemo, modoDados, temBanco } from "./modo";
import { criarRepositorio } from "./fabrica";
import { repositorioMemoria } from "./repositorioMemoria";
import { supabaseFalso } from "./supabaseFalso";

const BANCO = { dados: "supabase", url: "https://exemplo.supabase.co", chave: "chave-publica" };

function armazenamento() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

describe("escolha do modo de dados", () => {
  it("supabase só com VITE_DADOS=supabase, URL e chave", () => {
    expect(escolherModo(BANCO)).toBe("supabase");
    expect(escolherModo({ ...BANCO, url: "" })).toBe("memoria");
    expect(escolherModo({ ...BANCO, chave: undefined })).toBe("memoria");
    expect(escolherModo({ ...BANCO, dados: "memoria" })).toBe("memoria");
    expect(escolherModo({})).toBe("memoria");
  });

  it("?demo=1 força a demonstração mesmo com banco", () => {
    expect(escolherModo({ ...BANCO, demo: true })).toBe("memoria");
    expect(temBanco(BANCO)).toBe(true);
    expect(temBanco({ dados: "memoria" })).toBe(false);
  });

  it("?demo=1 fica guardado na aba; ?demo=0 apaga", () => {
    const a = armazenamento();
    expect(lerPedidoDemo("?demo=1", a)).toBe(true);
    expect(a.m.get(CHAVE_DEMO)).toBe("1");
    expect(lerPedidoDemo("", a)).toBe(true); // recarregou sem o parâmetro: continua na demonstração
    expect(lerPedidoDemo("?demo=0", a)).toBe(false);
    expect(a.m.has(CHAVE_DEMO)).toBe(false);
    expect(lerPedidoDemo("", a)).toBe(false);
  });

  it("?dev=1 (desenvolvimento) liga a demonstração; sem armazenamento vale só o parâmetro", () => {
    expect(lerPedidoDemo("", armazenamento(), true)).toBe(true);
    expect(lerPedidoDemo("?demo=1", null)).toBe(true);
    expect(lerPedidoDemo("", null)).toBe(false);
  });

  it("os testes rodam sempre na demonstração", () => {
    expect(modoDados()).toBe("memoria");
  });
});

describe("fábrica do repositório", () => {
  it("memória → o repositório da demonstração, sem tocar no Supabase", () => {
    let chamou = false;
    const repo = criarRepositorio("memoria", () => {
      chamou = true;
      return supabaseFalso().cliente;
    });
    expect(repo).toBe(repositorioMemoria);
    expect(chamou).toBe(false);
  });

  it("supabase → repositório sobre o cliente (lê pelo cliente)", async () => {
    const { cliente, falso } = supabaseFalso({ tabelas: { tipo_reparo: { data: [{ id: "t1", nome: "Martelinho", etapas: [], provisorio: true, ativo: true, ordem: 1 }], error: null } } });
    const repo = criarRepositorio("supabase", () => cliente);
    expect(repo).not.toBe(repositorioMemoria);
    expect(await repo.listarTiposReparo()).toEqual([{ id: "t1", nome: "Martelinho", etapas: [], provisorio: true }]);
    expect(falso.from).toHaveBeenCalledWith("tipo_reparo");
  });
});

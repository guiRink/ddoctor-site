import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Resiliência da preparação das fotos locais (revisão QA do SF): a cadeia `resolverFotos` é compartilhada
// por todas as leituras; uma falha no IndexedDB ou no blob não pode derrubar o painel inteiro.

const CHAVE = "ddoctor.demo.v3";
const imagem = () => new Blob([new Uint8Array(100)], { type: "image/webp" });

/** Grava no localStorage um demo com fotos locais ("idb:") que ainda não têm blob: URL nesta aba. */
async function demoComFotosLocais(ids: string[]) {
  const { repositorioMemoria } = await import("./repositorioMemoria");
  await repositorioMemoria.restaurarDemo();
  const estado = JSON.parse(localStorage.getItem(CHAVE)!);
  const osId: string = estado.oss[0].id;
  for (const id of ids) estado.fotos.push({ id, osId, fase: "entrada", url: `idb:${id}`, origem: "interna", tiradaEm: estado.geradoEm });
  localStorage.setItem(CHAVE, JSON.stringify(estado));
  return osId;
}

describe("repositório em memória — fotos locais com falha", () => {
  const criarOriginal = URL.createObjectURL;
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.doUnmock("./fotosLocais");
    Object.assign(URL, { createObjectURL: criarOriginal });
    vi.restoreAllMocks();
  });

  it("limpeza de órfãs e leitura de blob que rejeitam não derrubam as leituras; a foto fica indisponível", async () => {
    const osId = await demoComFotosLocais(["f-boa", "f-quebrada"]);
    vi.resetModules();
    vi.doMock("./fotosLocais", async (original) => ({
      ...(await original<typeof import("./fotosLocais")>()),
      apagarOrfaos: vi.fn(() => Promise.reject(new Error("IndexedDB fora"))),
      lerBlobs: vi.fn((id: string) => (id === "f-quebrada" ? Promise.reject(new Error("blob corrompido")) : Promise.resolve({ arquivo: imagem(), miniatura: imagem() }))),
    }));
    let n = 0;
    Object.assign(URL, { createObjectURL: vi.fn(() => `blob:teste/${++n}`) });
    const { repositorioMemoria: repo } = await import("./repositorioMemoria");

    const fotos = (await repo.obterOS(osId))!.fotos;
    expect(fotos.find((f) => f.id === "f-boa")?.url).toMatch(/^blob:teste\//);
    expect(fotos.find((f) => f.id === "f-quebrada")?.url).toBe("");
    // as leituras seguintes continuam funcionando
    expect((await repo.listarOS()).length).toBeGreaterThan(0);
    expect(await repo.obterOS(osId)).not.toBeNull();
  });

  it("createObjectURL que lança: a foto sai com url vazia e o resto da leitura segue", async () => {
    const osId = await demoComFotosLocais(["f-a", "f-b"]);
    vi.resetModules();
    vi.doMock("./fotosLocais", async (original) => ({
      ...(await original<typeof import("./fotosLocais")>()),
      apagarOrfaos: vi.fn(() => Promise.resolve()),
      lerBlobs: vi.fn(() => Promise.resolve({ arquivo: imagem(), miniatura: imagem() })),
    }));
    let n = 0;
    Object.assign(URL, {
      createObjectURL: vi.fn(() => {
        n++;
        if (n <= 2) throw new Error("sem memória"); // as duas URLs da primeira foto
        return `blob:teste/${n}`;
      }),
    });
    const { repositorioMemoria: repo } = await import("./repositorioMemoria");

    const fotos = (await repo.obterOS(osId))!.fotos;
    const [a, b] = ["f-a", "f-b"].map((id) => fotos.find((f) => f.id === id)!);
    expect(a.url).toBe("");
    expect(a.miniaturaUrl).toBe("");
    expect(b.url).toMatch(/^blob:teste\//);
    expect((await repo.listarOS()).length).toBeGreaterThan(0);
  });
});

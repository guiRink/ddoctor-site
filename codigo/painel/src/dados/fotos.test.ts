import { describe, expect, it } from "vitest";
import { COMPRESSAO_FOTO } from "@compartilhado/dominio/fotos";
import { ErroFoto, PASSOS_COMPRESSAO, codificarAteCaber, comprimirFoto, type PassoCompressao } from "./fotos";

// jsdom não decodifica imagem nem tem canvas: aqui só as recusas antes da decodificação.
describe("comprimirFoto", () => {
  it("recusa o que não é imagem e arquivo vazio", async () => {
    await expect(comprimirFoto(new Blob(["%PDF"], { type: "application/pdf" }))).rejects.toMatchObject({ codigo: "arquivo_invalido" });
    await expect(comprimirFoto(new Blob([], { type: "image/jpeg" }))).rejects.toBeInstanceOf(ErroFoto);
  });

  it("recusa original acima de 25 MB", async () => {
    const grande = new Blob([new Uint8Array(25 * 1024 * 1024 + 1)], { type: "image/jpeg" });
    await expect(comprimirFoto(grande)).rejects.toMatchObject({ codigo: "arquivo_grande" });
  });
});

describe("codificarAteCaber (limite de 2 MB do bucket)", () => {
  const MB = 1024 * 1024;
  const blob = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: "image/webp" });

  it("os passos começam no padrão, só pioram e o primeiro limite é o do bucket", () => {
    expect(COMPRESSAO_FOTO.maxBytesSalva).toBe(2 * MB);
    expect(PASSOS_COMPRESSAO[0]).toEqual({ ladoMaior: COMPRESSAO_FOTO.ladoMaior, qualidade: COMPRESSAO_FOTO.qualidade });
    for (let i = 1; i < PASSOS_COMPRESSAO.length; i++) {
      const [a, b] = [PASSOS_COMPRESSAO[i - 1], PASSOS_COMPRESSAO[i]];
      expect(b.ladoMaior < a.ladoMaior || (b.ladoMaior === a.ladoMaior && b.qualidade < a.qualidade)).toBe(true);
    }
  });

  it("foto comum cabe na primeira tentativa", async () => {
    const usados: PassoCompressao[] = [];
    const r = await codificarAteCaber(async (p) => (usados.push(p), blob(200 * 1024)));
    expect(usados).toHaveLength(1);
    expect(r.passo).toEqual(PASSOS_COMPRESSAO[0]);
  });

  it("acima de 2 MB: reduz qualidade e tamanho em passos até caber", async () => {
    // tamanho cai com o lado² e a qualidade, como num codificador real
    const tamanho = (p: PassoCompressao) => Math.round(5 * MB * (p.ladoMaior / 1600) ** 2 * p.qualidade);
    const usados: PassoCompressao[] = [];
    const r = await codificarAteCaber(async (p) => (usados.push(p), blob(tamanho(p))));
    expect(r.blob.size).toBeLessThanOrEqual(COMPRESSAO_FOTO.maxBytesSalva);
    expect(usados.length).toBeGreaterThan(1);
    for (const p of usados.slice(0, -1)) expect(tamanho(p)).toBeGreaterThan(COMPRESSAO_FOTO.maxBytesSalva);
  });

  it("exatamente 2 MB passa; nada coube → foto_acima_limite", async () => {
    expect((await codificarAteCaber(async () => blob(2 * MB))).blob.size).toBe(2 * MB);
    await expect(codificarAteCaber(async () => blob(2 * MB + 1))).rejects.toMatchObject({ codigo: "foto_acima_limite" });
  });
});

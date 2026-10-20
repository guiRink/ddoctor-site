import { describe, expect, it } from "vitest";
import { ErroFoto, comprimirFoto } from "./fotos";

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

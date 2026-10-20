import { COMPRESSAO_FOTO } from "@compartilhado/dominio/fotos";

/**
 * Compressão de fotos no aparelho (L38): a foto da câmera (3–8 MB) vira ~200 KB + miniatura ~20 KB antes
 * de sair do celular. Uso na tela:
 *
 *   try { const f = await comprimirFoto(arquivo); acoes.adicionarFoto.mutateAsync([osId, { fase, etapaId, ...f }]); }
 *   catch (e) { mensagemErro(e instanceof ErroFoto ? e.codigo : undefined); }
 */
export interface FotoComprimida {
  arquivo: Blob;
  miniatura: Blob;
  largura: number;
  altura: number;
  bytes: number; // tamanho de `arquivo`
}

/** Falha da compressão com código de ERRO (rotulos.ts): arquivo_invalido | arquivo_grande. */
export class ErroFoto extends Error {
  readonly codigo: "arquivo_invalido" | "arquivo_grande";
  constructor(codigo: "arquivo_invalido" | "arquivo_grande") {
    super(codigo);
    this.name = "ErroFoto";
    this.codigo = codigo;
  }
}

type Fonte = { imagem: CanvasImageSource; largura: number; altura: number; liberar: () => void };

/** Decodifica respeitando a orientação EXIF (foto "deitada" do celular sai em pé). */
async function decodificar(arquivo: Blob): Promise<Fonte> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
      return { imagem: bmp, largura: bmp.width, altura: bmp.height, liberar: () => bmp.close() };
    } catch {
      /* navegador sem suporte ao formato/opção: tenta pelo <img> */
    }
  }
  if (typeof Image === "undefined" || typeof URL.createObjectURL !== "function") throw new ErroFoto("arquivo_invalido");
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((ok, erro) => {
      // formato que o navegador não abre às vezes não dispara nem load nem error: desiste em 20 s
      const limite = setTimeout(() => erro(new ErroFoto("arquivo_invalido")), 20_000);
      img.onload = () => (clearTimeout(limite), ok());
      img.onerror = () => (clearTimeout(limite), erro(new ErroFoto("arquivo_invalido")));
      img.src = url;
    });
    // o <img> aplica a orientação EXIF por padrão (image-orientation: from-image)
    return { imagem: img, largura: img.naturalWidth, altura: img.naturalHeight, liberar: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e instanceof ErroFoto ? e : new ErroFoto("arquivo_invalido");
  }
}

function medidas(largura: number, altura: number, ladoMaior: number) {
  const escala = Math.min(1, ladoMaior / Math.max(largura, altura));
  return { largura: Math.max(1, Math.round(largura * escala)), altura: Math.max(1, Math.round(altura * escala)) };
}

type Tela = HTMLCanvasElement | OffscreenCanvas;

function desenhar(fonte: CanvasImageSource, largura: number, altura: number): Tela {
  const tela: Tela =
    typeof OffscreenCanvas === "function" ? new OffscreenCanvas(largura, altura) : Object.assign(document.createElement("canvas"), { width: largura, height: altura });
  const ctx = tela.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new ErroFoto("arquivo_invalido");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(fonte, 0, 0, largura, altura);
  return tela;
}

async function codificar(tela: Tela, tipo: string, qualidade: number): Promise<Blob | null> {
  if ("convertToBlob" in tela) {
    try {
      return await tela.convertToBlob({ type: tipo, quality: qualidade });
    } catch {
      return null;
    }
  }
  return new Promise((ok) => tela.toBlob((b) => ok(b), tipo, qualidade));
}

/** WebP; se o navegador não gera WebP (Safari devolve PNG), JPEG. */
async function paraBlob(tela: Tela, qualidade: number): Promise<Blob> {
  const webp = await codificar(tela, "image/webp", qualidade);
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await codificar(tela, "image/jpeg", qualidade);
  if (!jpeg) throw new ErroFoto("arquivo_invalido");
  return jpeg;
}

/**
 * Comprime a foto: lado maior 1600 px em WebP ~0,75 (JPEG se não houver WebP) e miniatura de 320 px ~0,6.
 * Recusa o que não é imagem (arquivo_invalido) e originais acima de 25 MB (arquivo_grande).
 */
export async function comprimirFoto(arquivo: File | Blob): Promise<FotoComprimida> {
  // tipo vazio acontece em alguns Android: tenta decodificar mesmo assim
  if (arquivo.type && !arquivo.type.startsWith("image/")) throw new ErroFoto("arquivo_invalido");
  if (arquivo.size === 0) throw new ErroFoto("arquivo_invalido");
  if (arquivo.size > COMPRESSAO_FOTO.maxBytesOriginal) throw new ErroFoto("arquivo_grande");

  const fonte = await decodificar(arquivo);
  try {
    if (!fonte.largura || !fonte.altura) throw new ErroFoto("arquivo_invalido");
    const grande = medidas(fonte.largura, fonte.altura, COMPRESSAO_FOTO.ladoMaior);
    const telaGrande = desenhar(fonte.imagem, grande.largura, grande.altura);
    const pequena = medidas(grande.largura, grande.altura, COMPRESSAO_FOTO.ladoMiniatura);
    // a miniatura sai da imagem já reduzida: menos memória e redução em dois passos (mais nítida)
    const telaPequena = desenhar(telaGrande, pequena.largura, pequena.altura);
    const [foto, miniatura] = await Promise.all([
      paraBlob(telaGrande, COMPRESSAO_FOTO.qualidade),
      paraBlob(telaPequena, COMPRESSAO_FOTO.qualidadeMiniatura),
    ]);
    return { arquivo: foto, miniatura, largura: grande.largura, altura: grande.altura, bytes: foto.size };
  } finally {
    fonte.liberar();
  }
}

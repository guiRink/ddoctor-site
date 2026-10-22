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

/**
 * Falha da compressão com código de ERRO (rotulos.ts): arquivo_invalido | arquivo_grande (original acima de 25 MB) |
 * foto_acima_limite (nem a menor tentativa coube nos 2 MB do bucket).
 */
export type CodigoErroFoto = "arquivo_invalido" | "arquivo_grande" | "foto_acima_limite";
export class ErroFoto extends Error {
  readonly codigo: CodigoErroFoto;
  constructor(codigo: CodigoErroFoto) {
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

/** Uma tentativa de compressão: lado maior em px e qualidade (0–1). */
export interface PassoCompressao {
  ladoMaior: number;
  qualidade: number;
}

/**
 * Tentativas em ordem, da melhor para a menor (sprint S1: o bucket "fotos" recusa acima de 2 MB). A primeira é a
 * padrão (1600 px, 0,75); se o arquivo passar do limite, a qualidade cai antes e depois o tamanho. Foto comum de
 * celular cabe já na primeira (~200 KB); as outras só existem para foto cheia de detalhe ou navegador sem WebP.
 */
export const PASSOS_COMPRESSAO: readonly PassoCompressao[] = [
  { ladoMaior: COMPRESSAO_FOTO.ladoMaior, qualidade: COMPRESSAO_FOTO.qualidade },
  { ladoMaior: COMPRESSAO_FOTO.ladoMaior, qualidade: 0.6 },
  { ladoMaior: COMPRESSAO_FOTO.ladoMaior, qualidade: 0.45 },
  { ladoMaior: 1280, qualidade: 0.6 },
  { ladoMaior: 1280, qualidade: 0.45 },
  { ladoMaior: 1024, qualidade: 0.45 },
  { ladoMaior: 800, qualidade: 0.4 },
];

/**
 * Codifica passo a passo até o arquivo caber em `limite` bytes; devolve o primeiro que coube e o passo usado.
 * Nenhum coube: ErroFoto("foto_acima_limite"). `codificar` é injetado (o teste não tem canvas).
 */
export async function codificarAteCaber(
  codificar: (passo: PassoCompressao) => Promise<Blob>,
  limite: number = COMPRESSAO_FOTO.maxBytesSalva,
  passos: readonly PassoCompressao[] = PASSOS_COMPRESSAO,
): Promise<{ blob: Blob; passo: PassoCompressao }> {
  for (const passo of passos) {
    const blob = await codificar(passo);
    if (blob.size > 0 && blob.size <= limite) return { blob, passo };
  }
  throw new ErroFoto("foto_acima_limite");
}

/**
 * Comprime a foto: lado maior 1600 px em WebP ~0,75 (JPEG se não houver WebP) e miniatura de 320 px ~0,6.
 * Nunca devolve arquivo acima de 2 MB (COMPRESSAO_FOTO.maxBytesSalva = limite do bucket): reduz em passos
 * (PASSOS_COMPRESSAO) e, se nem o menor couber, recusa com foto_acima_limite.
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
    // a foto: qualidade e tamanho caem em passos até caber no limite do bucket (2 MB); cada lado é desenhado uma vez
    const telas = new Map<number, { tela: Tela; largura: number; altura: number }>([[COMPRESSAO_FOTO.ladoMaior, { tela: telaGrande, ...grande }]]);
    const telaDoLado = (lado: number) => {
      let t = telas.get(lado);
      if (!t) {
        const m = medidas(grande.largura, grande.altura, lado);
        t = { tela: desenhar(telaGrande, m.largura, m.altura), ...m };
        telas.set(lado, t);
      }
      return t;
    };
    const [{ blob: foto, passo }, miniatura] = await Promise.all([
      codificarAteCaber((p) => paraBlob(telaDoLado(p.ladoMaior).tela, p.qualidade)),
      paraBlob(telaPequena, COMPRESSAO_FOTO.qualidadeMiniatura),
    ]);
    if (miniatura.size > COMPRESSAO_FOTO.maxBytesSalva) throw new ErroFoto("foto_acima_limite");
    const final = telaDoLado(passo.ladoMaior);
    return { arquivo: foto, miniatura, largura: final.largura, altura: final.altura, bytes: foto.size };
  } finally {
    fonte.liberar();
  }
}

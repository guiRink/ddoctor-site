import { useCallback, useEffect, useState } from "react";
import type { OSVisao } from "../../dados/repositorio";
import { montarDocumento, type DocumentoOrcamento } from "./documento";
import { carregarPdf, gerarPdfOrcamento, type ConstrutorPdf } from "./pdf";

export type ResultadoEnvio = "baixado" | "compartilhado" | "cancelado";

/** O aparelho sabe compartilhar arquivo PDF (folha do sistema: WhatsApp, e-mail…)? */
export function aparelhoCompartilhaPdf(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [new File(["%PDF-"], "teste.pdf", { type: "application/pdf" })] });
  } catch {
    return false;
  }
}

/** Baixa o arquivo pelo navegador (link temporário com `download`). */
export function baixarArquivo(arquivo: File) {
  const url = URL.createObjectURL(arquivo);
  const a = document.createElement("a");
  a.href = url;
  a.download = arquivo.name;
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * PDF do orçamento sob demanda: carrega o jsPDF ao montar (chunk separado) e gera o arquivo na hora do
 * clique, de forma síncrona — o navigator.share só funciona dentro do gesto do usuário (Safari/iOS).
 */
export function useEnvioOrcamento(v: OSVisao | null | undefined) {
  const [construtor, setConstrutor] = useState<ConstrutorPdf | null>(null);
  const [erroCarga, setErroCarga] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [compartilha] = useState(aparelhoCompartilhaPdf);

  useEffect(() => {
    let vivo = true;
    carregarPdf()
      .then((c) => {
        if (vivo) setConstrutor(() => c);
      })
      .catch(() => {
        if (vivo) setErroCarga(true);
      });
    return () => {
      vivo = false;
    };
  }, [tentativa]);

  const tentarDeNovo = useCallback(() => {
    setErroCarga(false);
    setTentativa((n) => n + 1);
  }, []);

  /** Monta o documento (emitido agora) e gera o arquivo. */
  const gerar = useCallback(
    (observacao?: string): { arquivo: File; documento: DocumentoOrcamento } => {
      if (!construtor || !v) throw new Error("pdf_indisponivel");
      const documento = montarDocumento(v, new Date().toISOString(), observacao);
      const blob = gerarPdfOrcamento(construtor, documento);
      return { arquivo: new File([blob], documento.nomeArquivo, { type: "application/pdf" }), documento };
    },
    [construtor, v],
  );

  const baixar = useCallback(
    (observacao?: string): "baixado" => {
      baixarArquivo(gerar(observacao).arquivo);
      return "baixado";
    },
    [gerar],
  );

  /** Abre a folha de compartilhar do aparelho com o PDF; sem suporte para arquivo, baixa. */
  const compartilhar = useCallback(
    async (texto: string, observacao?: string): Promise<ResultadoEnvio> => {
      const { arquivo, documento } = gerar(observacao);
      if (!navigator.canShare?.({ files: [arquivo] })) {
        baixarArquivo(arquivo);
        return "baixado";
      }
      try {
        await navigator.share({ files: [arquivo], title: documento.titulo, text: texto });
        return "compartilhado";
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return "cancelado";
        throw e;
      }
    },
    [gerar],
  );

  return { pronto: Boolean(construtor && v), erroCarga, tentarDeNovo, compartilha, baixar, compartilhar };
}

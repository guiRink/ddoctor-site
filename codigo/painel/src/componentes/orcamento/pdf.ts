// PDF do orçamento (A4 retrato, texto vetorial) — mesmo espírito da folha impressa (ImprimirOS):
// marca à esquerda, título e números à direita, régua preta, seções separadas por linha fina, total em negrito.
// O jsPDF é carregado sob demanda (chunk separado): `carregarPdf()` antes, `gerarPdfOrcamento()` síncrono
// depois — o "Compartilhar" precisa chamar navigator.share ainda dentro do clique do usuário.
import type { jsPDF as JsPDFTipo } from "jspdf";
import type { DocumentoOrcamento } from "./documento";

export type ConstrutorPdf = typeof JsPDFTipo;

let carregando: Promise<ConstrutorPdf> | null = null;

/** Importa o jsPDF uma vez (fica em cache); em falha, a próxima chamada tenta de novo. */
export function carregarPdf(): Promise<ConstrutorPdf> {
  carregando ??= import("jspdf")
    .then((m) => m.jsPDF)
    .catch((e: unknown) => {
      carregando = null;
      throw e;
    });
  return carregando;
}

// Cores do desenho (fixas: o papel é sempre claro, como a impressão)
const COR = {
  tinta: "#111111",
  suave: "#6B6B6B",
  fraca: "#8C8C87",
  linha: "#E7E5E0",
  linhaForte: "#D5D3CD",
  amarelo: "#F2C200",
  azulPlaca: "#2F4A7A",
  branco: "#FFFFFF",
} as const;

const PAGINA = { largura: 210, altura: 297, margem: 16, rodape: 14 } as const;
const PT_MM = 0.3528; // 1 pt em mm

// A Helvetica padrão do PDF usa WinAnsi: Latin-1 + alguns sinais (— – … “ ” ‘ ’ • €). O resto vira equivalente.
const WINANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
const TROCAS: Record<string, string> = { "−": "-", "‐": "-", "‑": "-", " ": " ", " ": " ", " ": " ", "→": "->" };

/** Texto seguro para a fonte padrão (acentos do português passam inteiros). */
export function textoPdf(s: string): string {
  let r = "";
  for (const c of s.normalize("NFC")) {
    const cod = c.codePointAt(0) ?? 0;
    if (TROCAS[c] !== undefined) r += TROCAS[c];
    else if ((cod >= 0x20 && cod <= 0x7e) || (cod >= 0xa0 && cod <= 0xff) || WINANSI_EXTRA.has(c) || c === "\n") r += c;
    else if (/\s/.test(c)) r += " ";
  }
  return r;
}

export function gerarPdfOrcamento(JsPDF: ConstrutorPdf, d: DocumentoOrcamento): Blob {
  const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  doc.setProperties({ title: textoPdf(d.titulo), subject: "Orçamento", creator: "Painel D doctor", author: "D doctor" });
  doc.setLanguage?.("pt-BR");

  const { margem: M, largura: W } = PAGINA;
  const direita = W - M;
  const util = W - 2 * M;
  const limite = PAGINA.altura - M - PAGINA.rodape;
  let y = M;

  const fonte = (tamanho: number, peso: "normal" | "bold" = "normal", cor: string = COR.tinta) => {
    doc.setFont("helvetica", peso);
    doc.setFontSize(tamanho);
    doc.setTextColor(cor);
  };
  const escrever = (s: string, x: number, yy: number, opc?: { align?: "left" | "right" | "center"; maxWidth?: number }) => doc.text(textoPdf(s), x, yy, opc);
  const quebrar = (s: string, largura: number): string[] => doc.splitTextToSize(textoPdf(s), largura) as string[];
  const altLinha = (tamanho: number, fator = 1.3) => tamanho * PT_MM * fator;
  const linha = (x1: number, yy: number, x2: number, cor: string = COR.linha, espessura = 0.25) => {
    doc.setDrawColor(cor);
    doc.setLineWidth(espessura);
    doc.line(x1, yy, x2, yy);
  };
  /** Nova página quando o bloco não cabe; devolve true se quebrou. */
  const caber = (altura: number): boolean => {
    if (y + altura <= limite) return false;
    doc.addPage();
    y = M;
    return true;
  };

  // ---------------------------------------------------------------- cabeçalho
  marca(doc, M, y, 12);
  fonte(16, "bold");
  escrever("D doctor", M + 15, y + 5.4);
  fonte(9.5, "normal", COR.suave);
  escrever("martelinho de ouro", M + 15, y + 10.2);

  fonte(16, "bold");
  escrever("Orçamento", direita, y + 5.4, { align: "right" });
  fonte(9.5, "normal");
  const numeros = `OS nº ${d.osNumero}${d.versaoNumero ? ` · versão ${d.versaoNumero}` : ""}`;
  escrever(numeros, direita, y + 10.2, { align: "right" });
  fonte(9, "normal", COR.suave);
  escrever(`Emitido em ${d.emitido}`, direita, y + 14.6, { align: "right" });
  // Validade só sai no PDF do cliente depois que o dono confirmar o prazo (hoje é provisório).
  const prazo = d.aprovado;
  if (prazo) escrever(prazo, direita, y + 18.8, { align: "right" });
  y += prazo ? 22.5 : 18.5;
  linha(M, y, direita, COR.tinta, 0.6);
  y += 7;

  // ---------------------------------------------------------------- cliente e veículo (duas colunas)
  const colW = (util - 10) / 2;
  const xVeic = M + colW + 10;
  const topo = y;
  fonte(10.5, "bold");
  escrever("Cliente", M, y);
  escrever("Veículo", xVeic, y);

  const pares: [string, string][] = [["Nome", d.cliente.nome]];
  if (d.cliente.documento) pares.push([d.cliente.documento.rotulo, d.cliente.documento.valor]);
  if (d.cliente.contato) pares.push(["Contato", d.cliente.contato]);
  if (d.cliente.email) pares.push(["E-mail", d.cliente.email]);
  if (d.seguro) pares.push(["Seguradora", d.seguro.seguradora + (d.seguro.sinistro ? ` · sinistro ${d.seguro.sinistro}` : "")]);

  let yc = topo + 6;
  const rotW = 24;
  for (const [nome, valor] of pares) {
    fonte(9.5, "normal", COR.suave);
    escrever(nome, M, yc);
    fonte(10, "normal");
    const l = quebrar(valor, colW - rotW);
    doc.text(l, M + rotW, yc);
    yc += l.length * altLinha(10) + 1.4;
  }

  // veículo: placa desenhada + modelo
  let yv = topo + 2.5;
  placa(doc, xVeic, yv, d.veiculo.placaBruta, d.veiculo.placa);
  const xTexto = xVeic + 38;
  fonte(10.5, "bold");
  const modelo = quebrar(d.veiculo.modelo, colW - 38);
  doc.text(modelo, xTexto, yv + 4);
  yv += 4 + modelo.length * altLinha(10.5);
  if (d.veiculo.corAno) {
    fonte(9.5, "normal", COR.suave);
    escrever(d.veiculo.corAno, xTexto, yv + 0.6);
    yv += altLinha(9.5);
  }
  y = Math.max(yc, topo + 18, yv + 4) + 2;
  linha(M, y, direita);
  y += 8;

  // ---------------------------------------------------------------- itens
  fonte(10.5, "bold");
  escrever("Serviços", M, y);
  y += 5;

  const colValor = 30;
  const colSituacao = d.externo ? 28 : 0;
  const colTecnica = 34;
  const colNum = 8;
  const xNum = M;
  const xPeca = M + colNum;
  const xTecnica = direita - colValor - colSituacao - colTecnica;
  const xSituacao = direita - colValor - colSituacao;
  const larguraPeca = xTecnica - xPeca - 4;

  const cabecalhoTabela = () => {
    fonte(8.5, "normal", COR.suave);
    escrever("#", xNum, y + 3.6);
    escrever("Peça", xPeca, y + 3.6);
    escrever("Técnica", xTecnica, y + 3.6);
    if (d.externo) escrever("Situação", xSituacao, y + 3.6);
    escrever("Valor", direita, y + 3.6, { align: "right" });
    y += 5.6;
    linha(M, y, direita, COR.linhaForte, 0.3);
  };

  if (d.itens.length === 0) {
    fonte(10, "normal", COR.suave);
    escrever("Nenhuma peça no orçamento.", M, y + 4);
    y += 9;
  } else {
    cabecalhoTabela();
    for (const it of d.itens) {
      fonte(10, "bold");
      const pecaL = quebrar(it.peca, larguraPeca);
      fonte(8.5);
      const descL = it.descricao ? quebrar(it.descricao, larguraPeca) : [];
      fonte(10);
      const tecL = quebrar(it.tecnica, colTecnica - 3);
      const altura = Math.max(pecaL.length * altLinha(10) + descL.length * altLinha(8.5), tecL.length * altLinha(10)) + 4.4;
      if (caber(altura)) cabecalhoTabela();
      const base = y + 4.6;
      fonte(10, "normal", COR.suave);
      escrever(String(it.numero), xNum, base);
      fonte(10, it.negado ? "normal" : "bold", it.negado ? COR.suave : COR.tinta);
      doc.text(pecaL, xPeca, base);
      if (it.negado) {
        // risco sobre a peça negada (como na folha impressa)
        doc.setDrawColor(COR.suave);
        doc.setLineWidth(0.25);
        pecaL.forEach((l, i) => {
          const yy = base - 1.2 + i * altLinha(10);
          doc.line(xPeca, yy, xPeca + doc.getTextWidth(l), yy);
        });
      }
      if (descL.length) {
        fonte(8.5, "normal", COR.suave);
        doc.text(descL, xPeca, base + pecaL.length * altLinha(10) - 0.6);
      }
      fonte(10, "normal");
      doc.text(tecL, xTecnica, base);
      if (it.situacao) escrever(it.situacao, xSituacao, base);
      escrever(it.valor, direita, base, { align: "right" });
      y += altura;
      linha(M, y, direita);
    }
  }

  // ---------------------------------------------------------------- somas
  if (d.somas.length) {
    const largura = 82;
    const x = direita - largura;
    const altura = d.somas.length * 6.4 + 6;
    caber(altura);
    y += 4;
    for (const s of d.somas) {
      if (s.forte) {
        linha(x, y - 0.4, direita, COR.tinta, 0.35);
        y += 1.6;
      }
      const base = y + 4;
      fonte(s.forte ? 11 : 9.5, s.forte ? "bold" : "normal", s.forte ? COR.tinta : COR.suave);
      escrever(s.nome, x, base);
      fonte(s.forte ? 11.5 : 10, s.forte ? "bold" : "normal");
      escrever(s.valor, direita, base, { align: "right" });
      y += s.forte ? 7 : 6;
    }
    y += 2;
  }

  // ---------------------------------------------------------------- observação para o cliente
  if (d.observacao) {
    fonte(10, "normal");
    const l = quebrar(d.observacao, util);
    caber(14 + Math.min(l.length, 6) * altLinha(10));
    y += 4;
    linha(M, y, direita);
    y += 7;
    fonte(10.5, "bold");
    escrever("Observações", M, y);
    y += 5.5;
    fonte(10, "normal");
    for (const t of l) {
      caber(altLinha(10));
      doc.text(t, M, y);
      y += altLinha(10);
    }
  }

  // ---------------------------------------------------------------- rodapé em todas as páginas
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    const yr = PAGINA.altura - M + 2;
    linha(M, yr - 5, direita);
    fonte(8, "normal", COR.fraca);
    escrever(d.demo ? "Documento gerado pelo painel D doctor · dados de demonstração" : "Documento gerado pelo painel D doctor", M, yr);
    escrever(`OS ${d.osNumero} · ${d.emitido}${paginas > 1 ? ` · página ${p} de ${paginas}` : ""}`, direita, yr, { align: "right" });
  }

  return doc.output("blob");
}

/** Marca: D preto em quadrado amarelo (mesmo desenho do MarcaD: o D ocupa 56 % do quadrado). */
function marca(doc: JsPDFTipo, x: number, y: number, lado: number) {
  doc.setFillColor(COR.amarelo);
  doc.roundedRect(x, y, lado, lado, lado * 0.14, lado * 0.14, "F");
  const g = lado * 0.56;
  const s = g / 80; // o D do SVG tem 80 de lado
  const ox = x + (lado - g) / 2;
  const oy = y + (lado - g) / 2;
  // contorno do D: retângulo 0–42 + meia elipse até 80
  doc.setFillColor(COR.tinta);
  doc.rect(ox, oy, 42 * s, 80 * s, "F");
  doc.ellipse(ox + 42 * s, oy + 40 * s, 38 * s, 40 * s, "F");
  // miolo vazado (pintado de amarelo por cima)
  doc.setFillColor(COR.amarelo);
  doc.rect(ox + 20 * s, oy + 21 * s, 21 * s, 38 * s, "F");
  doc.ellipse(ox + 41 * s, oy + 40 * s, 19 * s, 19 * s, "F");
}

/** Placa Mercosul pequena: corpo branco, faixa azul com "BRASIL", caracteres pretos, borda preta. */
function placa(doc: JsPDFTipo, x: number, y: number, bruta: string, formatada: string) {
  const w = 34;
  const h = 11.5;
  const faixa = 2.6;
  doc.setFillColor(COR.branco);
  doc.setDrawColor(COR.tinta);
  doc.setLineWidth(0.45);
  doc.roundedRect(x, y, w, h, 1, 1, "FD");
  doc.setFillColor(COR.azulPlaca);
  doc.rect(x + 0.35, y + 0.35, w - 0.7, faixa, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.6);
  doc.setTextColor(COR.branco);
  doc.text("BRASIL", x + w / 2, y + 0.35 + faixa / 2 + 0.6, { align: "center" });
  doc.setFontSize(13);
  doc.setTextColor(COR.tinta);
  // a placa real não tem hífen; texto vazio cai no formatado (placa fora do padrão)
  doc.text(textoPdf(bruta || formatada), x + w / 2, y + h - 2.2, { align: "center", charSpace: 0.3 });
}

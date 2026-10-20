import { describe, expect, it } from "vitest";
import type { OrcamentoVersao } from "@compartilhado/tipos";
import type { OSVisao } from "../../dados/repositorio";
import { linkWhatsAppComMensagem, mensagemOrcamento, montarDocumento, nomeArquivoOrcamento, VALIDADE_ORCAMENTO_DIAS } from "./documento";
import { gerarPdfOrcamento, textoPdf } from "./pdf";
import { jsPDF } from "jspdf";

// Fixture inventada (sem dado real): cliente fictício, número fictício.
const AGORA = "2026-10-20T14:30:00-03:00";

function versao(parcial: Partial<OrcamentoVersao>): OrcamentoVersao {
  return {
    id: "ver-1",
    osId: "os-1",
    tipo: "interno",
    numeroVersao: 1,
    fonte: "manual",
    estado: "rascunho",
    criadoEm: AGORA,
    itens: [
      { id: "i1", peca: "Porta dianteira esquerda", tecnica: "martelinho", valor: 45000, statusItem: "solicitado" },
      { id: "i2", peca: "Capô", tecnica: "pintura", valor: 80000, statusItem: "solicitado", descricao: "Retoque com polimento" },
      { id: "i3", peca: "Para-lama", tecnica: "sra", valor: 10000, statusItem: "dispensado" },
    ],
    ...parcial,
  } as OrcamentoVersao;
}

function visao(parcial: Partial<OSVisao> = {}): OSVisao {
  return {
    os: { id: "os-1", numero: 123, estado: "aguardando_aprovacao" },
    veiculo: { id: "vei-1", placa: "ABC1D23", marca: "Honda", modelo: "Civic", cor: "Prata", ano: 2020 },
    cliente: { id: "cli-1", nome: "Conceição Ávila Gonçalves", telefone: "+5541900000000" },
    atendimentos: [],
    versoes: [versao({})],
    etapas: [],
    pendencias: [],
    titulos: [],
    fotos: [],
    custos: [],
    ...parcial,
  } as unknown as OSVisao;
}

describe("documento do orçamento", () => {
  it("total sem aprovação = soma das peças não dispensadas; validade provisória a partir de hoje", () => {
    const d = montarDocumento(visao(), AGORA);
    expect(d.itens).toHaveLength(2);
    expect(d.total).toBe(125000);
    expect(d.somas.find((s) => s.forte)).toEqual({ nome: "Total do orçamento", valor: "R$ 1.250,00", forte: true });
    expect(d.validade).toEqual({ dias: VALIDADE_ORCAMENTO_DIAS, ate: "04/11/2026" });
    expect(d.emitido).toBe("20/10/2026 14:30");
    expect(d.nomeArquivo).toBe("orcamento-ABC1D23-OS123.pdf");
  });

  it("aprovado: total autorizado da receita única, sem validade", () => {
    const ver = versao({
      tipo: "externo",
      estado: "aprovado",
      franquia: 50000,
      complementoParticular: 20000,
      aprovacao: { tipo: "externa", aprovadoEm: "2026-10-18T10:00:00-03:00", confiavel: true },
      itens: [
        { id: "i1", peca: "Porta", tecnica: "martelinho", valor: 45000, statusItem: "autorizado" },
        { id: "i2", peca: "Capô", tecnica: "pintura", valor: 80000, statusItem: "negado" },
      ],
    });
    const d = montarDocumento(visao({ versoes: [ver] }), AGORA);
    expect(d.total).toBe(45000);
    expect(d.validade).toBeUndefined();
    expect(d.aprovado).toBe("Aprovado em 18/10/2026");
    expect(d.itens.map((i) => i.situacao)).toEqual(["Autorizada", "Negada"]);
    expect(d.somas.map((s) => s.nome)).toEqual(["Subtotal", "Não autorizado", "Total autorizado", "Franquia (paga pelo cliente)", "Complemento particular"]);
  });

  it("mensagem curta com primeiro nome, carro, placa e total; link wa.me só para cliente real", () => {
    const v = visao();
    const m = mensagemOrcamento(v, montarDocumento(v, AGORA));
    expect(m).toBe("Olá Conceição, segue o orçamento do Honda Civic (ABC-1D23): total R$ 1.250,00. O PDF vai em anexo.");
    expect(linkWhatsAppComMensagem(v, m)).toBe(`https://wa.me/5541900000000?text=${encodeURIComponent(m)}`);
    expect(linkWhatsAppComMensagem(visao({ cliente: { ...v.cliente, demo: true } }), m)).toBeNull();
    expect(linkWhatsAppComMensagem(visao({ cliente: { id: "c", nome: "Sem Fone" } }), m)).toBeNull();
  });

  it("nome do arquivo usa a placa normalizada", () => {
    expect(nomeArquivoOrcamento("abc-1d23", 7)).toBe("orcamento-ABC1D23-OS7.pdf");
  });
});

describe("PDF do orçamento", () => {
  it("texto seguro para a Helvetica mantém os acentos", () => {
    expect(textoPdf("Ç ã é õ − nº · —")).toBe("Ç ã é õ - nº · —");
    expect(textoPdf("carro 🚗 ok")).toBe("carro  ok");
  });

  it("gera um PDF A4 válido", async () => {
    const v = visao();
    const d = montarDocumento(v, AGORA, "Ç ã é õ — retirar até sexta");
    const blob = gerarPdfOrcamento(jsPDF, d);
    expect(blob.type).toBe("application/pdf");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(2000);
  });
});

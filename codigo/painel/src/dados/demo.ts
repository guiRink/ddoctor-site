import { addDays, formatISO, subDays } from "date-fns";
import type { Atendimento, Etapa, Peca, Tecnica } from "../dominio/tipos";

/**
 * Dados de demonstração para o irmão avaliar as telas antes de existir dado real.
 * Todos marcados `demo: true` e removíveis em Ajustes. Nomes, placas e valores são fictícios;
 * as seguradoras são as que têm produto Maxpar confirmado publicamente (docs/maxpar-estudo.md §1.3).
 */

const hoje = new Date();
const iso = (d: Date) => formatISO(d, { representation: "date" });
const ha = (dias: number) => iso(subDays(hoje, dias));
const em = (dias: number) => iso(addDays(hoje, dias));

let seq = 0;
function peca(nome: string, tecnica: Tecnica, autorizada: boolean | null, valorAutorizado?: number): Peca {
  seq += 1;
  return { id: `demo-p${seq}`, nome, tecnica, solicitada: true, autorizada, valorAutorizado };
}

const docVazia = { fotosAntes: false, fotosDepois: false, pdfOrdem: false, assinatura: false, nf: false, recusas: [] as { data: string; motivo: string }[] };
const docCompleta = { fotosAntes: true, fotosDepois: true, pdfOrdem: true, assinatura: true, nf: true, recusas: [] as { data: string; motivo: string }[] };

interface Base {
  id: string;
  placa: string;
  modelo: string;
  cor: string;
  cliente: string;
  telefone: string;
  etapa: Etapa;
  diasAberto: number;
  diasNaEtapa: number;
  origem?: Atendimento["origem"];
  seguradora?: string;
  protocolo?: string;
  pecas: Peca[];
  extra?: Partial<Atendimento>;
}

function montar(b: Base): Atendimento {
  const abertura = ha(b.diasAberto);
  const etapaDesde = ha(b.diasNaEtapa);
  const autorizado = b.pecas.filter((p) => p.autorizada).reduce((s, p) => s + (p.valorAutorizado ?? 0), 0);
  const origem = b.origem ?? "maxpar";
  return {
    id: b.id,
    protocolo: b.protocolo,
    origem,
    seguradora: b.seguradora,
    produto: origem === "maxpar" ? "Maxassistência de Lataria e Pintura" : undefined,
    placa: b.placa,
    modelo: b.modelo,
    cor: b.cor,
    cliente: { nome: b.cliente, telefone: b.telefone },
    abertura,
    pecas: b.pecas,
    franquia: origem === "particular" ? { paga: false } : { valor: 160, paga: false },
    etapa: b.etapa,
    documentacao: { ...docVazia },
    financeiro: origem === "particular" ? {} : { aReceberMaxpar: autorizado || undefined },
    contatos: [],
    etapaDesde,
    demo: true,
    criadoEm: `${abertura}T09:00:00`,
    atualizadoEm: `${etapaDesde}T09:00:00`,
    ...b.extra,
  };
}

export function gerarDemo(): Atendimento[] {
  seq = 0;
  return [
    montar({
      id: "demo-01", placa: "RHK2C47", modelo: "BMW 320i", cor: "Cinza", cliente: "Marina Albuquerque", telefone: "(41) 99100-0001",
      etapa: "aguardando_autorizacao", diasAberto: 5, diasNaEtapa: 5, seguradora: "Tokio Marine", protocolo: "18402211",
      pecas: [peca("Porta dianteira esquerda", "martelinho", null), peca("Para-lama esquerdo", "martelinho", null)],
      extra: { limiteVistoria: em(1), observacoes: "Segurado disse que o link de vistoria chegou por SMS." },
    }),
    montar({
      id: "demo-02", placa: "RBX7F19", modelo: "Volvo XC60", cor: "Branco", cliente: "Eduardo Taborda", telefone: "(41) 99100-0002",
      etapa: "autorizado", diasAberto: 4, diasNaEtapa: 1, seguradora: "HDI", protocolo: "18398760",
      pecas: [peca("Capô", "martelinho", true, 420), peca("Teto", "martelinho", false), peca("Porta traseira direita", "sra", true, 180)],
      extra: { previsaoPortal: em(4), observacoes: "Teto negado: exige remoção do forro. Oferecer particular." },
    }),
    montar({
      id: "demo-03", placa: "QXT4D88", modelo: "Jeep Compass", cor: "Branco", cliente: "Patrícia Konzen", telefone: "(41) 99100-0003",
      etapa: "aguardando_peca", diasAberto: 9, diasNaEtapa: 6, seguradora: "Liberty", protocolo: "18377102",
      pecas: [peca("Para-choque traseiro", "funilaria", true, 650)],
      extra: { previsaoCliente: em(3), observacoes: "Segurado compra o para-choque (peça por conta dele)." },
    }),
    montar({
      id: "demo-04", placa: "RTO9H02", modelo: "Mercedes C200", cor: "Branco", cliente: "Gustavo Ferreira", telefone: "(41) 99100-0004",
      etapa: "agendado", diasAberto: 6, diasNaEtapa: 2, seguradora: "Zurich", protocolo: "18391544",
      pecas: [peca("Porta dianteira direita", "martelinho", true, 380), peca("Coluna B", "pintura", true, 520)],
      extra: { previsaoCliente: em(2), previsaoPortal: em(2), produto: "Lataria e Pintura Premium" },
    }),
    montar({
      id: "demo-05", placa: "RAV3K61", modelo: "BMW X5", cor: "Grafite", cliente: "Cláudia Mendes", telefone: "(41) 99100-0005",
      etapa: "no_patio", diasAberto: 7, diasNaEtapa: 1, seguradora: "MAPFRE", protocolo: "18389907",
      pecas: [peca("Para-lama direito", "martelinho", true, 360), peca("Porta traseira direita", "martelinho", true, 340)],
      extra: { subEtapa: "martelinho", box: "Baia 1", responsavel: "Diego", previsaoCliente: em(1), previsaoPortal: em(2) },
    }),
    montar({
      id: "demo-06", placa: "RKP1L34", modelo: "Range Rover Sport", cor: "Preto", cliente: "Henrique Salles", telefone: "(41) 99100-0006",
      etapa: "no_patio", diasAberto: 12, diasNaEtapa: 4, origem: "particular",
      pecas: [peca("Capô", "pintura", true, 1400), peca("Para-choque dianteiro", "funilaria", true, 900)],
      extra: { subEtapa: "pintura", box: "Baia 2", responsavel: "Marcos", previsaoCliente: ha(1), complemento: 2300, financeiro: { custoMaterial: 480, comissao: 600 }, observacoes: "Cliente particular; preço cheio (R$ 2.300 combinado)." },
    }),
    montar({
      id: "demo-07", placa: "QPZ6M77", modelo: "Volvo XC90", cor: "Prata", cliente: "Renata Bueno", telefone: "(41) 99100-0007",
      etapa: "no_patio", diasAberto: 5, diasNaEtapa: 2, seguradora: "Bradesco", protocolo: "18395510",
      pecas: [peca("Porta dianteira esquerda", "sra", true, 190), peca("Retrovisor esquerdo", "pintura", true, 260)],
      extra: { subEtapa: "polimento", box: "Baia 3", responsavel: "Diego", previsaoCliente: em(0), previsaoPortal: em(1) },
    }),
    montar({
      id: "demo-08", placa: "RFG5N90", modelo: "BMW Série 4", cor: "Cinza", cliente: "André Pacheco", telefone: "(41) 99100-0008",
      etapa: "pronto", diasAberto: 8, diasNaEtapa: 1, seguradora: "Tokio Marine", protocolo: "18386623",
      pecas: [peca("Para-lama esquerdo", "martelinho", true, 400)],
      extra: { box: "Pátio", previsaoCliente: em(0), franquia: { valor: 160, paga: true, forma: "Pix" } },
    }),
    montar({
      id: "demo-09", placa: "RCD8P15", modelo: "Mercedes GLA", cor: "Vermelho", cliente: "Fernanda Lins", telefone: "(41) 99100-0009",
      etapa: "entregue", diasAberto: 15, diasNaEtapa: 3, seguradora: "HDI", protocolo: "18370018",
      pecas: [peca("Porta traseira esquerda", "martelinho", true, 380), peca("Teto", "martelinho", true, 450)],
      extra: { entregueEm: ha(3), franquia: { valor: 160, paga: true, forma: "Cartão" }, documentacao: { ...docCompleta, nf: false }, financeiro: { aReceberMaxpar: 830, custoMaterial: 40, comissao: 250 } },
    }),
    montar({
      id: "demo-10", placa: "RLM2Q48", modelo: "Jeep Renegade", cor: "Verde", cliente: "Tiago Westphal", telefone: "(41) 99100-0010",
      etapa: "documentacao_enviada", diasAberto: 40, diasNaEtapa: 34, seguradora: "Liberty", protocolo: "18311200",
      pecas: [peca("Capô", "martelinho", true, 420)],
      extra: { entregueEm: ha(35), franquia: { valor: 160, paga: true, forma: "Dinheiro" }, documentacao: { ...docCompleta, enviadaEm: ha(34) }, financeiro: { aReceberMaxpar: 420, comissao: 130 } },
    }),
    montar({
      id: "demo-11", placa: "RJQ7R03", modelo: "BMW X1", cor: "Azul", cliente: "Sônia Machado", telefone: "(41) 99100-0011",
      etapa: "entregue", diasAberto: 22, diasNaEtapa: 9, seguradora: "MAPFRE", protocolo: "18354477",
      pecas: [peca("Porta dianteira direita", "martelinho", true, 380), peca("Para-lama direito", "sra", true, 180)],
      extra: {
        entregueEm: ha(9), franquia: { valor: 160, paga: true, forma: "Pix" },
        documentacao: { ...docCompleta, enviadaEm: ha(8), recusas: [{ data: ha(5), motivo: "Ordem dos documentos no PDF e assinatura fora do padrão" }] },
        financeiro: { aReceberMaxpar: 560, comissao: 170 },
        contatos: [{ data: ha(4), canal: "chat_portal", quem: "Analista Maxpar", resumo: "Pediram reenvio do PDF na ordem: OS, fotos, assinatura.", protocolo: "CH-77120" }],
      },
    }),
    montar({
      id: "demo-12", placa: "RNA4S66", modelo: "Volvo XC40", cor: "Cinza", cliente: "Luciano Prado", telefone: "(41) 99100-0012",
      etapa: "pago", diasAberto: 55, diasNaEtapa: 10, seguradora: "Zurich", protocolo: "18290331",
      pecas: [peca("Porta traseira direita", "martelinho", true, 400), peca("Para-choque traseiro", "sra", true, 200)],
      extra: { entregueEm: ha(48), franquia: { valor: 160, paga: true, forma: "Cartão" }, documentacao: { ...docCompleta, enviadaEm: ha(47), pagoEm: ha(10), valorPago: 600 }, financeiro: { aReceberMaxpar: 600, custoMaterial: 30, comissao: 180 } },
    }),
  ];
}

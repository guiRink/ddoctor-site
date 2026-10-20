// Conteúdo do orçamento que vai ao cliente (PDF e mensagem do WhatsApp). Só montagem/apresentação:
// o total vem da receita única do domínio (receitaOS), igual à folha impressa (ImprimirOS).
// Dados da oficina: só o que é fato no PRODUCT.md (nome e "martelinho de ouro"); contatos e endereço
// ainda são [inferido]/[aberto] e ficam de fora. Observações internas da OS nunca saem aqui.
import type { Centavos, MarcoISO, OrcamentoVersao } from "@compartilhado/tipos";
import { formatarReais, somaCentavos } from "@compartilhado/dominio/dinheiro";
import { formatarDocumento, normalizarDocumento } from "@compartilhado/dominio/documento";
import { receitaOS } from "@compartilhado/dominio/custos";
import { contatoClicavel } from "@compartilhado/dominio/clientes";
import { dataNoFuso, somarDias } from "@compartilhado/dominio/fuso";
import { formatarPlaca, normalizarPlaca } from "@compartilhado/dominio/placa";
import type { OSVisao } from "../../dados/repositorio";
import { STATUS_ITEM, TECNICA } from "../../dominio/rotulos";
import { hora, telefoneLegivel } from "../orcamentos/formato";
import { nomeCarro } from "../os/formato";
import { linkWhatsApp, tipoDoCliente } from "../clientes/formato";

/**
 * Validade do orçamento enviado ao cliente, em dias.
 * PROVISÓRIO — a confirmar com o dono (ainda não existe em config_oficina; pedido no relatório do SF).
 */
export const VALIDADE_ORCAMENTO_DIAS = 15;

export interface ItemDocumento {
  numero: number;
  peca: string;
  descricao?: string;
  tecnica: string;
  /** Só em orçamento de seguradora (versão externa). */
  situacao?: string;
  negado: boolean;
  valor: string;
}

export interface SomaDocumento {
  nome: string;
  valor: string;
  forte?: boolean;
}

export interface DocumentoOrcamento {
  osNumero: number;
  versaoNumero?: number;
  /** "20/10/2026 14:30" */
  emitido: string;
  /** Orçamento ainda não aprovado: validade a partir da emissão. */
  validade?: { dias: number; ate: string };
  /** Já aprovado: "Aprovado em 12/10/2026". */
  aprovado?: string;
  cliente: { nome: string; documento?: { rotulo: string; valor: string }; contato?: string; email?: string };
  seguro?: { seguradora: string; sinistro?: string };
  veiculo: { placa: string; placaBruta: string; modelo: string; corAno?: string };
  externo: boolean;
  itens: ItemDocumento[];
  somas: SomaDocumento[];
  total: Centavos;
  observacao?: string;
  demo: boolean;
  nomeArquivo: string;
  titulo: string;
}

const dataLonga = (data: string) => {
  const [a, m, d] = data.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};

/** Versão que vai ao cliente: a vigente da receita (aprovada de maior número); sem aprovação, a primeira da lista. */
export function versaoDoDocumento(v: Pick<OSVisao, "versoes" | "titulos">): OrcamentoVersao | undefined {
  const receita = receitaOS({ versoes: v.versoes, titulos: v.titulos });
  return v.versoes.find((x) => x.id === receita.versaoId) ?? v.versoes[0];
}

/** `orcamento-ABC1D23-OS123.pdf` */
export function nomeArquivoOrcamento(placa: string, numeroOS: number): string {
  return `orcamento-${normalizarPlaca(placa) || "SEMPLACA"}-OS${numeroOS}.pdf`;
}

export function montarDocumento(v: OSVisao, agora: MarcoISO, observacao?: string): DocumentoOrcamento {
  const receita = receitaOS({ versoes: v.versoes, titulos: v.titulos });
  const versao = versaoDoDocumento(v);
  const externo = versao?.tipo === "externo";
  const ativos = versao?.itens.filter((i) => i.statusItem !== "dispensado") ?? [];
  const subtotal = somaCentavos(ativos.map((i) => i.valor));
  const aprovada = versao?.estado === "aprovado";
  const total = versao ? (aprovada ? receita.autorizado : subtotal) : 0;
  const hoje = dataNoFuso(agora);

  const somas: SomaDocumento[] = [];
  if (versao && ativos.length > 0) {
    somas.push({ nome: "Subtotal", valor: formatarReais(subtotal) });
    if (aprovada && total !== subtotal) somas.push({ nome: "Não autorizado", valor: `- ${formatarReais(subtotal - total)}` });
    somas.push({ nome: aprovada ? (externo ? "Total autorizado" : "Total aprovado") : "Total do orçamento", valor: formatarReais(total), forte: true });
    if (versao.franquia !== undefined && versao.franquia > 0) somas.push({ nome: "Franquia (paga pelo cliente)", valor: formatarReais(versao.franquia) });
    if (externo && versao.complementoParticular !== undefined && versao.complementoParticular > 0) {
      somas.push({ nome: "Complemento particular", valor: formatarReais(versao.complementoParticular) });
    }
  }

  const doc = v.cliente.documento ? normalizarDocumento(v.cliente.documento) : "";
  const contato = v.cliente.whatsapp ?? v.cliente.telefone;
  const at = v.atendimentos[0];
  const placa = formatarPlaca(v.veiculo.placa);
  const obs = observacao?.trim();

  return {
    osNumero: v.os.numero,
    versaoNumero: versao?.numeroVersao,
    emitido: `${dataLonga(hoje)} ${hora(agora)}`,
    validade: aprovada ? undefined : { dias: VALIDADE_ORCAMENTO_DIAS, ate: dataLonga(somarDias(hoje, VALIDADE_ORCAMENTO_DIAS)) },
    aprovado: aprovada && versao?.aprovacao ? `Aprovado em ${dataLonga(dataNoFuso(versao.aprovacao.aprovadoEm))}` : undefined,
    cliente: {
      nome: v.cliente.nome,
      documento: doc ? { rotulo: doc.length === 14 ? "CNPJ" : "CPF", valor: formatarDocumento(doc) } : undefined,
      contato: contato ? telefoneLegivel(contato) : undefined,
      email: v.cliente.email || undefined,
    },
    seguro: at ? { seguradora: at.seguradora, sinistro: at.numeroSinistro || undefined } : undefined,
    veiculo: {
      placa,
      placaBruta: normalizarPlaca(v.veiculo.placa),
      modelo: nomeCarro(v.veiculo) || "Modelo não informado",
      corAno: [v.veiculo.cor, v.veiculo.ano].filter(Boolean).join(" · ") || undefined,
    },
    externo,
    itens: ativos.map((it, i) => ({
      numero: i + 1,
      peca: it.peca,
      descricao: it.descricao || undefined,
      tecnica: TECNICA[it.tecnica],
      situacao: externo ? STATUS_ITEM[it.statusItem].texto : undefined,
      negado: it.statusItem === "negado",
      valor: it.valor > 0 ? formatarReais(it.valor) : "—",
    })),
    somas,
    total,
    observacao: obs || undefined,
    demo: Boolean(v.os.demo || v.cliente.demo),
    nomeArquivo: nomeArquivoOrcamento(v.veiculo.placa, v.os.numero),
    titulo: `Orçamento ${placa} · OS ${v.os.numero}`,
  };
}

/** Como chamar o cliente na mensagem: primeiro nome (pessoa física) ou o nome inteiro (empresa). */
function saudacao(nome: string, pj: boolean): string {
  const limpo = nome.trim();
  if (pj) return limpo;
  return limpo.split(/\s+/)[0] ?? limpo;
}

/** Mensagem curta que acompanha o PDF. */
export function mensagemOrcamento(v: OSVisao, d: DocumentoOrcamento): string {
  const nome = saudacao(v.cliente.nome, tipoDoCliente(v.cliente) === "pj");
  const carro = nomeCarro(v.veiculo) || "carro";
  const valor = d.total > 0 ? `: total ${formatarReais(d.total)}` : "";
  return `Olá ${nome}, segue o orçamento do ${carro} (${d.veiculo.placa})${valor}. O PDF vai em anexo.`;
}

/** Número para o WhatsApp do cliente (WhatsApp; senão o telefone). */
export function numeroWhatsApp(v: Pick<OSVisao, "cliente">): string | undefined {
  return v.cliente.whatsapp || v.cliente.telefone || undefined;
}

/**
 * Link wa.me com a mensagem pronta. `null` quando não há número ou o cliente é de demonstração
 * (o número inventado pode ser de alguém real — contatoClicavel).
 */
export function linkWhatsAppComMensagem(v: Pick<OSVisao, "cliente">, mensagem: string): string | null {
  const numero = numeroWhatsApp(v);
  if (!numero || !contatoClicavel(v.cliente, numero)) return null;
  return `${linkWhatsApp(numero)}?text=${encodeURIComponent(mensagem)}`;
}

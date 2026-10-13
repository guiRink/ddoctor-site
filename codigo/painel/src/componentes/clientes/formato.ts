// Máscaras de digitação e formatação de exibição de contato (clientes). Só apresentação:
// a validação que vale é a do domínio (documento.ts) e a do repositório (prepararCliente).
import type { Cliente, DataISO, Endereco, MarcoISO, TipoPessoa, Veiculo } from "@compartilhado/tipos";
import { dataNoFuso, diferencaDias } from "@compartilhado/dominio/fuso";
import { formatarCEP, formatarDocumento, normalizarDocumento } from "@compartilhado/dominio/documento";
import { clienteCorresponde } from "@compartilhado/dominio/clientes";
import { normalizarPlaca } from "@compartilhado/dominio/placa";
import type { ClienteResumo } from "../../dados/repositorio";

/** Dígitos do telefone sem o 55 do país (quando vier em E.164). */
function digitosNacionais(texto: string): string {
  const d = texto.replace(/\D/g, "");
  return (d.length === 12 || d.length === 13) && d.startsWith("55") ? d.slice(2) : d;
}

/** "+5541999990000" → "(41) 99999-0000"; tamanho estranho volta como veio. */
export function formatarTelefone(texto?: string): string {
  if (!texto) return "";
  const d = digitosNacionais(texto);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return texto;
}

/** Link do WhatsApp (wa.me) a partir do número guardado. */
export function linkWhatsApp(texto: string): string {
  const d = digitosNacionais(texto);
  return `https://wa.me/55${d}`;
}

/** Máscara do telefone enquanto digita: (41) 99999-0000. */
export function mascaraTelefone(texto: string): string {
  const d = digitosNacionais(texto).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const meio = d.length === 11 ? 5 : 4;
  if (d.length <= 2 + meio) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 2 + meio)}-${d.slice(2 + meio)}`;
}

/** Telefone com DDD completo (10 ou 11 dígitos nacionais). Vazio também vale (é opcional). */
export function telefoneCompleto(texto: string): boolean {
  const d = digitosNacionais(texto);
  return d.length === 0 || d.length === 10 || d.length === 11;
}

/**
 * Máscara de CPF/CNPJ enquanto digita. Com `tipo`, limita ao tamanho do tipo;
 * sem tipo, vira CNPJ a partir da 12ª posição ou de uma letra (CNPJ alfanumérico).
 */
export function mascaraDocumento(texto: string, tipo?: TipoPessoa): string {
  const bruto = normalizarDocumento(texto);
  const pj = tipo === "pj" || (tipo === undefined && (bruto.length > 11 || /[A-Z]/.test(bruto)));
  if (!pj) {
    const d = bruto.replace(/\D/g, "").slice(0, 11);
    return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join(".") + (d.length > 9 ? `-${d.slice(9)}` : "");
  }
  // 12 posições alfanuméricas + 2 DV numéricos
  const d = bruto.slice(0, 14);
  let s = d.slice(0, 2);
  if (d.length > 2) s += `.${d.slice(2, 5)}`;
  if (d.length > 5) s += `.${d.slice(5, 8)}`;
  if (d.length > 8) s += `/${d.slice(8, 12)}`;
  if (d.length > 12) s += `-${d.slice(12)}`;
  return s;
}

/** Máscara do CEP: 80000-000. */
export function mascaraCEP(texto: string): string {
  const d = texto.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Documento para exibir, com o rótulo do tipo. */
export function documentoExibicao(cliente: Cliente): { rotulo: string; valor: string } | null {
  if (!cliente.documento) return null;
  const n = normalizarDocumento(cliente.documento);
  return { rotulo: n.length === 14 ? "CNPJ" : "CPF", valor: formatarDocumento(n) };
}

/** Tipo de pessoa efetivo (o cadastrado ou o deduzido do documento). */
export function tipoDoCliente(cliente: Cliente): TipoPessoa | undefined {
  if (cliente.tipoPessoa) return cliente.tipoPessoa;
  const n = cliente.documento ? normalizarDocumento(cliente.documento) : "";
  return n.length === 14 ? "pj" : n.length === 11 ? "pf" : undefined;
}

/** Endereço em duas linhas: "Rua X, 120 · Sala 2" e "Bairro · Cidade/UF · 80000-000". */
export function linhasEndereco(e: Endereco): [string, string] {
  const l1 = [`${e.logradouro}${e.numero ? `, ${e.numero}` : ""}`, e.complemento].filter(Boolean).join(" · ");
  const l2 = [e.bairro, [e.cidade, e.uf].filter(Boolean).join("/"), formatarCEP(e.cep)].filter(Boolean).join(" · ");
  return [l1, l2];
}

/** Busca da lista: a do domínio (nome, documento, telefone, e-mail) + placa dos veículos do cliente. */
export function resumoCorresponde(r: ClienteResumo, termo: string): boolean {
  if (clienteCorresponde(r.cliente, termo)) return true;
  const placa = normalizarPlaca(termo);
  return placa.length >= 3 && r.veiculos.some((v) => v.placa.includes(placa));
}

/** Tempo desde um marco, em palavras: "hoje", "ontem", "há 3 dias", "há 2 meses", "há 1 ano". */
export function haQuanto(marco: MarcoISO, hoje: DataISO): string {
  const d = diferencaDias(dataNoFuso(marco), hoje);
  if (d <= 0) return "hoje";
  if (d === 1) return "ontem";
  if (d < 30) return `há ${d} dias`;
  if (d < 365) {
    const meses = Math.floor(d / 30);
    return `há ${meses} ${meses === 1 ? "mês" : "meses"}`;
  }
  const anos = Math.floor(d / 365);
  return `há ${anos} ${anos === 1 ? "ano" : "anos"}`;
}

/** "2025-03-14" → "14/03/2025". */
export function dataCompleta(data: DataISO): string {
  const [a, m, d] = data.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** "Jeep Compass" sem repetir a marca quando o modelo já a traz ("Jeep" + "Jeep Compass"). */
export function nomeVeiculo(v: Pick<Veiculo, "marca" | "modelo">): string {
  const marca = v.marca?.trim();
  const modelo = v.modelo?.trim();
  // modelo já começa com a marca (ou com a primeira palavra dela): não repete
  const primeira = modelo?.split(/\s+/)[0]?.toLowerCase();
  if (marca && modelo && primeira && (modelo.toLowerCase().startsWith(marca.toLowerCase()) || marca.toLowerCase().split(/[\s-]+/)[0] === primeira)) return modelo;
  return [marca, modelo].filter(Boolean).join(" ") || "Modelo não informado";
}

/** aria-describedby de um campo: dica (se houver e não tiver erro) e erro. */
export function descrito(id: string, erro?: string, temDica = false): string | undefined {
  const ids = [temDica && !erro ? `${id}-dica` : "", erro ? `${id}-erro` : ""].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

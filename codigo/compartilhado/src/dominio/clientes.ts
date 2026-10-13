// Busca de cliente por nome, documento, telefone/WhatsApp ou e-mail (sem acento, sem máscara).
import type { Cliente } from "../tipos";
import { normalizarDocumento } from "./documento";

const semAcento = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/**
 * O termo casa com o cliente se: o nome contém o termo (sem acento/caixa); ou o termo tem ≥ 3 dígitos/letras
 * de documento e está contido no documento; ou ≥ 4 dígitos contidos no telefone/WhatsApp; ou o e-mail contém o termo.
 * Termo vazio casa com todos.
 */
export function clienteCorresponde(cliente: Cliente, termo: string): boolean {
  const t = semAcento(termo);
  if (!t) return true;
  if (semAcento(cliente.nome).includes(t)) return true;
  if (cliente.email && cliente.email.toLowerCase().includes(t)) return true;
  const doc = normalizarDocumento(termo);
  if (doc.length >= 3 && cliente.documento && normalizarDocumento(cliente.documento).includes(doc)) return true;
  const digitos = termo.replace(/\D/g, "");
  if (digitos.length >= 4) {
    for (const tel of [cliente.telefone, cliente.whatsapp]) if (tel && tel.replace(/\D/g, "").includes(digitos)) return true;
  }
  return false;
}

/**
 * Telefone/WhatsApp do cliente pode virar link (wa.me, tel:)? Cliente de demonstração não: os números são
 * inventados mas têm formato real e podem cair numa pessoa de verdade. Sem número, também não.
 */
export function contatoClicavel(cliente: Pick<Cliente, "demo">, numero: string | undefined): boolean {
  return !cliente.demo && !!numero?.replace(/\D/g, "");
}

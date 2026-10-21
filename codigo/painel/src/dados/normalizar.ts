import type { ChecklistItem, Cliente, Fornecedor, Id, Veiculo } from "@compartilhado/tipos";
import { normalizarCEP, normalizarDocumento, tipoPorDocumento, validarDocumento } from "@compartilhado/dominio/documento";
import { normalizarPlaca, placaValida } from "@compartilhado/dominio/placa";

/**
 * Normalização dos cadastros simples antes de gravar — a MESMA nos dois repositórios (memória e Supabase).
 * No Supabase as constraints do banco conferem de novo (documento_invalido, telefone_invalido...); aqui o dado sai
 * no formato que o banco espera (documento só dígitos, telefone E.164, CEP 8 dígitos, placa sem traço).
 */

type Falha = { ok: false; codigo: string };

/** Telefone em E.164 sem formatação; 10–11 dígitos ganham +55. undefined = vazio; null = inválido. */
export function normalizarTelefone(texto: string | undefined): string | null | undefined {
  if (!texto?.trim()) return undefined;
  const digitos = texto.replace(/\D/g, "");
  if (texto.trim().startsWith("+")) return digitos.length >= 12 && digitos.length <= 13 ? `+${digitos}` : null;
  if (digitos.length === 10 || digitos.length === 11) return `+55${digitos}`;
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) return `+${digitos}`;
  return null;
}

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Cliente validado e normalizado (sem a checagem de documento repetido: memória confere na lista; banco no índice). */
export function normalizarCliente(entrada: Omit<Cliente, "id">): { ok: true; cliente: Omit<Cliente, "id"> } | Falha {
  const nome = entrada.nome?.trim();
  if (!nome) return { ok: false, codigo: "nome_obrigatorio" };
  let documento: string | undefined;
  let tipoPessoa = entrada.tipoPessoa;
  if (entrada.documento?.trim()) {
    documento = normalizarDocumento(entrada.documento);
    if (!validarDocumento(documento, tipoPessoa ?? undefined)) return { ok: false, codigo: "documento_invalido" };
    tipoPessoa = tipoPessoa ?? tipoPorDocumento(documento) ?? undefined;
  }
  const telefone = normalizarTelefone(entrada.telefone);
  const whatsapp = normalizarTelefone(entrada.whatsapp);
  if (telefone === null || whatsapp === null) return { ok: false, codigo: "telefone_invalido" };
  const email = entrada.email?.trim() || undefined;
  if (email && !EMAIL.test(email)) return { ok: false, codigo: "email_invalido" };
  let endereco = entrada.endereco;
  if (endereco) {
    const cep = normalizarCEP(endereco.cep ?? "");
    if (!cep) return { ok: false, codigo: "cep_invalido" };
    endereco = { ...endereco, cep, uf: endereco.uf?.toUpperCase() };
  }
  return { ok: true, cliente: { ...entrada, nome, documento, tipoPessoa, telefone, whatsapp, email, endereco } };
}

/** Veículo: placa normalizada e válida; ano de 1950 ao ano que vem; textos aparados. */
export function normalizarVeiculo(entrada: Omit<Veiculo, "id">, anoAtual = new Date().getFullYear()): { ok: true; veiculo: Omit<Veiculo, "id"> } | Falha {
  const placa = normalizarPlaca(entrada.placa ?? "");
  if (!placaValida(placa)) return { ok: false, codigo: "placa_invalida" };
  if (entrada.ano !== undefined && (!Number.isInteger(entrada.ano) || entrada.ano < 1950 || entrada.ano > anoAtual + 1)) return { ok: false, codigo: "ano_invalido" };
  return {
    ok: true,
    veiculo: { ...entrada, placa, marca: entrada.marca?.trim() || undefined, modelo: entrada.modelo?.trim() || undefined, cor: entrada.cor?.trim() || undefined },
  };
}

/** Fornecedor: nome obrigatório; documento, telefone e e-mail validados (sem a checagem de documento repetido). */
export function normalizarFornecedor(entrada: Omit<Fornecedor, "id">): { ok: true; fornecedor: Omit<Fornecedor, "id"> } | Falha {
  const nome = entrada.nome?.trim();
  if (!nome) return { ok: false, codigo: "nome_obrigatorio" };
  let documento: string | undefined;
  if (entrada.documento?.trim()) {
    documento = normalizarDocumento(entrada.documento);
    if (!validarDocumento(documento)) return { ok: false, codigo: "documento_invalido" };
  }
  const telefone = normalizarTelefone(entrada.telefone);
  if (telefone === null) return { ok: false, codigo: "telefone_invalido" };
  const email = entrada.email?.trim() || undefined;
  if (email && !EMAIL.test(email)) return { ok: false, codigo: "email_invalido" };
  return { ok: true, fornecedor: { ...entrada, nome, documento, telefone, email } };
}

/** Checklist de entrada: grupo e nome obrigatórios, ids únicos (item novo ganha id). */
export function limparChecklist(itens: readonly ChecklistItem[], novoId: () => Id): { ok: true; itens: ChecklistItem[] } | Falha {
  const ids = new Set<string>();
  const limpos: ChecklistItem[] = [];
  for (const item of itens) {
    const nome = item.nome?.trim();
    const grupo = item.grupo?.trim();
    if (!nome || !grupo) return { ok: false, codigo: "checklist_invalido" };
    const id = item.id?.trim() || novoId();
    if (ids.has(id)) return { ok: false, codigo: "checklist_invalido" };
    ids.add(id);
    limpos.push({ id, grupo, nome, ativo: item.ativo !== false });
  }
  return { ok: true, itens: limpos };
}

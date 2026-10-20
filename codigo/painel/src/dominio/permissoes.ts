import type { Papel } from "@compartilhado/tipos";

/**
 * Matriz papel × módulo — docs/painel-arquitetura.md §9.1.
 * Na interface só esconde o que o papel não usa; a barreira real é a RLS do banco (S1).
 */
export type Modulo =
  | "geral"
  | "orcamentos"
  | "clientes"
  | "agenda"
  | "vistorias"
  | "producao"
  | "minhas_tarefas"
  | "tv"
  | "funcionarios"
  | "estoque"
  | "recebiveis"
  | "financeiro"
  | "relatorios"
  | "ajustes";

export type Acesso = "editar" | "ler" | "proprio" | null;

const MATRIZ: Record<Modulo, Partial<Record<Papel, Acesso>>> = {
  geral: { dono: "ler", gestor: "ler", recepcao: "ler", financeiro: "ler" },
  orcamentos: { dono: "editar", gestor: "editar", recepcao: "editar", financeiro: "ler" },
  clientes: { dono: "editar", gestor: "editar", recepcao: "editar", financeiro: "ler" },
  agenda: { dono: "editar", gestor: "editar", recepcao: "editar" },
  vistorias: { dono: "editar", gestor: "editar", recepcao: "editar", producao: "proprio", financeiro: "ler" },
  producao: { dono: "editar", gestor: "editar", recepcao: "ler" },
  minhas_tarefas: { producao: "proprio", gestor: "editar", dono: "editar" },
  tv: { dono: "ler", gestor: "ler", dispositivo: "ler" },
  funcionarios: { dono: "editar", gestor: "editar", producao: "proprio" },
  estoque: { dono: "editar", gestor: "editar", financeiro: "ler" },
  recebiveis: { dono: "editar", gestor: "editar", recepcao: "ler", financeiro: "editar" },
  financeiro: { dono: "editar", gestor: "ler", financeiro: "editar" },
  relatorios: { dono: "ler", gestor: "ler", financeiro: "ler" },
  ajustes: { dono: "editar", gestor: "editar" },
};

export function acesso(papel: Papel, modulo: Modulo): Acesso {
  return MATRIZ[modulo][papel] ?? null;
}

export function podeVer(papel: Papel, modulo: Modulo): boolean {
  return acesso(papel, modulo) !== null;
}

export function podeEditar(papel: Papel, modulo: Modulo): boolean {
  const a = acesso(papel, modulo);
  return a === "editar" || a === "proprio";
}

/** Produção e TV nunca veem valores, telefones nem seguradora (arq. §9.1). */
export function veDadosSensiveis(papel: Papel): boolean {
  return papel !== "producao" && papel !== "dispositivo";
}

/**
 * Custos lançados, resultado e margem da OS: só dono, gestor e financeiro (quem lança custo é quem os vê).
 * Produção e TV nunca veem custo, margem, valor, documento, telefone nem endereço (veDadosSensiveis).
 */
export function veCustosOS(papel: Papel): boolean {
  return papel === "dono" || papel === "gestor" || papel === "financeiro";
}

/**
 * Capacidade, expediente e semáforo (salvarConfig): quem edita Ajustes na matriz — dono e gestor.
 * Provisório (sprint SF): o pedido foi "só o dono"; a matriz §9.1 dá Ajustes ao gestor, então ele também edita.
 */
export function podeEditarConfig(papel: Papel): boolean {
  return acesso(papel, "ajustes") === "editar";
}

/**
 * Criar ou editar tipo de reparo (categoria de serviço): dono, gestor e recepção — a recepção cria na hora do
 * atendimento. Provisório (sprint SF), a confirmar com o dono.
 */
export function podeCriarTipoReparo(papel: Papel): boolean {
  return papel === "dono" || papel === "gestor" || papel === "recepcao";
}

/** Tirar foto da OS: quem edita vistorias (dono, gestor, recepção) e a produção (fotos das próprias etapas). */
export function podeAdicionarFoto(papel: Papel): boolean {
  return podeEditar(papel, "vistorias");
}

/**
 * Remover foto interna: dono, gestor e recepção; a produção só a que ela mesma tirou (acesso "proprio").
 * Foto da Maxpar nunca (o repositório recusa com foto_externa).
 */
export function podeRemoverFoto(papel: Papel, foto: { autorId?: string; origem: "interna" | "maxpar" }, perfilId?: string): boolean {
  if (foto.origem === "maxpar") return false;
  const a = acesso(papel, "vistorias");
  if (a === "editar") return true;
  return a === "proprio" && Boolean(perfilId) && foto.autorId === perfilId;
}

/** Primeira tela de cada papel. */
export function telaInicial(papel: Papel): string {
  switch (papel) {
    case "producao":
      return "/producao/eu";
    case "dispositivo":
      return "/producao/tv";
    case "financeiro":
      return "/recebiveis";
    default:
      return "/geral";
  }
}

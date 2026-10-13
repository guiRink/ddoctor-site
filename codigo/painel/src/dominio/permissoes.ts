import type { Papel } from "@compartilhado/tipos";

/**
 * Matriz papel × módulo — docs/painel-arquitetura.md §9.1.
 * Na interface só esconde o que o papel não usa; a barreira real é a RLS do banco (S1).
 */
export type Modulo =
  | "geral"
  | "orcamentos"
  | "agenda"
  | "vistorias"
  | "producao"
  | "minhas_tarefas"
  | "tv"
  | "funcionarios"
  | "estoque"
  | "recebiveis"
  | "financeiro"
  | "ajustes";

export type Acesso = "editar" | "ler" | "proprio" | null;

const MATRIZ: Record<Modulo, Partial<Record<Papel, Acesso>>> = {
  geral: { dono: "ler", gestor: "ler", recepcao: "ler", financeiro: "ler" },
  orcamentos: { dono: "editar", gestor: "editar", recepcao: "editar", financeiro: "ler" },
  agenda: { dono: "editar", gestor: "editar", recepcao: "editar" },
  vistorias: { dono: "editar", gestor: "editar", recepcao: "editar", producao: "proprio", financeiro: "ler" },
  producao: { dono: "editar", gestor: "editar", recepcao: "ler" },
  minhas_tarefas: { producao: "proprio", gestor: "editar", dono: "editar" },
  tv: { dono: "ler", gestor: "ler", dispositivo: "ler" },
  funcionarios: { dono: "editar", gestor: "editar", producao: "proprio" },
  estoque: { dono: "editar", gestor: "editar", financeiro: "ler" },
  recebiveis: { dono: "editar", gestor: "editar", recepcao: "ler", financeiro: "editar" },
  financeiro: { dono: "editar", gestor: "ler", financeiro: "editar" },
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

import type { Papel } from "@compartilhado/tipos";

/**
 * Matriz papel × módulo — docs/painel-arquitetura.md §9.1, revista no S1 (pedido do Guilherme, 22/10/2026:
 * "gerente vê quase tudo menos o financeiro"). Na interface só esconde o que o papel não usa; a barreira real é a
 * RLS do banco (S1) — o arquiteto-dados espelha esta matriz nas políticas.
 *
 * Matriz final (E = editar, L = ler, P = só o próprio, — = não vê). "gestor" aparece como "Gerente".
 *
 *   módulo          dono  gestor  recepcao  producao  financeiro  dispositivo
 *   geral            L     L       L         —         L           —
 *   orcamentos       E     E       E         —         L           —
 *   clientes         E     E       E         —         L           —
 *   agenda           E     E       E         —         —           —
 *   vistorias        E     E       E         P         L           —
 *   producao         E     E       L         L         —           —
 *   minhas_tarefas   E     E       —         P         —           —
 *   tv               L     L       —         —         —           L
 *   equipe           E     E       —         —         —           —     (gestor: lista, cadastro, função, histórico)
 *   folha            E     —       —         —         E           —     (salários, comissões, marcar pago)
 *   estoque          E     E       —         —         L           —     (custo médio/valores: veCustosOS)
 *   recebiveis       E     —       —         —         E           —     (A receber)
 *   financeiro       E     —       —         —         E           —     (inclui caixa)
 *   relatorios       L     —       —         —         L           —
 *   ajustes          E     E       —         —         —           —     (Comissões: só o dono)
 *
 * Fora da matriz (helpers abaixo):
 *   veFinanceiro          dono, financeiro — dinheiro da oficina: A receber, caixa, "Dinheiro vencido" do Geral.
 *   veCustosOS            dono, financeiro — custos, resultado e margem da OS (o gerente NÃO vê).
 *   veDadosSensiveis      todos menos produção e TV — preço do orçamento, telefone, documento, seguradora.
 *   podeVerFolha          dono, financeiro — folha, salários e comissões em R$ (na Equipe, só o dono entre os
 *                         que abrem a Equipe; o financeiro vê a folha pelo módulo `folha`).
 *   podeGerenciarEquipe   dono, gestor — cadastrar funcionário, editar nome/função/telefone, ativar/desativar.
 *   podeEditarPapel       dono — trocar papel (permissão), criar/trocar login e senha, desligar o dono.
 *   podeEditarSalario     dono — salário mensal e ajustes da folha.
 *   podeEditarComissoes   dono — regras de comissão em Ajustes.
 *   podePagarFolha        dono, financeiro — marcar a folha como paga (gera despesa "Salários").
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
  | "equipe"
  | "folha"
  /** @deprecated nome antigo da Equipe (rota /funcionarios); mesmo acesso de "equipe". Migrar telas e menu. */
  | "funcionarios"
  | "estoque"
  | "recebiveis"
  | "financeiro"
  | "relatorios"
  | "ajustes";

export type Acesso = "editar" | "ler" | "proprio" | null;

// Equipe: a produção não vê (sprint SG: funileiro vendo o número do colega dá briga)
const EQUIPE: Partial<Record<Papel, Acesso>> = { dono: "editar", gestor: "editar" };

const MATRIZ: Record<Modulo, Partial<Record<Papel, Acesso>>> = {
  geral: { dono: "ler", gestor: "ler", recepcao: "ler", financeiro: "ler" },
  orcamentos: { dono: "editar", gestor: "editar", recepcao: "editar", financeiro: "ler" },
  clientes: { dono: "editar", gestor: "editar", recepcao: "editar", financeiro: "ler" },
  agenda: { dono: "editar", gestor: "editar", recepcao: "editar" },
  vistorias: { dono: "editar", gestor: "editar", recepcao: "editar", producao: "proprio", financeiro: "ler" },
  // a produção vê o quadro da oficina só para ler (mecânico SG: "qual é o próximo carro que vem pra mim")
  producao: { dono: "editar", gestor: "editar", recepcao: "ler", producao: "ler" },
  minhas_tarefas: { producao: "proprio", gestor: "editar", dono: "editar" },
  tv: { dono: "ler", gestor: "ler", dispositivo: "ler" },
  equipe: EQUIPE,
  funcionarios: EQUIPE,
  folha: { dono: "editar", financeiro: "editar" },
  estoque: { dono: "editar", gestor: "editar", financeiro: "ler" },
  // dinheiro da oficina: só o dono e o financeiro (S1: o gerente e a recepção saem)
  recebiveis: { dono: "editar", financeiro: "editar" },
  financeiro: { dono: "editar", financeiro: "editar" },
  relatorios: { dono: "ler", financeiro: "ler" },
  ajustes: { dono: "editar", gestor: "editar" },
};

/** Módulos de dinheiro da oficina (o gerente não vê nenhum). */
export const MODULOS_FINANCEIROS: readonly Modulo[] = ["recebiveis", "financeiro", "relatorios", "folha"];

/**
 * Menu por papel, na ordem em que aparece (sprint SG, plano item 10). O menu é mais enxuto que o acesso:
 * "Minhas tarefas" só para a produção, "Quadro da TV" é botão na Produção e "Relatórios" é aba do Financeiro —
 * as rotas continuam abertas para quem a MATRIZ deixa. A Equipe é o módulo "equipe" (rota /equipe; /funcionarios
 * redireciona); a folha do financeiro é o módulo "folha", que aparece como aba "Folha" do Financeiro (não tem item
 * próprio no MENU de rotulos.ts, então não vira link na barra).
 */
const MENU_DO_PAPEL: Record<Papel, Modulo[]> = {
  dono: ["geral", "orcamentos", "agenda", "producao", "vistorias", "clientes", "recebiveis", "financeiro", "equipe", "estoque", "ajustes"],
  gestor: ["geral", "orcamentos", "agenda", "producao", "vistorias", "clientes", "equipe", "estoque", "ajustes"],
  recepcao: ["geral", "orcamentos", "agenda", "producao", "vistorias", "clientes"],
  financeiro: ["geral", "recebiveis", "financeiro", "folha", "clientes", "orcamentos"],
  producao: ["minhas_tarefas", "producao", "vistorias"],
  dispositivo: [],
};

/** Módulos que o papel vê no menu, na ordem do menu (só os que ele também pode abrir). */
export function modulosDoMenu(papel: Papel): Modulo[] {
  return (MENU_DO_PAPEL[papel] ?? []).filter((m) => podeVer(papel, m));
}

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
 * Dinheiro da oficina (A receber, caixa, Relatórios, "Dinheiro vencido"/"Recebido no mês" do Geral): dono e
 * financeiro. O gerente vê a operação inteira, mas não o financeiro (S1).
 */
export function veFinanceiro(papel: Papel): boolean {
  return papel === "dono" || papel === "financeiro";
}

/**
 * Custos lançados, resultado e margem da OS (e custo médio/valor do estoque): só dono e financeiro (S1: o gerente
 * saiu). Produção e TV nunca veem custo, margem, valor, documento, telefone nem endereço (veDadosSensiveis).
 */
export function veCustosOS(papel: Papel): boolean {
  return veFinanceiro(papel);
}

/**
 * Aba Pagamentos da ficha da OS e recebíveis da OS (receber franquia/particular): dono, financeiro e a recepção,
 * que cobra no balcão. O gerente não vê (S1: "quase tudo menos o financeiro"); produção e TV nunca.
 */
export function vePagamentosOS(papel: Papel): boolean {
  return veFinanceiro(papel) || papel === "recepcao";
}

/** Folha de pagamento, salários e comissões em R$: dono e financeiro. */
export function podeVerFolha(papel: Papel): boolean {
  return podeVer(papel, "folha");
}

/** Marcar a folha como paga (vira despesa "Salários"): quem edita a folha — dono e financeiro. */
export function podePagarFolha(papel: Papel): boolean {
  return acesso(papel, "folha") === "editar";
}

/** Cadastrar funcionário, editar nome/função/telefone, ativar/desativar: dono e gerente. */
export function podeGerenciarEquipe(papel: Papel): boolean {
  return acesso(papel, "equipe") === "editar";
}

/**
 * Trocar o papel (permissão) de alguém, criar/trocar login e senha: só o dono. A guarda do último dono ativo
 * é validarMudancaPapel (compartilhado/dominio/equipe).
 */
export function podeEditarPapel(papel: Papel): boolean {
  return papel === "dono";
}

/** Salário mensal e ajustes da folha: só o dono (o financeiro paga, não muda o salário). */
export function podeEditarSalario(papel: Papel): boolean {
  return papel === "dono";
}

/** Regras de comissão em Ajustes → Comissões: só o dono (o gerente edita o resto de Ajustes). */
export function podeEditarComissoes(papel: Papel): boolean {
  return papel === "dono";
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

/**
 * Ajustar o alerta de um carro (salvarAlertaOS: prazo em dias úteis, "fica laranja/vermelho a partir de", urgente):
 * dono, gestor e recepção (pedido do dono, 2º áudio). A base em Ajustes (alertaCarro) segue podeEditarConfig.
 */
export function podeEditarAlertaOS(papel: Papel): boolean {
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

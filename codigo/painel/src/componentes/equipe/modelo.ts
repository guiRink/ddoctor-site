// Apresentação da aba Equipe (sprint S1): textos, ordem, CSV da folha e a senha sugerida do login.
// As regras (folha, comissões, histórico, validação) moram em codigo/compartilhado/src/dominio; aqui só se arruma
// o que a tela mostra.
import type { Papel, Perfil, RegraComissao, TipoReparo } from "@compartilhado/tipos";
import type { LinhaFolha } from "@compartilhado/dominio/folha";
import type { LinhaComissao } from "@compartilhado/dominio/comissoes";
import type { TipoEventoFuncionario } from "@compartilhado/dominio/historicoFuncionario";
import { PAPEL } from "../../dominio/rotulos";
import type { Tom } from "../ui/Estado";
import type { NomeIcone } from "../Icone";
import { centavosCsv, gerarCsv } from "../estoque/csv";

/** Permissões que se dão a uma pessoa (a TV é aparelho; não entra na escolha). Ordem do mais amplo ao mais restrito. */
export const PERMISSOES: readonly Exclude<Papel, "dispositivo">[] = ["dono", "gestor", "financeiro", "recepcao", "producao"];

/** Tom da pílula de permissão: dono e gerente em destaque firme; o resto neutro (cor só com significado). */
export const TOM_PERMISSAO: Record<Papel, Tom> = {
  dono: "escuro",
  gestor: "escuro",
  financeiro: "neutro",
  recepcao: "neutro",
  producao: "neutro",
  dispositivo: "neutro",
};

/** Pessoas da equipe (sem aparelhos), ativas primeiro; dentro, pela permissão (dono → produção) e nome. */
export function ordenarEquipe(perfis: readonly Perfil[]): Perfil[] {
  const ordem = (p: Papel) => (PERMISSOES as readonly Papel[]).indexOf(p);
  return perfis
    .filter((p) => p.papel !== "dispositivo")
    .sort((a, b) => Number(b.ativo) - Number(a.ativo) || ordem(a.papel) - ordem(b.papel) || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** "Pintor · Produção"; sem função, só a permissão. */
export function funcaoEPermissao(p: Pick<Perfil, "funcao" | "papel">): string {
  return p.funcao ? `${p.funcao} · ${PAPEL[p.papel]}` : PAPEL[p.papel];
}

/** Nomes de etapa que existem nos tipos de serviço (para a escolha da comissão), sem repetir, em ordem alfabética. */
export function nomesDeEtapa(tipos: readonly TipoReparo[]): string[] {
  const vistos = new Map<string, string>();
  for (const t of tipos) for (const e of t.etapas) {
    const chave = e.nome.trim().toLowerCase();
    if (!vistos.has(chave)) vistos.set(chave, e.nome.trim());
  }
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Alvo da comissão em texto: "Pintura", "Pintura em Funilaria e pintura", "Toda etapa de Martelinho". */
export function textoAlvoComissao(r: Pick<RegraComissao, "etapaNome" | "tipoReparoId">, tipos: readonly TipoReparo[]): string {
  const tipo = r.tipoReparoId ? (tipos.find((t) => t.id === r.tipoReparoId)?.nome ?? "tipo removido") : undefined;
  if (r.etapaNome && tipo) return `${r.etapaNome} em ${tipo}`;
  if (r.etapaNome) return r.etapaNome;
  return `Toda etapa de ${tipo ?? "—"}`;
}

/** Ícone e verbo de cada evento do histórico do funcionário. */
export const EVENTO: Record<TipoEventoFuncionario, { icone: NomeIcone; tom: "ok" | "alerta" | "neutro" }> = {
  concluiu: { icone: "ok", tom: "ok" },
  iniciou: { icone: "play", tom: "neutro" },
  parou: { icone: "bloqueio", tom: "alerta" },
  retomou: { icone: "play", tom: "neutro" },
  foto: { icone: "camera", tom: "neutro" },
};

/** Situação da linha da folha: "Pago em 05/11" (ok), "A pagar" (neutro) ou "Nada a pagar". */
export function situacaoFolha(l: Pick<LinhaFolha, "pago" | "pagamento"> & { total?: number }): { texto: string; tom: Tom } {
  if (l.pago && l.pagamento?.pagoEm) {
    const [, m, d] = l.pagamento.pagoEm.split("-");
    return { texto: `Pago em ${d}/${m}`, tom: "ok" };
  }
  if (l.total === 0) return { texto: "Nada a pagar", tom: "neutro" };
  return { texto: "A pagar", tom: "neutro" };
}

/** Comissões da pessoa no mês (mais recente primeiro). */
export const comissoesDe = (perfilId: string, linhas: readonly LinhaComissao[]) => linhas.filter((l) => l.perfilId === perfilId);

/** CSV da folha do mês (planilha pt-BR: ";" e vírgula decimal). */
export function csvFolha(linhas: readonly LinhaFolha[]): string {
  return gerarCsv(
    ["Funcionário", "Função", "Permissão", "Mês", "Salário", "Comissões", "Etapas comissionadas", "Ajustes", "Total", "Situação", "Pago em"],
    linhas.map((l) => [
      l.nome,
      l.funcao ?? "",
      PAPEL[l.papel],
      `${l.mes.slice(5, 7)}/${l.mes.slice(0, 4)}`,
      centavosCsv(l.salario),
      centavosCsv(l.comissoes),
      l.quantidadeComissoes,
      centavosCsv(l.ajustes),
      centavosCsv(l.total),
      l.pago ? "Pago" : "A pagar",
      l.pagamento?.pagoEm ?? "",
    ]),
  );
}

// ---------------------------------------------------------------- senha sugerida

/** Letras e números sem os que se confundem ao ditar ou ler no papel (0/o, 1/l/i). */
const ALFABETO = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * Senha para o dono passar ao funcionário: 3 grupos de 4 ("kq7m-4tpa-x2hd"), fácil de ditar e de digitar no
 * celular. `aleatorio` só para teste; no navegador usa crypto.getRandomValues.
 */
export function gerarSenha(aleatorio?: (n: number) => Uint32Array): string {
  const sorteio = aleatorio ?? ((n: number) => crypto.getRandomValues(new Uint32Array(n)));
  const numeros = sorteio(12);
  const letras = Array.from(numeros, (x) => ALFABETO[x % ALFABETO.length]).join("");
  return `${letras.slice(0, 4)}-${letras.slice(4, 8)}-${letras.slice(8, 12)}`;
}

import { useLiveQuery } from "dexie-react-hooks";
import { banco } from "./dexie";
import type { Atendimento } from "../dominio/tipos";

/**
 * Hooks reativos de leitura. Hoje observam o Dexie direto (é o que dá reatividade local);
 * quando o Supabase entrar, estes hooks passam a observar o repositório remoto.
 */

export function useAtendimentos(): Atendimento[] | undefined {
  return useLiveQuery(() => banco.atendimentos.orderBy("atualizadoEm").reverse().toArray(), []);
}

export function useAtendimento(id: string | undefined): Atendimento | undefined | null {
  const resultado = useLiveQuery(async () => (id ? ((await banco.atendimentos.get(id)) ?? null) : null), [id]);
  return resultado;
}

export function useContagemDemo(): number | undefined {
  return useLiveQuery(() => banco.atendimentos.filter((a) => a.demo === true).count(), []);
}

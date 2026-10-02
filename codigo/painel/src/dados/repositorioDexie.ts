import { banco } from "./dexie";
import type { Repositorio } from "./repositorio";

export const repositorioDexie: Repositorio = {
  async listar() {
    return banco.atendimentos.orderBy("atualizadoEm").reverse().toArray();
  },
  async obter(id) {
    return banco.atendimentos.get(id);
  },
  async salvar(atendimento) {
    await banco.atendimentos.put({ ...atendimento, atualizadoEm: new Date().toISOString() });
  },
  async remover(id) {
    await banco.atendimentos.delete(id);
  },
  async contarDemo() {
    return banco.atendimentos.filter((a) => a.demo === true).count();
  },
  async semearDemo(itens) {
    await banco.atendimentos.bulkPut(itens);
  },
  async limparDemo() {
    await banco.atendimentos.filter((a) => a.demo === true).delete();
  },
};

/** Repositório ativo. Trocar aqui quando o Supabase entrar. */
export const repositorio: Repositorio = repositorioDexie;

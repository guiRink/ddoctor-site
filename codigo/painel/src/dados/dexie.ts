import Dexie, { type EntityTable } from "dexie";
import type { Atendimento } from "../dominio/tipos";

class BancoDdoctor extends Dexie {
  atendimentos!: EntityTable<Atendimento, "id">;

  constructor() {
    super("ddoctor-painel");
    this.version(1).stores({
      // índices: id (chave), placa, etapa, protocolo, demo, atualizadoEm
      atendimentos: "id, placa, etapa, protocolo, demo, atualizadoEm",
    });
  }
}

export const banco = new BancoDdoctor();

// Resultado das guardas: { ok: true } ou { ok: false, codigo } com os mesmos códigos das funções SQL.
export type Falha<C extends string> = { ok: false; codigo: C };
export type Resultado<C extends string, T extends object = object> = ({ ok: true } & T) | Falha<C>;

export const falha = <C extends string>(codigo: C): Falha<C> => ({ ok: false, codigo });

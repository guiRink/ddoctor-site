import type { Material } from "@compartilhado/tipos";
import { formatarQtd } from "../financeiro/formato";

/** <option>s de material agrupadas por categoria, com o saldo atual no texto. */
export function OpcoesMateriais({ materiais }: { materiais: Material[] }) {
  const grupos = new Map<string, Material[]>();
  for (const m of [...materiais].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))) {
    const g = grupos.get(m.categoria) ?? [];
    g.push(m);
    grupos.set(m.categoria, g);
  }
  return (
    <>
      {[...grupos]
        .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
        .map(([categoria, lista]) => (
          <optgroup key={categoria} label={categoria}>
            {lista.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome} — {formatarQtd(m.saldoEstimado)} {m.unidade}
              </option>
            ))}
          </optgroup>
        ))}
    </>
  );
}

import { useSearchParams } from "react-router-dom";

/** Aba e outros filtros guardados na URL (?aba=…): a tela fica linkável e o voltar do navegador funciona. */
export function useParametro<T extends string>(nome: string, validos: readonly T[], padrao: T): [T, (v: T) => void] {
  const [params, setParams] = useSearchParams();
  const bruto = params.get(nome);
  const valor = validos.includes(bruto as T) ? (bruto as T) : padrao;
  const mudar = (v: T) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (v === padrao) n.delete(nome);
        else n.set(nome, v);
        return n;
      },
      { replace: true },
    );
  return [valor, mudar];
}

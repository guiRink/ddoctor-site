import { normalizarPlaca } from "@compartilhado/dominio/placa";

/**
 * Placa no formato Mercosul — o identificador visual de cada carro em todo o painel
 * (docs/painel-design.md §3). Faixa azul com "BRASIL", corpo branco, caracteres largos.
 */
type Tamanho = "p" | "m" | "g" | "tv";

const TAMANHOS: Record<Tamanho, { caixa: string; faixa: string; texto: string; letras: string }> = {
  p: { caixa: "w-[96px] border-[1.5px]", faixa: "h-[7px] text-[5px]", texto: "text-[14px] py-[1px]", letras: "tracking-[0.05em]" },
  m: { caixa: "w-[122px] border-[1.5px]", faixa: "h-[9px] text-[6px]", texto: "text-[18px] py-[2px]", letras: "tracking-[0.05em]" },
  g: { caixa: "w-[180px] border-2", faixa: "h-[13px] text-[8px]", texto: "text-[27px] py-[3px]", letras: "tracking-[0.05em]" },
  tv: { caixa: "w-[264px] border-[3px]", faixa: "h-[18px] text-[11px]", texto: "text-[36px] py-[5px]", letras: "tracking-[0.05em]" },
};

export function Placa({ placa, tamanho = "p", className = "" }: { placa: string; tamanho?: Tamanho; className?: string }) {
  const t = TAMANHOS[tamanho];
  const valor = normalizarPlaca(placa);
  return (
    <span
      className={`inline-flex flex-col shrink-0 bg-cartao border-preto select-all ${t.caixa} ${className}`}
      role="img"
      aria-label={`Placa ${valor.split("").join(" ")}`}
    >
      <span
        aria-hidden="true"
        className={`flex items-center justify-center bg-maxpar text-white font-bold leading-none tracking-[0.25em] ${t.faixa}`}
      >
        BRASIL
      </span>
      <span
        aria-hidden="true"
        className={`text-center text-preto font-bold leading-none numero ${t.texto} ${t.letras}`}
        style={{ fontVariationSettings: '"wdth" 112' }}
      >
        {valor}
      </span>
    </span>
  );
}

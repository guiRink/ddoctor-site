import { normalizarPlaca } from "@compartilhado/dominio/placa";

/**
 * Placa no formato Mercosul — o identificador visual de cada carro em todo o painel
 * (docs/painel-design.md §3). Faixa azul com "BRASIL", corpo branco, caracteres largos.
 */
type Tamanho = "p" | "m" | "g" | "tv";

// `largura` é fixa por tamanho; com `encolher` vira o máximo e a placa cabe em colunas estreitas
// (ex.: grade da Agenda em 1366 px). A fonte não muda: a sequência mais larga (ex.: QPZ6M77)
// e a pior (WWW8W88) cabem dentro da borda no mínimo de cada tamanho (medido).
// Raio de placa real (~4 px no tamanho m), proporcional ao tamanho; não segue o raio dos cartões.
const TAMANHOS: Record<Tamanho, { largura: string; maximo: string; borda: string; faixa: string; texto: string }> = {
  p: { largura: "w-[96px]", maximo: "max-w-[96px] min-w-[92px]", borda: "border-[1.5px] rounded-[3px]", faixa: "h-[8px] text-[6px]", texto: "text-[14px] py-[1px]" },
  m: { largura: "w-[122px]", maximo: "max-w-[122px] min-w-[116px]", borda: "border-[1.5px] rounded-[4px]", faixa: "h-[10px] text-[7px]", texto: "text-[18px] py-[2px]" },
  g: { largura: "w-[180px]", maximo: "max-w-[180px] min-w-[170px]", borda: "border-2 rounded-[5px]", faixa: "h-[14px] text-[9px]", texto: "text-[27px] py-[3px]" },
  tv: { largura: "w-[264px]", maximo: "max-w-[264px] min-w-[240px]", borda: "border-[3px] rounded-[7px]", faixa: "h-[20px] text-[12px]", texto: "text-[36px] py-[4px]" },
};

export function Placa({
  placa,
  tamanho = "p",
  encolher = false,
  className = "",
}: {
  placa: string;
  tamanho?: Tamanho;
  encolher?: boolean;
  className?: string;
}) {
  const t = TAMANHOS[tamanho];
  const valor = normalizarPlaca(placa);
  return (
    <span
      className={`inline-flex flex-col bg-cartao border-preto select-all overflow-hidden ${t.borda} ${
        encolher ? `w-full ${t.maximo}` : `shrink-0 ${t.largura}`
      } ${className}`}
      role="img"
      aria-label={`Placa ${valor.split("").join(" ")}`}
    >
      <span
        aria-hidden="true"
        className={`flex items-center justify-center bg-maxpar text-cartao font-bold leading-none tracking-[0.3em] pl-[0.3em] ${t.faixa}`}
      >
        BRASIL
      </span>
      <span
        aria-hidden="true"
        className={`text-center text-preto font-bold leading-none numero whitespace-nowrap tracking-[0.05em] pl-[0.05em] ${t.texto}`}
        style={{ fontVariationSettings: '"wdth" 106' }}
      >
        {valor}
      </span>
    </span>
  );
}

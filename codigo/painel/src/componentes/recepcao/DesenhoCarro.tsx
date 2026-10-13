import type { VistaAvaria } from "@compartilhado/tipos";

/**
 * Desenho de um carro genérico (sedã) em 5 vistas, traço fino cinza, sem enfeite.
 * Todas as vistas ocupam o mesmo quadro 400 × 200 (proporção 2:1) para a altura não pular ao trocar de
 * aba e para a posição da avaria (x, y em 0..1) ser sempre relativa ao mesmo retângulo.
 * Lateral e teto: frente à esquerda na lateral esquerda e no teto; a lateral direita é o espelho.
 */
export const LARGURA_DESENHO = 400;
export const ALTURA_DESENHO = 200;

const CORPO = "fill-cartao stroke-tinta-fraca [stroke-width:1.5] [stroke-linejoin:round] [stroke-linecap:round]";
const VIDRO = "fill-cinza-100 stroke-tinta-fraca [stroke-width:1.25] [stroke-linejoin:round]";
const DETALHE = "fill-none stroke-linha-forte [stroke-width:1.25] [stroke-linejoin:round] [stroke-linecap:round]";
const PECA = "fill-cartao stroke-linha-forte [stroke-width:1.25]";
const PNEU = "fill-cinza-100 stroke-tinta-fraca [stroke-width:1.5]";

function Roda({ cx, cy }: { cx: number; cy: number }) {
  return (
    <>
      <circle className={PNEU} cx={cx} cy={cy} r={24} />
      <circle className={PECA} cx={cx} cy={cy} r={13} />
      <circle className={PNEU} cx={cx} cy={cy} r={3} />
    </>
  );
}

function Lateral() {
  return (
    <g transform="translate(0 6)">
      <path
        className={CORPO}
        d="M26 126 L58 126 A32 32 0 0 1 122 126 L278 126 A32 32 0 0 1 342 126 L372 126 Q382 126 382 116 L382 96 Q382 84 370 81 L348 77 Q326 56 300 46 Q290 42 276 41 L196 41 Q182 41 170 48 L136 72 Q92 76 50 84 Q24 89 20 104 L19 116 Q19 126 26 126 Z"
      />
      <path className={VIDRO} d="M146 74 L174 52 Q184 46 196 46 L232 46 L232 74 Z" />
      <path className={VIDRO} d="M240 46 L276 46 Q288 46 298 52 L330 74 L240 74 Z" />
      <path className={DETALHE} d="M236 76 L236 124 M140 77 Q137 100 141 124 M328 77 Q331 94 326 110 M30 97 Q200 89 378 93" />
      <rect className={PECA} x="200" y="84" width="16" height="4" rx="2" />
      <rect className={PECA} x="292" y="84" width="16" height="4" rx="2" />
      <path className={VIDRO} d="M140 74 L150 64 L158 66 L156 74 Z" />
      <path className={DETALHE} d="M21 99 Q30 95 44 94 L46 101 Q32 103 21 105 M382 86 L373 86 Q371 92 373 98 L382 98" />
      <Roda cx={90} cy={130} />
      <Roda cx={310} cy={130} />
    </g>
  );
}

function Frente() {
  return (
    <g transform="translate(50 0)">
      <rect className={PNEU} x="44" y="146" width="34" height="38" rx="6" />
      <rect className={PNEU} x="222" y="146" width="34" height="38" rx="6" />
      <path className={CORPO} d="M64 92 L84 48 Q88 40 98 40 L202 40 Q212 40 216 48 L236 92 Z" />
      <path className={VIDRO} d="M78 88 L94 54 Q97 48 104 48 L196 48 Q203 48 206 54 L222 88 Z" />
      <path className={CORPO} d="M38 96 Q40 90 50 90 L250 90 Q260 90 262 96 L268 116 L268 152 Q268 160 260 160 L40 160 Q32 160 32 152 L32 116 Z" />
      <path className={VIDRO} d="M28 82 L46 80 L48 92 L30 94 Q26 88 28 82 Z" />
      <path className={VIDRO} d="M272 82 L254 80 L252 92 L270 94 Q274 88 272 82 Z" />
      <path className={PECA} d="M42 104 L92 108 L88 122 L44 120 Q40 112 42 104 Z" />
      <path className={PECA} d="M258 104 L208 108 L212 122 L256 120 Q260 112 258 104 Z" />
      <rect className={PECA} x="108" y="108" width="84" height="24" rx="5" />
      <path className={DETALHE} d="M114 116 L186 116 M114 124 L186 124" />
      <rect className={PECA} x="126" y="138" width="48" height="12" rx="2" />
      <path className={DETALHE} d="M50 92 Q150 98 250 92 M60 146 L104 146 M196 146 L240 146" />
    </g>
  );
}

function Traseira() {
  return (
    <g transform="translate(50 0)">
      <rect className={PNEU} x="44" y="146" width="34" height="38" rx="6" />
      <rect className={PNEU} x="222" y="146" width="34" height="38" rx="6" />
      <path className={CORPO} d="M66 92 L86 50 Q90 42 100 42 L200 42 Q210 42 214 50 L234 92 Z" />
      <path className={VIDRO} d="M82 86 L96 56 Q99 50 106 50 L194 50 Q201 50 204 56 L218 86 Z" />
      <path className={CORPO} d="M38 96 Q40 90 50 90 L250 90 Q260 90 262 96 L268 116 L268 152 Q268 160 260 160 L40 160 Q32 160 32 152 L32 116 Z" />
      <path className={VIDRO} d="M28 82 L46 80 L48 92 L30 94 Q26 88 28 82 Z" />
      <path className={VIDRO} d="M272 82 L254 80 L252 92 L270 94 Q274 88 272 82 Z" />
      <path className={PECA} d="M38 100 L96 102 L96 118 L40 116 Q36 108 38 100 Z" />
      <path className={PECA} d="M262 100 L204 102 L204 118 L260 116 Q264 108 262 100 Z" />
      <path className={DETALHE} d="M96 110 L204 110 M50 144 L250 144" />
      <rect className={PECA} x="122" y="122" width="56" height="16" rx="2" />
    </g>
  );
}

function Teto() {
  return (
    <g>
      <path
        className={CORPO}
        d="M40 100 Q40 56 74 48 Q100 42 140 40 L320 40 Q368 42 374 70 Q378 100 374 130 Q368 158 320 160 L140 160 Q100 158 74 152 Q40 144 40 100 Z"
      />
      <path className={VIDRO} d="M120 36 L132 36 L134 42 L122 44 Z" />
      <path className={VIDRO} d="M120 164 L132 164 L134 158 L122 156 Z" />
      <path className={VIDRO} d="M128 56 Q122 100 128 144 L168 136 Q164 100 168 64 Z" />
      <rect className={PECA} x="172" y="62" width="120" height="76" rx="10" />
      <path className={VIDRO} d="M296 64 Q300 100 296 136 L330 144 Q336 100 330 56 Z" />
      <path className={DETALHE} d="M48 80 Q84 70 124 62 M48 120 Q84 130 124 138 M340 64 Q352 70 366 76 M340 136 Q352 130 366 124 M172 48 L300 48 M172 152 L300 152" />
    </g>
  );
}

/** SVG de uma vista. Decorativo: quem usa dá o nome acessível ao contêiner. */
export function DesenhoCarro({ vista, className = "" }: { vista: VistaAvaria; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${LARGURA_DESENHO} ${ALTURA_DESENHO}`}
      className={`block w-full h-auto ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      {vista === "lateral_esquerda" && <Lateral />}
      {vista === "lateral_direita" && (
        <g transform={`translate(${LARGURA_DESENHO} 0) scale(-1 1)`}>
          <Lateral />
        </g>
      )}
      {vista === "frente" && <Frente />}
      {vista === "traseira" && <Traseira />}
      {vista === "teto" && <Teto />}
    </svg>
  );
}

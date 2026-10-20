// Ícones desenhados no mesmo traço (1,75 px, pontas e cantos arredondados, grade 24), sem biblioteca externa.
// Revisão SE: o traço ficou mais leve e arredondado para combinar com a direção clean.
const CAMINHOS = {
  geral: "M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z",
  orcamentos: "M5 3h10l4 4v14H5zM15 3v4h4M8 11h8M8 15h8M8 19h5",
  agenda: "M4 5h16v15H4zM4 9h16M9 3v4M15 3v4M8 13h3M13 13h3M8 16h3",
  vistorias: "M3 7h4l2-3h6l2 3h4v13H3zM12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  producao: "M3 4h5v16H3zM10 4h5v10h-5zM17 4h4v6h-4z",
  funcionarios: "M9 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM3 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2M16 4a3 3 0 0 1 0 6M18 13a5 5 0 0 1 3 5v2",
  estoque: "M3 8l9-5 9 5v12H3zM3 8h18M9 20v-7h6v7",
  recebiveis: "M3 6h18v12H3zM3 10h18M7 15h4M15 15h2",
  financeiro: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  ajustes: "M4 6h8M16 6h4M4 12h2M10 12h10M4 18h10M18 18h2M14 4v4M8 10v4M16 16v4",
  pendencias: "M12 3 2 21h20L12 3zM12 10v5M12 18v.5",
  busca: "M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM14.5 14.5 20 20",
  sair: "M10 4H4v16h6M14 8l4 4-4 4M8 12h10",
  mais: "M12 5v14M5 12h14",
  fechar: "M6 6l12 12M18 6 6 18",
  seta: "M4 12h15M13 6l6 6-6 6",
  voltar: "M20 12H5M11 6l-6 6 6 6",
  baixo: "M6 9l6 6 6-6",
  alerta: "M12 3 2 21h20L12 3zM12 10v5M12 18v.5",
  ok: "M4 12l5 5L20 7",
  play: "M7 4v16l13-8z",
  pausa: "M7 4h4v16H7zM13 4h4v16h-4z",
  camera: "M3 7h4l2-3h6l2 3h4v13H3zM12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  tv: "M3 5h18v12H3zM8 21h8M12 17v4",
  celular: "M7 2h10v20H7zM11 18h2",
  relogio: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 3",
  carro: "M3 16v-4l2-5h14l2 5v4zM3 16v3h3v-3M18 16v3h3v-3M6 13h2M16 13h2",
  documento: "M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h4",
  telefone: "M5 3h4l2 5-3 2a11 11 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z",
  externo: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  filtro: "M3 5h18l-7 8v6l-4 2v-8z",
  pessoa: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1",
  bloqueio: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.6 5.6l12.8 12.8",
  copiar: "M8 8h12v12H8zM4 16V4h12",
  sol: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4",
  lua: "M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z",
  automatico: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3v18M12 8h4.5M12 12h6M12 16h4.5",
  whatsapp: "M4 20l1.3-4A8 8 0 1 1 8 18.7zM9 9c0 3 3 6 6 6l1.5-1.5-2-1-1 1a4 4 0 0 1-2-2l1-1-1-2z",
} as const;

export type NomeIcone = keyof typeof CAMINHOS;

export function Icone({
  nome,
  tamanho = 18,
  traco = 1.75,
  className,
}: {
  nome: NomeIcone;
  tamanho?: number;
  /** Espessura do traço; 2 na TV e em ícones de 14 px ou menos. */
  traco?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={tamanho}
      height={tamanho}
      fill="none"
      stroke="currentColor"
      strokeWidth={traco}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={CAMINHOS[nome]} />
    </svg>
  );
}

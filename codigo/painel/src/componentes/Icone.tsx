// Ícones desenhados no mesmo traço (2px, cantos retos), sem biblioteca externa.
const CAMINHOS = {
  patio: "M3 7h18v12H3zM3 12h18M8 7v12M16 7v12",
  atendimentos: "M4 5h16v14H4zM8 9h8M8 13h8M8 17h5",
  agenda: "M4 6h16v14H4zM4 10h16M9 3v5M15 3v5",
  pendencias: "M12 3 2 21h20L12 3zM12 10v5M12 18v.5",
  financeiro: "M3 6h18v12H3zM3 10h18M7 15h3",
  ajustes: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
  busca: "M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM14.5 14.5 20 20",
  sair: "M10 4H4v16h6M14 8l4 4-4 4M8 12h10",
  mais: "M12 5v14M5 12h14",
  seta: "M4 12h15M13 6l6 6-6 6",
  alerta: "M12 3 2 21h20L12 3zM12 10v5M12 18v.5",
  ok: "M4 12l5 5L20 7",
} as const;

export type NomeIcone = keyof typeof CAMINHOS;

export function Icone({ nome, tamanho = 18, className }: { nome: NomeIcone; tamanho?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={tamanho}
      height={tamanho}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      className={className}
    >
      <path d={CAMINHOS[nome]} />
    </svg>
  );
}

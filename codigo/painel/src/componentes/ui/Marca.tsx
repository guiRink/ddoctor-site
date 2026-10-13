/** Marca: o D da oficina em preto sobre quadrado amarelo (raio de controle). */
export function MarcaD({ tamanho = 28 }: { tamanho?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-grid place-items-center shrink-0 rounded-controle bg-amarelo text-preto"
      style={{ width: tamanho, height: tamanho }}
    >
      <svg viewBox="0 0 80 80" width={tamanho * 0.56} height={tamanho * 0.56}>
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M0 0h42c21 0 38 18 38 40S63 80 42 80H0V0Zm20 21v38h21c10.5 0 19-8.5 19-19s-8.5-19-19-19H20Z"
        />
      </svg>
    </span>
  );
}

// Placa do veículo: Mercosul (AAA0A00) ou antiga (AAA0000), exatamente 7 caracteres depois de normalizar.

const PLACA = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/;

/** Maiúscula, só letras e dígitos. Não trunca: o tamanho errado precisa aparecer na validação. */
export function normalizarPlaca(valor: string): string {
  return valor.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function placaValida(valor: string): boolean {
  return PLACA.test(normalizarPlaca(valor));
}

/** "ABC-1D23" quando válida; senão devolve o normalizado (útil durante a digitação). */
export function formatarPlaca(valor: string): string {
  const p = normalizarPlaca(valor);
  return PLACA.test(p) ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
}

// Gráficos simples em HTML/CSS (sem biblioteca): barras horizontais de escala comum, rótulo direto.
// Revisão SE: trilho `cinza-100`/`cinza-200` com pontas arredondadas; sem preto (preto é só placa e TV).

/**
 * Previsto × pago numa mesma linha: o trilho mostra o previsto (`cinza-200`) e o
 * preenchimento `tinta-suave` mostra o pago. `max` é comum a todas as linhas da lista.
 */
export function BarraPrevistoPago({ previsto, pago, max }: { previsto: number; pago: number; max: number }) {
  const p = max > 0 ? (previsto / max) * 100 : 0;
  const q = previsto > 0 ? Math.min(100, (pago / previsto) * 100) : 0;
  return (
    <div className="h-2.5 w-full" aria-hidden="true">
      <div className="h-full bg-cinza-200 rounded-full overflow-hidden" style={{ width: `${Math.max(p, previsto > 0 ? 1 : 0)}%` }}>
        <div className="h-full bg-tinta-suave rounded-full" style={{ width: `${q}%` }} />
      </div>
    </div>
  );
}

/**
 * Saldo estimado contra o mínimo: escala = maior entre saldo e 2× mínimo; um traço vertical marca o mínimo.
 * Preenchimento `tinta-fraca` quando ok, `atencao` abaixo do mínimo; zerado não tem preenchimento.
 */
export function BarraSaldo({ saldo, minimo }: { saldo: number; minimo: number }) {
  const escala = Math.max(saldo, minimo * 2, 1);
  const largura = Math.max(0, Math.min(100, (saldo / escala) * 100));
  const marca = Math.min(100, (minimo / escala) * 100);
  const abaixo = saldo < minimo;
  return (
    <div className="relative h-2 w-full bg-cinza-100 rounded-full" aria-hidden="true">
      <div className={`h-full rounded-full ${abaixo ? "bg-atencao" : "bg-tinta-fraca"}`} style={{ width: `${largura}%` }} />
      {minimo > 0 && <span className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-tinta-suave" style={{ left: `calc(${marca}% - 1px)` }} />}
    </div>
  );
}

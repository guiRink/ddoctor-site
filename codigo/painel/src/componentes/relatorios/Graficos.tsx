import { useState, type ReactNode } from "react";
import { caminhoBarra, escalaBonita, useLarguraDe } from "./escala";

// Gráficos do painel (revisão SE): SVG próprio, sem biblioteca. Eixos discretos, números tabulares,
// colunas em `tinta-suave` (cinza-escuro suave), destaque em amarelo só para "hoje", excesso em `alerta`.
// Cada gráfico traz uma tabela só para leitor de tela com os mesmos números.

// ------------------------------------------------------------------ colunas (valor por dia)

export interface Coluna {
  chave: string;
  /** Rótulo do eixo x (curto: "13"). */
  rotulo: string;
  valor: number;
  /** Texto da dica e da tabela acessível ("ter 13/10"). */
  nome: string;
  destaque?: boolean; // "hoje"
  apagada?: boolean; // dia sem expediente
}

export function GraficoColunas({
  titulo,
  colunas,
  formatar,
  formatarEixo = formatar,
  altura = 220,
  rotuloACada,
}: {
  titulo: string;
  colunas: Coluna[];
  formatar: (v: number) => string;
  formatarEixo?: (v: number) => string;
  altura?: number;
  /** Mostra o rótulo do eixo x só a cada n colunas (o destaque sempre aparece). */
  rotuloACada?: number;
}) {
  const [ref, largura] = useLarguraDe<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);
  const maximo = Math.max(0, ...colunas.map((c) => c.valor));
  const { topo, passo } = escalaBonita(maximo);
  const margem = { esq: 64, dir: 4, topo: 12, base: 26 };
  const w = Math.max(0, largura - margem.esq - margem.dir);
  const h = altura - margem.topo - margem.base;
  const slot = colunas.length ? w / colunas.length : 0;
  const barra = Math.max(2, Math.min(28, slot * 0.62));
  const y = (v: number) => margem.topo + h - (topo > 0 ? (v / topo) * h : 0);
  const ticks = Array.from({ length: Math.round(topo / passo) + 1 }, (_, i) => i * passo);
  const cada = rotuloACada ?? Math.max(1, Math.ceil(22 / Math.max(slot, 1)));
  const ativa = foco !== null ? colunas[foco] : undefined;

  return (
    <figure className="m-0">
      <div ref={ref} className="relative w-full" style={{ height: altura }} onMouseLeave={() => setFoco(null)}>
        {largura > 0 && (
          <svg width={largura} height={altura} aria-hidden="true" className="block overflow-visible">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={margem.esq} x2={largura - margem.dir} y1={y(t)} y2={y(t)} className={t === 0 ? "stroke-linha-forte" : "stroke-linha"} strokeWidth={1} />
                <text x={margem.esq - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-tinta-fraca text-[11px] numero">
                  {formatarEixo(t)}
                </text>
              </g>
            ))}
            {colunas.map((c, i) => {
              const cx = margem.esq + slot * i + slot / 2;
              const altBarra = topo > 0 ? (c.valor / topo) * h : 0;
              // o rótulo do destaque sempre aparece; os vizinhos próximos a ele somem para não encostar
              const pertoDoDestaque = colunas.some((o, j) => o.destaque && j !== i && Math.abs(j - i) < cada);
              const mostrarRotulo = c.destaque || (i % cada === 0 && !pertoDoDestaque);
              return (
                <g key={c.chave}>
                  {c.destaque && <rect x={cx - slot / 2 + 1} y={margem.topo} width={Math.max(0, slot - 2)} height={h} rx={4} className="fill-amarelo-claro" />}
                  <path
                    d={caminhoBarra(cx - barra / 2, y(c.valor), barra, altBarra)}
                    className={`transition-colors duration-150 ${foco === i ? "fill-tinta" : "fill-tinta-suave"}`}
                  />
                  {mostrarRotulo && (
                    <text
                      x={cx}
                      y={altura - 8}
                      textAnchor="middle"
                      className={`text-[11px] numero ${c.destaque ? "fill-amarelo-tinta font-semibold" : c.apagada ? "fill-linha-forte" : "fill-tinta-fraca"}`}
                    >
                      {c.rotulo}
                    </text>
                  )}
                  {/* alvo de hover cobrindo a coluna inteira */}
                  <rect x={cx - slot / 2} y={margem.topo} width={slot} height={h} fill="transparent" onMouseEnter={() => setFoco(i)} />
                </g>
              );
            })}
          </svg>
        )}
        {ativa && foco !== null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full px-2.5 py-1.5 rounded-controle bg-cartao border border-linha elevacao text-[12px] whitespace-nowrap"
            style={{ left: margem.esq + slot * foco + slot / 2, top: Math.max(0, y(ativa.valor) - 6) }}
          >
            <span className="text-tinta-suave">{ativa.nome}</span> <span className="font-semibold numero">{formatar(ativa.valor)}</span>
          </div>
        )}
      </div>
      <TabelaAcessivel titulo={titulo} linhas={colunas.map((c) => [c.nome, formatar(c.valor)])} />
    </figure>
  );
}

// ------------------------------------------------------------------ barras horizontais (participação)

export interface ItemBarra {
  chave: string;
  rotulo: ReactNode;
  valor: number;
  detalhe?: ReactNode; // "3 recebimentos"
}

/** Barras horizontais com escala comum (o maior = 100 %), valor e participação à direita. */
export function BarrasHorizontais({ itens, formatar, total }: { itens: ItemBarra[]; formatar: (v: number) => string; total?: number }) {
  const maximo = Math.max(0, ...itens.map((i) => i.valor));
  const soma = total ?? itens.reduce((s, i) => s + i.valor, 0);
  return (
    <ul className="@container flex flex-col">
      {itens.map((i) => {
        const largura = maximo > 0 ? Math.max(1.5, (i.valor / maximo) * 100) : 0;
        const parte = soma > 0 ? Math.round((i.valor / soma) * 100) : 0;
        return (
          <li key={i.chave} className="grid grid-cols-[minmax(0,1fr)_auto] @xl:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3 border-b border-linha last:border-b-0">
            <span className="min-w-0">
              <span className="block text-[14px] font-medium truncate">{i.rotulo}</span>
              {i.detalhe && <span className="block text-[12px] text-tinta-suave numero">{i.detalhe}</span>}
            </span>
            <span className="col-span-2 row-start-2 @xl:col-span-1 @xl:row-start-auto h-1.5 rounded-full bg-cinza-100" aria-hidden="true">
              <span className="block h-full rounded-full bg-tinta-suave" style={{ width: `${largura}%` }} />
            </span>
            <span className="col-start-2 row-start-1 @xl:col-start-auto @xl:row-start-auto text-right whitespace-nowrap">
              <span className="block text-[14px] font-semibold numero">{formatar(i.valor)}</span>
              <span className="block text-[12px] text-tinta-fraca numero">{parte} %</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Tabela invisível com os números do gráfico (leitor de tela). */
export function TabelaAcessivel({ titulo, linhas }: { titulo: string; linhas: string[][] }) {
  return (
    <table className="sr-only">
      <caption>{titulo}</caption>
      <tbody>
        {linhas.map((l, i) => (
          <tr key={i}>
            {l.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

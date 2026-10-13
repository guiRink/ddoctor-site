import { useState } from "react";
import type { ConfigOficina, DataISO } from "@compartilhado/tipos";
import { capacidadePecasDia } from "@compartilhado/dominio/config";
import { diaSemana } from "@compartilhado/dominio/fuso";
import { producaoPrevista, proximosDiasUteis, type DiaPrevisto } from "@compartilhado/dominio/producao";
import type { OSVisao } from "../../dados/repositorio";
import { Cartao } from "../ui/Basicos";
import { Etiqueta, Provisorio } from "../ui/Estado";
import { dataCurta, diaCurto } from "../orcamentos/formato";
import { TabelaAcessivel } from "../relatorios/Graficos";
import { caminhoBarra, escalaBonita, useLarguraDe } from "../relatorios/escala";
import { itensProducao } from "./selecoes";

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Produção prevista: peças com entrega em cada um dos próximos dias úteis contra a capacidade de
 * peças/dia (provisória). Barras em `tinta-suave`; o que passa da capacidade em `alerta`; hoje em amarelo-claro.
 */
export function ProducaoPrevista({ oss, config, hoje }: { oss: OSVisao[]; config: ConfigOficina; hoje: DataISO }) {
  const [ref, largura] = useLarguraDe<HTMLDivElement>();
  const n = largura > 0 && largura < 520 ? 6 : 12;
  const capacidade = capacidadePecasDia(config);
  const dias = proximosDiasUteis(hoje, n, config);
  const prev = producaoPrevista(itensProducao(oss), dias, capacidade);
  const acima = prev.dias.filter((d) => d.excesso > 0).length;
  const total = prev.dias.reduce((s, d) => s + d.pecas, 0);

  return (
    <Cartao
      titulo="Produção prevista"
      acao={
        acima > 0 ? (
          <Etiqueta tom="alerta">{plural(acima, "dia acima", "dias acima")} da capacidade</Etiqueta>
        ) : (
          <Etiqueta tom="ok">Dentro da capacidade</Etiqueta>
        )
      }
    >
      <div className="px-4 pt-3 pb-1">
        <p className="text-[13px] text-tinta-suave numero">
          Próximos {n} dias úteis · capacidade <Provisorio>{capacidade} peças/dia</Provisorio>{" "}
          <span className="text-tinta-fraca">· provisório — a confirmar</span>
        </p>
      </div>
      <div className="px-4 pt-2">
        <div ref={ref}>{largura > 0 && <Grafico dias={prev.dias} capacidade={capacidade} largura={largura} hoje={hoje} />}</div>
        <TabelaAcessivel
          titulo={`Peças previstas por dia útil; capacidade ${capacidade} por dia`}
          linhas={prev.dias.map((d) => [diaCurto(d.data), `${plural(d.pecas, "peça", "peças")} em ${plural(d.os, "carro", "carros")}${d.excesso ? `, ${d.excesso} acima da capacidade` : ""}`])}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 border-t border-linha text-[12px] text-tinta-suave">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="w-2.5 h-2.5 rounded-[2px] bg-tinta-suave" />
          Peças previstas <span className="numero text-tinta-fraca">· {total}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="w-2.5 h-2.5 rounded-[2px] bg-alerta" />
          Acima da capacidade
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="w-3.5 border-t border-dashed border-tinta" />
          Capacidade
        </span>
        <Notas atrasadas={prev.pecasAtrasadas} semPrevisao={prev.semPrevisao} fora={prev.foraDoPeriodo} ultimo={dias.at(-1)} />
      </div>
    </Cartao>
  );
}

function Notas({ atrasadas, semPrevisao, fora, ultimo }: { atrasadas: number; semPrevisao: number; fora: number; ultimo?: DataISO }) {
  const notas: { texto: string; alerta?: boolean }[] = [];
  if (atrasadas) notas.push({ texto: `${plural(atrasadas, "peça atrasada somada", "peças atrasadas somadas")} a hoje`, alerta: true });
  if (semPrevisao) notas.push({ texto: `${plural(semPrevisao, "carro", "carros")} sem previsão de entrega` });
  if (fora && ultimo) notas.push({ texto: `${plural(fora, "carro", "carros")} com entrega depois de ${dataCurta(ultimo)}` });
  if (!notas.length) return null;
  return (
    <span className="flex flex-wrap gap-x-4 gap-y-1 md:ml-auto">
      {notas.map((nota) => (
        <span key={nota.texto} className={`numero ${nota.alerta ? "text-alerta font-medium" : ""}`}>
          {nota.texto}
        </span>
      ))}
    </span>
  );
}

function Grafico({ dias, capacidade, largura, hoje }: { dias: DiaPrevisto[]; capacidade: number; largura: number; hoje: DataISO }) {
  const [foco, setFoco] = useState<number | null>(null);
  const altura = 208;
  const m = { esq: 28, dir: 4, topo: 22, base: 40 };
  const w = largura - m.esq - m.dir;
  const h = altura - m.topo - m.base;
  const { topo, passo } = escalaBonita(Math.max(capacidade * 1.25, ...dias.map((d) => d.pecas)), 4);
  const y = (v: number) => m.topo + h - (v / topo) * h;
  const slot = dias.length ? w / dias.length : 0;
  const barra = Math.min(36, slot * 0.56);
  const ticks = Array.from({ length: Math.round(topo / passo) + 1 }, (_, i) => i * passo);
  const ativo = foco !== null ? dias[foco] : undefined;

  return (
    <div className="relative" onMouseLeave={() => setFoco(null)}>
      <svg width={largura} height={altura} aria-hidden="true" className="block overflow-visible">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.esq} x2={largura - m.dir} y1={y(t)} y2={y(t)} className={t === 0 ? "stroke-linha-forte" : "stroke-linha"} />
            <text x={m.esq - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-tinta-fraca text-[11px] numero">
              {t}
            </text>
          </g>
        ))}
        {dias.map((d, i) => {
          const cx = m.esq + slot * i + slot / 2;
          const x = cx - barra / 2;
          const dentro = Math.min(d.pecas, d.capacidade);
          const ehHoje = d.data === hoje;
          return (
            <g key={d.data}>
              {ehHoje && <rect x={cx - slot / 2 + 2} y={m.topo - 8} width={Math.max(0, slot - 4)} height={h + 8 + m.base - 2} rx={6} className="fill-amarelo-claro" />}
              {/* parte dentro da capacidade: cantos de cima só se não houver excesso */}
              {d.excesso > 0 ? (
                <rect x={x} y={y(dentro)} width={barra} height={(dentro / topo) * h} className={foco === i ? "fill-tinta" : "fill-tinta-suave"} />
              ) : (
                <path d={caminhoBarra(x, y(dentro), barra, (dentro / topo) * h)} className={`transition-colors duration-150 ${foco === i ? "fill-tinta" : "fill-tinta-suave"}`} />
              )}
              {d.excesso > 0 && <path d={caminhoBarra(x, y(d.pecas), barra, (d.excesso / topo) * h - 1)} className="fill-alerta" />}
              {d.pecas > 0 && (
                <text x={cx} y={y(d.pecas) - 6} textAnchor="middle" className={`text-[12px] numero ${d.excesso > 0 ? "fill-alerta font-semibold" : "fill-tinta font-medium"}`}>
                  {d.pecas}
                </text>
              )}
              <text x={cx} y={altura - 22} textAnchor="middle" className={`text-[11px] ${ehHoje ? "fill-amarelo-tinta font-semibold" : "fill-tinta-fraca"}`}>
                {ehHoje ? "hoje" : SEMANA[diaSemana(d.data)]}
              </text>
              <text x={cx} y={altura - 8} textAnchor="middle" className={`text-[11px] numero ${ehHoje ? "fill-amarelo-tinta font-semibold" : "fill-tinta-suave"}`}>
                {dataCurta(d.data)}
              </text>
              <rect x={cx - slot / 2} y={m.topo} width={slot} height={h} fill="transparent" onMouseEnter={() => setFoco(i)} />
            </g>
          );
        })}
        {/* linha da capacidade por cima das barras */}
        <line x1={m.esq} x2={largura - m.dir} y1={y(capacidade)} y2={y(capacidade)} className="stroke-tinta" strokeDasharray="4 4" strokeWidth={1.25} />
      </svg>
      {ativo && foco !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full px-2.5 py-1.5 rounded-controle bg-cartao border border-linha elevacao text-[12px] whitespace-nowrap numero"
          style={{ left: m.esq + slot * foco + slot / 2, top: Math.max(0, y(ativo.pecas) - 22) }}
        >
          <span className="font-semibold">{diaCurto(ativo.data)}</span>
          <span className="text-tinta-suave">
            {" "}
            · {plural(ativo.pecas, "peça", "peças")} · {plural(ativo.os, "carro", "carros")}
          </span>
          {ativo.excesso > 0 && <span className="text-alerta font-medium"> · {ativo.excesso} acima</span>}
        </div>
      )}
    </div>
  );
}

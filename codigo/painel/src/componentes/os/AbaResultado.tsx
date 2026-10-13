import type { ReactNode } from "react";
import { resultadoOS } from "@compartilhado/dominio/custos";
import { formatarReais } from "@compartilhado/dominio/dinheiro";
import type { OSVisao } from "../../dados/repositorio";
import { Cartao, FaixaIndicadores, Indicador } from "../ui/Basicos";
import { Icone } from "../Icone";
import { receitaOS } from "./formato";

const pct = (f: number | null) => (f === null ? "—" : `${(f * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);

/**
 * Aba Resultado (só dono, gestor e financeiro — veCustosOS): receita, custos por tipo e margem em R$ e %,
 * com barra de composição. Avisa quando ainda não há custo lançado (margem 100 % engana).
 */
export function AbaResultado({ v, onIrCustos }: { v: OSVisao; onIrCustos?: () => void }) {
  const receita = receitaOS(v);
  const r = resultadoOS(receita.valor, 0, v.custos);
  const externo = v.versoes.find((x) => x.estado === "aprovado")?.tipo === "externo";
  const negativa = r.margem < 0;
  const semCusto = v.custos.length === 0;

  const partes = [
    { nome: "Insumos", valor: r.custoInsumos, cor: "bg-tinta" },
    { nome: "Mão de obra", valor: r.custoMaoDeObra, cor: "bg-tinta-suave" },
    { nome: "Terceiros", valor: r.custoTerceiros, cor: "bg-tinta-fraca" },
    { nome: "Outros", valor: r.custoOutros, cor: "bg-linha-forte" },
  ];
  const base = Math.max(receita.valor, r.custoTotal, 1);

  return (
    <div className="flex flex-col gap-6">
      {!receita.aprovada && (
        <Nota>Ainda não há orçamento aprovado. A receita entra quando a aprovação for registrada.</Nota>
      )}
      {semCusto && receita.aprovada && (
        <Nota acao={onIrCustos && <button type="button" onClick={onIrCustos} className="font-semibold underline underline-offset-4 decoration-atencao/50 hover:decoration-atencao">Lançar custos</button>}>
          Nenhum custo lançado nesta OS. A margem abaixo ainda não desconta insumos nem mão de obra.
        </Nota>
      )}

      <FaixaIndicadores colunas={4}>
        <Indicador rotulo={externo ? "Receita (autorizado)" : "Receita (aprovado)"} valor={formatarReais(receita.valor)} detalhe={receita.complemento > 0 ? `inclui ${formatarReais(receita.complemento)} de complemento` : undefined} />
        <Indicador rotulo="Custos" valor={formatarReais(r.custoTotal)} detalhe={`${v.custos.length} ${v.custos.length === 1 ? "lançamento" : "lançamentos"}`} />
        <Indicador rotulo="Margem" valor={formatarReais(r.margem)} alerta={negativa} />
        <Indicador rotulo="Margem %" valor={pct(r.margemPct)} alerta={negativa} />
      </FaixaIndicadores>

      <Cartao titulo="Demonstrativo">
        <div className="p-4 flex flex-col gap-5 max-w-[672px]">
          {/* barra: custos por tipo + margem, sobre a receita (mesma largura do demonstrativo) */}
          <div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-cinza-100" aria-hidden="true">
              {partes.map((p) => (p.valor > 0 ? <span key={p.nome} className={p.cor} style={{ width: `${(p.valor / base) * 100}%` }} /> : null))}
              {r.margem > 0 && <span className="bg-ok" style={{ width: `${(r.margem / base) * 100}%` }} />}
            </div>
            {negativa && <p className="mt-2 text-[13px] font-medium text-alerta">Os custos passaram a receita em {formatarReais(-r.margem)}.</p>}
          </div>

          <dl className="m-0 w-full">
            <LinhaValor nome="Receita" valor={receita.valor} forte />
            {partes.map((p) => (
              <LinhaValor key={p.nome} nome={p.nome} valor={p.valor} cor={p.cor} recuo pctReceita={receita.valor > 0 ? p.valor / receita.valor : null} />
            ))}
            <LinhaValor nome="Custo total" valor={r.custoTotal} pctReceita={receita.valor > 0 ? r.custoTotal / receita.valor : null} />
            <LinhaValor nome="Margem" valor={r.margem} cor={negativa ? "bg-alerta" : "bg-ok"} forte final pctReceita={r.margemPct} alerta={negativa} />
          </dl>
        </div>
      </Cartao>
    </div>
  );
}

function LinhaValor({
  nome,
  valor,
  cor,
  forte = false,
  alerta = false,
  recuo = false,
  final = false,
  pctReceita,
}: {
  nome: string;
  valor: number;
  cor?: string;
  forte?: boolean;
  alerta?: boolean;
  /** Linha de detalhe (custos por tipo), com recuo e sinal de menos. */
  recuo?: boolean;
  /** Linha de resultado: traço forte acima, sem divisória abaixo. */
  final?: boolean;
  pctReceita?: number | null;
}) {
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_auto_56px] items-center gap-3 py-2.5 ${final ? "border-t border-tinta mt-1" : "border-b border-linha"}`}>
      <dt className={`flex items-center gap-2 text-[13px] ${forte ? "font-semibold text-tinta" : "font-medium text-tinta-suave"} ${recuo ? "pl-4" : ""}`}>
        {cor && <span aria-hidden="true" className={`inline-block w-2.5 h-2.5 rounded-[3px] ${cor}`} />}
        {nome}
      </dt>
      <dd className={`m-0 numero whitespace-nowrap text-right ${forte ? "text-[15px] font-semibold" : "text-[14px]"} ${alerta ? "text-alerta" : ""}`}>
        {recuo && valor > 0 ? "− " : ""}
        {formatarReais(valor)}
      </dd>
      <dd className="m-0 numero text-right text-[12px] text-tinta-fraca">{pctReceita !== undefined ? pct(pctReceita) : ""}</dd>
    </div>
  );
}

function Nota({ children, acao }: { children: ReactNode; acao?: ReactNode }) {
  return (
    <div role="note" className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 rounded-cartao border border-atencao/25 bg-atencao-claro text-atencao text-[13px] font-medium">
      <Icone nome="alerta" tamanho={16} className="shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
      {acao}
    </div>
  );
}

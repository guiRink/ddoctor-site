import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icone, type NomeIcone } from "../Icone";

// ------------------------------------------------------------------ botões

type Variante = "primario" | "secundario" | "contorno" | "perigo" | "fantasma";
type TamanhoBotao = "denso" | "padrao" | "grande";

const VARIANTE: Record<Variante, string> = {
  primario: "bg-amarelo text-preto hover:bg-amarelo-escuro active:bg-amarelo-escuro",
  secundario: "bg-preto text-papel hover:bg-grafite-3",
  contorno: "bg-cartao text-tinta border border-linha-forte hover:border-preto",
  perigo: "bg-cartao text-alerta border border-alerta hover:bg-alerta hover:text-cartao",
  fantasma: "bg-transparent text-tinta-suave hover:text-tinta hover:bg-linha",
};

const TAMANHO: Record<TamanhoBotao, string> = {
  denso: "h-11 md:h-9 px-3 text-[13px] gap-1.5",
  padrao: "h-11 px-4 text-[14px] gap-2",
  grande: "h-14 px-5 text-[16px] gap-2.5",
};

/** Botão só com ícone: quadrado na altura do tamanho (o ícone não encolhe). */
const QUADRADO: Record<TamanhoBotao, string> = {
  denso: "h-11 w-11 md:h-9 md:w-9 px-0",
  padrao: "h-11 w-11 px-0",
  grande: "h-14 w-14 px-0",
};

const BASE_BOTAO =
  "inline-flex items-center justify-center font-bold whitespace-nowrap transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none";

const temConteudo = (c: ReactNode) => c !== undefined && c !== null && c !== false && c !== "";

export function Botao({
  variante = "contorno",
  tamanho = "padrao",
  icone,
  className = "",
  children,
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; tamanho?: TamanhoBotao; icone?: NomeIcone; children?: ReactNode }) {
  return (
    <button
      type="button"
      className={`${BASE_BOTAO} ${VARIANTE[variante]} ${icone && !temConteudo(children) ? QUADRADO[tamanho] : TAMANHO[tamanho]} ${className}`}
      {...resto}
    >
      {icone && <Icone nome={icone} tamanho={tamanho === "grande" ? 22 : 18} className="shrink-0" />}
      {children}
    </button>
  );
}

export function BotaoLink({
  para,
  variante = "contorno",
  tamanho = "padrao",
  icone,
  className = "",
  children,
}: {
  para: string;
  variante?: Variante;
  tamanho?: TamanhoBotao;
  icone?: NomeIcone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={para} className={`${BASE_BOTAO} ${VARIANTE[variante]} ${TAMANHO[tamanho]} no-underline ${className}`}>
      {icone && <Icone nome={icone} tamanho={18} className="shrink-0" />}
      {children}
    </Link>
  );
}

// ------------------------------------------------------------------ estrutura

export function CabecalhoPagina({ titulo, resumo, acoes }: { titulo: string; resumo?: ReactNode; acoes?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 mb-6">
      <div className="min-w-0">
        <h1 className="titulo-condensado text-[32px]">{titulo}</h1>
        {resumo && <p className="mt-1.5 text-tinta-suave text-[14px]">{resumo}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2 empty:hidden">{acoes}</div>}
    </header>
  );
}

export function Cartao({
  titulo,
  contagem,
  acao,
  children,
  className = "",
  corpoClassName = "",
}: {
  titulo?: ReactNode;
  contagem?: number;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
  corpoClassName?: string;
}) {
  return (
    <section className={`bg-cartao border border-linha min-w-0 ${className}`}>
      {(titulo || acao) && (
        <header className="flex items-center justify-between gap-3 px-4 h-12 border-b border-linha">
          <h2 className="text-[15px] font-bold flex items-baseline gap-2 min-w-0">
            <span className="truncate">{titulo}</span>
            {contagem !== undefined && <span className="numero text-tinta-fraca font-semibold">{contagem}</span>}
          </h2>
          {acao}
        </header>
      )}
      <div className={corpoClassName}>{children}</div>
    </section>
  );
}

export function Campo({ nome, children }: { nome: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-2 border-b border-linha last:border-b-0">
      <dt className="rotulo text-tinta-fraca self-center">{nome}</dt>
      <dd className="m-0 text-[14px] break-words min-w-0">{children ?? <span className="text-tinta-fraca">—</span>}</dd>
    </div>
  );
}

// ------------------------------------------------------------------ pessoas

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

export function Responsavel({ nome, compacto = false, escuro = false }: { nome?: string; compacto?: boolean; escuro?: boolean }) {
  if (!nome) {
    return <span className={`text-[13px] ${escuro ? "text-papel-fraco" : "text-tinta-fraca"}`}>Sem responsável</span>;
  }
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <span
        aria-hidden="true"
        className={`inline-grid place-items-center shrink-0 w-7 h-7 text-[11px] font-bold ${escuro ? "bg-papel text-preto" : "bg-grafite text-papel"}`}
      >
        {iniciais(nome)}
      </span>
      {!compacto && <span className="text-[13px] font-semibold truncate">{nome}</span>}
      {compacto && <span className="sr-only">{nome}</span>}
    </span>
  );
}

// ------------------------------------------------------------------ estados de tela

export function Vazio({ titulo, texto, acao, icone = "ok" }: { titulo: string; texto?: string; acao?: ReactNode; icone?: NomeIcone }) {
  return (
    <div className="flex flex-col items-start gap-3 px-6 py-10">
      <span className="inline-grid place-items-center w-10 h-10 bg-papel text-tinta-suave">
        <Icone nome={icone} tamanho={20} />
      </span>
      <div>
        <p className="text-[16px] font-bold">{titulo}</p>
        {texto && <p className="mt-1 text-tinta-suave max-w-prose">{texto}</p>}
      </div>
      {acao}
    </div>
  );
}

export function Erro({ mensagem, onTentar }: { mensagem?: string; onTentar?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-4 px-5 py-4 bg-alerta-claro text-alerta border border-alerta/30">
      <Icone nome="alerta" />
      <p className="font-semibold">{mensagem ?? "Não consegui carregar os dados."}</p>
      {onTentar && (
        <Botao tamanho="denso" variante="contorno" onClick={onTentar}>
          Tentar de novo
        </Botao>
      )}
    </div>
  );
}

export function Esqueleto({ linhas = 4, altura = "h-12" }: { linhas?: number; altura?: string }) {
  return (
    <div role="status" aria-label="Carregando" className="flex flex-col gap-2">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className={`esqueleto ${altura}`} />
      ))}
    </div>
  );
}

/** Estado de consulta pronto para usar com TanStack Query. */
export function EstadoConsulta<T>({
  consulta,
  linhas,
  children,
}: {
  consulta: { data: T | undefined; isPending: boolean; isError: boolean; refetch: () => unknown };
  linhas?: number;
  children: (dados: T) => ReactNode;
}) {
  if (consulta.isPending) return <Esqueleto linhas={linhas} />;
  if (consulta.isError || consulta.data === undefined) return <Erro onTentar={() => consulta.refetch()} />;
  return <>{children(consulta.data)}</>;
}

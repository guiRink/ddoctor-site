import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icone, type NomeIcone } from "../Icone";

// ------------------------------------------------------------------ botões

type Variante = "primario" | "secundario" | "contorno" | "perigo" | "fantasma" | "escuro";
type TamanhoBotao = "denso" | "padrao" | "grande";

// Revisão SE: primário amarelo; secundário (= contorno) branco com borda; fantasma sem fundo;
// "escuro" para o raro neutro forte. Raio 6 (controle).
const VARIANTE: Record<Variante, string> = {
  primario: "bg-amarelo text-preto hover:bg-amarelo-escuro active:bg-amarelo-escuro",
  secundario: "bg-cartao text-tinta border border-linha-forte shadow-controle hover:bg-cinza-50 hover:border-tinta-fraca",
  contorno: "bg-cartao text-tinta border border-linha-forte shadow-controle hover:bg-cinza-50 hover:border-tinta-fraca",
  perigo: "bg-cartao text-alerta border border-alerta/35 shadow-controle hover:bg-alerta-claro hover:border-alerta",
  fantasma: "bg-transparent text-tinta-suave hover:text-tinta hover:bg-cinza-100",
  escuro: "bg-preto text-cartao hover:bg-grafite-3",
};

// Alturas: denso 36 (40 no celular), padrão 40 (44 no celular), grande 56 (produção no celular).
const TAMANHO: Record<TamanhoBotao, string> = {
  denso: "h-10 md:h-9 px-3 text-[13px] gap-1.5",
  padrao: "h-11 md:h-10 px-4 text-[14px] gap-2",
  grande: "h-14 px-5 text-[16px] gap-2.5",
};

/** Botão só com ícone: quadrado na altura do tamanho (o ícone não encolhe). */
const QUADRADO: Record<TamanhoBotao, string> = {
  denso: "h-10 w-10 md:h-9 md:w-9 px-0",
  padrao: "h-11 w-11 md:h-10 md:w-10 px-0",
  grande: "h-14 w-14 px-0",
};

const TAMANHO_ICONE: Record<TamanhoBotao, number> = { denso: 16, padrao: 18, grande: 22 };

const BASE_BOTAO =
  "inline-flex items-center justify-center rounded-controle font-semibold whitespace-nowrap transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none";

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
      {icone && <Icone nome={icone} tamanho={TAMANHO_ICONE[tamanho]} className="shrink-0" />}
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
      {icone && <Icone nome={icone} tamanho={TAMANHO_ICONE[tamanho]} className="shrink-0" />}
      {children}
    </Link>
  );
}

/** Link externo (<a>: WhatsApp, quadro da TV) com o mesmo desenho do `Botao`. `novaAba` abre em outra aba. */
export function BotaoExterno({
  href,
  variante = "contorno",
  tamanho = "padrao",
  icone,
  classeIcone = "",
  novaAba = true,
  rotulo,
  titulo,
  className = "",
  onClick,
  children,
}: {
  href: string;
  variante?: Variante;
  tamanho?: TamanhoBotao;
  icone?: NomeIcone;
  /** Cor do ícone (ex.: `text-ok` no WhatsApp). */
  classeIcone?: string;
  novaAba?: boolean;
  rotulo?: string;
  titulo?: string;
  className?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  children?: ReactNode;
}) {
  return (
    <a
      href={href}
      target={novaAba ? "_blank" : undefined}
      rel={novaAba ? "noreferrer" : undefined}
      aria-label={rotulo}
      title={titulo}
      onClick={onClick}
      className={`${BASE_BOTAO} ${VARIANTE[variante]} ${icone && !temConteudo(children) ? QUADRADO[tamanho] : TAMANHO[tamanho]} no-underline ${className}`}
    >
      {icone && <Icone nome={icone} tamanho={TAMANHO_ICONE[tamanho]} className={`shrink-0 ${classeIcone}`} />}
      {children}
      {novaAba && temConteudo(children) && <span className="sr-only"> (abre em nova aba)</span>}
    </a>
  );
}

// ------------------------------------------------------------------ estrutura

/** Cabeçalho de página: título 24/650 sentence case, resumo 14 cinza, ações à direita. */
export function CabecalhoPagina({ titulo, resumo, acoes }: { titulo: ReactNode; resumo?: ReactNode; acoes?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 mb-6">
      <div className="min-w-0">
        <h1 className="titulo-pagina text-tinta">{titulo}</h1>
        {resumo && <p className="mt-1 text-tinta-suave text-[14px]">{resumo}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2 empty:hidden">{acoes}</div>}
    </header>
  );
}

/** Superfície padrão: branca, borda 1 px, raio 8, sombra quase nula. */
export const SUPERFICIE = "bg-cartao border border-linha rounded-cartao shadow-cartao";

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
    <section className={`${SUPERFICIE} overflow-hidden min-w-0 ${className}`}>
      {(titulo || acao) && (
        <header className="flex items-center justify-between gap-3 px-4 min-h-12 py-2 border-b border-linha">
          <h2 className="text-[14px] font-semibold leading-snug min-w-0">
            <span className="line-clamp-2">
              {titulo}
              {contagem !== undefined && <span className="numero ml-2 text-[13px] text-tinta-fraca font-medium">{contagem}</span>}
            </span>
          </h2>
          {acao && <div className="shrink-0 flex items-center gap-1 whitespace-nowrap">{acao}</div>}
        </header>
      )}
      <div className={corpoClassName}>{children}</div>
    </section>
  );
}

/** Campo de leitura (ficha): rótulo 13/500 cinza à esquerda, valor à direita. */
export function Campo({ nome, children }: { nome: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-2.5 border-b border-linha last:border-b-0">
      <dt className="text-[13px] font-medium text-tinta-suave self-center">{nome}</dt>
      <dd className="m-0 text-[14px] break-words min-w-0">{children ?? <span className="text-tinta-fraca">—</span>}</dd>
    </div>
  );
}

/**
 * Pílula de contagem ao lado de um título de seção ou coluna (fora de cartão): `rounded-full` 20 px,
 * 12/500 tabular. `neutro` cinza-200 + tinta; `alerta` quando o número pede ação; `ok` para prontos.
 * Dentro do cabeçalho de `Cartao` e nas abas a contagem é só o número em `tinta-fraca`, sem pílula.
 */
export function Contagem({ n, tom = "neutro" }: { n: number; tom?: "neutro" | "alerta" | "ok" }) {
  const cor = { neutro: "bg-cinza-200 text-tinta", alerta: "bg-alerta-claro text-alerta", ok: "bg-ok-claro text-ok" }[tom];
  return <span className={`inline-grid place-items-center shrink-0 min-w-6 h-5 px-1.5 rounded-full text-[12px] font-medium leading-none tracking-normal numero ${cor}`}>{n}</span>;
}

// ------------------------------------------------------------------ números (KPI)

/**
 * Faixa de indicadores: UMA superfície dividida em células, nunca um cartão grande por número.
 * Use com `Indicador` dentro. Colunas: 2 no celular, `colunas` a partir de md.
 */
export function FaixaIndicadores({ children, colunas = 4, className = "" }: { children: ReactNode; colunas?: 2 | 3 | 4 | 5; className?: string }) {
  const md = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4", 5: "md:grid-cols-5" }[colunas];
  return (
    <dl className={`${SUPERFICIE} m-0 grid grid-cols-2 ${md} overflow-hidden [&>*]:border-linha max-md:[&>*:nth-child(odd)]:border-r max-md:[&>*:nth-child(n+3)]:border-t md:[&>*:not(:last-child)]:border-r ${className}`}>
      {children}
    </dl>
  );
}

/** Indicador: rótulo 13 cinza em cima, número 28/600 tabular embaixo; `para` torna a célula um link. */
export function Indicador({
  rotulo,
  valor,
  detalhe,
  alerta = false,
  para,
}: {
  rotulo: ReactNode;
  valor: ReactNode;
  detalhe?: ReactNode;
  /** Número em vermelho (ex.: atrasados > 0). */
  alerta?: boolean;
  para?: string;
}) {
  const corpo = (
    <>
      <dt className="text-[13px] font-medium text-tinta-suave">{rotulo}</dt>
      <dd className={`m-0 mt-1 text-[24px] md:text-[28px] font-semibold leading-none tracking-[-0.02em] md:tracking-[-0.01em] numero ${alerta ? "text-alerta" : "text-tinta"}`}>{valor}</dd>
      {detalhe && <dd className="m-0 mt-1.5 text-[12px] text-tinta-suave numero">{detalhe}</dd>}
    </>
  );
  if (!para) return <div className="px-3 md:px-4 py-3.5 min-w-0">{corpo}</div>;
  // dl só aceita div/dt/dd: o link cobre a célula por cima (alvo inteiro clicável).
  return (
    <div className="relative px-3 md:px-4 py-3.5 min-w-0 hover:bg-cinza-50 transition-colors duration-150">
      {corpo}
      <Link to={para} className="absolute inset-0 focus-visible:outline-offset-[-2px]">
        <span className="sr-only">Abrir a lista: {rotulo}</span>
      </Link>
    </div>
  );
}

// ------------------------------------------------------------------ pessoas

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

/** Avatar redondo com iniciais (sem foto) + nome. */
export function Responsavel({ nome, compacto = false, escuro = false }: { nome?: string; compacto?: boolean; escuro?: boolean }) {
  if (!nome) {
    return <span className={`text-[13px] ${escuro ? "text-papel-fraco" : "text-tinta-fraca"}`}>Sem responsável</span>;
  }
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <span
        aria-hidden="true"
        className={`inline-grid place-items-center shrink-0 w-7 h-7 rounded-full text-[11px] font-semibold ${escuro ? "bg-grafite-3 text-papel" : "bg-cinza-200 text-tinta"}`}
      >
        {iniciais(nome)}
      </span>
      {!compacto && <span className="text-[13px] font-medium truncate">{nome}</span>}
      {compacto && <span className="sr-only">{nome}</span>}
    </span>
  );
}

// ------------------------------------------------------------------ estados de tela

export function Vazio({ titulo, texto, acao, icone = "ok" }: { titulo: string; texto?: string; acao?: ReactNode; icone?: NomeIcone }) {
  return (
    <div className="flex flex-col items-start gap-3 px-6 py-10">
      <span className="inline-grid place-items-center w-10 h-10 rounded-cartao bg-cinza-100 text-tinta-suave">
        <Icone nome={icone} tamanho={20} />
      </span>
      <div>
        <p className="text-[15px] font-semibold">{titulo}</p>
        {texto && <p className="mt-1 text-tinta-suave max-w-prose">{texto}</p>}
      </div>
      {acao}
    </div>
  );
}

export function Erro({ mensagem, onTentar }: { mensagem?: string; onTentar?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-cartao bg-alerta-claro text-alerta border border-alerta/25">
      <Icone nome="alerta" />
      <p className="font-medium">{mensagem ?? "Não consegui carregar os dados."}</p>
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

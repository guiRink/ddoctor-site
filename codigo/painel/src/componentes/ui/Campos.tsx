import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Icone } from "../Icone";

/**
 * Campos de formulário do painel — versão única (docs/painel-design.md §3 "Campos de formulário").
 * Campo 40 px (44 no celular), raio 6 pela base, borda `linha-forte`, hover `tinta-fraca`;
 * foco = borda `tinta-fraca` + anel amarelo 30 % de 3 px; inválido = borda `alerta`.
 * Rótulo acima 13/500 `tinta-suave`; "· opcional" logo depois do rótulo; dica 12 e erro 13 (com ícone) abaixo.
 * Selects ganham a seta pela base (estilos.css): nenhum select desenha seta própria.
 */

const BASE =
  "w-full bg-cartao border border-linha-forte shadow-controle text-[14px] text-tinta outline-none transition-[border-color,box-shadow] duration-150 hover:border-tinta-fraca focus:border-tinta-fraca focus:ring-[3px] focus:ring-amarelo/30 placeholder:text-tinta-fraca disabled:bg-cinza-50 disabled:text-tinta-fraca aria-[invalid=true]:border-alerta aria-[invalid=true]:focus:ring-alerta/15";

/** Campo de uma linha (input e select). */
export const CLASSE_CAMPO = `${BASE} h-11 md:h-10 px-3`;
/** Mesmo campo; nome usado nas gavetas de Estoque e Financeiro. */
export const CLASSE_ENTRADA = CLASSE_CAMPO;
/** Área de texto. */
export const CLASSE_AREA = `${BASE} px-3 py-2 min-h-20 resize-y`;
/** Controles de barra de ferramentas (busca e filtro): 36 px, a altura dos segmentos. */
const CLASSE_FERRAMENTA = `${BASE} h-11 md:h-9`;

// ------------------------------------------------------------------ rótulo, dica e erro

function TextoRotulo({ children, opcional }: { children: ReactNode; opcional?: boolean }) {
  return (
    <>
      {children}
      {opcional && <span className="font-normal text-tinta-fraca"> · opcional</span>}
    </>
  );
}

/**
 * Rótulo + campo + dica/erro, ligado por `id` (o campo usa `aria-describedby` = `${id}-dica` / `${id}-erro`).
 * `extra` fica à direita do rótulo (ex.: "igual ao telefone").
 */
export function Grupo({
  id,
  rotulo,
  erro,
  dica,
  opcional = false,
  ocultarRotulo = false,
  extra,
  className = "",
  children,
}: {
  id: string;
  rotulo: ReactNode;
  erro?: string;
  dica?: ReactNode;
  opcional?: boolean;
  ocultarRotulo?: boolean;
  extra?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className={ocultarRotulo ? "sr-only" : "flex items-center justify-between gap-3 mb-1.5 min-h-5"}>
        <label htmlFor={id} className="text-[13px] font-medium text-tinta-suave">
          <TextoRotulo opcional={opcional}>{rotulo}</TextoRotulo>
        </label>
        {extra}
      </div>
      {children}
      {erro ? (
        <MensagemErro id={`${id}-erro`}>{erro}</MensagemErro>
      ) : (
        dica && (
          <p id={`${id}-dica`} className="mt-1.5 text-[12px] text-tinta-suave">
            {dica}
          </p>
        )
      )}
    </div>
  );
}

/** Variante em que o `<label>` envolve o campo (nome acessível sem id). Mesmo visual do `Grupo`. */
export function Rotulado({
  rotulo,
  opcional = false,
  dica,
  children,
  className = "",
}: {
  rotulo: ReactNode;
  opcional?: boolean;
  dica?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 min-w-0 ${className}`}>
      <span className="text-[13px] font-medium text-tinta-suave">
        <TextoRotulo opcional={opcional}>{rotulo}</TextoRotulo>
      </span>
      {children}
      {dica && <span className="text-[12px] text-tinta-suave leading-snug">{dica}</span>}
    </label>
  );
}

export function MensagemErro({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-[13px] font-medium text-alerta">
      <Icone nome="alerta" tamanho={14} traco={2} className="mt-[3px] shrink-0" />
      <span>{children}</span>
    </p>
  );
}

// ------------------------------------------------------------------ campos

/** Campo com prefixo ("R$") ou sufixo (unidade) fixo. Números tabulares. */
export function CampoComAfixo({
  prefixo,
  sufixo,
  className = "",
  ...resto
}: InputHTMLAttributes<HTMLInputElement> & { prefixo?: string; sufixo?: string }) {
  return (
    <span className="relative flex items-center">
      {prefixo && (
        <span aria-hidden="true" className="pointer-events-none absolute left-3 text-[14px] text-tinta-fraca">
          {prefixo}
        </span>
      )}
      <input {...resto} className={`${CLASSE_CAMPO} numero ${prefixo ? "pl-9" : ""} ${sufixo ? "pr-14" : ""} ${className}`} />
      {sufixo && (
        <span aria-hidden="true" className="pointer-events-none absolute right-3 max-w-12 truncate text-[13px] text-tinta-fraca">
          {sufixo}
        </span>
      )}
    </span>
  );
}

/** Select com a seta da base. */
export function Selecao({ className = "", children, ...resto }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...resto} className={`${CLASSE_CAMPO} cursor-pointer ${className}`}>
      {children}
    </select>
  );
}

export function AreaTexto({ className = "", ...resto }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...resto} className={`${CLASSE_AREA} ${className}`} />;
}

/** Campo de busca com lupa, 36 px (barra de ferramentas). `larga` ocupa até 420 px. */
export function Busca({
  valor,
  onMudar,
  rotulo,
  placeholder,
  id,
  larga = false,
  className = "",
}: {
  valor: string;
  onMudar: (v: string) => void;
  rotulo: string;
  placeholder?: string;
  id?: string;
  larga?: boolean;
  className?: string;
}) {
  const gerado = useId();
  const idCampo = id ?? gerado;
  return (
    <span className={`relative flex items-center w-full ${larga ? "md:max-w-[420px]" : "md:w-72"} ${className}`}>
      <label htmlFor={idCampo} className="sr-only">
        {rotulo}
      </label>
      <Icone nome="busca" tamanho={16} className="absolute left-3 text-tinta-fraca pointer-events-none" />
      <input
        id={idCampo}
        type="search"
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={`${CLASSE_FERRAMENTA} pl-9 pr-3`}
      />
    </span>
  );
}

/** Select compacto de barra de filtros (36 px), com rótulo à esquerda. */
export function FiltroSelecao({
  rotulo,
  valor,
  onMudar,
  children,
}: {
  rotulo: string;
  valor: string;
  onMudar: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 min-w-0">
      <span className="text-[13px] font-medium text-tinta-suave whitespace-nowrap">{rotulo}</span>
      <select value={valor} onChange={(e) => onMudar(e.target.value)} className={`${CLASSE_FERRAMENTA} pl-3 min-w-0 w-auto max-w-[220px] text-[13px] font-medium cursor-pointer`}>
        {children}
      </select>
    </label>
  );
}

// ------------------------------------------------------------------ escolhas

const OPCAO_SEGMENTO = "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-amarelo-escuro has-[:focus-visible]:outline-offset-1";
const SEGMENTO_ATIVO = "bg-cartao text-tinta font-semibold shadow-[0_1px_2px_rgba(17,17,17,0.08)] ring-1 ring-linha";
const SEGMENTO_INATIVO = "text-tinta-suave font-medium hover:text-tinta";

/**
 * Escolha de um valor no desenho do controle segmentado (mesmo de `GrupoFiltros`): trilho `cinza-100`,
 * selecionado branco elevado. Rádios escondidos (setas do teclado nativas). Opções 36 px (40 no celular).
 * `larguraTotal` divide o trilho em colunas iguais; sem ele, o trilho abraça as opções e rola se faltar espaço.
 */
export function Segmentado<T extends string>({
  nome,
  legenda,
  ocultarLegenda = false,
  opcoes,
  valor,
  onMudar,
  larguraTotal = false,
}: {
  nome: string;
  legenda: string;
  ocultarLegenda?: boolean;
  opcoes: { valor: T; texto: ReactNode; rotuloAcessivel?: string }[];
  valor: T | undefined;
  onMudar: (v: T) => void;
  larguraTotal?: boolean;
}) {
  return (
    <fieldset className="min-w-0 border-0 p-0 m-0">
      <legend className={ocultarLegenda ? "sr-only" : "mb-1.5 text-[13px] font-medium text-tinta-suave"}>{legenda}</legend>
      <div
        className={`${larguraTotal ? "grid" : "inline-flex max-w-full overflow-x-auto"} gap-0.5 p-0.5 rounded-cartao bg-cinza-100`}
        style={larguraTotal ? { gridTemplateColumns: `repeat(${opcoes.length}, minmax(0, 1fr))` } : undefined}
      >
        {opcoes.map((o) => {
          const ativo = o.valor === valor;
          return (
            <label
              key={o.valor}
              className={`relative shrink-0 inline-flex items-center justify-center gap-1.5 text-center h-10 md:h-9 px-3 rounded-controle text-[13px] leading-tight whitespace-nowrap cursor-pointer transition-colors duration-150 ${OPCAO_SEGMENTO} ${
                ativo ? SEGMENTO_ATIVO : SEGMENTO_INATIVO
              }`}
            >
              <input
                type="radio"
                name={nome}
                value={o.valor}
                checked={ativo}
                onChange={() => onMudar(o.valor)}
                aria-label={o.rotuloAcessivel}
                className="sr-only"
              />
              {o.texto}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Escolha de um valor em grade de opções (forma de pagamento, sentido do ajuste): quando as opções são muitas
 * ou longas para um trilho. Cada opção é um controle branco 40 px com o rádio visível; a selecionada ganha
 * borda `tinta` de 2 px. Sem amarelo (amarelo é a ação de salvar).
 */
export function OpcoesEmGrade<T extends string>({
  nome,
  legenda,
  opcoes,
  valor,
  onMudar,
  colunas = 2,
  children,
}: {
  nome: string;
  legenda: string;
  opcoes: { valor: T; texto: ReactNode }[];
  valor: T | undefined;
  onMudar: (v: T) => void;
  /** 3 = três colunas a partir de `sm`. */
  colunas?: 2 | 3;
  /** Dica abaixo da grade. */
  children?: ReactNode;
}) {
  return (
    <fieldset className="min-w-0 border-0 p-0 m-0">
      <legend className="mb-1.5 text-[13px] font-medium text-tinta-suave">{legenda}</legend>
      <div className={`grid grid-cols-2 ${colunas === 3 ? "sm:grid-cols-3" : ""} gap-2`}>
        {opcoes.map((o) => {
          const ativo = o.valor === valor;
          return (
            <label
              key={o.valor}
              className={`flex items-center gap-2.5 min-w-0 min-h-11 md:min-h-10 py-1.5 px-3 rounded-controle leading-tight border bg-cartao text-[14px] cursor-pointer transition-[border-color,box-shadow,background-color] duration-150 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-amarelo/30 ${
                ativo ? "border-tinta ring-1 ring-tinta font-semibold text-tinta" : "border-linha-forte shadow-controle font-medium text-tinta-suave hover:border-tinta-fraca hover:text-tinta"
              }`}
            >
              <input type="radio" name={nome} value={o.valor} checked={ativo} onChange={() => onMudar(o.valor)} className="w-4 h-4 shrink-0 focus-visible:outline-none" />
              <span className="min-w-0">{o.texto}</span>
            </label>
          );
        })}
      </div>
      {children}
    </fieldset>
  );
}

/** Caixa "igual ao telefone" e afins: checkbox pequeno com rótulo 13. */
export function Marcador({ id, rotulo, marcado, onMudar }: { id: string; rotulo: string; marcado: boolean; onMudar: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="inline-flex items-center gap-1.5 text-[13px] text-tinta-suave cursor-pointer select-none min-h-6 py-2.5 -my-2.5 md:py-0 md:my-0">
      <input id={id} type="checkbox" checked={marcado} onChange={(e) => onMudar(e.target.checked)} className="w-4 h-4" />
      {rotulo}
    </label>
  );
}

// ------------------------------------------------------------------ estrutura de formulário

/** Seção de formulário: título 14/600 e descrição opcional; divisória entre seções. */
export function SecaoForm({ titulo, descricao, acao, children }: { titulo: string; descricao?: ReactNode; acao?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="py-5 first:pt-0 last:pb-0 border-b border-linha last:border-b-0 flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-tinta">{titulo}</h3>
          {descricao && <p className="mt-0.5 text-[13px] text-tinta-suave">{descricao}</p>}
        </div>
        {acao}
      </header>
      {children}
    </section>
  );
}

/** Caixa de prévia/resumo dentro do formulário: fundo `cinza-50`, borda, linhas rótulo × valor. */
export function Previa({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <section className="rounded-cartao border border-linha bg-cinza-50 px-4 py-3" aria-live="polite">
      {titulo && <h3 className="text-[13px] font-semibold mb-1.5">{titulo}</h3>}
      <dl className="m-0 flex flex-col">{children}</dl>
    </section>
  );
}

export function LinhaPrevia({ rotulo, children, forte = false }: { rotulo: ReactNode; children: ReactNode; forte?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1 ${forte ? "border-t border-linha mt-1 pt-2" : ""}`}>
      <dt className="text-[13px] text-tinta-suave">{rotulo}</dt>
      <dd className={`m-0 numero text-right ${forte ? "text-[15px] font-semibold" : "text-[14px]"}`}>{children}</dd>
    </div>
  );
}

/** Texto de ajuda discreto (ícone + frase). */
export function Ajuda({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2 text-[13px] text-tinta-suave leading-snug">
      <Icone nome="documento" tamanho={16} className="shrink-0 mt-0.5 text-tinta-fraca" />
      <span>{children}</span>
    </p>
  );
}

/** Resultado de uma ação (verde) ou erro (vermelho), com ícone, perto de onde a ação aconteceu. */
export function Aviso({ tom, children }: { tom: "ok" | "alerta"; children: ReactNode }) {
  return (
    <p role={tom === "alerta" ? "alert" : "status"} className={`flex items-start gap-2 text-[13px] font-medium ${tom === "ok" ? "text-ok" : "text-alerta"}`}>
      <Icone nome={tom === "ok" ? "ok" : "alerta"} tamanho={16} className="mt-0.5 shrink-0" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/** Ação discreta de linha de tabela: texto 13/500 cinza, fundo só no hover (fantasma 32 px). */
export function AcaoTexto({
  onClick,
  rotulo,
  desabilitado = false,
  children,
}: {
  onClick: () => void;
  rotulo: string;
  desabilitado?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      aria-label={rotulo}
      className="inline-flex items-center h-8 px-2.5 rounded-controle text-[13px] font-medium text-tinta-suave hover:text-tinta hover:bg-cinza-100 transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Icone } from "../Icone";

// Campos de formulário das gavetas de Estoque e Financeiro (docs/painel-design.md §3 "Campos").
// Altura 40 (44 no celular), raio 6 pela base, borda linha-forte, foco com anel amarelo suave.

const BASE =
  "w-full bg-cartao border border-linha-forte shadow-controle text-[14px] text-tinta outline-none transition-[border-color,box-shadow] duration-150 hover:border-tinta-fraca focus:border-tinta-fraca focus:ring-[3px] focus:ring-amarelo/30 disabled:bg-cinza-50 disabled:text-tinta-fraca";

export const CLASSE_ENTRADA = `${BASE} h-11 md:h-10 px-3`;
export const CLASSE_SELECAO = `${BASE} h-11 md:h-10 pl-3 pr-8`;
export const CLASSE_AREA = `${BASE} px-3 py-2 min-h-20 resize-y`;

/** Rótulo acima (13/500 cinza), campo, dica embaixo. O `<label>` envolve o campo: nome acessível garantido. */
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
        {rotulo}
        {opcional && <span className="font-normal text-tinta-fraca"> · opcional</span>}
      </span>
      {children}
      {dica && <span className="text-[12px] text-tinta-fraca leading-snug">{dica}</span>}
    </label>
  );
}

/** Campo com sufixo fixo à direita (unidade, "R$" à esquerda via `prefixo`). */
export function EntradaComAfixo({
  prefixo,
  sufixo,
  className = "",
  ...resto
}: InputHTMLAttributes<HTMLInputElement> & { prefixo?: string; sufixo?: string }) {
  return (
    <span className="relative flex items-center">
      {prefixo && <span className="absolute left-3 text-[14px] text-tinta-fraca pointer-events-none">{prefixo}</span>}
      <input
        {...resto}
        className={`${CLASSE_ENTRADA} numero ${prefixo ? "pl-9" : ""} ${sufixo ? "pr-14" : ""} ${className}`}
      />
      {sufixo && <span className="absolute right-3 text-[13px] text-tinta-fraca pointer-events-none max-w-12 truncate">{sufixo}</span>}
    </span>
  );
}

export function Selecao({ className = "", children, ...resto }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative flex items-center">
      <select {...resto} className={`${CLASSE_SELECAO} appearance-none ${className}`}>
        {children}
      </select>
      <Icone nome="baixo" tamanho={16} className="absolute right-2.5 text-tinta-fraca pointer-events-none" />
    </span>
  );
}

export function Area(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={`${CLASSE_AREA} ${props.className ?? ""}`} />;
}

/** Campo de busca com lupa (trilho branco, até 320 px). */
export function Busca({
  valor,
  onMudar,
  rotulo,
  placeholder,
}: {
  valor: string;
  onMudar: (v: string) => void;
  rotulo: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <span className="relative flex items-center w-full md:w-72">
      <label htmlFor={id} className="sr-only">
        {rotulo}
      </label>
      <Icone nome="busca" tamanho={16} className="absolute left-3 text-tinta-fraca pointer-events-none" />
      <input
        id={id}
        type="search"
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={`${BASE} h-11 md:h-9 pl-9 pr-3`}
      />
    </span>
  );
}

/** Seleção compacta para barras de filtro (altura dos segmentos). */
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
      <span className="relative flex items-center min-w-0">
        <select
          value={valor}
          onChange={(e) => onMudar(e.target.value)}
          className={`${BASE} appearance-none h-11 md:h-9 pl-3 pr-8 min-w-0 max-w-[220px]`}
        >
          {children}
        </select>
        <Icone nome="baixo" tamanho={16} className="absolute right-2.5 text-tinta-fraca pointer-events-none" />
      </span>
    </label>
  );
}

/** Caixa de prévia/resumo dentro do formulário: fundo cinza-50, borda linha, linhas rótulo × valor. */
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

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Icone } from "../Icone";

/**
 * Campos de formulário da ficha da OS e da recepção (docs/painel-design.md §3 "Campos de formulário"):
 * altura 40 (44 no celular), raio 6 pela base, borda `linha-forte`, foco com borda `tinta-fraca` + anel amarelo 30 %.
 * Rótulo acima, 13/500 `tinta-suave`. Erro em `alerta` abaixo do campo, ligado por aria-describedby.
 */
export const CLASSE_CAMPO =
  "w-full h-11 md:h-10 px-3 bg-cartao border border-linha-forte shadow-controle outline-none transition-colors duration-150 focus:border-tinta-fraca focus:ring-[3px] focus:ring-amarelo/30 aria-[invalid=true]:border-alerta disabled:bg-cinza-50 disabled:text-tinta-fraca";

export const CLASSE_AREA =
  "w-full px-3 py-2 bg-cartao border border-linha-forte shadow-controle outline-none transition-colors duration-150 focus:border-tinta-fraca focus:ring-[3px] focus:ring-amarelo/30 resize-y";

export function Rotulo({ htmlFor, children, opcional = false }: { htmlFor: string; children: ReactNode; opcional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 mb-1.5 text-[13px] font-medium text-tinta-suave">
      <span>{children}</span>
      {opcional && <span className="text-[12px] font-normal text-tinta-fraca">opcional</span>}
    </label>
  );
}

/** Rótulo + campo + dica/erro. `children` recebe os ids para ligar o campo. */
export function Grupo({
  id,
  rotulo,
  dica,
  erro,
  opcional,
  className = "",
  children,
}: {
  id: string;
  rotulo: ReactNode;
  dica?: ReactNode;
  erro?: string;
  opcional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <Rotulo htmlFor={id} opcional={opcional}>
        {rotulo}
      </Rotulo>
      {children}
      {erro ? (
        <p id={`${id}-erro`} className="mt-1.5 text-[12px] font-medium text-alerta">
          {erro}
        </p>
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

/** Campo com prefixo/sufixo fixo (R$, km, un). */
export function CampoComAfixo({
  prefixo,
  sufixo,
  className = "",
  ...resto
}: InputHTMLAttributes<HTMLInputElement> & { prefixo?: string; sufixo?: string }) {
  return (
    <span className="relative flex">
      {prefixo && (
        <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-tinta-fraca">
          {prefixo}
        </span>
      )}
      <input
        className={`${CLASSE_CAMPO} numero ${prefixo ? "pl-9" : ""} ${sufixo ? "pr-12" : ""} ${className}`}
        {...resto}
      />
      {sufixo && (
        <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-tinta-fraca">
          {sufixo}
        </span>
      )}
    </span>
  );
}

export function Selecao({ className = "", children, ...resto }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative flex">
      <select className={`${CLASSE_CAMPO} appearance-none pr-9 cursor-pointer ${className}`} {...resto}>
        {children}
      </select>
      <Icone nome="baixo" tamanho={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-tinta-suave" />
    </span>
  );
}

export function AreaTexto({ className = "", ...resto }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${CLASSE_AREA} ${className}`} {...resto} />;
}

/**
 * Escolha única em trilho segmentado (mesmo visual de `GrupoFiltros`), para formulário:
 * radiogroup com setas do teclado nativas (inputs radio escondidos).
 */
export function Segmentado<T extends string>({
  nome,
  rotulo,
  opcoes,
  valor,
  onMudar,
  larguraTotal = false,
}: {
  nome: string;
  rotulo: string;
  opcoes: { valor: T; texto: ReactNode; rotuloAcessivel?: string }[];
  valor: T | undefined;
  onMudar: (v: T) => void;
  larguraTotal?: boolean;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-[13px] font-medium text-tinta-suave">{rotulo}</legend>
      <div className={`${larguraTotal ? "flex" : "inline-flex"} max-w-full overflow-x-auto gap-0.5 p-0.5 rounded-cartao bg-cinza-100`}>
        {opcoes.map((o) => {
          const ativo = o.valor === valor;
          return (
            <label
              key={o.valor}
              className={`relative ${larguraTotal ? "flex-1" : ""} shrink-0 inline-flex items-center justify-center gap-1.5 h-10 md:h-9 px-3 rounded-controle text-[13px] whitespace-nowrap cursor-pointer transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-amarelo-escuro has-[:focus-visible]:outline-offset-1 ${
                ativo ? "bg-cartao text-tinta font-semibold shadow-[0_1px_2px_rgba(17,17,17,0.08)] ring-1 ring-linha" : "text-tinta-suave font-medium hover:text-tinta"
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

/** Aviso de resultado de uma ação (verde) ou erro (vermelho), dentro de um cartão. */
export function Aviso({ tom, children }: { tom: "ok" | "alerta"; children: ReactNode }) {
  return (
    <p
      role={tom === "alerta" ? "alert" : "status"}
      className={`flex items-start gap-2 text-[13px] font-medium ${tom === "ok" ? "text-ok" : "text-alerta"}`}
    >
      <Icone nome={tom === "ok" ? "ok" : "alerta"} tamanho={16} className="mt-0.5 shrink-0" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

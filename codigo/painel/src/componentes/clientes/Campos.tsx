import type { ReactNode } from "react";
import { Icone } from "../Icone";

/**
 * Peças de formulário do cadastro de clientes e do novo atendimento (docs/painel-design.md §3 "Campos").
 * Campo 40 px (44 no celular), raio 6 pela base, borda `linha-forte`; foco = borda `tinta-fraca` + anel amarelo 30 %.
 */
export const CLASSE_CAMPO =
  "w-full h-11 md:h-10 px-3 bg-cartao border border-linha-forte shadow-controle text-[14px] text-tinta outline-none transition-[border-color,box-shadow] duration-150 hover:border-tinta-fraca focus:border-tinta-fraca focus:ring-[3px] focus:ring-amarelo/30 placeholder:text-tinta-fraca disabled:bg-cinza-50 disabled:text-tinta-suave aria-[invalid=true]:border-alerta aria-[invalid=true]:focus:ring-alerta/15";

export const CLASSE_AREA =
  "w-full px-3 py-2 bg-cartao border border-linha-forte shadow-controle text-[14px] text-tinta outline-none transition-[border-color,box-shadow] duration-150 hover:border-tinta-fraca focus:border-tinta-fraca focus:ring-[3px] focus:ring-amarelo/30 placeholder:text-tinta-fraca resize-y";

/** Rótulo 13/500 cinza acima, dica 12 e erro 13 em vermelho abaixo (ligados por aria-describedby nos campos). */
export function Campo({
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
  /** Conteúdo à direita do rótulo (ex.: "igual ao telefone"). */
  extra?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className={ocultarRotulo ? "sr-only" : "flex items-center justify-between gap-3 mb-1 min-h-6"}>
        <label htmlFor={id} className="text-[13px] font-medium text-tinta-suave">
          {rotulo}
          {opcional && <span className="font-normal text-tinta-fraca"> · opcional</span>}
        </label>
        {extra}
      </div>
      {children}
      {dica && !erro && (
        <p id={`${id}-dica`} className="mt-1.5 text-[12px] text-tinta-suave">
          {dica}
        </p>
      )}
      {erro && <MensagemErro id={`${id}-erro`}>{erro}</MensagemErro>}
    </div>
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

/**
 * Escolha de um valor (rádio) no desenho do controle segmentado: trilho `cinza-100`,
 * selecionado branco elevado com anel `linha` (docs/painel-design.md §3 "Segmentos"). Sem preto, sem amarelo.
 */
export function Segmentado<T extends string>({
  nome,
  legenda,
  ocultarLegenda = false,
  opcoes,
  valor,
  onMudar,
}: {
  nome: string;
  legenda: string;
  ocultarLegenda?: boolean;
  opcoes: { valor: T; texto: ReactNode }[];
  valor: T;
  onMudar: (v: T) => void;
}) {
  return (
    <fieldset className="min-w-0 border-0 p-0 m-0">
      <legend className={ocultarLegenda ? "sr-only" : "text-[13px] font-medium text-tinta-suave mb-1.5"}>{legenda}</legend>
      <div
        className="grid gap-0.5 p-0.5 rounded-cartao bg-cinza-100"
        style={{ gridTemplateColumns: `repeat(${opcoes.length}, minmax(0, 1fr))` }}
      >
        {opcoes.map((o) => {
          const ativo = o.valor === valor;
          return (
            <label
              key={o.valor}
              className={`relative flex items-center justify-center text-center h-10 md:h-9 px-2 rounded-controle text-[13px] leading-tight cursor-pointer transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-amarelo-escuro has-[:focus-visible]:outline-offset-1 ${
                ativo
                  ? "bg-cartao text-tinta font-semibold shadow-[0_1px_2px_rgba(17,17,17,0.08)] ring-1 ring-linha"
                  : "text-tinta-suave font-medium hover:text-tinta"
              }`}
            >
              <input type="radio" name={nome} value={o.valor} checked={ativo} onChange={() => onMudar(o.valor)} className="sr-only" />
              {o.texto}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Seção de formulário: título 14/600 e descrição opcional; separada da seguinte por divisória. */
export function SecaoForm({ titulo, descricao, acao, children }: { titulo: string; descricao?: ReactNode; acao?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="py-5 first:pt-0 border-b border-linha last:border-b-0 flex flex-col gap-4">
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

/** Caixa "igual ao telefone" e afins: checkbox pequeno com rótulo 13. */
export function Marcador({ id, rotulo, marcado, onMudar }: { id: string; rotulo: string; marcado: boolean; onMudar: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="inline-flex items-center gap-1.5 text-[13px] text-tinta-suave cursor-pointer select-none min-h-6 py-2.5 -my-2.5 md:py-0 md:my-0">
      <input id={id} type="checkbox" checked={marcado} onChange={(e) => onMudar(e.target.checked)} className="w-4 h-4" />
      {rotulo}
    </label>
  );
}

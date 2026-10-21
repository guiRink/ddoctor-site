import type { ReactNode } from "react";
import { Icone } from "../Icone";

/**
 * Quadrado do Geral (revisão SH, pedido do dono: "inicialmente só números, para não ficar muita informação"):
 * rótulo, número grande e no máximo uma linha curta de detalhe. Fundo branco (`bg-cartao`, borda suave); sem placas
 * — clicar abre a gaveta com a lista e as placas (`?lista=<chave>`), com o MESMO total.
 *
 * Tamanhos: `grande` (Na oficina · Entram hoje · Saem hoje; Atrasados · Parados) e `medio` (Aguardando…, dinheiro).
 * `problema`: o número que o dono quer zerado. > 0 → número na cor do estado (alerta = atrasado/vencido,
 * atencao = parado) e borda tingida; = 0 → "0" em `ok` com a frase de tudo certo (`zeroOk`). Sem problema e zerado:
 * número `tinta-fraca`, "Nada aqui". Zerado não abre (a lista estaria vazia).
 * Dinheiro: `valor` (R$ já formatado) é o número; a contagem vai no detalhe.
 * `compacto`: no celular a linha 1 fica em 3 colunas estreitas — só rótulo e número (o detalhe aparece a partir de `sm`).
 */

export type TomProblema = "alerta" | "atencao";

const COR_NUMERO: Record<TomProblema, string> = { alerta: "text-alerta", atencao: "text-atencao" };
const COR_BORDA: Record<TomProblema, string> = { alerta: "border-alerta/40", atencao: "border-atencao/40" };

export function Quadrado({
  titulo,
  total,
  detalhe,
  valor,
  tamanho = "medio",
  problema,
  zeroOk,
  compacto = false,
  onAbrir,
  className = "",
}: {
  titulo: string;
  total: number;
  /** Uma linha curta abaixo do número ("6 em serviço · 2 prontos"). */
  detalhe?: ReactNode;
  /** Valor em reais já formatado: vira o número do quadrado (quadros de dinheiro). */
  valor?: string;
  tamanho?: "grande" | "medio";
  /** O número é um problema que o dono quer zerado: cor do estado quando > 0. */
  problema?: TomProblema;
  /** Frase de tudo certo quando o problema está zerado ("Tudo em dia"). */
  zeroOk?: string;
  /** Celular: 3 por linha, sem detalhe abaixo de `sm`. */
  compacto?: boolean;
  onAbrir: () => void;
  className?: string;
}) {
  const vazio = total === 0;
  const aceso = problema && !vazio;
  const tudoCerto = problema && vazio;
  const grande = tamanho === "grande";

  const corNumero = aceso ? COR_NUMERO[problema] : tudoCerto ? "text-ok" : vazio ? "text-tinta-fraca" : "text-tinta";
  const tamanhoNumero = valor
    ? grande
      ? "text-[24px] md:text-[32px]"
      : "text-[20px] md:text-[28px]"
    : grande
      ? "text-[32px] md:text-[48px]"
      : "text-[28px] md:text-[32px]";
  const textoDetalhe = vazio ? (tudoCerto ? zeroOk : "Nada aqui") : detalhe;

  return (
    <section
      aria-label={titulo}
      className={`group relative flex flex-col min-w-0 bg-cartao border rounded-cartao shadow-cartao transition-colors duration-150 ${
        aceso ? COR_BORDA[problema] : "border-linha"
      } ${grande ? (compacto ? "p-3 sm:p-4 md:p-5 min-h-[104px] md:min-h-[148px]" : "p-4 md:p-5 min-h-[120px] md:min-h-[148px]") : "p-3.5 md:p-4 min-h-[104px] md:min-h-[120px]"} ${
        vazio ? "" : "hover:border-linha-forte hover:bg-cinza-50 has-[button:focus-visible]:border-linha-forte"
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className={`min-w-0 font-semibold leading-snug ${grande ? (compacto ? "text-[13px] sm:text-[15px] md:text-[16px]" : "text-[15px] md:text-[16px]") : "text-[14px] md:text-[15px]"} ${vazio && !tudoCerto ? "text-tinta-suave" : "text-tinta"}`}>
          {vazio ? (
            titulo
          ) : (
            <button
              type="button"
              onClick={onAbrir}
              aria-haspopup="dialog"
              className="text-left after:absolute after:inset-0 after:rounded-cartao focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-amarelo-escuro focus-visible:after:outline-offset-2 cursor-pointer"
            >
              {titulo}
              <span className="sr-only">
                : {valor ?? total}. Abrir a lista.
              </span>
            </button>
          )}
        </h2>
        {!vazio && (
          <span aria-hidden="true" className={`shrink-0 text-tinta-fraca group-hover:text-tinta-suave ${compacto ? "max-sm:hidden" : ""}`}>
            <Icone nome="seta" tamanho={16} />
          </span>
        )}
      </div>

      <p aria-hidden={vazio ? undefined : "true"} className={`mt-auto pt-2 font-semibold leading-none tracking-[-0.02em] numero truncate ${tamanhoNumero} ${corNumero}`}>
        {valor ?? total}
      </p>
      {textoDetalhe && (
        <p
          className={`mt-1.5 md:mt-2 text-[12px] md:text-[13px] leading-snug truncate numero ${compacto ? "max-sm:hidden" : ""} ${
            tudoCerto ? "text-ok font-medium" : vazio ? "text-tinta-fraca" : "text-tinta-suave"
          }`}
        >
          {textoDetalhe}
        </p>
      )}
    </section>
  );
}

import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Lista completa de um quadrado do Geral, dentro da `Gaveta` larga (revisão SG, item 1).
 * Computador (gaveta de 760 px): grade com cabeçalho, uma linha por carro, a linha inteira leva à ficha
 * (link esticado; os botões da linha ficam por cima). Celular (gaveta em tela cheia): placa + carro em cima,
 * detalhes numa linha só, situação à direita e os botões embaixo, em largura total.
 */

export interface ColunaLista {
  rotulo: string;
  /** Trilho da grade no computador ("minmax(0,1fr)", "120px"). Nunca "auto": cada linha é uma grade própria. */
  largura: string;
  direita?: boolean;
  /** Lugar no celular: título (ao lado da placa), detalhe (linha de baixo), lado (à direita) ou oculto. */
  celular?: "titulo" | "detalhe" | "lado" | "oculto";
  /** Palavra antes do valor no celular, onde não há cabeçalho ("entrega" → "entrega hoje"). */
  prefixo?: string;
}

export interface LinhaLista {
  id: string;
  /** Placa (ou texto) da primeira coluna. */
  ident: ReactNode;
  /** Para onde a linha leva (ficha da OS); sem `para` a linha só mostra. */
  para?: string;
  /** Rótulo do link para leitor de tela ("Abrir a ficha do RKP1L34"). */
  rotulo: string;
  /** Linha atrasada/vencida: fundo `alerta-claro` a 50 %. */
  alerta?: boolean;
  celulas: ReactNode[];
  acoes?: ReactNode;
}

const IDENT = "104px";

export function ListaGaveta({
  colunas,
  linhas,
  larguraAcoes,
  rotuloIdent = "Placa",
  larguraIdent = IDENT,
}: {
  colunas: ColunaLista[];
  linhas: LinhaLista[];
  /** Largura fixa da coluna de botões ("232px"); sem ela, a lista não tem botões. */
  larguraAcoes?: string;
  rotuloIdent?: string;
  /** Trilho da primeira coluna; padrão 104 px (a placa). Texto (despesa) pede mais. */
  larguraIdent?: string;
}) {
  const comAcoes = Boolean(larguraAcoes);
  const grade: CSSProperties = {
    gridTemplateColumns: [larguraIdent, ...colunas.map((c) => c.largura), ...(larguraAcoes ? [larguraAcoes] : [])].join(" "),
  };
  return (
    <div className="min-w-0">
      <div aria-hidden="true" style={grade} className="hidden md:grid sticky top-0 z-20 items-center gap-x-4 h-10 px-5 bg-cartao border-b border-linha">
        <span className="rotulo text-tinta-suave">{rotuloIdent}</span>
        {colunas.map((c) => (
          <span key={c.rotulo} className={`rotulo text-tinta-suave truncate ${c.direita ? "text-right" : ""}`}>
            {c.rotulo}
          </span>
        ))}
        {comAcoes && <span />}
      </div>
      <ul className="divide-y divide-linha">
        {linhas.map((l) => (
          <li key={l.id} className={`relative transition-colors duration-150 ${l.alerta ? "bg-alerta-claro/50" : ""} ${l.para ? "hover:bg-cinza-50" : ""}`}>
            {/* computador */}
            <div style={grade} className="hidden md:grid items-center gap-x-4 min-h-14 px-5 py-2.5 text-[14px]">
              <span className="flex min-w-0">{l.ident}</span>
              {l.celulas.map((c, i) => (
                <span key={colunas[i]?.rotulo ?? i} className={`min-w-0 ${colunas[i]?.direita ? "text-right numero" : ""}`}>
                  {c}
                </span>
              ))}
              {comAcoes && <span className="relative z-10 flex items-center justify-end gap-2">{l.acoes}</span>}
            </div>
            {/* celular */}
            <div className="md:hidden px-4 py-3 flex flex-col gap-2.5">
              <div className="flex items-start gap-3">
                <span className="flex shrink-0 max-w-[45%] pt-0.5">{l.ident}</span>
                <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                  {l.celulas.map((c, i) => (colunas[i]?.celular === "titulo" ? <span key={i} className="min-w-0 text-[14px]">{c}</span> : null))}
                  <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-tinta-suave">
                    {l.celulas.map((c, i) =>
                      (colunas[i]?.celular ?? "detalhe") === "detalhe" && c !== null && c !== undefined && c !== "" ? (
                        <span key={i} className="inline-flex items-baseline gap-1 min-w-0 max-w-full numero">
                          {colunas[i]?.prefixo && <span className="shrink-0 text-tinta-fraca">{colunas[i].prefixo}</span>}
                          {c}
                        </span>
                      ) : null,
                    )}
                  </span>
                </span>
                {l.celulas.map((c, i) => (colunas[i]?.celular === "lado" ? <span key={i} className="shrink-0 text-right numero">{c}</span> : null))}
              </div>
              {l.acoes && <div className="relative z-10 flex gap-2 [&>*]:flex-1">{l.acoes}</div>}
            </div>
            {l.para && (
              <Link to={l.para} className="absolute inset-0 focus-visible:outline-offset-[-2px]">
                <span className="sr-only">{l.rotulo}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Texto principal da linha (modelo do carro) com uma segunda linha opcional. */
export function Carro({ titulo, detalhe }: { titulo: ReactNode; detalhe?: ReactNode }) {
  return (
    <span className="block min-w-0">
      <span className="block font-medium truncate">{titulo}</span>
      {detalhe && <span className="block text-[13px] text-tinta-suave truncate">{detalhe}</span>}
    </span>
  );
}

import { useEffect, useState, type ReactNode } from "react";
import { Icone } from "../Icone";
import { Erro, Esqueleto, SUPERFICIE } from "../ui/Basicos";
import { Provisorio } from "../ui/Estado";

// Estrutura da tela de Ajustes (revisão SE): seções em superfície branca raio 8, navegação lateral
// com o item visível marcado (1366+) e lista de seções no celular.

export interface SecaoAjustes {
  id: string;
  nome: string;
  grupo: string;
}

export function Secao({
  id,
  titulo,
  descricao,
  nota,
  acao,
  children,
}: {
  id: string;
  titulo: string;
  descricao?: ReactNode;
  nota?: ReactNode;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={`ajustes-${id}`} aria-labelledby={`ajustes-${id}-titulo`} className={`${SUPERFICIE} overflow-hidden scroll-mt-24`}>
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 py-4 border-b border-linha">
        <div className="min-w-0">
          <h2 id={`ajustes-${id}-titulo`} className="text-[15px] font-semibold">
            {titulo}
          </h2>
          {descricao && <p className="mt-0.5 text-[13px] text-tinta-suave max-w-[70ch]">{descricao}</p>}
        </div>
        {(nota || acao) && (
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-tinta-suave">
            {nota}
            {acao}
          </div>
        )}
      </header>
      {children}
    </section>
  );
}

export function NotaProvisoria({ texto = "a confirmar" }: { texto?: string }) {
  return (
    <span className="text-[12px] text-tinta-suave">
      <Provisorio>{texto}</Provisorio>
    </span>
  );
}

export function Consulta<T>({
  q,
  children,
}: {
  q: { data: T | undefined; isPending: boolean; isError: boolean; refetch: () => unknown };
  children: (d: T) => ReactNode;
}) {
  if (q.isPending)
    return (
      <div className="p-5">
        <Esqueleto linhas={3} altura="h-9" />
      </div>
    );
  if (q.isError || q.data === undefined)
    return (
      <div className="p-5">
        <Erro onTentar={() => q.refetch()} />
      </div>
    );
  return <>{children(q.data)}</>;
}

/** Linha de leitura: rótulo 13/500 cinza à esquerda, valor à direita (empilha no celular). */
export function Dado({ nome, children }: { nome: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)] gap-x-6 gap-y-1 px-5 py-3.5 border-b border-linha last:border-b-0">
      <dt className="text-[13px] font-medium text-tinta-suave">{nome}</dt>
      <dd className="m-0 font-medium numero">{children}</dd>
    </div>
  );
}

const irPara = (id: string) => document.getElementById(`ajustes-${id}`)?.scrollIntoView({ block: "start" });

/** Seção visível agora (a mais alta que já passou do topo), para marcar a navegação lateral. */
function useSecaoVisivel(ids: string[]): string | undefined {
  const [visivel, setVisivel] = useState<string | undefined>(ids[0]);
  const chave = ids.join(",");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const lista = chave.split(",");
    const vistos = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) vistos.set(e.target.id.replace("ajustes-", ""), e.isIntersecting);
        const primeiro = lista.find((id) => vistos.get(id));
        if (primeiro) setVisivel(primeiro);
      },
      { rootMargin: "-80px 0px -55% 0px" },
    );
    for (const id of lista) {
      const el = document.getElementById(`ajustes-${id}`);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [chave]);
  return visivel;
}

/** Navegação lateral (lg+): grupos com cabeçalho 12/500 e itens 32 px; o visível fica marcado. */
export function NavLateral({ secoes }: { secoes: SecaoAjustes[] }) {
  const visivel = useSecaoVisivel(secoes.map((s) => s.id));
  const grupos = [...new Set(secoes.map((s) => s.grupo))];
  return (
    <nav aria-label="Seções de Ajustes" className="hidden lg:block sticky top-24">
      {grupos.map((g) => (
        <div key={g} className="mb-4">
          <p className="px-3 mb-1 text-[12px] font-medium text-tinta-fraca">{g}</p>
          <ul className="flex flex-col gap-0.5">
            {secoes
              .filter((s) => s.grupo === g)
              .map((s) => {
                const ativo = s.id === visivel;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-current={ativo ? "location" : undefined}
                      onClick={() => irPara(s.id)}
                      className={`w-full text-left h-8 px-3 rounded-controle text-[13px] transition-colors duration-150 ${
                        ativo ? "bg-cinza-100 text-tinta font-semibold" : "text-tinta-suave font-medium hover:text-tinta hover:bg-cinza-100/60"
                      }`}
                    >
                      {s.nome}
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Lista de seções no celular: um alvo de 48 px por seção, agrupado. */
export function ListaSecoes({ secoes }: { secoes: SecaoAjustes[] }) {
  const grupos = [...new Set(secoes.map((s) => s.grupo))];
  return (
    <nav aria-label="Seções de Ajustes" className="lg:hidden flex flex-col gap-4 mb-6">
      {grupos.map((g) => (
        <div key={g}>
          <p className="px-1 mb-1.5 text-[12px] font-medium text-tinta-fraca">{g}</p>
          <ul className={`${SUPERFICIE} overflow-hidden`}>
            {secoes
              .filter((s) => s.grupo === g)
              .map((s) => (
                <li key={s.id} className="border-b border-linha last:border-b-0">
                  <button type="button" onClick={() => irPara(s.id)} className="flex items-center justify-between w-full h-12 px-4 text-left text-[14px] font-medium hover:bg-cinza-50">
                    {s.nome}
                    <Icone nome="baixo" tamanho={16} className="-rotate-90 text-tinta-fraca" />
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Interruptor liga/desliga (role="switch"), alvo de 44 px no celular. */
export function Interruptor({ ligado, onMudar, rotulo, desabilitado = false }: { ligado: boolean; onMudar: (v: boolean) => void; rotulo: string; desabilitado?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      disabled={desabilitado}
      onClick={() => onMudar(!ligado)}
      className="group inline-grid place-items-center h-11 md:h-8 w-12 shrink-0 rounded-controle disabled:opacity-40"
    >
      <span className={`relative block w-8 h-[18px] rounded-full transition-colors duration-150 ${ligado ? "bg-tinta" : "bg-cinza-200 group-hover:bg-linha-forte"}`}>
        <span
          className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-cartao shadow-controle transition-transform duration-150 ${ligado ? "translate-x-[14px]" : ""}`}
        />
      </span>
    </button>
  );
}

import { useId, useState } from "react";
import type { TipoReparo } from "@compartilhado/tipos";
import { tipoReparoAtivo, usoTipoReparo } from "@compartilhado/dominio/tiposReparo";
import { mensagemErro, useAcoes, useOSs } from "../../dados/hooks";
import { Botao } from "../ui/Basicos";
import { Provisorio } from "../ui/Estado";
import { Icone } from "../Icone";

const horas = (n: number) => `${String(Math.round(n * 10) / 10).replace(".", ",")} h`;

/**
 * Lista das categorias de serviço (tipos de reparo) com as etapas na ordem da produção: "Editar" abre o
 * FormTipoReparo (quem abriu cuida), "Arquivar" tira da escolha do serviço (só sem carro em aberto com ela,
 * `usoTipoReparo`) e as arquivadas ficam num bloco recolhido, com "Reativar". Usada em Ajustes → Tipos de
 * serviço e na gaveta "Editar categorias" do Receber o carro. `onRetorno` recebe a mensagem da ação.
 */
export function ListaCategorias({
  tipos,
  podeEditar,
  onEditar,
  onRetorno,
  compacta = false,
}: {
  tipos: TipoReparo[];
  podeEditar: boolean;
  onEditar: (t: TipoReparo) => void;
  onRetorno: (r: { ok?: string; erro?: string }) => void;
  /** Gaveta estreita: ações embaixo do resumo no celular, padding menor. */
  compacta?: boolean;
}) {
  const acoes = useAcoes();
  const oss = useOSs();
  const [mexendo, setMexendo] = useState<string>();
  const ativos = tipos.filter(tipoReparoAtivo);
  const arquivados = tipos.filter((t) => !tipoReparoAtivo(t));

  async function arquivar(t: TipoReparo, arquivar: boolean) {
    setMexendo(t.id);
    onRetorno({});
    const r = await acoes.arquivarTipoReparo.mutateAsync([t.id, arquivar]).catch(() => ({ ok: false as const, codigo: undefined }));
    setMexendo(undefined);
    if (!r.ok) return onRetorno({ erro: mensagemErro(r.codigo) });
    onRetorno({
      ok: arquivar ? `Categoria ${t.nome} arquivada. Não aparece mais na escolha do serviço; reative quando quiser.` : `Categoria ${t.nome} reativada. Já aparece na escolha do serviço.`,
    });
  }

  return (
    <>
      {ativos.length === 0 ? (
        <p className={`${compacta ? "px-4" : "px-5"} py-4 text-[13px] text-tinta-suave`}>Nenhuma categoria ativa. Crie uma nova ou reative uma arquivada.</p>
      ) : (
        <ul>
          {ativos.map((t) => (
            <LinhaTipo
              key={t.id}
              tipo={t}
              uso={oss.data ? usoTipoReparo(t.id, oss.data.map((v) => v.os)) : undefined}
              podeEditar={podeEditar}
              ocupado={mexendo === t.id}
              compacta={compacta}
              onEditar={() => onEditar(t)}
              onArquivar={() => arquivar(t, true)}
            />
          ))}
        </ul>
      )}
      {arquivados.length > 0 && (
        <details className="group/arq border-t border-linha">
          <summary
            className={`flex items-center gap-2 ${compacta ? "px-4" : "px-5"} min-h-11 cursor-pointer list-none text-[13px] font-medium text-tinta-suave hover:text-tinta hover:bg-cinza-50 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-amarelo-escuro focus-visible:-outline-offset-2 [&::-webkit-details-marker]:hidden`}
          >
            <Icone nome="baixo" tamanho={16} className="shrink-0 -rotate-90 group-open/arq:rotate-0 transition-transform duration-150" />
            Arquivadas <span className="numero text-tinta-fraca">{arquivados.length}</span>
          </summary>
          <ul className="bg-cinza-50/60">
            {arquivados.map((t) => (
              <li key={t.id} className={`flex items-center gap-3 ${compacta ? "px-4" : "px-5"} py-2.5 min-h-12 border-t border-linha`}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-tinta-suave break-words">{t.nome}</span>
                  <span className="block text-[12px] text-tinta-fraca truncate">{[...t.etapas].sort((a, b) => a.ordem - b.ordem).map((e) => e.nome).join(" → ")}</span>
                </span>
                {podeEditar && (
                  <Botao
                    tamanho="denso"
                    variante="contorno"
                    onClick={() => arquivar(t, false)}
                    disabled={mexendo === t.id}
                    aria-label={`Reativar ${t.nome}`}
                    className="shrink-0 max-md:h-11"
                  >
                    {mexendo === t.id ? "Reativando…" : "Reativar"}
                  </Botao>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function LinhaTipo({
  tipo,
  uso,
  podeEditar,
  ocupado,
  compacta,
  onEditar,
  onArquivar,
}: {
  tipo: TipoReparo;
  /** OS em aberto com a categoria; undefined = ainda carregando. */
  uso?: number;
  podeEditar: boolean;
  ocupado: boolean;
  compacta: boolean;
  onEditar: () => void;
  onArquivar: () => void;
}) {
  const idUso = useId();
  const etapas = [...tipo.etapas].sort((a, b) => a.ordem - b.ordem);
  const total = etapas.reduce((s, e) => s + e.prazoPadraoHoras, 0);
  const conta = (f: (e: (typeof etapas)[number]) => boolean, um: string, varios: string) => {
    const n = etapas.filter(f).length;
    return n === 0 ? "" : `${n} ${n === 1 ? um : varios}`;
  };
  const marcas = [
    conta((e) => e.exigeFoto, "com foto", "com foto"),
    conta((e) => e.exigeContagemPecas, "conta peças", "contam peças"),
    conta((e) => e.dispensavel, "pode ser dispensada", "podem ser dispensadas"),
  ].filter(Boolean);
  const resumo = `${etapas.length} ${etapas.length === 1 ? "etapa" : "etapas"} · ${horas(total)} úteis no total`;
  const emUso = (uso ?? 0) > 0;
  const titulo = (
    <h3 className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[14px] font-semibold min-w-0">
      <span className="break-words min-w-0">{tipo.nome}</span>
      <span className="text-[12px] font-normal text-tinta-suave numero">{tipo.provisorio ? <Provisorio>{resumo}</Provisorio> : resumo}</span>
      {tipo.provisorio && <span className="sr-only">(modelo provisório — a confirmar)</span>}
    </h3>
  );
  const detalhes = (
    <>
      <ol aria-label={`Etapas de ${tipo.nome}`} className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[13px]">
        {etapas.map((e, i) => (
          <li key={e.ordem} className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
            {i > 0 && (
              <span aria-hidden="true" className="text-tinta-fraca">
                →
              </span>
            )}
            <span className="font-medium text-tinta">{e.nome}</span>
            <span className="text-[12px] text-tinta-fraca numero">{horas(e.prazoPadraoHoras)}</span>
          </li>
        ))}
      </ol>
      {(marcas.length > 0 || emUso) && (
        <p className="mt-1 text-[12px] text-tinta-suave">
          {marcas.join(" · ")}
          {emUso && (
            <span id={idUso} className="numero">
              {marcas.length > 0 && " · "}
              {uso === 1 ? "1 carro em aberto" : `${uso} carros em aberto`}
            </span>
          )}
        </p>
      )}
    </>
  );
  const botoes = podeEditar && (
    <span className={`flex items-center gap-1.5 shrink-0 ${compacta ? "-my-1" : "self-start max-sm:w-full"}`}>
      <Botao
        tamanho="denso"
        variante="contorno"
        onClick={onEditar}
        aria-label={`Editar ${tipo.nome}`}
        aria-haspopup="dialog"
        className={compacta ? "max-md:h-11" : "max-sm:flex-1 max-md:h-11"}
      >
        Editar
      </Botao>
      <Botao
        tamanho="denso"
        variante="fantasma"
        onClick={onArquivar}
        disabled={uso === undefined || emUso || ocupado}
        aria-label={`Arquivar ${tipo.nome}`}
        aria-describedby={emUso ? idUso : undefined}
        className={compacta ? "max-md:h-11" : "max-sm:flex-1 max-md:h-11"}
      >
        {ocupado ? "Arquivando…" : "Arquivar"}
      </Botao>
    </span>
  );

  // gaveta (480 px): título e botões na mesma linha, etapas na largura toda embaixo
  if (compacta)
    return (
      <li className="px-4 py-3.5 border-b border-linha last:border-b-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 pt-1.5">{titulo}</div>
          {botoes}
        </div>
        {detalhes}
      </li>
    );
  return (
    <li className="flex max-sm:flex-col items-start gap-x-4 sm:gap-x-6 gap-y-3 px-5 py-4 border-b border-linha last:border-b-0">
      <div className="min-w-0 flex-1">
        {titulo}
        {detalhes}
      </div>
      {botoes}
    </li>
  );
}

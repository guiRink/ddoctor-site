import { useState } from "react";
import type { TipoReparo } from "@compartilhado/tipos";
import { useTiposReparo } from "../../dados/hooks";
import { Botao, Vazio } from "../ui/Basicos";
import { Provisorio } from "../ui/Estado";
import { Aviso } from "../ui/Campos";
import { FormTipoReparo } from "../tipos-reparo/FormTipoReparo";
import { Consulta, NotaProvisoria, Secao } from "./Estrutura";

const horas = (n: number) => `${String(Math.round(n * 10) / 10).replace(".", ",")} h`;

/**
 * Tipos de serviço (tipos de reparo): cada categoria com as etapas resumidas na ordem da produção,
 * editar e criar (FormTipoReparo). Os modelos provisórios do demo aparecem marcados.
 */
export function TiposServico({ podeEditar }: { podeEditar: boolean }) {
  const q = useTiposReparo();
  const [form, setForm] = useState<{ tipo?: TipoReparo } | null>(null);
  const [ok, setOk] = useState<string>();
  const tipos = q.data ?? [];
  const algumProvisorio = tipos.some((t) => t.provisorio);

  return (
    <Secao
      id="tipos"
      titulo="Tipos de serviço"
      descricao={
        <>
          Cada tipo gera as etapas da OS, com o prazo de cada uma em horas úteis.
          {algumProvisorio && (
            <span className="block mt-2">
              <NotaProvisoria texto="modelos do questionário, a confirmar" />
            </span>
          )}
        </>
      }
      acao={
        podeEditar && tipos.length > 0 ? (
          <Botao
            tamanho="denso"
            variante="contorno"
            icone="mais"
            aria-haspopup="dialog"
            onClick={() => {
              setOk(undefined);
              setForm({});
            }}
          >
            Criar categoria
          </Botao>
        ) : undefined
      }
    >
      <Consulta q={q}>
        {(lista: TipoReparo[]) =>
          lista.length === 0 ? (
            <Vazio
              icone="producao"
              titulo="Nenhum tipo de serviço"
              texto="Crie a primeira categoria (ex.: Martelinho de ouro) com as etapas que o carro percorre na produção."
              acao={
                podeEditar ? (
                  <Botao variante="contorno" icone="mais" onClick={() => setForm({})} aria-haspopup="dialog">
                    Criar categoria
                  </Botao>
                ) : undefined
              }
            />
          ) : (
            <ul>
              {lista.map((t) => (
                <LinhaTipo
                  key={t.id}
                  tipo={t}
                  podeEditar={podeEditar}
                  onEditar={() => {
                    setOk(undefined);
                    setForm({ tipo: t });
                  }}
                />
              ))}
            </ul>
          )
        }
      </Consulta>
      {ok && (
        <div className="px-5 py-3 border-t border-linha bg-cinza-50">
          <Aviso tom="ok">{ok}</Aviso>
        </div>
      )}
      {form && (
        <FormTipoReparo
          inicial={form.tipo}
          existentes={tipos}
          onFechar={() => setForm(null)}
          onSalvo={(t) => {
            setOk(form.tipo ? `Categoria ${t.nome} atualizada. Vale para os próximos carros.` : `Categoria ${t.nome} criada. Já aparece na escolha do serviço.`);
            setForm(null);
          }}
        />
      )}
    </Secao>
  );
}

function LinhaTipo({ tipo, podeEditar, onEditar }: { tipo: TipoReparo; podeEditar: boolean; onEditar: () => void }) {
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
  return (
    <li className="flex items-start gap-x-4 sm:gap-x-6 px-5 py-4 border-b border-linha last:border-b-0">
      <div className="min-w-0 flex-1">
        <h3 className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[14px] font-semibold">
          <span className="break-words min-w-0">{tipo.nome}</span>
          <span className="text-[12px] font-normal text-tinta-suave numero">{tipo.provisorio ? <Provisorio>{resumo}</Provisorio> : resumo}</span>
          {tipo.provisorio && <span className="sr-only">(modelo provisório — a confirmar)</span>}
        </h3>
        <ol aria-label={`Etapas de ${tipo.nome}`} className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[13px]">
          {etapas.map((e, i) => (
            <li key={e.ordem} className="inline-flex items-baseline gap-1.5">
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
        {marcas.length > 0 && <p className="mt-1 text-[12px] text-tinta-suave">{marcas.join(" · ")}</p>}
      </div>
      {podeEditar && (
        <Botao tamanho="denso" variante="contorno" onClick={onEditar} aria-label={`Editar ${tipo.nome}`} aria-haspopup="dialog" className="self-start shrink-0">
          Editar
        </Botao>
      )}
    </li>
  );
}

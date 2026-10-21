import { useState } from "react";
import type { TipoReparo } from "@compartilhado/tipos";
import { useTiposReparo } from "../../dados/hooks";
import { Botao, Vazio } from "../ui/Basicos";
import { Aviso } from "../ui/Campos";
import { FormTipoReparo } from "../tipos-reparo/FormTipoReparo";
import { ListaCategorias } from "../tipos-reparo/ListaCategorias";
import { Consulta, NotaProvisoria, Secao } from "./Estrutura";

/**
 * Tipos de serviço (tipos de reparo): cada categoria com as etapas resumidas na ordem da produção,
 * editar, criar (FormTipoReparo) e arquivar/reativar (ListaCategorias). Os modelos provisórios do demo aparecem marcados.
 */
export function TiposServico({ podeEditar }: { podeEditar: boolean }) {
  const q = useTiposReparo();
  const [form, setForm] = useState<{ tipo?: TipoReparo } | null>(null);
  const [ok, setOk] = useState<string>();
  const [erro, setErro] = useState<string>();
  const tipos = q.data ?? [];
  const algumProvisorio = tipos.some((t) => t.provisorio && t.ativo !== false);

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
            <ListaCategorias
              tipos={lista}
              podeEditar={podeEditar}
              onEditar={(t) => {
                setOk(undefined);
                setErro(undefined);
                setForm({ tipo: t });
              }}
              onRetorno={(r) => {
                setOk(r.ok);
                setErro(r.erro);
              }}
            />
          )
        }
      </Consulta>
      {(ok || erro) && (
        <div className="px-5 py-3 border-t border-linha bg-cinza-50">
          <Aviso tom={erro ? "alerta" : "ok"}>{erro ?? ok}</Aviso>
        </div>
      )}
      {form && (
        <FormTipoReparo
          inicial={form.tipo}
          existentes={tipos}
          onFechar={() => setForm(null)}
          onSalvo={(t) => {
            setErro(undefined);
            setOk(form.tipo ? `Categoria ${t.nome} atualizada. Vale para os próximos carros.` : `Categoria ${t.nome} criada. Já aparece na escolha do serviço.`);
            setForm(null);
          }}
        />
      )}
    </Secao>
  );
}

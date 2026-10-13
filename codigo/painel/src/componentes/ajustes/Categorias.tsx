import { useState, type FormEvent } from "react";
import type { CategoriaFinanceira } from "@compartilhado/tipos";
import { mensagemErro, useAcoes, useCategorias } from "../../dados/hooks";
import { Botao, Vazio } from "../ui/Basicos";
import { Etiqueta } from "../ui/Estado";
import { Retorno } from "../gestao/Comuns";
import { CLASSE_CAMPO } from "../gestao/formato";
import { Consulta, Interruptor, NotaProvisoria, Secao } from "./Estrutura";

const TIPOS: { tipo: CategoriaFinanceira["tipo"]; nome: string; texto: string }[] = [
  { tipo: "despesa", nome: "Despesas", texto: "Aparecem no lançamento de despesas e no relatório por categoria." },
  { tipo: "receita", nome: "Receitas", texto: "Separam a origem do dinheiro que entra." },
];

/** Categorias financeiras: listar por tipo, ativar/desativar e criar (salvarCategoria). */
export function Categorias({ podeEditar }: { podeEditar: boolean }) {
  const q = useCategorias();
  return (
    <Secao
      id="categorias"
      titulo="Categorias financeiras"
      descricao="Organizam despesas e receitas no Financeiro e nos Relatórios. Desativar esconde a categoria dos lançamentos novos; o que já foi lançado continua com ela."
      nota={<NotaProvisoria texto="lista inicial sugerida" />}
    >
      <Consulta q={q}>
        {(categorias: CategoriaFinanceira[]) => (
          <>
            {podeEditar && <NovaCategoria />}
            {categorias.length === 0 ? (
              <Vazio titulo="Nenhuma categoria cadastrada" texto="Crie a primeira acima: por exemplo, Aluguel ou Material de pintura." />
            ) : (
              <div className="grid md:grid-cols-2 md:divide-x divide-linha">
                {TIPOS.map((t) => {
                  const lista = categorias.filter((c) => c.tipo === t.tipo).sort((a, b) => Number(b.ativa) - Number(a.ativa) || a.nome.localeCompare(b.nome, "pt-BR"));
                  const ativas = lista.filter((c) => c.ativa).length;
                  return (
                    <div key={t.tipo} className="min-w-0 max-md:border-t max-md:first:border-t-0 border-linha">
                      <div className="px-5 pt-4 pb-2">
                        <h3 className="text-[14px] font-semibold">
                          {t.nome} <span className="font-normal text-tinta-fraca numero">· {ativas} ativas</span>
                        </h3>
                        <p className="text-[12px] text-tinta-suave">{t.texto}</p>
                      </div>
                      <ul>
                        {lista.map((c) => (
                          <LinhaCategoria key={c.id} c={c} podeEditar={podeEditar} />
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </Consulta>
    </Secao>
  );
}

function LinhaCategoria({ c, podeEditar }: { c: CategoriaFinanceira; podeEditar: boolean }) {
  const acoes = useAcoes();
  const [erro, setErro] = useState<string>();
  async function alternar(ativa: boolean) {
    setErro(undefined);
    const r = await acoes.salvarCategoria.mutateAsync([{ ...c, ativa }]).catch(() => ({ ok: false, codigo: undefined }));
    if (!r.ok) setErro(mensagemErro(r.codigo));
  }
  return (
    <li className="flex items-center justify-between gap-3 pl-5 pr-3 min-h-11 border-t border-linha">
      <div className="min-w-0 py-2">
        <span className={`block text-[14px] truncate ${c.ativa ? "text-tinta" : "text-tinta-fraca"}`}>{c.nome}</span>
        {erro && <Retorno erro={erro} />}
      </div>
      <span className="flex items-center gap-1 shrink-0">
        {!c.ativa && <Etiqueta tom="neutro">Inativa</Etiqueta>}
        {podeEditar && <Interruptor ligado={c.ativa} rotulo={`${c.ativa ? "Desativar" : "Ativar"} ${c.nome}`} onMudar={alternar} desabilitado={acoes.salvarCategoria.isPending} />}
      </span>
    </li>
  );
}

function NovaCategoria() {
  const acoes = useAcoes();
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<CategoriaFinanceira["tipo"]>("despesa");
  const [erro, setErro] = useState<string>();
  const [ok, setOk] = useState<string>();

  async function criar(e: FormEvent) {
    e.preventDefault();
    setErro(undefined);
    setOk(undefined);
    const r = await acoes.salvarCategoria.mutateAsync([{ nome, tipo, ativa: true }]).catch(() => ({ ok: false, codigo: undefined }));
    if (!r.ok) return setErro(mensagemErro(r.codigo));
    setOk(`Categoria “${nome.trim()}” criada.`);
    setNome("");
  }

  return (
    <form onSubmit={criar} className="flex flex-wrap items-end gap-3 px-5 py-4 bg-cinza-50 border-b border-linha" aria-label="Nova categoria">
      <label className="flex flex-col gap-1.5 flex-1 min-w-[14rem]" htmlFor="categoria-nome">
        <span className="text-[13px] font-medium text-tinta-suave">Nova categoria</span>
        <input id="categoria-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Combustível" maxLength={60} className={CLASSE_CAMPO} />
      </label>
      <label className="flex flex-col gap-1.5" htmlFor="categoria-tipo">
        <span className="text-[13px] font-medium text-tinta-suave">Tipo</span>
        <select id="categoria-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as CategoriaFinanceira["tipo"])} className={`${CLASSE_CAMPO} w-36`}>
          <option value="despesa">Despesa</option>
          <option value="receita">Receita</option>
        </select>
      </label>
      <Botao type="submit" variante="primario" tamanho="denso" icone="mais" disabled={acoes.salvarCategoria.isPending} className="max-md:h-11">
        Adicionar
      </Botao>
      <div className="basis-full empty:hidden">
        <Retorno erro={erro} ok={ok} />
      </div>
    </form>
  );
}

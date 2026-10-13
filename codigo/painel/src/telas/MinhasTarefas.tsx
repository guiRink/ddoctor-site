import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { EtapaOS } from "@compartilhado/tipos";
import { semaforoEtapa } from "@compartilhado/dominio/semaforo";
import { paraMs } from "@compartilhado/dominio/fuso";
import { useAgora, useConfig, useOSs } from "../dados/hooks";
import type { OSVisao } from "../dados/repositorio";
import { useSessao } from "../dados/sessao";
import { acesso } from "../dominio/permissoes";
import { Botao, Erro, Esqueleto, SUPERFICIE, Vazio } from "../componentes/ui/Basicos";
import { Icone } from "../componentes/Icone";
import { CartaoTarefa, type Retorno } from "../componentes/producao/CartaoTarefa";

interface Tarefa {
  etapa: EtapaOS;
  v: OSVisao;
}

const ORDEM_ESTADO: Record<string, number> = { em_execucao: 0, bloqueada: 1, na_fila: 2 };
const PESO = { vermelho: 3, laranja: 2, verde: 1, neutro: 0 } as const;

/** Minhas tarefas — celular da produção (docs/painel-design.md §4: um cartão por tarefa, botões de 56 px). */
export function MinhasTarefas() {
  const consulta = useOSs();
  const config = useConfig();
  const agora = useAgora(30_000);
  const { perfil, perfis } = useSessao();
  const [params, setParams] = useSearchParams();
  const [retorno, setRetorno] = useState<Retorno | null>(null);
  const aviso = useRef<HTMLDivElement>(null);

  // gestor e dono escolhem de quem ver as tarefas; a produção vê só as próprias
  const gerencia = acesso(perfil.papel, "minhas_tarefas") === "editar";
  const funcionarios = perfis.filter((p) => p.papel === "producao" && p.ativo);
  const alvoId = gerencia ? (params.get("de") ?? funcionarios[0]?.id ?? perfil.id) : perfil.id;
  const alvo = perfis.find((p) => p.id === alvoId) ?? perfil;

  useEffect(() => {
    if (retorno) aviso.current?.focus();
  }, [retorno]);

  const { minhas, livres } = useMemo(() => {
    const minhas: Tarefa[] = [];
    const livres: Tarefa[] = [];
    if (!consulta.data || !config.data) return { minhas, livres };
    for (const v of consulta.data) {
      if (v.os.estado !== "na_oficina") continue;
      for (const etapa of v.etapas) {
        if (!(etapa.estado in ORDEM_ESTADO)) continue;
        if (etapa.responsavelId === alvo.id) minhas.push({ etapa, v });
        else if (!etapa.responsavelId && etapa.estado === "na_fila") livres.push({ etapa, v });
      }
    }
    const cfg = config.data;
    const comparar = (a: Tarefa, b: Tarefa) =>
      ORDEM_ESTADO[a.etapa.estado] - ORDEM_ESTADO[b.etapa.estado] ||
      PESO[semaforoEtapa(b.etapa, agora, cfg)] - PESO[semaforoEtapa(a.etapa, agora, cfg)] ||
      b.v.os.prioridade - a.v.os.prioridade ||
      (a.etapa.prazoEm ? paraMs(a.etapa.prazoEm) : Infinity) - (b.etapa.prazoEm ? paraMs(b.etapa.prazoEm) : Infinity);
    return { minhas: minhas.sort(comparar), livres: livres.sort(comparar) };
  }, [consulta.data, config.data, alvo.id, agora]);

  const emExecucao = minhas.filter((t) => t.etapa.estado === "em_execucao").length;
  const proprio = alvo.id === perfil.id;

  return (
    <div className="max-w-[560px] mx-auto">
      <header className="mb-5">
        <h1 className="titulo-pagina">{proprio ? "Minhas tarefas" : `Tarefas de ${alvo.nome.split(" ")[0]}`}</h1>
        <p className="mt-1 text-[14px] text-tinta-suave">
          {alvo.nome}
          {alvo.funcao && <> · {alvo.funcao}</>}
          {consulta.data && (
            <span className="numero">
              {" "}
              · {minhas.length} {minhas.length === 1 ? "tarefa" : "tarefas"}
              {emExecucao > 0 && `, ${emExecucao} em execução`}
            </span>
          )}
        </p>
        {gerencia && (
          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-tinta-suave">Ver tarefas de</span>
            <span className="relative flex">
            <select
              value={alvo.id}
              onChange={(e) => {
                setRetorno(null);
                setParams({ de: e.target.value }, { replace: true });
              }}
              className="appearance-none w-full h-12 pl-3 pr-10 bg-cartao border border-linha-forte shadow-controle font-medium text-[16px] outline-none cursor-pointer focus:border-tinta-fraca focus:ring-[3px] focus:ring-amarelo/30"
            >
              {funcionarios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                  {p.funcao ? ` · ${p.funcao}` : ""}
                </option>
              ))}
            </select>
            <Icone nome="baixo" tamanho={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-tinta-suave" />
            </span>
          </label>
        )}
      </header>

      <div ref={aviso} tabIndex={-1} aria-live="polite" className="outline-none empty:hidden mb-4">
        {retorno && (
          <div
            role={retorno.tipo === "erro" ? "alert" : "status"}
            className={`flex items-start gap-3 px-4 py-3 rounded-cartao border text-[16px] font-medium ${retorno.tipo === "ok" ? "bg-ok-claro text-ok border-ok/25" : "bg-alerta-claro text-alerta border-alerta/25"}`}
          >
            <Icone nome={retorno.tipo === "ok" ? "ok" : "alerta"} tamanho={22} className="shrink-0 mt-0.5" />
            <p className="flex-1 leading-snug">{retorno.texto}</p>
            <button type="button" onClick={() => setRetorno(null)} aria-label="Fechar aviso" className="shrink-0 -m-2 w-11 h-11 grid place-items-center rounded-controle hover:bg-cartao/60">
              <Icone nome="fechar" tamanho={18} />
            </button>
          </div>
        )}
      </div>

      {consulta.isPending || config.isPending ? (
        <Esqueleto linhas={3} altura="h-72" />
      ) : consulta.isError || config.isError || !consulta.data || !config.data ? (
        <Erro mensagem="Não consegui carregar as tarefas." onTentar={() => (consulta.refetch(), config.refetch())} />
      ) : (
        <>
          {minhas.length === 0 ? (
            <div className={SUPERFICIE}>
              <Vazio
                titulo={proprio ? "Nada na sua fila agora" : `Nada na fila de ${alvo.nome.split(" ")[0]} agora`}
                texto={
                  livres.length
                    ? "Há carros na fila sem responsável logo abaixo. Se for da sua área, toque em Iniciar."
                    : "Quando um carro chegar na sua etapa, ele aparece aqui. Se acha que falta algum, fale com o gestor."
                }
                acao={
                  <Botao variante="contorno" icone="relogio" onClick={() => consulta.refetch()} disabled={consulta.isFetching}>
                    {consulta.isFetching ? "Atualizando…" : "Atualizar"}
                  </Botao>
                }
              />
            </div>
          ) : (
            <ul className="m-0 p-0 list-none flex flex-col gap-4">
              {minhas.map((t) => (
                <li key={t.etapa.id}>
                  <CartaoTarefa etapa={t.etapa} v={t.v} agora={agora} config={config.data!} executorId={alvo.id} podeAgir onRetorno={setRetorno} />
                </li>
              ))}
            </ul>
          )}

          {livres.length > 0 && (
            <section className="mt-8" aria-labelledby="sem-responsavel">
              <h2 id="sem-responsavel" className="flex items-center gap-2">
                <span className="text-[16px] font-semibold">Na fila sem responsável</span>
                <span className="inline-grid place-items-center min-w-6 h-5 px-1.5 rounded-full bg-cinza-200 text-[12px] font-medium numero">{livres.length}</span>
              </h2>
              <p className="mt-1 mb-3 text-[14px] text-tinta-suave">Quem iniciar fica como responsável.</p>
              <ul className="m-0 p-0 list-none flex flex-col gap-4">
                {livres.map((t) => (
                  <li key={t.etapa.id}>
                    <CartaoTarefa etapa={t.etapa} v={t.v} agora={agora} config={config.data!} executorId={alvo.id} podeAgir onRetorno={setRetorno} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

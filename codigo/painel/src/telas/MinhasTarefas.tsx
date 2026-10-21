import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ConfigOficina, EtapaOS, MarcoISO, Perfil } from "@compartilhado/tipos";
import { situacaoCartao } from "@compartilhado/dominio/semaforo";
import { paraMs } from "@compartilhado/dominio/fuso";
import { useAgora, useConfig, useOSs } from "../dados/hooks";
import type { OSVisao } from "../dados/repositorio";
import { useSessao } from "../dados/sessao";
import { acesso } from "../dominio/permissoes";
import { Botao, Contagem, Erro, Esqueleto, SUPERFICIE, Vazio } from "../componentes/ui/Basicos";
import { Placa } from "../componentes/ui/Placa";
import { Icone } from "../componentes/Icone";
import { CartaoTarefa, type Retorno } from "../componentes/producao/CartaoTarefa";
import { PilulaSituacao } from "../componentes/producao/Situacao";
import { proximoCarro, type ProximoCarro } from "../componentes/producao/quadro";
import { rotuloPrazo } from "../dominio/horarios";

interface Tarefa {
  etapa: EtapaOS;
  v: OSVisao;
}

const ESTADO_AGORA: Partial<Record<EtapaOS["estado"], string>> = { em_execucao: "em execução", na_fila: "na fila", bloqueada: "parada" };
const ORDEM_ESTADO: Record<string, number> = { em_execucao: 0, bloqueada: 1, na_fila: 2 };
const PESO = { atrasado: 4, impedido: 3, atencao: 2, no_prazo: 1, pronto: 0 } as const;

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
    const peso = (t: Tarefa) => PESO[situacaoCartao(t.v.os, t.v.etapas, agora, cfg) ?? "no_prazo"];
    const comparar = (a: Tarefa, b: Tarefa) =>
      ORDEM_ESTADO[a.etapa.estado] - ORDEM_ESTADO[b.etapa.estado] ||
      peso(b) - peso(a) ||
      b.v.os.prioridade - a.v.os.prioridade ||
      (a.etapa.prazoEm ? paraMs(a.etapa.prazoEm) : Infinity) - (b.etapa.prazoEm ? paraMs(b.etapa.prazoEm) : Infinity);
    return { minhas: minhas.sort(comparar), livres: livres.sort(comparar) };
  }, [consulta.data, config.data, alvo.id, agora]);

  const proximo = useMemo(
    () => (consulta.data && config.data ? proximoCarro(consulta.data, alvo, agora, config.data) : undefined),
    [consulta.data, config.data, alvo, agora],
  );
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
                texto={livres.length ? "Veja abaixo os carros na fila sem responsável." : undefined}
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

          <section className="mt-8" aria-labelledby="proximo-carro">
            <h2 id="proximo-carro" className="text-[16px] font-semibold mb-3">
              {proprio ? "Próximo carro pra mim" : `Próximo carro para ${alvo.nome.split(" ")[0]}`}
            </h2>
            {proximo ? (
              <CartaoProximo p={proximo} perfis={perfis} agora={agora} config={config.data} />
            ) : (
              <p className={`${SUPERFICIE} px-4 py-3.5 text-[15px] text-tinta-suave`}>Nenhum carro a caminho da sua etapa agora.</p>
            )}
          </section>

          {livres.length > 0 && (
            <section className="mt-8" aria-labelledby="sem-responsavel">
              <h2 id="sem-responsavel" className="flex items-center gap-2">
                <span className="text-[16px] font-semibold">Na fila sem responsável</span>
                <Contagem n={livres.length} />
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

/** O próximo carro que vem para a pessoa: placa, etapa dela · serviço, o que falta antes e a entrega. Só leitura. */
function CartaoProximo({ p, perfis, agora, config }: { p: ProximoCarro; perfis: Perfil[]; agora: MarcoISO; config: ConfigOficina }) {
  const { v, etapa, antes } = p;
  const situacao = situacaoCartao(v.os, v.etapas, agora, config);
  const agoraEtapa = antes[0];
  const quem = agoraEtapa?.responsavelId ? perfis.find((x) => x.id === agoraEtapa.responsavelId)?.nome.split(" ")[0] : undefined;
  const previsao = v.os.previsaoEntrega?.slice(0, 10);
  return (
    <article aria-labelledby="proximo-titulo" className={`${SUPERFICIE} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <Placa placa={v.veiculo.placa} tamanho="m" />
        {situacao && <PilulaSituacao situacao={situacao} />}
      </div>
      <p className="mt-3 text-[16px] font-semibold leading-tight">
        {v.veiculo.modelo ?? "Modelo não informado"}
        {v.veiculo.cor && <span className="font-normal text-tinta-suave"> · {v.veiculo.cor}</span>}
      </p>
      <h3 id="proximo-titulo" className="mt-1.5 flex flex-wrap items-baseline gap-x-2 leading-tight">
        <span className="text-[20px] font-semibold">{etapa.nome}</span>
        {v.tipoReparo && v.tipoReparo.nome.toLowerCase() !== etapa.nome.toLowerCase() && <span className="text-[15px] font-medium text-tinta-suave">· serviço: {v.tipoReparo.nome}</span>}
      </h3>
      <dl className="mt-3 pt-3 border-t border-linha grid grid-cols-2 gap-x-4 gap-y-3 numero">
        <div className="min-w-0">
          <dt className="text-[13px] text-tinta-suave">Antes da sua vez</dt>
          <dd className="m-0 mt-0.5 text-[16px] font-semibold">
            {agoraEtapa ? (
              <>
                {agoraEtapa.nome}
                {antes.length > 1 && <span className="font-normal text-tinta-suave"> e mais {antes.length - 1}</span>}
              </>
            ) : (
              "Nada: já pode vir"
            )}
          </dd>
          {agoraEtapa && (
            <dd className="m-0 text-[13px] text-tinta-suave">
              {[quem && `com ${quem}`, ESTADO_AGORA[agoraEtapa.estado]].filter(Boolean).join(" · ")}
            </dd>
          )}
        </div>
        <div className="min-w-0">
          <dt className="text-[13px] text-tinta-suave">Entrega</dt>
          <dd className="m-0 mt-0.5 text-[16px] font-semibold">{previsao ? rotuloPrazo(previsao, agora, config) : "—"}</dd>
        </div>
      </dl>
      {(p.pelaFuncao || p.depois > 0) && (
        <p className="mt-3 text-[13px] text-tinta-suave">
          {p.pelaFuncao && "Sem responsável ainda · pela função."}
          {p.pelaFuncao && p.depois > 0 && " "}
          {p.depois > 0 && `Depois deste, mais ${p.depois} ${p.depois === 1 ? "carro" : "carros"}.`}
        </p>
      )}
    </article>
  );
}

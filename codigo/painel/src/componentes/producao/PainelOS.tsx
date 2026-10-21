import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { ConfigOficina, EtapaOS, MarcoISO, Perfil } from "@compartilhado/tipos";
import { formatarDuracao, tempoEmExecucao, tempoEmFila } from "@compartilhado/dominio/tempos";
import { situacaoCartao } from "@compartilhado/dominio/semaforo";
import { corDoCarro } from "@compartilhado/dominio/corCarro";
import { dataNoFuso, paraMs } from "@compartilhado/dominio/fuso";
import { rotuloHaQuanto, rotuloPrazo } from "../../dominio/horarios";
import type { OSVisao } from "../../dados/repositorio";
import { mensagemErro, useAcoes } from "../../dados/hooks";
import { ESTADO_ETAPA } from "../../dominio/rotulos";
import { Botao, BotaoLink, Responsavel } from "../ui/Basicos";
import { Etiqueta } from "../ui/Estado";
import { Placa } from "../ui/Placa";
import { ProgressoEtapas, nomePerfil, resumoProducao } from "../ui/Carro";
import { Icone } from "../Icone";
import { MotivoCor } from "./Situacao";
import { SEMAFORO_DA_COR } from "./quadro";

type Aviso = { tipo: "ok" | "erro"; texto: string } | null;

/**
 * Painel lateral de ações de um carro no quadro (sem modal: o quadro continua visível e rolável, sem ser
 * empurrado). 440 px à direita no computador; tela cheia no celular.
 * Atribuir responsável por etapa, dispensar etapa com motivo e abrir a ficha.
 */
export function PainelOS({
  v,
  agora,
  config,
  perfis,
  podeEditar,
  podeAbrirFicha,
  onFechar,
}: {
  v: OSVisao;
  agora: MarcoISO;
  config: ConfigOficina;
  perfis: Perfil[];
  podeEditar: boolean;
  podeAbrirFicha: boolean;
  onFechar: () => void;
}) {
  const r = resumoProducao(v, agora, config);
  // a mesma pílula única do cartão (impedido vence atrasado e atenção)
  const situacao = situacaoCartao(v.os, v.etapas, agora, config);
  // cor do carro (pedido do dono, 2º áudio): a mesma faixa do cartão
  const cor = corDoCarro(v.os, v.etapas, agora, config);
  const previsao = v.os.previsaoEntrega?.slice(0, 10);
  const entregaVencida = Boolean(previsao && previsao < dataNoFuso(agora) && situacao !== null);
  const etapaVencida = Boolean(r.atual?.prazoEm && paraMs(agora) > paraMs(r.atual.prazoEm));
  const titulo = useRef<HTMLHeadingElement>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  const idTitulo = useId();

  // foco no título ao abrir (o quadro remonta o painel a cada carro, pela key); Esc fecha
  useEffect(() => {
    titulo.current?.focus();
  }, []);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onFechar]);

  const bloqueioAberto = r.bloqueada ? r.atual?.bloqueios.find((b) => !b.fimEm) : undefined;
  const funcionarios = perfis.filter((p) => p.papel === "producao" && p.ativo);

  return (
    <aside
      id="painel-os"
      aria-labelledby={idTitulo}
      className="fixed z-40 inset-0 md:top-14 md:left-auto md:w-[440px] bg-cartao text-tinta md:border-l md:border-linha elevacao flex flex-col pb-[env(safe-area-inset-bottom)]"
    >
      <header className="flex items-center justify-between gap-3 pl-5 pr-2.5 h-14 border-b border-linha shrink-0">
        <p className="text-[13px] font-medium text-tinta-suave numero">OS {v.os.numero}</p>
        <Botao variante="fantasma" icone="fechar" onClick={onFechar} aria-label="Fechar painel do carro" title="Fechar (Esc)" />
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* identidade e estado */}
        <section className="px-5 pt-5 pb-4 border-b border-linha">
          <div className="flex items-start justify-between gap-3">
            <Placa placa={v.veiculo.placa} tamanho="g" />
            {situacao === "pronto" && <Etiqueta tom="ok">Pronto</Etiqueta>}
          </div>
          <h2 ref={titulo} id={idTitulo} tabIndex={-1} className="mt-3 text-[20px] font-semibold tracking-[-0.01em] leading-tight outline-none">
            {v.veiculo.modelo ?? "Modelo não informado"}
            {v.veiculo.cor && <span className="font-normal text-tinta-suave"> · {v.veiculo.cor}</span>}
          </h2>
          <p className="text-[13px] text-tinta-suave">
            {v.tipoReparo?.nome ?? "Tipo de reparo não definido"}
            {v.os.box && <> · {v.os.box}</>}
          </p>
          {v.os.estado === "na_oficina" && <MotivoCor cor={cor.cor} motivo={cor.motivo} prazoProprio={cor.personalizado} tamanho="m" className="mt-3" />}
          {v.os.prioridade > 0 && (
            <Etiqueta tom={v.os.prioridade === 2 ? "alerta" : "atencao"} className="mt-2">
              {v.os.prioridade === 2 ? "Urgente" : "Prioridade alta"}
            </Etiqueta>
          )}
          <div className="mt-4">
            <ProgressoEtapas etapas={v.etapas} semaforo={situacao === "pronto" ? "neutro" : situacao ? SEMAFORO_DA_COR[cor.cor] : r.semaforoAtual} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 numero">
            <Dado nome="Entrega prometida" valor={previsao ? rotuloPrazo(previsao, agora, config) : "—"} alerta={entregaVencida} />
            {r.atual && <Dado nome="Prazo da etapa" valor={r.atual.prazoEm ? rotuloPrazo(r.atual.prazoEm, agora, config) : "—"} alerta={etapaVencida} />}
            {r.atual && <Dado nome="Na fila" valor={formatarDuracao(r.fila)} />}
            {r.atual?.iniciadaEm && <Dado nome="Em execução" valor={formatarDuracao(r.execucao)} />}
            {r.bloqueio > 0 && <Dado nome="Parada" valor={formatarDuracao(r.bloqueio)} />}
          </dl>
          {bloqueioAberto && (
            <p className="mt-4 px-3 py-2.5 rounded-controle bg-alerta-claro text-alerta text-[13px] font-medium leading-snug">
              <Icone nome="bloqueio" tamanho={14} className="inline -mt-0.5 mr-1.5" />
              Parado {rotuloHaQuanto(bloqueioAberto.inicioEm, agora)}: {bloqueioAberto.motivo}
            </p>
          )}
        </section>

        {/* etapas */}
        <section className="px-5 py-4" aria-labelledby={`${idTitulo}-etapas`}>
          <h3 id={`${idTitulo}-etapas`} className="text-[14px] font-semibold mb-2">
            Etapas
          </h3>
          <div aria-live="polite" className="empty:hidden mb-3">
            {aviso && (
              <p role={aviso.tipo === "erro" ? "alert" : "status"} className={`px-3 py-2 rounded-controle text-[13px] font-medium ${aviso.tipo === "ok" ? "bg-ok-claro text-ok" : "bg-alerta-claro text-alerta"}`}>
                {aviso.texto}
              </p>
            )}
          </div>
          <ol className="m-0 p-0 list-none border-t border-linha">
            {v.etapas.map((e) => (
              <LinhaEtapa
                key={e.id}
                etapa={e}
                atualId={r.atual?.id}
                agora={agora}
                perfis={perfis}
                funcionarios={funcionarios}
                podeEditar={podeEditar}
                onAviso={setAviso}
              />
            ))}
          </ol>
          {v.etapas.length === 0 && <p className="py-3 text-tinta-suave">Esta OS ainda não tem etapas. Defina o tipo de reparo na ficha.</p>}
        </section>
      </div>

      {podeAbrirFicha && (
        <footer className="shrink-0 px-5 py-4 border-t border-linha">
          <BotaoLink para={`/orcamentos/${v.os.id}`} variante="secundario" icone="documento" className="w-full">
            Abrir ficha da OS
          </BotaoLink>
        </footer>
      )}
    </aside>
  );
}

function Dado({ nome, valor, alerta = false }: { nome: string; valor: string; alerta?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-tinta-suave">{nome}</dt>
      <dd className={`m-0 text-[16px] font-semibold truncate ${alerta ? "text-alerta" : ""}`}>{valor}</dd>
    </div>
  );
}

function LinhaEtapa({
  etapa,
  atualId,
  agora,
  perfis,
  funcionarios,
  podeEditar,
  onAviso,
}: {
  etapa: EtapaOS;
  atualId?: string;
  agora: MarcoISO;
  perfis: Perfil[];
  funcionarios: Perfil[];
  podeEditar: boolean;
  onAviso: (a: Aviso) => void;
}) {
  const acoes = useAcoes();
  const [dispensando, setDispensando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const idCampo = useId();
  const fechada = etapa.estado === "concluida" || etapa.estado === "dispensada";
  const podeDispensar = podeEditar && (etapa.estado === "aguardando" || etapa.estado === "na_fila");
  const atual = etapa.id === atualId;
  // "Parada" no lugar de "Impedida" (revisão SH: o dono fala "parado")
  const estado = etapa.estado === "bloqueada" ? { ...ESTADO_ETAPA.bloqueada, texto: "Parada" } : ESTADO_ETAPA[etapa.estado];
  const nomeResp = nomePerfil(perfis, etapa.responsavelId);

  async function atribuir(perfilId: string) {
    if (!perfilId) return;
    const r = await acoes.atribuirResponsavel.mutateAsync([etapa.id, perfilId]);
    onAviso(r.ok ? { tipo: "ok", texto: `${etapa.nome}: responsável agora é ${nomePerfil(perfis, perfilId)}.` } : { tipo: "erro", texto: mensagemErro(r.codigo) });
  }

  async function dispensar(ev: FormEvent) {
    ev.preventDefault();
    const r = await acoes.dispensarEtapa.mutateAsync([etapa.id, motivo]);
    if (r.ok) {
      setDispensando(false);
      setMotivo("");
      onAviso({ tipo: "ok", texto: `Etapa ${etapa.nome} dispensada.` });
    } else onAviso({ tipo: "erro", texto: mensagemErro(r.codigo) });
  }

  const tempos =
    etapa.estado === "concluida" || etapa.estado === "em_execucao" || etapa.estado === "bloqueada"
      ? `fila ${formatarDuracao(tempoEmFila(etapa, agora))} · execução ${formatarDuracao(tempoEmExecucao(etapa, agora))}`
      : etapa.estado === "na_fila"
        ? `na fila há ${formatarDuracao(tempoEmFila(etapa, agora))}`
        : etapa.estado === "dispensada"
          ? etapa.motivoDispensa
          : undefined;

  return (
    <li className={`py-3 border-b border-linha ${atual ? "bg-amarelo-claro/70 -mx-5 px-5" : ""}`}>
      <div className="flex items-start gap-3">
        <span className={`inline-grid place-items-center w-6 h-6 shrink-0 rounded-full text-[12px] font-semibold numero ${atual ? "bg-amarelo text-preto" : fechada ? "bg-tinta text-cartao" : "bg-cinza-100 text-tinta-suave"}`}>
          {etapa.ordem}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={`font-semibold truncate ${etapa.estado === "dispensada" ? "line-through text-tinta-fraca" : ""}`}>{etapa.nome}</p>
            <Etiqueta tom={estado.tom}>{estado.texto}</Etiqueta>
          </div>
          {tempos && <p className="text-[12px] text-tinta-suave numero mt-0.5 break-words">{tempos}</p>}
          {etapa.pecasPrevistas !== undefined && (
            <p className="text-[12px] text-tinta-suave numero">
              Peças {etapa.pecasFeitas ?? 0}/{etapa.pecasPrevistas}
            </p>
          )}

          <div className="mt-2 flex items-center gap-2">
            {podeEditar && !fechada ? (
              <>
                <label htmlFor={idCampo} className="sr-only">
                  Responsável por {etapa.nome}
                </label>
                <span className="relative flex min-w-0 flex-1">
                <select
                  id={idCampo}
                  value={etapa.responsavelId ?? ""}
                  onChange={(e) => atribuir(e.target.value)}
                  disabled={acoes.atribuirResponsavel.isPending}
                  className="appearance-none h-11 md:h-9 w-full min-w-0 pl-2.5 pr-8 bg-cartao cursor-pointer border border-linha-forte shadow-controle text-[13px] font-medium outline-none hover:border-tinta-fraca focus:border-tinta-fraca focus:ring-[3px] focus:ring-amarelo/30 transition-colors duration-150"
                >
                  <option value="" disabled>
                    Sem responsável
                  </option>
                  {funcionarios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                      {p.funcao ? ` · ${p.funcao}` : ""}
                    </option>
                  ))}
                </select>
                </span>
              </>
            ) : (
              <Responsavel nome={nomeResp} />
            )}
            {podeDispensar && !dispensando && (
              <Botao tamanho="denso" variante="fantasma" onClick={() => setDispensando(true)} aria-label={`Dispensar a etapa ${etapa.nome}`}>
                Dispensar
              </Botao>
            )}
          </div>

          {dispensando && (
            <form onSubmit={dispensar} className="mt-3 flex flex-col gap-2">
              <label htmlFor={`${idCampo}-motivo`} className="text-[13px] font-medium text-tinta-suave">
                Por que a etapa {etapa.nome} não se aplica?
              </label>
              <textarea
                id={`${idCampo}-motivo`}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                required
                rows={2}
                autoFocus
                placeholder="Ex.: dano só de martelinho, sem funilaria"
                className="px-3 py-2 bg-cartao border border-linha-forte focus:border-tinta-fraca focus:ring-[3px] focus:ring-amarelo/30 outline-none resize-y"
              />
              <div className="flex gap-2">
                <Botao type="submit" tamanho="denso" variante="perigo" disabled={!motivo.trim() || acoes.dispensarEtapa.isPending}>
                  Dispensar etapa
                </Botao>
                <Botao
                  tamanho="denso"
                  variante="fantasma"
                  onClick={() => {
                    setDispensando(false);
                    setMotivo("");
                  }}
                >
                  Cancelar
                </Botao>
              </div>
            </form>
          )}
        </div>
      </div>
    </li>
  );
}

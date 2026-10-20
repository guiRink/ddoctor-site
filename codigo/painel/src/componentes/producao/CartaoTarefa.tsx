import { useId, useState, type FormEvent } from "react";
import type { ConfigOficina, EtapaOS, Foto, Id, MarcoISO } from "@compartilhado/tipos";
import { fotosDaEtapa } from "@compartilhado/dominio/fotos";
import { progressoEtapas, semaforoEtapa } from "@compartilhado/dominio/semaforo";
import { formatarDuracao, tempoBloqueada, tempoEmExecucao, tempoEmFila } from "@compartilhado/dominio/tempos";
import type { DadosConclusaoEtapa, OSVisao } from "../../dados/repositorio";
import { mensagemErro, useAcoes } from "../../dados/hooks";
import { useSessao } from "../../dados/sessao";
import { podeAdicionarFoto, podeRemoverFoto } from "../../dominio/permissoes";
import { ESTADO_ETAPA, TECNICA } from "../../dominio/rotulos";
import { Botao, SUPERFICIE } from "../ui/Basicos";
import { Etiqueta, Semaforo } from "../ui/Estado";
import { Placa } from "../ui/Placa";
import { CapturaFoto, type EstadoCaptura } from "../fotos/CapturaFoto";
import { Icone } from "../Icone";
import { formatarPrazo } from "./quadro";

/** Motivos de impedimento (docs/painel-informacoes.md §3.5). "Outro" exige o texto. */
const MOTIVOS_IMPEDIMENTO = [
  "Peça do segurado não chegou",
  "Falta de material",
  "Dúvida com o analista / aprovação",
  "Retrabalho",
  "Cliente não respondeu",
  "Outro",
] as const;

export type Retorno = { tipo: "ok" | "erro"; texto: string };

type Modo = "normal" | "concluir" | "impedir";

/**
 * Uma tarefa (etapa) no celular da produção: identificação do carro, etapa em destaque, tempos e
 * botões de 56 px. Concluir e Informar impedimento abrem uma confirmação dentro do próprio cartão.
 */
export function CartaoTarefa({
  etapa,
  v,
  agora,
  config,
  executorId,
  podeAgir,
  onRetorno,
}: {
  etapa: EtapaOS;
  v: OSVisao;
  agora: MarcoISO;
  config: ConfigOficina;
  /** Quem fica como responsável ao iniciar (a própria pessoa ou o funcionário escolhido pelo gestor). */
  executorId: string;
  podeAgir: boolean;
  onRetorno: (r: Retorno) => void;
}) {
  const acoes = useAcoes();
  const { perfil } = useSessao();
  const [modo, setModo] = useState<Modo>("normal");
  const [erro, setErro] = useState("");
  const id = useId();

  const semaforo = semaforoEtapa(etapa, agora, config);
  const bloqueada = etapa.estado === "bloqueada";
  const bloqueio = bloqueada ? etapa.bloqueios.find((b) => !b.fimEm) : undefined;
  const { total, atualIndex } = progressoEtapas(v.etapas);
  const placa = v.veiculo.placa;
  const pecas = pecasDoServico(v);
  const ocupado =
    acoes.iniciarEtapa.isPending || acoes.concluirEtapa.isPending || acoes.bloquearEtapa.isPending || acoes.retomarEtapa.isPending;

  async function executar(acao: () => Promise<{ ok: boolean; codigo?: string }>, sucesso: string) {
    setErro("");
    try {
      const r = await acao();
      if (r.ok) {
        setModo("normal");
        onRetorno({ tipo: "ok", texto: sucesso });
      } else setErro(mensagemErro(r.codigo));
    } catch {
      setErro(mensagemErro());
    }
  }

  const proxima = [...v.etapas].sort((a, b) => a.ordem - b.ordem).find((e) => e.ordem > etapa.ordem && e.estado !== "dispensada");

  return (
    <article aria-labelledby={`${id}-titulo`} className={`${SUPERFICIE} overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <Placa placa={placa} tamanho="m" />
          <Semaforo valor={semaforo} texto={bloqueada && semaforo === "vermelho" ? "Impedido" : undefined} />
        </div>
        <p className="mt-3 text-[16px] font-semibold leading-tight">
          {v.veiculo.modelo ?? "Modelo não informado"}
          {v.veiculo.cor && <span className="font-normal text-tinta-suave"> · {v.veiculo.cor}</span>}
        </p>
        <h3 id={`${id}-titulo`} className="mt-1.5 titulo text-[28px]">
          {etapa.nome}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Etiqueta tom={ESTADO_ETAPA[etapa.estado].tom}>{ESTADO_ETAPA[etapa.estado].texto}</Etiqueta>
          <span className="text-[13px] text-tinta-suave numero">
            {atualIndex !== null ? `Etapa ${atualIndex + 1} de ${total}` : ""}
            {v.tipoReparo && ` · ${v.tipoReparo.nome}`}
          </span>
        </div>

        <dl className="mt-4 pt-3 border-t border-linha grid grid-cols-2 gap-x-4 gap-y-3 numero">
          {etapa.estado === "na_fila" && <Dado nome="Na fila há" valor={formatarDuracao(tempoEmFila(etapa, agora))} />}
          {etapa.estado !== "na_fila" && <Dado nome="Em execução" valor={formatarDuracao(tempoEmExecucao(etapa, agora))} />}
          {bloqueada ? (
            <Dado nome="Parada há" valor={formatarDuracao(tempoBloqueada(etapa, agora))} alerta />
          ) : (
            <Dado nome="Prazo da etapa" valor={etapa.prazoEm ? formatarPrazo(etapa.prazoEm, agora) : "—"} alerta={semaforo === "vermelho"} />
          )}
          <Dado nome="Peças previstas" valor={etapa.pecasPrevistas !== undefined ? String(etapa.pecasPrevistas) : "—"} />
          <Dado nome="Foto ao concluir" valor={etapa.exigeFoto ? "Obrigatória" : "Não precisa"} />
        </dl>

        {bloqueio ? (
          <p className="mt-4 px-3 py-2.5 rounded-controle bg-alerta-claro text-alerta text-[14px] font-medium leading-snug">Impedimento: {bloqueio.motivo}</p>
        ) : (
          pecas.length > 0 && (
            <div className="mt-4 px-3 py-2.5 rounded-controle bg-cinza-50 border border-linha">
              <p className="text-[13px] font-medium text-tinta-suave">Serviço no carro</p>
              <ul className="mt-1 m-0 p-0 list-none text-[14px] leading-snug">
                {pecas.map((p) => (
                  <li key={p.peca}>
                    {p.peca} <span className="text-tinta-suave">· {TECNICA[p.tecnica]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        )}
      </div>

      {podeAgir && (
        <div className="px-4 pb-4">
          {erro && (
            <p role="alert" className="mb-3 px-3 py-2.5 rounded-controle bg-alerta-claro text-alerta text-[14px] font-medium">
              {erro}
            </p>
          )}

          {modo === "normal" && (
            <div className="flex flex-col gap-4">
              {etapa.estado === "na_fila" && (
                <Botao
                  variante="primario"
                  tamanho="grande"
                  icone="play"
                  className="w-full"
                  disabled={ocupado}
                  onClick={() => executar(() => acoes.iniciarEtapa.mutateAsync([etapa.id, executorId]), `${etapa.nome} iniciada · ${placa}.`)}
                >
                  {acoes.iniciarEtapa.isPending ? "Iniciando…" : "Iniciar"}
                </Botao>
              )}
              {etapa.estado === "em_execucao" && (
                <>
                  <Botao variante="primario" tamanho="grande" icone="ok" className="w-full" disabled={ocupado} onClick={() => setModo("concluir")}>
                    Concluir
                  </Botao>
                  <Botao variante="contorno" tamanho="grande" icone="bloqueio" className="w-full" disabled={ocupado} onClick={() => setModo("impedir")}>
                    Informar impedimento
                  </Botao>
                </>
              )}
              {bloqueada && (
                <Botao
                  variante="primario"
                  tamanho="grande"
                  icone="play"
                  className="w-full"
                  disabled={ocupado}
                  onClick={() => executar(() => acoes.retomarEtapa.mutateAsync([etapa.id]), `${etapa.nome} retomada · ${placa}.`)}
                >
                  {acoes.retomarEtapa.isPending ? "Retomando…" : "Retomar"}
                </Botao>
              )}
            </div>
          )}

          {modo === "concluir" && (
            <FormConcluir
              etapa={etapa}
              osId={v.os.id}
              fotos={fotosDaEtapa(v.fotos, v.os.id, etapa.id)}
              // a foto da última etapa é a do carro pronto ("final"); as outras, "durante"
              fase={proxima ? "durante" : "final"}
              podeFotografar={podeAdicionarFoto(perfil.papel)}
              podeRemover={(f) => podeRemoverFoto(perfil.papel, f, perfil.id)}
              ocupado={acoes.concluirEtapa.isPending}
              onVoltar={() => {
                setModo("normal");
                setErro("");
              }}
              onConfirmar={(dados) =>
                executar(
                  () => acoes.concluirEtapa.mutateAsync([etapa.id, dados]),
                  `${etapa.nome} concluída · ${placa}.${proxima ? ` Próxima etapa: ${proxima.nome}.` : " Carro pronto para entrega."}`,
                )
              }
            />
          )}

          {modo === "impedir" && (
            <FormImpedimento
              ocupado={acoes.bloquearEtapa.isPending}
              onVoltar={() => {
                setModo("normal");
                setErro("");
              }}
              onConfirmar={(motivo) => executar(() => acoes.bloquearEtapa.mutateAsync([etapa.id, motivo]), `Impedimento registrado em ${etapa.nome} · ${placa}. O gestor já vê no quadro.`)}
            />
          )}
        </div>
      )}
    </article>
  );
}

function Dado({ nome, valor, alerta = false }: { nome: string; valor: string; alerta?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-tinta-suave">{nome}</dt>
      <dd className={`m-0 mt-0.5 text-[16px] font-semibold ${alerta ? "text-alerta" : ""}`}>{valor}</dd>
    </div>
  );
}

/** Peças do serviço (nome e técnica; nunca valores): itens autorizados da versão aprovada mais recente. */
function pecasDoServico(v: OSVisao) {
  const versao = v.versoes.find((x) => x.estado === "aprovado") ?? v.versoes[0];
  if (!versao) return [];
  return versao.itens.filter((i) => i.statusItem === "autorizado" || i.statusItem === "solicitado").map((i) => ({ peca: i.peca, tecnica: i.tecnica }));
}

// ------------------------------------------------------------------ confirmar conclusão

function FormConcluir({
  etapa,
  osId,
  fotos,
  fase,
  podeFotografar,
  podeRemover,
  ocupado,
  onVoltar,
  onConfirmar,
}: {
  etapa: EtapaOS;
  osId: Id;
  /** Fotos já ligadas a esta etapa. */
  fotos: Foto[];
  fase: "durante" | "final";
  podeFotografar: boolean;
  podeRemover: (f: Foto) => boolean;
  ocupado: boolean;
  onVoltar: () => void;
  onConfirmar: (dados: DadosConclusaoEtapa) => void;
}) {
  const id = useId();
  const pedeContagem = etapa.pecasPrevistas !== undefined || Boolean(etapa.exigeContagemPecas);
  const [pecas, setPecas] = useState(etapa.exigeContagemPecas ? "" : String(etapa.pecasPrevistas ?? 0));
  const [captura, setCaptura] = useState<EstadoCaptura>({ ids: fotos.map((f) => f.id), ocupado: false });
  // sem exigência, a foto é opcional e fica recolhida (abre sozinha se já houver foto da etapa)
  const [abrirOpcional, setAbrirOpcional] = useState(fotos.length > 0);
  const n = Number(pecas);
  const pecasOk = !pedeContagem || (pecas.trim() !== "" && Number.isInteger(n) && n >= 0);
  const qtdFotos = captura.ids.length;
  const fotoOk = !etapa.exigeFoto || qtdFotos > 0;
  const pode = pecasOk && fotoOk && !captura.ocupado && !ocupado;
  const mostrarCaptura = podeFotografar && (etapa.exigeFoto || abrirOpcional);

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!pode) return;
    onConfirmar({ pecasFeitas: pedeContagem ? n : undefined, fotoIds: qtdFotos ? captura.ids : undefined });
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5 border-t border-linha pt-4">
      <p className="text-[16px] font-semibold">Concluir {etapa.nome}</p>

      {pedeContagem && (
        <div>
          <label htmlFor={`${id}-pecas`} className="block text-[14px] font-medium mb-2">
            Quantas peças você fez?
            {etapa.pecasPrevistas !== undefined && <span className="font-normal text-tinta-suave"> ({etapa.pecasPrevistas} previstas)</span>}
          </label>
          <div className="flex items-stretch h-14">
            <button
              type="button"
              aria-label="Uma peça a menos"
              onClick={() => setPecas(String(Math.max(0, (Number.isFinite(n) ? n : 0) - 1)))}
              className="w-14 shrink-0 grid place-items-center rounded-l-controle bg-cartao border border-linha-forte text-[24px] font-medium hover:bg-cinza-50 transition-colors duration-150"
            >
              −
            </button>
            <input
              id={`${id}-pecas`}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={pecas}
              onChange={(e) => setPecas(e.target.value)}
              className="relative flex-1 min-w-0 rounded-none text-center text-[24px] font-semibold numero bg-cartao border-y border-linha-forte outline-none focus:z-10 focus:ring-[3px] focus:ring-amarelo/30"
            />
            <button
              type="button"
              aria-label="Uma peça a mais"
              onClick={() => setPecas(String((Number.isFinite(n) ? n : 0) + 1))}
              className="w-14 shrink-0 grid place-items-center rounded-r-controle bg-cartao border border-linha-forte text-[24px] font-medium hover:bg-cinza-50 transition-colors duration-150"
            >
              +
            </button>
          </div>
          {!pecasOk && <p className="mt-1.5 text-[13px] text-alerta font-medium">Informe um número inteiro de peças.</p>}
        </div>
      )}

      {etapa.exigeFoto || mostrarCaptura ? (
        <section aria-labelledby={`${id}-fotos`} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h4 id={`${id}-fotos`} className="text-[14px] font-medium">
              {fase === "final" ? "Foto do carro pronto" : "Foto do serviço pronto"}
              {!etapa.exigeFoto && <span className="font-normal text-tinta-fraca"> · opcional</span>}
            </h4>
            {qtdFotos > 0 ? (
              <Etiqueta tom="ok">{qtdFotos === 1 ? "1 foto" : `${qtdFotos} fotos`}</Etiqueta>
            ) : (
              etapa.exigeFoto && <Etiqueta tom="neutro">Obrigatória</Etiqueta>
            )}
          </div>
          {podeFotografar ? (
            <CapturaFoto
              osId={osId}
              fase={fase}
              etapaId={etapa.id}
              fotos={fotos}
              podeRemover={podeRemover}
              rotulo={`Fotos de ${etapa.nome}`}
              onEstado={setCaptura}
            />
          ) : (
            <p className="text-[13px] text-tinta-suave">Seu acesso não permite tirar foto. Peça a quem está no carro.</p>
          )}
          {etapa.exigeFoto && qtdFotos === 0 && !captura.ocupado && (
            <p className="text-[13px] text-tinta-suave">Esta etapa exige foto. Tire ao menos uma antes de concluir; pode tirar várias.</p>
          )}
        </section>
      ) : (
        podeFotografar && (
          <button
            type="button"
            aria-expanded={false}
            onClick={() => setAbrirOpcional(true)}
            className="flex items-center gap-3 min-h-12 px-3 -mx-1 rounded-controle text-left text-[15px] font-medium text-tinta-suave hover:text-tinta hover:bg-cinza-100 transition-colors duration-150"
          >
            <Icone nome="camera" tamanho={20} className="shrink-0" />
            <span className="flex-1">Adicionar foto <span className="font-normal text-tinta-fraca">(opcional)</span></span>
            <Icone nome="baixo" tamanho={18} className="shrink-0" />
          </button>
        )
      )}

      {!pedeContagem && !etapa.exigeFoto && <p className="text-[14px] text-tinta-suave">Confirme que terminou esta etapa. A próxima entra na fila.</p>}

      <div className="flex flex-col gap-2">
        <Botao type="submit" variante="primario" tamanho="grande" icone="ok" className="w-full" disabled={!pode} aria-describedby={!pode && captura.ocupado ? `${id}-espera` : undefined}>
          {ocupado ? "Concluindo…" : "Confirmar conclusão"}
        </Botao>
        {captura.ocupado && (
          <p id={`${id}-espera`} className="text-[13px] text-tinta-suave text-center">
            Aguarde a foto terminar de salvar.
          </p>
        )}
        <Botao variante="fantasma" className="w-full" onClick={onVoltar}>
          Voltar
        </Botao>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ informar impedimento

function FormImpedimento({ ocupado, onVoltar, onConfirmar }: { ocupado: boolean; onVoltar: () => void; onConfirmar: (motivo: string) => void }) {
  const id = useId();
  const [motivo, setMotivo] = useState<string>("");
  const [texto, setTexto] = useState("");
  const outro = motivo === "Outro";
  const pode = Boolean(motivo) && (!outro || texto.trim().length > 0) && !ocupado;

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!pode) return;
    const detalhe = texto.trim();
    onConfirmar(outro ? detalhe : detalhe ? `${motivo} — ${detalhe}` : motivo);
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4 border-t border-linha pt-4">
      <fieldset className="m-0 p-0 border-0 min-w-0">
        <legend className="text-[16px] font-semibold mb-3">O que está impedindo?</legend>
        <div className="flex flex-col gap-2">
          {MOTIVOS_IMPEDIMENTO.map((m) => (
            <label
              key={m}
              className={`flex items-center gap-3 min-h-12 px-3 rounded-controle border cursor-pointer transition-colors duration-150 ${motivo === m ? "border-amarelo-escuro bg-amarelo-claro" : "border-linha-forte bg-cartao hover:bg-cinza-50"}`}
            >
              <input type="radio" name={`${id}-motivo`} value={m} checked={motivo === m} onChange={() => setMotivo(m)} className="w-5 h-5 shrink-0" />
              <span className="text-[16px] font-medium">{m}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor={`${id}-texto`} className="block text-[14px] font-medium mb-2">
          {outro ? "Descreva o impedimento" : "Detalhe (opcional)"}
        </label>
        <textarea
          id={`${id}-texto`}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          required={outro}
          placeholder={outro ? "O que aconteceu?" : "Ex.: moldura da porta"}
          className="w-full px-3 py-2.5 bg-cartao border border-linha-forte focus:border-tinta-fraca focus:ring-[3px] focus:ring-amarelo/30 outline-none resize-y text-[16px]"
        />
      </div>
      <Botao type="submit" variante="secundario" tamanho="grande" icone="bloqueio" className="w-full" disabled={!pode}>
        {ocupado ? "Registrando…" : "Registrar impedimento"}
      </Botao>
      <Botao variante="fantasma" className="w-full" onClick={onVoltar}>
        Voltar
      </Botao>
    </form>
  );
}

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Avaria, TipoReparo, TipoAvaria } from "@compartilhado/tipos";
import { TIPOS_AVARIA } from "@compartilhado/tipos";
import { LIMITES_ALERTA, alertaCarroBase, itensChecklist } from "@compartilhado/dominio/config";
import { entregaPorDiasUteis, type EntradaAlertaOS } from "@compartilhado/dominio/corCarro";
import { diasUteisEntre } from "@compartilhado/dominio/expediente";
import { dataNoFuso } from "@compartilhado/dominio/fuso";
import { progressoChecklist } from "@compartilhado/dominio/recepcao";
import { mensagemErro, useAcoes, useAgora, useConfig } from "../../dados/hooks";
import type { OSVisao } from "../../dados/repositorio";
import { ERRO_CAMPO_CONFIG, NIVEL_COMBUSTIVEL, TIPO_AVARIA } from "../../dominio/rotulos";
import { Botao, Erro, Esqueleto } from "../ui/Basicos";
import { Etiqueta, Provisorio } from "../ui/Estado";
import { Placa } from "../ui/Placa";
import { Icone } from "../Icone";
import { Aviso, MensagemErro } from "../ui/Campos";
import { Gaveta } from "../ui/Gaveta";
import { Checklist, ProgressoChecklist } from "./Checklist";
import { FormRecepcao, MedidorCombustivel, type DadosRecepcao } from "./FormRecepcao";
import { kmLegivel, nomeCarro } from "../os/formato";
import { MapaAvarias, Marcador } from "./MapaAvarias";
import { useSessao } from "../../dados/sessao";
import { podeCriarTipoReparo, podeEditarAlertaOS, podeEditarConfig } from "../../dominio/permissoes";
import { FormTipoReparo } from "../tipos-reparo/FormTipoReparo";
import { EditarCategorias } from "../tipos-reparo/EditarCategorias";
import { EditarChecklist } from "./EditarChecklist";
import { tipoReparoAtivo } from "@compartilhado/dominio/tiposReparo";
import { Interruptor } from "../ajustes/Estrutura";
import { Passo } from "../ajustes/Numeros";
import { diaCurto } from "../orcamentos/formato";

/**
 * "Receber o carro": registra a entrada com a recepção em passos, num painel lateral (diálogo nativo:
 * Esc fecha, foco preso). 1 Dados (tipo de reparo, km, combustível, reclamação) · 2 Checklist ·
 * 3 Avarias · 4 Confirmar. Checklist e avarias podem ser pulados: a recepção fica registrada como incompleta.
 * No passo 1, quem pode (podeCriarTipoReparo) edita/arquiva as categorias ("Editar categorias", gaveta por cima)
 * e cria uma nova na hora ("+ Criar nova categoria"), que volta marcada; as arquivadas saem da escolha. No passo 2,
 * dono e gestor (podeEditarConfig) editam o checklist da oficina ("Editar checklist"; pedido do dono, sprint SI)
 * sem perder as marcações dos itens que continuam. E quem pode (podeEditarAlertaOS) combina o prazo em dias úteis e marca "Urgente" (pedido do
 * dono, 2º áudio) — gravados com salvarAlertaOS logo depois da entrada.
 * Usado na ficha da OS (Próxima ação e aba Recepção) e no painel da Agenda.
 */
const PASSOS = ["Dados", "Checklist", "Avarias", "Confirmar"] as const;

export function ReceberCarro({
  v,
  tipos: tiposRecebidos,
  onFechar,
  onConcluido,
}: {
  v: OSVisao;
  tipos: TipoReparo[];
  onFechar: () => void;
  /** Chamado depois de registrar; recebe a mensagem de sucesso para a tela mostrar. */
  onConcluido: (mensagem: string) => void;
}) {
  const corpo = useRef<HTMLDivElement>(null);
  const idTipo = useId();
  const config = useConfig();
  const acoes = useAcoes();
  const { perfil } = useSessao();
  const podeCriar = podeCriarTipoReparo(perfil.papel);
  const podePrazo = podeEditarAlertaOS(perfil.papel);
  const podeChecklist = podeEditarConfig(perfil.papel);

  // categoria criada aqui: aparece já marcada, sem esperar a lista de tipos recarregar
  const [criando, setCriando] = useState(false);
  const [editandoCategorias, setEditandoCategorias] = useState(false);
  const [editandoChecklist, setEditandoChecklist] = useState(false);
  const [criado, setCriado] = useState<TipoReparo>();
  // todas (as arquivadas também: nome repetido e modelos) e as que aparecem na escolha
  const todos = criado && !tiposRecebidos.some((t) => t.id === criado.id) ? [...tiposRecebidos, criado] : tiposRecebidos;
  const tipos = todos.filter((t) => tipoReparoAtivo(t) || t.id === v.os.tipoReparoId);
  const focarCriado = useRef(false);

  const [passo, setPasso] = useState(0);
  const [tipoEscolhido, setTipoId] = useState(() => {
    const ativos = tiposRecebidos.filter(tipoReparoAtivo);
    return v.os.tipoReparoId ?? (ativos.length === 1 ? ativos[0].id : "");
  });
  // escolha preservada ao editar as categorias; se a escolhida foi arquivada, volta a "nenhuma"
  const tipoId = tipos.some((t) => t.id === tipoEscolhido) ? tipoEscolhido : "";
  const [dados, setDados] = useState<DadosRecepcao>({
    km: v.os.recepcao?.km,
    combustivel: v.os.recepcao?.combustivel,
    reclamacao: v.os.recepcao?.reclamacao,
    obsInternas: v.os.recepcao?.obsInternas,
  });
  const [checklist, setChecklist] = useState<Record<string, boolean>>(v.os.recepcao?.checklist ?? {});
  const [avarias, setAvarias] = useState<Avaria[]>(v.os.recepcao?.avarias ?? []);
  const [pulados, setPulados] = useState<{ checklist?: boolean; avarias?: boolean }>({});
  const [erroTipo, setErroTipo] = useState("");
  // prazo combinado (dias úteis a partir de hoje, o dia da entrada): undefined = o valor sugerido
  const [prazoTxt, setPrazoTxt] = useState<string>();
  const [urgente, setUrgente] = useState(v.os.prioridade === 2);
  const [erroPrazo, setErroPrazo] = useState("");
  const [erro, setErro] = useState("");

  // ao trocar de passo, volta ao topo do conteúdo
  useEffect(() => {
    corpo.current?.scrollTo?.({ top: 0 });
  }, [passo]);

  // depois de criar a categoria, o foco vai para o rádio dela (a gaveta do formulário devolveria ao botão)
  useEffect(() => {
    if (!focarCriado.current || criando || !criado) return;
    focarCriado.current = false;
    const i = tipos.findIndex((t) => t.id === criado.id);
    document.getElementById(`${idTipo}-${i}`)?.focus();
  });

  const itens = config.data ? itensChecklist(config.data) : [];
  const tipo = tipos.find((t) => t.id === tipoId);
  const prog = progressoChecklist(checklist, itens);
  const salvando = acoes.registrarEntrada.isPending || acoes.salvarAlertaOS.isPending;

  // entrega já combinada (agendamento): o prazo sugerido é o que leva até ela; senão, o padrão da oficina
  const agoraEntrada = useAgora();
  const hoje = dataNoFuso(agoraEntrada);
  const combinada = v.os.previsaoEntrega && v.os.previsaoEntrega.slice(0, 10) >= hoje ? v.os.previsaoEntrega.slice(0, 10) : undefined;
  const base = config.data ? alertaCarroBase(config.data) : undefined;
  const prazoSugerido = config.data && base ? (combinada ? Math.min(LIMITES_ALERTA.prazoDiasUteis.max, diasUteisEntre(hoje, combinada, config.data)) : base.prazoPadraoDiasUteis) : 0;
  const prazoTexto = prazoTxt ?? String(prazoSugerido);
  const prazoN = /^\d+$/.test(prazoTexto) ? Number(prazoTexto) : NaN;
  const prazoValido = Number.isInteger(prazoN) && prazoN >= LIMITES_ALERTA.prazoDiasUteis.min && prazoN <= LIMITES_ALERTA.prazoDiasUteis.max;
  const entregaPrevista = config.data && prazoValido ? entregaPorDiasUteis(hoje, prazoN, config.data) : undefined;

  /** O que vai para salvarAlertaOS depois da entrada (null = nada a gravar). */
  function alertaDaEntrada(): EntradaAlertaOS | null {
    if (!podePrazo) return null;
    const e: EntradaAlertaOS = {};
    // sem entrega combinada o prazo define a entrega; com ela, só se a recepção mudou o número
    if (!combinada || prazoN !== prazoSugerido) e.prazoDiasUteis = prazoN;
    if (urgente !== (v.os.prioridade === 2)) e.urgente = urgente;
    return Object.keys(e).length ? e : null;
  }

  function avancar() {
    setErro("");
    if (passo === 0 && !tipoId) {
      setErroTipo(mensagemErro("sem_tipo_reparo"));
      document.getElementById(`${idTipo}-0`)?.focus();
      return;
    }
    if (passo === 0 && podePrazo && !prazoValido) {
      setErroPrazo(ERRO_CAMPO_CONFIG.prazoDiasUteis);
      document.getElementById(`${idTipo}-prazo`)?.focus();
      return;
    }
    setPasso((p) => Math.min(PASSOS.length - 1, p + 1));
  }

  function pular() {
    setPulados((p) => ({ ...p, [passo === 1 ? "checklist" : "avarias"]: true }));
    setPasso((p) => p + 1);
  }

  async function confirmar() {
    setErro("");
    if (!tipoId) {
      setPasso(0);
      setErroTipo(mensagemErro("sem_tipo_reparo"));
      return;
    }
    try {
      // só os itens que ainda estão no checklist (o editor pode ter desativado algum no meio da recepção)
      const conferidos = Object.fromEntries(Object.entries(checklist).filter(([id]) => itens.some((i) => i.id === id && i.ativo)));
      const r = await acoes.registrarEntrada.mutateAsync([v.os.id, tipoId, { ...dados, checklist: conferidos, avarias }]);
      if (!r.ok) {
        setErro(mensagemErro(r.codigo));
        return;
      }
      // prazo e urgência: a entrada já está registrada; se isto falhar, avisa e o ajuste fica para a ficha
      let avisoPrazo = "";
      const alerta = alertaDaEntrada();
      if (alerta) {
        const ra = await acoes.salvarAlertaOS.mutateAsync([v.os.id, alerta]).catch(() => ({ ok: false as const }));
        if (!ra.ok) avisoPrazo = " O prazo não foi salvo: ajuste em Prazo e urgência, na ficha.";
      }
      onConcluido(
        `Carro ${v.veiculo.placa} recebido. As etapas já estão na Produção.${prog.completo ? "" : " O checklist ficou incompleto: complete na aba Recepção."}${avisoPrazo}`,
      );
    } catch {
      setErro(mensagemErro());
    }
  }

  // ------------------------------------------------------------ passos
  let conteudo: ReactNode;
  if (config.isError) {
    conteudo = <Erro mensagem="Não consegui carregar o checklist da oficina." onTentar={() => config.refetch()} />;
  } else if (!config.data) {
    conteudo = <Esqueleto linhas={5} />;
  } else if (passo === 0) {
    conteudo = (
      <div className="flex flex-col gap-6">
        <fieldset aria-describedby={erroTipo ? `${idTipo}-erro` : undefined}>
          <legend className="mb-1.5 text-[13px] font-medium text-tinta-suave">Tipo de reparo (gera as etapas da produção)</legend>
          {tipos.length === 0 && !podeCriar ? (
            <p className="text-[13px] text-tinta-suave">Nenhum tipo de reparo cadastrado. Peça ao dono para cadastrar em Ajustes antes de receber o carro.</p>
          ) : (
            <div className={`flex flex-col border rounded-cartao overflow-hidden bg-cartao ${erroTipo ? "border-alerta" : "border-linha"}`}>
              {tipos.length === 0 && (
                <p className="px-3.5 py-3 border-b border-linha text-[13px] text-tinta-suave">Nenhum tipo de reparo cadastrado ainda. Crie o primeiro para gerar as etapas.</p>
              )}
              {tipos.map((t, i) => {
                const ativo = tipoId === t.id;
                return (
                  <label
                    key={t.id}
                    className={`flex items-start gap-3 px-3.5 py-3 min-h-12 border-b border-linha last:border-b-0 cursor-pointer transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-amarelo-escuro has-[:focus-visible]:-outline-offset-2 ${
                      ativo ? "bg-cinza-50" : "hover:bg-cinza-50"
                    }`}
                  >
                    <input
                      id={`${idTipo}-${i}`}
                      type="radio"
                      name={idTipo}
                      value={t.id}
                      checked={ativo}
                      onChange={() => {
                        setTipoId(t.id);
                        setErroTipo("");
                      }}
                      className="mt-1 w-4 h-4 shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium">
                        {t.nome}
                        {t.provisorio && (
                          <span className="ml-2 text-[12px] font-normal text-tinta-suave">
                            <Provisorio>modelo provisório — a confirmar</Provisorio>
                          </span>
                        )}
                      </span>
                      <span className="block mt-0.5 text-[12px] text-tinta-suave">{t.etapas.map((e) => e.nome).join(" → ")}</span>
                    </span>
                    {criado?.id === t.id && (
                      <span className="ml-auto shrink-0 self-center">
                        <Etiqueta tom="ok">Nova</Etiqueta>
                      </span>
                    )}
                  </label>
                );
              })}
              {podeCriar && todos.length > 0 && (
                <AcaoLista icone="ajustes" titulo="Editar categorias" dica="Mudar nome, etapas e prazos, ou arquivar a que não se usa mais." onClick={() => setEditandoCategorias(true)} />
              )}
              {podeCriar && (
                <AcaoLista icone="mais" titulo="Criar nova categoria" dica="Para um serviço que ainda não está na lista." onClick={() => setCriando(true)} />
              )}
            </div>
          )}
          {erroTipo && (
            <p id={`${idTipo}-erro`} className="mt-1.5 text-[12px] font-medium text-alerta">
              {erroTipo}
            </p>
          )}
        </fieldset>
        <FormRecepcao valor={dados} onMudar={setDados} />
        {podePrazo && base && (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1.5 text-[13px] font-medium text-tinta-suave">Prazo e urgência</legend>
            <div className="flex flex-col bg-cartao border border-linha rounded-cartao divide-y divide-linha">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 px-3.5 py-3">
                <div className="min-w-0 flex-1 basis-52">
                  <label htmlFor={`${idTipo}-prazo`} className="text-[14px] font-medium">
                    Prazo em dias úteis
                  </label>
                  <p id={`${idTipo}-prazo-dica`} className="mt-0.5 text-[12px] text-tinta-suave numero">
                    {entregaPrevista ? <span className="font-medium text-tinta">Entrega em {diaCurto(entregaPrevista)}</span> : "—"}
                    {combinada
                      ? prazoN === prazoSugerido
                        ? " · a já combinada com o cliente"
                        : ` · combinada era ${diaCurto(combinada)}`
                      : ` · padrão da oficina ${base.prazoPadraoDiasUteis} ${base.prazoPadraoDiasUteis === 1 ? "dia útil" : "dias úteis"}`}
                  </p>
                </div>
                <span className="flex items-center gap-2.5">
                  <Passo
                    id={`${idTipo}-prazo`}
                    rotulo="Prazo em dias úteis"
                    texto={prazoTexto}
                    limites={LIMITES_ALERTA.prazoDiasUteis}
                    passo={1}
                    invalido={Boolean(erroPrazo)}
                    descricao={erroPrazo ? `${idTipo}-prazo-erro` : `${idTipo}-prazo-dica`}
                    desabilitado={salvando}
                    onMudar={(t) => {
                      setErroPrazo("");
                      setPrazoTxt(t);
                    }}
                  />
                  <span className="text-[13px] text-tinta-suave min-w-16">{prazoN === 1 ? "dia útil" : "dias úteis"}</span>
                </span>
                {erroPrazo && (
                  <div className="basis-full -mt-1">
                    <MensagemErro id={`${idTipo}-prazo-erro`}>{erroPrazo}</MensagemErro>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-4 px-3.5 py-2">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium">Urgente</p>
                  <p className="text-[12px] text-tinta-suave">Aparece como Urgente no quadro da produção e na TV.</p>
                </div>
                <Interruptor ligado={urgente} onMudar={setUrgente} rotulo="Urgente" desabilitado={salvando} />
              </div>
            </div>
          </fieldset>
        )}
        {editandoCategorias && (
          <EditarCategorias
            tipos={todos}
            onFechar={() => setEditandoCategorias(false)}
            onCriado={(t) => setCriado(t)}
          />
        )}
        {criando && (
          <FormTipoReparo
            existentes={todos}
            onFechar={() => setCriando(false)}
            onSalvo={(t) => {
              setCriado(t);
              setTipoId(t.id);
              setErroTipo("");
              focarCriado.current = true;
              setCriando(false);
            }}
          />
        )}
      </div>
    );
  } else if (passo === 1) {
    conteudo = (
      <div className="flex flex-col gap-4">
        <p className="text-[13px] text-tinta-suave">Confira com o cliente presente. O que não estiver no carro fica desmarcado.</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ProgressoChecklist checklist={checklist} itens={itens} className="flex-1 min-w-[11rem] max-w-sm" />
          <span className="flex items-center gap-2 ml-auto">
            <Botao
              tamanho="denso"
              variante="fantasma"
              onClick={() => setChecklist(Object.fromEntries(itens.filter((i) => i.ativo).map((i) => [i.id, !prog.completo])))}
            >
              {prog.completo ? "Desmarcar tudo" : "Marcar tudo"}
            </Botao>
            {podeChecklist && (
              <Botao tamanho="denso" variante="contorno" icone="ajustes" aria-haspopup="dialog" onClick={() => setEditandoChecklist(true)}>
                Editar checklist
              </Botao>
            )}
          </span>
        </div>
        <Checklist itens={itens} valor={checklist} onMudar={setChecklist} mostrarProgresso={false} />
        {!config.data.checklist && (
          <p className="text-[12px] text-tinta-suave">
            <Provisorio>Checklist padrão provisório — a confirmar</Provisorio>.{" "}
            {podeChecklist ? "Falta um item ou um grupo? Use Editar checklist." : "O dono ajusta os itens em Ajustes."}
          </p>
        )}
        {editandoChecklist && (
          <EditarChecklist
            itens={itens}
            padrao={!config.data.checklist}
            onFechar={() => setEditandoChecklist(false)}
            onSalvo={() => setEditandoChecklist(false)}
          />
        )}
      </div>
    );
  } else if (passo === 2) {
    conteudo = (
      <div className="flex flex-col gap-4">
        <p className="text-[13px] text-tinta-suave">Marque o que já existe no carro antes do serviço. Isso protege a oficina e o cliente.</p>
        <MapaAvarias avarias={avarias} onMudar={setAvarias} />
      </div>
    );
  } else {
    conteudo = (
      <Resumo
        prazo={podePrazo && entregaPrevista ? { dias: prazoN, entrega: entregaPrevista, urgente } : undefined}
        tipo={tipo}
        dados={dados}
        progresso={prog}
        avarias={avarias}
        pulados={pulados}
        onIr={(p) => setPasso(p)}
      />
    );
  }

  const ultimo = passo === PASSOS.length - 1;

  return (
    <Gaveta
      titulo="Receber o carro"
      descricao={
        <span className="block truncate">
          {nomeCarro(v.veiculo) || "Modelo não informado"}
          {v.veiculo.cor && ` · ${v.veiculo.cor}`} · OS <span className="numero">{v.os.numero}</span>
        </span>
      }
      antesDoTitulo={<Placa placa={v.veiculo.placa} tamanho="m" />}
      onFechar={onFechar}
      rotuloFechar="Fechar sem registrar"
      larga
      fundoCorpo="papel"
      corpoClassName=""
      refCorpo={corpo}
      cabecalhoExtra={
        <ol aria-label="Passos" className="flex px-5">
          {PASSOS.map((nome, i) => {
            const atual = i === passo;
            const feito = i < passo;
            return (
              <li key={nome} className="flex-1 min-w-0">
                <button
                  type="button"
                  disabled={i > passo && !tipoId}
                  onClick={() => (i <= passo || tipoId ? setPasso(i) : undefined)}
                  aria-current={atual ? "step" : undefined}
                  className={`w-full flex items-center gap-2 h-11 border-b-2 text-[13px] whitespace-nowrap transition-colors duration-150 ${
                    atual ? "border-amarelo font-semibold text-tinta" : "border-transparent font-medium text-tinta-suave hover:text-tinta"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-grid place-items-center shrink-0 w-5 h-5 rounded-full text-[11px] font-semibold numero ${
                      atual ? "bg-amarelo text-preto" : feito ? "bg-tinta text-cartao" : "bg-cinza-200 text-tinta-suave"
                    }`}
                  >
                    {feito ? <Icone nome="ok" tamanho={12} traco={2.5} /> : i + 1}
                  </span>
                  <span className={`truncate ${atual ? "" : "max-sm:sr-only"}`}>{nome}</span>
                </button>
              </li>
            );
          })}
        </ol>
      }
      rodape={
        <>
          {erro && (
            <div className="mb-2">
              <Aviso tom="alerta">{erro}</Aviso>
            </div>
          )}
          <div className="flex items-center gap-2">
            {passo === 0 ? (
              <Botao variante="fantasma" onClick={() => onFechar()} disabled={salvando}>
                Cancelar
              </Botao>
            ) : (
              <Botao variante="fantasma" icone="voltar" onClick={() => setPasso((p) => p - 1)} disabled={salvando}>
                Voltar
              </Botao>
            )}
            <span className="flex-1" />
            {(passo === 1 || passo === 2) && (
              <Botao variante="contorno" onClick={pular} disabled={salvando}>
                Pular
              </Botao>
            )}
            {ultimo ? (
              <Botao variante="primario" icone="carro" onClick={confirmar} disabled={salvando}>
                {salvando ? "Registrando…" : "Confirmar entrada"}
              </Botao>
            ) : (
              <Botao variante="primario" onClick={avancar} disabled={!config.data}>
                Continuar
                <Icone nome="seta" tamanho={16} />
              </Botao>
            )}
          </div>
        </>
      }
    >
      {conteudo}
    </Gaveta>
  );
}

// ------------------------------------------------------------------ resumo (passo 4)

function Resumo({
  prazo,
  tipo,
  dados,
  progresso,
  avarias,
  pulados,
  onIr,
}: {
  prazo?: { dias: number; entrega: string; urgente: boolean };
  tipo?: TipoReparo;
  dados: DadosRecepcao;
  progresso: ReturnType<typeof progressoChecklist>;
  avarias: Avaria[];
  pulados: { checklist?: boolean; avarias?: boolean };
  onIr: (passo: number) => void;
}) {
  const porTipo = TIPOS_AVARIA.map((t) => [t, avarias.filter((a) => a.tipo === t).length] as [TipoAvaria, number]).filter(([, n]) => n > 0);
  const checklistIncompleto = !progresso.completo;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[14px]">Confira e confirme. O carro entra na Produção agora, com a primeira etapa na fila.</p>
      <dl className="m-0 bg-cartao border border-linha rounded-cartao shadow-cartao divide-y divide-linha">
        <LinhaResumo nome="Tipo de reparo" onEditar={() => onIr(0)}>
          {tipo ? (
            <>
              <span className="font-medium">{tipo.nome}</span>
              <span className="block text-[12px] text-tinta-suave">{tipo.etapas.map((e) => e.nome).join(" → ")}</span>
            </>
          ) : (
            <span className="text-alerta font-medium">Escolha o tipo de reparo</span>
          )}
        </LinhaResumo>
        {prazo && (
          <LinhaResumo nome="Prazo" onEditar={() => onIr(0)}>
            <span className="flex flex-wrap items-center gap-2 numero">
              {prazo.dias} {prazo.dias === 1 ? "dia útil" : "dias úteis"} · entrega {diaCurto(prazo.entrega)}
              {prazo.urgente && <Etiqueta tom="alerta">Urgente</Etiqueta>}
            </span>
          </LinhaResumo>
        )}
        <LinhaResumo nome="Quilometragem" onEditar={() => onIr(0)}>
          <span className="numero">{dados.km !== undefined ? kmLegivel(dados.km) : <span className="text-tinta-fraca">Não informada</span>}</span>
        </LinhaResumo>
        <LinhaResumo nome="Combustível" onEditar={() => onIr(0)}>
          {dados.combustivel ? (
            <span className="inline-flex items-center gap-2">
              <MedidorCombustivel nivel={dados.combustivel} />
              {NIVEL_COMBUSTIVEL[dados.combustivel]}
            </span>
          ) : (
            <span className="text-tinta-fraca">Não informado</span>
          )}
        </LinhaResumo>
        {dados.reclamacao && (
          <LinhaResumo nome="Reclamação" onEditar={() => onIr(0)}>
            <span className="whitespace-pre-line break-words">{dados.reclamacao}</span>
          </LinhaResumo>
        )}
        <LinhaResumo nome="Checklist" onEditar={() => onIr(1)}>
          <span className="flex flex-wrap items-center gap-2">
            <span className="numero">
              {progresso.marcados} de {progresso.total} conferidos
            </span>
            {checklistIncompleto && <Etiqueta tom="atencao">{pulados.checklist && progresso.marcados === 0 ? "Pulado" : "Incompleto"}</Etiqueta>}
          </span>
        </LinhaResumo>
        <LinhaResumo nome="Avarias" onEditar={() => onIr(2)}>
          {avarias.length === 0 ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-tinta-suave">Nenhuma marcada</span>
              {pulados.avarias && <Etiqueta tom="atencao">Pulado</Etiqueta>}
            </span>
          ) : (
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {porTipo.map(([t, n]) => (
                <span key={t} className="inline-flex items-center gap-1.5 numero">
                  <Marcador numero={n} tipo={t} tamanho="p" />
                  {TIPO_AVARIA[t]}
                </span>
              ))}
            </span>
          )}
        </LinhaResumo>
      </dl>
      {(checklistIncompleto || avarias.length === 0) && (
        <p className="text-[13px] text-tinta-suave">
          Dá para completar a recepção depois, na ficha da OS (aba Recepção).
        </p>
      )}
    </div>
  );
}

function LinhaResumo({ nome, onEditar, children }: { nome: string; onEditar: () => void; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,120px)_minmax(0,1fr)_auto] sm:grid-cols-[160px_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3">
      <dt className="text-[13px] font-medium text-tinta-suave pt-0.5">{nome}</dt>
      <dd className="m-0 text-[14px] min-w-0">{children}</dd>
      <button
        type="button"
        onClick={onEditar}
        aria-label={`Alterar ${nome.toLowerCase()}`}
        className="-my-2 -mr-2 h-11 md:h-9 px-2 rounded-controle text-[13px] font-medium text-tinta-suave hover:text-tinta hover:bg-cinza-100 transition-colors duration-150"
      >
        Alterar
      </button>
    </div>
  );
}

/** Linha de ação no fim da lista de categorias ("Editar categorias", "Criar nova categoria"): ícone, título e dica. */
function AcaoLista({ icone, titulo, dica, onClick }: { icone: "mais" | "ajustes"; titulo: string; dica: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className="flex items-center gap-3 px-3.5 py-2.5 min-h-12 w-full text-left text-[14px] font-medium text-tinta border-b border-linha last:border-b-0 hover:bg-cinza-50 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-amarelo-escuro focus-visible:-outline-offset-2"
    >
      <span aria-hidden="true" className="inline-grid place-items-center w-4 h-4 shrink-0 text-tinta-suave">
        <Icone nome={icone} tamanho={16} />
      </span>
      <span className="min-w-0">
        {titulo}
        <span className="block text-[12px] font-normal text-tinta-suave">{dica}</span>
      </span>
    </button>
  );
}

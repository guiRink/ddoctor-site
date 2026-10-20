import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Avaria, TipoReparo, TipoAvaria } from "@compartilhado/tipos";
import { TIPOS_AVARIA } from "@compartilhado/tipos";
import { itensChecklist } from "@compartilhado/dominio/config";
import { progressoChecklist } from "@compartilhado/dominio/recepcao";
import { mensagemErro, useAcoes, useConfig } from "../../dados/hooks";
import type { OSVisao } from "../../dados/repositorio";
import { NIVEL_COMBUSTIVEL, TIPO_AVARIA } from "../../dominio/rotulos";
import { Botao, Erro, Esqueleto } from "../ui/Basicos";
import { Etiqueta, Provisorio } from "../ui/Estado";
import { Placa } from "../ui/Placa";
import { Icone } from "../Icone";
import { Aviso } from "../ui/Campos";
import { Gaveta } from "../ui/Gaveta";
import { Checklist, ProgressoChecklist } from "./Checklist";
import { FormRecepcao, MedidorCombustivel, type DadosRecepcao } from "./FormRecepcao";
import { kmLegivel, nomeCarro } from "../os/formato";
import { MapaAvarias, Marcador } from "./MapaAvarias";
import { useSessao } from "../../dados/sessao";
import { podeCriarTipoReparo } from "../../dominio/permissoes";
import { FormTipoReparo } from "../tipos-reparo/FormTipoReparo";

/**
 * "Receber o carro": registra a entrada com a recepção em passos, num painel lateral (diálogo nativo:
 * Esc fecha, foco preso). 1 Dados (tipo de reparo, km, combustível, reclamação) · 2 Checklist ·
 * 3 Avarias · 4 Confirmar. Checklist e avarias podem ser pulados: a recepção fica registrada como incompleta.
 * No passo 1, quem pode (podeCriarTipoReparo) cria uma categoria nova na hora ("+ Criar nova categoria"),
 * que volta marcada.
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

  // categoria criada aqui: aparece já marcada, sem esperar a lista de tipos recarregar
  const [criando, setCriando] = useState(false);
  const [criado, setCriado] = useState<TipoReparo>();
  const tipos = criado && !tiposRecebidos.some((t) => t.id === criado.id) ? [...tiposRecebidos, criado] : tiposRecebidos;
  const focarCriado = useRef(false);

  const [passo, setPasso] = useState(0);
  const [tipoId, setTipoId] = useState(v.os.tipoReparoId ?? (tiposRecebidos.length === 1 ? tiposRecebidos[0].id : ""));
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
  const salvando = acoes.registrarEntrada.isPending;

  function avancar() {
    setErro("");
    if (passo === 0 && !tipoId) {
      setErroTipo(mensagemErro("sem_tipo_reparo"));
      document.getElementById(`${idTipo}-0`)?.focus();
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
      const r = await acoes.registrarEntrada.mutateAsync([v.os.id, tipoId, { ...dados, checklist, avarias }]);
      if (!r.ok) {
        setErro(mensagemErro(r.codigo));
        return;
      }
      onConcluido(
        `Carro ${v.veiculo.placa} recebido. As etapas já estão na Produção.${prog.completo ? "" : " O checklist ficou incompleto: complete na aba Recepção."}`,
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
              {podeCriar && (
                <button
                  type="button"
                  onClick={() => setCriando(true)}
                  aria-haspopup="dialog"
                  className="flex items-center gap-3 px-3.5 min-h-12 w-full text-left text-[14px] font-medium text-tinta hover:bg-cinza-50 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-amarelo-escuro focus-visible:-outline-offset-2"
                >
                  <span aria-hidden="true" className="inline-grid place-items-center w-4 h-4 shrink-0 text-tinta-suave">
                    <Icone nome="mais" tamanho={16} />
                  </span>
                  <span className="min-w-0">
                    Criar nova categoria
                    <span className="block text-[12px] font-normal text-tinta-suave">Para um serviço que ainda não está na lista.</span>
                  </span>
                </button>
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
        {criando && (
          <FormTipoReparo
            existentes={tipos}
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
          <ProgressoChecklist checklist={checklist} itens={itens} className="flex-1 max-w-sm" />
          <Botao
            tamanho="denso"
            variante="fantasma"
            onClick={() => setChecklist(Object.fromEntries(itens.filter((i) => i.ativo).map((i) => [i.id, !prog.completo])))}
          >
            {prog.completo ? "Desmarcar tudo" : "Marcar tudo"}
          </Botao>
        </div>
        <Checklist itens={itens} valor={checklist} onMudar={setChecklist} mostrarProgresso={false} />
        {!config.data.checklist && (
          <p className="text-[12px] text-tinta-suave">
            <Provisorio>Checklist padrão provisório — a confirmar</Provisorio>. O dono ajusta os itens em Ajustes.
          </p>
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
  tipo,
  dados,
  progresso,
  avarias,
  pulados,
  onIr,
}: {
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

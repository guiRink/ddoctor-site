import { useId, useState, type ReactNode } from "react";
import type { ConfigOficina, CorCarro, MarcoISO } from "@compartilhado/tipos";
import { LIMITES_ALERTA, alertaCarroBase } from "@compartilhado/dominio/config";
import { aplicarAlertaOS, corDoCarro, entregaPorDiasUteis, type CorDoCarro, type EntradaAlertaOS } from "@compartilhado/dominio/corCarro";
import { dataNoFuso } from "@compartilhado/dominio/fuso";
import { mensagemErro, useAcoes } from "../../dados/hooks";
import type { OSVisao } from "../../dados/repositorio";
import { COR_CARRO, ERRO_CAMPO_CONFIG } from "../../dominio/rotulos";
import { Interruptor } from "../ajustes/Estrutura";
import { Passo } from "../ajustes/Numeros";
import { AcaoTexto, Marcador, MensagemErro } from "../ui/Campos";
import { Etiqueta } from "../ui/Estado";
import { Gaveta } from "../ui/Gaveta";
import { Placa } from "../ui/Placa";
import { diaCurto } from "../orcamentos/formato";
import { nomeCarro } from "./formato";
import { NOME_COR, prazoAtual } from "./prazo";

// Prazo e urgência do carro (pedido do dono, 2º áudio: docs/revisao-sh/pedido-dono-2.md): o selo com a cor do
// carro (verde, laranja, vermelho, vermelho piscando) e a gaveta "Ajustar prazo" — urgente, prazo em dias úteis
// e a partir de quando o carro fica laranja/vermelho, com a base da oficina e a prévia da cor ao vivo.
// Regra em @compartilhado/dominio/corCarro (corDoCarro, aplicarAlertaOS); aqui só a apresentação.

// Pílula grande: tint claro + texto da cor; o atrasado é vermelho cheio com o ponto piscando (a urgência do dono).
const SELO: Record<CorCarro, { pilula: string; ponto: string }> = {
  verde: { pilula: "bg-ok-claro text-ok", ponto: "bg-ok" },
  laranja: { pilula: "bg-atencao-claro text-atencao", ponto: "bg-atencao" },
  vermelho: { pilula: "bg-alerta-claro text-alerta", ponto: "bg-alerta" },
  vermelho_piscando: { pilula: "bg-alerta text-cartao", ponto: "bg-cartao animate-pulse" },
};

/** Selo da cor do carro com o motivo ("Entrega amanhã e nenhuma etapa concluída"). Texto sempre junto da cor. */
export function SeloCor({ cor, children, tamanho = "g" }: { cor: CorCarro; children: ReactNode; tamanho?: "g" | "p" }) {
  const s = SELO[cor];
  const g = tamanho === "g";
  return (
    <span
      title={`Cor do carro: ${NOME_COR[cor].toLowerCase()}`}
      className={`inline-flex items-center rounded-full font-semibold leading-tight numero ${s.pilula} ${
        g ? "gap-2 min-h-8 px-3 py-1 text-[13px]" : "gap-1.5 h-6 px-2.5 text-[12px] whitespace-nowrap"
      }`}
    >
      <span aria-hidden="true" className={`inline-block rounded-full shrink-0 ${g ? "w-2.5 h-2.5" : "w-2 h-2"} ${s.ponto}`} />
      <span className="sr-only">{NOME_COR[cor]}: </span>
      <span className="min-w-0">{children}</span>
    </span>
  );
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);
const inteiro = (t: string): number => (/^\d+$/.test(t.trim()) ? Number(t.trim()) : NaN);

// ------------------------------------------------------------------ gaveta "Ajustar prazo"

type Campo = "prazoDiasUteis" | "laranjaDiasAntes" | "vermelhoSemEtapaDiasAntes";

export function GavetaPrazo({
  v,
  config,
  agora,
  onFechar,
  onSalvo,
}: {
  v: OSVisao;
  config: ConfigOficina;
  agora: MarcoISO;
  onFechar: () => void;
  onSalvo: (mensagem: string) => void;
}) {
  const id = useId();
  const acoes = useAcoes();
  const base = alertaCarroBase(config);
  const a = v.os.alerta ?? {};
  const prazoInicial = prazoAtual(v, config, agora);
  const urgenteInicial = v.os.prioridade === 2;

  const [urgente, setUrgente] = useState(urgenteInicial);
  const [prazo, setPrazo] = useState(String(prazoInicial));
  const [laranjaPadrao, setLaranjaPadrao] = useState(a.laranjaDiasAntes === undefined);
  const [laranja, setLaranja] = useState(String(a.laranjaDiasAntes ?? base.laranjaDiasAntes));
  const [vermelhoPadrao, setVermelhoPadrao] = useState(a.vermelhoSemEtapaDiasAntes === undefined);
  const [vermelho, setVermelho] = useState(String(a.vermelhoSemEtapaDiasAntes ?? base.vermelhoSemEtapaDiasAntes));
  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({});
  const [erro, setErro] = useState<string>();
  const salvando = acoes.salvarAlertaOS.isPending;

  // só vai para o banco o que mudou; "usar o padrão" de um campo próprio vai como null (volta à base)
  function montar(): EntradaAlertaOS {
    const e: EntradaAlertaOS = {};
    if (urgente !== urgenteInicial) e.urgente = urgente;
    const p = inteiro(prazo);
    if (p !== prazoInicial) e.prazoDiasUteis = p;
    if (laranjaPadrao) {
      if (a.laranjaDiasAntes !== undefined) e.laranjaDiasAntes = null;
    } else if (inteiro(laranja) !== a.laranjaDiasAntes) e.laranjaDiasAntes = inteiro(laranja);
    if (vermelhoPadrao) {
      if (a.vermelhoSemEtapaDiasAntes !== undefined) e.vermelhoSemEtapaDiasAntes = null;
    } else if (inteiro(vermelho) !== a.vermelhoSemEtapaDiasAntes) e.vermelhoSemEtapaDiasAntes = inteiro(vermelho);
    return e;
  }

  const entrada = montar();
  const simulado = aplicarAlertaOS(v.os, entrada, agora, config);
  const campoInvalido = !simulado.ok && simulado.codigo === "valor_invalido" ? (simulado.campo as Campo | undefined) : undefined;
  const previa: CorDoCarro | null =
    simulado.ok || simulado.codigo === "nada_a_salvar" ? corDoCarro(simulado.ok ? { ...v.os, ...simulado.mudanca } : v.os, v.etapas, agora, config) : null;
  const entrega = simulado.ok ? simulado.mudanca.previsaoEntrega : v.os.previsaoEntrega;
  const p = inteiro(prazo);
  const entregaDoPrazo = Number.isInteger(p) && p >= 0 && p <= LIMITES_ALERTA.prazoDiasUteis.max ? entregaPorDiasUteis(v.os.entradaRealEm ?? agora, p, config) : undefined;
  const entradaTexto = v.os.entradaRealEm ? diaCurto(dataNoFuso(v.os.entradaRealEm)) : "hoje";

  function limpar(campo?: Campo) {
    setErro(undefined);
    if (campo) setErros((e) => ({ ...e, [campo]: undefined }));
  }

  async function salvar() {
    setErro(undefined);
    if (!simulado.ok) {
      if (simulado.codigo === "valor_invalido" && simulado.campo) {
        const campo = simulado.campo as Campo;
        setErros({ [campo]: ERRO_CAMPO_CONFIG[campo] ?? mensagemErro(simulado.codigo) });
        document.getElementById(`${id}-${campo}`)?.focus();
      } else setErro(mensagemErro(simulado.codigo));
      return;
    }
    try {
      const r = await acoes.salvarAlertaOS.mutateAsync([v.os.id, entrada]);
      if (!r.ok) {
        const campo = r.campo as Campo | undefined;
        if (campo && ["prazoDiasUteis", "laranjaDiasAntes", "vermelhoSemEtapaDiasAntes"].includes(campo))
          setErros({ [campo]: ERRO_CAMPO_CONFIG[campo] ?? mensagemErro(r.codigo) });
        else setErro(mensagemErro(r.codigo));
        return;
      }
      onSalvo(
        simulado.mudanca.previsaoEntrega && entrada.prazoDiasUteis !== undefined
          ? `Prazo salvo: entrega ${diaCurto(simulado.mudanca.previsaoEntrega)}.`
          : "Prazo e urgência salvos.",
      );
    } catch {
      setErro(mensagemErro());
    }
  }

  const mudou = simulado.ok;

  return (
    <Gaveta
      titulo="Prazo e urgência"
      descricao={
        <span className="block truncate">
          {nomeCarro(v.veiculo) || "Modelo não informado"} · OS <span className="numero">{v.os.numero}</span>
        </span>
      }
      antesDoTitulo={<Placa placa={v.veiculo.placa} tamanho="m" />}
      onFechar={onFechar}
      onEnviar={salvar}
      acao="Salvar prazo"
      enviando={salvando}
      erro={erro}
    >
      {/* prévia ao vivo: a cor que o carro terá com estes valores */}
      <section aria-live="polite" aria-label="Prévia da cor do carro" className="rounded-cartao border border-linha bg-cinza-50 px-4 py-3">
        <p className="text-[13px] font-medium text-tinta-suave">{mudou ? "Com estes valores, hoje o carro fica" : "Hoje o carro está"}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {previa ? <SeloCor cor={previa.cor}>{previa.motivo}</SeloCor> : <span className="text-[13px] text-tinta-suave">Corrija o número para ver a prévia.</span>}
        </div>
        {entrega && <p className="mt-2 text-[13px] text-tinta-suave numero">Entrega prometida {diaCurto(entrega)}</p>}
      </section>

      <LinhaAjuste
        titulo="Urgente"
        explicacao="Aparece como Urgente no quadro da produção e na TV."
        controle={<Interruptor ligado={urgente} onMudar={(b) => {
              limpar();
              setUrgente(b);
            }} rotulo="Urgente" desabilitado={salvando} />}
      />

      <LinhaAjuste
        id={`${id}-prazoDiasUteis`}
        titulo="Prazo em dias úteis"
        explicacao={
          <>
            Contados da entrada ({entradaTexto}).{" "}
            {entregaDoPrazo && <span className="font-medium text-tinta">Entrega em {diaCurto(entregaDoPrazo)}.</span>}
          </>
        }
        rodape={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-tinta-suave">
            <span className="numero">
              Padrão da oficina: {base.prazoPadraoDiasUteis} {plural(base.prazoPadraoDiasUteis, "dia útil", "dias úteis")}
            </span>
            {inteiro(prazo) !== base.prazoPadraoDiasUteis && (
              <AcaoTexto onClick={() => {
                  limpar("prazoDiasUteis");
                  setPrazo(String(base.prazoPadraoDiasUteis));
                }} rotulo={`Usar o prazo padrão: ${base.prazoPadraoDiasUteis} dias úteis`} desabilitado={salvando}>
                Usar o padrão
              </AcaoTexto>
            )}
          </span>
        }
        erro={erros.prazoDiasUteis ?? (campoInvalido === "prazoDiasUteis" ? ERRO_CAMPO_CONFIG.prazoDiasUteis : undefined)}
        controle={
          <Numero
            id={`${id}-prazoDiasUteis`}
            rotulo="Prazo em dias úteis"
            texto={prazo}
            limites={LIMITES_ALERTA.prazoDiasUteis}
            unidade={plural(inteiro(prazo), "dia útil", "dias úteis")}
            invalido={Boolean(erros.prazoDiasUteis) || campoInvalido === "prazoDiasUteis"}
            desabilitado={salvando}
            onMudar={(t) => {
              limpar("prazoDiasUteis");
              setPrazo(t);
            }}
          />
        }
      />

      <LimiteCor
        id={`${id}-laranjaDiasAntes`}
        cor="laranja"
        titulo="Fica laranja a partir de"
        explicacao="Com alguma etapa concluída. 1 = hoje e o próximo dia útil; 0 = só no dia da entrega."
        texto={laranja}
        padrao={laranjaPadrao}
        valorBase={base.laranjaDiasAntes}
        erro={erros.laranjaDiasAntes ?? (campoInvalido === "laranjaDiasAntes" ? ERRO_CAMPO_CONFIG.laranjaDiasAntes : undefined)}
        desabilitado={salvando}
        onMudar={(t) => {
          limpar("laranjaDiasAntes");
          setLaranja(t);
        }}
        onPadrao={(b) => {
          limpar("laranjaDiasAntes");
          setLaranjaPadrao(b);
          if (b) setLaranja(String(base.laranjaDiasAntes));
        }}
      />

      <LimiteCor
        id={`${id}-vermelhoSemEtapaDiasAntes`}
        cor="vermelho"
        titulo="Fica vermelho (se nenhuma etapa concluída) a partir de"
        explicacao="Passou da entrega, fica vermelho de qualquer jeito."
        texto={vermelho}
        padrao={vermelhoPadrao}
        valorBase={base.vermelhoSemEtapaDiasAntes}
        erro={erros.vermelhoSemEtapaDiasAntes ?? (campoInvalido === "vermelhoSemEtapaDiasAntes" ? ERRO_CAMPO_CONFIG.vermelhoSemEtapaDiasAntes : undefined)}
        desabilitado={salvando}
        onMudar={(t) => {
          limpar("vermelhoSemEtapaDiasAntes");
          setVermelho(t);
        }}
        onPadrao={(b) => {
          limpar("vermelhoSemEtapaDiasAntes");
          setVermelhoPadrao(b);
          if (b) setVermelho(String(base.vermelhoSemEtapaDiasAntes));
        }}
      />
    </Gaveta>
  );
}

/** Linha da gaveta: título 14/500 + explicação 13 à esquerda, controle à direita (empilha no celular). */
function LinhaAjuste({
  id,
  titulo,
  explicacao,
  controle,
  rodape,
  erro,
}: {
  id?: string;
  titulo: ReactNode;
  explicacao?: ReactNode;
  controle: ReactNode;
  rodape?: ReactNode;
  erro?: string;
}) {
  return (
    <div className="pt-4 first:pt-0 border-t border-linha first:border-t-0">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2.5">
        <div className="min-w-0 flex-1 basis-56">
          {id ? (
            <label htmlFor={id} className="text-[14px] font-medium text-tinta">
              {titulo}
            </label>
          ) : (
            <p className="text-[14px] font-medium text-tinta">{titulo}</p>
          )}
          {explicacao && <p id={id ? `${id}-dica` : undefined} className="mt-0.5 text-[13px] text-tinta-suave leading-snug">{explicacao}</p>}
        </div>
        <div className="shrink-0">{controle}</div>
      </div>
      {rodape && <div className="mt-2">{rodape}</div>}
      {erro && id && <MensagemErro id={`${id}-erro`}>{erro}</MensagemErro>}
    </div>
  );
}

function Numero({
  id,
  rotulo,
  texto,
  limites,
  unidade,
  invalido,
  desabilitado,
  onMudar,
}: {
  id: string;
  rotulo: string;
  texto: string;
  limites: { min: number; max: number };
  unidade: string;
  invalido: boolean;
  desabilitado: boolean;
  onMudar: (t: string) => void;
}) {
  return (
    <span className="flex items-center gap-2.5">
      <Passo id={id} rotulo={rotulo} texto={texto} limites={limites} passo={1} invalido={invalido} descricao={invalido ? `${id}-erro` : `${id}-dica`} desabilitado={desabilitado} onMudar={onMudar} />
      <span className="text-[13px] text-tinta-suave min-w-16">{unidade}</span>
    </span>
  );
}

function LimiteCor({
  id,
  cor,
  titulo,
  explicacao,
  texto,
  padrao,
  valorBase,
  erro,
  desabilitado,
  onMudar,
  onPadrao,
}: {
  id: string;
  cor: "laranja" | "vermelho";
  titulo: string;
  explicacao: string;
  texto: string;
  padrao: boolean;
  valorBase: number;
  erro?: string;
  desabilitado: boolean;
  onMudar: (t: string) => void;
  onPadrao: (usar: boolean) => void;
}) {
  const n = inteiro(texto);
  return (
    <LinhaAjuste
      id={id}
      titulo={
        <span className="inline-flex flex-wrap items-center gap-2">
          {titulo}
          <Etiqueta tom={COR_CARRO[cor].tom}>{NOME_COR[cor]}</Etiqueta>
        </span>
      }
      explicacao={explicacao}
      erro={erro}
      controle={
        <Numero
          id={id}
          rotulo={titulo}
          texto={texto}
          limites={LIMITES_ALERTA[cor === "laranja" ? "laranjaDiasAntes" : "vermelhoSemEtapaDiasAntes"]}
          unidade={`${plural(n, "dia útil", "dias úteis")} antes`}
          invalido={Boolean(erro)}
          desabilitado={desabilitado || padrao}
          onMudar={onMudar}
        />
      }
      rodape={
        <Marcador
          id={`${id}-padrao`}
          rotulo={`Usar o padrão da oficina (${valorBase} ${plural(valorBase, "dia útil", "dias úteis")} antes)`}
          marcado={padrao}
          onMudar={onPadrao}
        />
      }
    />
  );
}

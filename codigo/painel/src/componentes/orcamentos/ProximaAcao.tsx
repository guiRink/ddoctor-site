import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import type { TipoReparo } from "@compartilhado/tipos";
import { formatarReais } from "@compartilhado/dominio/dinheiro";
import { etapaAtual } from "@compartilhado/dominio/semaforo";
import { mensagemErro, useAcoes } from "../../dados/hooks";
import type { OSVisao } from "../../dados/repositorio";
import { JANELA } from "../../dominio/rotulos";
import { Botao, BotaoLink, SUPERFICIE } from "../ui/Basicos";
import { Icone } from "../Icone";
import { ReceberCarro } from "../recepcao/ReceberCarro";
import { acaoPrimariaDoTopo, faltasParaEntregar, textoEtapas, type ClienteDeve } from "../os/ficha";
import { diaCurto } from "./formato";

/**
 * Próxima ação da OS conforme o estado (arq. §7.2). O botão primário é a única ação em amarelo da ficha
 * (acaoPrimariaDoTopo). Aprovação e entrega abrem aqui mesmo, ao lado do botão; a entrada abre o fluxo
 * "Receber o carro" (painel lateral com dados, checklist e avarias).
 * Entrega: se o cliente ainda deve (franquia, complemento, particular) ou não há foto de saída, avisa o que
 * falta e deixa seguir ("Entregar mesmo assim"); travar é decisão do dono.
 * `deve` só chega para quem vê dinheiro (veDadosSensiveis); sem ele, nada de valores aqui.
 */
type Painel = null | "aprovacao" | "entrada" | "entrega";

export function ProximaAcao({ v, podeAgir, tipos, deve = null }: { v: OSVisao; podeAgir: boolean; tipos: TipoReparo[]; deve?: ClienteDeve | null }) {
  const acoes = useAcoes();
  const [params, setParams] = useSearchParams();
  const [painel, setPainel] = useState<Painel>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [evidencia, setEvidencia] = useState("");
  const idBase = useId();
  const { os } = v;

  const abrir = (p: Painel) => {
    setPainel(p);
    setErro("");
    setAviso("");
  };

  async function executar(fn: () => Promise<{ ok: boolean; codigo?: string }>, sucesso: string) {
    setErro("");
    try {
      const r = await fn();
      if (!r.ok) {
        setErro(mensagemErro(r.codigo));
        return;
      }
      setPainel(null);
      setEvidencia("");
      setAviso(sucesso);
    } catch {
      setErro(mensagemErro());
    }
  }

  const ocupado = acoes.registrarAprovacao.isPending || acoes.registrarEntrega.isPending;

  // ---------------------------------------------------------------- texto e botões por estado
  let texto: ReactNode = null;
  let botoes: ReactNode = null;
  const atual = etapaAtual(v.etapas);
  const falta = deve?.falta ?? 0;
  const primaria = acaoPrimariaDoTopo(os.estado, falta);
  const naAbaPagamentos = params.get("aba") === "pagamentos";
  const irParaPagamento = () => {
    const p = new URLSearchParams(params);
    p.set("aba", "pagamentos");
    p.set("pagar", "1");
    setParams(p, { replace: true });
    setPainel(null);
  };
  // no Pagamentos o formulário já é a ação: o botão daqui sairia repetido (e seria um segundo amarelo)
  const botaoPagamento = !naAbaPagamentos && (
    <Botao variante="primario" icone="recebiveis" onClick={irParaPagamento}>
      Registrar pagamento
    </Botao>
  );
  const abertas = v.pendencias.filter((p) => p.estado === "aberta" || p.estado === "em_andamento").length;

  switch (os.estado) {
    case "rascunho":
      texto = "Orçamento em montagem. Complete as peças e envie para aprovação.";
      break;
    case "aguardando_aprovacao":
      texto =
        os.origem === "particular"
          ? "Quando o cliente aprovar, registre aqui como ele confirmou."
          : "Quando a autorização aparecer no portal, registre aqui com a evidência.";
      botoes = (
        <Botao variante="primario" icone="ok" onClick={() => abrir("aprovacao")} aria-expanded={painel === "aprovacao"}>
          Registrar aprovação
        </Botao>
      );
      break;
    case "aguardando_agendamento":
      texto =
        v.agendamento?.estado === "proposto"
          ? `Horário proposto para ${diaCurto(v.agendamento.data)} · ${JANELA[v.agendamento.janela].toLowerCase()}, esperando o cliente.`
          : "Aprovado. Falta marcar o dia da entrada.";
      botoes = (
        <>
          <BotaoLink para={`/agenda?os=${os.id}`} variante="primario" icone="agenda">
            Agendar
          </BotaoLink>
          <Botao variante="contorno" icone="carro" onClick={() => abrir("entrada")} aria-haspopup="dialog">
            Receber o carro
          </Botao>
        </>
      );
      break;
    case "agendada":
      texto = v.agendamento
        ? `Entrada marcada para ${diaCurto(v.agendamento.data)} · ${JANELA[v.agendamento.janela].toLowerCase()}.`
        : "Entrada agendada.";
      botoes = (
        <>
          <Botao variante="primario" icone="carro" onClick={() => abrir("entrada")} aria-haspopup="dialog">
            Receber o carro
          </Botao>
          <BotaoLink para={`/agenda?os=${os.id}`} variante="contorno" icone="agenda">
            Ver na agenda
          </BotaoLink>
        </>
      );
      break;
    case "na_oficina":
      texto = atual
        ? `${atual.estado === "bloqueada" ? "Impedido em" : atual.estado === "na_fila" ? "Na fila de" : "Em"} ${atual.nome} · ${textoEtapas(v.etapas).replace(/^Etapa/, "etapa")}.`
        : "Em produção.";
      botoes = (
        <BotaoLink para="/producao" variante="contorno" icone="producao">
          Ver na produção
        </BotaoLink>
      );
      break;
    case "pronta":
      texto =
        primaria === "pagamento"
          ? `Pronto. Receba ${formatarReais(falta)} do cliente antes de entregar.`
          : "Pronto. Registre a entrega quando o cliente retirar o carro.";
      botoes = (
        <>
          {primaria === "pagamento" && botaoPagamento}
          <Botao
            variante={primaria === "entrega" ? "primario" : "contorno"}
            icone="ok"
            onClick={() => abrir("entrega")}
            aria-expanded={painel === "entrega"}
          >
            Registrar entrega
          </Botao>
        </>
      );
      break;
    case "entregue":
      if (primaria === "pagamento") {
        texto = `Entregue. Falta receber ${formatarReais(falta)} do cliente.`;
        botoes = botaoPagamento || null;
      } else {
        texto = abertas > 0 ? `Entregue. Falta ${abertas === 1 ? "1 ação" : `${abertas} ações`} no portal (veja Pendências).` : "Entregue. Aguardando o recebimento para fechar.";
      }
      break;
    case "encerrada":
      texto = "Fechado: serviço entregue e recebido.";
      break;
    case "cancelada":
      texto = "OS cancelada.";
      break;
  }

  // ---------------------------------------------------------------- formulários
  function enviarAprovacao(e: FormEvent) {
    e.preventDefault();
    if (!evidencia.trim()) {
      setErro("Escreva como a aprovação foi confirmada.");
      return;
    }
    executar(() => acoes.registrarAprovacao.mutateAsync([os.id, evidencia.trim()]), "Aprovação registrada. O carro entrou na fila de agendamento.");
  }
  function enviarEntrega(e: FormEvent) {
    e.preventDefault();
    executar(() => acoes.registrarEntrega.mutateAsync([os.id]), "Entrega registrada.");
  }

  const idErro = `${idBase}-erro`;
  const faltas = painel === "entrega" ? faltasParaEntregar(v, deve) : [];

  return (
    <section aria-label="Próxima ação" className={`${SUPERFICIE} p-4 min-w-0`}>
      <p className="text-[13px] font-medium text-tinta-suave">Próxima ação</p>
      <p className="mt-1.5 text-[14px] leading-snug">{texto}</p>
      {podeAgir && botoes && (painel === null || painel === "entrada") && <div className="mt-3 flex flex-wrap gap-2">{botoes}</div>}
      {!podeAgir && botoes && <p className="mt-2 text-[13px] text-tinta-fraca">Seu papel só consulta esta ficha.</p>}

      {painel === "aprovacao" && (
        <form onSubmit={enviarAprovacao} className="mt-3 flex flex-col gap-3" noValidate>
          <div>
            <label htmlFor={`${idBase}-ev`} className="block text-[13px] font-medium text-tinta-suave mb-1.5">
              Como a aprovação foi confirmada?
            </label>
            <textarea
              id={`${idBase}-ev`}
              value={evidencia}
              onChange={(e) => setEvidencia(e.target.value)}
              rows={2}
              autoFocus
              aria-invalid={Boolean(erro)}
              aria-describedby={erro ? idErro : undefined}
              placeholder={os.origem === "particular" ? "Ex.: Cliente aprovou pelo WhatsApp às 14h" : "Ex.: Vi a autorização no portal às 14h"}
              className="w-full px-3 py-2 bg-cartao border border-linha-forte focus:border-tinta-fraca focus:ring-[3px] focus:ring-amarelo/30 outline-none placeholder:text-tinta-fraca"
            />
          </div>
          <Rodape erro={erro} idErro={idErro} ocupado={ocupado} confirmar="Confirmar aprovação" onCancelar={() => abrir(null)} />
        </form>
      )}

      {painel === "entrada" && (
        <ReceberCarro
          v={v}
          tipos={tipos}
          onFechar={() => setPainel(null)}
          onConcluido={(msg) => {
            setPainel(null);
            setAviso(msg);
          }}
        />
      )}

      {painel === "entrega" && (
        <form onSubmit={enviarEntrega} className="mt-3 flex flex-col gap-3" noValidate>
          {faltas.length > 0 ? (
            <div role="alert" className="px-3 py-2.5 rounded-controle border border-atencao/25 bg-atencao-claro text-atencao">
              <p className="flex items-center gap-2 text-[13px] font-semibold">
                <Icone nome="alerta" tamanho={16} className="shrink-0" />
                Antes de entregar, falta:
              </p>
              <ul className="mt-1 pl-6 list-disc text-[14px] font-medium">
                {faltas.map((f) => (
                  <li key={f.tipo}>{f.texto}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[13px]">Confirme que o cliente retirou o carro.</p>
          )}
          {faltas.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {faltas.map((f, i) =>
                f.tipo === "pagamento" ? (
                  <Botao key={f.tipo} variante={i === 0 ? "primario" : "contorno"} icone="recebiveis" onClick={irParaPagamento} disabled={ocupado}>
                    Registrar pagamento
                  </Botao>
                ) : (
                  <BotaoLink key={f.tipo} para={`/vistorias?os=${os.id}`} variante={i === 0 ? "primario" : "contorno"} icone="camera">
                    Adicionar foto
                  </BotaoLink>
                ),
              )}
            </div>
          )}
          <Rodape
            erro={erro}
            idErro={idErro}
            ocupado={ocupado}
            confirmar={faltas.length > 0 ? "Entregar mesmo assim" : "Confirmar entrega"}
            primario={faltas.length === 0}
            onCancelar={() => abrir(null)}
          />
        </form>
      )}

      {aviso && (
        <p role="status" className="mt-3 flex items-start gap-2 text-[13px] font-medium text-ok">
          <Icone nome="ok" tamanho={16} className="mt-0.5 shrink-0" />
          {aviso}
        </p>
      )}
    </section>
  );
}

function Rodape({
  erro,
  idErro,
  ocupado,
  confirmar,
  primario = true,
  onCancelar,
}: {
  erro: string;
  idErro: string;
  ocupado: boolean;
  confirmar: string;
  primario?: boolean;
  onCancelar: () => void;
}) {
  return (
    <>
      {erro && (
        <p id={idErro} role="alert" className="text-[13px] font-medium text-alerta">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" variante={primario ? "primario" : "contorno"} disabled={ocupado}>
          {ocupado ? "Salvando…" : confirmar}
        </Botao>
        <Botao variante="fantasma" onClick={onCancelar} disabled={ocupado}>
          Cancelar
        </Botao>
      </div>
    </>
  );
}

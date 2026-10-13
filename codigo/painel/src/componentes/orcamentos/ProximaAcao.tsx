import { useId, useState, type FormEvent, type ReactNode } from "react";
import type { TipoReparo } from "@compartilhado/tipos";
import { etapaAtual, progressoEtapas } from "@compartilhado/dominio/semaforo";
import { mensagemErro, useAcoes } from "../../dados/hooks";
import type { OSVisao } from "../../dados/repositorio";
import { JANELA } from "../../dominio/rotulos";
import { Botao, BotaoLink } from "../ui/Basicos";
import { Provisorio } from "../ui/Estado";
import { Icone } from "../Icone";
import { diaCurto } from "./formato";

/**
 * Próxima ação da OS conforme o estado (arq. §7.2). O botão primário é a única ação em amarelo da ficha.
 * Os formulários abrem aqui mesmo, ao lado do botão, para a ação e o resultado ficarem juntos.
 */
type Painel = null | "aprovacao" | "entrada" | "entrega";

export function ProximaAcao({ v, podeAgir, tipos }: { v: OSVisao; podeAgir: boolean; tipos: TipoReparo[] }) {
  const acoes = useAcoes();
  const [painel, setPainel] = useState<Painel>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [evidencia, setEvidencia] = useState("");
  const [tipoId, setTipoId] = useState(v.os.tipoReparoId ?? "");
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

  const ocupado = acoes.registrarAprovacao.isPending || acoes.registrarEntrada.isPending || acoes.registrarEntrega.isPending;

  // ---------------------------------------------------------------- texto e botões por estado
  let texto: ReactNode = null;
  let botoes: ReactNode = null;
  const atual = etapaAtual(v.etapas);
  const prog = progressoEtapas(v.etapas);
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
          <Botao variante="contorno" icone="carro" onClick={() => abrir("entrada")} aria-expanded={painel === "entrada"}>
            Registrar entrada
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
          <Botao variante="primario" icone="carro" onClick={() => abrir("entrada")} aria-expanded={painel === "entrada"}>
            Registrar entrada
          </Botao>
          <BotaoLink para={`/agenda?os=${os.id}`} variante="contorno" icone="agenda">
            Ver na agenda
          </BotaoLink>
        </>
      );
      break;
    case "na_oficina":
      texto = atual
        ? `${atual.estado === "bloqueada" ? "Impedido em" : atual.estado === "na_fila" ? "Na fila de" : "Em"} ${atual.nome} (${prog.concluidas} de ${prog.total} etapas feitas)${os.previsaoEntrega ? ` · entrega prevista ${diaCurto(os.previsaoEntrega)}` : ""}.`
        : "Em produção.";
      botoes = (
        <BotaoLink para="/producao" variante="primario" icone="producao">
          Ver na produção
        </BotaoLink>
      );
      break;
    case "pronta":
      texto = "Pronto. Registre a entrega quando o cliente retirar o carro.";
      botoes = (
        <Botao variante="primario" icone="ok" onClick={() => abrir("entrega")} aria-expanded={painel === "entrega"}>
          Registrar entrega
        </Botao>
      );
      break;
    case "entregue":
      texto = abertas > 0 ? `Entregue. Falta ${abertas === 1 ? "1 ação" : `${abertas} ações`} no portal (veja Pendências).` : "Entregue. Aguardando o recebimento para encerrar.";
      break;
    case "encerrada":
      texto = "OS encerrada: serviço entregue e recebido.";
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
  function enviarEntrada(e: FormEvent) {
    e.preventDefault();
    if (!tipoId) {
      setErro(mensagemErro("sem_tipo_reparo"));
      return;
    }
    executar(() => acoes.registrarEntrada.mutateAsync([os.id, tipoId]), "Entrada registrada. As etapas já estão na Produção.");
  }
  function enviarEntrega(e: FormEvent) {
    e.preventDefault();
    executar(() => acoes.registrarEntrega.mutateAsync([os.id]), "Entrega registrada.");
  }

  const idErro = `${idBase}-erro`;

  return (
    <section aria-label="Próxima ação" className="bg-cartao border border-linha p-4 min-w-0">
      <p className="rotulo text-tinta-suave">Próxima ação</p>
      <p className="mt-1.5 text-[14px] leading-snug">{texto}</p>
      {podeAgir && botoes && painel === null && <div className="mt-3 flex flex-wrap gap-2">{botoes}</div>}
      {!podeAgir && botoes && <p className="mt-2 text-[13px] text-tinta-fraca">Seu papel só consulta esta ficha.</p>}

      {painel === "aprovacao" && (
        <form onSubmit={enviarAprovacao} className="mt-3 flex flex-col gap-3" noValidate>
          <div>
            <label htmlFor={`${idBase}-ev`} className="block text-[13px] font-bold mb-1.5">
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
              className="w-full px-3 py-2 bg-cartao border border-linha-forte focus:border-preto outline-none placeholder:text-tinta-fraca"
            />
          </div>
          <Rodape erro={erro} idErro={idErro} ocupado={ocupado} confirmar="Confirmar aprovação" onCancelar={() => abrir(null)} />
        </form>
      )}

      {painel === "entrada" && (
        <form onSubmit={enviarEntrada} className="mt-3 flex flex-col gap-3" noValidate>
          <fieldset aria-describedby={erro ? idErro : undefined}>
            <legend className="text-[13px] font-bold mb-1.5">Tipo de reparo (gera as etapas)</legend>
            <div className="flex flex-col border border-linha">
              {tipos.map((t) => (
                <label
                  key={t.id}
                  className={`flex items-start gap-3 px-3 py-2.5 min-h-11 border-b border-linha last:border-b-0 cursor-pointer ${
                    tipoId === t.id ? "bg-amarelo-claro" : "hover:bg-papel"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${idBase}-tipo`}
                    value={t.id}
                    checked={tipoId === t.id}
                    onChange={() => setTipoId(t.id)}
                    className="mt-1 accent-preto w-4 h-4"
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {t.nome}
                      {t.provisorio && (
                        <span className="ml-2 text-[12px] font-normal text-tinta-suave">
                          <Provisorio>modelo provisório</Provisorio>
                        </span>
                      )}
                    </span>
                    <span className="block text-[12px] text-tinta-suave">{t.etapas.map((e) => e.nome).join(" → ")}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="text-[12px] text-tinta-suave">Depois, tire as fotos de entrada em Vistorias.</p>
          <Rodape erro={erro} idErro={idErro} ocupado={ocupado} confirmar="Confirmar entrada" onCancelar={() => abrir(null)} />
        </form>
      )}

      {painel === "entrega" && (
        <form onSubmit={enviarEntrega} className="mt-3 flex flex-col gap-3" noValidate>
          <p className="text-[13px]">
            Confirme que o cliente retirou o carro.
            {v.atendimentos.length > 0 && " Uma pendência “Encerrar no portal” será criada para a recepção."}
          </p>
          <Rodape erro={erro} idErro={idErro} ocupado={ocupado} confirmar="Confirmar entrega" onCancelar={() => abrir(null)} />
        </form>
      )}

      {aviso && (
        <p role="status" className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-ok">
          <Icone nome="ok" tamanho={16} />
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
  onCancelar,
}: {
  erro: string;
  idErro: string;
  ocupado: boolean;
  confirmar: string;
  onCancelar: () => void;
}) {
  return (
    <>
      {erro && (
        <p id={idErro} role="alert" className="text-[13px] font-semibold text-alerta">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" variante="primario" disabled={ocupado}>
          {ocupado ? "Salvando…" : confirmar}
        </Botao>
        <Botao variante="fantasma" onClick={onCancelar} disabled={ocupado}>
          Cancelar
        </Botao>
      </div>
    </>
  );
}

import type { MarcoISO, Perfil } from "@compartilhado/tipos";
import type { SituacaoCartao } from "@compartilhado/dominio/semaforo";
import { formatarDuracao } from "@compartilhado/dominio/tempos";
import { progressoEtapas } from "@compartilhado/dominio/semaforo";
import { ProgressoEtapas, nomePerfil } from "../ui/Carro";
import { iniciais } from "../ui/Basicos";
import { Placa } from "../ui/Placa";
import { Icone } from "../Icone";
import { SITUACAO, formatarDataCurta, type DensidadeTV, type ItemQuadro } from "./quadro";

const FUNDO: Record<SituacaoCartao, string> = {
  impedido: "bg-alerta",
  atrasado: "bg-alerta",
  atencao: "bg-atencao",
  no_prazo: "bg-ok",
  pronto: "bg-grafite-3",
};

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Cartão da TV (1920×1080, lido a 3–4 m) — docs/painel-design.md §5.1. Cabeçalho pintado na cor do
 * semáforo, placa grande, responsável e tempos em 24 px+. Três densidades: a coluna escolhe a maior
 * que cabe (`cheio` → `medio` → `compacto`) antes de paginar. Nunca mostra cliente, telefone, valores
 * ou seguradora.
 */
export function CartaoTV({
  item,
  perfis,
  densidade = "cheio",
  estreito = false,
}: {
  item: ItemQuadro;
  /** Mantido por compatibilidade: os horários já vêm legíveis no item. */
  agora?: MarcoISO;
  perfis: Perfil[];
  densidade?: DensidadeTV;
  /** Coluna mais estreita que a placa `tv` (6–7 colunas): placa `g` (compacto: `m`) e só o primeiro nome. */
  estreito?: boolean;
}) {
  const { v, resumo: r } = item;
  const etapa = r.atual;
  // atrasado: o cabeçalho já diz quanto ("Atrasado 1 dia", "Atrasado 3 h"), bem visível de longe
  const atraso = item.entregaVencida ? item.entrega : item.etapaVencida ? item.prazoEtapa : undefined;
  const cab = { fundo: FUNDO[item.situacao], texto: item.atrasado && atraso ? maiuscula(atraso) : SITUACAO[item.situacao].texto };
  const bloqueio = item.impedido ? etapa?.bloqueios.find((b) => !b.fimEm) : undefined;
  const nome = nomePerfil(perfis, etapa?.responsavelId);
  const { total, atualIndex } = progressoEtapas(v.etapas);
  const tempo = item.pronto
    ? undefined
    : etapa?.estado === "na_fila"
      ? { nome: "Fila", valor: formatarDuracao(r.fila) }
      : etapa?.iniciadaEm
        ? { nome: "Execução", valor: formatarDuracao(r.execucao) }
        : undefined;
  const entrega = item.entrega ?? "—";
  // entrega vencida: o cabeçalho já grita "Atrasado 1 dia"; a célula mostra a data prometida numa pílula vermelha
  const entregaCelula = item.entregaVencida && v.os.previsaoEntrega ? formatarDataCurta(v.os.previsaoEntrega.slice(0, 10)) : entrega;
  const urgente = v.os.prioridade === 2;
  const compacto = densidade === "compacto";
  // coluna estreita: "Urgente" vai para o cabeçalho (no corpo ele cortaria o modelo)
  const urgenteNoCabecalho = urgente && estreito && !compacto;
  const nomeCurto = nome && (densidade !== "cheio" || estreito) ? nome.split(" ")[0] : nome;
  // lado direito do cabeçalho: no compacto vira o tempo (o corpo não tem espaço para ele);
  // no médio, a entrega prometida (o corpo já mostra o tempo, e "Atenção" quase sempre é por causa dela)
  const entregaCabecalho = item.entregaVencida ? undefined : `Entrega ${entrega}`;
  const estado = densidade === "medio" && !item.pronto && etapa?.estado !== "bloqueada" && entregaCabecalho && item.entrega
    ? entregaCabecalho
    : item.pronto
    ? compacto
      ? item.entregaVencida
        ? maiuscula(entrega)
        : `Entrega ${entrega}`
      : "Para entrega"
    : etapa?.estado === "bloqueada"
      ? `Parado ${formatarDuracao(r.bloqueio)}`
      : etapa?.estado === "na_fila"
        ? compacto
          ? `Fila ${formatarDuracao(r.fila)}`
          : "Na fila"
        : etapa?.iniciadaEm
          ? compacto
            ? formatarDuracao(r.execucao)
            : estreito
              ? "Execução"
              : "Em execução"
          : "Aguardando";

  const cabecalho = (
    <header className={`${cab.fundo} text-cartao flex items-center justify-between gap-2 shrink-0 ${compacto ? "h-9" : "h-11"} ${estreito ? "px-4" : "px-5"}`}>
      <span className={`flex items-center gap-2 font-semibold leading-none whitespace-nowrap ${compacto || estreito ? "text-[20px]" : "text-[24px]"}`}>
        {item.pronto && <Icone nome="ok" tamanho={compacto ? 20 : 24} traco={2} />}
        {item.impedido && <Icone nome="bloqueio" tamanho={compacto ? 20 : 24} traco={2} />}
        {cab.texto}
      </span>
      {urgenteNoCabecalho ? (
        <span className="shrink-0 rounded-full bg-amarelo text-preto px-2.5 text-[18px] font-semibold leading-7">Urgente</span>
      ) : (
        <span className={`font-medium leading-none whitespace-nowrap numero truncate ${compacto || estreito ? "text-[18px]" : "text-[20px]"}`}>{estado}</span>
      )}
    </header>
  );

  if (compacto) {
    const linha = item.pronto ? (v.veiculo.cor ?? "") : (nomeCurto ?? "Sem responsável");
    return (
      <article className="bg-grafite-2 rounded-cartao flex flex-col min-h-0 overflow-hidden">
        {cabecalho}
        {estreito ? (
          // coluna estreita: placa m em cima, carro e quem embaixo
          <div className="flex-1 min-h-0 flex flex-col justify-center gap-1 px-4 py-2">
            <div className="flex items-center justify-between gap-2">
              <Placa placa={v.veiculo.placa} tamanho="m" />
              {urgente && <span className="shrink-0 rounded-full bg-amarelo text-preto px-2.5 text-[16px] font-semibold leading-7">Urgente</span>}
            </div>
            <p className="text-[20px] leading-tight truncate numero">
              <span className="font-semibold">{v.veiculo.modelo ?? "Modelo não informado"}</span>
              {linha && <span className="text-papel-suave"> · {linha}</span>}
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex items-center gap-4 px-5 py-2.5">
            <Placa placa={v.veiculo.placa} tamanho="g" />
            <div className="min-w-0 flex-1">
              <p className="text-[24px] font-semibold leading-tight truncate">{v.veiculo.modelo ?? "Modelo não informado"}</p>
              <p className="text-[18px] text-papel-suave leading-tight truncate numero">{linha}</p>
            </div>
            {urgente && <span className="shrink-0 rounded-full bg-amarelo text-preto px-3 text-[18px] font-semibold leading-8">Urgente</span>}
          </div>
        )}
      </article>
    );
  }

  const placa = <Placa placa={v.veiculo.placa} tamanho={estreito ? "g" : "tv"} />;
  const comAvatar = !(estreito && densidade === "medio");
  const responsavel = !item.pronto && (
    <div className="flex items-center gap-3 min-w-0">
      {nome ? (
        <>
          <span aria-hidden="true" className={`${comAvatar ? "inline-grid" : "hidden"} place-items-center w-11 h-11 shrink-0 rounded-full bg-grafite-3 text-papel text-[18px] font-semibold`}>
            {iniciais(nome)}
          </span>
          <span className="text-[24px] font-medium truncate">{nomeCurto}</span>
        </>
      ) : (
        <span className="text-[24px] text-papel-fraco leading-[44px] truncate">Sem responsável</span>
      )}
    </div>
  );

  if (densidade === "medio") {
    return (
      <article className="bg-grafite-2 rounded-cartao flex flex-col min-h-0 overflow-hidden">
        {cabecalho}
        <div className="flex-1 min-h-0 flex flex-col justify-center px-5 py-2.5 gap-1.5">
          {placa}
          <div className="flex items-center justify-between gap-3 min-w-0">
            <p className="text-[28px] font-semibold tracking-[-0.01em] leading-[1.15] truncate">{v.veiculo.modelo ?? "Modelo não informado"}</p>
            {urgente && !urgenteNoCabecalho && <span className="shrink-0 rounded-full bg-amarelo text-preto px-3 text-[18px] font-semibold leading-8">Urgente</span>}
          </div>
          <div className="flex items-center justify-between gap-4 min-w-0">
            {item.pronto ? <span className="text-[24px] text-papel-suave">Entrega {entrega}</span> : responsavel}
            {tempo && (
              <span className={`shrink-0 font-semibold numero ${estreito ? "text-[22px]" : "text-[24px]"}`}>
                {tempo.nome === "Fila" ? `Fila ${tempo.valor}` : tempo.valor}
              </span>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="bg-grafite-2 rounded-cartao flex flex-col min-h-0 overflow-hidden">
      {cabecalho}
      <div className="flex-1 min-h-0 flex flex-col px-5 pt-3 pb-3">
        {placa}
        <p className={`mt-2 shrink-0 font-semibold ${estreito ? "text-[28px]" : "text-[32px]"} tracking-[-0.01em] leading-[1.1] truncate`}>{v.veiculo.modelo ?? "Modelo não informado"}</p>
        <div className="shrink-0 flex items-center justify-between gap-3 min-w-0">
          <p className="text-[20px] text-papel-suave leading-snug truncate">{[v.veiculo.cor, v.tipoReparo?.nome].filter(Boolean).join(" · ") || "—"}</p>
          {urgente && !urgenteNoCabecalho && <span className="shrink-0 rounded-full bg-amarelo text-preto px-3 text-[18px] font-semibold leading-8">Urgente</span>}
        </div>

        {bloqueio ? (
          <p className="mt-2 shrink-0 flex items-start gap-2 text-[20px] font-medium leading-[1.2] min-w-0">
            <Icone nome="bloqueio" tamanho={20} traco={2} className="shrink-0 mt-0.5 text-alerta" />
            <span className="line-clamp-2">{bloqueio.motivo}</span>
          </p>
        ) : (
          !item.pronto && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <ProgressoEtapas etapas={v.etapas} semaforo={SITUACAO[item.situacao].cor} escuro mostrarTexto={false} />
              </div>
              {atualIndex !== null && (
                <span className="text-[20px] font-medium text-papel-suave numero leading-none">
                  {atualIndex + 1}/{total}
                </span>
              )}
            </div>
          )
        )}

        {responsavel && <div className="mt-2.5">{responsavel}</div>}

        <dl className={`mt-auto pt-2.5 border-t border-linha-clara numero ${estreito ? "flex flex-col gap-1" : "grid grid-cols-2 gap-x-4"}`}>
          {item.pronto ? (
            <>
              <Numero nome="Pronto" valor={item.prontoHa ?? "—"} linha={estreito} />
              <Numero nome="Entrega" valor={entregaCelula} destaque={item.entrega === "hoje"} vencida={item.entregaVencida} linha={estreito} />
            </>
          ) : (
            <>
              <Numero nome={tempo?.nome ?? "Na etapa"} valor={tempo?.valor ?? "—"} linha={estreito} />
              <Numero nome="Entrega" valor={entregaCelula} destaque={item.entrega === "hoje"} vencida={item.entregaVencida} linha={estreito} />
            </>
          )}
        </dl>
      </div>
    </article>
  );
}

function Numero({ nome, valor, destaque = false, vencida = false, linha = false }: { nome: string; valor: string; destaque?: boolean; vencida?: boolean; linha?: boolean }) {
  // `linha`: rótulo à esquerda e valor à direita (coluna estreita, onde dois números lado a lado cortariam)
  // vencida: pílula vermelha com texto claro ("atrasado 2 dias") — vermelho direto no grafite não se lê a 3 m
  return (
    <div className={`min-w-0 ${linha ? "flex items-baseline justify-between gap-3" : ""}`}>
      <dt className="text-[16px] font-medium text-papel-suave leading-none shrink-0">{nome}</dt>
      <dd className={`m-0 text-[24px] font-semibold leading-[1.1] truncate ${linha ? "" : "mt-1"} ${destaque ? "text-amarelo" : ""}`}>
        {vencida ? <span className="inline-block rounded-full bg-alerta text-cartao px-2.5 leading-[1.3]">{valor}</span> : valor}
      </dd>
    </div>
  );
}

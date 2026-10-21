import type { MarcoISO, Perfil } from "@compartilhado/tipos";
import { formatarDuracao } from "@compartilhado/dominio/tempos";
import { progressoEtapas } from "@compartilhado/dominio/semaforo";
import { iniciais } from "../ui/Basicos";
import { ProgressoEtapas, nomePerfil } from "../ui/Carro";
import { Etiqueta } from "../ui/Estado";
import { Placa } from "../ui/Placa";
import { Icone, type NomeIcone } from "../Icone";
import { PilulaSituacao } from "./Situacao";
import { SITUACAO, type ItemQuadro } from "./quadro";

/**
 * Cartão do carro na Produção (docs/painel-design.md §5.1; revisão SG itens 3 e 4).
 * `compacto` (quadro do computador, colunas a partir de 204 px): Placa p + a pílula única, modelo · cor,
 * progresso fino, iniciais + tempo + prazo da etapa, e embaixo a entrega prometida (maior que o prazo da etapa).
 * `grande` (celular): Placa m, etapa atual, responsável com nome; o cartão inteiro é o alvo de toque.
 * O botão transparente por cima abre o painel do carro (nome acessível com a placa).
 */
export function CartaoQuadro({
  item,
  perfis,
  selecionado,
  onAbrir,
  variante = "compacto",
  mostrarEtapa = false,
}: {
  item: ItemQuadro;
  /** Mantido por compatibilidade: os horários já vêm legíveis no item (montarItens). */
  agora?: MarcoISO;
  perfis: Perfil[];
  selecionado: boolean;
  onAbrir: (osId: string, origem: HTMLButtonElement) => void;
  variante?: "compacto" | "grande";
  /** Mostra o nome da etapa atual (fora das colunas: lista "Todas" do celular). */
  mostrarEtapa?: boolean;
}) {
  const { v, resumo: r } = item;
  const grande = variante === "grande";
  const etapa = item.pronto ? undefined : r.atual;
  const nome = nomePerfil(perfis, etapa?.responsavelId);
  const bloqueio = item.impedido ? (etapa?.bloqueios.find((b) => !b.fimEm) ?? etapa?.bloqueios.at(-1)) : undefined;
  const { total, atualIndex } = progressoEtapas(v.etapas);
  // tempo na etapa: ícone + duração (o ícone diz o quê; o texto completo vai no title e no leitor de tela)
  const tempo: { icone: NomeIcone; texto: string; extenso: string } | undefined = item.pronto
    ? undefined
    : etapa?.estado === "na_fila"
      ? { icone: "relogio", texto: formatarDuracao(r.fila), extenso: `na fila há ${formatarDuracao(r.fila)}` }
      : etapa?.estado === "bloqueada"
        ? { icone: "bloqueio", texto: formatarDuracao(r.bloqueio), extenso: `parado há ${formatarDuracao(r.bloqueio)}` }
        : etapa?.iniciadaEm
          ? { icone: "play", texto: formatarDuracao(r.execucao), extenso: `em execução há ${formatarDuracao(r.execucao)}` }
          : undefined;
  const urgente = v.os.prioridade === 2;
  const estadoEtapa = etapa?.estado === "na_fila" ? "na fila" : etapa?.estado === "bloqueada" ? "impedida" : etapa?.iniciadaEm ? "em execução" : undefined;
  const texto = grande ? "text-[13px]" : "text-[12px]";

  return (
    <li className="relative list-none">
      <article
        className={`bg-cartao text-tinta border border-linha rounded-cartao shadow-cartao ${grande ? "p-4" : "p-2.5"} ${
          selecionado ? "border-transparent ring-2 ring-amarelo" : ""
        }`}
      >
        {/* L1: placa + a pílula única */}
        <div className="flex items-center justify-between gap-1.5">
          <Placa placa={v.veiculo.placa} tamanho={grande ? "m" : "p"} />
          {/* no compacto a pílula perde o ponto (o texto e o tom bastam) para caber ao lado da placa em 204 px */}
          <PilulaSituacao situacao={item.situacao} compacta={!grande} />
        </div>

        {/* L2: carro */}
        <p className={`${grande ? "mt-3 text-[15px]" : "mt-2 text-[13px]"} font-semibold leading-snug truncate`}>
          {v.veiculo.modelo ?? "Modelo não informado"}
          {v.veiculo.cor && <span className="font-normal text-tinta-suave"> · {v.veiculo.cor}</span>}
        </p>
        {grande && (
          <p className="text-[13px] text-tinta-suave truncate">
            {mostrarEtapa && etapa ? (
              <>
                <span className="font-medium text-tinta">{etapa.nome}</span>
                {estadoEtapa && <> · {estadoEtapa}</>}
              </>
            ) : (
              (v.tipoReparo?.nome ?? "Tipo de reparo não definido")
            )}
          </p>
        )}
        {urgente && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Etiqueta tom="alerta" ponto={false}>
              Urgente
            </Etiqueta>
          </div>
        )}

        {/* L3: progresso */}
        {!item.pronto && v.etapas.length > 0 && (
          <div className={`${grande ? "mt-3" : "mt-2.5"} flex items-center gap-2`}>
            <div className="flex-1 min-w-0">
              <ProgressoEtapas etapas={v.etapas} semaforo={SITUACAO[item.situacao].cor} mostrarTexto={false} />
            </div>
            {atualIndex !== null && (
              <span className="text-[12px] text-tinta-fraca numero leading-none" aria-label={`Etapa ${atualIndex + 1} de ${total}`}>
                {atualIndex + 1}/{total}
              </span>
            )}
          </div>
        )}

        {bloqueio && (
          <p className="mt-2 flex items-start gap-1.5 text-[12px] font-medium leading-snug text-alerta">
            <Icone nome="bloqueio" tamanho={13} className="shrink-0 mt-[2px]" />
            <span className="line-clamp-2">{bloqueio.motivo}</span>
          </p>
        )}

        {/* L4: quem · tempo na etapa · prazo da etapa */}
        {item.pronto ? (
          <p className={`${grande ? "mt-3 pt-3 border-t border-linha" : "mt-2"} flex items-center gap-1 min-w-0 ${texto} text-tinta-suave numero`}>
            <Icone nome="ok" tamanho={12} className="shrink-0 text-ok" />
            <span className="truncate">pronto {item.prontoHa ?? ""}</span>
          </p>
        ) : (
          <div className={`${grande ? "mt-3 pt-3 border-t border-linha gap-2" : "mt-2 gap-1.5"} flex items-center min-w-0 ${texto} numero`}>
            {nome ? (
              <span
                title={nome}
                className={`inline-grid place-items-center shrink-0 rounded-full bg-cinza-200 text-tinta font-semibold text-[11px] ${grande ? "w-7 h-7" : "w-6 h-6"}`}
              >
                <span aria-hidden="true">{iniciais(nome)}</span>
                <span className="sr-only">{nome}</span>
              </span>
            ) : grande ? (
              <span className="shrink-0 text-tinta-fraca">Sem responsável</span>
            ) : (
              <span title="Sem responsável" className="shrink-0 w-[22px] h-[22px] rounded-full border border-dashed border-linha-forte">
                <span className="sr-only">Sem responsável</span>
              </span>
            )}
            {grande && nome && <span className="font-medium truncate min-w-0">{nome}</span>}
            {tempo && (
              <span title={tempo.extenso} className="inline-flex items-center gap-1 min-w-0 text-tinta-suave whitespace-nowrap">
                <Icone nome={tempo.icone} tamanho={12} className="shrink-0" />
                <span aria-hidden="true" className="truncate">
                  {tempo.texto}
                </span>
                <span className="sr-only">{tempo.extenso}</span>
              </span>
            )}
            {/* com a entrega vencida, o atraso já aparece na linha da entrega (sem repetir "atrasado 1 dia") */}
            {item.prazoEtapa && !item.entregaVencida && (
              <span title="Prazo da etapa" className={`ml-auto shrink-0 whitespace-nowrap ${item.etapaVencida ? "text-alerta font-semibold" : "text-tinta-suave"}`}>
                <span className="sr-only">Prazo da etapa: </span>
                {item.prazoEtapa}
              </span>
            )}
          </div>
        )}

        {/* L5: entrega prometida ao cliente (mais forte que o prazo da etapa) */}
        <div className={`${grande ? "mt-2" : "mt-2 pt-2 border-t border-linha"} flex items-center gap-2 min-w-0 ${texto} numero`}>
          <span className="text-tinta-suave">Entrega</span>
          <ValorEntrega item={item} className="ml-auto shrink-0" />
        </div>
      </article>
      <button
        type="button"
        aria-label={`Abrir o carro ${v.veiculo.placa.split("").join(" ")}, ${v.veiculo.modelo ?? "modelo não informado"}`}
        aria-expanded={selecionado}
        aria-controls="painel-os"
        onClick={(e) => onAbrir(v.os.id, e.currentTarget)}
        className={`absolute inset-0 w-full h-full rounded-cartao bg-transparent transition-shadow duration-150 ${selecionado ? "" : "hover:ring-1 hover:ring-linha-forte"}`}
      />
    </li>
  );
}

/** Entrega prometida: "hoje" em amarelo-claro (é "hoje"), "atrasado 1 dia" em vermelho, o resto em tinta. */
export function ValorEntrega({ item, className = "" }: { item: ItemQuadro; className?: string }) {
  if (!item.entrega) return <span className={`text-tinta-fraca ${className}`}>sem data</span>;
  if (item.entregaVencida) return <span className={`font-semibold text-alerta whitespace-nowrap ${className}`}>{item.entrega}</span>;
  if (item.entrega === "hoje")
    return <span className={`inline-flex items-center h-5 px-1.5 rounded-controle bg-amarelo-claro text-amarelo-tinta font-semibold whitespace-nowrap ${className}`}>hoje</span>;
  return <span className={`font-semibold text-tinta whitespace-nowrap ${className}`}>{item.entrega}</span>;
}

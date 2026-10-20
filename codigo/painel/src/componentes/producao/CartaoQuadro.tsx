import type { MarcoISO, Perfil } from "@compartilhado/tipos";
import { formatarDuracao } from "@compartilhado/dominio/tempos";
import { progressoEtapas } from "@compartilhado/dominio/semaforo";
import { iniciais } from "../ui/Basicos";
import { ProgressoEtapas, nomePerfil } from "../ui/Carro";
import { Etiqueta, Semaforo, type Tom } from "../ui/Estado";
import { Placa } from "../ui/Placa";
import { Icone, type NomeIcone } from "../Icone";
import { formatarDia, formatarPrazo, formatarPrazoCurto, type ItemQuadro } from "./quadro";
import type { Semaforo as TipoSemaforo } from "@compartilhado/tipos";

const TOM_SEMAFORO: Record<TipoSemaforo, Tom> = { verde: "ok", laranja: "atencao", vermelho: "alerta", neutro: "neutro" };
const TEXTO_SEMAFORO: Record<TipoSemaforo, string> = { verde: "No prazo", laranja: "Atenção", vermelho: "Atrasado", neutro: "Sem prazo" };

/**
 * Cartão do carro na Produção (docs/painel-design.md §5.1).
 * `compacto` (quadro do computador, colunas a partir de 208 px): Placa p + semáforo, modelo · cor,
 * progresso fino, iniciais + tempo + prazo numa linha. `grande` (celular): Placa m, etapa atual,
 * responsável com nome; o cartão inteiro é o alvo de toque.
 * O botão transparente por cima abre o painel do carro (nome acessível com a placa).
 */
export function CartaoQuadro({
  item,
  agora,
  perfis,
  selecionado,
  onAbrir,
  variante = "compacto",
  mostrarEtapa = false,
}: {
  item: ItemQuadro;
  agora: MarcoISO;
  perfis: Perfil[];
  selecionado: boolean;
  onAbrir: (osId: string, origem: HTMLButtonElement) => void;
  variante?: "compacto" | "grande";
  /** Mostra o nome da etapa atual (fora das colunas: lista "Todas" do celular). */
  mostrarEtapa?: boolean;
}) {
  const { v, resumo: r } = item;
  const grande = variante === "grande";
  const etapa = r.atual;
  const nome = nomePerfil(perfis, etapa?.responsavelId);
  const bloqueio = item.impedido ? etapa?.bloqueios.find((b) => !b.fimEm) ?? etapa?.bloqueios.at(-1) : undefined;
  const { total, atualIndex } = progressoEtapas(v.etapas);
  // tempo na etapa: ícone + duração (o ícone diz o quê; o texto completo vai no title e no leitor de tela)
  const tempo: { icone: NomeIcone; texto: string; extenso: string } | undefined = item.pronto
    ? v.os.prontaEm ? { icone: "ok", texto: formatarPrazoCurto(v.os.prontaEm, agora), extenso: `pronto ${formatarPrazo(v.os.prontaEm, agora)}` } : undefined
    : etapa?.estado === "na_fila"
      ? { icone: "relogio", texto: formatarDuracao(r.fila), extenso: `na fila há ${formatarDuracao(r.fila)}` }
      : etapa?.estado === "bloqueada"
        ? { icone: "bloqueio", texto: formatarDuracao(r.bloqueio), extenso: `parado há ${formatarDuracao(r.bloqueio)}` }
        : etapa?.iniciadaEm
          ? { icone: "play", texto: formatarDuracao(r.execucao), extenso: `em execução há ${formatarDuracao(r.execucao)}` }
          : undefined;
  const prazo = item.pronto
    ? v.os.previsaoEntrega && `entrega ${formatarDia(v.os.previsaoEntrega, agora)}`
    : etapa?.prazoEm && `até ${formatarPrazoCurto(etapa.prazoEm, agora)}`;
  const urgente = v.os.prioridade === 2;
  const estadoEtapa = etapa?.estado === "na_fila" ? "na fila" : etapa?.estado === "bloqueada" ? "impedida" : etapa?.iniciadaEm ? "em execução" : undefined;

  return (
    <li className="relative list-none">
      <article
        className={`bg-cartao text-tinta border border-linha rounded-cartao shadow-cartao ${grande ? "p-4" : "p-2.5"} ${
          selecionado ? "border-transparent ring-2 ring-amarelo" : ""
        }`}
      >
        {/* L1: placa + semáforo */}
        <div className="flex items-center justify-between gap-1.5">
          <Placa placa={v.veiculo.placa} tamanho={grande ? "m" : "p"} />
          {/* no compacto a pílula perde o ponto (o texto e o tom bastam) para caber ao lado da placa em 204 px */}
          {item.pronto ? (
            <Etiqueta tom="ok" ponto={grande} className={grande ? "" : "px-2"}>
              Pronto
            </Etiqueta>
          ) : grande ? (
            <Semaforo valor={item.semaforo} texto={item.impedido ? "Impedido" : undefined} className="shrink-0" />
          ) : (
            <Etiqueta tom={TOM_SEMAFORO[item.semaforo]} ponto={false} className="px-2">
              {item.impedido ? "Impedido" : TEXTO_SEMAFORO[item.semaforo]}
            </Etiqueta>
          )}
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
        {(urgente || item.entregaHoje) && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {urgente && (
              <Etiqueta tom="alerta" ponto={false}>
                Urgente
              </Etiqueta>
            )}
            {item.entregaHoje && !item.pronto && (
              <Etiqueta tom="amarelo" ponto={false}>
                Entrega hoje
              </Etiqueta>
            )}
          </div>
        )}

        {/* L3: progresso */}
        {!item.pronto && v.etapas.length > 0 && (
          <div className={`${grande ? "mt-3" : "mt-2.5"} flex items-center gap-2`}>
            <div className="flex-1 min-w-0">
              <ProgressoEtapas etapas={v.etapas} semaforo={r.semaforoAtual} mostrarTexto={false} />
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

        {/* L4: quem · tempo · prazo */}
        {(tempo || prazo || !item.pronto) && (
          <div className={`${grande ? "mt-3 pt-3 border-t border-linha gap-2" : "mt-2 gap-1.5"} flex items-center min-w-0 text-[12px] numero`}>
            {!item.pronto &&
              (nome ? (
                <span
                  title={nome}
                  className={`inline-grid place-items-center shrink-0 rounded-full bg-cinza-200 text-tinta font-semibold ${grande ? "w-7 h-7 text-[11px]" : "w-[22px] h-[22px] text-[10px]"}`}
                >
                  <span aria-hidden="true">{iniciais(nome)}</span>
                  <span className="sr-only">{nome}</span>
                </span>
              ) : grande ? (
                <span className="shrink-0 text-[13px] text-tinta-fraca">Sem responsável</span>
              ) : (
                <span title="Sem responsável" className="shrink-0 w-[22px] h-[22px] rounded-full border border-dashed border-linha-forte">
                  <span className="sr-only">Sem responsável</span>
                </span>
              ))}
            {grande && nome && <span className="text-[13px] font-medium truncate min-w-0">{nome}</span>}
            {tempo && (
              <span title={tempo.extenso} className="inline-flex items-center gap-1 min-w-0 text-tinta-suave whitespace-nowrap">
                <Icone nome={tempo.icone} tamanho={12} className="shrink-0" />
                <span aria-hidden="true" className="truncate">
                  {tempo.texto}
                </span>
                <span className="sr-only">{tempo.extenso}</span>
              </span>
            )}
            {prazo && <span className={`ml-auto shrink-0 whitespace-nowrap font-medium ${item.atrasado ? "text-alerta" : "text-tinta"}`}>{prazo}</span>}
          </div>
        )}
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

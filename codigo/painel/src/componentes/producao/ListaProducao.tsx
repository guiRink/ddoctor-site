import type { MarcoISO, Perfil } from "@compartilhado/tipos";
import { formatarDuracao } from "@compartilhado/dominio/tempos";
import { progressoEtapas } from "@compartilhado/dominio/semaforo";
import { Responsavel } from "../ui/Basicos";
import { nomePerfil } from "../ui/Carro";
import { Etiqueta, Semaforo } from "../ui/Estado";
import { Placa } from "../ui/Placa";
import { Tabela, Td, Th } from "../ui/Tabela";
import { Icone } from "../Icone";
import { formatarDia, formatarPrazo, type ItemQuadro } from "./quadro";

/**
 * Visão Lista da Produção (docs/painel-design.md §5.1): todos os carros numa tabela, do mais urgente
 * ao menos. A linha inteira abre o painel do carro; o botão da placa dá o acesso por teclado.
 */
export function ListaProducao({
  itens,
  agora,
  perfis,
  selecionadoId,
  onAbrir,
}: {
  itens: ItemQuadro[];
  agora: MarcoISO;
  perfis: Perfil[];
  selecionadoId: string | null;
  onAbrir: (osId: string, origem: HTMLButtonElement) => void;
}) {
  return (
    <Tabela legenda="Carros na produção, do mais urgente ao menos">
      <thead>
        <tr>
          <Th className="w-[128px]">Placa</Th>
          <Th>Carro</Th>
          <Th>Etapa</Th>
          <Th>Responsável</Th>
          <Th direita>Na etapa</Th>
          <Th direita>Etapa até</Th>
          <Th direita>Entrega</Th>
          <Th className="w-[120px]">Situação</Th>
        </tr>
      </thead>
      <tbody>
        {itens.map((i) => (
          <LinhaProducao key={i.v.os.id} item={i} agora={agora} perfis={perfis} selecionado={i.v.os.id === selecionadoId} onAbrir={onAbrir} />
        ))}
      </tbody>
    </Tabela>
  );
}

function LinhaProducao({
  item,
  agora,
  perfis,
  selecionado,
  onAbrir,
}: {
  item: ItemQuadro;
  agora: MarcoISO;
  perfis: Perfil[];
  selecionado: boolean;
  onAbrir: (osId: string, origem: HTMLButtonElement) => void;
}) {
  const { v, resumo: r } = item;
  const etapa = r.atual;
  const { total, atualIndex } = progressoEtapas(v.etapas);
  const critico = item.atrasado || item.impedido;
  const bloqueio = item.impedido ? etapa?.bloqueios.find((b) => !b.fimEm) : undefined;
  const tempo = item.pronto
    ? "—"
    : etapa?.estado === "na_fila"
      ? `fila ${formatarDuracao(r.fila)}`
      : etapa?.estado === "bloqueada"
        ? `parado ${formatarDuracao(r.bloqueio)}`
        : etapa?.iniciadaEm
          ? formatarDuracao(r.execucao)
          : "—";
  const estadoEtapa = etapa?.estado === "na_fila" ? "na fila" : etapa?.estado === "bloqueada" ? "impedida" : etapa?.iniciadaEm ? "em execução" : "aguardando";

  return (
    <tr
      onClick={(e) => {
        const botao = e.currentTarget.querySelector("button");
        if (botao) onAbrir(v.os.id, botao);
      }}
      className={`border-b border-linha last:border-b-0 cursor-pointer transition-colors duration-150 ${
        selecionado ? "bg-amarelo-claro" : critico ? "bg-alerta-claro/50 hover:bg-alerta-claro" : "hover:bg-cinza-50"
      }`}
    >
      <Td>
        <button
          type="button"
          aria-label={`Abrir o carro ${v.veiculo.placa.split("").join(" ")}, ${v.veiculo.modelo ?? "modelo não informado"}`}
          aria-expanded={selecionado}
          aria-controls="painel-os"
          onClick={(e) => {
            e.stopPropagation();
            onAbrir(v.os.id, e.currentTarget);
          }}
          className="block rounded-[4px]"
        >
          <Placa placa={v.veiculo.placa} tamanho="p" />
        </button>
      </Td>
      <Td className="max-w-[240px]">
        <p className="flex items-center gap-2 min-w-0">
          <span className="font-medium leading-snug truncate">{v.veiculo.modelo ?? "Modelo não informado"}</span>
          {v.os.prioridade === 2 && (
            <Etiqueta tom="alerta" ponto={false} className="shrink-0">
              Urgente
            </Etiqueta>
          )}
        </p>
        <p className="text-[13px] text-tinta-suave leading-snug truncate">{[v.veiculo.cor, v.tipoReparo?.nome ?? "Tipo de reparo não definido"].filter(Boolean).join(" · ")}</p>
      </Td>
      <Td>
        {item.pronto ? (
          <p className="font-medium whitespace-nowrap">Pronto para entrega</p>
        ) : (
          <>
            <p className="font-medium leading-snug whitespace-nowrap">{etapa?.nome ?? "Sem etapa definida"}</p>
            <p className="text-[13px] text-tinta-suave leading-snug numero whitespace-nowrap">
              {atualIndex !== null && `${atualIndex + 1} de ${total} · `}
              {estadoEtapa}
            </p>
          </>
        )}
        {bloqueio && (
          <p className="mt-0.5 flex items-start gap-1 text-[12px] font-medium text-alerta leading-snug max-w-[200px]">
            <Icone nome="bloqueio" tamanho={12} className="shrink-0 mt-[2px]" />
            <span className="line-clamp-1" title={bloqueio.motivo}>
              {bloqueio.motivo}
            </span>
          </p>
        )}
      </Td>
      <Td>{item.pronto ? <span className="text-tinta-fraca">—</span> : <Responsavel nome={nomePerfil(perfis, etapa?.responsavelId)} />}</Td>
      <Td numero className="text-tinta-suave">
        {tempo}
      </Td>
      <Td numero className={item.atrasado ? "text-alerta font-medium" : ""}>
        {item.pronto ? (v.os.prontaEm ? <span className="text-tinta-suave">pronto {formatarPrazo(v.os.prontaEm, agora)}</span> : "—") : etapa?.prazoEm ? formatarPrazo(etapa.prazoEm, agora) : "—"}
      </Td>
      <Td numero className={item.entregaHoje ? "font-semibold" : ""}>
        {v.os.previsaoEntrega ? formatarDia(v.os.previsaoEntrega, agora) : "—"}
      </Td>
      <Td>
        {item.pronto ? (
          <Etiqueta tom="ok" ponto={false}>
            <Icone nome="ok" tamanho={12} />
            Pronto
          </Etiqueta>
        ) : (
          <Semaforo valor={item.semaforo} texto={item.impedido ? "Impedido" : undefined} />
        )}
      </Td>
    </tr>
  );
}

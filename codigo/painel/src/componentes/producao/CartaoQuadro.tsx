import type { ConfigOficina, MarcoISO, Perfil } from "@compartilhado/tipos";
import { CartaoOS } from "../ui/Carro";
import { Etiqueta } from "../ui/Estado";
import { Placa } from "../ui/Placa";
import { Icone } from "../Icone";
import { formatarDia, formatarPrazo, type ItemQuadro } from "./quadro";

/**
 * Cartão do quadro do gestor: o CartaoOS do sistema visual + prazo da etapa e entrega no rodapé.
 * O botão transparente por cima abre o painel lateral de ações (nome acessível com a placa).
 */
export function CartaoQuadro({
  item,
  agora,
  config,
  perfis,
  selecionado,
  onAbrir,
}: {
  item: ItemQuadro;
  agora: MarcoISO;
  config: ConfigOficina;
  perfis: Perfil[];
  selecionado: boolean;
  onAbrir: (osId: string, origem: HTMLButtonElement) => void;
}) {
  const { v } = item;
  return (
    <li className="relative list-none">
      {item.pronto ? <CartaoPronto item={item} agora={agora} /> : <CartaoOS v={v} agora={agora} config={config} perfis={perfis} rodape={<Rodape item={item} agora={agora} />} />}
      <button
        type="button"
        aria-label={`Abrir ações do carro ${v.veiculo.placa.split("").join(" ")}, ${v.veiculo.modelo ?? "modelo não informado"}`}
        aria-expanded={selecionado}
        aria-controls="painel-os"
        onClick={(e) => onAbrir(v.os.id, e.currentTarget)}
        className={`absolute inset-0 w-full h-full bg-transparent transition-colors duration-150 ${
          selecionado ? "outline-[3px] outline-amarelo -outline-offset-[3px]" : "hover:outline hover:outline-1 hover:outline-linha-forte"
        }`}
      />
    </li>
  );
}

function Rodape({ item, agora }: { item: ItemQuadro; agora: MarcoISO }) {
  const prazo = item.resumo.atual?.prazoEm;
  const entrega = item.v.os.previsaoEntrega;
  if (!prazo && !entrega) return null;
  return (
    <dl className="mt-2.5 grid grid-cols-2 gap-2 text-[12px] numero">
      <div className="min-w-0">
        <dt className="text-tinta-fraca">Etapa até</dt>
        <dd className="m-0 font-semibold truncate">{prazo ? formatarPrazo(prazo, agora) : "—"}</dd>
      </div>
      <div className="min-w-0 text-right">
        <dt className="text-tinta-fraca">Entrega</dt>
        <dd className={`m-0 font-semibold truncate ${item.entregaHoje ? "text-tinta" : ""}`}>{entrega ? formatarDia(entrega, agora) : "—"}</dd>
      </div>
    </dl>
  );
}

/** Carro pronto: sem semáforo de prazo; mostra desde quando está pronto e a entrega prevista. */
function CartaoPronto({ item, agora }: { item: ItemQuadro; agora: MarcoISO }) {
  const { v } = item;
  return (
    <article className="block bg-cartao border border-linha p-3.5 text-tinta">
      <div className="flex items-start justify-between gap-2">
        <Placa placa={v.veiculo.placa} tamanho="m" />
        <Etiqueta tom="ok">
          <Icone nome="ok" tamanho={12} />
          Pronto
        </Etiqueta>
      </div>
      <p className="mt-2.5 font-semibold leading-tight truncate">
        {v.veiculo.modelo ?? "Modelo não informado"}
        {v.veiculo.cor && <span className="font-normal text-tinta-suave"> · {v.veiculo.cor}</span>}
      </p>
      <p className="text-[13px] text-tinta-suave truncate">{v.tipoReparo?.nome ?? "Tipo de reparo não definido"}</p>
      <dl className="mt-3 pt-3 border-t border-linha grid grid-cols-2 gap-2 text-[12px] numero">
        <div className="min-w-0">
          <dt className="text-tinta-fraca">Pronto desde</dt>
          <dd className="m-0 font-semibold truncate">{v.os.prontaEm ? formatarPrazo(v.os.prontaEm, agora) : "—"}</dd>
        </div>
        <div className="min-w-0 text-right">
          <dt className="text-tinta-fraca">Entrega</dt>
          <dd className="m-0 font-semibold truncate">{v.os.previsaoEntrega ? formatarDia(v.os.previsaoEntrega, agora) : "—"}</dd>
        </div>
      </dl>
    </article>
  );
}

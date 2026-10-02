import { Link } from "react-router-dom";
import { formatISO } from "date-fns";
import { useAtendimentos } from "../dados/hooks";
import { diasNaEtapa, formatarPlaca, pendencias } from "../dominio/regras";
import { ROTULO_ETAPA, ROTULO_SUB_ETAPA } from "../dominio/rotulos";
import { ETAPAS, type Atendimento, type Etapa } from "../dominio/tipos";
import { BotaoLink } from "../componentes/Botao";
import { Cabecalho, Carregando, Demo } from "../componentes/Pagina";
import { Vazio } from "../componentes/Vazio";

/** Colunas do pátio: do carro que ainda espera autorização ao que já saiu. Pago fica fora (financeiro). */
const COLUNAS: Etapa[] = ETAPAS.filter((e) => e !== "pago");

export function Patio() {
  const lista = useAtendimentos();
  const hoje = formatISO(new Date(), { representation: "date" });

  if (lista === undefined) return <Carregando />;

  if (lista.length === 0) {
    return (
      <>
        <Cabecalho titulo="Pátio" />
        <Vazio
          titulo="Nenhum carro cadastrado."
          texto="Cadastre o primeiro atendimento ou carregue os dados de demonstração em Ajustes para ver o pátio funcionando."
          acao={
            <div className="flex flex-wrap gap-2">
              <BotaoLink para="/atendimentos/novo">Novo atendimento</BotaoLink>
              <BotaoLink para="/ajustes" variante="fantasma">
                Carregar demonstração
              </BotaoLink>
            </div>
          }
        />
      </>
    );
  }

  const porEtapa = new Map<Etapa, Atendimento[]>(COLUNAS.map((e) => [e, []]));
  for (const a of lista) porEtapa.get(a.etapa)?.push(a);
  const naOficina = lista.filter((a) => a.etapa === "no_patio" || a.etapa === "pronto").length;

  return (
    <>
      <Cabecalho titulo="Pátio" resumo={`${naOficina} ${naOficina === 1 ? "carro" : "carros"} na oficina agora · ${lista.length} em acompanhamento`} />
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-8 md:px-8 snap-x">
        {COLUNAS.map((etapa) => {
          const itens = porEtapa.get(etapa) ?? [];
          return (
            <section key={etapa} aria-label={ROTULO_ETAPA[etapa]} className="snap-start shrink-0 w-[260px] bg-papel border border-linha flex flex-col max-h-[70svh]">
              <header className="flex items-baseline justify-between gap-2 px-3 py-2 border-b border-linha bg-preto text-papel">
                <h2 className="text-[13px] font-bold">{ROTULO_ETAPA[etapa]}</h2>
                <span className="rotulo text-papel-suave">{itens.length}</span>
              </header>
              <ul className="flex flex-col gap-2 p-2 overflow-y-auto">
                {itens.length === 0 && <li className="text-sm text-tinta-suave px-1 py-2">—</li>}
                {itens.map((a) => {
                  const alertas = pendencias(a, hoje);
                  const dias = diasNaEtapa(a, hoje);
                  return (
                    <li key={a.id}>
                      <Link to={`/atendimentos/${a.id}`} className="block border border-linha bg-white hover:border-preto p-3 no-underline text-tinta">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-extrabold text-lg tracking-tight tabular-nums">{formatarPlaca(a.placa)}</span>
                          <Demo ativo={a.demo} />
                        </div>
                        <div className="text-sm">{a.modelo ?? "Modelo não informado"}{a.cor ? ` · ${a.cor}` : ""}</div>
                        <div className="text-sm text-tinta-suave truncate">{a.cliente.nome}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-tinta-suave">
                          {a.seguradora && <span>{a.seguradora}</span>}
                          {a.subEtapa && <span className="font-bold text-tinta">{ROTULO_SUB_ETAPA[a.subEtapa]}</span>}
                          {a.box && <span>{a.box}</span>}
                          <span className="tabular-nums">{dias === 0 ? "hoje" : `${dias} d`}</span>
                        </div>
                        {alertas.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {alertas.map((p) => (
                              <span key={p} className="rotulo bg-alerta text-papel px-1.5 py-0.5">
                                {p === "entrega_atrasada" ? "Atrasado" : p === "sem_autorizacao" ? "Sem autorização" : p === "vistoria_vencendo" ? "Vistoria vence" : p === "documentacao_recusada" ? "Doc. recusada" : "Pagamento atrasado"}
                              </span>
                            ))}
                          </div>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-tinta-suave">Mover carros entre etapas e definir box e responsável chega no Sprint 1.</p>
    </>
  );
}

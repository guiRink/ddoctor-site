import { Link } from "react-router-dom";
import { formatISO } from "date-fns";
import { useAtendimentos } from "../dados/hooks";
import { diasEntre, formatarPlaca, pendencias, previsaoEfetiva } from "../dominio/regras";
import { ROTULO_PENDENCIA } from "../dominio/rotulos";
import type { Atendimento, Pendencia } from "../dominio/tipos";
import { Cabecalho, Carregando, EtiquetaEtapa } from "../componentes/Pagina";
import { Vazio } from "../componentes/Vazio";

const ORDEM: Pendencia[] = ["documentacao_recusada", "pagamento_atrasado", "vistoria_vencendo", "sem_autorizacao", "entrega_atrasada"];

const EXPLICA: Record<Pendencia, string> = {
  sem_autorizacao: "Aberto há mais de 3 dias sem a autorização entrar no sistema. Cobrar o analista/gestor.",
  vistoria_vencendo: "O link de vistoria vence em até 2 dias. Garantir que o segurado envie as fotos.",
  entrega_atrasada: "Passou da previsão prometida ao cliente (ou registrada no portal).",
  documentacao_recusada: "A Maxpar recusou a documentação. Corrigir o motivo e reenviar.",
  pagamento_atrasado: "Documentação enviada há mais de 30 dias e nenhum pagamento registrado.",
};

function detalhe(a: Atendimento, p: Pendencia, hoje: string): string {
  switch (p) {
    case "sem_autorizacao":
      return `${diasEntre(a.abertura, hoje)} dias desde a abertura`;
    case "vistoria_vencendo":
      return a.limiteVistoria ? `vence em ${diasEntre(hoje, a.limiteVistoria)} dia(s)` : "";
    case "entrega_atrasada": {
      const prev = previsaoEfetiva(a);
      return prev ? `${diasEntre(prev, hoje)} dia(s) de atraso` : "";
    }
    case "documentacao_recusada": {
      const r = a.documentacao.recusas.at(-1);
      return r ? `motivo: ${r.motivo}` : "";
    }
    case "pagamento_atrasado":
      return a.documentacao.enviadaEm ? `${diasEntre(a.documentacao.enviadaEm, hoje)} dias desde o envio` : "";
  }
}

export function Pendencias() {
  const lista = useAtendimentos();
  if (lista === undefined) return <Carregando />;
  const hoje = formatISO(new Date(), { representation: "date" });

  const grupos = ORDEM.map((p) => ({
    tipo: p,
    itens: lista.filter((a) => pendencias(a, hoje).includes(p)),
  })).filter((g) => g.itens.length > 0);

  const total = grupos.reduce((s, g) => s + g.itens.length, 0);

  if (total === 0) {
    return (
      <>
        <Cabecalho titulo="Pendências" />
        <Vazio titulo="Nada preso." texto="Nenhum atendimento está sem autorização, com vistoria vencendo, atrasado, com documentação recusada ou com pagamento em atraso." />
      </>
    );
  }

  return (
    <>
      <Cabecalho titulo="Pendências" resumo={`${total} item(ns) precisando de ação`} />
      <div className="grid gap-6">
        {grupos.map((g) => (
          <section key={g.tipo} className="bg-white border border-linha">
            <header className="px-4 py-3 border-b border-linha flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="titulo-condensado text-xl">
                {ROTULO_PENDENCIA[g.tipo]} <span className="text-tinta-suave font-normal text-base">· {g.itens.length}</span>
              </h2>
              <p className="text-sm text-tinta-suave m-0">{EXPLICA[g.tipo]}</p>
            </header>
            <ul className="m-0 p-0 list-none">
              {g.itens.map((a) => (
                <li key={a.id} className="border-t border-linha first:border-t-0">
                  <Link to={`/atendimentos/${a.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 no-underline text-tinta hover:bg-papel">
                    <span className="font-extrabold tabular-nums">{formatarPlaca(a.placa)}</span>
                    <span className="text-sm">{a.modelo ?? "—"} · {a.cliente.nome}</span>
                    {a.seguradora && <span className="text-sm text-tinta-suave">{a.seguradora}{a.protocolo ? ` · ${a.protocolo}` : ""}</span>}
                    <span className="text-sm text-alerta">{detalhe(a, g.tipo, hoje)}</span>
                    <span className="ml-auto"><EtiquetaEtapa etapa={a.etapa} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-6 text-sm text-tinta-suave">Registrar o contato com o analista direto daqui chega no Sprint 2.</p>
    </>
  );
}

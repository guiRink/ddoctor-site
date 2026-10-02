import { Link } from "react-router-dom";
import { addDays, formatISO, isWeekend } from "date-fns";
import { useAtendimentos } from "../dados/hooks";
import { emAberto, formatarPlaca, previsaoEfetiva } from "../dominio/regras";
import type { Atendimento } from "../dominio/tipos";
import { Cabecalho, Carregando, EtiquetaEtapa } from "../componentes/Pagina";
import { Vazio } from "../componentes/Vazio";

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function Agenda() {
  const lista = useAtendimentos();
  if (lista === undefined) return <Carregando />;

  const hoje = new Date();
  const hojeISO = formatISO(hoje, { representation: "date" });
  const abertos = lista.filter(emAberto);
  const atrasados = abertos.filter((a) => (previsaoEfetiva(a) ?? "9999") < hojeISO);
  const semPrevisao = abertos.filter((a) => !previsaoEfetiva(a));
  const dias = Array.from({ length: 7 }, (_, i) => addDays(hoje, i));

  if (abertos.length === 0) {
    return (
      <>
        <Cabecalho titulo="Agenda" />
        <Vazio titulo="Nenhuma entrega prevista." texto="Quando um atendimento tiver previsão de entrega ao cliente ou no portal, ele aparece aqui por dia." />
      </>
    );
  }

  const porDia = (iso: string) => abertos.filter((a) => previsaoEfetiva(a) === iso);

  const Cartao = ({ a }: { a: Atendimento }) => (
    <li>
      <Link to={`/atendimentos/${a.id}`} className="flex items-center justify-between gap-2 border border-linha bg-white hover:border-preto px-3 py-2 no-underline text-tinta">
        <span>
          <span className="font-extrabold tabular-nums">{formatarPlaca(a.placa)}</span>
          <span className="text-sm text-tinta-suave"> · {a.modelo ?? "—"}</span>
        </span>
        <EtiquetaEtapa etapa={a.etapa} />
      </Link>
    </li>
  );

  return (
    <>
      <Cabecalho titulo="Agenda" resumo={`Próximos 7 dias · ${atrasados.length} atrasado(s) · ${semPrevisao.length} sem previsão`} />

      {atrasados.length > 0 && (
        <section className="mb-6">
          <h2 className="rotulo text-alerta mb-2">Atrasados</h2>
          <ul className="m-0 p-0 list-none grid gap-2 md:grid-cols-2">
            {atrasados.map((a) => (
              <Cartao key={a.id} a={a} />
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-3 md:grid-cols-7">
        {dias.map((d) => {
          const iso = formatISO(d, { representation: "date" });
          const itens = porDia(iso);
          return (
            <section key={iso} className={`border border-linha ${isWeekend(d) ? "bg-papel" : "bg-white"}`}>
              <header className={`px-3 py-2 border-b border-linha ${iso === hojeISO ? "bg-amarelo text-preto" : "bg-preto text-papel"}`}>
                <div className="rotulo">{DIAS[d.getDay()]}</div>
                <div className="font-extrabold text-lg tabular-nums leading-none">{d.getDate()}</div>
              </header>
              <ul className="m-0 p-2 list-none flex flex-col gap-2 min-h-16">
                {itens.length === 0 && <li className="text-sm text-tinta-suave">—</li>}
                {itens.map((a) => (
                  <li key={a.id}>
                    <Link to={`/atendimentos/${a.id}`} className="block border border-linha bg-papel hover:border-preto px-2 py-1 no-underline text-tinta">
                      <div className="font-extrabold tabular-nums text-sm">{formatarPlaca(a.placa)}</div>
                      <div className="text-xs text-tinta-suave truncate">{a.cliente.nome}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {semPrevisao.length > 0 && (
        <section className="mt-6">
          <h2 className="rotulo text-tinta-suave mb-2">Sem previsão de entrega</h2>
          <ul className="m-0 p-0 list-none grid gap-2 md:grid-cols-2">
            {semPrevisao.map((a) => (
              <Cartao key={a.id} a={a} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

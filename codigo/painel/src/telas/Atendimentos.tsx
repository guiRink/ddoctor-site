import { Link, useSearchParams } from "react-router-dom";
import { formatISO } from "date-fns";
import { useAtendimentos } from "../dados/hooks";
import { formatarPlaca, normalizarPlaca, pendencias, previsaoEfetiva } from "../dominio/regras";
import { ROTULO_ORIGEM } from "../dominio/rotulos";
import type { Atendimento } from "../dominio/tipos";
import { BotaoLink } from "../componentes/Botao";
import { Cabecalho, Carregando, Demo, EtiquetaEtapa } from "../componentes/Pagina";
import { Vazio } from "../componentes/Vazio";

function combina(a: Atendimento, termo: string): boolean {
  const t = termo.trim().toLowerCase();
  if (!t) return true;
  const placa = normalizarPlaca(t);
  return (
    (placa.length >= 3 && a.placa.includes(placa)) ||
    (a.protocolo ?? "").includes(t) ||
    a.cliente.nome.toLowerCase().includes(t) ||
    (a.modelo ?? "").toLowerCase().includes(t) ||
    (a.seguradora ?? "").toLowerCase().includes(t)
  );
}

function dataCurta(iso?: string): string {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function Atendimentos() {
  const lista = useAtendimentos();
  const [params, setParams] = useSearchParams();
  const termo = params.get("q") ?? "";
  const hoje = formatISO(new Date(), { representation: "date" });

  if (lista === undefined) return <Carregando />;

  const filtrados = lista.filter((a) => combina(a, termo));

  return (
    <>
      <Cabecalho
        titulo="Atendimentos"
        resumo={termo ? `${filtrados.length} resultado(s) para “${termo}”` : `${lista.length} atendimento(s)`}
        acoes={
          <>
            {termo && (
              <button type="button" onClick={() => setParams({})} className="min-h-11 px-3 text-[13px] font-bold border border-linha hover:border-preto">
                Limpar busca
              </button>
            )}
            <BotaoLink para="/atendimentos/novo">Novo atendimento</BotaoLink>
          </>
        }
      />

      {lista.length === 0 ? (
        <Vazio
          titulo="Nenhum atendimento ainda."
          texto="Cada carro que entra vira um atendimento: protocolo da Maxpar, peças solicitadas e autorizadas, franquia, previsão de entrega e documentação."
          acao={<BotaoLink para="/atendimentos/novo">Cadastrar o primeiro</BotaoLink>}
        />
      ) : filtrados.length === 0 ? (
        <Vazio titulo="Nada encontrado." texto={`Nenhum atendimento combina com “${termo}”. Tente a placa sem hífen, o número do protocolo ou o nome do cliente.`} />
      ) : (
        <div className="border border-linha bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-preto text-papel text-left">
              <tr className="rotulo">
                <th className="px-3 py-2 font-bold">Placa</th>
                <th className="px-3 py-2 font-bold">Carro</th>
                <th className="px-3 py-2 font-bold">Cliente</th>
                <th className="px-3 py-2 font-bold">Origem</th>
                <th className="px-3 py-2 font-bold">Protocolo</th>
                <th className="px-3 py-2 font-bold">Etapa</th>
                <th className="px-3 py-2 font-bold">Previsão</th>
                <th className="px-3 py-2 font-bold">Alertas</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((a) => {
                const alertas = pendencias(a, hoje);
                return (
                  <tr key={a.id} className="border-t border-linha hover:bg-papel">
                    <td className="px-3 py-2 font-extrabold tabular-nums whitespace-nowrap">
                      <Link to={`/atendimentos/${a.id}`} className="no-underline text-tinta hover:text-amarelo-escuro">
                        {formatarPlaca(a.placa)}
                      </Link>
                      <span className="ml-2">
                        <Demo ativo={a.demo} />
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{a.modelo ?? "—"}{a.cor ? ` · ${a.cor}` : ""}</td>
                    <td className="px-3 py-2 max-w-[18ch] truncate">{a.cliente.nome}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{a.seguradora ?? ROTULO_ORIGEM[a.origem]}</td>
                    <td className="px-3 py-2 tabular-nums">{a.protocolo ?? "—"}</td>
                    <td className="px-3 py-2"><EtiquetaEtapa etapa={a.etapa} /></td>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">{dataCurta(previsaoEfetiva(a))}</td>
                    <td className="px-3 py-2">
                      {alertas.length === 0 ? <span className="text-tinta-suave">—</span> : <span className="rotulo bg-alerta text-papel px-1.5 py-0.5">{alertas.length}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

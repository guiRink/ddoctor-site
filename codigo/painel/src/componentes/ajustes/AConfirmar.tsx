import type { ConfigOficina, Pagador } from "@compartilhado/tipos";
import { DIAS_ESTOQUE_PARADO_PADRAO, campoConfigProvisorio } from "@compartilhado/dominio/config";
import { useConfig, usePagadores } from "../../dados/hooks";
import { Icone } from "../Icone";
import { Consulta, Secao } from "./Estrutura";

interface Pendente {
  chave: string;
  texto: string;
  /** Seção de Ajustes onde se confirma (sem seção = ainda não se edita pelo painel). */
  secao?: string;
}

/** O que ainda é provisório (sprint SG): cada tela só mostra o pontilhado; a lista inteira mora aqui. */
function pendentes(c: ConfigOficina, pagadores: readonly Pagador[]): Pendente[] {
  const lista: Pendente[] = [];
  if (campoConfigProvisorio(c, "vagasEntrada")) lista.push({ chave: "vagas", texto: "Entradas por dia", secao: "agenda" });
  if (campoConfigProvisorio(c, "carrosSimultaneos")) lista.push({ chave: "simultaneos", texto: "Carros ao mesmo tempo", secao: "agenda" });
  if (campoConfigProvisorio(c, "pecasDia")) lista.push({ chave: "pecas", texto: "Peças por dia", secao: "agenda" });
  if (campoConfigProvisorio(c, "semaforo")) lista.push({ chave: "semaforo", texto: "Quando o cartão fica laranja e vermelho", secao: "prazos" });
  if (campoConfigProvisorio(c, "expediente")) lista.push({ chave: "expediente", texto: "Expediente da oficina", secao: "prazos" });
  if (!c.checklist) lista.push({ chave: "checklist", texto: "Checklist de entrada", secao: "checklist" });
  const prazos = pagadores.filter((p) => p.prazo.provisorio).map((p) => p.nome);
  if (prazos.length) lista.push({ chave: "pagadores", texto: `Prazo de pagamento: ${prazos.join(", ")}`, secao: "pagadores" });
  lista.push({ chave: "parado", texto: `Material parado: sem saída há ${DIAS_ESTOQUE_PARADO_PADRAO} dias` });
  return lista;
}

const ir = (secao: string) => document.getElementById(`ajustes-${secao}`)?.scrollIntoView({ block: "start" });

export function AConfirmar() {
  const config = useConfig();
  const pagadoresQ = usePagadores();
  const ambos = {
    data: config.data && pagadoresQ.data ? { c: config.data, p: pagadoresQ.data } : undefined,
    isPending: config.isPending || pagadoresQ.isPending,
    isError: config.isError || pagadoresQ.isError,
    refetch: () => {
      if (config.isError) config.refetch();
      if (pagadoresQ.isError) pagadoresQ.refetch();
    },
  };
  return (
    <Secao id="confirmar" titulo="A confirmar com o dono" descricao="Valores provisórios que o painel usa até alguém confirmar.">
      <Consulta q={ambos}>
        {({ c, p }) => {
          const lista = pendentes(c, p);
          return (
            <ul>
              {lista.map((i) => (
                <li key={i.chave} className="flex items-center justify-between gap-3 min-h-12 px-5 py-2 border-b border-linha last:border-b-0">
                  <span className="text-[14px]">
                    <span className="underline decoration-dotted decoration-atencao decoration-[1.5px] underline-offset-4">{i.texto}</span>
                  </span>
                  {i.secao && (
                    <button
                      type="button"
                      onClick={() => ir(i.secao!)}
                      aria-label={`Ir para ${i.texto}`}
                      className="inline-flex items-center gap-1 h-8 max-md:h-11 px-2.5 rounded-controle text-[13px] font-medium text-tinta-suave hover:text-tinta hover:bg-cinza-100 transition-colors duration-150 shrink-0"
                    >
                      Ver <Icone nome="seta" tamanho={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          );
        }}
      </Consulta>
    </Secao>
  );
}

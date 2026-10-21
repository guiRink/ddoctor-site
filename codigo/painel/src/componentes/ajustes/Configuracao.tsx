import type { ConfigOficina } from "@compartilhado/tipos";
import { LIMITES_CONFIG, LIMITES_LARANJA_FRACAO, campoConfigProvisorio, capacidadePecasDia, laranjaFracao } from "@compartilhado/dominio/config";
import { useConfig } from "../../dados/hooks";
import { Provisorio, Semaforo } from "../ui/Estado";
import { Consulta, Dado, NotaProvisoria, Secao } from "./Estrutura";
import { EditorNumeros, type CampoNumero } from "./Numeros";

// Seções de Ajustes ligadas a config_oficina: "Prazos e cores" (expediente só leitura; semáforo editável)
// e "Agenda e capacidade" (entradas por dia, carros ao mesmo tempo, peças por dia). Edita quem tem
// podeEditarConfig; os demais leem. Cada campo salvo ou confirmado deixa de ser provisório.

const plural = (um: string, varios: string) => (n: number) => (n === 1 ? um : varios);

// ------------------------------------------------------------------ Agenda e capacidade

type CampoCapacidade = "vagasEntrada" | "carrosSimultaneos" | "pecasDia";

export function Capacidade({ podeEditar }: { podeEditar: boolean }) {
  const q = useConfig();
  const algum = q.data && (["vagasEntrada", "carrosSimultaneos", "pecasDia"] as const).some((c) => campoConfigProvisorio(q.data!, c));
  return (
    <Secao
      id="agenda"
      titulo="Agenda e capacidade"
      descricao="Quantos carros a oficina aguenta."
      nota={algum ? <NotaProvisoria texto="a confirmar no questionário" /> : undefined}
    >
      <Consulta q={q}>
        {(c: ConfigOficina) => {
          const campos: CampoNumero<CampoCapacidade>[] = [
            {
              chave: "vagasEntrada",
              nome: "Entradas por dia",
              explicacao: "Agenda: vagas de entrada por dia, nas janelas manhã e tarde. A agenda não confirma além disso.",
              unidade: plural("carro", "carros"),
              limites: LIMITES_CONFIG.vagasEntrada,
              valor: c.capacidadePadrao.vagasEntrada,
              provisorio: campoConfigProvisorio(c, "vagasEntrada"),
            },
            {
              chave: "carrosSimultaneos",
              nome: "Carros ao mesmo tempo na oficina",
              explicacao: "Agenda: avisa quando a oficina chega a esse número de carros. Só aviso; não bloqueia.",
              unidade: plural("carro", "carros"),
              limites: LIMITES_CONFIG.carrosSimultaneos,
              valor: c.capacidadePadrao.carrosSimultaneos,
              provisorio: campoConfigProvisorio(c, "carrosSimultaneos"),
            },
            {
              chave: "pecasDia",
              nome: "Peças por dia na produção",
              explicacao: "Geral: linha de capacidade da produção prevista; o que passa dela aparece em vermelho.",
              unidade: plural("peça", "peças"),
              limites: LIMITES_CONFIG.pecasDia,
              valor: capacidadePecasDia(c),
              provisorio: campoConfigProvisorio(c, "pecasDia"),
            },
          ];
          return (
            <EditorNumeros
              id="ajustes-cap"
              campos={campos}
              podeEditar={podeEditar}
              montar={(v) => ({ capacidadePadrao: v })}
              rotuloSalvar="Salvar capacidade"
              mensagemOk="Capacidade salva. A Agenda e a produção prevista do Geral já usam os novos números."
            />
          );
        }}
      </Consulta>
    </Secao>
  );
}

// ------------------------------------------------------------------ Prazos e cores

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function descreverExpediente(c: ConfigOficina): string {
  const { diasSemana, inicio, fim, sabadoFim } = c.expediente;
  const uteis = diasSemana.filter((d) => d >= 1 && d <= 5).sort();
  const partes: string[] = [];
  if (uteis.length) {
    const faixa = uteis.length > 1 && uteis[uteis.length - 1] - uteis[0] === uteis.length - 1 ? `${DIAS[uteis[0]]}–${DIAS[uteis[uteis.length - 1]]}` : uteis.map((d) => DIAS[d]).join(", ");
    partes.push(`${faixa} ${inicio}–${fim}`);
  }
  if (diasSemana.includes(6)) partes.push(`sáb ${inicio}–${sabadoFim ?? fim}`);
  if (diasSemana.includes(0)) partes.push(`dom ${inicio}–${fim}`);
  return partes.join(" · ") || "sem expediente cadastrado";
}

// "laranjaPct": a fração do prazo da etapa em % inteiro (50–95, passo 5); vai para o banco como laranjaFracao.
type CampoSemaforo = "laranjaPct" | "vermelhoBloqueioHoras";

export function PrazosECores({ podeEditar }: { podeEditar: boolean }) {
  const q = useConfig();
  const algum = q.data && (campoConfigProvisorio(q.data, "expediente") || campoConfigProvisorio(q.data, "semaforo"));
  return (
    <Secao
      id="prazos"
      titulo="Prazos e cores"
      descricao="Quando a etapa muda de cor na produção: prazo da etapa e impedimento. A cor do carro fica em Cores dos carros."
      nota={algum ? <NotaProvisoria texto="a confirmar no questionário" /> : undefined}
    >
      <Consulta q={q}>
        {(c: ConfigOficina) => {
          const provisorio = campoConfigProvisorio(c, "semaforo");
          const horasUteis = plural("h útil", "h úteis");
          const campos: CampoNumero<CampoSemaforo>[] = [
            {
              chave: "laranjaPct",
              nome: "Fica laranja com",
              adorno: <Semaforo valor="laranja" texto="Laranja" />,
              explicacao:
                "Parte do prazo da etapa já gasta. Também fica laranja com a entrega hoje, ou com a entrega amanhã quando o trabalho que falta não cabe com folga.",
              unidade: () => "% do prazo",
              limites: { min: Math.round(LIMITES_LARANJA_FRACAO.min * 100), max: Math.round(LIMITES_LARANJA_FRACAO.max * 100) },
              passo: 5,
              valor: Math.round(laranjaFracao(c) * 100),
              provisorio,
            },
            {
              chave: "vermelhoBloqueioHoras",
              nome: "Vermelho por impedimento",
              adorno: <Semaforo valor="vermelho" texto="Vermelho" />,
              explicacao: "Etapa impedida há mais que essas horas úteis fica vermelha. Prazo vencido também fica vermelho.",
              unidade: horasUteis,
              limites: LIMITES_CONFIG.vermelhoBloqueioHoras,
              valor: c.semaforo.vermelhoBloqueioHoras,
              provisorio,
            },
          ];
          return (
            <>
              <dl className="border-b border-linha">
                <Dado nome="Expediente (conta as horas úteis)">
                  {campoConfigProvisorio(c, "expediente") ? <Provisorio>{descreverExpediente(c)}</Provisorio> : descreverExpediente(c)}
                  <span className="block text-[12px] font-normal text-tinta-suave">Sem desconto de almoço.</span>
                </Dado>
              </dl>
              <EditorNumeros
                id="ajustes-sem"
                campos={campos}
                podeEditar={podeEditar}
                montar={({ laranjaPct, vermelhoBloqueioHoras }) => ({
                  semaforo: {
                    ...(laranjaPct !== undefined ? { laranjaFracao: laranjaPct / 100 } : {}),
                    ...(vermelhoBloqueioHoras !== undefined ? { vermelhoBloqueioHoras } : {}),
                  },
                })}
                rotuloSalvar="Salvar cores"
                mensagemOk="Cores salvas. A Produção e a TV já usam os novos limites."
                depois={
                  <p className="flex flex-wrap items-center gap-2 px-5 py-3 border-t border-linha text-[13px] text-tinta-suave">
                    <Semaforo valor="verde" />
                    antes disso, a etapa está no prazo.
                  </p>
                }
              />
            </>
          );
        }}
      </Consulta>
    </Secao>
  );
}

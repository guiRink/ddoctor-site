import { SeletorPeriodo } from "../ui/Periodo";
import { nomeMesCurto, somarMeses } from "./formato";

/** Seletor de mês do relatório (desenho único em ui/Periodo). */
export function SeletorMes({ mes, onMudar, maximo }: { mes: string; onMudar: (m: string) => void; maximo?: string }) {
  return (
    <SeletorPeriodo
      rotulo="Mês do relatório"
      texto={`${nomeMesCurto(mes)} ${mes.slice(0, 4)}`}
      onAnterior={() => onMudar(somarMeses(mes, -1))}
      onProximo={() => onMudar(somarMeses(mes, 1))}
      rotuloAnterior="Mês anterior"
      rotuloProximo="Próximo mês"
      proximoDesabilitado={maximo !== undefined && mes >= maximo}
      atalho={maximo !== undefined && mes < maximo ? { texto: "Mês atual", onClick: () => onMudar(maximo) } : undefined}
    />
  );
}

import type { ReactNode } from "react";
import { Erro, Esqueleto } from "../ui/Basicos";

type Consulta = { isPending: boolean; isError: boolean; refetch: () => unknown };

/** Carregando / erro para várias consultas juntas; quando todas chegam, desenha o conteúdo. */
export function EstadoConsultas({
  consultas,
  linhas = 6,
  esqueleto,
  children,
}: {
  consultas: Consulta[];
  linhas?: number;
  esqueleto?: ReactNode;
  children: () => ReactNode;
}) {
  if (consultas.some((c) => c.isError)) {
    return <Erro onTentar={() => consultas.filter((c) => c.isError).forEach((c) => c.refetch())} />;
  }
  if (consultas.some((c) => c.isPending)) return <>{esqueleto ?? <Esqueleto linhas={linhas} />}</>;
  return <>{children()}</>;
}

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { OSVisao } from "../../dados/repositorio";
import { Botao } from "../ui/Basicos";
import { Placa } from "../ui/Placa";
import { useSessao } from "../../dados/sessao";
import { podeVer } from "../../dominio/permissoes";

/** Placa que abre a ficha da OS; sem OS conhecida mostra um traço. */
export function PlacaOS({ v }: { v?: OSVisao }) {
  const { perfil } = useSessao();
  if (!v) return <span className="text-tinta-fraca">—</span>;
  if (!podeVer(perfil.papel, "orcamentos")) return <Placa placa={v.veiculo.placa} tamanho="p" />;
  return (
    <Link to={`/orcamentos/${v.os.id}`} aria-label={`Placa ${v.veiculo.placa} — abrir ficha da OS ${v.os.numero}`} className="inline-flex no-underline p-2.5 -m-2.5">
      <Placa placa={v.veiculo.placa} tamanho="p" />
    </Link>
  );
}

/** Aviso de ação que ainda não existe: botão desabilitado + quando chega. */
export function AcaoFutura({ texto, quando }: { texto: string; quando: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Botao tamanho="denso" disabled>
        {texto}
      </Botao>
      <span className="text-[12px] text-tinta-fraca whitespace-nowrap">{quando}</span>
    </span>
  );
}

/** Um número da faixa-resumo: rótulo, valor grande e uma frase curta explicando a conta. */
export function Numero({ rotulo, valor, frase, tom }: { rotulo: string; valor: ReactNode; frase: ReactNode; tom?: "alerta" | "ok" }) {
  const cor = tom === "alerta" ? "text-alerta" : tom === "ok" ? "text-ok" : "text-tinta";
  return (
    <div className="min-w-0 bg-cartao px-5 py-4">
      <dt className="rotulo text-tinta-suave">{rotulo}</dt>
      <dd className="m-0">
        <span className={`block mt-1.5 text-[24px] font-bold numero leading-none whitespace-nowrap ${cor}`}>{valor}</span>
        <span className="block mt-2 text-[13px] text-tinta-suave leading-snug">{frase}</span>
      </dd>
    </div>
  );
}

/** Mensagem de retorno de uma ação (erro em alerta, sucesso em ok), anunciada ao leitor de tela. */
export function Retorno({ erro, ok }: { erro?: string; ok?: string }) {
  if (erro)
    return (
      <p role="alert" className="text-[13px] font-semibold text-alerta">
        {erro}
      </p>
    );
  if (ok)
    return (
      <p role="status" className="text-[13px] font-semibold text-ok">
        {ok}
      </p>
    );
  return null;
}

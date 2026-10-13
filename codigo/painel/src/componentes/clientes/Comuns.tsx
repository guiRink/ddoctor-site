import type { ReactNode } from "react";
import type { Veiculo } from "@compartilhado/tipos";
import { BotaoExterno, iniciais } from "../ui/Basicos";
import { Placa } from "../ui/Placa";
import { linkWhatsApp } from "./formato";

/** Avatar redondo com iniciais (sem foto), como o `Responsavel`. */
export function AvatarCliente({ nome, tamanho = 32 }: { nome: string; tamanho?: 32 | 40 | 48 }) {
  const t = { 32: "w-8 h-8 text-[12px]", 40: "w-10 h-10 text-[14px]", 48: "w-12 h-12 text-[16px]" }[tamanho];
  return (
    <span aria-hidden="true" className={`inline-grid place-items-center shrink-0 rounded-full bg-cinza-200 text-tinta font-semibold ${t}`}>
      {iniciais(nome)}
    </span>
  );
}

/** Etiqueta "PJ" discreta ao lado do nome. */
export function EtiquetaPJ() {
  return (
    <span className="inline-flex items-center h-5 px-1.5 rounded-[4px] bg-cinza-100 text-tinta-suave text-[11px] font-semibold leading-none shrink-0">
      <span aria-hidden="true">PJ</span>
      <span className="sr-only">Pessoa jurídica</span>
    </span>
  );
}

/** Botão de WhatsApp (link wa.me em nova aba), no desenho do `Botao` contorno. `icone` = quadrado só com o ícone. */
export function BotaoWhatsApp({
  numero,
  nome,
  icone = false,
  className = "",
}: {
  numero: string;
  nome: string;
  /** true ou "pequeno" = quadrado denso (36 px; 40 no celular), para linha de tabela e cartão. */
  icone?: boolean | "pequeno";
  className?: string;
}) {
  return (
    <BotaoExterno
      href={linkWhatsApp(numero)}
      tamanho={icone ? "denso" : "padrao"}
      icone="whatsapp"
      classeIcone="text-ok"
      rotulo={icone ? `Abrir o WhatsApp de ${nome}` : undefined}
      titulo={icone ? "Abrir no WhatsApp" : undefined}
      onClick={(e) => e.stopPropagation()}
      className={className}
    >
      {!icone && "WhatsApp"}
    </BotaoExterno>
  );
}

/** Até `max` placas e um "+n" para o resto. */
export function PlacasDoCliente({ veiculos, max = 2, vazio }: { veiculos: Veiculo[]; max?: number; vazio?: ReactNode }) {
  if (veiculos.length === 0) return <>{vazio ?? <span className="text-[13px] text-tinta-fraca">Sem veículo</span>}</>;
  const resto = veiculos.length - max;
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      {veiculos.slice(0, max).map((v) => (
        <Placa key={v.id} placa={v.placa} />
      ))}
      {resto > 0 && (
        <span className="inline-flex items-center h-6 px-2 rounded-full bg-cinza-100 text-[12px] font-medium text-tinta-suave numero" title={veiculos.slice(max).map((v) => v.placa).join(", ")}>
          +{resto}
          <span className="sr-only"> {resto === 1 ? "veículo" : "veículos"}</span>
        </span>
      )}
    </span>
  );
}

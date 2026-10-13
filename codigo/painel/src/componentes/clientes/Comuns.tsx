import type { ReactNode } from "react";
import type { Veiculo } from "@compartilhado/tipos";
import { iniciais } from "../ui/Basicos";
import { Placa } from "../ui/Placa";
import { Icone } from "../Icone";
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

// Mesmo desenho do Botao "contorno" (ui/Basicos), para um link externo (<a>), que o Botao não cobre.
const CLASSE_BOTAO_LINK =
  "inline-flex items-center justify-center rounded-controle font-semibold whitespace-nowrap transition-colors duration-150 no-underline bg-cartao text-tinta border border-linha-forte shadow-controle hover:bg-cinza-50 hover:border-tinta-fraca";

/** Botão de WhatsApp (link wa.me em nova aba). `icone` = quadrado só com o ícone. */
export function BotaoWhatsApp({
  numero,
  nome,
  icone = false,
  className = "",
}: {
  numero: string;
  nome: string;
  /** true = quadrado 44/32 px; "pequeno" = 28 px no desktop (dentro de linha de tabela). */
  icone?: boolean | "pequeno";
  className?: string;
}) {
  const quadrado = icone === "pequeno" ? "h-11 w-11 md:h-7 md:w-7" : "h-11 w-11 md:h-8 md:w-8";
  return (
    <a
      href={linkWhatsApp(numero)}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      aria-label={icone ? `Abrir o WhatsApp de ${nome}` : undefined}
      title={icone ? "Abrir no WhatsApp" : undefined}
      className={`${CLASSE_BOTAO_LINK} ${icone ? quadrado : "h-11 md:h-10 px-4 gap-2 text-[14px]"} ${className}`}
    >
      <Icone nome="whatsapp" tamanho={icone === "pequeno" ? 15 : icone ? 16 : 18} className="shrink-0 text-ok" />
      {!icone && "WhatsApp"}
    </a>
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

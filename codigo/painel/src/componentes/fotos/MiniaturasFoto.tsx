import { useState, type ReactNode } from "react";
import { Icone } from "../Icone";

// Peças comuns às telas que mostram foto da OS (captura na produção, galeria da vistoria).
// Formatação (expiração, fonte da miniatura) em ./formato.ts.

/** Placeholder "Foto indisponível" (arquivo apagado, link vencido, aba recarregada no modo privado). */
export function FotoIndisponivel({
  className = "",
  compacto = false,
  cores = "bg-cinza-100 text-tinta-fraca",
}: {
  className?: string;
  compacto?: boolean;
  /** Fundo e texto (a galeria ampliada é escura). */
  cores?: string;
}) {
  return (
    <span role="img" aria-label="Foto indisponível" className={`grid place-items-center text-[12px] font-medium ${cores} ${className}`}>
      <span className="flex flex-col items-center gap-1 text-center px-1">
        <Icone nome="camera" tamanho={compacto ? 16 : 20} />
        {!compacto && "Foto indisponível"}
      </span>
    </span>
  );
}

/** <img> que troca para "Foto indisponível" quando a fonte está vazia ou não carrega. */
export function ImagemFoto({ src, alt, className = "", compacto = false }: { src: string; alt: string; className?: string; compacto?: boolean }) {
  const [falhou, setFalhou] = useState<string | null>(null);
  if (!src || falhou === src) return <FotoIndisponivel className={className} compacto={compacto} />;
  return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFalhou(src)} className={`object-cover bg-cinza-100 ${className}`} />;
}

/**
 * Grade de miniaturas (3 por linha no celular, mais no computador). Cada item é quadrado 4:3 com
 * raio de controle; o "×" fica num alvo de 44 px no canto.
 */
export function GradeMiniaturas({ children, rotulo }: { children: ReactNode; rotulo: string }) {
  return (
    <ul aria-label={rotulo} className="m-0 p-0 list-none grid grid-cols-3 sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
      {children}
    </ul>
  );
}

/** Botão "×" sobre a miniatura. A pastilha é escura em qualquer tema (fica sobre a foto). */
export function BotaoRemoverFoto({ rotulo, onClick, desabilitado = false }: { rotulo: string; onClick: () => void; desabilitado?: boolean }) {
  return (
    <button
      type="button"
      data-tema="claro"
      aria-label={rotulo}
      title={rotulo}
      onClick={onClick}
      disabled={desabilitado}
      className="absolute right-0 top-0 w-11 h-11 grid place-items-center text-papel disabled:opacity-40 group/remover"
    >
      <span className="w-7 h-7 grid place-items-center rounded-full bg-preto/70 group-hover/remover:bg-preto transition-colors duration-150">
        <Icone nome="fechar" tamanho={14} />
      </span>
    </button>
  );
}

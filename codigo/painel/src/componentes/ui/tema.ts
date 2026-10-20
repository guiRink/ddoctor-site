import { useCallback, useEffect, useState } from "react";

/**
 * Tema do painel (docs/painel-design.md "Tema escuro"). A escolha fica no aparelho (`localStorage`
 * `ddoctor.tema`) e é aplicada em `<html data-tema=…>`. O `index.html` aplica a escolha salva antes do
 * primeiro render (sem piscar); aqui ficam a troca e o `theme-color` em "automático".
 */
export type Tema = "claro" | "escuro" | "automatico";

export const CHAVE_TEMA = "ddoctor.tema";
const COR_TOPO = { claro: "#FFFFFF", escuro: "#17181A" } as const;
const CONSULTA_ESCURO = "(prefers-color-scheme: dark)";
/** Avisa os outros seletores da mesma página (barra lateral e menu "Mais"). */
const EVENTO_TEMA = "ddoctor:tema";

export function lerTema(): Tema {
  try {
    const salvo = localStorage.getItem(CHAVE_TEMA);
    if (salvo === "claro" || salvo === "escuro") return salvo;
  } catch {
    // sem localStorage (modo privado restrito): segue o sistema
  }
  return "automatico";
}

function sistemaEscuro(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(CONSULTA_ESCURO).matches;
}

/** Aplica no `<html>` e acerta a cor da barra do navegador do celular. */
export function aplicarTema(tema: Tema) {
  document.documentElement.setAttribute("data-tema", tema);
  const escuro = tema === "escuro" || (tema === "automatico" && sistemaEscuro());
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", escuro ? COR_TOPO.escuro : COR_TOPO.claro);
}

export function salvarTema(tema: Tema) {
  try {
    if (tema === "automatico") localStorage.removeItem(CHAVE_TEMA);
    else localStorage.setItem(CHAVE_TEMA, tema);
  } catch {
    // sem localStorage: vale só nesta aba
  }
  aplicarTema(tema);
  window.dispatchEvent(new CustomEvent<Tema>(EVENTO_TEMA, { detail: tema }));
}

/** Tema escolhido + troca. Em "automático", acompanha a mudança do sistema (a cor do topo). */
export function useTema() {
  const [tema, setTema] = useState<Tema>(lerTema);

  useEffect(() => {
    if (tema !== "automatico" || typeof window.matchMedia !== "function") return;
    const consulta = window.matchMedia(CONSULTA_ESCURO);
    const mudar = () => aplicarTema("automatico");
    consulta.addEventListener("change", mudar);
    return () => consulta.removeEventListener("change", mudar);
  }, [tema]);

  // outro seletor desta página ou outra aba trocou o tema
  useEffect(() => {
    const aoTrocarAqui = (e: Event) => setTema((e as CustomEvent<Tema>).detail);
    const aoGuardar = (e: StorageEvent) => {
      if (e.key !== CHAVE_TEMA && e.key !== null) return;
      const novo = lerTema();
      aplicarTema(novo);
      setTema(novo);
    };
    window.addEventListener(EVENTO_TEMA, aoTrocarAqui);
    window.addEventListener("storage", aoGuardar);
    return () => {
      window.removeEventListener(EVENTO_TEMA, aoTrocarAqui);
      window.removeEventListener("storage", aoGuardar);
    };
  }, []);

  const escolher = useCallback((novo: Tema) => {
    salvarTema(novo);
    setTema(novo);
  }, []);

  return { tema, escolher };
}

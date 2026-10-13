import { useSyncExternalStore } from "react";

/** true quando a media query casa (ex.: "(min-width: 1024px)"). Troca layout sem duplicar o DOM. */
export function useMidia(consulta: string): boolean {
  const temMidia = typeof window !== "undefined" && typeof window.matchMedia === "function";
  return useSyncExternalStore(
    (avisar) => {
      if (!temMidia) return () => {};
      const mq = window.matchMedia(consulta);
      mq.addEventListener("change", avisar);
      return () => mq.removeEventListener("change", avisar);
    },
    () => (temMidia ? window.matchMedia(consulta).matches : true),
    () => true,
  );
}

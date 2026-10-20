import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./estilos.css";
import App from "./App";
import { salvarTema } from "./componentes/ui/tema";

const cliente = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: 1 },
  },
});

// Só em desenvolvimento: `?dev=1` pula o PIN (capturas de tela e testes).
if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("dev") === "1") {
  sessionStorage.setItem("ddoctor.autenticado", "1");
  const papel = new URLSearchParams(window.location.search).get("perfil");
  if (papel) localStorage.setItem("ddoctor.perfil", papel);
}
// Só em desenvolvimento: `?tema=claro|escuro|automatico` fixa o tema (capturas de tela).
if (import.meta.env.DEV) {
  const tema = new URLSearchParams(window.location.search).get("tema");
  if (tema === "claro" || tema === "escuro" || tema === "automatico") salvarTema(tema);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={cliente}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);

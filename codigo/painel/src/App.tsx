import { useEffect, useState } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { gerarDemo } from "./dados/demo";
import { repositorio } from "./dados/repositorioDexie";
import { Layout } from "./componentes/Layout";
import { PinGate } from "./componentes/PinGate";
import { Agenda } from "./telas/Agenda";
import { Ajustes } from "./telas/Ajustes";
import { Atendimentos } from "./telas/Atendimentos";
import { Ficha } from "./telas/Ficha";
import { Financeiro } from "./telas/Financeiro";
import { Patio } from "./telas/Patio";
import { Pendencias } from "./telas/Pendencias";

/** Só em desenvolvimento: `?dev=1` libera o PIN e carrega a demonstração (para capturas e testes). */
function useAtalhoDev(): boolean {
  const ativo = import.meta.env.DEV && new URLSearchParams(window.location.search).get("dev") === "1";
  const [pronto, setPronto] = useState(!ativo);
  useEffect(() => {
    if (!ativo) return;
    sessionStorage.setItem("ddoctor.autenticado", "1");
    repositorio.contarDemo().then(async (n) => {
      if (n === 0) await repositorio.semearDemo(gerarDemo());
      setPronto(true);
    });
  }, [ativo]);
  return pronto;
}

export default function App() {
  const pronto = useAtalhoDev();
  if (!pronto) return null;
  return (
    <PinGate>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/patio" replace />} />
            <Route path="/patio" element={<Patio />} />
            <Route path="/atendimentos" element={<Atendimentos />} />
            <Route path="/atendimentos/novo" element={<Ficha />} />
            <Route path="/atendimentos/:id" element={<Ficha />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/pendencias" element={<Pendencias />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/ajustes" element={<Ajustes />} />
            <Route path="*" element={<Navigate to="/patio" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </PinGate>
  );
}

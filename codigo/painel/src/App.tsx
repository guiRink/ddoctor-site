import type { ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./componentes/Layout";
import { PinGate } from "./componentes/PinGate";
import { Vazio } from "./componentes/ui/Basicos";
import { ProvedorSessao, useSessao } from "./dados/sessao";
import { podeVer, telaInicial, type Modulo } from "./dominio/permissoes";
import { Agenda } from "./telas/Agenda";
import { Ajustes } from "./telas/Ajustes";
import { Estoque } from "./telas/Estoque";
import { FichaOS } from "./telas/FichaOS";
import { Financeiro } from "./telas/Financeiro";
import { Funcionarios } from "./telas/Funcionarios";
import { Geral } from "./telas/Geral";
import { MinhasTarefas } from "./telas/MinhasTarefas";
import { NovoAtendimento } from "./telas/NovoAtendimento";
import { Orcamentos } from "./telas/Orcamentos";
import { Producao } from "./telas/Producao";
import { ProducaoTV } from "./telas/ProducaoTV";
import { Recebiveis } from "./telas/Recebiveis";
import { Vistorias } from "./telas/Vistorias";

/** Barra de acesso por papel na interface (a barreira real é a RLS no S1). */
function Protegida({ modulo, children }: { modulo: Modulo; children: ReactNode }) {
  const { perfil } = useSessao();
  if (!podeVer(perfil.papel, modulo)) {
    return <Vazio icone="bloqueio" titulo="Sem acesso a esta área" texto="O seu papel não usa esta tela. Fale com o dono da oficina se precisar." />;
  }
  return <>{children}</>;
}

function Inicio() {
  const { perfil } = useSessao();
  return <Navigate to={telaInicial(perfil.papel)} replace />;
}

export default function App() {
  return (
    <PinGate>
      <ProvedorSessao>
        <HashRouter>
          <Routes>
            <Route path="/producao/tv" element={<Protegida modulo="tv"><ProducaoTV /></Protegida>} />
            <Route element={<Layout />}>
              <Route index element={<Inicio />} />
              <Route path="/geral" element={<Protegida modulo="geral"><Geral /></Protegida>} />
              <Route path="/orcamentos" element={<Protegida modulo="orcamentos"><Orcamentos /></Protegida>} />
              <Route path="/orcamentos/novo" element={<Protegida modulo="orcamentos"><NovoAtendimento /></Protegida>} />
              <Route path="/orcamentos/:id" element={<Protegida modulo="orcamentos"><FichaOS /></Protegida>} />
              <Route path="/agenda" element={<Protegida modulo="agenda"><Agenda /></Protegida>} />
              <Route path="/producao" element={<Protegida modulo="producao"><Producao /></Protegida>} />
              <Route path="/producao/eu" element={<Protegida modulo="minhas_tarefas"><MinhasTarefas /></Protegida>} />
              <Route path="/vistorias" element={<Protegida modulo="vistorias"><Vistorias /></Protegida>} />
              <Route path="/funcionarios" element={<Protegida modulo="funcionarios"><Funcionarios /></Protegida>} />
              <Route path="/estoque" element={<Protegida modulo="estoque"><Estoque /></Protegida>} />
              <Route path="/recebiveis" element={<Protegida modulo="recebiveis"><Recebiveis /></Protegida>} />
              <Route path="/financeiro" element={<Protegida modulo="financeiro"><Financeiro /></Protegida>} />
              <Route path="/ajustes" element={<Protegida modulo="ajustes"><Ajustes /></Protegida>} />
              <Route path="*" element={<Inicio />} />
            </Route>
          </Routes>
        </HashRouter>
      </ProvedorSessao>
    </PinGate>
  );
}

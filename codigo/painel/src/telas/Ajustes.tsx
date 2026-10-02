import { useState, type FormEvent } from "react";
import { gerarDemo } from "../dados/demo";
import { useContagemDemo } from "../dados/hooks";
import { repositorio } from "../dados/repositorioDexie";
import { Botao } from "../componentes/Botao";
import { Cabecalho } from "../componentes/Pagina";
import { definirPin, pinAtual } from "../componentes/PinGate";

export function Ajustes() {
  const demo = useContagemDemo();
  const [aviso, setAviso] = useState("");
  const [pinNovo, setPinNovo] = useState("");
  const [pinConfirma, setPinConfirma] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function carregarDemo() {
    setOcupado(true);
    await repositorio.semearDemo(gerarDemo());
    setOcupado(false);
    setAviso("Dados de demonstração carregados. Todos ficam marcados como “demo”.");
  }

  async function limparDemo() {
    if (!window.confirm("Remover todos os atendimentos de demonstração? Os dados reais não são afetados.")) return;
    setOcupado(true);
    await repositorio.limparDemo();
    setOcupado(false);
    setAviso("Demonstração removida.");
  }

  function trocarPin(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{4,8}$/.test(pinNovo)) {
      setAviso("O PIN precisa ter de 4 a 8 números.");
      return;
    }
    if (pinNovo !== pinConfirma) {
      setAviso("Os dois PINs não conferem.");
      return;
    }
    definirPin(pinNovo);
    setPinNovo("");
    setPinConfirma("");
    setAviso("PIN atualizado neste navegador.");
  }

  return (
    <>
      <Cabecalho titulo="Ajustes" />
      {aviso && (
        <p role="status" className="mb-6 border border-preto bg-amarelo text-preto px-4 py-3 text-sm font-bold">
          {aviso}
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-6 max-w-5xl">
        <section className="bg-white border border-linha p-4">
          <h2 className="titulo-condensado text-xl">Dados de demonstração</h2>
          <p className="mt-2 text-sm text-tinta-suave leading-relaxed">
            Doze atendimentos fictícios (placas, nomes e valores inventados; seguradoras reais com produto Maxpar) para avaliar as telas. {demo === undefined ? "" : demo > 0 ? `Hoje há ${demo} registro(s) demo.` : "Nenhum registro demo carregado."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Botao onClick={carregarDemo} disabled={ocupado}>
              {demo && demo > 0 ? "Recarregar demonstração" : "Carregar demonstração"}
            </Botao>
            <Botao variante="perigo" onClick={limparDemo} disabled={ocupado || !demo}>
              Limpar demonstração
            </Botao>
          </div>
        </section>

        <section className="bg-white border border-linha p-4">
          <h2 className="titulo-condensado text-xl">PIN de acesso</h2>
          <p className="mt-2 text-sm text-tinta-suave leading-relaxed">
            Trava provisória deste navegador (padrão {pinAtual() === "3316" ? "3316" : "personalizado"}). Não substitui login; o acesso com usuário e senha chega com o banco na nuvem.
          </p>
          <form onSubmit={trocarPin} className="mt-4 grid gap-3 max-w-xs">
            <label className="grid gap-1 text-sm font-bold">
              Novo PIN
              <input type="password" inputMode="numeric" value={pinNovo} onChange={(e) => setPinNovo(e.target.value)} className="min-h-11 px-3 border border-linha focus:border-preto outline-none bg-papel" />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Confirmar PIN
              <input type="password" inputMode="numeric" value={pinConfirma} onChange={(e) => setPinConfirma(e.target.value)} className="min-h-11 px-3 border border-linha focus:border-preto outline-none bg-papel" />
            </label>
            <Botao type="submit" variante="secundario">
              Trocar PIN
            </Botao>
          </form>
        </section>

        <section className="bg-white border border-linha p-4 md:col-span-2">
          <h2 className="titulo-condensado text-xl">Onde os dados ficam</h2>
          <p className="mt-2 text-sm text-tinta-suave leading-relaxed max-w-prose">
            Por enquanto os dados ficam guardados neste navegador (IndexedDB). Servem para avaliação e uso num único computador. No Sprint 4 o painel passa para um banco na nuvem, com login e acesso pelo celular e pelo PC da recepção ao mesmo tempo.
          </p>
        </section>
      </div>
    </>
  );
}

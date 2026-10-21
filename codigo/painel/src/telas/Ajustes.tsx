import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { Pagador, Perfil } from "@compartilhado/tipos";
import { useAcoes, usePagadores } from "../dados/hooks";
import { useSessao } from "../dados/sessao";
import { podeCriarTipoReparo, podeEditarConfig, podeEditar as podeEditarModulo } from "../dominio/permissoes";
import { PAPEL } from "../dominio/rotulos";
import { definirPin, sairDaSessao } from "../componentes/PinGate";
import { Botao, CabecalhoPagina, Responsavel, Vazio } from "../componentes/ui/Basicos";
import { Etiqueta, Provisorio } from "../componentes/ui/Estado";
import { Retorno } from "../componentes/gestao/Comuns";
import { CLASSE_CAMPO, TIPO_PAGADOR, descreverPrazo } from "../componentes/gestao/formato";
import { Consulta, ListaSecoes, NavLateral, NotaProvisoria, Secao, type SecaoAjustes } from "../componentes/ajustes/Estrutura";
import { TiposServico } from "../componentes/ajustes/TiposServico";
import { Capacidade, PrazosECores } from "../componentes/ajustes/Configuracao";
import { Categorias } from "../componentes/ajustes/Categorias";
import { Checklist } from "../componentes/ajustes/Checklist";
import { Auditoria } from "../componentes/ajustes/Auditoria";
import { AConfirmar } from "../componentes/ajustes/AConfirmar";
import { CoresCarros } from "../componentes/ajustes/CoresCarros";

const SECOES: SecaoAjustes[] = [
  { id: "confirmar", nome: "A confirmar", grupo: "Oficina" },
  { id: "tipos", nome: "Tipos de serviço", grupo: "Oficina" },
  { id: "cores", nome: "Cores dos carros", grupo: "Oficina" },
  { id: "prazos", nome: "Prazos e cores", grupo: "Oficina" },
  { id: "agenda", nome: "Agenda e capacidade", grupo: "Oficina" },
  { id: "checklist", nome: "Checklist de entrada", grupo: "Oficina" },
  { id: "pagadores", nome: "Pagadores e prazos", grupo: "Financeiro" },
  { id: "categorias", nome: "Categorias financeiras", grupo: "Financeiro" },
  { id: "pessoas", nome: "Pessoas e papéis", grupo: "Pessoas e acesso" },
  { id: "acesso", nome: "Acesso", grupo: "Pessoas e acesso" },
  { id: "auditoria", nome: "Auditoria", grupo: "Sistema" },
  { id: "demo", nome: "Demonstração", grupo: "Sistema" },
];

/**
 * Ajustes (design §5): como o painel está configurado. Seções agrupadas com navegação lateral em 1366+
 * e lista no celular. Editáveis hoje: tipos de serviço, cores dos carros (pedido do dono, 2º áudio), semáforo, capacidade da agenda, checklist, categorias
 * financeiras, PIN e demonstração; expediente e pagadores são leitura. Todo valor provisório aparece marcado.
 * Módulo só de dono e gestor (arq. §9.1); a barreira real é a RLS.
 */
export function Ajustes() {
  const { perfil, perfis } = useSessao();
  const editar = podeEditarModulo(perfil.papel, "ajustes");
  const editarConfig = podeEditarConfig(perfil.papel);
  return (
    <>
      <CabecalhoPagina titulo="Ajustes" />
      <div className="lg:grid lg:grid-cols-[208px_minmax(0,1fr)] lg:gap-10 items-start">
        <NavLateral secoes={SECOES} />
        <ListaSecoes secoes={SECOES} />
        <div className="flex flex-col gap-6 min-w-0 max-w-[960px]">
          <AConfirmar />
          <TiposServico podeEditar={podeCriarTipoReparo(perfil.papel)} />
          <CoresCarros podeEditar={editarConfig} />
          <PrazosECores podeEditar={editarConfig} />
          <Capacidade podeEditar={editarConfig} />
          <Checklist podeEditar={editar} />
          <Pagadores />
          <Categorias podeEditar={editar} />
          <Pessoas />
          <Acesso />
          <Auditoria perfis={perfis} />
          <Demonstracao />
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ seções

function Pagadores() {
  const q = usePagadores();
  return (
    <Secao id="pagadores" titulo="Pagadores e prazos" descricao="Em quanto tempo cada um paga; define o vencimento." nota={<NotaProvisoria texto="prazos a confirmar com a oficina" />}>
      <Consulta q={q}>
        {(pagadores: Pagador[]) =>
          pagadores.length === 0 ? (
            <Vazio titulo="Nenhum pagador cadastrado" texto="Maxpar, cliente e seguradoras entram com o prazo de pagamento de cada um." />
          ) : (
            <ul>
              {pagadores.map((p) => (
                <li key={p.id} className="grid grid-cols-1 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)] gap-x-6 gap-y-1 px-5 py-3.5 border-b border-linha last:border-b-0">
                  <span>
                    <span className="block font-medium">{p.nome}</span>
                    <span className="block text-[12px] text-tinta-suave">{TIPO_PAGADOR[p.tipo]}</span>
                  </span>
                  <span className="self-center text-[14px]">
                    Vence {p.prazo.provisorio ? <Provisorio>{descreverPrazo(p)}</Provisorio> : descreverPrazo(p)}
                    {p.descontaFranquia === false && <span className="block text-[12px] text-tinta-suave">Não desconta a franquia da mão de obra.</span>}
                  </span>
                </li>
              ))}
            </ul>
          )
        }
      </Consulta>
    </Secao>
  );
}

function Pessoas() {
  const { perfil, perfis, trocarPerfil } = useSessao();
  const navegar = useNavigate();
  const ativos = perfis.filter((p) => p.ativo);
  return (
    <Secao id="pessoas" titulo="Pessoas e papéis" descricao="Quem usa o painel e o que cada papel enxerga." nota="Cadastro e login individual chegam em breve">
      <div className="px-5 py-4 border-b border-linha bg-cinza-50">
        <label htmlFor="ajustes-ver-como" className="block text-[13px] font-medium text-tinta-suave mb-1.5">
          Ver o painel como
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <select
            id="ajustes-ver-como"
            value={perfil.id}
            onChange={(e) => {
              trocarPerfil(e.target.value);
              navegar("/");
            }}
            className={`${CLASSE_CAMPO} max-w-sm font-medium`}
          >
            {perfis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} · {PAPEL[p.papel]}
              </option>
            ))}
          </select>
          <span className="text-[12px] text-tinta-suave max-w-[48ch]">
            Só na demonstração: mostra o que cada pessoa enxerga. Com o login individual, cada um entra com a própria conta.
          </span>
        </div>
      </div>
      {ativos.length === 0 ? (
        <Vazio titulo="Nenhuma pessoa cadastrada" texto="O cadastro de pessoas chega com o login individual." />
      ) : (
        <ul>
          {ativos.map((p: Perfil) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-2.5 min-h-14 border-b border-linha last:border-b-0">
              <span className="min-w-0">
                <Responsavel nome={p.nome} />
                {p.funcao && <span className="block pl-9 text-[12px] text-tinta-suave">{p.funcao}</span>}
              </span>
              <span className="flex items-center gap-3">
                {p.papel === "producao" && <span className="text-[12px] text-tinta-suave">{p.usaTerminal ? "Terminal" : "Celular próprio"}</span>}
                <Etiqueta tom={p.id === perfil.id ? "escuro" : "neutro"}>{PAPEL[p.papel]}</Etiqueta>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}

function Acesso() {
  const { perfil } = useSessao();
  const [novo, setNovo] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string>();
  const [ok, setOk] = useState<string>();
  const podeTrocarPin = perfil.papel === "dono";

  function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(undefined);
    setOk(undefined);
    if (!/^\d{4,6}$/.test(novo)) return setErro("O PIN precisa ter de 4 a 6 números.");
    if (novo !== confirma) return setErro("Os dois PINs não são iguais.");
    try {
      definirPin(novo);
      setNovo("");
      setConfirma("");
      setOk("PIN trocado. Vale para a próxima entrada neste navegador.");
    } catch {
      setErro("Não consegui salvar o PIN neste navegador.");
    }
  }

  return (
    <Secao id="acesso" titulo="Acesso" descricao="Entrada no painel neste navegador." nota="PIN provisório; o login individual chega em breve">
      {podeTrocarPin && (
        <form onSubmit={salvar} className="px-5 py-4 border-b border-linha" aria-labelledby="ajustes-pin-titulo">
          <h3 id="ajustes-pin-titulo" className="text-[14px] font-semibold">
            Trocar o PIN de entrada
          </h3>
          <p className="mt-1 text-[13px] text-tinta-suave max-w-[70ch]">Fica só neste navegador; evita abrir o painel por engano.</p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5" htmlFor="ajustes-pin-novo">
              <span className="text-[13px] font-medium text-tinta-suave">Novo PIN</span>
              <input
                id="ajustes-pin-novo"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={novo}
                onChange={(e) => setNovo(e.target.value.replace(/\D/g, ""))}
                className={`${CLASSE_CAMPO} w-40 tracking-[0.3em]`}
              />
            </label>
            <label className="flex flex-col gap-1.5" htmlFor="ajustes-pin-confirma">
              <span className="text-[13px] font-medium text-tinta-suave">Repita o PIN</span>
              <input
                id="ajustes-pin-confirma"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={confirma}
                onChange={(e) => setConfirma(e.target.value.replace(/\D/g, ""))}
                className={`${CLASSE_CAMPO} w-40 tracking-[0.3em]`}
              />
            </label>
            <Botao type="submit" variante="secundario" tamanho="denso" className="max-md:h-11">
              Trocar PIN
            </Botao>
          </div>
          <div className="mt-2">
            <Retorno erro={erro} ok={ok} />
          </div>
        </form>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <p className="text-[13px] text-tinta-suave">Para entrar de novo, o painel pede o PIN.</p>
        <Botao
          variante="contorno"
          icone="sair"
          onClick={() => {
            sairDaSessao();
            window.location.reload();
          }}
        >
          Sair
        </Botao>
      </div>
    </Secao>
  );
}

function Demonstracao() {
  const acoes = useAcoes();
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string>();
  const [ok, setOk] = useState<string>();

  async function restaurar() {
    setErro(undefined);
    setOk(undefined);
    try {
      await acoes.restaurarDemo.mutateAsync([]);
      setConfirmando(false);
      setOk("Demonstração restaurada: os dados voltaram ao início.");
    } catch {
      setErro("Não consegui restaurar a demonstração. Tente de novo.");
    }
  }

  return (
    <Secao id="demo" titulo="Demonstração" nota={<Etiqueta tom="atencao">Dados fictícios</Etiqueta>}>
      <div className="px-5 py-4">
        <p className="max-w-[75ch]">
          Carros, clientes, valores e pessoas são <strong>fictícios</strong> e ficam só neste navegador. Restaurar volta tudo ao ponto de partida.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!confirmando ? (
            <Botao variante="contorno" onClick={() => setConfirmando(true)}>
              Restaurar demonstração
            </Botao>
          ) : (
            <>
              <Botao variante="perigo" onClick={restaurar} disabled={acoes.restaurarDemo.isPending}>
                {acoes.restaurarDemo.isPending ? "Restaurando…" : "Sim, apagar e restaurar"}
              </Botao>
              <Botao variante="fantasma" onClick={() => setConfirmando(false)}>
                Cancelar
              </Botao>
            </>
          )}
          <Retorno erro={erro} ok={ok} />
        </div>
      </div>
    </Secao>
  );
}

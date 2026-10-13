import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { ConfigOficina, Pagador, Perfil, TipoReparo } from "@compartilhado/tipos";
import { useAcoes, useConfig, usePagadores, useTiposReparo } from "../dados/hooks";
import { useSessao } from "../dados/sessao";
import { PAPEL } from "../dominio/rotulos";
import { definirPin, sairDaSessao } from "../componentes/PinGate";
import { Botao, CabecalhoPagina, Erro, Esqueleto, Responsavel, Vazio } from "../componentes/ui/Basicos";
import { Etiqueta, Provisorio, Semaforo } from "../componentes/ui/Estado";
import { Retorno } from "../componentes/gestao/Comuns";
import { Linha, Tabela, Td, Th } from "../componentes/gestao/Tabela";
import { CLASSE_CAMPO, TIPO_PAGADOR, descreverPrazo } from "../componentes/gestao/formato";

const SECOES = [
  { id: "tipos", nome: "Tipos de reparo e etapas" },
  { id: "prazos", nome: "Prazos e cores" },
  { id: "agenda", nome: "Agenda" },
  { id: "pagadores", nome: "Pagadores e prazos" },
  { id: "pessoas", nome: "Pessoas e papéis" },
  { id: "acesso", nome: "Acesso" },
  { id: "demo", nome: "Demonstração" },
] as const;

export function Ajustes() {
  return (
    <>
      <CabecalhoPagina
        titulo="Ajustes"
        resumo="Como o painel está configurado hoje. Por enquanto é só leitura. A edição chega por partes: primeiro pessoas e login, depois tipos de reparo, prazos e agenda, e por fim pagadores."
      />
      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-8 items-start">
        <nav aria-label="Seções de Ajustes" className="hidden lg:block sticky top-24">
          <ul className="flex flex-col border-l border-linha">
            {SECOES.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => document.getElementById(`ajustes-${s.id}`)?.scrollIntoView({ block: "start" })}
                  className="w-full text-left h-9 pl-4 -ml-px border-l-2 border-transparent text-[13px] font-semibold text-tinta-suave hover:text-tinta hover:border-preto transition-colors duration-150"
                >
                  {s.nome}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-col gap-6 min-w-0">
          <TiposReparo />
          <PrazosECores />
          <Agenda />
          <Pagadores />
          <Pessoas />
          <Acesso />
          <Demonstracao />
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ estrutura de seção

function Secao({ id, titulo, nota, children }: { id: string; titulo: string; nota?: ReactNode; children: ReactNode }) {
  return (
    <section id={`ajustes-${id}`} aria-labelledby={`ajustes-${id}-titulo`} className="bg-cartao border border-linha scroll-mt-24">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 border-b border-linha min-h-12">
        <h2 id={`ajustes-${id}-titulo`} className="text-[16px] font-bold">
          {titulo}
        </h2>
        {nota && <span className="text-[12px] text-tinta-suave">{nota}</span>}
      </header>
      {children}
    </section>
  );
}

function NotaProvisoria({ texto = "a confirmar no questionário" }: { texto?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Etiqueta tom="atencao">Provisório</Etiqueta>
      <span>{texto}</span>
    </span>
  );
}

function Consulta<T>({
  q,
  children,
}: {
  q: { data: T | undefined; isPending: boolean; isError: boolean; refetch: () => unknown };
  children: (d: T) => ReactNode;
}) {
  if (q.isPending)
    return (
      <div className="p-4">
        <Esqueleto linhas={3} altura="h-9" />
      </div>
    );
  if (q.isError || q.data === undefined)
    return (
      <div className="p-4">
        <Erro onTentar={() => q.refetch()} />
      </div>
    );
  return <>{children(q.data)}</>;
}

function Dado({ nome, children }: { nome: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)] gap-x-4 gap-y-0.5 px-4 py-3 border-b border-linha last:border-b-0">
      <dt className="text-[13px] text-tinta-suave">{nome}</dt>
      <dd className="m-0 font-semibold numero">{children}</dd>
    </div>
  );
}

const simNao = (v: boolean) => (v ? "Sim" : <span className="text-tinta-fraca">Não</span>);

// ------------------------------------------------------------------ seções

function TiposReparo() {
  const q = useTiposReparo();
  return (
    <Secao id="tipos" titulo="Tipos de reparo e etapas" nota={<NotaProvisoria />}>
      <Consulta q={q}>
        {(tipos: TipoReparo[]) =>
          tipos.length === 0 ? (
            <Vazio titulo="Nenhum tipo de reparo" texto="Os tipos e suas etapas vêm do questionário do dono." />
          ) : (
            <div className="flex flex-col gap-4 p-4">
              {tipos.map((t) => (
                <div key={t.id} className="min-w-0">
                  <h3 className="flex items-center gap-2 mb-2 font-bold">
                    {t.nome}
                    <span className="text-[12px] font-normal text-tinta-suave numero">
                      {t.etapas.length} {t.etapas.length === 1 ? "etapa" : "etapas"} · {t.etapas.reduce((s, e) => s + e.prazoPadraoHoras, 0)} h no total
                    </span>
                    {t.provisorio && <span className="sr-only">(provisório)</span>}
                  </h3>
                  <Tabela legenda={`Etapas de ${t.nome}`} fixa className="hidden md:block">
                    <thead>
                      <tr>
                        <Th className="w-12">#</Th>
                        <Th className="w-[40%]">Etapa</Th>
                        <Th direita className="w-32">Prazo padrão</Th>
                        <Th className="pl-6">Pode pular</Th>
                        <Th>Exige foto</Th>
                        <Th>Conta peças</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...t.etapas]
                        .sort((a, b) => a.ordem - b.ordem)
                        .map((e) => (
                          <Linha key={e.ordem}>
                            <Td numero className="text-tinta-suave text-left!">
                              {e.ordem}
                            </Td>
                            <Td className="font-semibold">{e.nome}</Td>
                            <Td numero>{t.provisorio ? <Provisorio>{e.prazoPadraoHoras} h</Provisorio> : `${e.prazoPadraoHoras} h`}</Td>
                            <Td className="pl-6">{simNao(e.dispensavel)}</Td>
                            <Td>{simNao(e.exigeFoto)}</Td>
                            <Td>{simNao(e.exigeContagemPecas)}</Td>
                          </Linha>
                        ))}
                    </tbody>
                  </Tabela>
                  <ol className="md:hidden border border-linha" aria-label={`Etapas de ${t.nome}`}>
                    {[...t.etapas]
                      .sort((a, b) => a.ordem - b.ordem)
                      .map((e) => (
                        <li key={e.ordem} className="flex items-start gap-3 px-3 py-2.5 border-b border-linha last:border-b-0">
                          <span className="numero text-tinta-suave w-4 shrink-0">{e.ordem}</span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-3">
                              <span className="font-semibold">{e.nome}</span>
                              <span className="numero">{t.provisorio ? <Provisorio>{e.prazoPadraoHoras} h</Provisorio> : `${e.prazoPadraoHoras} h`}</span>
                            </span>
                            <span className="block text-[12px] text-tinta-suave">
                              {[e.dispensavel && "pode pular", e.exigeFoto && "exige foto", e.exigeContagemPecas && "conta peças"].filter(Boolean).join(" · ") ||
                                "obrigatória, sem foto nem contagem"}
                            </span>
                          </span>
                        </li>
                      ))}
                  </ol>
                </div>
              ))}
            </div>
          )
        }
      </Consulta>
    </Secao>
  );
}

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function descreverExpediente(c: ConfigOficina): string {
  const { diasSemana, inicio, fim, sabadoFim } = c.expediente;
  const uteis = diasSemana.filter((d) => d >= 1 && d <= 5).sort();
  const partes: string[] = [];
  if (uteis.length) {
    const faixa = uteis.length > 1 && uteis[uteis.length - 1] - uteis[0] === uteis.length - 1 ? `${DIAS[uteis[0]]}–${DIAS[uteis[uteis.length - 1]]}` : uteis.map((d) => DIAS[d]).join(", ");
    partes.push(`${faixa} ${inicio}–${fim}`);
  }
  if (diasSemana.includes(6)) partes.push(`sáb ${inicio}–${sabadoFim ?? fim}`);
  if (diasSemana.includes(0)) partes.push(`dom ${inicio}–${fim}`);
  return partes.join(" · ") || "sem expediente cadastrado";
}

function PrazosECores() {
  const q = useConfig();
  return (
    <Secao id="prazos" titulo="Prazos e cores" nota={<NotaProvisoria />}>
      <Consulta q={q}>
        {(c: ConfigOficina) => (
          <dl>
            <Dado nome="Expediente (conta as horas úteis)">
              <Provisorio>{descreverExpediente(c)}</Provisorio>
              <span className="block text-[12px] font-normal text-tinta-suave">Sem desconto de almoço.</span>
            </Dado>
            <Dado nome="Quando fica laranja">
              <span className="flex flex-wrap items-center gap-2">
                <Semaforo valor="laranja" />
                <span>
                  a <Provisorio>{c.semaforo.laranjaAntesHoras} h úteis</Provisorio> do prazo da etapa
                </span>
              </span>
            </Dado>
            <Dado nome="Quando fica vermelho">
              <span className="flex flex-wrap items-center gap-2">
                <Semaforo valor="vermelho" />
                <span>
                  prazo vencido, ou impedimento há mais de <Provisorio>{c.semaforo.vermelhoBloqueioHoras} h úteis</Provisorio>
                </span>
              </span>
            </Dado>
            <Dado nome="No prazo">
              <span className="flex flex-wrap items-center gap-2">
                <Semaforo valor="verde" />
                <span className="font-normal text-tinta-suave">antes disso</span>
              </span>
            </Dado>
          </dl>
        )}
      </Consulta>
    </Secao>
  );
}

function Agenda() {
  const q = useConfig();
  return (
    <Secao id="agenda" titulo="Agenda" nota={<NotaProvisoria />}>
      <Consulta q={q}>
        {(c: ConfigOficina) => (
          <dl>
            <Dado nome="Entradas por dia (vagas)">
              <Provisorio>{c.capacidadePadrao.vagasEntrada} carros</Provisorio>
              <span className="block text-[12px] font-normal text-tinta-suave">Janelas manhã e tarde. A agenda não confirma além disso.</span>
            </Dado>
            <Dado nome="Carros ao mesmo tempo na oficina">
              <Provisorio>{c.capacidadePadrao.carrosSimultaneos} carros</Provisorio>
              <span className="block text-[12px] font-normal text-tinta-suave">Só aviso; não bloqueia.</span>
            </Dado>
          </dl>
        )}
      </Consulta>
    </Secao>
  );
}

function Pagadores() {
  const q = usePagadores();
  return (
    <Secao id="pagadores" titulo="Pagadores e prazos" nota={<NotaProvisoria texto="prazos a confirmar com a oficina" />}>
      <Consulta q={q}>
        {(pagadores: Pagador[]) =>
          pagadores.length === 0 ? (
            <Vazio titulo="Nenhum pagador cadastrado" texto="Maxpar, cliente e seguradoras entram com o prazo de pagamento de cada um." />
          ) : (
            <ul>
              {pagadores.map((p) => (
                <li key={p.id} className="grid grid-cols-1 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)] gap-x-4 gap-y-0.5 px-4 py-3 border-b border-linha last:border-b-0">
                  <span>
                    <span className="block font-semibold">{p.nome}</span>
                    <span className="block text-[12px] text-tinta-suave">{TIPO_PAGADOR[p.tipo]}</span>
                  </span>
                  <span className="self-center">
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
    <Secao id="pessoas" titulo="Pessoas e papéis" nota="Cadastro e login individual chegam em breve">
      <div className="px-4 py-4 border-b border-linha bg-papel">
        <label htmlFor="ajustes-ver-como" className="block text-[13px] font-semibold mb-1.5">
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
            className={`${CLASSE_CAMPO} md:h-11 max-w-sm font-semibold`}
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
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 min-h-14 border-b border-linha last:border-b-0">
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
    <Secao id="acesso" titulo="Acesso" nota="PIN provisório; o login individual chega em breve">
      {podeTrocarPin && (
        <form onSubmit={salvar} className="px-4 py-4 border-b border-linha" aria-labelledby="ajustes-pin-titulo">
          <h3 id="ajustes-pin-titulo" className="font-semibold">
            Trocar o PIN de entrada
          </h3>
          <p className="mt-1 text-[13px] text-tinta-suave max-w-[70ch]">
            O PIN fica guardado só neste navegador e não é segurança de verdade: evita que alguém abra o painel por engano.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1" htmlFor="ajustes-pin-novo">
              <span className="text-[13px] font-semibold">Novo PIN</span>
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
            <label className="flex flex-col gap-1" htmlFor="ajustes-pin-confirma">
              <span className="text-[13px] font-semibold">Repita o PIN</span>
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
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
        <p className="text-[13px] text-tinta-suave">Sair fecha o painel neste navegador; para entrar de novo, pede o PIN.</p>
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
    <Secao id="demo" titulo="Demonstração">
      <div className="px-4 py-4">
        <p className="max-w-[75ch]">
          Os carros, clientes, valores e pessoas que aparecem no painel são <strong>fictícios</strong>, criados para mostrar como as telas funcionam.
          Eles ficam só neste navegador; nada sai daqui para a Maxpar, para as seguradoras ou para outro lugar.
        </p>
        <p className="mt-2 text-[13px] text-tinta-suave max-w-[75ch]">
          Restaurar apaga o que foi mexido aqui (recebimentos, etapas, agendamentos) e volta tudo ao ponto de partida.
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

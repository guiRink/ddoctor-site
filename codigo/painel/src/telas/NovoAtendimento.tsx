import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { OrigemOS, Tecnica } from "@compartilhado/tipos";
import { TECNICAS } from "@compartilhado/tipos";
import { reaisParaCentavos } from "@compartilhado/dominio/dinheiro";
import { normalizarPlaca, placaValida } from "@compartilhado/dominio/placa";
import { mensagemErro, useAcoes, useOSs } from "../dados/hooks";
import type { NovoAtendimentoRapido } from "../dados/repositorio";
import { useSessao } from "../dados/sessao";
import { podeEditar } from "../dominio/permissoes";
import { ERRO, ORIGEM_OS, TECNICA } from "../dominio/rotulos";
import { Botao, CabecalhoPagina, Cartao, Vazio } from "../componentes/ui/Basicos";
import { Placa } from "../componentes/ui/Placa";
import { Icone } from "../componentes/Icone";

/**
 * Novo atendimento — entrada rápida (meta: 30 segundos; informações §2.1 A1, §2.2 B1, §2.3 C1).
 * Uma coluna, na ordem em que a recepção lê o portal ou ouve o cliente. Erros por campo, em pt-BR.
 */
type Origem = Exclude<OrigemOS, "misto">;
const ORIGENS: Origem[] = ["maxpar", "seguradora_direta", "particular"];
const OUTRA = "__outra";

// Sugestões de peça (lista inicial provisória — docs/painel-informacoes.md §5); o campo aceita qualquer texto.
const PECAS_SUGERIDAS = [
  "Para-choque dianteiro",
  "Para-choque traseiro",
  "Capô",
  "Teto",
  "Tampa traseira",
  "Para-lama dianteiro esquerdo",
  "Para-lama dianteiro direito",
  "Para-lama traseiro esquerdo",
  "Para-lama traseiro direito",
  "Porta dianteira esquerda",
  "Porta dianteira direita",
  "Porta traseira esquerda",
  "Porta traseira direita",
  "Coluna",
  "Retrovisor",
  "Soleira",
];

interface LinhaPeca {
  chave: number;
  peca: string;
  tecnica: Tecnica;
  valor: string;
}

type Erros = Partial<Record<string, string>>;

const CAMPO =
  "w-full h-11 px-3 bg-cartao border border-linha-forte outline-none focus:border-preto placeholder:text-tinta-fraca aria-[invalid=true]:border-alerta";

export function NovoAtendimento() {
  const { perfil } = useSessao();
  const navegar = useNavigate();
  const acoes = useAcoes();
  const oss = useOSs();
  const proximaChave = useRef(2);

  const [origem, setOrigem] = useState<Origem>("maxpar");
  const [seguradora, setSeguradora] = useState("");
  const [seguradoraOutra, setSeguradoraOutra] = useState("");
  const [protocolo, setProtocolo] = useState("");
  const [placa, setPlaca] = useState("");
  const [modelo, setModelo] = useState("");
  const [cor, setCor] = useState("");
  const [cliente, setCliente] = useState("");
  const [telefone, setTelefone] = useState("");
  const [pecas, setPecas] = useState<LinhaPeca[]>([{ chave: 1, peca: "", tecnica: "martelinho", valor: "" }]);
  const [observacoes, setObservacoes] = useState("");
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState("");

  // Seguradoras já vistas nos atendimentos (no demo, as com produto Maxpar público) + "Outra".
  const seguradoras = useMemo(() => {
    const nomes = new Set((oss.data ?? []).flatMap((v) => v.atendimentos.map((a) => a.seguradora)));
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [oss.data]);

  if (!podeEditar(perfil.papel, "orcamentos")) {
    return (
      <>
        <CabecalhoPagina titulo="Novo atendimento" />
        <Cartao>
          <Vazio icone="bloqueio" titulo="Seu papel não registra atendimentos" texto="Peça à recepção para registrar o carro." />
        </Cartao>
      </>
    );
  }

  const externo = origem !== "particular";
  const placaNorm = normalizarPlaca(placa);
  const enviando = acoes.criarAtendimentoRapido.isPending;

  function validar(): { erros: Erros; dados?: NovoAtendimentoRapido } {
    const e: Erros = {};
    const nomeSeguradora = seguradora === OUTRA ? seguradoraOutra.trim() : seguradora;
    if (externo && !nomeSeguradora) e[seguradora === OUTRA ? "seguradoraOutra" : "seguradora"] = "Escolha a seguradora.";
    if (externo && !protocolo.trim()) e.protocolo = "Informe o protocolo do atendimento.";
    if (!placaValida(placa)) e.placa = ERRO.placa_invalida;
    if (!modelo.trim()) e.modelo = "Informe o modelo do carro.";
    if (cliente.trim().length < 3) e.cliente = "Informe o nome do cliente.";
    const tel = normalizarTelefone(telefone);
    if (telefone.trim() && !tel) e.telefone = "Telefone incompleto. Use DDD e número, ex.: (41) 99999-0000.";

    const itens: NovoAtendimentoRapido["pecas"] = [];
    pecas.forEach((p) => {
      const temValor = p.valor.trim() !== "";
      if (!p.peca.trim()) {
        if (temValor) e[`peca-${p.chave}`] = "Informe a peça.";
        return;
      }
      let valor: number | undefined;
      if (temValor) {
        const c = reaisParaCentavos(p.valor);
        if (c === null || c < 0) {
          e[`valor-${p.chave}`] = "Valor inválido. Use, por exemplo, 380,00.";
          return;
        }
        valor = c;
      }
      itens.push({ peca: p.peca.trim(), tecnica: p.tecnica, valor });
    });
    if (itens.length === 0 && !Object.keys(e).some((k) => k.startsWith("peca-"))) e[`peca-${pecas[0]?.chave ?? 1}`] = ERRO.sem_itens;

    if (Object.keys(e).length > 0) return { erros: e };
    return {
      erros: e,
      dados: {
        origem,
        seguradora: externo ? nomeSeguradora : undefined,
        protocolo: externo ? protocolo.trim() : undefined,
        placa: placaNorm,
        modelo: modelo.trim(),
        cor: cor.trim() || undefined,
        clienteNome: cliente.trim(),
        telefone: tel || undefined,
        pecas: itens,
        observacoes: observacoes.trim() || undefined,
      },
    };
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErroGeral("");
    const { erros: e, dados } = validar();
    setErros(e);
    if (!dados) {
      focarPrimeiro(e);
      return;
    }
    try {
      const r = await acoes.criarAtendimentoRapido.mutateAsync([dados]);
      if (r.ok && r.osId) {
        navegar(`/orcamentos/${r.osId}`);
        return;
      }
      if (r.codigo === "placa_invalida") {
        setErros({ placa: ERRO.placa_invalida });
        focarPrimeiro({ placa: "x" });
      } else if (r.codigo === "sem_itens") {
        setErros({ [`peca-${pecas[0].chave}`]: ERRO.sem_itens });
      } else setErroGeral(mensagemErro(r.codigo));
    } catch {
      setErroGeral(mensagemErro());
    }
  }

  const limparErro = (campo: string) => erros[campo] && setErros((e) => ({ ...e, [campo]: undefined }));
  const mudarPeca = (chave: number, mudanca: Partial<LinhaPeca>) => setPecas((ps) => ps.map((p) => (p.chave === chave ? { ...p, ...mudanca } : p)));
  const adicionarPeca = () => {
    const chave = proximaChave.current++;
    setPecas((ps) => [...ps, { chave, peca: "", tecnica: ps.at(-1)?.tecnica ?? "martelinho", valor: "" }]);
    requestAnimationFrame(() => document.getElementById(`peca-${chave}`)?.focus());
  };
  const removerPeca = (chave: number) => setPecas((ps) => (ps.length > 1 ? ps.filter((p) => p.chave !== chave) : ps));

  return (
    <div className="max-w-[760px]">
      <Link to="/orcamentos" className="inline-flex items-center gap-1.5 h-11 -mt-3 mb-1 text-[13px] font-semibold text-tinta-suave no-underline hover:text-tinta">
        <Icone nome="voltar" tamanho={16} />
        Orçamentos
      </Link>
      <CabecalhoPagina titulo="Novo atendimento" resumo="Copie do portal ou anote com o cliente. Só o essencial; o resto se completa na ficha." />

      <form onSubmit={salvar} noValidate className="bg-cartao border border-linha">
        {erroGeral && (
          <p role="alert" className="flex items-center gap-2 px-4 py-3 bg-alerta-claro text-alerta font-semibold border-b border-alerta/30">
            <Icone nome="alerta" tamanho={18} />
            {erroGeral}
          </p>
        )}
        {Object.values(erros).some(Boolean) && (
          <p role="alert" className="px-4 py-3 bg-alerta-claro text-alerta text-[13px] font-semibold border-b border-alerta/30">
            Confira os campos marcados.
          </p>
        )}

        {/* ---------------- atendimento */}
        <Bloco titulo="Atendimento">
          <fieldset>
            <legend className="block text-[13px] font-bold mb-1.5">Origem</legend>
            <div className="grid grid-cols-3 border border-linha-forte">
              {ORIGENS.map((o, i) => (
                <label
                  key={o}
                  className={`relative flex items-center justify-center text-center h-11 px-2 text-[13px] sm:text-[14px] cursor-pointer leading-tight focus-within:outline focus-within:outline-2 focus-within:outline-amarelo focus-within:z-10 ${
                    i > 0 ? "border-l border-linha-forte" : ""
                  } ${origem === o ? "bg-amarelo text-preto font-bold" : "bg-cartao text-tinta-suave font-semibold hover:text-tinta hover:bg-papel"}`}
                >
                  <input type="radio" name="origem" value={o} checked={origem === o} onChange={() => setOrigem(o)} className="sr-only" />
                  {ORIGEM_OS[o]}
                </label>
              ))}
            </div>
          </fieldset>

          {externo && (
            <>
              <Campo id="seguradora" rotulo="Seguradora" erro={erros.seguradora}>
                <select
                  id="seguradora"
                  value={seguradora}
                  autoFocus
                  onChange={(e) => {
                    setSeguradora(e.target.value);
                    limparErro("seguradora");
                  }}
                  aria-invalid={Boolean(erros.seguradora)}
                  aria-describedby={erros.seguradora ? "seguradora-erro" : undefined}
                  className={CAMPO}
                >
                  <option value="">{oss.isPending ? "Carregando…" : "Escolha a seguradora"}</option>
                  {seguradoras.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  <option value={OUTRA}>Outra</option>
                </select>
              </Campo>
              {seguradora === OUTRA && (
                <Campo id="seguradoraOutra" rotulo="Nome da seguradora" erro={erros.seguradoraOutra}>
                  <input
                    id="seguradoraOutra"
                    value={seguradoraOutra}
                    onChange={(e) => {
                      setSeguradoraOutra(e.target.value);
                      limparErro("seguradoraOutra");
                    }}
                    aria-invalid={Boolean(erros.seguradoraOutra)}
                    aria-describedby={erros.seguradoraOutra ? "seguradoraOutra-erro" : undefined}
                    className={CAMPO}
                    autoComplete="off"
                  />
                </Campo>
              )}
              <Campo id="protocolo" rotulo={origem === "maxpar" ? "Protocolo Maxpar" : "Protocolo ou nº do sinistro"} erro={erros.protocolo}>
                <input
                  id="protocolo"
                  value={protocolo}
                  onChange={(e) => {
                    setProtocolo(e.target.value);
                    limparErro("protocolo");
                  }}
                  aria-invalid={Boolean(erros.protocolo)}
                  aria-describedby={erros.protocolo ? "protocolo-erro" : undefined}
                  placeholder={origem === "maxpar" ? "Ex.: 18383261" : ""}
                  className={`${CAMPO} numero`}
                  autoComplete="off"
                />
              </Campo>
            </>
          )}
        </Bloco>

        {/* ---------------- carro */}
        <Bloco titulo="Carro">
          <Campo id="placa" rotulo="Placa" erro={erros.placa} dica="7 caracteres, Mercosul ou antiga.">
            <div className="flex items-center gap-4">
              <input
                id="placa"
                value={placa}
                onChange={(e) => {
                  setPlaca(e.target.value.toUpperCase());
                  limparErro("placa");
                }}
                onBlur={() => placa && !placaValida(placa) && setErros((er) => ({ ...er, placa: ERRO.placa_invalida }))}
                aria-invalid={Boolean(erros.placa)}
                aria-describedby={`placa-dica${erros.placa ? " placa-erro" : ""}`}
                placeholder="ABC1D23"
                maxLength={8}
                autoFocus={!externo}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className={`${CAMPO} max-w-[180px] uppercase font-bold tracking-[0.08em] numero`}
              />
              <span aria-hidden="true" className={placaNorm ? "" : "opacity-30"}>
                <Placa placa={placaNorm || "ABC1D23"} tamanho="m" />
              </span>
              {placaValida(placa) && (
                <span className="text-ok" aria-hidden="true">
                  <Icone nome="ok" />
                </span>
              )}
            </div>
          </Campo>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Campo id="modelo" rotulo="Modelo" erro={erros.modelo}>
              <input
                id="modelo"
                value={modelo}
                onChange={(e) => {
                  setModelo(e.target.value);
                  limparErro("modelo");
                }}
                aria-invalid={Boolean(erros.modelo)}
                aria-describedby={erros.modelo ? "modelo-erro" : undefined}
                placeholder="Ex.: Jeep Compass"
                className={CAMPO}
              />
            </Campo>
            <Campo id="cor" rotulo="Cor" opcional>
              <input id="cor" value={cor} onChange={(e) => setCor(e.target.value)} placeholder="Ex.: Branco" className={CAMPO} />
            </Campo>
          </div>
        </Bloco>

        {/* ---------------- cliente */}
        <Bloco titulo="Cliente">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Campo id="cliente" rotulo="Nome" erro={erros.cliente}>
              <input
                id="cliente"
                value={cliente}
                onChange={(e) => {
                  setCliente(e.target.value);
                  limparErro("cliente");
                }}
                aria-invalid={Boolean(erros.cliente)}
                aria-describedby={erros.cliente ? "cliente-erro" : undefined}
                autoComplete="off"
                className={CAMPO}
              />
            </Campo>
            <Campo id="telefone" rotulo="Telefone (WhatsApp)" erro={erros.telefone} opcional>
              <input
                id="telefone"
                type="tel"
                inputMode="tel"
                value={telefone}
                onChange={(e) => {
                  setTelefone(e.target.value);
                  limparErro("telefone");
                }}
                aria-invalid={Boolean(erros.telefone)}
                aria-describedby={erros.telefone ? "telefone-erro" : undefined}
                placeholder="(41) 99999-0000"
                autoComplete="off"
                className={`${CAMPO} numero`}
              />
            </Campo>
          </div>
        </Bloco>

        {/* ---------------- peças */}
        <Bloco titulo="Peças">
          <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_170px_130px_44px] gap-2 -mb-2" aria-hidden="true">
            <span className="text-[13px] font-bold">Peça</span>
            <span className="text-[13px] font-bold">Técnica</span>
            <span className="text-[13px] font-bold">
              Valor <span className="font-normal text-tinta-fraca">(opcional)</span>
            </span>
          </div>
          <ol className="flex flex-col gap-3 sm:gap-2">
            {pecas.map((p, i) => {
              const n = i + 1;
              const erroPeca = erros[`peca-${p.chave}`];
              const erroValor = erros[`valor-${p.chave}`];
              return (
                <li key={p.chave} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] sm:grid-cols-[minmax(0,1fr)_170px_130px_44px] gap-2 items-start pb-3 sm:pb-0 border-b border-linha sm:border-b-0 last:border-b-0">
                  <div className="col-span-3 sm:col-span-1">
                    <label htmlFor={`peca-${p.chave}`} className="block text-[12px] font-bold mb-1 sm:sr-only">
                      Peça {n}
                    </label>
                    <input
                      id={`peca-${p.chave}`}
                      list="pecas-sugeridas"
                      value={p.peca}
                      onChange={(e) => {
                        mudarPeca(p.chave, { peca: e.target.value });
                        limparErro(`peca-${p.chave}`);
                      }}
                      aria-invalid={Boolean(erroPeca)}
                      aria-describedby={erroPeca ? `peca-${p.chave}-erro` : undefined}
                      placeholder="Ex.: Porta dianteira esquerda"
                      autoComplete="off"
                      className={CAMPO}
                    />
                    {erroPeca && <MensagemErro id={`peca-${p.chave}-erro`}>{erroPeca}</MensagemErro>}
                  </div>
                  <div>
                    <label htmlFor={`tecnica-${p.chave}`} className="block text-[12px] font-bold mb-1 sm:sr-only">
                      Técnica<span className="sr-only"> da peça {n}</span>
                    </label>
                    <select id={`tecnica-${p.chave}`} value={p.tecnica} onChange={(e) => mudarPeca(p.chave, { tecnica: e.target.value as Tecnica })} className={CAMPO}>
                      {TECNICAS.map((t) => (
                        <option key={t} value={t}>
                          {TECNICA[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`valor-${p.chave}`} className="block text-[12px] font-bold mb-1 sm:sr-only">
                      Valor<span className="sr-only"> da peça {n}</span> <span className="font-normal text-tinta-fraca">(opcional)</span>
                    </label>
                    <div className={`flex items-center h-11 bg-cartao border focus-within:border-preto ${erroValor ? "border-alerta" : "border-linha-forte"}`}>
                      <span className="pl-3 text-tinta-fraca text-[13px]" aria-hidden="true">
                        R$
                      </span>
                      <input
                        id={`valor-${p.chave}`}
                        inputMode="decimal"
                        value={p.valor}
                        onChange={(e) => {
                          mudarPeca(p.chave, { valor: e.target.value });
                          limparErro(`valor-${p.chave}`);
                        }}
                        aria-invalid={Boolean(erroValor)}
                        aria-describedby={erroValor ? `valor-${p.chave}-erro` : undefined}
                        placeholder="0,00"
                        autoComplete="off"
                        className="flex-1 min-w-0 h-full px-2 bg-transparent outline-none text-right numero placeholder:text-tinta-fraca"
                      />
                    </div>
                    {erroValor && <MensagemErro id={`valor-${p.chave}-erro`}>{erroValor}</MensagemErro>}
                  </div>
                  <div className="self-end sm:self-start">
                    <button
                      type="button"
                      onClick={() => removerPeca(p.chave)}
                      disabled={pecas.length === 1}
                      aria-label={`Remover peça ${n}`}
                      title="Remover peça"
                      className="inline-grid place-items-center w-11 h-11 text-tinta-suave border border-transparent hover:border-linha-forte hover:text-alerta disabled:opacity-30"
                    >
                      <Icone nome="fechar" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          <datalist id="pecas-sugeridas">
            {PECAS_SUGERIDAS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <div>
            <Botao variante="contorno" tamanho="denso" icone="mais" onClick={adicionarPeca}>
              Adicionar peça
            </Botao>
          </div>
        </Bloco>

        {/* ---------------- observações */}
        <Bloco titulo="Observações">
          <Campo id="observacoes" rotulo="Observações" opcional ocultarRotulo>
            <textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Ex.: Cliente só pode trazer o carro à tarde."
              className="w-full px-3 py-2 bg-cartao border border-linha-forte outline-none focus:border-preto placeholder:text-tinta-fraca"
            />
          </Campo>
        </Bloco>

        <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-4 border-t border-linha bg-papel/60">
          <Botao type="submit" variante="primario" icone="ok" disabled={enviando} className="min-w-[200px]">
            {enviando ? "Salvando…" : "Salvar atendimento"}
          </Botao>
          <Link to="/orcamentos" className="inline-flex items-center h-11 px-4 font-bold text-tinta-suave no-underline hover:text-tinta">
            Cancelar
          </Link>
          <span className="text-[12px] text-tinta-suave sm:ml-auto">Abre a ficha da OS em seguida.</span>
        </div>
      </form>
    </div>
  );
}

// ------------------------------------------------------------------ peças do formulário

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="px-4 sm:px-6 py-5 border-b border-linha flex flex-col gap-4">
      <h2 className="rotulo text-tinta-suave">{titulo}</h2>
      {children}
    </section>
  );
}

function Campo({
  id,
  rotulo,
  erro,
  dica,
  opcional = false,
  ocultarRotulo = false,
  children,
}: {
  id: string;
  rotulo: string;
  erro?: string;
  dica?: string;
  opcional?: boolean;
  ocultarRotulo?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={ocultarRotulo ? "sr-only" : "block text-[13px] font-bold mb-1.5"}>
        {rotulo}
        {opcional && <span className="font-normal text-tinta-fraca"> (opcional)</span>}
      </label>
      {children}
      {dica && !erro && (
        <p id={`${id}-dica`} className="mt-1 text-[12px] text-tinta-suave">
          {dica}
        </p>
      )}
      {erro && <MensagemErro id={`${id}-erro`}>{erro}</MensagemErro>}
    </div>
  );
}

function MensagemErro({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1 text-[13px] font-semibold text-alerta">
      {children}
    </p>
  );
}

// ------------------------------------------------------------------ helpers

const ORDEM_CAMPOS = ["seguradora", "seguradoraOutra", "protocolo", "placa", "modelo", "cliente", "telefone"];

function focarPrimeiro(erros: Erros) {
  const chaves = Object.keys(erros).filter((k) => erros[k]);
  const primeiro = ORDEM_CAMPOS.find((c) => chaves.includes(c)) ?? chaves[0];
  if (primeiro) requestAnimationFrame(() => document.getElementById(primeiro)?.focus());
}

/**
 * Telefone brasileiro → E.164 (+55…). Aceita 10–11 dígitos (DDD + número) ou já com 55.
 * Pedido no relatório do SD: mover para o domínio compartilhado com teste.
 */
function normalizarTelefone(valor: string): string | null {
  const d = valor.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return `+${d}`;
  return null;
}

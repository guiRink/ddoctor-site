import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { OrigemOS, Tecnica, Veiculo } from "@compartilhado/tipos";
import { TECNICAS } from "@compartilhado/tipos";
import { reaisParaCentavos } from "@compartilhado/dominio/dinheiro";
import { normalizarDocumento, validarDocumento } from "@compartilhado/dominio/documento";
import { normalizarPlaca, placaValida } from "@compartilhado/dominio/placa";
import { mensagemErro, useAcoes, useClientes, useOSs, useVeiculos } from "../dados/hooks";
import type { ClienteResumo, NovoAtendimentoRapido } from "../dados/repositorio";
import { useSessao } from "../dados/sessao";
import { podeEditar } from "../dominio/permissoes";
import { ERRO, ORIGEM_OS, TECNICA } from "../dominio/rotulos";
import { Botao, CabecalhoPagina, Cartao, SUPERFICIE, Vazio } from "../componentes/ui/Basicos";
import { Placa } from "../componentes/ui/Placa";
import { Icone } from "../componentes/Icone";
import { BuscaCliente } from "../componentes/clientes/BuscaCliente";
import { AvatarCliente, EtiquetaPJ } from "../componentes/clientes/Comuns";
import { CLASSE_AREA, CLASSE_CAMPO, Campo, Marcador, MensagemErro, Segmentado } from "../componentes/clientes/Campos";
import { descrito, documentoExibicao, formatarTelefone, mascaraDocumento, mascaraTelefone, nomeVeiculo, tipoDoCliente } from "../componentes/clientes/formato";

/**
 * Novo atendimento — entrada rápida (meta: 30 segundos; informações §2.1 A1, §2.2 B1, §2.3 C1).
 * Revisão SE: busca de cliente já cadastrado no topo (liga `clienteId`; aceita `?cliente=<id>`),
 * marca do carro e "Mais dados do cliente" (documento, WhatsApp, e-mail) recolhível.
 * Seções em cartões brancos, na ordem em que a recepção lê o portal ou ouve o cliente; rodapé de ações fixo.
 */
type Origem = Exclude<OrigemOS, "misto">;
const ORIGENS: Origem[] = ["maxpar", "seguradora_direta", "particular"];
const OUTRA = "__outra";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export function NovoAtendimento() {
  // `?cliente=<id>` novo (ex.: vindo de outra ficha) recomeça o formulário com o cliente ligado
  const [params] = useSearchParams();
  const clienteDoLink = params.get("cliente") ?? undefined;
  return <Formulario key={clienteDoLink ?? ""} clienteDoLink={clienteDoLink} />;
}

function Formulario({ clienteDoLink }: { clienteDoLink?: string }) {
  const { perfil } = useSessao();
  const navegar = useNavigate();
  const acoes = useAcoes();
  const oss = useOSs();
  const clientes = useClientes();
  const veiculos = useVeiculos();
  const proximaChave = useRef(2);

  const [clienteId, setClienteId] = useState<string | undefined>(clienteDoLink);
  const [origem, setOrigem] = useState<Origem>("maxpar");
  const [seguradora, setSeguradora] = useState("");
  const [seguradoraOutra, setSeguradoraOutra] = useState("");
  const [protocolo, setProtocolo] = useState("");
  const [placa, setPlaca] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [cor, setCor] = useState("");
  const [cliente, setCliente] = useState("");
  const [telefone, setTelefone] = useState("");
  const [maisDados, setMaisDados] = useState(false);
  const [documento, setDocumento] = useState("");
  const [whatsIgual, setWhatsIgual] = useState(true);
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
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

  const escolhido: ClienteResumo | undefined = clienteId ? clientes.data?.find((r) => r.cliente.id === clienteId) : undefined;
  const clienteDoLinkSumiu = Boolean(clienteId && clientes.data && !escolhido);
  const externo = origem !== "particular";
  const placaNorm = normalizarPlaca(placa);
  const veiculoDaPlaca: Veiculo | undefined = placaValida(placa) ? veiculos.data?.find((v) => v.placa === placaNorm) : undefined;
  const donoDaPlaca = veiculoDaPlaca?.clienteId ? clientes.data?.find((r) => r.cliente.id === veiculoDaPlaca.clienteId) : undefined;
  const enviando = acoes.criarAtendimentoRapido.isPending;

  /** Preenche marca, modelo e cor vazios a partir do veículo cadastrado. */
  function completarVeiculo(v: Veiculo) {
    if (!marca.trim() && v.marca) setMarca(v.marca);
    if (!modelo.trim() && v.modelo) setModelo(v.modelo);
    if (!cor.trim() && v.cor) setCor(v.cor);
    if (v.modelo) limparErro("modelo");
  }

  function escolherVeiculo(v: Veiculo) {
    setPlaca(v.placa);
    setMarca(v.marca ?? "");
    setModelo(v.modelo ?? "");
    setCor(v.cor ?? "");
    setErros((e) => ({ ...e, placa: undefined, modelo: undefined }));
  }

  function escolherCliente(r: ClienteResumo) {
    setClienteId(r.cliente.id);
    setErros((e) => ({ ...e, cliente: undefined, telefone: undefined, documento: undefined, whatsapp: undefined, email: undefined }));
    // um carro só e placa ainda vazia: já preenche o carro
    if (!placa.trim() && r.veiculos.length === 1) escolherVeiculo(r.veiculos[0]);
  }

  function validar(): { erros: Erros; dados?: NovoAtendimentoRapido } {
    const e: Erros = {};
    const nomeSeguradora = seguradora === OUTRA ? seguradoraOutra.trim() : seguradora;
    if (externo && !nomeSeguradora) e[seguradora === OUTRA ? "seguradoraOutra" : "seguradora"] = "Escolha a seguradora.";
    if (externo && !protocolo.trim()) e.protocolo = "Informe o protocolo do atendimento.";
    if (!placaValida(placa)) e.placa = ERRO.placa_invalida;
    if (!modelo.trim()) e.modelo = "Informe o modelo do carro.";

    let tel: string | null = null;
    let whats: string | null = null;
    if (!escolhido) {
      if (cliente.trim().length < 3) e.cliente = "Informe o nome do cliente.";
      tel = normalizarTelefone(telefone);
      if (telefone.trim() && !tel) e.telefone = "Telefone incompleto. Use DDD e número, ex.: (41) 99999-0000.";
      if (maisDados || documento || whatsapp || email) {
        if (documento.trim() && !validarDocumento(documento)) e.documento = ERRO.documento_invalido;
        const w = whatsIgual ? "" : whatsapp;
        whats = whatsIgual ? tel : normalizarTelefone(w);
        if (!whatsIgual && w.trim() && !whats) e.whatsapp = "WhatsApp incompleto. Use DDD e número, ex.: (41) 99999-0000.";
        if (email.trim() && !EMAIL.test(email.trim())) e.email = ERRO.email_invalido;
      } else whats = tel;
    }

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
        marca: marca.trim() || undefined,
        modelo: modelo.trim(),
        cor: cor.trim() || undefined,
        ...(escolhido
          ? { clienteId: escolhido.cliente.id, clienteNome: escolhido.cliente.nome }
          : {
              clienteNome: cliente.trim(),
              documento: documento.trim() ? normalizarDocumento(documento) : undefined,
              telefone: tel || undefined,
              whatsapp: whats || undefined,
              email: email.trim() || undefined,
            }),
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
      if (e.documento || e.whatsapp || e.email) setMaisDados(true);
      focarPrimeiro(e);
      return;
    }
    try {
      const r = await acoes.criarAtendimentoRapido.mutateAsync([dados]);
      if (r.ok && r.osId) {
        navegar(`/orcamentos/${r.osId}`);
        return;
      }
      const campo = r.codigo ? CAMPO_DO_ERRO[r.codigo] : undefined;
      if (campo === "peca") {
        setErros({ [`peca-${pecas[0].chave}`]: mensagemErro(r.codigo) });
      } else if (campo) {
        if (["documento", "whatsapp", "email"].includes(campo)) setMaisDados(true);
        setErros({ [campo]: mensagemErro(r.codigo) });
        focarPrimeiro({ [campo]: "x" });
      } else setErroGeral(mensagemErro(r.codigo));
    } catch {
      setErroGeral(mensagemErro());
    }
  }

  function limparErro(campo: string) {
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }));
  }
  const mudarPeca = (chave: number, mudanca: Partial<LinhaPeca>) => setPecas((ps) => ps.map((p) => (p.chave === chave ? { ...p, ...mudanca } : p)));
  const adicionarPeca = () => {
    const chave = proximaChave.current++;
    setPecas((ps) => [...ps, { chave, peca: "", tecnica: ps.at(-1)?.tecnica ?? "martelinho", valor: "" }]);
    requestAnimationFrame(() => document.getElementById(`peca-${chave}`)?.focus());
  };
  const removerPeca = (chave: number) => setPecas((ps) => (ps.length > 1 ? ps.filter((p) => p.chave !== chave) : ps));
  const temErros = Object.values(erros).some(Boolean);

  return (
    <div className="max-w-[760px]">
      <Link to="/orcamentos" className="inline-flex items-center gap-1.5 h-11 md:h-8 -mt-2 mb-2 text-[13px] font-medium text-tinta-suave no-underline hover:text-tinta">
        <Icone nome="voltar" tamanho={16} />
        Orçamentos
      </Link>
      <CabecalhoPagina titulo="Novo atendimento" resumo="Copie do portal ou anote com o cliente. Só o essencial; o resto se completa na ficha." />

      <form onSubmit={salvar} noValidate className="flex flex-col gap-4">
        {(erroGeral || temErros) && (
          <div role="alert" className="flex items-start gap-2.5 px-4 py-3 rounded-cartao bg-alerta-claro text-alerta border border-alerta/20">
            <Icone nome="alerta" tamanho={18} className="mt-px shrink-0" />
            <p className="text-[14px] font-medium">{erroGeral || "Confira os campos marcados."}</p>
          </div>
        )}

        {/* ---------------- cliente já cadastrado */}
        <Secao titulo={escolhido ? "Cliente" : "Cliente já cadastrado?"} descricao={escolhido ? undefined : "Procure antes de digitar: o atendimento fica ligado ao cadastro e ao histórico dele."}>
          {escolhido ? (
            <ClienteVinculado r={escolhido} onTrocar={() => setClienteId(undefined)} />
          ) : (
            <>
              <label htmlFor="busca-cliente" className="sr-only">
                Buscar cliente já cadastrado por nome, CPF/CNPJ, placa ou telefone
              </label>
              <BuscaCliente id="busca-cliente" clientes={clientes.data} carregando={clientes.isPending} erro={clientes.isError} onEscolher={escolherCliente} />
              {clienteDoLinkSumiu && (
                <p className="text-[13px] text-atencao font-medium">O cliente do link não foi encontrado. Procure de novo ou preencha um cliente novo.</p>
              )}
            </>
          )}
        </Secao>

        {/* ---------------- atendimento */}
        <Secao titulo="Atendimento">
          <Segmentado
            nome="origem"
            legenda="Origem"
            opcoes={ORIGENS.map((o) => ({ valor: o, texto: ORIGEM_OS[o] }))}
            valor={origem}
            onMudar={setOrigem}
          />
          {externo && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-4 min-w-0">
                <Campo id="seguradora" rotulo="Seguradora" erro={erros.seguradora}>
                  <select
                    id="seguradora"
                    value={seguradora}
                    autoFocus={!escolhido}
                    onChange={(e) => {
                      setSeguradora(e.target.value);
                      limparErro("seguradora");
                    }}
                    aria-invalid={Boolean(erros.seguradora)}
                    aria-describedby={descrito("seguradora", erros.seguradora)}
                    className={CLASSE_CAMPO}
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
                      aria-describedby={descrito("seguradoraOutra", erros.seguradoraOutra)}
                      className={CLASSE_CAMPO}
                      autoComplete="off"
                    />
                  </Campo>
                )}
              </div>
              <Campo id="protocolo" rotulo={origem === "maxpar" ? "Protocolo Maxpar" : "Protocolo ou nº do sinistro"} erro={erros.protocolo}>
                <input
                  id="protocolo"
                  value={protocolo}
                  onChange={(e) => {
                    setProtocolo(e.target.value);
                    limparErro("protocolo");
                  }}
                  aria-invalid={Boolean(erros.protocolo)}
                  aria-describedby={descrito("protocolo", erros.protocolo)}
                  placeholder={origem === "maxpar" ? "Ex.: 18383261" : ""}
                  className={`${CLASSE_CAMPO} numero`}
                  autoComplete="off"
                />
              </Campo>
            </div>
          )}
        </Secao>

        {/* ---------------- carro */}
        <Secao titulo="Carro">
          {escolhido && escolhido.veiculos.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-tinta-suave">Veículos deste cliente · toque para usar</span>
              <div className="flex flex-wrap gap-2">
                {escolhido.veiculos.map((v) => {
                  const ativo = v.placa === placaNorm;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() => escolherVeiculo(v)}
                      className={`inline-flex items-center gap-2.5 h-11 md:h-10 pl-1.5 pr-3 rounded-controle border text-[13px] transition-colors duration-150 ${
                        ativo ? "bg-cartao border-tinta-fraca ring-1 ring-tinta-fraca font-semibold" : "bg-cartao border-linha-forte shadow-controle hover:bg-cinza-50 hover:border-tinta-fraca font-medium text-tinta-suave"
                      }`}
                    >
                      <Placa placa={v.placa} />
                      <span className="max-w-[160px] truncate">{nomeVeiculo(v)}</span>
                      {ativo && <Icone nome="ok" tamanho={14} traco={2} className="text-ok" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <Campo id="placa" rotulo="Placa" erro={erros.placa} dica={veiculoDaPlaca ? undefined : "7 caracteres, Mercosul ou antiga."}>
            <div className="flex items-center gap-4">
              <input
                id="placa"
                value={placa}
                onChange={(e) => {
                  setPlaca(e.target.value.toUpperCase());
                  limparErro("placa");
                }}
                onBlur={() => {
                  if (placa && !placaValida(placa)) setErros((er) => ({ ...er, placa: ERRO.placa_invalida }));
                  else if (veiculoDaPlaca) completarVeiculo(veiculoDaPlaca);
                }}
                aria-invalid={Boolean(erros.placa)}
                aria-describedby={descrito("placa", erros.placa, !veiculoDaPlaca)}
                placeholder="ABC1D23"
                maxLength={8}
                autoFocus={!externo && !escolhido}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className={`${CLASSE_CAMPO} max-w-[160px] uppercase font-semibold tracking-[0.06em] numero`}
              />
              <span aria-hidden="true" className={`transition-opacity duration-150 ${placaValida(placa) ? "" : "opacity-30"}`}>
                <Placa placa={placaNorm || "ABC1D23"} tamanho="m" />
              </span>
            </div>
          </Campo>
          {veiculoDaPlaca && (
            <AvisoPlaca
              veiculo={veiculoDaPlaca}
              dono={donoDaPlaca}
              escolhido={escolhido}
              onUsarDono={donoDaPlaca && !escolhido ? () => escolherCliente(donoDaPlaca) : undefined}
              onCompletar={() => completarVeiculo(veiculoDaPlaca)}
              falta={(!marca.trim() && Boolean(veiculoDaPlaca.marca)) || (!modelo.trim() && Boolean(veiculoDaPlaca.modelo)) || (!cor.trim() && Boolean(veiculoDaPlaca.cor))}
            />
          )}
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
            <Campo id="marca" rotulo="Marca" opcional>
              <input id="marca" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ex.: Jeep" autoComplete="off" className={CLASSE_CAMPO} />
            </Campo>
            <Campo id="modelo" rotulo="Modelo" erro={erros.modelo}>
              <input
                id="modelo"
                value={modelo}
                onChange={(e) => {
                  setModelo(e.target.value);
                  limparErro("modelo");
                }}
                aria-invalid={Boolean(erros.modelo)}
                aria-describedby={descrito("modelo", erros.modelo)}
                placeholder="Ex.: Compass"
                autoComplete="off"
                className={CLASSE_CAMPO}
              />
            </Campo>
            <Campo id="cor" rotulo="Cor" opcional className="col-span-2 sm:col-span-1">
              <input id="cor" value={cor} onChange={(e) => setCor(e.target.value)} placeholder="Ex.: Branco" autoComplete="off" className={CLASSE_CAMPO} />
            </Campo>
          </div>
        </Secao>

        {/* ---------------- cliente novo */}
        {!escolhido && (
          <Secao titulo="Cliente" descricao="Cliente novo: o cadastro é criado junto com o atendimento.">
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
                  aria-describedby={descrito("cliente", erros.cliente)}
                  autoComplete="off"
                  className={CLASSE_CAMPO}
                />
              </Campo>
              <Campo id="telefone" rotulo="Telefone" erro={erros.telefone} opcional>
                <input
                  id="telefone"
                  type="tel"
                  inputMode="tel"
                  value={telefone}
                  onChange={(e) => {
                    setTelefone(mascaraTelefone(e.target.value));
                    limparErro("telefone");
                  }}
                  aria-invalid={Boolean(erros.telefone)}
                  aria-describedby={descrito("telefone", erros.telefone)}
                  placeholder="(41) 99999-0000"
                  autoComplete="off"
                  className={`${CLASSE_CAMPO} numero`}
                />
              </Campo>
            </div>

            <div className="border-t border-linha pt-3 -mb-1">
              <button
                type="button"
                aria-expanded={maisDados}
                aria-controls="mais-dados-cliente"
                onClick={() => setMaisDados((v) => !v)}
                className="inline-flex items-center gap-1.5 h-11 md:h-8 -ml-1 px-1 rounded-controle text-[13px] font-semibold text-tinta hover:bg-cinza-100 transition-colors duration-150"
              >
                <Icone nome="baixo" tamanho={16} traco={2} className={`transition-transform duration-150 ${maisDados ? "rotate-180" : ""}`} />
                Mais dados do cliente
                <span className="font-normal text-tinta-suave">· CPF/CNPJ, WhatsApp, e-mail</span>
              </button>
            </div>
            {maisDados && (
              <div id="mais-dados-cliente" className="grid gap-4 sm:grid-cols-2">
                <Campo id="documento" rotulo="CPF ou CNPJ" opcional erro={erros.documento} className="sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]">
                  <input
                    id="documento"
                    value={documento}
                    onChange={(e) => {
                      setDocumento(mascaraDocumento(e.target.value));
                      limparErro("documento");
                    }}
                    onBlur={() => documento.trim() && !validarDocumento(documento) && setErros((er) => ({ ...er, documento: ERRO.documento_invalido }))}
                    inputMode="text"
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder="000.000.000-00"
                    autoComplete="off"
                    aria-invalid={Boolean(erros.documento)}
                    aria-describedby={descrito("documento", erros.documento)}
                    className={`${CLASSE_CAMPO} numero`}
                  />
                </Campo>
                <Campo
                  id="whatsapp"
                  rotulo="WhatsApp"
                  erro={erros.whatsapp}
                  extra={
                    <Marcador
                      id="whats-igual"
                      rotulo="Igual ao telefone"
                      marcado={whatsIgual}
                      onMudar={(v) => {
                        setWhatsIgual(v);
                        limparErro("whatsapp");
                      }}
                    />
                  }
                >
                  <input
                    id="whatsapp"
                    type="tel"
                    inputMode="tel"
                    value={whatsIgual ? telefone : whatsapp}
                    disabled={whatsIgual}
                    onChange={(e) => {
                      setWhatsapp(mascaraTelefone(e.target.value));
                      limparErro("whatsapp");
                    }}
                    placeholder="(41) 99999-0000"
                    autoComplete="off"
                    aria-invalid={Boolean(erros.whatsapp)}
                    aria-describedby={descrito("whatsapp", erros.whatsapp)}
                    className={`${CLASSE_CAMPO} numero`}
                  />
                </Campo>
                <Campo id="email" rotulo="E-mail" opcional erro={erros.email}>
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      limparErro("email");
                    }}
                    placeholder="nome@exemplo.com"
                    autoComplete="off"
                    aria-invalid={Boolean(erros.email)}
                    aria-describedby={descrito("email", erros.email)}
                    className={CLASSE_CAMPO}
                  />
                </Campo>
              </div>
            )}
          </Secao>
        )}

        {/* ---------------- peças */}
        <Secao titulo="Peças" contagem={pecas.filter((p) => p.peca.trim()).length || undefined}>
          <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_168px_136px_40px] gap-2 -mb-2" aria-hidden="true">
            <span className="text-[13px] font-medium text-tinta-suave">Peça</span>
            <span className="text-[13px] font-medium text-tinta-suave">Técnica</span>
            <span className="text-[13px] font-medium text-tinta-suave">
              Valor <span className="font-normal text-tinta-fraca">· opcional</span>
            </span>
          </div>
          <ol className="flex flex-col gap-3 sm:gap-2">
            {pecas.map((p, i) => {
              const n = i + 1;
              const erroPeca = erros[`peca-${p.chave}`];
              const erroValor = erros[`valor-${p.chave}`];
              return (
                <li
                  key={p.chave}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] sm:grid-cols-[minmax(0,1fr)_168px_136px_40px] gap-2 items-start pb-3 sm:pb-0 border-b border-linha sm:border-b-0 last:border-b-0 last:pb-0"
                >
                  <div className="col-span-3 sm:col-span-1">
                    <label htmlFor={`peca-${p.chave}`} className="block text-[13px] font-medium text-tinta-suave mb-1 sm:sr-only">
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
                      className={CLASSE_CAMPO}
                    />
                    {erroPeca && <MensagemErro id={`peca-${p.chave}-erro`}>{erroPeca}</MensagemErro>}
                  </div>
                  <div>
                    <label htmlFor={`tecnica-${p.chave}`} className="block text-[13px] font-medium text-tinta-suave mb-1 sm:sr-only">
                      Técnica<span className="sr-only"> da peça {n}</span>
                    </label>
                    <select id={`tecnica-${p.chave}`} value={p.tecnica} onChange={(e) => mudarPeca(p.chave, { tecnica: e.target.value as Tecnica })} className={CLASSE_CAMPO}>
                      {TECNICAS.map((t) => (
                        <option key={t} value={t}>
                          {TECNICA[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`valor-${p.chave}`} className="block text-[13px] font-medium text-tinta-suave mb-1 sm:sr-only">
                      Valor<span className="sr-only"> da peça {n}</span> <span className="font-normal text-tinta-fraca">· opcional</span>
                    </label>
                    <div
                      className={`flex items-center h-11 md:h-10 bg-cartao border rounded-controle shadow-controle transition-[border-color,box-shadow] duration-150 focus-within:border-tinta-fraca focus-within:ring-[3px] focus-within:ring-amarelo/30 ${
                        erroValor ? "border-alerta" : "border-linha-forte hover:border-tinta-fraca"
                      }`}
                    >
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
                        className="flex-1 min-w-0 h-full px-2 pr-3 bg-transparent outline-none text-right text-[14px] numero placeholder:text-tinta-fraca"
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
                      className="inline-grid place-items-center w-11 h-11 md:w-10 md:h-10 rounded-controle text-tinta-fraca hover:text-alerta hover:bg-alerta-claro transition-colors duration-150 disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Icone nome="fechar" tamanho={16} />
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
        </Secao>

        {/* ---------------- observações */}
        <Secao titulo="Observações">
          <Campo id="observacoes" rotulo="Observações" opcional ocultarRotulo>
            <textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Ex.: Cliente só pode trazer o carro à tarde."
              className={CLASSE_AREA}
            />
          </Campo>
        </Secao>

        {/* ---------------- rodapé de ações (fixo) */}
        <div
          className={`sticky z-10 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-4 ${SUPERFICIE} elevacao flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3`}
        >
          <Botao type="submit" variante="primario" icone="ok" disabled={enviando} className="flex-1 sm:flex-none sm:min-w-[200px]">
            {enviando ? "Salvando…" : "Salvar atendimento"}
          </Botao>
          <Link
            to="/orcamentos"
            className="inline-flex items-center h-11 md:h-10 px-3 rounded-controle text-[14px] font-semibold text-tinta-suave no-underline hover:text-tinta hover:bg-cinza-100 transition-colors duration-150"
          >
            Cancelar
          </Link>
          <span className="hidden sm:block text-[12px] text-tinta-suave ml-auto">Abre a ficha da OS em seguida.</span>
        </div>
      </form>
    </div>
  );
}

// ------------------------------------------------------------------ peças do formulário

/** Seção em cartão branco: título 14/600 (+ contagem e descrição), corpo com 16 px entre campos. */
function Secao({ titulo, descricao, contagem, children }: { titulo: string; descricao?: string; contagem?: number; children: ReactNode }) {
  return (
    <section aria-label={titulo} className={`${SUPERFICIE} px-4 sm:px-5 py-4 sm:py-5 flex flex-col gap-4`}>
      <header>
        <h2 className="text-[14px] font-semibold text-tinta flex items-baseline gap-2">
          {titulo}
          {contagem !== undefined && <span className="numero text-[13px] font-medium text-tinta-fraca">{contagem}</span>}
        </h2>
        {descricao && <p className="mt-0.5 text-[13px] text-tinta-suave">{descricao}</p>}
      </header>
      {children}
    </section>
  );
}

function ClienteVinculado({ r, onTrocar }: { r: ClienteResumo; onTrocar: () => void }) {
  const c = r.cliente;
  const doc = documentoExibicao(c);
  const tel = c.telefone ?? c.whatsapp;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 -mt-1">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <AvatarCliente nome={c.nome} tamanho={40} />
        <div className="min-w-0">
          <p className="flex items-center gap-2 min-w-0">
            <span className="font-semibold truncate">{c.nome}</span>
            {tipoDoCliente(c) === "pj" && <EtiquetaPJ />}
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-ok shrink-0">
              <Icone nome="ok" tamanho={14} traco={2} />
              Vinculado
            </span>
          </p>
          <p className="text-[13px] text-tinta-suave truncate numero">
            {[doc && `${doc.rotulo} ${doc.valor}`, tel && formatarTelefone(tel), `${r.quantidadeOS} ${r.quantidadeOS === 1 ? "OS anterior" : "OS anteriores"}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          to={`/clientes/${c.id}`}
          target="_blank"
          className="inline-flex items-center gap-1 h-11 md:h-9 px-2 rounded-controle text-[13px] font-semibold text-tinta-suave no-underline hover:text-tinta hover:bg-cinza-100"
        >
          Ver ficha
          <Icone nome="externo" tamanho={14} />
          <span className="sr-only">(abre em nova aba)</span>
        </Link>
        <Botao tamanho="denso" onClick={onTrocar}>
          Trocar cliente
        </Botao>
      </div>
    </div>
  );
}

/** Aviso abaixo da placa quando ela já está cadastrada. */
function AvisoPlaca({
  veiculo,
  dono,
  escolhido,
  onUsarDono,
  onCompletar,
  falta,
}: {
  veiculo: Veiculo;
  dono?: ClienteResumo;
  escolhido?: ClienteResumo;
  onUsarDono?: () => void;
  onCompletar: () => void;
  falta: boolean;
}) {
  const deOutro = Boolean(escolhido && dono && dono.cliente.id !== escolhido.cliente.id);
  return (
    <div
      className={`-mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 rounded-controle text-[13px] ${
        deOutro ? "bg-atencao-claro text-atencao" : "bg-cinza-50 border border-linha text-tinta-suave"
      }`}
    >
      <Icone nome={deOutro ? "alerta" : "carro"} tamanho={16} className="shrink-0" />
      <span className="min-w-0 flex-1">
        {deOutro ? (
          <>
            Esta placa está no cadastro de <strong className="font-semibold">{dono!.cliente.nome}</strong>. O atendimento será aberto para {escolhido!.cliente.nome}.
          </>
        ) : (
          <>
            Veículo já cadastrado: <strong className="font-semibold text-tinta">{nomeVeiculo(veiculo)}</strong>
            {dono && !escolhido && <> · de {dono.cliente.nome}</>}
          </>
        )}
      </span>
      {falta && (
        <button type="button" onClick={onCompletar} className="h-11 md:h-8 px-2.5 rounded-controle font-semibold text-tinta hover:bg-cinza-100">
          Preencher carro
        </button>
      )}
      {onUsarDono && dono && (
        <Botao tamanho="denso" onClick={onUsarDono}>
          Usar {primeiroNome(dono.cliente.nome)}
        </Botao>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ helpers

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome;

/** Código do repositório → campo que recebe a mensagem. */
const CAMPO_DO_ERRO: Record<string, string> = {
  placa_invalida: "placa",
  sem_itens: "peca",
  documento_invalido: "documento",
  telefone_invalido: "telefone",
  email_invalido: "email",
  nome_obrigatorio: "cliente",
};

const ORDEM_CAMPOS = ["seguradora", "seguradoraOutra", "protocolo", "placa", "modelo", "cliente", "telefone", "documento", "whatsapp", "email"];

function focarPrimeiro(erros: Erros) {
  const chaves = Object.keys(erros).filter((k) => erros[k]);
  const primeiro = ORDEM_CAMPOS.find((c) => chaves.includes(c)) ?? chaves[0];
  if (primeiro) requestAnimationFrame(() => document.getElementById(primeiro)?.focus());
}

/**
 * Telefone brasileiro → E.164 (+55…). Aceita 10–11 dígitos (DDD + número) ou já com 55.
 * Pedido no relatório do SD (repetido no SE): mover para o domínio compartilhado com teste.
 */
function normalizarTelefone(valor: string): string | null {
  const d = valor.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return `+${d}`;
  return null;
}

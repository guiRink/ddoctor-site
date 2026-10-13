import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { formatarReais } from "@compartilhado/dominio/dinheiro";
import { dataNoFuso } from "@compartilhado/dominio/fuso";
import { useAgora, useClientes } from "../dados/hooks";
import type { ClienteResumo } from "../dados/repositorio";
import { useSessao } from "../dados/sessao";
import { podeEditar, veDadosSensiveis } from "../dominio/permissoes";
import { Botao, CabecalhoPagina, Cartao, Erro, Esqueleto, SUPERFICIE, Vazio } from "../componentes/ui/Basicos";
import { GrupoFiltros } from "../componentes/ui/Filtros";
import { CLASSE_LINHA, Tabela, Th } from "../componentes/ui/Tabela";
import { Icone } from "../componentes/Icone";
import { AvatarCliente, BotaoWhatsApp, EtiquetaPJ, PlacasDoCliente } from "../componentes/clientes/Comuns";
import { FormCliente } from "../componentes/clientes/FormCliente";
import { documentoExibicao, formatarTelefone, haQuanto, resumoCorresponde, tipoDoCliente } from "../componentes/clientes/formato";
import { dataCurta } from "../componentes/gestao/formato";

/**
 * Clientes — cadastro de pessoas e empresas com veículos, OS e total pago (docs/concorrente-analise.md §3.1).
 * Busca `?q=` por nome, CPF/CNPJ (com ou sem máscara), telefone, WhatsApp, e-mail ou placa; filtro `?tipo=pf|pj`.
 * Tabela no desktop, cartões no celular; a linha abre a ficha. Cadastro em painel lateral (`?novo=1`).
 */
type FiltroTipo = "todos" | "pf" | "pj";
const PAGINA = 50;

export function Clientes() {
  const { perfil } = useSessao();
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const consulta = useClientes();
  const agora = useAgora(60_000);
  const [limite, setLimite] = useState(PAGINA);

  const termo = params.get("q") ?? "";
  const filtro: FiltroTipo = params.get("tipo") === "pf" || params.get("tipo") === "pj" ? (params.get("tipo") as FiltroTipo) : "todos";
  const cadastrando = params.get("novo") === "1";
  const podeCadastrar = podeEditar(perfil.papel, "clientes");
  const mostraValor = veDadosSensiveis(perfil.papel);

  function trocar(mudanca: Record<string, string | null>) {
    const novo = new URLSearchParams(params);
    for (const [k, v] of Object.entries(mudanca)) {
      if (v === null || v === "") novo.delete(k);
      else novo.set(k, v);
    }
    setParams(novo, { replace: true });
    setLimite(PAGINA);
  }

  const { buscados, lista } = useMemo(() => {
    const todos = [...(consulta.data ?? [])].sort((a, b) => a.cliente.nome.localeCompare(b.cliente.nome, "pt-BR"));
    const buscados = todos.filter((r) => resumoCorresponde(r, termo));
    const lista = filtro === "todos" ? buscados : buscados.filter((r) => tipoDoCliente(r.cliente) === filtro);
    return { buscados, lista };
  }, [consulta.data, termo, filtro]);

  const total = consulta.data?.length ?? 0;
  const empresas = (consulta.data ?? []).filter((r) => tipoDoCliente(r.cliente) === "pj").length;
  const contar = (t: FiltroTipo) => (consulta.isPending ? "–" : t === "todos" ? buscados.length : buscados.filter((r) => tipoDoCliente(r.cliente) === t).length);
  const hoje = dataNoFuso(agora);

  return (
    <>
      <CabecalhoPagina
        titulo="Clientes"
        resumo={
          consulta.isPending
            ? "Carregando cadastro…"
            : total === 0
              ? "Pessoas e empresas atendidas pela oficina."
              : `${total} ${total === 1 ? "cliente" : "clientes"} · ${empresas} ${empresas === 1 ? "empresa" : "empresas"}`
        }
        acoes={
          podeCadastrar && (
            <Botao variante="primario" icone="mais" onClick={() => trocar({ novo: "1" })}>
              Novo cliente
            </Botao>
          )
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div className="relative w-full md:max-w-[420px]">
          <label htmlFor="busca-clientes" className="sr-only">
            Buscar cliente por nome, CPF/CNPJ, telefone, e-mail ou placa
          </label>
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tinta-fraca pointer-events-none">
            <Icone nome="busca" tamanho={16} />
          </span>
          <input
            id="busca-clientes"
            type="search"
            value={termo}
            onChange={(e) => trocar({ q: e.target.value })}
            placeholder="Nome, CPF/CNPJ, telefone, e-mail ou placa"
            autoComplete="off"
            className="w-full h-11 md:h-10 pl-9 pr-3 bg-cartao border border-linha-forte shadow-controle text-[14px] outline-none transition-[border-color,box-shadow] duration-150 hover:border-tinta-fraca focus:border-tinta-fraca focus:ring-[3px] focus:ring-amarelo/30"
          />
        </div>
        <GrupoFiltros
          rotulo="Tipo de cliente"
          mostrarRotulo={false}
          valor={filtro}
          onMudar={(v) => trocar({ tipo: v === "todos" ? null : v })}
          opcoes={[
            { valor: "todos", texto: "Todos", contagem: contar("todos") },
            { valor: "pf", texto: "Pessoa física", contagem: contar("pf") },
            { valor: "pj", texto: "Pessoa jurídica", contagem: contar("pj") },
          ]}
        />
      </div>

      {consulta.isPending ? (
        <div className={`${SUPERFICIE} p-3`}>
          <Esqueleto linhas={8} altura="h-[52px]" />
        </div>
      ) : consulta.isError ? (
        <Erro mensagem="Não consegui carregar os clientes." onTentar={() => consulta.refetch()} />
      ) : total === 0 ? (
        <Cartao>
          <Vazio
            icone="pessoa"
            titulo="Nenhum cliente cadastrado"
            texto="Cadastre o primeiro cliente aqui ou registre um atendimento: o cliente entra junto com o carro."
            acao={
              podeCadastrar && (
                <Botao variante="primario" icone="mais" onClick={() => trocar({ novo: "1" })}>
                  Novo cliente
                </Botao>
              )
            }
          />
        </Cartao>
      ) : lista.length === 0 ? (
        <Cartao>
          <Vazio
            icone="busca"
            titulo={termo ? `Nenhum cliente encontrado para “${termo}”` : "Nenhum cliente neste filtro"}
            texto="Confira a grafia ou procure pelo CPF/CNPJ, telefone ou placa."
            acao={
              <div className="flex flex-wrap gap-2">
                <Botao onClick={() => trocar({ q: null, tipo: null })}>Limpar busca</Botao>
                {podeCadastrar && (
                  <Botao icone="mais" onClick={() => trocar({ novo: "1" })}>
                    Cadastrar cliente novo
                  </Botao>
                )}
              </div>
            }
          />
        </Cartao>
      ) : (
        <>
          <TabelaClientes lista={lista.slice(0, limite)} hoje={hoje} mostraValor={mostraValor} />
          <CartoesClientes lista={lista.slice(0, limite)} hoje={hoje} mostraValor={mostraValor} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[13px] text-tinta-suave">
            <span className="numero">
              Mostrando {Math.min(limite, lista.length)} de {lista.length}
            </span>
            {lista.length > limite && (
              <Botao tamanho="denso" onClick={() => setLimite((l) => l + PAGINA)}>
                Mostrar mais {Math.min(PAGINA, lista.length - limite)}
              </Botao>
            )}
          </div>
        </>
      )}

      {cadastrando && podeCadastrar && (
        <FormCliente onFechar={() => trocar({ novo: null })} onSalvo={(id) => navegar(`/clientes/${id}`)} />
      )}
    </>
  );
}

// ------------------------------------------------------------------ apoio

function Documento({ r }: { r: ClienteResumo }) {
  const doc = documentoExibicao(r.cliente);
  if (!doc) return <span className="text-tinta-fraca">Sem CPF/CNPJ</span>;
  return (
    <span className="numero">
      <span className="sr-only">{doc.rotulo} </span>
      {doc.valor}
    </span>
  );
}

// ------------------------------------------------------------------ desktop

function TabelaClientes({ lista, hoje, mostraValor }: { lista: ClienteResumo[]; hoje: string; mostraValor: boolean }) {
  const navegar = useNavigate();
  const ano = hoje.slice(0, 4);
  return (
    <Tabela legenda="Clientes" className="hidden md:block">
      <thead>
        <tr>
          <Th className="pl-4">Cliente</Th>
          <Th>Contato</Th>
          <Th>Veículos</Th>
          <Th direita>OS</Th>
          <Th>Última OS</Th>
          {mostraValor && (
            <Th direita className="pr-4">
              Total pago
            </Th>
          )}
        </tr>
      </thead>
      <tbody>
        {lista.map((r) => {
          const c = r.cliente;
          const tel = c.telefone ?? c.whatsapp;
          return (
            <tr key={c.id} onClick={() => navegar(`/clientes/${c.id}`)} className={`${CLASSE_LINHA} cursor-pointer`}>
              <td className="pl-4 pr-3 py-2.5 h-[60px] align-middle">
                <div className="flex items-center gap-3 min-w-0 max-w-[340px]">
                  <AvatarCliente nome={c.nome} />
                  <div className="min-w-0">
                    <span className="flex items-center gap-2 min-w-0">
                      <Link
                        to={`/clientes/${c.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-tinta no-underline hover:underline underline-offset-4 truncate"
                      >
                        {c.nome}
                      </Link>
                      {tipoDoCliente(c) === "pj" && <EtiquetaPJ />}
                    </span>
                    <span className="block text-[13px] text-tinta-suave truncate">
                      <Documento r={r} />
                    </span>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5 align-middle">
                <div className="min-w-0 max-w-[260px]">
                  {tel ? (
                    <span className="flex items-center gap-2">
                      <span className="numero whitespace-nowrap">{formatarTelefone(tel)}</span>
                      {c.whatsapp && <BotaoWhatsApp numero={c.whatsapp} nome={c.nome} icone="pequeno" className="shrink-0" />}
                    </span>
                  ) : (
                    <span className="block text-tinta-fraca">Sem telefone</span>
                  )}
                  {c.email && <span className="block text-[13px] text-tinta-suave truncate">{c.email}</span>}
                </div>
              </td>
              <td className="px-3 py-2.5 align-middle">
                <PlacasDoCliente veiculos={r.veiculos} />
              </td>
              <td className="px-3 py-2.5 align-middle text-right numero font-medium">{r.quantidadeOS}</td>
              <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                {r.ultimaOSEm ? (
                  <>
                    <span className="block numero">{dataCurta(dataNoFuso(r.ultimaOSEm), ano)}</span>
                    <span className="block text-[12px] text-tinta-suave">{haQuanto(r.ultimaOSEm, hoje)}</span>
                  </>
                ) : (
                  <span className="text-tinta-fraca">Nenhuma</span>
                )}
              </td>
              {mostraValor && (
                <td className="pl-3 pr-4 py-2.5 align-middle text-right numero whitespace-nowrap">
                  {r.totalPago > 0 ? <span className="font-semibold">{formatarReais(r.totalPago)}</span> : <span className="text-tinta-fraca">—</span>}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </Tabela>
  );
}

// ------------------------------------------------------------------ celular

function CartoesClientes({ lista, hoje, mostraValor }: { lista: ClienteResumo[]; hoje: string; mostraValor: boolean }) {
  return (
    <ul className="md:hidden flex flex-col gap-2">
      {lista.map((r) => {
        const c = r.cliente;
        const tel = c.telefone ?? c.whatsapp;
        return (
          <li key={c.id} className={`relative ${SUPERFICIE} p-4 active:bg-cinza-50`}>
            <div className="flex items-start gap-3">
              <AvatarCliente nome={c.nome} tamanho={40} />
              <div className="min-w-0 flex-1">
                <span className="flex items-center gap-2 min-w-0">
                  <Link to={`/clientes/${c.id}`} className="font-semibold text-tinta no-underline truncate after:absolute after:inset-0 after:content-['']">
                    {c.nome}
                  </Link>
                  {tipoDoCliente(c) === "pj" && <EtiquetaPJ />}
                </span>
                <span className="block text-[13px] text-tinta-suave truncate">
                  <Documento r={r} />
                </span>
                {tel && <span className="block text-[13px] text-tinta-suave numero">{formatarTelefone(tel)}</span>}
              </div>
              {c.whatsapp && <BotaoWhatsApp numero={c.whatsapp} nome={c.nome} icone className="relative z-10 -mr-1 -mt-1" />}
            </div>
            {r.veiculos.length > 0 && (
              <div className="mt-3">
                <PlacasDoCliente veiculos={r.veiculos} max={3} />
              </div>
            )}
            <div className="mt-3 pt-2.5 border-t border-linha flex items-center justify-between gap-3 text-[13px] numero">
              <span className="text-tinta-suave">
                <strong className="font-semibold text-tinta">{r.quantidadeOS}</strong> OS
                {r.ultimaOSEm && <> · última {haQuanto(r.ultimaOSEm, hoje)}</>}
              </span>
              {mostraValor && r.totalPago > 0 && <span className="font-semibold">{formatarReais(r.totalPago)}</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

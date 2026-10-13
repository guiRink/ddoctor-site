import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ConfigOficina, EtapaOS, FaseVistoria, MarcoISO, OrcamentoVersao, Pagador, Perfil } from "@compartilhado/tipos";
import { formatarReais } from "@compartilhado/dominio/dinheiro";
import { estadoTitulo, saldoTitulo, valorAprovado } from "@compartilhado/dominio/financeiro";
import { dataNoFuso, diferencaDias } from "@compartilhado/dominio/fuso";
import { formatarPlaca } from "@compartilhado/dominio/placa";
import { semaforoEtapa, semaforoOS } from "@compartilhado/dominio/semaforo";
import { formatarDuracao, tempoBloqueada, tempoEmExecucao, tempoEmFila } from "@compartilhado/dominio/tempos";
import { mensagemErro, useAcoes, useAgora, useConfig, useOS, usePagadores, usePerfis, useTiposReparo } from "../dados/hooks";
import type { OSVisao } from "../dados/repositorio";
import { useSessao } from "../dados/sessao";
import { podeEditar, veDadosSensiveis } from "../dominio/permissoes";
import {
  ESTADO_ETAPA,
  ESTADO_OS,
  ESTADO_TITULO,
  ESTADO_VERSAO,
  FASE_VISTORIA,
  ORIGEM_OS,
  STATUS_EXTERNO,
  STATUS_ITEM,
  TECNICA,
  TIPO_PENDENCIA,
} from "../dominio/rotulos";
import { Botao, BotaoLink, Campo, Cartao, Erro, Esqueleto, Responsavel, Vazio } from "../componentes/ui/Basicos";
import { ProgressoEtapas, nomePerfil } from "../componentes/ui/Carro";
import { Etiqueta, Provisorio, Semaforo } from "../componentes/ui/Estado";
import { Placa } from "../componentes/ui/Placa";
import { Icone } from "../componentes/Icone";
import { LinhaVazia, VerTudo } from "../componentes/orcamentos/Blocos";
import { ProximaAcao } from "../componentes/orcamentos/ProximaAcao";
import { Proveniencia } from "../componentes/ui/Proveniencia";
import { dataCurta, diaCurto, ha, marcoCurto, telefoneLegivel } from "../componentes/orcamentos/formato";
import { LIMITE_VISTORIA_DIAS } from "../componentes/orcamentos/selecoes";

/**
 * Ficha da OS (docs/painel-design.md §5): cabeçalho com Placa grande, estado e próxima ação;
 * corpo em duas colunas — Orçamento, Produção e Fotos à esquerda; cliente, atendimento externo,
 * pendências no portal e recebíveis à direita.
 */
export function FichaOS() {
  const { id } = useParams();
  const { perfil } = useSessao();
  const agora = useAgora();
  const consulta = useOS(id);
  const config = useConfig();
  const perfis = usePerfis();
  const tipos = useTiposReparo();
  const pagadores = usePagadores();

  const voltar = (
    <Link to="/orcamentos" className="inline-flex items-center gap-1.5 h-11 -mt-3 mb-1 text-[13px] font-semibold text-tinta-suave no-underline hover:text-tinta">
      <Icone nome="voltar" tamanho={16} />
      Orçamentos
    </Link>
  );

  const apoioComErro = [config, perfis, tipos].some((c) => c.isError);
  if (consulta.isError || apoioComErro) {
    return (
      <>
        {voltar}
        <Erro
          mensagem="Não consegui carregar esta OS."
          onTentar={() => [consulta, config, perfis, tipos, pagadores].forEach((c) => c.refetch())}
        />
      </>
    );
  }
  // pagadores só bloqueia quem vê dinheiro (no S1 a recepção pode não ter leitura dessa tabela)
  if (consulta.isPending || !config.data || !perfis.data || !tipos.data || (!pagadores.data && !pagadores.isError && veDadosSensiveis(perfil.papel))) {
    return (
      <>
        {voltar}
        <div className="flex gap-4 items-center mb-6">
          <div className="esqueleto w-[168px] h-[60px]" />
          <div className="flex-1 max-w-sm flex flex-col gap-2">
            <div className="esqueleto h-6" />
            <div className="esqueleto h-4 w-2/3" />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Esqueleto linhas={5} altura="h-14" />
          <Esqueleto linhas={4} altura="h-14" />
        </div>
      </>
    );
  }
  if (consulta.data === null) {
    return (
      <>
        {voltar}
        <Cartao>
          <Vazio
            icone="busca"
            titulo="OS não encontrada"
            texto="Ela pode ter sido removida junto com os dados de demonstração. Procure pela placa ou pelo protocolo na busca do topo."
            acao={<BotaoLink para="/orcamentos">Ver todos os orçamentos</BotaoLink>}
          />
        </Cartao>
      </>
    );
  }

  const v = consulta.data;
  const sensivel = veDadosSensiveis(perfil.papel);
  const podeAgir = podeEditar(perfil.papel, "orcamentos");
  const estado = ESTADO_OS[v.os.estado];
  const semaforo = v.etapas.length ? semaforoOS(v.os, v.etapas, agora, config.data) : "neutro";
  const ativo = !["encerrada", "cancelada"].includes(v.os.estado);

  return (
    <>
      {voltar}

      {/* ---------------- cabeçalho: placa, carro, estado e próxima ação */}
      <header className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] items-start mb-6">
        <div className="flex flex-col sm:flex-row items-start gap-x-5 gap-y-3 min-w-0">
          <Placa placa={v.veiculo.placa} tamanho="g" />
          <div className="min-w-0 flex-1">
            <h1 className="titulo-condensado text-[32px] break-words">
              {v.veiculo.modelo ?? "Modelo não informado"}
              {v.veiculo.cor && <span className="text-tinta-suave font-bold"> · {v.veiculo.cor}</span>}
            </h1>
            <p className="mt-1.5 text-[14px] text-tinta-suave">
              <span className="font-semibold text-tinta">{v.cliente.nome}</span>
              <span className="numero"> · OS {v.os.numero}</span> · {ORIGEM_OS[v.os.origem]}
              {v.atendimentos[0] && ` · ${v.atendimentos[0].seguradora}`}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Etiqueta tom={estado.tom}>{estado.texto}</Etiqueta>
              {v.os.estado === "na_oficina" && <Semaforo valor={semaforo} />}
              {v.os.prioridade > 0 && <Etiqueta tom="alerta">{v.os.prioridade === 2 ? "Urgente" : "Prioridade alta"}</Etiqueta>}
              {v.os.demo && <span className="text-[12px] text-tinta-fraca">dado de demonstração</span>}
            </div>
          </div>
        </div>
        <ProximaAcao key={v.os.id} v={v} podeAgir={podeAgir} tipos={tipos.data} />
      </header>

      {/* ---------------- corpo */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] items-start">
        <div className="flex flex-col gap-6 min-w-0">
          <SecaoOrcamento v={v} sensivel={sensivel} />
          <SecaoProducao v={v} agora={agora} config={config.data} perfis={perfis.data} semaforo={semaforo} />
          <SecaoFotos v={v} perfis={perfis.data} />
        </div>
        <div className="flex flex-col gap-6 min-w-0">
          <SecaoCliente v={v} sensivel={sensivel} agora={agora} />
          {v.atendimentos.map((at) => (
            <Cartao
              key={at.id}
              titulo="Atendimento externo"
            >
              <p className="px-4 pt-3">
                <Proveniencia fonte={at.fonte} lidoEm={at.lidoEm} agora={agora} podeDesatualizar={ativo} />
              </p>
              {at.estadoConciliacao !== "ok" && (
                <p role="alert" className="px-4 py-2.5 bg-alerta-claro text-alerta text-[13px] font-semibold">
                  {at.estadoConciliacao === "conflito" ? "Dados do portal divergem dos dados da oficina. Resolver antes de agendar." : "Vínculo com o portal ainda não conferido."}
                </p>
              )}
              <dl className="px-4 py-1">
                <Campo nome="Seguradora">{at.seguradora}</Campo>
                <Campo nome="Protocolo">{at.idExterno && <span className="numero font-semibold select-all">{at.idExterno}</span>}</Campo>
                {at.numeroSinistro && <Campo nome="Sinistro"><span className="numero">{at.numeroSinistro}</span></Campo>}
                <Campo nome="Produto">{at.produto}</Campo>
                <Campo nome="Status">
                  <Etiqueta tom={STATUS_EXTERNO[at.statusNormalizado].tom}>{STATUS_EXTERNO[at.statusNormalizado].texto}</Etiqueta>
                  {at.statusBruto && <span className="block mt-1 text-[12px] text-tinta-suave">No portal: “{at.statusBruto}”</span>}
                </Campo>
                <Campo nome="Abertura">{at.aberturaEm && <span className="numero">{diaCurto(at.aberturaEm)}</span>}</Campo>
                <Campo nome="Limite da vistoria">{at.limiteVistoriaEm && <LimiteVistoria data={at.limiteVistoriaEm} hoje={dataNoFuso(agora)} antesDaEntrada={["rascunho", "aguardando_aprovacao", "aguardando_agendamento", "agendada"].includes(v.os.estado)} />}</Campo>
                <Campo nome="Previsão no portal">{at.previsaoPortal && <span className="numero">{diaCurto(at.previsaoPortal)}</span>}</Campo>
              </dl>
            </Cartao>
          ))}
          {(v.atendimentos.length > 0 || v.pendencias.length > 0) && <SecaoPendencias v={v} agora={agora} perfis={perfis.data} podeAgir={podeAgir} />}
          {sensivel && v.titulos.length > 0 && <SecaoRecebiveis v={v} agora={agora} pagadores={pagadores.data ?? []} />}
          {v.os.observacoes && (
            <Cartao titulo="Observações">
              <p className="px-4 py-3 text-[14px] whitespace-pre-line break-words">{v.os.observacoes}</p>
            </Cartao>
          )}
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ orçamento

function SecaoOrcamento({ v, sensivel }: { v: OSVisao; sensivel: boolean }) {
  if (v.versoes.length === 0) {
    return (
      <Cartao titulo="Orçamento">
        <LinhaVazia>Sem orçamento registrado.</LinhaVazia>
      </Cartao>
    );
  }
  const varias = v.versoes.length > 1;
  return (
    <Cartao titulo="Orçamento" contagem={varias ? v.versoes.length : undefined}>
      <div className={varias ? "grid xl:grid-cols-2 xl:divide-x divide-linha" : ""}>
        {v.versoes.map((ver) => (
          <Versao key={ver.id} ver={ver} sensivel={sensivel} vigente={ver.id === v.versoes[0].id} />
        ))}
      </div>
    </Cartao>
  );
}

function Versao({ ver, sensivel, vigente }: { ver: OrcamentoVersao; sensivel: boolean; vigente: boolean }) {
  const est = ESTADO_VERSAO[ver.estado];
  const aprovado = valorAprovado(ver);
  const orcado = ver.itens.filter((i) => i.statusItem !== "dispensado").reduce((s, i) => s + i.valor, 0);
  const externo = ver.tipo === "externo";
  return (
    <div className={`min-w-0 ${vigente ? "" : "opacity-80"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 border-b border-linha">
        <p className="font-bold">
          Versão {ver.numeroVersao} · {externo ? "externa" : "interna"}
        </p>
        <Etiqueta tom={est.tom}>{est.texto}</Etiqueta>
        <span className="text-[12px] text-tinta-suave numero">criada {marcoCurto(ver.criadoEm)}</span>
      </div>
      {ver.aprovacao && (
        <p className="flex items-start gap-2 px-4 py-2.5 border-b border-linha bg-ok-claro text-[13px]">
          <Icone nome="ok" tamanho={16} className="text-ok mt-0.5 shrink-0" />
          <span className="min-w-0">
            <span className="font-semibold">
              Aprovado {ver.aprovacao.tipo === "cliente" ? "pelo cliente" : ver.aprovacao.tipo === "externa" ? "no portal" : "internamente"} em{" "}
              <span className="numero">{marcoCurto(ver.aprovacao.aprovadoEm)}</span>
            </span>
            {ver.aprovacao.evidencia && <span className="block text-tinta-suave break-words">“{ver.aprovacao.evidencia}”</span>}
          </span>
        </p>
      )}
      {ver.itens.length === 0 ? (
        <LinhaVazia>Nenhuma peça nesta versão.</LinhaVazia>
      ) : (
        <table className="w-full border-collapse text-[14px]">
          <caption className="sr-only">Peças da versão {ver.numeroVersao}</caption>
          <thead>
            <tr className="text-left border-b border-linha bg-papel">
              <th scope="col" className="rotulo text-tinta-suave px-4 h-9">Peça</th>
              <th scope="col" className="rotulo text-tinta-suave px-3 hidden sm:table-cell">Técnica</th>
              {sensivel && <th scope="col" className="rotulo text-tinta-suave px-3 text-right">Valor</th>}
              <th scope="col" className="rotulo text-tinta-suave px-4 text-right">Situação</th>
            </tr>
          </thead>
          <tbody>
            {ver.itens.map((it) => {
              const st = STATUS_ITEM[it.statusItem];
              return (
                <tr key={it.id} className="border-b border-linha last:border-b-0 align-middle">
                  <td className="px-4 py-2.5">
                    <span className={`block font-semibold break-words ${it.statusItem === "negado" ? "line-through decoration-alerta/60 text-tinta-suave" : ""}`}>{it.peca}</span>
                    <span className="block text-[12px] text-tinta-suave sm:hidden">{TECNICA[it.tecnica]}</span>
                    {it.descricao && <span className="block text-[12px] text-tinta-suave">{it.descricao}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-tinta-suave hidden sm:table-cell whitespace-nowrap">{TECNICA[it.tecnica]}</td>
                  {sensivel && <td className="px-3 py-2.5 text-right numero whitespace-nowrap">{it.valor > 0 ? formatarReais(it.valor) : "—"}</td>}
                  <td className="px-4 py-2.5 text-right">
                    <Etiqueta tom={st.tom}>{st.texto}</Etiqueta>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {sensivel && (
        <dl className="px-4 py-2 border-t border-linha bg-papel/60">
          {ver.estado === "aprovado" ? (
            <Total nome={externo ? "Autorizado" : "Aprovado"} forte>
              {formatarReais(aprovado)}
            </Total>
          ) : (
            <Total nome="Orçado (a aprovar)">{orcado > 0 ? formatarReais(orcado) : "sem valor"}</Total>
          )}
          {ver.franquia !== undefined && <Total nome="Franquia (paga na oficina)">{formatarReais(ver.franquia)}</Total>}
          {ver.tetoCobertura !== undefined && (
            <Total nome="Teto de mão de obra">
              <Provisorio>{formatarReais(ver.tetoCobertura)}</Provisorio>
            </Total>
          )}
          {externo && <Total nome="Complemento particular">{ver.complementoParticular ? formatarReais(ver.complementoParticular) : "—"}</Total>}
        </dl>
      )}
    </div>
  );
}

function Total({ nome, forte = false, children }: { nome: string; forte?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className={`text-[13px] ${forte ? "font-bold" : "text-tinta-suave"}`}>{nome}</dt>
      <dd className={`m-0 numero whitespace-nowrap ${forte ? "text-[16px] font-bold" : ""}`}>{children}</dd>
    </div>
  );
}

// ------------------------------------------------------------------ produção

function SecaoProducao({
  v,
  agora,
  config,
  perfis,
  semaforo,
}: {
  v: OSVisao;
  agora: MarcoISO;
  config: ConfigOficina;
  perfis: Perfil[];
  semaforo: ReturnType<typeof semaforoOS>;
}) {
  const atual = v.etapas.find((e) => ["na_fila", "em_execucao", "bloqueada"].includes(e.estado));
  return (
    <Cartao
      titulo="Produção"
      acao={v.os.estado === "na_oficina" ? <VerTudo para="/producao" rotulo="Abrir o quadro da produção">Quadro</VerTudo> : undefined}
    >
      {v.etapas.length === 0 ? (
        <LinhaVazia>As etapas aparecem quando a entrada do carro for registrada: o tipo de reparo define a sequência.</LinhaVazia>
      ) : (
        <>
          <div className="px-4 py-3 border-b border-linha">
            <ProgressoEtapas etapas={v.etapas} semaforo={atual ? semaforoEtapa(atual, agora, config) : semaforo} />
            <p className="mt-2 text-[13px] text-tinta-suave numero flex flex-wrap gap-x-3 gap-y-1">
              {v.tipoReparo && (
                <span>
                  {v.tipoReparo.provisorio ? <Provisorio>{v.tipoReparo.nome}</Provisorio> : v.tipoReparo.nome}
                </span>
              )}
              {v.os.entradaRealEm && <span>entrada {marcoCurto(v.os.entradaRealEm)}</span>}
              {v.os.previsaoEntrega && <span className="font-semibold text-tinta">entrega prevista {diaCurto(v.os.previsaoEntrega)}</span>}
              {v.os.box && <span>{v.os.box}</span>}
            </p>
          </div>
          <ol>
            {v.etapas.map((e) => (
              <LinhaEtapa key={e.id} e={e} agora={agora} config={config} perfis={perfis} />
            ))}
          </ol>
        </>
      )}
    </Cartao>
  );
}

function LinhaEtapa({ e, agora, config, perfis }: { e: EtapaOS; agora: MarcoISO; config: ConfigOficina; perfis: Perfil[] }) {
  const est = ESTADO_ETAPA[e.estado];
  const ativa = ["na_fila", "em_execucao", "bloqueada"].includes(e.estado);
  const cor = ativa ? semaforoEtapa(e, agora, config) : "neutro";
  const tempos: string[] = [];
  if (e.entrouFilaEm && (e.iniciadaEm || e.estado === "na_fila")) tempos.push(`fila ${formatarDuracao(tempoEmFila(e, agora))}`);
  if (e.iniciadaEm) tempos.push(`execução ${formatarDuracao(tempoEmExecucao(e, agora))}`);
  const bloq = tempoBloqueada(e, agora);
  if (bloq > 0) tempos.push(`impedida ${formatarDuracao(bloq)}`);
  const motivo = e.estado === "bloqueada" ? e.bloqueios.at(-1)?.motivo : undefined;
  return (
    <li
      className={`grid grid-cols-[28px_minmax(0,1fr)_auto] sm:grid-cols-[28px_minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-x-3 gap-y-1 items-center px-4 py-3 border-b border-linha last:border-b-0 ${
        ativa ? "bg-amarelo-claro/50" : ""
      }`}
    >
      <span className={`numero font-bold text-[13px] ${e.estado === "concluida" ? "text-ok" : "text-tinta-suave"}`}>{e.ordem}</span>
      <span className="min-w-0">
        <span className={`block font-semibold ${e.estado === "dispensada" ? "line-through text-tinta-fraca" : ""}`}>{e.nome}</span>
        <span className="block text-[12px] text-tinta-suave numero">
          {tempos.length ? tempos.join(" · ") : e.estado === "dispensada" ? e.motivoDispensa ?? "Dispensada" : `prazo ${e.prazoHoras} h`}
          {e.pecasPrevistas !== undefined && ` · peças ${e.pecasFeitas ?? 0}/${e.pecasPrevistas}`}
        </span>
        {motivo && <span className="block text-[12px] font-semibold text-alerta">Impedimento: {motivo}</span>}
      </span>
      <span className="hidden sm:block min-w-0">
        <Responsavel nome={nomePerfil(perfis, e.responsavelId)} />
      </span>
      <span className="flex flex-col items-end gap-1">
        {ativa ? <Semaforo valor={cor} texto={e.estado === "bloqueada" ? "Impedida" : undefined} /> : <Etiqueta tom={est.tom}>{est.texto}</Etiqueta>}
        {ativa && e.prazoEm && <span className="text-[12px] text-tinta-suave numero">até {marcoCurto(e.prazoEm)}</span>}
      </span>
    </li>
  );
}

// ------------------------------------------------------------------ fotos

const FASES: FaseVistoria[] = ["entrada", "durante", "final", "externa"];

function SecaoFotos({ v, perfis }: { v: OSVisao; perfis: Perfil[] }) {
  return (
    <Cartao
      titulo="Fotos"
      contagem={v.fotos.length}
      acao={<VerTudo para={`/vistorias?os=${v.os.id}`} rotulo="Abrir as vistorias desta OS">Vistorias</VerTudo>}
    >
      {v.fotos.length === 0 ? (
        <LinhaVazia>
          Nenhuma foto ainda. As fotos de entrada (panorâmica com placa e cada peça) são tiradas em{" "}
          <Link to={`/vistorias?os=${v.os.id}`} className="font-semibold text-tinta underline underline-offset-4">
            Vistorias
          </Link>
          .
        </LinhaVazia>
      ) : (
        <div className="flex flex-wrap gap-x-8 gap-y-4 px-4 py-3">
          {FASES.map((fase) => {
            const fotos = v.fotos.filter((f) => f.fase === fase);
            if (fotos.length === 0) return null;
            return (
              <section key={fase} aria-label={`Fotos: ${FASE_VISTORIA[fase]}`} className="min-w-0">
                <p className="rotulo text-tinta-suave mb-2 numero">
                  {FASE_VISTORIA[fase]} · {fotos.length}
                </p>
                <ul className="flex flex-wrap gap-3">
                  {fotos.map((f) => (
                    <li key={f.id} className="w-[136px]">
                      <Link to={`/vistorias?os=${v.os.id}`} className="block no-underline text-tinta">
                        <img
                          src={f.url}
                          alt={f.legenda ?? `Foto de ${FASE_VISTORIA[fase].toLowerCase()}`}
                          loading="lazy"
                          className="block w-[136px] h-[96px] object-cover bg-linha border border-linha"
                        />
                        <span className="block mt-1 text-[12px] font-semibold truncate">{f.legenda ?? "Sem legenda"}</span>
                        <span className="block text-[11px] text-tinta-suave numero truncate">
                          {marcoCurto(f.tiradaEm)} · {f.origem === "maxpar" ? "Maxpar" : nomePerfil(perfis, f.autorId) ?? "—"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </Cartao>
  );
}

// ------------------------------------------------------------------ cliente e veículo

function SecaoCliente({ v, sensivel, agora }: { v: OSVisao; sensivel: boolean; agora: MarcoISO }) {
  const prov = v.cliente.proveniencia?.nome;
  return (
    <Cartao titulo="Cliente e veículo">
      {prov && (
        <p className="px-4 pt-3">
          <Proveniencia fonte={prov.fonte} lidoEm={prov.lidoEm} agora={agora} podeDesatualizar={false} />
        </p>
      )}
      <dl className="px-4 py-1">
        <Campo nome="Cliente">{v.cliente.nome}</Campo>
        {sensivel && (
          <Campo nome="Telefone">
            {v.cliente.telefone ? (
              <a href={`tel:${v.cliente.telefone}`} className="inline-flex items-center gap-1.5 min-h-11 -my-2.5 font-semibold text-tinta numero underline underline-offset-4">
                <Icone nome="telefone" tamanho={16} />
                {telefoneLegivel(v.cliente.telefone)}
              </a>
            ) : (
              <span className="text-alerta font-semibold">Sem telefone</span>
            )}
          </Campo>
        )}
        {sensivel && v.cliente.email && <Campo nome="E-mail"><span className="break-all">{v.cliente.email}</span></Campo>}
        <Campo nome="Placa"><span className="numero font-semibold select-all">{formatarPlaca(v.veiculo.placa)}</span></Campo>
        <Campo nome="Modelo">{v.veiculo.modelo}</Campo>
        <Campo nome="Cor">{v.veiculo.cor}</Campo>
        {v.veiculo.ano && <Campo nome="Ano"><span className="numero">{v.veiculo.ano}</span></Campo>}
      </dl>
    </Cartao>
  );
}

function LimiteVistoria({ data, hoje, antesDaEntrada }: { data: string; hoje: string; antesDaEntrada: boolean }) {
  const dias = diferencaDias(hoje, data);
  const alerta = antesDaEntrada && dias <= LIMITE_VISTORIA_DIAS;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="numero">{diaCurto(data)}</span>
      {alerta && <Etiqueta tom={dias <= 0 ? "alerta" : "atencao"}>{dias < 0 ? "Venceu" : dias === 0 ? "Vence hoje" : `Em ${dias} ${dias === 1 ? "dia" : "dias"}`}</Etiqueta>}
    </span>
  );
}

// ------------------------------------------------------------------ pendências no portal

function SecaoPendencias({ v, agora, perfis, podeAgir }: { v: OSVisao; agora: MarcoISO; perfis: Perfil[]; podeAgir: boolean }) {
  const acoes = useAcoes();
  const [erro, setErro] = useState<{ id: string; texto: string } | null>(null);
  const [concluindo, setConcluindo] = useState<string | null>(null);
  const abertas = v.pendencias.filter((p) => p.estado === "aberta" || p.estado === "em_andamento");
  const feitas = v.pendencias.filter((p) => p.estado === "concluida");

  async function concluir(id: string) {
    setErro(null);
    setConcluindo(id);
    try {
      const r = await acoes.concluirPendencia.mutateAsync([id]);
      if (!r.ok) setErro({ id, texto: mensagemErro(r.codigo) });
    } catch {
      setErro({ id, texto: mensagemErro() });
    } finally {
      setConcluindo(null);
    }
  }

  return (
    <Cartao titulo="Pendências no portal" contagem={abertas.length}>
      {abertas.length === 0 ? (
        <LinhaVazia>Nenhuma ação pendente no portal.</LinhaVazia>
      ) : (
        <ul>
          {abertas.map((p) => (
            <li key={p.id} className="px-4 py-3 border-b border-linha last:border-b-0">
              <p className={`font-bold ${p.tipo === "reenviar_documentacao" ? "text-alerta" : ""}`}>{TIPO_PENDENCIA[p.tipo]}</p>
              <p className="mt-0.5 text-[13px] text-tinta-suave break-words">{p.descricao}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] text-tinta-suave numero">
                  aberta {ha(p.criadaEm, agora)}
                  {p.responsavelId && ` · ${nomePerfil(perfis, p.responsavelId) ?? ""}`}
                </span>
                {podeAgir && (
                  <Botao
                    tamanho="denso"
                    variante="contorno"
                    icone="ok"
                    disabled={concluindo === p.id}
                    onClick={() => concluir(p.id)}
                    aria-label={`Marcar como feito: ${TIPO_PENDENCIA[p.tipo]}`}
                  >
                    {concluindo === p.id ? "Salvando…" : "Marcar como feito"}
                  </Botao>
                )}
              </div>
              {erro?.id === p.id && (
                <p role="alert" className="mt-2 text-[13px] font-semibold text-alerta">
                  {erro.texto}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {feitas.length > 0 && (
        <div className="px-4 py-2.5 border-t border-linha bg-papel/60">
          <p className="rotulo text-tinta-fraca mb-1">Feitas</p>
          <ul className="flex flex-col gap-0.5">
            {feitas.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-3 text-[13px] text-tinta-suave">
                <span className="truncate">{TIPO_PENDENCIA[p.tipo]}</span>
                <span className="numero shrink-0">{p.concluidaEm ? dataCurta(dataNoFuso(p.concluidaEm)) : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Cartao>
  );
}

// ------------------------------------------------------------------ recebíveis da OS

function SecaoRecebiveis({ v, agora, pagadores }: { v: OSVisao; agora: MarcoISO; pagadores: Pagador[] }) {
  const hoje = dataNoFuso(agora);
  return (
    <Cartao titulo="Recebíveis da OS" contagem={v.titulos.length} acao={<VerTudo para="/recebiveis" rotulo="Abrir recebíveis">Recebíveis</VerTudo>}>
      <ul>
        {v.titulos.map((t) => {
          const est = ESTADO_TITULO[estadoTitulo(t, hoje)];
          const saldo = saldoTitulo(t);
          return (
            <li key={t.id} className="px-4 py-3 border-b border-linha last:border-b-0">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-semibold break-words">{t.descricao}</span>
                  <span className="block text-[12px] text-tinta-suave">{pagadores.find((p) => p.id === t.pagadorId)?.nome ?? "Pagador não informado"}</span>
                </span>
                <span className="font-bold numero whitespace-nowrap">{formatarReais(t.valor)}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                <Etiqueta tom={est.tom}>{est.texto}</Etiqueta>
                <span className="text-[12px] text-tinta-suave numero">
                  vence {diaCurto(t.vencimento)}
                  {saldo > 0 && saldo !== t.valor && ` · saldo ${formatarReais(saldo)}`}
                  {t.nfNumero && ` · NF ${t.nfNumero}`}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </Cartao>
  );
}

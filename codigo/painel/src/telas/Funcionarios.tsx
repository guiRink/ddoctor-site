import { Fragment, useMemo, useState } from "react";
import type { EtapaOS, Perfil } from "@compartilhado/tipos";
import { dataNoFuso, formatarMarco, msDeLocal, paraMs, somarDias } from "@compartilhado/dominio/fuso";
import { formatarDuracao, tempoEmExecucao } from "@compartilhado/dominio/tempos";
import { useAgora, useOSs, usePerfis } from "../dados/hooks";
import type { OSVisao } from "../dados/repositorio";
import { useSessao } from "../dados/sessao";
import { ESTADO_ETAPA } from "../dominio/rotulos";
import { Botao, CabecalhoPagina, Responsavel, Vazio } from "../componentes/ui/Basicos";
import { Etiqueta, Provisorio } from "../componentes/ui/Estado";
import { EstadoConsultas } from "../componentes/gestao/Consultas";
import { PlacaOS } from "../componentes/gestao/Comuns";
import { GrupoFiltros } from "../componentes/gestao/Filtros";
import { Linha, Tabela, Td, Th } from "../componentes/gestao/Tabela";
import { numerosPessoa, type NumerosPessoa } from "../componentes/gestao/resumos";
import { dataComSemana, dataCurta } from "../componentes/gestao/formato";

type Periodo = "7dias" | "30dias";

export function Funcionarios() {
  const perfisQ = usePerfis();
  const ossQ = useOSs();
  return (
    <EstadoConsultas consultas={[perfisQ, ossQ]} linhas={5}>
      {() => <Conteudo perfis={perfisQ.data!} oss={ossQ.data!} />}
    </EstadoConsultas>
  );
}

function Conteudo({ perfis, oss }: { perfis: Perfil[]; oss: OSVisao[] }) {
  const agora = useAgora(60_000);
  const hoje = dataNoFuso(agora);
  const ano = hoje.slice(0, 4);
  const { perfil } = useSessao();
  const [periodo, setPeriodo] = useState<Periodo>("7dias");
  const [aberto, setAberto] = useState<string | null>(null);

  // Janela móvel: 7 dias = de hoje − 6 dias 00:00 até agora (a semana que passou); 30 dias = de hoje − 29.
  const inicioData = somarDias(hoje, periodo === "7dias" ? -6 : -29);
  const desde = formatarMarco(msDeLocal(inicioData, 0));

  const etapas = useMemo(() => oss.flatMap((v) => v.etapas), [oss]);
  const porOS = useMemo(() => new Map(oss.map((v) => [v.os.id, v])), [oss]);
  // Produção vê só os próprios números (arq. §9.1, "L*").
  const pessoas = perfis.filter((p) => p.ativo && p.papel === "producao" && (perfil.papel !== "producao" || p.id === perfil.id));
  const linhas = pessoas.map((p) => ({ p, n: numerosPessoa(etapas, p.id, desde, agora) }));
  const totais = {
    concluidas: linhas.reduce((s, l) => s + l.n.concluidas.length, 0),
    pecas: linhas.reduce((s, l) => s + l.n.pecas, 0),
    impedimentos: linhas.reduce((s, l) => s + l.n.impedimentos, 0),
  };
  const textoPeriodo = `desde ${dataComSemana(inicioData)}`;

  return (
    <>
      <CabecalhoPagina
        titulo="Funcionários"
        resumo={
          <>
            O que cada pessoa da produção fez {textoPeriodo}: <span className="numero">{totais.concluidas}</span> etapas,{" "}
            <span className="numero">{totais.pecas}</span> peças.
          </>
        }
        acoes={
          <GrupoFiltros<Periodo>
            rotulo="Período"
            valor={periodo}
            onMudar={(v) => {
              setPeriodo(v);
              setAberto(null);
            }}
            opcoes={[
              { valor: "7dias", texto: "Últimos 7 dias" },
              { valor: "30dias", texto: "Últimos 30 dias" },
            ]}
          />
        }
      />

      <p className="mb-4 text-[13px] text-tinta-suave max-w-[90ch]">
        Números contados das etapas concluídas no painel. Tempo médio é o tempo em execução, sem fila e sem impedimento. Impedimento é contexto, não
        penalidade. Comissão: <Provisorio>só entra se o dono pedir</Provisorio>.
      </p>

      {pessoas.length === 0 ? (
        <div className="bg-cartao border border-linha">
          <Vazio
            icone="funcionarios"
            titulo="Ninguém da produção cadastrado"
            texto="Cadastre funileiros, pintores e polidores em Ajustes → Pessoas e papéis (edição chega no S1). Os números aparecem quando eles concluírem etapas."
          />
        </div>
      ) : (
        <>
          <Tabela legenda={`Produção por pessoa ${textoPeriodo}`} className="hidden md:block">
            <thead>
              <tr>
                <Th>Pessoa</Th>
                <Th>Aparelho</Th>
                <Th direita>Etapas</Th>
                <Th direita>Peças</Th>
                <Th direita>Carros</Th>
                <Th direita>Tempo médio</Th>
                <Th direita>Impedimentos</Th>
                <Th>Agora</Th>
                <Th>
                  <span className="sr-only">Histórico</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ p, n }) => {
                const estaAberto = aberto === p.id;
                return (
                  <Fragment key={p.id}>
                    <Linha destaque={estaAberto}>
                      <Td>
                        <Responsavel nome={p.nome} />
                        <span className="block pl-9 text-[12px] text-tinta-suave">{p.funcao ?? "Produção"}</span>
                      </Td>
                      <Td className="text-tinta-suave whitespace-nowrap">{p.usaTerminal ? "Terminal" : "Celular próprio"}</Td>
                      <Td numero className="font-bold">
                        {n.concluidas.length}
                      </Td>
                      <Td numero>{n.pecas}</Td>
                      <Td numero>{n.carros}</Td>
                      <Td numero>{n.tempoMedio === null ? <span className="text-tinta-fraca">—</span> : formatarDuracao(n.tempoMedio)}</Td>
                      <Td numero className={n.impedimentos ? "text-atencao font-semibold" : ""}>
                        {n.impedimentos}
                      </Td>
                      <Td className="min-w-[230px]">
                        <Agora n={n} porOS={porOS} agora={agora} />
                      </Td>
                      <Td className="text-right">
                        <Botao
                          tamanho="denso"
                          variante={estaAberto ? "fantasma" : "contorno"}
                          aria-expanded={estaAberto}
                          aria-label={`${estaAberto ? "Fechar histórico" : "Histórico"} — ${p.nome}`}
                          onClick={() => setAberto(estaAberto ? null : p.id)}
                          disabled={n.concluidas.length === 0}
                        >
                          {estaAberto ? "Fechar" : "Histórico"}
                        </Botao>
                      </Td>
                    </Linha>
                    {estaAberto && (
                      <tr className="bg-amarelo-claro border-b border-linha">
                        <td colSpan={9} className="px-3 pb-4 pt-1">
                          <Historico etapas={n.concluidas} porOS={porOS} agora={agora} ano={ano} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </Tabela>

          <ul className="md:hidden flex flex-col gap-2" aria-label={`Produção por pessoa ${textoPeriodo}`}>
            {linhas.map(({ p, n }) => {
              const estaAberto = aberto === p.id;
              return (
                <li key={p.id} className={`border border-linha p-3.5 ${estaAberto ? "bg-amarelo-claro" : "bg-cartao"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <Responsavel nome={p.nome} />
                      <span className="block pl-9 text-[12px] text-tinta-suave">
                        {p.funcao ?? "Produção"} · {p.usaTerminal ? "terminal" : "celular próprio"}
                      </span>
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-3 numero">
                    <Mini rotulo="Etapas" valor={n.concluidas.length} />
                    <Mini rotulo="Peças" valor={n.pecas} />
                    <Mini rotulo="Carros" valor={n.carros} />
                    <Mini rotulo="Tempo médio" valor={n.tempoMedio === null ? "—" : formatarDuracao(n.tempoMedio)} />
                    <Mini rotulo="Impedimentos" valor={n.impedimentos} className="col-span-2" />
                  </dl>
                  <div className="mt-3 pt-3 border-t border-linha">
                    <Agora n={n} porOS={porOS} agora={agora} />
                  </div>
                  {n.concluidas.length > 0 && (
                    <Botao
                      tamanho="padrao"
                      variante={estaAberto ? "fantasma" : "contorno"}
                      className="mt-3 w-full"
                      aria-expanded={estaAberto}
                      aria-label={`${estaAberto ? "Fechar histórico" : "Histórico"} — ${p.nome}`}
                      onClick={() => setAberto(estaAberto ? null : p.id)}
                    >
                      {estaAberto ? "Fechar histórico" : "Histórico"}
                    </Botao>
                  )}
                  {estaAberto && (
                    <div className="mt-3">
                      <Historico etapas={n.concluidas} porOS={porOS} agora={agora} ano={ano} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}

function Mini({ rotulo, valor, className = "" }: { rotulo: string; valor: string | number; className?: string }) {
  return (
    <div className={className}>
      <dt className="rotulo text-tinta-fraca">{rotulo}</dt>
      <dd className="m-0 text-[16px] font-bold">{valor}</dd>
    </div>
  );
}

/** Etapa em andamento agora (em execução ou impedida), com a placa. */
function Agora({ n, porOS, agora }: { n: NumerosPessoa; porOS: Map<string, OSVisao>; agora: string }) {
  if (n.emAndamento.length === 0) return <span className="text-[13px] text-tinta-fraca">Nenhuma etapa em andamento</span>;
  return (
    <ul className="flex flex-col gap-1.5">
      {n.emAndamento.map((e) => (
        <li key={e.id} className="flex items-center gap-2.5 min-w-0">
          <PlacaOS v={porOS.get(e.osId)} />
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold truncate">{e.nome}</span>
            {e.estado === "bloqueada" ? (
              <Etiqueta tom="alerta" className="mt-0.5">
                {ESTADO_ETAPA.bloqueada.texto}
              </Etiqueta>
            ) : (
              <span className="block text-[12px] text-tinta-suave numero whitespace-nowrap">exec. {formatarDuracao(tempoEmExecucao(e, agora))}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Historico({ etapas, porOS, agora, ano }: { etapas: EtapaOS[]; porOS: Map<string, OSVisao>; agora: string; ano: string }) {
  return (
    <div className="bg-cartao border border-linha">
      <h3 className="rotulo text-tinta-suave px-4 pt-3 pb-2">Etapas concluídas no período</h3>
      <ul>
        {etapas.map((e) => (
          <li key={e.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 border-t border-linha text-[13px]">
            <PlacaOS v={porOS.get(e.osId)} />
            <span className="min-w-0">
              <span className="block font-semibold truncate">{e.nome}</span>
              <span className="block text-[12px] text-tinta-suave numero">
                {e.concluidaEm ? `concluída ${dataCurta(dataNoFuso(e.concluidaEm), ano)} às ${formatarMarco(paraMs(e.concluidaEm)).slice(11, 16)}` : ""}
                {e.pecasFeitas !== undefined && ` · ${e.pecasFeitas} ${e.pecasFeitas === 1 ? "peça" : "peças"}`}
              </span>
            </span>
            <span className="numero text-right whitespace-nowrap">{formatarDuracao(tempoEmExecucao(e, agora))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

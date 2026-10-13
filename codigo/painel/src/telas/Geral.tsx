import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { AtendimentoExterno, MarcoISO, Perfil } from "@compartilhado/tipos";
import { formatarReais } from "@compartilhado/dominio/dinheiro";
import { dataNoFuso, diferencaDias, minutoDoDia } from "@compartilhado/dominio/fuso";
import { etapaAtual } from "@compartilhado/dominio/semaforo";
import { useAgendamentos, useAgora, useConfig, useOSs, usePerfis, useTitulos } from "../dados/hooks";
import type { OSVisao } from "../dados/repositorio";
import { useSessao } from "../dados/sessao";
import { veDadosSensiveis } from "../dominio/permissoes";
import { JANELA, ORIGEM_OS, TIPO_PENDENCIA } from "../dominio/rotulos";
import { BotaoLink, Cartao, Contagem, Erro, Esqueleto, FaixaIndicadores, Indicador, Vazio } from "../componentes/ui/Basicos";
import { LinhaCarro, nomePerfil } from "../componentes/ui/Carro";
import { Placa } from "../componentes/ui/Placa";
import { Etiqueta, Provisorio, Semaforo } from "../componentes/ui/Estado";
import { LinhaVazia, MaisItens, VerTudo } from "../componentes/orcamentos/Blocos";
import { ProducaoPrevista } from "../componentes/geral/ProducaoPrevista";
import { CalendarioEntregas } from "../componentes/geral/CalendarioEntregas";
import { Proveniencia } from "../componentes/ui/Proveniencia";
import { dataCurta, diaCurto, diaExtenso, ha, hora } from "../componentes/orcamentos/formato";
import {
  LIMITE_SEM_AUTORIZACAO_DIAS,
  LIMITE_VISTORIA_DIAS,
  painelDoDia,
  somaSaldos,
  type ItemTitulo,
  type PainelDoDia,
} from "../componentes/orcamentos/selecoes";

/**
 * Geral — "o dia da oficina em 5 segundos" (docs/painel-design.md §5; informações §1 e §3.1).
 * Elemento dominante: "Precisa de ação". Só leitura: cada número e cada item abre a lista ou a ficha.
 * Recorte por papel (arq. §9.1): recepção vê a parte operacional; financeiro vê o dinheiro.
 */
const MAX_ITENS = 5;
const ficha = (v: OSVisao) => `/orcamentos/${v.os.id}`;

export function Geral() {
  const { perfil } = useSessao();
  const agora = useAgora();
  const oss = useOSs();
  const ags = useAgendamentos();
  const titulos = useTitulos();
  const config = useConfig();
  const perfis = usePerfis();

  const consultas = [oss, ags, titulos, config, perfis];
  if (consultas.some((c) => c.isError)) {
    return (
      <>
        <Topo perfil={perfil} agora={agora} />
        <Erro mensagem="Não consegui carregar o resumo do dia." onTentar={() => consultas.forEach((c) => c.isError && c.refetch())} />
      </>
    );
  }
  if (!oss.data || !ags.data || !titulos.data || !config.data || !perfis.data) {
    return (
      <>
        <Topo perfil={perfil} agora={agora} />
        <div className="esqueleto h-[84px] mb-8 rounded-cartao!" />
        <div className="grid gap-6 xl:grid-cols-3">
          <Esqueleto linhas={4} altura="h-16" />
          <Esqueleto linhas={5} altura="h-16" />
          <Esqueleto linhas={3} altura="h-16" />
        </div>
      </>
    );
  }

  const p = painelDoDia(oss.data, ags.data, titulos.data, agora, config.data);
  const papel = perfil.papel;
  const operacional = papel !== "financeiro";
  const financeiro = veDadosSensiveis(papel) && papel !== "recepcao";
  const totalAcao =
    p.atrasados.length +
    p.semAutorizacao.length +
    p.vistoriaVencendo.length +
    p.aguardandoAgendamento.length +
    p.pendencias.length +
    p.propostasCalia.length;
  const ultimaLeitura = ultimaLeituraExterna(oss.data);
  // Planejamento (produção prevista e calendário de entregas): quem gere a produção.
  const planejamento = papel === "dono" || papel === "gestor";

  if (oss.data.length === 0) {
    return (
      <>
        <Topo perfil={perfil} agora={agora} />
        <Cartao>
          <Vazio
            icone="carro"
            titulo="Nenhum carro registrado ainda"
            texto="Comece pelo primeiro atendimento: placa, cliente e peças em 30 segundos."
            acao={
              <BotaoLink para="/orcamentos/novo" variante="primario" icone="mais">
                Novo atendimento
              </BotaoLink>
            }
          />
        </Cartao>
      </>
    );
  }

  return (
    <>
      <Topo
        perfil={perfil}
        agora={agora}
        resumo={
          operacional
            ? totalAcao === 0
              ? "Nada precisando de ação agora."
              : `${totalAcao} ${totalAcao === 1 ? "item precisa" : "itens precisam"} de ação.`
            : `${p.vencidos.length} ${p.vencidos.length === 1 ? "título vencido" : "títulos vencidos"} a cobrar.`
        }
        direita={
          operacional && ultimaLeitura ? (
            <span className="flex flex-wrap items-center gap-2 text-[13px] text-tinta-suave">
              Maxpar, último registro
              <Proveniencia fonte={ultimaLeitura.fonte} lidoEm={ultimaLeitura.lidoEm} agora={agora} />
            </span>
          ) : undefined
        }
      />

      {operacional && <FaixaDoDia p={p} />}

      {operacional ? (
        <div className={`grid gap-6 items-start ${financeiro ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)]" : "xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"}`}>
          <Coluna titulo="Hoje" className="order-2 xl:order-none">
            <ColunaHoje p={p} agora={agora} />
          </Coluna>
          <Coluna titulo="Precisa de ação" total={totalAcao} destaque className="order-1 xl:order-none">
            <ColunaAcao p={p} agora={agora} perfis={perfis.data} />
          </Coluna>
          {financeiro && (
            <Coluna titulo="Dinheiro" className="order-3 xl:order-none">
              <ColunaDinheiro p={p} agora={agora} />
            </Coluna>
          )}
        </div>
      ) : (
        <div className="grid gap-6 items-start lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Coluna titulo="Dinheiro" destaque>
            <ColunaDinheiro p={p} agora={agora} />
          </Coluna>
          <Coluna titulo="Segura o recebimento" total={p.pendencias.length}>
            <GrupoPendencias p={p} agora={agora} vazio />
          </Coluna>
        </div>
      )}

      {planejamento && (
        <section aria-labelledby="geral-planejamento" className="mt-10">
          <h2 id="geral-planejamento" className="titulo text-[18px] text-tinta-suave mb-4">
            Planejamento
          </h2>
          <div className="grid gap-6 items-start xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
            <ProducaoPrevista oss={oss.data} config={config.data} hoje={p.hoje} />
            <CalendarioEntregas oss={oss.data} hoje={p.hoje} />
          </div>
        </section>
      )}
    </>
  );
}

// ------------------------------------------------------------------ cabeçalho

function saudacao(agora: MarcoISO): string {
  const min = minutoDoDia(agora);
  return min < 12 * 60 ? "Bom dia" : min < 18 * 60 ? "Boa tarde" : "Boa noite";
}

function Topo({ perfil, agora, resumo, direita }: { perfil: Perfil; agora: MarcoISO; resumo?: string; direita?: ReactNode }) {
  const primeiroNome = perfil.nome.split(" ")[0];
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 mb-6">
      <div className="min-w-0">
        <p className="text-[14px] text-tinta-suave">
          {saudacao(agora)}, {primeiroNome}.
        </p>
        <h1 className="titulo-pagina mt-0.5">{diaExtenso(dataNoFuso(agora))}</h1>
        {resumo && <p className="mt-1 text-[14px] font-medium">{resumo}</p>}
      </div>
      {direita}
    </header>
  );
}

// ------------------------------------------------------------------ faixa com os 4 números do dia

function FaixaDoDia({ p }: { p: PainelDoDia }) {
  const atrasados = p.atrasados.filter((a) => a.semaforo === "vermelho").length;
  return (
    <nav aria-label="Números do dia" className="mb-8">
      <FaixaIndicadores colunas={4}>
        <Indicador rotulo="Na oficina agora" valor={p.naOficina.length} para="/orcamentos?estado=na_oficina,pronta" />
        <Indicador rotulo="Entram hoje" valor={p.entradasHoje.length} para="/agenda" />
        <Indicador rotulo="Saem hoje" valor={p.saemHoje.length} para="/producao?filtro=hoje" />
        <Indicador rotulo="Atrasados" valor={atrasados} alerta={atrasados > 0} para="/producao?filtro=atrasados" />
      </FaixaIndicadores>
    </nav>
  );
}

// ------------------------------------------------------------------ colunas

function Coluna({
  titulo,
  total,
  destaque = false,
  className = "",
  children,
}: {
  titulo: string;
  total?: number;
  destaque?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={titulo} className={`min-w-0 flex flex-col gap-4 ${className}`}>
      <h2 className={`flex items-center gap-2 h-7 titulo ${destaque ? "text-[18px] text-tinta" : "text-[18px] text-tinta-suave"}`}>
        {titulo}
        {total !== undefined && (
          <Contagem n={total} tom={total > 0 && destaque ? "alerta" : "neutro"} />
        )}
      </h2>
      {children}
    </section>
  );
}

function ColunaHoje({ p, agora }: { p: PainelDoDia; agora: MarcoISO }) {
  const manha = p.entradasHoje.filter((e) => e.ag.janela === "manha");
  const tarde = p.entradasHoje.filter((e) => e.ag.janela === "tarde");
  return (
    <>
      <Cartao titulo="Entram hoje" contagem={p.entradasHoje.length} acao={<VerTudo para="/agenda" rotulo="Abrir a agenda">Agenda</VerTudo>}>
        {p.entradasHoje.length === 0 ? (
          <LinhaVazia>Nenhuma entrada marcada para hoje. Os carros aprovados esperam na fila da Agenda.</LinhaVazia>
        ) : (
          [
            { nome: JANELA.manha, itens: manha },
            { nome: JANELA.tarde, itens: tarde },
          ].map((j) => (
            <div key={j.nome} className="border-t border-linha first:border-t-0">
              <Faixa>
                {j.nome} <span className="text-tinta-fraca">· {j.itens.length}</span>
              </Faixa>
              {j.itens.length === 0 ? (
                <LinhaVazia>Sem entrada.</LinhaVazia>
              ) : (
                j.itens.map(({ v, ag }) => (
                  <LinhaCarro
                    key={ag.id}
                    v={v}
                    para={ficha(v)}
                    detalhe={`${v.cliente.nome} · ${origemCurta(v)}`}
                    direita={ag.origem === "calia" ? <Etiqueta tom="maxpar">Calia</Etiqueta> : undefined}
                  />
                ))
              )}
            </div>
          ))
        )}
      </Cartao>

      <Cartao titulo="Saem hoje" contagem={p.saemHoje.length} acao={<VerTudo para="/producao?filtro=hoje" rotulo="Ver entregas de hoje na produção" />}>
        {p.saemHoje.length === 0 ? (
          <LinhaVazia>Nenhuma entrega prevista para hoje.</LinhaVazia>
        ) : (
          p.saemHoje.map((v) => {
            const atual = etapaAtual(v.etapas);
            return (
              <LinhaCarro
                key={v.os.id}
                v={v}
                para={ficha(v)}
                detalhe={v.os.estado === "pronta" ? v.cliente.nome : atual ? `Em produção · ${atual.nome}` : v.cliente.nome}
                direita={v.os.estado === "pronta" ? <Etiqueta tom="ok">Pronto</Etiqueta> : undefined}
              />
            );
          })
        )}
      </Cartao>

      <Cartao
        titulo="Prontos aguardando retirada"
        contagem={p.prontos.length}
        acao={p.prontos.length > MAX_ITENS ? <VerTudo para="/orcamentos?estado=pronta" rotulo="Ver todos os prontos" /> : undefined}
      >
        {p.prontos.length === 0 ? (
          <LinhaVazia>Nenhum carro pronto esperando o cliente.</LinhaVazia>
        ) : (
          <>
            {p.prontos.slice(0, MAX_ITENS).map((v) => (
              <LinhaCarro
                key={v.os.id}
                v={v}
                para={ficha(v)}
                detalhe={`${v.cliente.nome}${v.os.prontaEm ? ` · pronto ${ha(v.os.prontaEm, agora)}` : ""}`}
                direita={
                  v.os.previsaoEntrega ? <span className="text-[12px] text-tinta-suave numero">prev. {diaCurto(v.os.previsaoEntrega)}</span> : undefined
                }
              />
            ))}
            <MaisItens restantes={p.prontos.length - MAX_ITENS} para="/orcamentos?estado=pronta" />
          </>
        )}
      </Cartao>
    </>
  );
}

function ColunaAcao({ p, agora, perfis }: { p: PainelDoDia; agora: MarcoISO; perfis: Perfil[] }) {
  const total =
    p.atrasados.length + p.semAutorizacao.length + p.vistoriaVencendo.length + p.aguardandoAgendamento.length + p.pendencias.length + p.propostasCalia.length;
  if (total === 0) {
    return (
      <Cartao>
        <div className="flex items-center gap-3 px-4 py-6">
          <span className="inline-block w-2 h-2 rounded-full bg-ok shrink-0" aria-hidden="true" />
          <p className="font-medium">Tudo em dia. Nenhum carro atrasado, nenhuma pendência no portal.</p>
        </div>
      </Cartao>
    );
  }
  return (
    <>
      {p.atrasados.length > 0 && (
        <Cartao
          titulo="Atrasados e impedidos"
          contagem={p.atrasados.length}
          acao={<VerTudo para="/producao?filtro=atrasados" rotulo="Ver atrasados na produção" />}
        >
          {p.atrasados.slice(0, MAX_ITENS).map(({ v, semaforo, impedido }) => {
            const atual = etapaAtual(v.etapas);
            const motivo = impedido ? atual?.bloqueios.at(-1)?.motivo : undefined;
            const quem = nomePerfil(perfis, atual?.responsavelId);
            return (
              <LinhaCarro
                key={v.os.id}
                v={v}
                para={ficha(v)}
                detalhe={
                  motivo ? (
                    <span className="text-alerta font-semibold">{motivo}</span>
                  ) : (
                    [atual?.nome, quem, v.os.previsaoEntrega && `entrega ${diaCurto(v.os.previsaoEntrega)}`].filter(Boolean).join(" · ")
                  )
                }
                direita={<Semaforo valor={semaforo === "vermelho" ? "vermelho" : "laranja"} texto={impedido ? "Impedido" : undefined} />}
              />
            );
          })}
          <MaisItens restantes={p.atrasados.length - MAX_ITENS} para="/producao?filtro=atrasados" />
        </Cartao>
      )}

      {p.vistoriaVencendo.length > 0 && (
        <Cartao titulo="Vistoria vencendo" contagem={p.vistoriaVencendo.length}>
          {p.vistoriaVencendo.map(({ v, dias, data }) => (
            <LinhaCarro
              key={v.os.id}
              v={v}
              para={ficha(v)}
              detalhe={`${origemCurta(v)} · limite ${diaCurto(data)}`}
              direita={
                <Etiqueta tom={dias <= 0 ? "alerta" : "atencao"}>
                  {dias < 0 ? "Venceu" : dias === 0 ? "Vence hoje" : dias === 1 ? "Vence amanhã" : `Em ${dias} dias`}
                </Etiqueta>
              }
            />
          ))}
          <p className="px-4 py-2 text-[12px] text-tinta-fraca">
            Alerta a <Provisorio>{LIMITE_VISTORIA_DIAS} dias</Provisorio> do limite.
          </p>
        </Cartao>
      )}

      {p.semAutorizacao.length > 0 && (
        <Cartao
          titulo="Sem autorização"
          contagem={p.semAutorizacao.length}
          acao={<VerTudo para="/orcamentos?estado=aguardando_aprovacao" rotulo="Ver todos aguardando aprovação" />}
        >
          {p.semAutorizacao.slice(0, MAX_ITENS).map(({ v, dias }) => (
            <LinhaCarro
              key={v.os.id}
              v={v}
              para={ficha(v)}
              detalhe={`${origemCurta(v)}${v.atendimentos[0]?.idExterno ? ` · ${v.atendimentos[0].idExterno}` : ""}`}
              direita={<Etiqueta tom="atencao">{dias} dias</Etiqueta>}
            />
          ))}
          <MaisItens restantes={p.semAutorizacao.length - MAX_ITENS} para="/orcamentos?estado=aguardando_aprovacao" />
          <p className="px-4 py-2 text-[12px] text-tinta-fraca">
            Aguardando aprovação há mais de <Provisorio>{LIMITE_SEM_AUTORIZACAO_DIAS} dias</Provisorio>.
          </p>
        </Cartao>
      )}

      <GrupoPendencias p={p} agora={agora} />

      {p.propostasCalia.length > 0 && (
        <Cartao titulo="Horário proposto, sem resposta" contagem={p.propostasCalia.length} acao={<VerTudo para="/agenda" rotulo="Abrir a agenda">Agenda</VerTudo>}>
          {p.propostasCalia.map(({ v, ag }) => (
            <LinhaCarro
              key={ag.id}
              v={v}
              para={`/agenda?os=${v.os.id}`}
              detalhe={`${ag.origem === "calia" ? "Calia propôs" : "Proposto"} ${diaCurto(ag.data)} · ${JANELA[ag.janela].toLowerCase()}`}
              direita={ag.expiraEm ? <Etiqueta tom="atencao">expira {hora(ag.expiraEm)}</Etiqueta> : undefined}
            />
          ))}
        </Cartao>
      )}

      {p.aguardandoAgendamento.length > 0 && (
        <Cartao titulo="Aguardando agendamento" contagem={p.aguardandoAgendamento.length} acao={<VerTudo para="/agenda" rotulo="Agendar na agenda">Agendar</VerTudo>}>
          {p.aguardandoAgendamento.slice(0, MAX_ITENS).map((v) => (
            <LinhaCarro
              key={v.os.id}
              v={v}
              para={ficha(v)}
              detalhe={
                v.cliente.telefone ? (
                  `${v.cliente.nome} · aprovado ${ha(v.versoes[0]?.aprovacao?.aprovadoEm ?? v.os.atualizadoEm, agora)}`
                ) : (
                  <span className="text-alerta font-semibold">Sem telefone do cliente</span>
                )
              }
            />
          ))}
          <MaisItens restantes={p.aguardandoAgendamento.length - MAX_ITENS} para="/orcamentos?estado=aguardando_agendamento" />
        </Cartao>
      )}
    </>
  );
}

function GrupoPendencias({ p, agora, vazio = false }: { p: PainelDoDia; agora: MarcoISO; vazio?: boolean }) {
  if (p.pendencias.length === 0 && !vazio) return null;
  return (
    <Cartao titulo="Pendências no portal Maxpar" contagem={p.pendencias.length}>
      {p.pendencias.length === 0 ? (
        <LinhaVazia>Nenhuma ação pendente no portal.</LinhaVazia>
      ) : (
        p.pendencias.map(({ v, p: pd }) => (
          <LinhaCarro
            key={pd.id}
            v={v}
            para={ficha(v)}
            detalhe={
              <span className={pd.tipo === "reenviar_documentacao" ? "text-alerta font-semibold" : undefined}>
                {TIPO_PENDENCIA[pd.tipo]}
              </span>
            }
            direita={<span className="text-[12px] text-tinta-suave numero whitespace-nowrap">{ha(pd.criadaEm, agora)}</span>}
          />
        ))
      )}
    </Cartao>
  );
}

function ColunaDinheiro({ p, agora }: { p: PainelDoDia; agora: MarcoISO }) {
  return (
    <>
      <Cartao titulo="A receber vencido" contagem={p.vencidos.length} acao={<VerTudo para="/recebiveis?faixa=vencido" rotulo="Ver recebíveis vencidos" />}>
        <Total valor={somaSaldos(p.vencidos)} alerta={p.vencidos.length > 0} para="/recebiveis?faixa=vencido" />
        {p.vencidos.slice(0, 4).map((i) => (
          <LinhaTitulo key={i.t.id} i={i} hoje={p.hoje} vencido />
        ))}
        <MaisItens restantes={p.vencidos.length - 4} para="/recebiveis?faixa=vencido" />
      </Cartao>
      <Cartao titulo="A vencer em 7 dias" contagem={p.aVencer7.length} acao={<VerTudo para="/recebiveis?faixa=a_vencer" rotulo="Ver recebíveis a vencer" />}>
        <Total valor={somaSaldos(p.aVencer7)} para="/recebiveis?faixa=a_vencer" />
        {p.aVencer7.slice(0, 4).map((i) => (
          <LinhaTitulo key={i.t.id} i={i} hoje={p.hoje} />
        ))}
        <MaisItens restantes={p.aVencer7.length - 4} para="/recebiveis?faixa=a_vencer" />
      </Cartao>
      <Cartao titulo="Recebido no mês" acao={<VerTudo para="/financeiro" rotulo="Abrir o financeiro" />}>
        <Total valor={p.recebidoMes} para="/financeiro" nota={`baixas de 01/${p.hoje.slice(5, 7)} até hoje · ${dataCurta(p.hoje)}`} />
      </Cartao>
      <p className="text-[12px] text-tinta-fraca numero">Atualizado às {hora(agora)}.</p>
    </>
  );
}

function Total({ valor, para, alerta = false, nota }: { valor: number; para: string; alerta?: boolean; nota?: string }) {
  return (
    <Link to={para} className="block px-4 py-3.5 border-b border-linha last:border-b-0 no-underline text-tinta hover:bg-cinza-50 transition-colors duration-150">
      <span className={`block text-[24px] font-semibold leading-none tracking-[-0.01em] numero whitespace-nowrap ${alerta ? "text-alerta" : ""}`}>{formatarReais(valor)}</span>
      {nota && <span className="block mt-2 text-[12px] text-tinta-suave numero">{nota}</span>}
    </Link>
  );
}

function LinhaTitulo({ i, hoje, vencido = false }: { i: ItemTitulo; hoje: string; vencido?: boolean }) {
  const dias = diferencaDias(i.t.vencimento, hoje);
  const quando = vencido ? `venceu há ${dias} ${dias === 1 ? "dia" : "dias"}` : dias === 0 ? "vence hoje" : `vence ${diaCurto(i.t.vencimento)}`;
  const conteudo = (
    <>
      <span className="flex items-center justify-between gap-3">
        {i.v ? <Placa placa={i.v.veiculo.placa} /> : <span className="font-semibold truncate">{i.t.descricao}</span>}
        <span className="font-semibold numero whitespace-nowrap">{formatarReais(i.saldo)}</span>
      </span>
      <span className="flex items-baseline justify-between gap-3 mt-1 text-[13px]">
        <span className="truncate text-tinta-suave">{i.v ? `${i.v.veiculo.modelo ?? ""} · ${i.t.descricao}` : ""}</span>
        <span className={`shrink-0 numero ${vencido ? "text-alerta font-semibold" : "text-tinta-suave"}`}>{quando}</span>
      </span>
    </>
  );
  const classe = "block px-4 py-2.5 border-b border-linha last:border-b-0";
  if (!i.v) return <div className={classe}>{conteudo}</div>;
  return (
    <Link to={ficha(i.v)} className={`${classe} no-underline text-tinta hover:bg-cinza-50 transition-colors duration-150`}>
      {conteudo}
    </Link>
  );
}

// ------------------------------------------------------------------ helpers

/** Faixa leve dentro do cartão (Manhã / Tarde): só texto, sem fundo. */
function Faixa({ children }: { children: ReactNode }) {
  return <p className="px-4 pt-3 pb-1 text-[12px] font-medium text-tinta-suave numero">{children}</p>;
}

function origemCurta(v: OSVisao): string {
  return v.atendimentos[0]?.seguradora ?? ORIGEM_OS[v.os.origem];
}

function ultimaLeituraExterna(oss: OSVisao[]): AtendimentoExterno | undefined {
  return oss
    .flatMap((v) => v.atendimentos)
    .filter((a) => a.lidoEm)
    .sort((a, b) => (b.lidoEm ?? "").localeCompare(a.lidoEm ?? ""))[0];
}

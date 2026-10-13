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
import { Cartao, Erro, Esqueleto } from "../componentes/ui/Basicos";
import { LinhaCarro, nomePerfil } from "../componentes/ui/Carro";
import { Placa } from "../componentes/ui/Placa";
import { Etiqueta, Provisorio, Semaforo } from "../componentes/ui/Estado";
import { LinhaVazia, MaisItens, Subtitulo, VerTudo } from "../componentes/orcamentos/Blocos";
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
        <div className="esqueleto h-[84px] mb-6" />
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

  if (oss.data.length === 0) {
    return (
      <>
        <Topo perfil={perfil} agora={agora} />
        <Cartao>
          <div className="flex flex-col items-start gap-3 px-6 py-10">
            <p className="text-[16px] font-bold">Nenhum carro registrado ainda</p>
            <p className="text-tinta-suave max-w-prose">Comece pelo primeiro atendimento: placa, cliente e peças em 30 segundos.</p>
            <Link to="/orcamentos/novo" className="inline-flex items-center h-11 px-4 bg-amarelo text-preto font-bold no-underline hover:bg-amarelo-escuro">
              Novo atendimento
            </Link>
          </div>
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
        <h1 className="titulo-condensado text-[32px] mt-1">{diaExtenso(dataNoFuso(agora))}</h1>
        {resumo && <p className="mt-1.5 text-[14px] font-semibold">{resumo}</p>}
      </div>
      {direita}
    </header>
  );
}

// ------------------------------------------------------------------ faixa com os 4 números do dia

function FaixaDoDia({ p }: { p: PainelDoDia }) {
  const numeros: { rotulo: string; valor: number; para: string; alerta?: boolean }[] = [
    { rotulo: "Na oficina agora", valor: p.naOficina.length, para: "/orcamentos?estado=na_oficina,pronta" },
    { rotulo: "Entram hoje", valor: p.entradasHoje.length, para: "/agenda" },
    { rotulo: "Saem hoje", valor: p.saemHoje.length, para: "/producao?filtro=hoje" },
    { rotulo: "Atrasados", valor: p.atrasados.filter((a) => a.semaforo === "vermelho").length, para: "/producao?filtro=atrasados", alerta: true },
  ];
  return (
    <nav aria-label="Números do dia" className="grid grid-cols-2 md:grid-cols-4 bg-cartao border border-linha mb-6">
      {numeros.map((n, i) => (
        <Link
          key={n.rotulo}
          to={n.para}
          aria-label={`${n.rotulo}: ${n.valor}`}
          className={`group flex items-baseline justify-between gap-3 px-4 py-3 min-h-16 no-underline text-tinta hover:bg-amarelo-claro transition-colors duration-150 border-linha ${
            i % 2 === 1 ? "border-l" : ""
          } ${i >= 2 ? "border-t md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""}`}
        >
          <span className="rotulo text-tinta-suave">{n.rotulo}</span>
          <span className={`titulo-condensado numero text-[32px] ${n.alerta && n.valor > 0 ? "text-alerta" : ""}`}>{n.valor}</span>
        </Link>
      ))}
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
      <h2 className={`flex items-center gap-2.5 titulo-condensado ${destaque ? "text-[24px]" : "text-[20px] text-tinta-suave"}`}>
        {titulo}
        {total !== undefined && (
          <span
            className={`inline-grid place-items-center min-w-7 h-7 px-1.5 text-[14px] font-bold numero tracking-normal ${
              total > 0 && destaque ? "bg-alerta text-cartao" : "bg-linha text-tinta-suave"
            }`}
          >
            {total}
          </span>
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
            <div key={j.nome}>
              <Subtitulo>
                {j.nome} · {j.itens.length}
              </Subtitulo>
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
          <span className="inline-block w-2.5 h-2.5 bg-ok" aria-hidden="true" />
          <p className="font-semibold">Tudo em dia. Nenhum carro atrasado, nenhuma pendência no portal.</p>
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
    <Link to={para} className="block px-4 py-3 border-b border-linha no-underline text-tinta hover:bg-amarelo-claro transition-colors duration-150">
      <span className={`block titulo-condensado numero text-[28px] whitespace-nowrap ${alerta ? "text-alerta" : ""}`}>{formatarReais(valor)}</span>
      {nota && <span className="block mt-1 text-[12px] text-tinta-suave numero">{nota}</span>}
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
        <span className="font-bold numero whitespace-nowrap">{formatarReais(i.saldo)}</span>
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
    <Link to={ficha(i.v)} className={`${classe} no-underline text-tinta hover:bg-amarelo-claro transition-colors duration-150`}>
      {conteudo}
    </Link>
  );
}

// ------------------------------------------------------------------ helpers

function origemCurta(v: OSVisao): string {
  return v.atendimentos[0]?.seguradora ?? ORIGEM_OS[v.os.origem];
}

function ultimaLeituraExterna(oss: OSVisao[]): AtendimentoExterno | undefined {
  return oss
    .flatMap((v) => v.atendimentos)
    .filter((a) => a.lidoEm)
    .sort((a, b) => (b.lidoEm ?? "").localeCompare(a.lidoEm ?? ""))[0];
}

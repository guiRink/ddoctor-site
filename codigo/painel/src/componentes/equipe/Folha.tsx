import { Fragment, useId, useState, type ReactNode } from "react";
import type { DataISO } from "@compartilhado/tipos";
import { formatarReais, reaisParaCentavos } from "@compartilhado/dominio/dinheiro";
import { dataNoFuso } from "@compartilhado/dominio/fuso";
import type { LinhaFolha } from "@compartilhado/dominio/folha";
import type { LinhaComissao } from "@compartilhado/dominio/comissoes";
import { mensagemErro, useAcoes, useAgora, useFolha } from "../../dados/hooks";
import type { FolhaDoMes } from "../../dados/repositorio";
import { nomeCompetencia } from "../financeiro/formato";
import { centavosParaCampo, dataComSemana } from "../gestao/formato";
import { Retorno } from "../gestao/Comuns";
import { baixarCsv, nomeArquivoCsv } from "../estoque/csv";
import { formatarPrazo } from "../producao/quadro";
import { BarraFerramentas } from "../ui/Abas";
import { Botao, Erro, Esqueleto, FaixaIndicadores, Indicador, SUPERFICIE, Vazio } from "../ui/Basicos";
import { AreaTexto, CampoComAfixo, LinhaPrevia, Previa, Rotulado, Segmentado, CLASSE_ENTRADA } from "../ui/Campos";
import { Etiqueta, Provisorio } from "../ui/Estado";
import { Gaveta } from "../ui/Gaveta";
import { CLASSE_LINHA, CLASSE_TH, Tabela, Td, Th } from "../ui/Tabela";
import { Placa } from "../ui/Placa";
import { Icone } from "../Icone";
import { comissoesDe, csvFolha, situacaoFolha } from "./modelo";

/**
 * Folha de pagamento do mês (sprint S1) — a mesma na Equipe (aba Folha, dono) e no Financeiro (aba Folha, dono e
 * financeiro). Por pessoa: salário + comissões (clique mostra placa, etapa, data e valor) + ajustes = total, e a
 * situação. "Pagar" vira despesa paga em Salários. O ajuste (vale, desconto, extra) só o dono mexe, antes de pagar.
 */
export function Folha({
  mes,
  seletor,
  podeAjustar,
  podePagar,
}: {
  mes: string;
  /** Seletor de mês (a Equipe mostra; o Financeiro já tem a competência no cabeçalho). */
  seletor?: ReactNode;
  podeAjustar: boolean;
  podePagar: boolean;
}) {
  const q = useFolha(mes);
  if (q.isPending)
    return (
      <div className="flex flex-col gap-6" role="status" aria-label="Carregando a folha">
        <div className="esqueleto h-24" />
        <Esqueleto linhas={5} altura="h-[52px]" />
      </div>
    );
  if (q.isError || !q.data) {
    const semPermissao = q.error instanceof Error && q.error.message === "sem_permissao";
    return semPermissao ? (
      <div className={SUPERFICIE}>
        <Vazio icone="bloqueio" titulo="Sem acesso à folha" texto="Salários e comissões só o dono e o financeiro veem." />
      </div>
    ) : (
      <Erro mensagem="Não consegui carregar a folha." onTentar={() => q.refetch()} />
    );
  }
  return <Conteudo folha={q.data} seletor={seletor} podeAjustar={podeAjustar} podePagar={podePagar} />;
}

type Gaveta = { tipo: "pagar"; linha: LinhaFolha } | { tipo: "ajustar"; linha: LinhaFolha } | null;

function Conteudo({ folha, seletor, podeAjustar, podePagar }: { folha: FolhaDoMes; seletor?: ReactNode; podeAjustar: boolean; podePagar: boolean }) {
  const agora = useAgora(60_000);
  const hoje = dataNoFuso(agora);
  const [aberta, setAberta] = useState<string | null>(null);
  const [gaveta, setGaveta] = useState<Gaveta>(null);
  const [aviso, setAviso] = useState<string>();
  const { linhas, totais, comissoes } = folha;
  const nome = nomeCompetencia(folha.mes);
  const pagos = linhas.filter((l) => l.pago).length;
  const feito = (msg: string) => {
    setGaveta(null);
    setAviso(msg);
  };

  const exportar = () => baixarCsv(nomeArquivoCsv(`folha-${folha.mes}`, hoje), csvFolha(linhas));

  return (
    <>
      <FaixaIndicadores colunas={4} className="mb-6">
        <Indicador rotulo="Total do mês" valor={<span className="whitespace-nowrap">{formatarReais(totais.total)}</span>} detalhe={`${linhas.length} ${linhas.length === 1 ? "pessoa" : "pessoas"}`} />
        <Indicador rotulo="Salários" valor={<span className="whitespace-nowrap">{formatarReais(totais.salarios)}</span>} detalhe={totais.ajustes ? `ajustes ${sinal(totais.ajustes)}` : "salário fixo do mês"} />
        <Indicador rotulo="Comissões" valor={<span className="whitespace-nowrap">{formatarReais(totais.comissoes)}</span>} detalhe={`${comissoes.length} ${comissoes.length === 1 ? "etapa concluída" : "etapas concluídas"}`} />
        <Indicador
          rotulo="A pagar"
          valor={<span className="whitespace-nowrap">{formatarReais(totais.aPagar)}</span>}
          detalhe={pagos ? `${pagos} ${pagos === 1 ? "pago" : "pagos"} · ${formatarReais(totais.pago)}` : "nada pago ainda"}
        />
      </FaixaIndicadores>

      <BarraFerramentas
        filtros={seletor ?? <h2 className="text-[15px] font-semibold first-letter:uppercase">Folha de {nome}</h2>}
        acoes={
          linhas.length > 0 && (
            <Botao tamanho="denso" variante="contorno" icone="documento" onClick={exportar}>
              Exportar CSV
            </Botao>
          )
        }
      />

      {aviso && (
        <div className="mb-4 flex items-center gap-2 px-4 min-h-11 py-2 rounded-cartao bg-ok-claro border border-ok/20">
          <Retorno ok={aviso} />
        </div>
      )}

      {linhas.length === 0 ? (
        <div className={SUPERFICIE}>
          <Vazio
            icone="funcionarios"
            titulo={`Ninguém na folha de ${nome.split(" de ")[0]}`}
            texto="Entram aqui as pessoas ativas da Equipe, com o salário do mês e as comissões das etapas que concluíram."
          />
        </div>
      ) : (
        <>
          <Tabela legenda={`Folha de pagamento de ${nome}`} className="hidden md:block">
            <thead>
              <tr>
                <Th>Funcionário</Th>
                <Th direita>Salário</Th>
                <Th direita>Comissões</Th>
                <Th direita>Ajustes</Th>
                <Th direita>Total</Th>
                <Th>Situação</Th>
                <Th>
                  <span className="sr-only">Ações</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const s = situacaoFolha(l);
                const minhas = comissoesDe(l.perfilId, comissoes);
                const expandida = aberta === l.perfilId;
                return (
                  <Fragment key={l.perfilId}>
                    <tr className={`${CLASSE_LINHA} ${expandida ? "bg-cinza-50" : ""}`}>
                      <Td className="min-w-[200px]">
                        <span className="block text-[14px] font-semibold">{l.nome}</span>
                        <span className="block text-[12px] text-tinta-suave">
                          {l.funcao ?? "Sem função informada"}
                          {!l.ativo && " · desligado"}
                        </span>
                      </Td>
                      <Td numero className={l.salario ? "" : "text-tinta-fraca"}>
                        {l.salario ? formatarReais(l.salario) : "—"}
                      </Td>
                      <Td numero>
                        {l.quantidadeComissoes > 0 ? (
                          <button
                            type="button"
                            aria-expanded={expandida}
                            aria-label={`${expandida ? "Esconder" : "Ver"} as ${l.quantidadeComissoes} comissões de ${l.nome}`}
                            onClick={() => setAberta(expandida ? null : l.perfilId)}
                            className="inline-flex items-center gap-1.5 h-8 -mr-2 px-2 rounded-controle hover:bg-cinza-100 transition-colors duration-150"
                          >
                            <span>{formatarReais(l.comissoes)}</span>
                            <span className="text-[12px] text-tinta-suave">· {l.quantidadeComissoes}</span>
                            <Icone nome="baixo" tamanho={14} className={`text-tinta-fraca transition-transform duration-150 ${expandida ? "rotate-180" : ""}`} />
                          </button>
                        ) : (
                          <span className="text-tinta-fraca">—</span>
                        )}
                      </Td>
                      <Td numero>
                        {(l.ajustes !== 0 || !podeAjustar || l.pago) && <span className={l.ajustes ? "" : "text-tinta-fraca"}>{l.ajustes ? sinal(l.ajustes) : "—"}</span>}
                        {l.pagamento?.obs && <span className="block text-[12px] text-tinta-suave max-w-[180px] truncate ml-auto">{l.pagamento.obs}</span>}
                        {podeAjustar && !l.pago && (
                          <button
                            type="button"
                            onClick={() => setGaveta({ tipo: "ajustar", linha: l })}
                            aria-label={`Ajustar a folha de ${l.nome}`}
                            className={`block ml-auto font-medium text-tinta-suave underline decoration-linha-forte underline-offset-2 hover:text-tinta ${l.ajustes ? "text-[12px]" : "text-[13px]"}`}
                          >
                            {l.ajustes ? "Mudar" : "Ajustar"}
                          </button>
                        )}
                      </Td>
                      <Td numero className="font-semibold">
                        {formatarReais(l.total)}
                      </Td>
                      <Td>
                        <Etiqueta tom={s.tom}>{s.texto}</Etiqueta>
                      </Td>
                      <Td className="text-right w-[1%] whitespace-nowrap">
                        {podePagar && !l.pago && l.total > 0 && (
                          <Botao tamanho="denso" variante="contorno" aria-label={`Pagar a folha de ${l.nome}`} onClick={() => setGaveta({ tipo: "pagar", linha: l })}>
                            Pagar
                          </Botao>
                        )}
                      </Td>
                    </tr>
                    {expandida && (
                      <tr className="bg-cinza-50 border-b border-linha">
                        <td colSpan={7} className="px-3 pb-3 pt-0">
                          <ListaComissoes linhas={minhas} agora={agora} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-linha-forte bg-cinza-50">
                <th scope="row" className={`${CLASSE_TH} text-left bg-transparent border-b-0 h-12`}>
                  Total · {linhas.length} {linhas.length === 1 ? "pessoa" : "pessoas"}
                </th>
                <Td numero className="font-semibold">{formatarReais(totais.salarios)}</Td>
                <Td numero className="font-semibold">{formatarReais(totais.comissoes)}</Td>
                <Td numero className="font-semibold">{totais.ajustes ? sinal(totais.ajustes) : "—"}</Td>
                <Td numero className="font-semibold">{formatarReais(totais.total)}</Td>
                <Td colSpan={2} className="text-[13px] text-tinta-suave whitespace-nowrap">
                  a pagar <span className="numero font-semibold text-tinta">{formatarReais(totais.aPagar)}</span>
                </Td>
              </tr>
            </tfoot>
          </Tabela>

          <ul className="md:hidden flex flex-col gap-2" aria-label={`Folha de pagamento de ${nome}`}>
            {linhas.map((l) => {
              const s = situacaoFolha(l);
              const minhas = comissoesDe(l.perfilId, comissoes);
              const expandida = aberta === l.perfilId;
              return (
                <li key={l.perfilId} className={`${SUPERFICIE} p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold">{l.nome}</span>
                      <span className="block text-[13px] text-tinta-suave">{l.funcao ?? "Sem função informada"}</span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block text-[16px] font-semibold numero">{formatarReais(l.total)}</span>
                      <Etiqueta tom={s.tom} className="mt-1">
                        {s.texto}
                      </Etiqueta>
                    </span>
                  </div>
                  <dl className="m-0 mt-3 flex flex-col text-[13px]">
                    <LinhaValor rotulo="Salário">{l.salario ? formatarReais(l.salario) : "—"}</LinhaValor>
                    <LinhaValor rotulo={`Comissões${l.quantidadeComissoes ? ` · ${l.quantidadeComissoes}` : ""}`}>
                      {l.quantidadeComissoes > 0 ? (
                        <button
                          type="button"
                          aria-expanded={expandida}
                          aria-label={`${expandida ? "Esconder" : "Ver"} as comissões de ${l.nome}`}
                          onClick={() => setAberta(expandida ? null : l.perfilId)}
                          className="inline-flex items-center gap-1.5 min-h-11 -my-3 px-2 -mr-2 rounded-controle hover:bg-cinza-100"
                        >
                          {formatarReais(l.comissoes)}
                          <Icone nome="baixo" tamanho={14} className={`text-tinta-fraca ${expandida ? "rotate-180" : ""}`} />
                        </button>
                      ) : (
                        "—"
                      )}
                    </LinhaValor>
                    {expandida && <ListaComissoes linhas={minhas} agora={agora} />}
                    <LinhaValor rotulo="Ajustes">
                      {l.ajustes ? sinal(l.ajustes) : "—"}
                      {l.pagamento?.obs && <span className="block text-[12px] text-tinta-suave">{l.pagamento.obs}</span>}
                    </LinhaValor>
                  </dl>
                  {((podePagar && !l.pago && l.total > 0) || (podeAjustar && !l.pago)) && (
                    <div className="mt-3 flex gap-2">
                      {podeAjustar && !l.pago && (
                        <Botao variante="contorno" className="flex-1" aria-label={`Ajustar a folha de ${l.nome}`} onClick={() => setGaveta({ tipo: "ajustar", linha: l })}>
                          Ajustar
                        </Botao>
                      )}
                      {podePagar && !l.pago && l.total > 0 && (
                        <Botao variante="contorno" className="flex-1" aria-label={`Pagar a folha de ${l.nome}`} onClick={() => setGaveta({ tipo: "pagar", linha: l })}>
                          Pagar
                        </Botao>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
            <li className={`${SUPERFICIE} px-4 py-3 flex items-center justify-between gap-3`}>
              <span className="text-[13px] text-tinta-suave">A pagar no mês</span>
              <span className="text-[16px] font-semibold numero">{formatarReais(totais.aPagar)}</span>
            </li>
          </ul>

          <p className="mt-4 text-[12px] text-tinta-suave max-w-[90ch] leading-relaxed">
            Comissão: quem conclui a etapa recebe, no mês em que concluiu (valores em Ajustes → Comissões). Pagar lança a despesa em Salários, no
            Financeiro. <Provisorio>Regras a confirmar com a oficina</Provisorio>: quem entrou no meio do mês recebe o salário inteiro; quem saiu acerta pelo ajuste.
          </p>
        </>
      )}

      {gaveta?.tipo === "pagar" && <FormPagarFolha linha={gaveta.linha} hoje={hoje} onFechar={() => setGaveta(null)} onFeito={feito} />}
      {gaveta?.tipo === "ajustar" && <FormAjuste linha={gaveta.linha} onFechar={() => setGaveta(null)} onFeito={feito} />}
    </>
  );
}

/** "+R$ 50,00" / "−R$ 150,00". */
function sinal(c: number): string {
  return c > 0 ? `+${formatarReais(c)}` : `−${formatarReais(-c)}`;
}

function LinhaValor({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-t border-linha">
      <dt className="text-tinta-suave">{rotulo}</dt>
      <dd className="m-0 numero text-right">{children}</dd>
    </div>
  );
}

/** As etapas que formam a comissão: placa, etapa, quando concluiu e o valor. */
function ListaComissoes({ linhas, agora }: { linhas: LinhaComissao[]; agora: string }) {
  return (
    <ul className="rounded-cartao border border-linha bg-cartao overflow-hidden" aria-label="Comissões do mês">
      {linhas.map((c) => (
        <li key={c.etapaId} className="grid grid-cols-[104px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 border-b border-linha last:border-b-0">
          {c.placa ? <Placa placa={c.placa} tamanho="p" /> : <span className="text-tinta-fraca">—</span>}
          <span className="min-w-0">
            <span className="block text-[13px] font-medium truncate">{c.etapa}</span>
            <span className="block text-[12px] text-tinta-suave numero">concluída {formatarPrazo(c.concluidaEm, agora)}</span>
          </span>
          <span className="numero text-[13px] font-semibold text-right">{formatarReais(c.valor)}</span>
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ gavetas

function ResumoLinha({ l, ajuste }: { l: LinhaFolha; ajuste: number }) {
  return (
    <Previa titulo={`${l.nome} · ${nomeCompetencia(l.mes)}`}>
      <LinhaPrevia rotulo="Salário">{formatarReais(l.salario)}</LinhaPrevia>
      <LinhaPrevia rotulo={`Comissões (${l.quantidadeComissoes} ${l.quantidadeComissoes === 1 ? "etapa" : "etapas"})`}>{formatarReais(l.comissoes)}</LinhaPrevia>
      <LinhaPrevia rotulo="Ajustes">{ajuste ? sinal(ajuste) : "—"}</LinhaPrevia>
      <LinhaPrevia rotulo="Total a pagar" forte>
        {formatarReais(l.salario + l.comissoes + ajuste)}
      </LinhaPrevia>
    </Previa>
  );
}

function FormPagarFolha({ linha: l, hoje, onFechar, onFeito }: { linha: LinhaFolha; hoje: DataISO; onFechar: () => void; onFeito: (m: string) => void }) {
  const acoes = useAcoes();
  const [data, setData] = useState(hoje);
  const [erro, setErro] = useState<string>();
  async function enviar() {
    setErro(undefined);
    if (!data || data > hoje) return setErro("Informe a data do pagamento (hoje ou antes).");
    try {
      const r = await acoes.pagarFolha.mutateAsync([l.perfilId, l.mes, data]);
      if (!r.ok) return setErro(mensagemErro(r.codigo));
      onFeito(`Folha de ${l.nome} paga: ${formatarReais(l.total)}. Lançada em Despesas, categoria Salários.`);
    } catch {
      setErro(mensagemErro());
    }
  }
  return (
    <Gaveta titulo="Pagar a folha" descricao="Vira uma despesa paga em Salários, no Financeiro." acao="Registrar pagamento" onFechar={onFechar} onEnviar={enviar} enviando={acoes.pagarFolha.isPending} erro={erro}>
      <ResumoLinha l={l} ajuste={l.ajustes} />
      {l.pagamento?.obs && <p className="text-[13px] text-tinta-suave">Ajuste: {l.pagamento.obs}</p>}
      <Rotulado rotulo="Pago em" dica={data === hoje ? "Hoje." : dataComSemana(data)}>
        <input type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value)} className={`${CLASSE_ENTRADA} numero sm:max-w-[220px]`} />
      </Rotulado>
      <p className="text-[12px] text-tinta-suave">Depois de pago, os valores ficam congelados: comissão de etapa concluída depois entra no mês seguinte.</p>
    </Gaveta>
  );
}

type Sentido = "desconto" | "extra";

function FormAjuste({ linha: l, onFechar, onFeito }: { linha: LinhaFolha; onFechar: () => void; onFeito: (m: string) => void }) {
  const acoes = useAcoes();
  const id = useId();
  const [sentido, setSentido] = useState<Sentido>(l.ajustes > 0 ? "extra" : "desconto");
  const [valor, setValor] = useState(l.ajustes ? centavosParaCampo(Math.abs(l.ajustes)) : "");
  const [obs, setObs] = useState(l.pagamento?.obs ?? "");
  const [erro, setErro] = useState<string>();
  const centavos = valor.trim() ? reaisParaCentavos(valor) : 0;
  const ajuste = centavos === null ? 0 : sentido === "desconto" ? -Math.abs(centavos) : Math.abs(centavos);

  async function enviar() {
    setErro(undefined);
    if (centavos === null || centavos < 0) return setErro(mensagemErro("ajuste_invalido"));
    try {
      const r = await acoes.salvarAjusteFolha.mutateAsync([l.perfilId, l.mes, ajuste, obs]);
      if (!r.ok) return setErro(mensagemErro(r.codigo));
      onFeito(ajuste ? `Ajuste de ${l.nome} salvo: ${sinal(ajuste)}.` : `Ajuste de ${l.nome} zerado.`);
    } catch {
      setErro(mensagemErro());
    }
  }

  return (
    <Gaveta titulo="Ajustar a folha" descricao="Vale, adiantamento ou falta descontam; hora extra ou bônus somam." acao="Salvar ajuste" onFechar={onFechar} onEnviar={enviar} enviando={acoes.salvarAjusteFolha.isPending} erro={erro}>
      <Segmentado<Sentido>
        nome={`${id}-sentido`}
        legenda="Tipo de ajuste"
        larguraTotal
        opcoes={[
          { valor: "desconto", texto: "Desconto ou vale" },
          { valor: "extra", texto: "Extra" },
        ]}
        valor={sentido}
        onMudar={setSentido}
      />
      <Rotulado rotulo="Valor" dica="Vazio ou zero tira o ajuste.">
        <CampoComAfixo prefixo="R$" inputMode="decimal" autoComplete="off" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
      </Rotulado>
      <Rotulado rotulo="Observação" opcional>
        <AreaTexto value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: vale de 10/10" maxLength={120} rows={2} />
      </Rotulado>
      <ResumoLinha l={l} ajuste={ajuste} />
    </Gaveta>
  );
}

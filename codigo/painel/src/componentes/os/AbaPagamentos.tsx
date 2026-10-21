import { useEffect, useId, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { FORMAS_PAGAMENTO, type FormaPagamento, type MarcoISO, type Pagador } from "@compartilhado/tipos";
import { formatarReais, reaisParaCentavos } from "@compartilhado/dominio/dinheiro";
import { estadoTitulo, saldoTitulo } from "@compartilhado/dominio/financeiro";
import { dataNoFuso } from "@compartilhado/dominio/fuso";
import { receitaOS } from "@compartilhado/dominio/custos";
import { resumoPagamentosOS } from "@compartilhado/dominio/pagamentos";
import { mensagemErro, useAcoes } from "../../dados/hooks";
import type { OSVisao } from "../../dados/repositorio";
import { ESTADO_TITULO, FORMA_PAGAMENTO } from "../../dominio/rotulos";
import { descritoPor, formaLegivel } from "./formato";
import type { ClienteDeve } from "./ficha";
import { Botao, Cartao, FaixaIndicadores, Indicador } from "../ui/Basicos";
import { Etiqueta } from "../ui/Estado";
import { dataCurta, diaCurto } from "../orcamentos/formato";
import { AreaTexto, Aviso, CLASSE_CAMPO, CampoComAfixo, Grupo, OpcoesEmGrade, Selecao } from "../ui/Campos";

/**
 * Aba Pagamentos (quem vê dinheiro: veDadosSensiveis — nunca produção nem TV). No topo, o total da OS
 * (o autorizado/aprovado, mesmo antes de existir título), o recebido e o que falta. À esquerda, "Cliente deve":
 * franquia e complemento (ou o serviço particular) desde a aprovação, com pago e falta, e o formulário de
 * pagamento (vira baixa no título do cliente). À direita, as baixas e os títulos.
 * `destaque`: o botão do formulário é o amarelo da tela (a Próxima ação não tem outro). `?pagar=1` foca o valor.
 */
export function AbaPagamentos({
  v,
  agora,
  pagadores,
  podeRegistrar,
  deve,
  destaque = true,
}: {
  v: OSVisao;
  agora: MarcoISO;
  pagadores: Pagador[];
  podeRegistrar: boolean;
  deve: ClienteDeve | null;
  destaque?: boolean;
}) {
  const hoje = dataNoFuso(agora);
  const resumo = resumoPagamentosOS(v.titulos);
  const titulos = v.titulos.filter((t) => t.estado !== "cancelado");
  const baixas = titulos
    .flatMap((t) => t.baixas.map((b) => ({ b, t })))
    .sort((a, b) => b.b.recebidoEm.localeCompare(a.b.recebidoEm));
  const pagador = (id: string) => pagadores.find((p) => p.id === id)?.nome ?? "Pagador não informado";
  const ativa = podeRegistrar && v.os.estado !== "cancelada";
  // antes da entrega ainda não há título: o total é o orçamento aprovado (+ complemento)
  const receita = receitaOS({ versoes: v.versoes, titulos: v.titulos });
  const total = Math.max(resumo.total, receita.valor);
  const falta = Math.max(0, total - resumo.recebido);
  const parteCliente = deve?.total ?? 0;
  const parteSeguradora = v.os.origem === "particular" ? 0 : Math.max(0, total - parteCliente);
  const vencido = titulos.some((t) => estadoTitulo(t, hoje) === "vencido");

  return (
    <div className="flex flex-col gap-6">
      <FaixaIndicadores colunas={3}>
        <Indicador
          rotulo="Total da OS"
          valor={formatarReais(total)}
          detalhe={parteSeguradora > 0 ? `${formatarReais(parteCliente)} do cliente · ${formatarReais(parteSeguradora)} da seguradora` : undefined}
        />
        <Indicador rotulo="Recebido" valor={formatarReais(resumo.recebido)} detalhe={`${baixas.length} ${baixas.length === 1 ? "pagamento" : "pagamentos"}`} />
        <Indicador rotulo="Falta receber" valor={formatarReais(falta)} alerta={vencido} detalhe={total > 0 && falta === 0 ? "quitado" : vencido ? "há título vencido" : undefined} />
      </FaixaIndicadores>

      <div className="grid gap-6 items-start lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <CartaoClienteDeve v={v} hoje={hoje} deve={deve} ativa={ativa} destaque={destaque} />

        <div className="flex flex-col gap-6 min-w-0">
          <Cartao titulo="Pagamentos recebidos" contagem={baixas.length}>
            {baixas.length === 0 ? (
              <p className="px-4 py-4 text-[13px] text-tinta-suave">Nenhum pagamento registrado nesta OS.</p>
            ) : (
              <ul className="divide-y divide-linha">
                {baixas.map(({ b, t }) => (
                  <li key={b.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {formaLegivel(b.forma)}
                        {b.parcelas && b.parcelas > 1 && <span className="font-normal text-tinta-suave numero"> · {b.parcelas}×</span>}
                      </p>
                      <p className="text-[12px] text-tinta-suave numero">
                        {diaCurto(b.recebidoEm)} · {t.descricao} · {pagador(t.pagadorId)}
                      </p>
                      {b.obs && <p className="mt-0.5 text-[13px] break-words">{b.obs}</p>}
                    </div>
                    <span className="numero font-semibold whitespace-nowrap text-ok">{formatarReais(b.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          <Cartao titulo="Títulos da OS" contagem={titulos.length}>
            {titulos.length === 0 ? (
              <p className="px-4 py-4 text-[13px] text-tinta-suave">
                Nenhum título ainda. Os títulos saem na entrega.
              </p>
            ) : (
              <ul className="divide-y divide-linha">
                {titulos.map((t) => {
                  const est = ESTADO_TITULO[estadoTitulo(t, hoje)];
                  const saldo = saldoTitulo(t);
                  return (
                    <li key={t.id} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="font-medium break-words">{t.descricao}</p>
                        <p className="text-[12px] text-tinta-suave numero">
                          {pagador(t.pagadorId)} · vence {dataCurta(t.vencimento)}
                          {t.nfNumero && ` · NF ${t.nfNumero}`}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="numero font-semibold whitespace-nowrap">{formatarReais(t.valor)}</span>
                        <span className="flex items-center gap-2">
                          {saldo > 0 && saldo !== t.valor && <span className="text-[12px] text-tinta-suave numero">saldo {formatarReais(saldo)}</span>}
                          <Etiqueta tom={est.tom}>{est.texto}</Etiqueta>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Cartao>
        </div>
      </div>
    </div>
  );
}

const paraCampo = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "Cliente deve": as partes (franquia, complemento, particular), pago e falta; o formulário enquanto falta. */
function CartaoClienteDeve({ v, hoje, deve, ativa, destaque }: { v: OSVisao; hoje: string; deve: ClienteDeve | null; ativa: boolean; destaque: boolean }) {
  const quitado = deve !== null && deve.total > 0 && deve.falta === 0;
  const etiqueta = !deve ? undefined : deve.semFranquia ? (
    <Etiqueta tom="neutro">Sem franquia</Etiqueta>
  ) : quitado ? (
    <Etiqueta tom="ok">Pago</Etiqueta>
  ) : undefined;
  return (
    <Cartao titulo="Cliente deve" acao={etiqueta}>
      {!deve ? (
        <p className="px-4 py-4 text-[14px] text-tinta-suave">Sem orçamento aprovado ainda.</p>
      ) : deve.semFranquia ? (
        <p className="px-4 py-4 text-[14px]">Nada a pagar na oficina: a seguradora paga tudo.</p>
      ) : (
        <dl className="m-0 px-4 py-1">
          {deve.partes.map((p) => (
            <div key={p.nome} className="flex items-baseline justify-between gap-3 py-2.5 border-b border-linha">
              <dt className="text-[14px] font-medium">{p.nome}</dt>
              <dd className="m-0 numero text-[16px] font-semibold whitespace-nowrap">{formatarReais(p.valor)}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-3 py-2.5 border-b border-linha">
            <dt className="text-[13px] font-medium text-tinta-suave">Pago</dt>
            <dd className="m-0 numero whitespace-nowrap text-ok font-medium">{formatarReais(deve.pago)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 py-2.5">
            <dt className="text-[13px] font-semibold">Falta</dt>
            <dd className={`m-0 numero whitespace-nowrap text-[16px] font-semibold ${deve.falta > 0 ? "text-atencao" : ""}`}>{formatarReais(deve.falta)}</dd>
          </div>
        </dl>
      )}
      {ativa && deve && deve.falta > 0 && <FormPagamento key={deve.falta} v={v} hoje={hoje} sugerido={deve.falta} destaque={destaque} />}
    </Cartao>
  );
}

function FormPagamento({ v, hoje, sugerido, destaque }: { v: OSVisao; hoje: string; sugerido: number; destaque: boolean }) {
  const acoes = useAcoes();
  const id = useId();
  const [params, setParams] = useSearchParams();
  const [valor, setValor] = useState(() => paraCampo(sugerido));
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [data, setData] = useState(hoje);
  const [parcelas, setParcelas] = useState("1");
  const [obs, setObs] = useState("");
  const [erros, setErros] = useState<{ valor?: string; data?: string }>({});
  const [aviso, setAviso] = useState<{ tom: "ok" | "alerta"; texto: string } | null>(null);
  const formas = FORMAS_PAGAMENTO.filter((f) => f !== "seguradora");

  // vindo de "Registrar pagamento" (Próxima ação, topo da ficha, aviso da entrega): foca o valor uma vez
  const pedido = params.get("pagar") === "1";
  useEffect(() => {
    if (!pedido) return;
    const campo = document.getElementById(`${id}-v`) as HTMLInputElement | null;
    campo?.focus();
    campo?.select();
    campo?.scrollIntoView({ block: "center" });
    const p = new URLSearchParams(params);
    p.delete("pagar");
    setParams(p, { replace: true });
  }, [pedido, params, setParams, id]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setAviso(null);
    const centavos = reaisParaCentavos(valor);
    const novos: typeof erros = {};
    if (centavos === null || centavos <= 0) novos.valor = mensagemErro("valor_invalido");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) novos.data = mensagemErro("data_invalida");
    setErros(novos);
    if (Object.keys(novos).length > 0 || centavos === null) return;
    try {
      const r = await acoes.registrarPagamentoOS.mutateAsync([
        v.os.id,
        { valor: centavos, forma, recebidoEm: data, parcelas: forma === "credito" ? Number(parcelas) : undefined, obs: obs.trim() || undefined },
      ]);
      if (!r.ok) {
        setAviso({ tom: "alerta", texto: mensagemErro(r.codigo) });
        return;
      }
      setAviso({ tom: "ok", texto: `Pagamento de ${formatarReais(centavos)} em ${FORMA_PAGAMENTO[forma].toLowerCase()} registrado.` });
      setValor(sugerido > centavos ? paraCampo(sugerido - centavos) : "");
      setObs("");
      setParcelas("1");
    } catch {
      setAviso({ tom: "alerta", texto: mensagemErro() });
    }
  }

  return (
    <section aria-label="Registrar pagamento" className="border-t border-linha">
      <form onSubmit={enviar} noValidate className="p-4 flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Grupo id={`${id}-v`} rotulo="Valor" erro={erros.valor}>
            <CampoComAfixo
              id={`${id}-v`}
              prefixo="R$"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              value={valor}
              onChange={(e) => {
                setValor(e.target.value);
                setErros((x) => ({ ...x, valor: undefined }));
              }}
              aria-invalid={Boolean(erros.valor)}
              aria-describedby={descritoPor(`${id}-v`, erros.valor)}
            />
          </Grupo>
          <Grupo id={`${id}-d`} rotulo="Data do recebimento" erro={erros.data}>
            <input
              id={`${id}-d`}
              type="date"
              value={data}
              max={hoje}
              onChange={(e) => {
                setData(e.target.value);
                setErros((x) => ({ ...x, data: undefined }));
              }}
              aria-invalid={Boolean(erros.data)}
              aria-describedby={descritoPor(`${id}-d`, erros.data)}
              className={`${CLASSE_CAMPO} numero`}
            />
          </Grupo>
        </div>

        <OpcoesEmGrade
          nome={`${id}-forma`}
          legenda="Forma de pagamento"
          colunas={3}
          opcoes={formas.map((f) => ({ valor: f, texto: FORMA_PAGAMENTO[f] }))}
          valor={forma}
          onMudar={setForma}
        />

        {forma === "credito" && (
          <Grupo id={`${id}-p`} rotulo="Parcelas" className="sm:max-w-[200px]">
            <Selecao id={`${id}-p`} value={parcelas} onChange={(e) => setParcelas(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((n) => (
                <option key={n} value={n}>
                  {n === "1" ? "À vista (1×)" : `${n}×`}
                </option>
              ))}
            </Selecao>
          </Grupo>
        )}

        <Grupo id={`${id}-o`} rotulo="Observação" opcional>
          <AreaTexto id={`${id}-o`} rows={2} maxLength={300} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: franquia paga na retirada" />
        </Grupo>

        {aviso && <Aviso tom={aviso.tom}>{aviso.texto}</Aviso>}
        <div>
          <Botao type="submit" variante={destaque ? "primario" : "contorno"} icone="ok" disabled={acoes.registrarPagamentoOS.isPending}>
            {acoes.registrarPagamentoOS.isPending ? "Registrando…" : "Registrar pagamento"}
          </Botao>
        </div>
      </form>
    </section>
  );
}

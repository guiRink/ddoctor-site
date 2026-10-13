import { useId, useState, type FormEvent } from "react";
import { FORMAS_PAGAMENTO, type FormaPagamento, type MarcoISO, type Pagador } from "@compartilhado/tipos";
import { formatarReais, reaisParaCentavos } from "@compartilhado/dominio/dinheiro";
import { estadoTitulo, saldoTitulo } from "@compartilhado/dominio/financeiro";
import { dataNoFuso } from "@compartilhado/dominio/fuso";
import { resumoPagamentosOS } from "@compartilhado/dominio/pagamentos";
import { mensagemErro, useAcoes } from "../../dados/hooks";
import type { OSVisao } from "../../dados/repositorio";
import { ESTADO_TITULO, FORMA_PAGAMENTO } from "../../dominio/rotulos";
import { descritoPor, formaLegivel } from "./formato";
import { Botao, Cartao, FaixaIndicadores, Indicador } from "../ui/Basicos";
import { Etiqueta } from "../ui/Estado";
import { dataCurta, diaCurto } from "../orcamentos/formato";
import { AreaTexto, Aviso, CLASSE_CAMPO, CampoComAfixo, Grupo, Selecao } from "./Campos";

/**
 * Aba Pagamentos (quem vê dinheiro: veDadosSensiveis — nunca produção nem TV): total, recebido e saldo
 * dos títulos da OS, formulário de pagamento (vira baixa no título do cliente) e a lista de baixas.
 */
export function AbaPagamentos({ v, agora, pagadores, podeRegistrar }: { v: OSVisao; agora: MarcoISO; pagadores: Pagador[]; podeRegistrar: boolean }) {
  const hoje = dataNoFuso(agora);
  const resumo = resumoPagamentosOS(v.titulos);
  const titulos = v.titulos.filter((t) => t.estado !== "cancelado");
  const baixas = titulos
    .flatMap((t) => t.baixas.map((b) => ({ b, t })))
    .sort((a, b) => b.b.recebidoEm.localeCompare(a.b.recebidoEm));
  const pagador = (id: string) => pagadores.find((p) => p.id === id)?.nome ?? "Pagador não informado";
  const ativa = podeRegistrar && v.os.estado !== "cancelada";

  return (
    <div className="flex flex-col gap-6">
      <FaixaIndicadores colunas={3}>
        <Indicador rotulo="Total da OS" valor={formatarReais(resumo.total)} detalhe={`${titulos.length} ${titulos.length === 1 ? "título" : "títulos"}`} />
        <Indicador rotulo="Recebido" valor={formatarReais(resumo.recebido)} detalhe={`${baixas.length} ${baixas.length === 1 ? "pagamento" : "pagamentos"}`} />
        <Indicador rotulo="Saldo a receber" valor={formatarReais(resumo.saldo)} alerta={titulos.some((t) => estadoTitulo(t, hoje) === "vencido")} detalhe={resumo.total > 0 && resumo.saldo === 0 ? "quitado" : undefined} />
      </FaixaIndicadores>

      <div className={`grid gap-6 items-start ${ativa ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" : ""}`}>
        {ativa && <FormPagamento v={v} hoje={hoje} />}

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
                Nenhum título ainda. Os títulos da seguradora e da franquia são sugeridos na entrega; um pagamento registrado aqui cria o título do cliente.
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

function FormPagamento({ v, hoje }: { v: OSVisao; hoje: string }) {
  const acoes = useAcoes();
  const id = useId();
  const [valor, setValor] = useState("");
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [data, setData] = useState(hoje);
  const [parcelas, setParcelas] = useState("1");
  const [obs, setObs] = useState("");
  const [erros, setErros] = useState<{ valor?: string; data?: string }>({});
  const [aviso, setAviso] = useState<{ tom: "ok" | "alerta"; texto: string } | null>(null);
  const formas = FORMAS_PAGAMENTO.filter((f) => f !== "seguradora");

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
      setValor("");
      setObs("");
      setParcelas("1");
    } catch {
      setAviso({ tom: "alerta", texto: mensagemErro() });
    }
  }

  return (
    <Cartao titulo="Registrar pagamento">
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

        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-[13px] font-medium text-tinta-suave">Forma de pagamento</legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {formas.map((f) => {
              const ativo = f === forma;
              return (
                <label
                  key={f}
                  className={`flex items-center justify-center text-center h-11 md:h-10 px-2 rounded-controle border text-[13px] cursor-pointer transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-amarelo-escuro has-[:focus-visible]:outline-offset-1 ${
                    ativo ? "bg-cartao border-tinta text-tinta font-semibold ring-1 ring-tinta" : "bg-cartao border-linha-forte text-tinta-suave font-medium hover:text-tinta hover:bg-cinza-50"
                  }`}
                >
                  <input type="radio" name={`${id}-forma`} value={f} checked={ativo} onChange={() => setForma(f)} className="sr-only" />
                  {FORMA_PAGAMENTO[f]}
                </label>
              );
            })}
          </div>
        </fieldset>

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

        <p className="text-[12px] text-tinta-suave">Entra como baixa no título do cliente (franquia ou particular). Pagamentos da seguradora são baixados em Recebíveis.</p>

        {aviso && <Aviso tom={aviso.tom}>{aviso.texto}</Aviso>}
        <div>
          <Botao type="submit" variante="primario" icone="ok" disabled={acoes.registrarPagamentoOS.isPending}>
            {acoes.registrarPagamentoOS.isPending ? "Registrando…" : "Registrar pagamento"}
          </Botao>
        </div>
      </form>
    </Cartao>
  );
}

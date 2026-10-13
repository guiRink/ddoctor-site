import type { ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { Cliente, Veiculo } from "@compartilhado/tipos";
import { formatarReais } from "@compartilhado/dominio/dinheiro";
import { dataNoFuso } from "@compartilhado/dominio/fuso";
import { useAgora, useCliente } from "../dados/hooks";
import type { ClienteFicha, OSVisao } from "../dados/repositorio";
import { useSessao } from "../dados/sessao";
import { podeEditar, veDadosSensiveis } from "../dominio/permissoes";
import { ESTADO_OS, ORIGEM_OS, TIPO_PESSOA } from "../dominio/rotulos";
import { Botao, BotaoLink, Cartao, Erro, Esqueleto, FaixaIndicadores, Indicador, Vazio } from "../componentes/ui/Basicos";
import { Etiqueta } from "../componentes/ui/Estado";
import { Placa } from "../componentes/ui/Placa";
import { Proveniencia } from "../componentes/ui/Proveniencia";
import { CLASSE_LINHA, CLASSE_TH } from "../componentes/ui/Tabela";
import { Icone } from "../componentes/Icone";
import { AvatarCliente, BotaoWhatsApp } from "../componentes/clientes/Comuns";
import { FormCliente } from "../componentes/clientes/FormCliente";
import { FormVeiculo } from "../componentes/clientes/FormVeiculo";
import { dataCompleta, documentoExibicao, nomeVeiculo, formatarTelefone, haQuanto, linhasEndereco, linkWhatsApp, tipoDoCliente } from "../componentes/clientes/formato";
import { dataCurta } from "../componentes/gestao/formato";
import { valorDaLista, versaoAtual } from "../componentes/orcamentos/selecoes";

/**
 * Ficha do cliente (docs/concorrente-analise.md §3.1): cabeçalho com ações, indicadores (OS, total pago,
 * saldo em aberto, última visita), veículos, histórico de OS e contato/endereço.
 * Edição em painel lateral (`?editar=1`); veículo novo ou editado em `?veiculo=novo|<id>`.
 */
const FECHADAS = new Set(["entregue", "encerrada", "cancelada"]);

export function FichaCliente() {
  const { id } = useParams();
  const consulta = useCliente(id);

  return (
    <>
      <Link to="/clientes" className="inline-flex items-center gap-1.5 h-11 md:h-8 -mt-2 mb-2 text-[13px] font-medium text-tinta-suave no-underline hover:text-tinta">
        <Icone nome="voltar" tamanho={16} />
        Clientes
      </Link>
      {consulta.isPending ? (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="esqueleto w-12 h-12 rounded-full" />
            <div className="flex flex-col gap-2">
              <div className="esqueleto h-6 w-64" />
              <div className="esqueleto h-4 w-40" />
            </div>
          </div>
          <Esqueleto linhas={1} altura="h-[92px]" />
          <Esqueleto linhas={4} />
        </div>
      ) : consulta.isError ? (
        <Erro mensagem="Não consegui carregar a ficha do cliente." onTentar={() => consulta.refetch()} />
      ) : !consulta.data ? (
        <Cartao>
          <Vazio
            icone="pessoa"
            titulo="Cliente não encontrado"
            texto="O cadastro pode ter sido removido ou o link está incompleto."
            acao={<BotaoLink para="/clientes">Ver todos os clientes</BotaoLink>}
          />
        </Cartao>
      ) : (
        <Ficha ficha={consulta.data} />
      )}
    </>
  );
}

function Ficha({ ficha }: { ficha: ClienteFicha }) {
  const { perfil } = useSessao();
  const [params, setParams] = useSearchParams();
  const agora = useAgora(60_000);
  const hoje = dataNoFuso(agora);
  const c = ficha.cliente;

  const podeEditarCliente = podeEditar(perfil.papel, "clientes");
  const podeAbrirOS = podeEditar(perfil.papel, "orcamentos");
  const mostraValor = veDadosSensiveis(perfil.papel);
  const editando = params.get("editar") === "1" && podeEditarCliente;
  const veiculoParam = podeEditarCliente ? params.get("veiculo") : null;
  const veiculoEditado = veiculoParam && veiculoParam !== "novo" ? ficha.veiculos.find((v) => v.id === veiculoParam) : undefined;

  const abrir = (mudanca: Record<string, string | null>) => {
    const novo = new URLSearchParams(params);
    for (const [k, v] of Object.entries(mudanca)) {
      if (v === null) novo.delete(k);
      else novo.set(k, v);
    }
    setParams(novo, { replace: true });
  };

  const doc = documentoExibicao(c);
  const tipo = tipoDoCliente(c);
  const desde = ficha.oss.length ? ficha.oss[ficha.oss.length - 1].os.criadoEm : undefined;
  const emAberto = ficha.oss.filter((v) => !FECHADAS.has(v.os.estado)).length;
  const ano = hoje.slice(0, 4);
  const provNome = c.proveniencia?.nome;

  return (
    <>
      {/* ---------------- cabeçalho */}
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 mb-6">
        <div className="flex items-start gap-4 min-w-0">
          <AvatarCliente nome={c.nome} tamanho={48} />
          <div className="min-w-0">
            <h1 className="titulo-pagina text-tinta break-words">{c.nome}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[14px] text-tinta-suave">
              {tipo && (
                <Etiqueta tom="neutro" ponto={false}>
                  {TIPO_PESSOA[tipo]}
                </Etiqueta>
              )}
              {doc ? (
                <span className="numero">
                  {doc.rotulo} {doc.valor}
                </span>
              ) : (
                <span className="text-tinta-fraca">Sem CPF/CNPJ</span>
              )}
              {desde && (
                <>
                  <span aria-hidden="true" className="hidden sm:inline text-tinta-fraca">
                    ·
                  </span>
                  <span className="numero">Cliente desde {dataCompleta(dataNoFuso(desde))}</span>
                </>
              )}
              {provNome && <Proveniencia fonte={provNome.fonte} lidoEm={provNome.lidoEm} agora={agora} podeDesatualizar={false} />}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {c.whatsapp && <BotaoWhatsApp numero={c.whatsapp} nome={c.nome} />}
          {podeEditarCliente && (
            <Botao onClick={() => abrir({ editar: "1" })}>
              Editar
            </Botao>
          )}
          {podeAbrirOS && (
            <BotaoLink para={`/orcamentos/novo?cliente=${encodeURIComponent(c.id)}`} variante="primario" icone="mais">
              Novo atendimento
            </BotaoLink>
          )}
        </div>
      </header>

      {/* ---------------- indicadores */}
      <FaixaIndicadores colunas={4}>
        <Indicador rotulo="Ordens de serviço" valor={ficha.quantidadeOS} detalhe={emAberto > 0 ? `${emAberto} em andamento` : "nenhuma em andamento"} />
        {mostraValor && <Indicador rotulo="Total pago" valor={formatarReais(ficha.totalPago)} />}
        {mostraValor && (
          <Indicador rotulo="Saldo em aberto" valor={formatarReais(ficha.saldoEmAberto)} detalhe={ficha.saldoEmAberto > 0 ? "a receber deste cliente" : "nada a receber"} />
        )}
        <Indicador
          rotulo="Última visita"
          valor={ficha.ultimaOSEm ? dataCurta(dataNoFuso(ficha.ultimaOSEm), ano) : "—"}
          detalhe={ficha.ultimaOSEm ? haQuanto(ficha.ultimaOSEm, hoje) : "sem OS registrada"}
        />
      </FaixaIndicadores>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="flex flex-col gap-6 min-w-0">
          <Veiculos ficha={ficha} podeEditar={podeEditarCliente} onAdicionar={() => abrir({ veiculo: "novo" })} onEditar={(v) => abrir({ veiculo: v.id })} />
          <Historico ficha={ficha} ano={ano} mostraValor={mostraValor} podeAbrirOS={podeAbrirOS} />
        </div>
        <div className="flex flex-col gap-6 min-w-0">
          <Contato cliente={c} agora={agora} />
          <EnderecoCartao cliente={c} podeEditar={podeEditarCliente} onEditar={() => abrir({ editar: "1" })} />
          {c.observacoes && (
            <Cartao titulo="Observações">
              <p className="px-4 py-3 text-[14px] whitespace-pre-line break-words">{c.observacoes}</p>
            </Cartao>
          )}
        </div>
      </div>

      {editando && <FormCliente cliente={c} onFechar={() => abrir({ editar: null })} onSalvo={() => abrir({ editar: null })} />}
      {veiculoParam && (veiculoParam === "novo" || veiculoEditado) && (
        <FormVeiculo clienteId={c.id} veiculo={veiculoEditado} onFechar={() => abrir({ veiculo: null })} />
      )}
    </>
  );
}

// ------------------------------------------------------------------ veículos

function Veiculos({
  ficha,
  podeEditar,
  onAdicionar,
  onEditar,
}: {
  ficha: ClienteFicha;
  podeEditar: boolean;
  onAdicionar: () => void;
  onEditar: (v: Veiculo) => void;
}) {
  const osPorVeiculo = (id: string) => ficha.oss.filter((v) => v.veiculo.id === id).length;
  return (
    <Cartao
      titulo="Veículos"
      contagem={ficha.veiculos.length}
      acao={
        podeEditar && (
          <Botao variante="fantasma" tamanho="denso" icone="mais" onClick={onAdicionar} className="-mr-2">
            Adicionar veículo
          </Botao>
        )
      }
    >
      {ficha.veiculos.length === 0 ? (
        <Vazio
          icone="carro"
          titulo="Nenhum veículo cadastrado"
          texto="Adicione o carro do cliente para ligá-lo aos próximos atendimentos."
          acao={podeEditar && <Botao icone="mais" onClick={onAdicionar}>Adicionar veículo</Botao>}
        />
      ) : (
        <ul>
          {ficha.veiculos.map((v) => {
            const n = osPorVeiculo(v.id);
            const detalhe = [v.cor, v.ano].filter(Boolean).join(" · ");
            return (
              <li key={v.id} className="flex items-center gap-3.5 px-4 py-3 min-w-0 border-b border-linha last:border-b-0">
                <span className="hidden sm:inline-flex shrink-0">
                  <Placa placa={v.placa} tamanho="m" />
                </span>
                <span className="inline-flex sm:hidden shrink-0">
                  <Placa placa={v.placa} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold truncate">{nomeVeiculo(v)}</p>
                  <p className="text-[13px] text-tinta-suave truncate numero">{detalhe || "Cor e ano não informados"}</p>
                </div>
                <span className="hidden sm:block shrink-0 text-[13px] text-tinta-suave numero">{n === 1 ? "1 OS" : `${n} OS`}</span>
                {podeEditar && (
                  <Botao variante="fantasma" tamanho="denso" onClick={() => onEditar(v)} aria-label={`Editar o veículo ${v.placa}`} className="-mr-2 shrink-0">
                    Editar
                  </Botao>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Cartao>
  );
}

// ------------------------------------------------------------------ histórico de OS

function origemDa(v: OSVisao): { titulo: string; detalhe?: string } {
  const at = v.atendimentos[0];
  if (at) return { titulo: at.seguradora, detalhe: at.idExterno ? `${v.os.origem === "maxpar" ? "Maxpar" : "Protocolo"} · ${at.idExterno}` : ORIGEM_OS[v.os.origem] };
  return { titulo: ORIGEM_OS[v.os.origem] };
}

function Historico({ ficha, ano, mostraValor, podeAbrirOS }: { ficha: ClienteFicha; ano: string; mostraValor: boolean; podeAbrirOS: boolean }) {
  const navegar = useNavigate();
  const lista = ficha.oss;
  return (
    <Cartao titulo="Histórico de OS" contagem={lista.length}>
      {lista.length === 0 ? (
        <Vazio
          icone="orcamentos"
          titulo="Nenhuma OS para este cliente"
          texto="Os atendimentos registrados para este cliente aparecem aqui, do mais recente para o mais antigo."
          acao={
            podeAbrirOS && (
              <BotaoLink para={`/orcamentos/novo?cliente=${encodeURIComponent(ficha.cliente.id)}`} icone="mais">
                Novo atendimento
              </BotaoLink>
            )
          }
        />
      ) : (
        <>
          {/* desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <caption className="sr-only">Ordens de serviço do cliente</caption>
              <thead>
                <tr>
                  <th scope="col" className={`${CLASSE_TH} text-left pl-4`}>
                    OS
                  </th>
                  <th scope="col" className={`${CLASSE_TH} text-left`}>
                    Placa
                  </th>
                  <th scope="col" className={`${CLASSE_TH} text-left`}>
                    Origem
                  </th>
                  <th scope="col" className={`${CLASSE_TH} text-left`}>
                    Estado
                  </th>
                  <th scope="col" className={`${CLASSE_TH} text-left`}>
                    Entrada
                  </th>
                  {mostraValor && (
                    <th scope="col" className={`${CLASSE_TH} text-right pr-4`}>
                      Valor
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {lista.map((v) => {
                  const origem = origemDa(v);
                  const estado = ESTADO_OS[v.os.estado];
                  const valor = valorDaLista(versaoAtual(v));
                  return (
                    <tr key={v.os.id} onClick={() => navegar(`/orcamentos/${v.os.id}`)} className={`${CLASSE_LINHA} cursor-pointer`}>
                      <td className="pl-4 pr-3 py-2 h-[56px] whitespace-nowrap">
                        <Link
                          to={`/orcamentos/${v.os.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-tinta numero no-underline hover:underline underline-offset-4"
                        >
                          #{v.os.numero}
                          <span className="sr-only"> — abrir a OS</span>
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <Placa placa={v.veiculo.placa} />
                      </td>
                      <td className="px-3 py-2 max-w-[220px]">
                        <span className="block truncate">{origem.titulo}</span>
                        {origem.detalhe && <span className="block text-[13px] text-tinta-suave truncate numero">{origem.detalhe}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <Etiqueta tom={estado.tom}>{estado.texto}</Etiqueta>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap numero">
                        {v.os.entradaRealEm ? (
                          dataCurta(dataNoFuso(v.os.entradaRealEm), ano)
                        ) : (
                          <span className="text-tinta-fraca">—</span>
                        )}
                        <span className="block text-[12px] text-tinta-suave">aberta {dataCurta(dataNoFuso(v.os.criadoEm), ano)}</span>
                      </td>
                      {mostraValor && (
                        <td className="pl-3 pr-4 py-2 text-right whitespace-nowrap numero">
                          {valor.valor > 0 ? (
                            <>
                              <span className={valor.aprovado ? "font-semibold" : "text-tinta-suave"}>{formatarReais(valor.valor)}</span>
                              {!valor.aprovado && <span className="block text-[12px] text-tinta-fraca">orçado</span>}
                            </>
                          ) : (
                            <span className="text-tinta-fraca">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* celular */}
          <ul className="md:hidden">
            {lista.map((v) => {
              const origem = origemDa(v);
              const estado = ESTADO_OS[v.os.estado];
              const valor = valorDaLista(versaoAtual(v));
              return (
                <li key={v.os.id} className="border-b border-linha last:border-b-0">
                  <Link to={`/orcamentos/${v.os.id}`} className="block px-4 py-3.5 no-underline text-tinta active:bg-cinza-50">
                    <span className="flex items-center justify-between gap-3">
                      <Placa placa={v.veiculo.placa} />
                      <Etiqueta tom={estado.tom}>{estado.texto}</Etiqueta>
                    </span>
                    <span className="mt-2 flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="min-w-0 truncate">
                        <strong className="font-semibold numero">#{v.os.numero}</strong>
                        <span className="text-tinta-suave"> · {origem.titulo}</span>
                      </span>
                      {mostraValor && valor.valor > 0 && (
                        <span className={`numero shrink-0 ${valor.aprovado ? "font-semibold" : "text-tinta-suave"}`}>
                          {formatarReais(valor.valor)}
                          {!valor.aprovado && " orçado"}
                        </span>
                      )}
                    </span>
                    <span className="block text-[12px] text-tinta-suave numero">
                      Aberta {dataCurta(dataNoFuso(v.os.criadoEm), ano)}
                      {v.os.entradaRealEm && ` · entrada ${dataCurta(dataNoFuso(v.os.entradaRealEm), ano)}`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Cartao>
  );
}

// ------------------------------------------------------------------ contato e endereço

function LinhaContato({ nome, children }: { nome: string; children?: ReactNode }) {
  return (
    <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-3 py-2.5 border-b border-linha last:border-b-0">
      <dt className="text-[13px] font-medium text-tinta-suave pt-px">{nome}</dt>
      <dd className="m-0 text-[14px] min-w-0">{children ?? <span className="text-tinta-fraca">Não informado</span>}</dd>
    </div>
  );
}

function Contato({ cliente: c, agora }: { cliente: Cliente; agora: string }) {
  const provTel = c.proveniencia?.telefone;
  return (
    <Cartao titulo="Contato">
      <dl className="m-0 px-4 py-1">
        <LinhaContato nome="Telefone">
          {c.telefone && (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <a href={`tel:${c.telefone}`} className="numero text-tinta no-underline hover:underline underline-offset-4">
                {formatarTelefone(c.telefone)}
              </a>
              {provTel && <Proveniencia fonte={provTel.fonte} lidoEm={provTel.lidoEm} agora={agora} podeDesatualizar={false} />}
            </span>
          )}
        </LinhaContato>
        <LinhaContato nome="WhatsApp">
          {c.whatsapp && (
            <a href={linkWhatsApp(c.whatsapp)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 numero text-tinta no-underline hover:underline underline-offset-4">
              {formatarTelefone(c.whatsapp)}
              <Icone nome="externo" tamanho={13} className="text-tinta-fraca" />
              <span className="sr-only">(abre o WhatsApp)</span>
            </a>
          )}
        </LinhaContato>
        <LinhaContato nome="E-mail">
          {c.email && (
            <a href={`mailto:${c.email}`} title={c.email} className="block truncate text-tinta no-underline hover:underline underline-offset-4">
              {c.email}
            </a>
          )}
        </LinhaContato>
      </dl>
    </Cartao>
  );
}

function EnderecoCartao({ cliente: c, podeEditar, onEditar }: { cliente: Cliente; podeEditar: boolean; onEditar: () => void }) {
  if (!c.endereco) {
    return (
      <Cartao titulo="Endereço">
        <div className="px-4 py-4 flex flex-col items-start gap-3">
          <p className="text-[14px] text-tinta-suave">Sem endereço cadastrado.</p>
          {podeEditar && (
            <Botao tamanho="denso" icone="mais" onClick={onEditar}>
              Adicionar endereço
            </Botao>
          )}
        </div>
      </Cartao>
    );
  }
  const [l1, l2] = linhasEndereco(c.endereco);
  return (
    <Cartao titulo="Endereço">
      <address className="not-italic px-4 py-3.5 text-[14px] leading-relaxed">
        <span className="block break-words">{l1}</span>
        <span className="block text-tinta-suave numero break-words">{l2}</span>
      </address>
    </Cartao>
  );
}

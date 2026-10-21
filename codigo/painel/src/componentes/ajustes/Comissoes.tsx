import { useId, useState } from "react";
import type { RegraComissao, TipoReparo } from "@compartilhado/tipos";
import { formatarReais, reaisParaCentavos } from "@compartilhado/dominio/dinheiro";
import { VALOR_MAXIMO_COMISSAO } from "@compartilhado/dominio/comissoes";
import { tipoReparoAtivo } from "@compartilhado/dominio/tiposReparo";
import { mensagemErro, useAcoes, useRegrasComissao, useTiposReparo } from "../../dados/hooks";
import { ERRO_VALOR_COMISSAO } from "../../dominio/rotulos";
import { Botao, Vazio } from "../ui/Basicos";
import { CampoComAfixo, Grupo, LinhaPrevia, Marcador, Previa, Selecao } from "../ui/Campos";
import { Etiqueta } from "../ui/Estado";
import { Gaveta } from "../ui/Gaveta";
import { Retorno } from "../gestao/Comuns";
import { centavosParaCampo } from "../gestao/formato";
import { nomesDeEtapa, textoAlvoComissao } from "../equipe/modelo";
import { Consulta, Interruptor, NotaProvisoria, Secao } from "./Estrutura";

/**
 * Ajustes → Comissões (sprint S1, pedido do dono: "pintura feita = R$ 40; a oficina escolhe quais funções são
 * comissionadas e o valor"). Quem conclui a etapa recebe. Só o dono edita (podeEditarComissoes); o gerente vê
 * quais etapas pagam, sem o valor (valores em R$ só para quem vê a folha).
 */
export function Comissoes({ podeEditar, veValores }: { podeEditar: boolean; veValores: boolean }) {
  const regrasQ = useRegrasComissao();
  const tiposQ = useTiposReparo();
  const [gaveta, setGaveta] = useState<{ regra?: RegraComissao } | null>(null);
  const [aviso, setAviso] = useState<string>();
  return (
    <Secao
      id="comissoes"
      titulo="Comissões"
      descricao="Quem conclui a etapa recebe a comissão, na folha do mês em que concluiu (Equipe → Folha)."
      acao={
        podeEditar && (
          <Botao tamanho="denso" variante="contorno" icone="mais" onClick={() => setGaveta({})}>
            Adicionar comissão
          </Botao>
        )
      }
    >
      <Consulta q={tiposQ}>
        {(tipos: TipoReparo[]) => (
          <Consulta q={regrasQ}>
            {(regras: RegraComissao[]) => (
              <>
                {aviso && (
                  <div className="px-5 py-2.5 border-b border-linha bg-ok-claro">
                    <Retorno ok={aviso} />
                  </div>
                )}
                {regras.length === 0 ? (
                  <Vazio
                    icone="financeiro"
                    titulo="Nenhuma comissão"
                    texto="Ninguém recebe por serviço por enquanto. Exemplo: Pintura concluída = R$ 40,00 para quem pintou."
                    acao={
                      podeEditar && (
                        <Botao variante="contorno" icone="mais" onClick={() => setGaveta({})}>
                          Adicionar comissão
                        </Botao>
                      )
                    }
                  />
                ) : (
                  <ul>
                    {[...regras]
                      .sort((a, b) => Number(b.ativa) - Number(a.ativa) || textoAlvoComissao(a, tipos).localeCompare(textoAlvoComissao(b, tipos), "pt-BR"))
                      .map((r) => (
                        <LinhaRegra key={r.id} r={r} tipos={tipos} podeEditar={podeEditar} veValores={veValores} onEditar={() => setGaveta({ regra: r })} onAviso={setAviso} />
                      ))}
                  </ul>
                )}
                {!veValores && regras.length > 0 && (
                  <p className="px-5 py-3 border-t border-linha text-[12px] text-tinta-suave">Os valores em reais só o dono e o financeiro veem.</p>
                )}
                {veValores && regras.length > 0 && (
                  <p className="px-5 py-3 border-t border-linha text-[12px] text-tinta-suave leading-relaxed">
                    Se duas regras valem para a mesma etapa, vale a mais específica: etapa num tipo de serviço, depois a etapa, depois o tipo inteiro.
                    Valor R$ 0,00 tira a comissão de um caso. <NotaProvisoria texto="Comissão pelo tipo inteiro paga cada etapa concluída — a confirmar" />
                  </p>
                )}
                {gaveta && (
                  <FormComissao
                    regra={gaveta.regra}
                    regras={regras}
                    tipos={tipos}
                    onFechar={() => setGaveta(null)}
                    onFeito={(m) => {
                      setGaveta(null);
                      setAviso(m);
                    }}
                  />
                )}
              </>
            )}
          </Consulta>
        )}
      </Consulta>
    </Secao>
  );
}

function LinhaRegra({
  r,
  tipos,
  podeEditar,
  veValores,
  onEditar,
  onAviso,
}: {
  r: RegraComissao;
  tipos: TipoReparo[];
  podeEditar: boolean;
  veValores: boolean;
  onEditar: () => void;
  onAviso: (m: string) => void;
}) {
  const acoes = useAcoes();
  const [erro, setErro] = useState<string>();
  const [removendo, setRemovendo] = useState(false);
  const alvo = textoAlvoComissao(r, tipos);
  const ambito = r.etapaNome && !r.tipoReparoId ? "em qualquer tipo de serviço" : r.etapaNome ? "só nesse tipo de serviço" : "cada etapa concluída";

  async function alternar(ativa: boolean) {
    setErro(undefined);
    const r2 = await acoes.salvarRegraComissao.mutateAsync([{ ...r, ativa }]).catch(() => ({ ok: false, codigo: undefined }));
    if (!r2.ok) setErro(mensagemErro(r2.codigo));
  }
  async function remover() {
    setErro(undefined);
    const r2 = await acoes.removerRegraComissao.mutateAsync([r.id]).catch(() => ({ ok: false, codigo: undefined }));
    if (!r2.ok) return setErro(mensagemErro(r2.codigo));
    onAviso(`Comissão de ${alvo} removida.`);
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3 min-h-14 border-b border-linha last:border-b-0">
      <div className="min-w-0">
        <span className={`flex items-center gap-2 text-[14px] font-semibold ${r.ativa ? "text-tinta" : "text-tinta-fraca"}`}>
          {alvo}
          {!r.ativa && <Etiqueta tom="neutro">Desligada</Etiqueta>}
        </span>
        <span className="block text-[12px] text-tinta-suave">
          {ambito}
          {r.descricao && (
            <>
              {" · "}
              <NotaProvisoria texto={r.descricao} />
            </>
          )}
        </span>
        {erro && <Retorno erro={erro} />}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {veValores && (
          <span className={`mr-2 text-right ${r.ativa ? "" : "text-tinta-fraca"}`}>
            <span className="block text-[15px] font-semibold numero">{formatarReais(r.valor)}</span>
            <span className="block text-[12px] text-tinta-suave">por etapa concluída</span>
          </span>
        )}
        {podeEditar && (
          <>
            <Interruptor ligado={r.ativa} rotulo={`${r.ativa ? "Desligar" : "Ligar"} a comissão de ${alvo}`} onMudar={alternar} desabilitado={acoes.salvarRegraComissao.isPending} />
            {!removendo ? (
              <>
                <Botao tamanho="denso" variante="fantasma" aria-label={`Editar a comissão de ${alvo}`} onClick={onEditar}>
                  Editar
                </Botao>
                <Botao tamanho="denso" variante="fantasma" aria-label={`Remover a comissão de ${alvo}`} onClick={() => setRemovendo(true)}>
                  Remover
                </Botao>
              </>
            ) : (
              <>
                <Botao tamanho="denso" variante="perigo" onClick={remover} disabled={acoes.removerRegraComissao.isPending}>
                  Sim, remover
                </Botao>
                <Botao tamanho="denso" variante="fantasma" onClick={() => setRemovendo(false)}>
                  Cancelar
                </Botao>
              </>
            )}
          </>
        )}
      </div>
    </li>
  );
}

const TODOS = "";

function FormComissao({
  regra,
  regras,
  tipos,
  onFechar,
  onFeito,
}: {
  regra?: RegraComissao;
  regras: RegraComissao[];
  tipos: TipoReparo[];
  onFechar: () => void;
  onFeito: (m: string) => void;
}) {
  const acoes = useAcoes();
  const id = useId();
  const [etapa, setEtapa] = useState(regra?.etapaNome ?? (regra ? TODOS : "Pintura"));
  const [tipo, setTipo] = useState(regra?.tipoReparoId ?? TODOS);
  const [valor, setValor] = useState(regra ? centavosParaCampo(regra.valor) : "");
  const [ativa, setAtiva] = useState(regra?.ativa ?? true);
  const [erro, setErro] = useState<{ campo?: string; texto: string }>();
  const etapas = nomesDeEtapa(tipos);
  // etapa que não existe mais nos tipos (renomeada) continua na escolha
  if (etapa && !etapas.includes(etapa)) etapas.unshift(etapa);
  const disponiveis = tipos.filter((t) => tipoReparoAtivo(t) || t.id === tipo);
  const centavos = valor.trim() ? reaisParaCentavos(valor) : null;
  const alvo = textoAlvoComissao({ etapaNome: etapa || undefined, tipoReparoId: tipo || undefined }, tipos);

  async function enviar() {
    setErro(undefined);
    if (!etapa && !tipo) return setErro({ campo: "etapaNome", texto: mensagemErro("alvo_obrigatorio") });
    if (centavos === null || centavos < 0 || centavos > VALOR_MAXIMO_COMISSAO) return setErro({ campo: "valor", texto: ERRO_VALOR_COMISSAO });
    try {
      // salvar pelo formulário confirma o valor: a nota "exemplo — a confirmar" da demonstração sai
      const r = await acoes.salvarRegraComissao.mutateAsync([{ id: regra?.id, etapaNome: etapa || undefined, tipoReparoId: tipo || undefined, valor: centavos, ativa }]);
      if (!r.ok) return setErro({ campo: r.campo, texto: r.codigo === "valor_invalido" ? ERRO_VALOR_COMISSAO : mensagemErro(r.codigo) });
      onFeito(regra ? `Comissão de ${alvo} salva.` : `Comissão de ${alvo} criada: ${formatarReais(centavos)} por etapa.`);
    } catch {
      setErro({ texto: mensagemErro() });
    }
  }

  const erroDe = (c: string) => (erro?.campo === c ? erro.texto : undefined);
  const erroGeral = erro && !["etapaNome", "valor"].includes(erro.campo ?? "") ? erro.texto : undefined;
  const duplicada = !regra && regras.some((r) => r.ativa && (r.etapaNome ?? "") === etapa && (r.tipoReparoId ?? "") === tipo);

  return (
    <Gaveta
      titulo={regra ? "Editar comissão" : "Adicionar comissão"}
      descricao="Valor que quem concluir a etapa recebe, por etapa concluída."
      acao={regra ? "Salvar" : "Adicionar"}
      onFechar={onFechar}
      onEnviar={enviar}
      enviando={acoes.salvarRegraComissao.isPending}
      erro={erroGeral}
    >
      <Grupo id={`${id}-etapa`} rotulo="Etapa" erro={erroDe("etapaNome")} dica="A etapa da produção que paga a comissão.">
        <Selecao id={`${id}-etapa`} value={etapa} onChange={(e) => setEtapa(e.target.value)} aria-invalid={Boolean(erroDe("etapaNome"))}>
          <option value={TODOS}>Qualquer etapa (o tipo de serviço inteiro)</option>
          {etapas.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Selecao>
      </Grupo>
      <Grupo id={`${id}-tipo`} rotulo="Tipo de serviço" dica="Deixe em “Todos” para valer em qualquer serviço.">
        <Selecao id={`${id}-tipo`} value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value={TODOS}>Todos os tipos</option>
          {disponiveis.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </Selecao>
      </Grupo>
      <Grupo id={`${id}-valor`} rotulo="Valor por etapa concluída" erro={erroDe("valor")}>
        <CampoComAfixo
          id={`${id}-valor`}
          prefixo="R$"
          inputMode="decimal"
          autoComplete="off"
          placeholder="40,00"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          aria-invalid={Boolean(erroDe("valor"))}
          aria-describedby={erroDe("valor") ? `${id}-valor-erro` : undefined}
        />
      </Grupo>
      <Marcador id={`${id}-ativa`} rotulo="Ligada (entra na folha)" marcado={ativa} onMudar={setAtiva} />
      {duplicada && <p className="text-[13px] font-medium text-atencao">Já existe uma comissão ligada para {alvo}. Edite a que existe.</p>}
      <Previa>
        <LinhaPrevia rotulo="Quem concluir">{alvo}</LinhaPrevia>
        {tipo === TODOS && etapa && <LinhaPrevia rotulo="Vale em">qualquer tipo de serviço</LinhaPrevia>}
        <LinhaPrevia rotulo="Recebe" forte>
          {centavos !== null && centavos >= 0 ? formatarReais(centavos) : "—"}
        </LinhaPrevia>
      </Previa>
    </Gaveta>
  );
}

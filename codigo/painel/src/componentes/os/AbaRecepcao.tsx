import { useState, type ReactNode } from "react";
import type { Avaria, ConfigOficina, Perfil, RecepcaoVeiculo, TipoReparo } from "@compartilhado/tipos";
import { itensChecklist } from "@compartilhado/dominio/config";
import { mensagemErro, useAcoes } from "../../dados/hooks";
import type { OSVisao } from "../../dados/repositorio";
import { Botao, Cartao, Vazio } from "../ui/Basicos";
import { Etiqueta, Provisorio } from "../ui/Estado";
import { nomePerfil } from "../ui/Carro";
import { marcoCurto } from "../orcamentos/formato";
import { Checklist, ProgressoChecklist } from "../recepcao/Checklist";
import { FormRecepcao, NivelCombustivelTexto, type DadosRecepcao } from "../recepcao/FormRecepcao";
import { kmLegivel } from "./formato";
import { MapaAvarias } from "../recepcao/MapaAvarias";
import { ReceberCarro } from "../recepcao/ReceberCarro";
import { progressoChecklist } from "@compartilhado/dominio/recepcao";
import { Aviso } from "./Campos";

type Edicao = null | "dados" | "checklist" | "avarias";

const ANTES_DA_ENTRADA = ["rascunho", "aguardando_aprovacao", "aguardando_agendamento", "agendada"];

/**
 * Aba Recepção da ficha: dados da entrada (km, combustível, reclamação, observações internas),
 * checklist e mapa de avarias, cada bloco com "Editar" (salva a recepção inteira com salvarRecepcao).
 * Sem recepção: se o carro ainda não entrou, o vazio leva a "Receber o carro".
 */
export function AbaRecepcao({
  v,
  config,
  perfis,
  tipos,
  podeAgir,
}: {
  v: OSVisao;
  config: ConfigOficina;
  perfis: Perfil[];
  tipos: TipoReparo[];
  podeAgir: boolean;
}) {
  const acoes = useAcoes();
  const [receber, setReceber] = useState(false);
  const [edicao, setEdicao] = useState<Edicao>(null);
  const [rascunho, setRascunho] = useState<RecepcaoVeiculo | null>(null);
  const [aviso, setAviso] = useState<{ tom: "ok" | "alerta"; texto: string } | null>(null);
  const itens = itensChecklist(config);
  const rec = v.os.recepcao;
  const antes = ANTES_DA_ENTRADA.includes(v.os.estado);
  const podeReceber = podeAgir && (v.os.estado === "aguardando_agendamento" || v.os.estado === "agendada");

  const receberCarro = receber && (
    <ReceberCarro
      v={v}
      tipos={tipos}
      onFechar={() => setReceber(false)}
      onConcluido={(msg) => {
        setReceber(false);
        setAviso({ tom: "ok", texto: msg });
      }}
    />
  );

  if (!rec && edicao === null) {
    return (
      <>
        {aviso && <div className="mb-4"><Aviso tom={aviso.tom}>{aviso.texto}</Aviso></div>}
        <Cartao>
          {antes ? (
            <Vazio
              icone="carro"
              titulo="O carro ainda não foi recebido"
              texto={
                podeReceber
                  ? "Na chegada, registre km, combustível, o checklist e as avarias que o carro já tem. Leva poucos minutos e protege a oficina."
                  : "A recepção é feita quando o carro chega, depois da aprovação e do agendamento."
              }
              acao={
                podeReceber && (
                  <Botao variante="primario" icone="carro" onClick={() => setReceber(true)} aria-haspopup="dialog">
                    Receber o carro
                  </Botao>
                )
              }
            />
          ) : (
            <Vazio
              icone="documento"
              titulo="Recepção não registrada"
              texto="Esta OS entrou sem recepção. Registre agora o que der: km, combustível, checklist e avarias."
              acao={
                podeAgir && (
                  <Botao
                    variante="contorno"
                    icone="mais"
                    onClick={() => {
                      setRascunho({ checklist: {}, avarias: [] });
                      setEdicao("dados");
                    }}
                  >
                    Registrar recepção
                  </Botao>
                )
              }
            />
          )}
        </Cartao>
        {receberCarro}
      </>
    );
  }

  const base: RecepcaoVeiculo = rec ?? { checklist: {}, avarias: [] };
  const atual = edicao && rascunho ? rascunho : base;

  function editar(qual: Exclude<Edicao, null>) {
    setAviso(null);
    setRascunho(structuredClone(base));
    setEdicao(qual);
  }
  function cancelar() {
    setEdicao(null);
    setRascunho(null);
  }
  async function salvar() {
    if (!rascunho) return;
    setAviso(null);
    try {
      const r = await acoes.salvarRecepcao.mutateAsync([v.os.id, rascunho]);
      if (!r.ok) {
        setAviso({ tom: "alerta", texto: mensagemErro(r.codigo) });
        return;
      }
      setEdicao(null);
      setRascunho(null);
      setAviso({ tom: "ok", texto: "Recepção salva." });
    } catch {
      setAviso({ tom: "alerta", texto: mensagemErro() });
    }
  }

  const salvando = acoes.salvarRecepcao.isPending;
  const prog = progressoChecklist(atual.checklist, itens);

  const botaoEditar = (qual: Exclude<Edicao, null>, rotulo: string) =>
    podeAgir && edicao === null ? (
      <Botao tamanho="denso" variante="fantasma" onClick={() => editar(qual)} aria-label={`Editar ${rotulo}`}>
        Editar
      </Botao>
    ) : undefined;

  const rodapeEdicao = (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-linha bg-cinza-50">
      <Botao variante="primario" onClick={salvar} disabled={salvando}>
        {salvando ? "Salvando…" : "Salvar recepção"}
      </Botao>
      <Botao variante="fantasma" onClick={cancelar} disabled={salvando}>
        Cancelar
      </Botao>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {aviso && <Aviso tom={aviso.tom}>{aviso.texto}</Aviso>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-start">
        <div className="flex flex-col gap-6 min-w-0">
          {/* dados da entrada */}
          <Cartao titulo="Dados da entrada" acao={botaoEditar("dados", "dados da entrada")}>
            {edicao === "dados" && rascunho ? (
              <>
                <div className="p-4">
                  <FormRecepcao
                    compacto
                    valor={rascunho}
                    onMudar={(d: DadosRecepcao) => setRascunho({ ...rascunho, ...d })}
                  />
                </div>
                {rodapeEdicao}
              </>
            ) : (
              <dl className="m-0 px-4 py-1">
                <Linha nome="Quilometragem">{base.km !== undefined ? <span className="numero">{kmLegivel(base.km)}</span> : undefined}</Linha>
                <Linha nome="Combustível">
                  <NivelCombustivelTexto nivel={base.combustivel} />
                </Linha>
                <Linha nome="Reclamação do cliente">
                  {base.reclamacao ? <span className="whitespace-pre-line break-words">{base.reclamacao}</span> : undefined}
                </Linha>
                <Linha nome="Observações internas">
                  {base.obsInternas ? <span className="whitespace-pre-line break-words">{base.obsInternas}</span> : undefined}
                </Linha>
                {base.registradaEm && (
                  <Linha nome="Registrada">
                    <span className="numero">{marcoCurto(base.registradaEm)}</span>
                    {base.registradaPor && <span className="text-tinta-suave"> · {nomePerfil(perfis, base.registradaPor) ?? "—"}</span>}
                  </Linha>
                )}
              </dl>
            )}
          </Cartao>
          {/* avarias */}
          <Cartao titulo="Avarias na entrada" contagem={atual.avarias.length} acao={botaoEditar("avarias", "avarias")}>
            <div className="p-4">
              {edicao === "avarias" && rascunho ? (
                <MapaAvarias avarias={rascunho.avarias} onMudar={(a: Avaria[]) => setRascunho({ ...rascunho, avarias: a })} />
              ) : (
                <MapaAvarias avarias={base.avarias} somenteLeitura />
              )}
            </div>
            {edicao === "avarias" && rodapeEdicao}
          </Cartao>
        </div>
        {/* checklist */}
        <Cartao
          titulo="Checklist de entrada"
          acao={
            <span className="flex items-center gap-2">
              {edicao !== "checklist" && !prog.completo && <Etiqueta tom="atencao">Incompleto</Etiqueta>}
              {botaoEditar("checklist", "checklist")}
            </span>
          }
        >
          <div className="p-4 flex flex-col gap-4">
            <ProgressoChecklist checklist={atual.checklist} itens={itens} className="max-w-sm" />
            <Checklist
              itens={itens}
              valor={atual.checklist}
              mostrarProgresso={false}
              somenteLeitura={edicao !== "checklist"}
              onMudar={edicao === "checklist" && rascunho ? (c) => setRascunho({ ...rascunho, checklist: c }) : undefined}
            />
            {!config.checklist && (
              <p className="text-[12px] text-tinta-suave">
                <Provisorio>Checklist padrão provisório — a confirmar</Provisorio>
              </p>
            )}
          </div>
          {edicao === "checklist" && rodapeEdicao}
        </Cartao>
      </div>
      {receberCarro}
    </div>
  );
}

function Linha({ nome, children }: { nome: string; children?: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-2.5 border-b border-linha last:border-b-0">
      <dt className="text-[13px] font-medium text-tinta-suave">{nome}</dt>
      <dd className="m-0 text-[14px] min-w-0">{children ?? <span className="text-tinta-fraca">Não informado</span>}</dd>
    </div>
  );
}

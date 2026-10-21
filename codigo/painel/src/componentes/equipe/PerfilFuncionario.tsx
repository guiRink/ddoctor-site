import { useMemo, useState } from "react";
import type { Perfil, RegraComissao } from "@compartilhado/tipos";
import { formatarReais } from "@compartilhado/dominio/dinheiro";
import { resumoFuncionario } from "@compartilhado/dominio/historicoFuncionario";
import { formatarDuracao, tempoEmExecucao } from "@compartilhado/dominio/tempos";
import { useHistoricoFuncionario } from "../../dados/hooks";
import type { OSVisao } from "../../dados/repositorio";
import { ESTADO_ETAPA, PAPEL } from "../../dominio/rotulos";
import { formatarPrazo } from "../producao/quadro";
import { formatarTelefone } from "../clientes/formato";
import { nomeCompetencia } from "../financeiro/formato";
import { PlacaOS } from "../gestao/Comuns";
import { Botao, Erro, Esqueleto, FaixaIndicadores, Indicador } from "../ui/Basicos";
import { Etiqueta } from "../ui/Estado";
import { Gaveta } from "../ui/Gaveta";
import { LinhaPrevia, Previa } from "../ui/Campos";
import { Placa } from "../ui/Placa";
import { Icone } from "../Icone";
import { Avatar } from "./Pessoas";
import { EVENTO, TOM_PERMISSAO, funcaoEPermissao } from "./modelo";

const PASSO_HISTORICO = 20;

/**
 * Perfil do funcionário (gaveta): resumo do mês (resumoFuncionario), o que faz agora, salário e comissões (só
 * quem vê a folha) e o histórico "Concluiu Pintura · RKP1L34 · hoje 14:00" (historicoFuncionario).
 */
export function PerfilFuncionario({
  p,
  oss,
  regras,
  mes,
  agora,
  veFolha,
  veContato,
  podeGerenciar,
  podeDarLogin,
  onFechar,
  onEditar,
  onLogin,
}: {
  p: Perfil;
  oss: OSVisao[];
  /** Regras de comissão (vazio para quem não vê a folha: o resumo sai sem R$). */
  regras: RegraComissao[];
  mes: string;
  agora: string;
  veFolha: boolean;
  veContato: boolean;
  podeGerenciar: boolean;
  podeDarLogin: boolean;
  onFechar: () => void;
  onEditar: () => void;
  onLogin: () => void;
}) {
  const historico = useHistoricoFuncionario(p.id);
  const [mostrar, setMostrar] = useState(PASSO_HISTORICO);
  const resumo = useMemo(() => resumoFuncionario(p.id, oss, mes, veFolha ? regras : []), [p.id, oss, mes, regras, veFolha]);
  const porOS = useMemo(() => new Map(oss.map((v) => [v.os.id, v])), [oss]);
  const agoraEtapas = useMemo(
    () => oss.flatMap((v) => v.etapas).filter((e) => e.responsavelId === p.id && (e.estado === "em_execucao" || e.estado === "bloqueada")),
    [oss, p.id],
  );
  const nomeMes = nomeCompetencia(mes).split(" de ")[0];

  return (
    <Gaveta
      titulo={p.nome}
      descricao={funcaoEPermissao(p)}
      antesDoTitulo={<Avatar nome={p.nome} grande apagado={!p.ativo} />}
      onFechar={onFechar}
      corpoClassName="flex flex-col gap-6"
      rodape={
        <div className="flex items-center justify-end gap-2">
          <Botao variante="fantasma" onClick={onFechar} className="max-md:flex-1">
            Fechar
          </Botao>
          {podeDarLogin && (
            <Botao variante="contorno" onClick={onLogin} className="max-md:flex-1">
              {p.temLogin ? "Login e senha" : "Dar login"}
            </Botao>
          )}
          {podeGerenciar && (
            <Botao variante="contorno" onClick={onEditar} className="max-md:flex-1">
              Editar
            </Botao>
          )}
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Etiqueta tom={TOM_PERMISSAO[p.papel]}>{PAPEL[p.papel]}</Etiqueta>
        {!p.ativo && <Etiqueta tom="neutro">Desligado</Etiqueta>}
        {p.temLogin && p.usuario ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-tinta-suave">
            <Icone nome="pessoa" tamanho={14} className="text-tinta-fraca" /> entra como <strong className="font-semibold text-tinta">{p.usuario}</strong>
          </span>
        ) : (
          <span className="text-[13px] text-tinta-fraca">Sem login</span>
        )}
      </div>

      <section aria-labelledby="perfil-mes" className="flex flex-col gap-3">
        <h3 id="perfil-mes" className="text-[14px] font-semibold first-letter:uppercase">
          {nomeMes} até agora
        </h3>
        <FaixaIndicadores colunas={2}>
          <Indicador rotulo="Etapas concluídas" valor={resumo.etapasConcluidas} />
          <Indicador rotulo="Carros" valor={resumo.carros} />
          <Indicador rotulo="Tempo médio" valor={resumo.tempoMedioMin === null ? "—" : <span className="whitespace-nowrap">{formatarDuracao(resumo.tempoMedioMin)}</span>} detalhe="em execução, sem o tempo parado" />
          {veFolha ? (
            <Indicador
              rotulo="Comissões"
              valor={<span className="whitespace-nowrap">{formatarReais(resumo.comissoes)}</span>}
              detalhe={`${resumo.quantidadeComissoes} ${resumo.quantidadeComissoes === 1 ? "etapa comissionada" : "etapas comissionadas"}`}
            />
          ) : (
            <Indicador rotulo="Tipos de etapa" valor={resumo.porEtapa.length} />
          )}
        </FaixaIndicadores>
        {resumo.porEtapa.length > 0 && (
          <ul className="flex flex-col">
            {resumo.porEtapa.map((e) => (
              <li key={e.etapa} className="flex items-baseline justify-between gap-3 py-1.5 border-b border-linha last:border-b-0 text-[13px]">
                <span className="font-medium">{e.etapa}</span>
                <span className="numero text-tinta-suave whitespace-nowrap">
                  {e.quantidade} {e.quantidade === 1 ? "vez" : "vezes"}
                  {e.tempoMedioMin !== null && ` · média ${formatarDuracao(e.tempoMedioMin)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="perfil-agora" className="flex flex-col gap-2">
        <h3 id="perfil-agora" className="text-[14px] font-semibold">
          Agora
        </h3>
        {agoraEtapas.length === 0 ? (
          <p className="text-[13px] text-tinta-fraca">Nenhuma etapa em execução ou parada.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {agoraEtapas.map((e) => (
              <li key={e.id} className="flex items-center gap-3">
                <PlacaOS v={porOS.get(e.osId)} />
                <span className="min-w-0">
                  <span className="block text-[14px] font-medium">{e.nome}</span>
                  {e.estado === "bloqueada" ? (
                    <span className="block text-[12px] font-medium text-alerta">
                      {ESTADO_ETAPA.bloqueada.texto}
                      {e.bloqueios.at(-1)?.motivo ? ` · ${e.bloqueios.at(-1)?.motivo}` : ""}
                    </span>
                  ) : (
                    <span className="block text-[12px] text-tinta-suave numero">em execução há {formatarDuracao(tempoEmExecucao(e, agora))}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(veFolha || veContato) && (
        <Previa titulo="Cadastro">
          {veContato && <LinhaPrevia rotulo="Telefone">{p.telefone ? formatarTelefone(p.telefone) : <span className="text-tinta-fraca">não informado</span>}</LinhaPrevia>}
          <LinhaPrevia rotulo="Admissão">{p.admitidoEm ? p.admitidoEm.split("-").reverse().join("/") : <span className="text-tinta-fraca">não informada</span>}</LinhaPrevia>
          {veFolha && (
            <LinhaPrevia rotulo="Salário mensal">{p.salarioMensal !== undefined ? formatarReais(p.salarioMensal) : <span className="text-tinta-fraca">sem salário fixo</span>}</LinhaPrevia>
          )}
          {veFolha && <LinhaPrevia rotulo={`Comissões de ${nomeMes}`}>{formatarReais(resumo.comissoes)}</LinhaPrevia>}
        </Previa>
      )}

      <section aria-labelledby="perfil-historico" className="flex flex-col gap-2">
        <h3 id="perfil-historico" className="text-[14px] font-semibold">
          Histórico
        </h3>
        {historico.isPending ? (
          <Esqueleto linhas={4} altura="h-10" />
        ) : historico.isError || !historico.data ? (
          <Erro mensagem="Não consegui carregar o histórico." onTentar={() => historico.refetch()} />
        ) : historico.data.length === 0 ? (
          <p className="text-[13px] text-tinta-fraca">Nada registrado ainda. Aparece aqui quando a pessoa iniciar, concluir ou parar uma etapa.</p>
        ) : (
          <>
            <ol className="flex flex-col">
              {historico.data.slice(0, mostrar).map((ev, i) => {
                const visual = EVENTO[ev.tipo];
                const cor = visual.tom === "ok" ? "bg-ok-claro text-ok" : visual.tom === "alerta" ? "bg-alerta-claro text-alerta" : "bg-cinza-100 text-tinta-suave";
                // o texto do domínio já traz a placa ("Concluiu Pintura · RKP1L34"); a placa vira o componente
                const texto = ev.placa ? ev.texto.replace(` · ${ev.placa}`, "") : ev.texto;
                return (
                  <li key={`${ev.em}-${ev.tipo}-${i}`} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 py-2 border-b border-linha last:border-b-0">
                    <span aria-hidden="true" className={`inline-grid place-items-center w-7 h-7 rounded-full ${cor}`}>
                      <Icone nome={visual.icone} tamanho={14} traco={2} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium leading-snug">{texto}</span>
                      <span className="block text-[12px] text-tinta-suave numero">{formatarPrazo(ev.em, agora)}</span>
                    </span>
                    {ev.placa ? <Placa placa={ev.placa} tamanho="p" /> : <span />}
                  </li>
                );
              })}
            </ol>
            {historico.data.length > mostrar && (
              <Botao variante="fantasma" tamanho="denso" className="self-start" onClick={() => setMostrar((m) => m + PASSO_HISTORICO)}>
                Mostrar mais ({historico.data.length - mostrar})
              </Botao>
            )}
          </>
        )}
      </section>
    </Gaveta>
  );
}

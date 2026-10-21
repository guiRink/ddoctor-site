import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Perfil } from "@compartilhado/tipos";
import { dataNoFuso, formatarMarco, mesDe, msDeLocal } from "@compartilhado/dominio/fuso";
import { useAgora, useOSs, usePerfis, useRegrasComissao } from "../dados/hooks";
import type { OSVisao } from "../dados/repositorio";
import { useSessao } from "../dados/sessao";
import { podeEditarPapel, podeEditarPerfilDe, podeEditarSalario, podeGerenciarEquipe, podePagarFolha, podeVerFolha, veDadosSensiveis } from "../dominio/permissoes";
import { Botao, CabecalhoPagina, Esqueleto } from "../componentes/ui/Basicos";
import { Abas, PainelAba } from "../componentes/ui/Abas";
import { GrupoFiltros } from "../componentes/ui/Filtros";
import { SeletorPeriodo } from "../componentes/ui/Periodo";
import { EstadoConsultas } from "../componentes/gestao/Consultas";
import { Retorno } from "../componentes/gestao/Comuns";
import { useParametro } from "../componentes/financeiro/useParametro";
import { nomeCompetencia, somarMeses } from "../componentes/financeiro/formato";
import { Pessoas } from "../componentes/equipe/Pessoas";
import { PerfilFuncionario } from "../componentes/equipe/PerfilFuncionario";
import { FormFuncionario } from "../componentes/equipe/FormFuncionario";
import { FormLogin } from "../componentes/equipe/FormLogin";
import { Folha } from "../componentes/equipe/Folha";
import { ordenarEquipe } from "../componentes/equipe/modelo";

const ABAS = ["pessoas", "folha"] as const;
type AbaEquipe = (typeof ABAS)[number];
type Situacao = "ativos" | "desligados" | "todos";
const MES_VALIDO = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Equipe (sprint S1, pedido do dono): quem trabalha na oficina, a função, a permissão no painel, o login e o
 * histórico de cada um; aba Folha (salário + comissões por serviço) para quem vê a folha. Dono e gerente abrem a
 * tela; trocar permissão, dar login, salário e folha só o dono (helpers de permissoes.ts; a barreira é a RLS).
 * Substitui a tela Funcionários (rota /funcionarios redireciona).
 */
export function Equipe() {
  const perfisQ = usePerfis();
  const ossQ = useOSs();
  const { perfil } = useSessao();
  const veFolha = podeVerFolha(perfil.papel);
  const regrasQ = useRegrasComissao(veFolha);
  return (
    <EstadoConsultas
      consultas={veFolha ? [perfisQ, ossQ, regrasQ] : [perfisQ, ossQ]}
      esqueleto={
        <div className="flex flex-col gap-6" role="status" aria-label="Carregando a equipe">
          <div className="esqueleto h-14 w-72" />
          <Esqueleto linhas={6} altura="h-[60px]" />
        </div>
      }
    >
      {() => <Conteudo perfis={perfisQ.data!} oss={ossQ.data!} regras={veFolha ? regrasQ.data! : []} />}
    </EstadoConsultas>
  );
}

type Gaveta = { tipo: "perfil"; id: string } | { tipo: "editar"; id?: string } | { tipo: "login"; id: string } | null;

function Conteudo({ perfis, oss, regras }: { perfis: Perfil[]; oss: OSVisao[]; regras: NonNullable<ReturnType<typeof useRegrasComissao>["data"]> }) {
  const { perfil: eu } = useSessao();
  const papel = eu.papel;
  const agora = useAgora(60_000);
  const hoje = dataNoFuso(agora);
  const mesAtual = mesDe(hoje);
  const veFolha = podeVerFolha(papel);
  const gerenciar = podeGerenciarEquipe(papel);
  const dono = podeEditarPapel(papel);
  const [aba, setAba] = useParametro<AbaEquipe>("aba", ABAS, "pessoas");
  const abaAtual: AbaEquipe = aba === "folha" && !veFolha ? "pessoas" : aba;
  const [params, setParams] = useSearchParams();
  const mesParam = params.get("mes");
  const mes = mesParam && MES_VALIDO.test(mesParam) ? mesParam : mesAtual;
  const setMes = (m: string) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (m === mesAtual) n.delete("mes");
        else n.set("mes", m);
        return n;
      },
      { replace: true },
    );
  const [situacao, setSituacao] = useState<Situacao>("ativos");
  const [gaveta, setGaveta] = useState<Gaveta>(null);
  const [aviso, setAviso] = useState<string>();

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(undefined), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  const equipe = useMemo(() => ordenarEquipe(perfis), [perfis]);
  const aparelhos = perfis.filter((p) => p.papel === "dispositivo");
  const ativos = equipe.filter((p) => p.ativo);
  const desligados = equipe.length - ativos.length;
  const visiveis = situacao === "ativos" ? ativos : situacao === "desligados" ? equipe.filter((p) => !p.ativo) : equipe;
  const comLogin = ativos.filter((p) => p.temLogin).length;
  const emServico = new Set(oss.flatMap((v) => v.etapas).filter((e) => e.estado === "em_execucao" && e.responsavelId).map((e) => e.responsavelId)).size;
  const desdeMes = formatarMarco(msDeLocal(`${mesAtual}-01`, 0));

  const achar = (id?: string) => perfis.find((p) => p.id === id);
  const aberto = gaveta && "id" in gaveta ? achar(gaveta.id) : undefined;

  return (
    <>
      <CabecalhoPagina
        titulo="Equipe"
        resumo={
          <>
            <span className="whitespace-nowrap">
              <span className="numero">{ativos.length}</span> {ativos.length === 1 ? "pessoa" : "pessoas"}
            </span>{" "}
            ·{" "}
            <span className="whitespace-nowrap">
              <span className="numero">{comLogin}</span> com login
            </span>{" "}
            ·{" "}
            <span className="whitespace-nowrap">
              <span className="numero">{emServico}</span> em serviço agora
            </span>
          </>
        }
        acoes={
          gerenciar && (
            <Botao variante="primario" icone="mais" onClick={() => setGaveta({ tipo: "editar" })}>
              Cadastrar funcionário
            </Botao>
          )
        }
      />

      {aviso && (
        <div className="mb-4 flex items-center gap-2 px-4 min-h-11 py-2 rounded-cartao bg-ok-claro border border-ok/20">
          <Retorno ok={aviso} />
        </div>
      )}

      {veFolha && (
        <Abas<AbaEquipe>
          rotulo="Seções da equipe"
          idBase="equipe"
          valor={abaAtual}
          onMudar={setAba}
          abas={[
            { valor: "pessoas", texto: "Pessoas", contagem: ativos.length },
            { valor: "folha", texto: "Folha" },
          ]}
        />
      )}

      <PainelAba idBase="equipe" valor={abaAtual}>
        {abaAtual === "pessoas" && (
          <>
            {desligados > 0 && (
              <div className="mb-4">
                <GrupoFiltros<Situacao>
                  rotulo="Mostrar"
                  valor={situacao}
                  onMudar={setSituacao}
                  opcoes={[
                    { valor: "ativos", texto: "Ativos", contagem: ativos.length },
                    { valor: "desligados", texto: "Desligados", contagem: desligados },
                    { valor: "todos", texto: "Todos", contagem: equipe.length },
                  ]}
                />
              </div>
            )}
            <Pessoas
              pessoas={visiveis}
              aparelhos={situacao === "desligados" ? [] : aparelhos}
              oss={oss}
              agora={agora}
              desdeMes={desdeMes}
              podeEditarPessoa={(p) => podeEditarPerfilDe(papel, p.papel)}
              podeDarLogin={dono}
              onAbrir={(p) => setGaveta({ tipo: "perfil", id: p.id })}
              onEditar={(p) => setGaveta({ tipo: "editar", id: p.id })}
              onLogin={(p) => setGaveta({ tipo: "login", id: p.id })}
              onCadastrar={gerenciar ? () => setGaveta({ tipo: "editar" }) : undefined}
            />
          </>
        )}
        {abaAtual === "folha" && (
          <Folha
            mes={mes}
            podeAjustar={podeEditarSalario(papel)}
            podePagar={podePagarFolha(papel)}
            seletor={
              <SeletorPeriodo
                rotulo="Mês da folha"
                texto={nomeCompetencia(mes)}
                onAnterior={() => setMes(somarMeses(mes, -1))}
                onProximo={() => setMes(somarMeses(mes, 1))}
                rotuloAnterior="Mês anterior"
                rotuloProximo="Próximo mês"
                proximoDesabilitado={mes >= mesAtual}
                atalho={mes !== mesAtual ? { texto: "Mês atual", onClick: () => setMes(mesAtual) } : undefined}
              />
            }
          />
        )}
      </PainelAba>

      {gaveta?.tipo === "perfil" && aberto && (
        <PerfilFuncionario
          p={aberto}
          oss={oss}
          regras={regras}
          mes={mesAtual}
          agora={agora}
          veFolha={veFolha}
          veContato={veDadosSensiveis(papel)}
          podeGerenciar={podeEditarPerfilDe(papel, aberto.papel) && aberto.papel !== "dispositivo"}
          podeDarLogin={dono}
          onFechar={() => setGaveta(null)}
          onEditar={() => setGaveta({ tipo: "editar", id: aberto.id })}
          onLogin={() => setGaveta({ tipo: "login", id: aberto.id })}
        />
      )}
      {gaveta?.tipo === "editar" && gerenciar && (gaveta.id === undefined || (aberto && podeEditarPerfilDe(papel, aberto.papel))) && (
        <FormFuncionario
          perfil={aberto}
          podeEditarPapel={dono}
          podeEditarSalario={podeEditarSalario(papel)}
          onFechar={() => setGaveta(null)}
          onFeito={(id, msg, novo) => {
            setAviso(msg);
            // cadastro novo pelo dono: já abre o login, que é o próximo passo
            setGaveta(novo && dono ? { tipo: "login", id } : null);
          }}
        />
      )}
      {gaveta?.tipo === "login" && dono && aberto && (
        <FormLogin
          perfil={aberto}
          perfis={perfis}
          souEu={aberto.id === eu.id}
          onFechar={() => setGaveta(null)}
          onFeito={(msg) => {
            setGaveta(null);
            setAviso(msg);
          }}
        />
      )}
    </>
  );
}

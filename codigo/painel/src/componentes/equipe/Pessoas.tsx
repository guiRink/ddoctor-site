import { useMemo, type MouseEvent } from "react";
import type { Perfil } from "@compartilhado/tipos";
import { formatarDuracao, tempoEmExecucao } from "@compartilhado/dominio/tempos";
import type { OSVisao } from "../../dados/repositorio";
import { ESTADO_ETAPA, PAPEL } from "../../dominio/rotulos";
import { numerosPessoa, type NumerosPessoa } from "../gestao/resumos";
import { PlacaOS } from "../gestao/Comuns";
import { Botao, Cartao, SUPERFICIE, Vazio, iniciais } from "../ui/Basicos";
import { Etiqueta } from "../ui/Estado";
import { Linha, Tabela, Td, Th } from "../ui/Tabela";
import { Icone } from "../Icone";
import { TOM_PERMISSAO } from "./modelo";

/**
 * Aba Pessoas da Equipe (sprint S1): uma linha por pessoa com função, permissão (pílula), login, o que faz agora
 * (etapas em execução ou paradas — o que a tela Funcionários já mostrava) e etapas concluídas no mês. A linha
 * inteira abre o perfil; "Editar" e "Dar login" ficam à direita (login só para o dono). Celular: um cartão por
 * pessoa com os dois botões de 44 px.
 */
export function Pessoas({
  pessoas,
  aparelhos,
  oss,
  agora,
  desdeMes,
  podeGerenciar,
  podeDarLogin,
  onAbrir,
  onEditar,
  onLogin,
  onCadastrar,
}: {
  pessoas: Perfil[];
  aparelhos: Perfil[];
  oss: OSVisao[];
  agora: string;
  /** Início do mês (marco) para "No mês". */
  desdeMes: string;
  podeGerenciar: boolean;
  podeDarLogin: boolean;
  onAbrir: (p: Perfil) => void;
  onEditar: (p: Perfil) => void;
  onLogin: (p: Perfil) => void;
  onCadastrar?: () => void;
}) {
  const etapas = useMemo(() => oss.flatMap((v) => v.etapas), [oss]);
  const porOS = useMemo(() => new Map(oss.map((v) => [v.os.id, v])), [oss]);
  const linhas = pessoas.map((p) => ({ p, n: numerosPessoa(etapas, p.id, desdeMes, agora) }));

  if (pessoas.length === 0) {
    return (
      <div className={SUPERFICIE}>
        <Vazio
          icone="funcionarios"
          titulo="Ninguém cadastrado ainda"
          texto="Cadastre quem trabalha na oficina: o nome, a função e o que cada um pode ver no painel."
          acao={
            onCadastrar && (
              <Botao variante="contorno" icone="mais" onClick={onCadastrar}>
                Cadastrar funcionário
              </Botao>
            )
          }
        />
      </div>
    );
  }

  const parar = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <>
      <Tabela legenda="Pessoas da equipe" className="hidden md:block">
        <thead>
          <tr>
            <Th>Pessoa</Th>
            <Th>Permissão</Th>
            <Th>Login</Th>
            <Th>Agora</Th>
            <Th direita title="Etapas concluídas desde o dia 1º">
              No mês
            </Th>
            <Th>
              <span className="sr-only">Ações</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(({ p, n }) => (
            <Linha key={p.id} onClick={() => onAbrir(p)} className={p.ativo ? "" : "text-tinta-suave"}>
              <Td className="min-w-[220px]">
                <button
                  type="button"
                  onClick={parar(() => onAbrir(p))}
                  aria-label={`Abrir o perfil de ${p.nome}`}
                  className="flex items-center gap-2.5 text-left min-w-0 rounded-controle -m-1 p-1"
                >
                  <Avatar nome={p.nome} apagado={!p.ativo} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-[14px] font-semibold text-tinta truncate">{p.nome}</span>
                      {!p.ativo && <Etiqueta tom="neutro">Desligado</Etiqueta>}
                    </span>
                    <span className="block text-[12px] text-tinta-suave truncate">{p.funcao ?? "Sem função informada"}</span>
                  </span>
                </button>
              </Td>
              <Td>
                <Etiqueta tom={TOM_PERMISSAO[p.papel]}>{PAPEL[p.papel]}</Etiqueta>
              </Td>
              <Td className="min-w-[170px]">
                <Login p={p} podeDarLogin={podeDarLogin} onLogin={parar(() => onLogin(p))} />
              </Td>
              {/* a placa abre a ficha da OS: o clique não abre o perfil junto */}
              <Td className="min-w-[220px]" onClick={(e) => e.stopPropagation()}>
                <Agora n={n} porOS={porOS} agora={agora} />
              </Td>
              <Td numero className={n.concluidas.length ? "font-semibold text-tinta" : "text-tinta-fraca"}>
                {n.concluidas.length}
              </Td>
              <Td className="text-right whitespace-nowrap w-[1%]">
                {podeGerenciar && (
                  <Botao tamanho="denso" variante="contorno" aria-label={`Editar ${p.nome}`} onClick={parar(() => onEditar(p))}>
                    Editar
                  </Botao>
                )}
              </Td>
            </Linha>
          ))}
        </tbody>
      </Tabela>

      <ul className="md:hidden flex flex-col gap-2" aria-label="Pessoas da equipe">
        {linhas.map(({ p, n }) => (
          <li key={p.id} className={`${SUPERFICIE} overflow-hidden`}>
            <button
              type="button"
              onClick={() => onAbrir(p)}
              aria-label={`Abrir o perfil de ${p.nome}`}
              className="flex items-center gap-3 w-full min-h-16 px-4 py-3 text-left hover:bg-cinza-50"
            >
              <Avatar nome={p.nome} apagado={!p.ativo} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold truncate">{p.nome}</span>
                <span className="block text-[13px] text-tinta-suave truncate">{p.funcao ?? "Sem função informada"}</span>
              </span>
              <span className="flex flex-col items-end gap-1 shrink-0">
                <Etiqueta tom={TOM_PERMISSAO[p.papel]}>{PAPEL[p.papel]}</Etiqueta>
                {!p.ativo && <Etiqueta tom="neutro">Desligado</Etiqueta>}
              </span>
              <Icone nome="seta" tamanho={16} className="shrink-0 text-tinta-fraca" />
            </button>
            <dl className="m-0 px-4 pb-3 grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13px]">
              <dt className="text-tinta-suave">Login</dt>
              <dd className="m-0 min-w-0">
                <Login p={p} podeDarLogin={false} onLogin={() => undefined} />
              </dd>
              <dt className="text-tinta-suave">Agora</dt>
              <dd className="m-0 min-w-0">
                <Agora n={n} porOS={porOS} agora={agora} />
              </dd>
              <dt className="text-tinta-suave">No mês</dt>
              <dd className="m-0 numero">
                {n.concluidas.length} {n.concluidas.length === 1 ? "etapa concluída" : "etapas concluídas"}
              </dd>
            </dl>
            {(podeGerenciar || podeDarLogin) && (
              <div className="flex gap-2 px-4 pb-4">
                {podeGerenciar && (
                  <Botao variante="contorno" className="flex-1" aria-label={`Editar ${p.nome}`} onClick={() => onEditar(p)}>
                    Editar
                  </Botao>
                )}
                {podeDarLogin && (
                  <Botao variante="contorno" className="flex-1" aria-label={`${p.temLogin ? "Login de" : "Dar login a"} ${p.nome}`} onClick={() => onLogin(p)}>
                    {p.temLogin ? "Login e senha" : "Dar login"}
                  </Botao>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {aparelhos.length > 0 && (
        <Cartao titulo="Aparelhos" contagem={aparelhos.length} className="mt-6">
          <ul>
            {aparelhos.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 border-b border-linha last:border-b-0">
                <span className="flex items-center gap-3 min-w-0">
                  <span aria-hidden="true" className="inline-grid place-items-center w-9 h-9 rounded-cartao bg-cinza-100 text-tinta-suave shrink-0">
                    <Icone nome="tv" tamanho={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold truncate">{a.nome}</span>
                    <span className="block text-[12px] text-tinta-suave">Abre só o quadro da produção, sem valores nem clientes.</span>
                  </span>
                </span>
                <Login p={a} podeDarLogin={podeDarLogin} onLogin={() => onLogin(a)} />
              </li>
            ))}
          </ul>
        </Cartao>
      )}
    </>
  );
}

/** Avatar 36 px com iniciais (mesmo desenho do `Responsavel`, um passo maior para a lista da Equipe). */
export function Avatar({ nome, apagado = false, grande = false }: { nome: string; apagado?: boolean; grande?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-grid place-items-center shrink-0 rounded-full font-semibold ${grande ? "w-11 h-11 text-[15px]" : "w-9 h-9 text-[12px]"} ${
        apagado ? "bg-cinza-100 text-tinta-fraca" : "bg-cinza-200 text-tinta"
      }`}
    >
      {iniciais(nome)}
    </span>
  );
}

/** Login da pessoa: o usuário com que entra, ou "Sem login" (+ "Dar login" para o dono). */
function Login({ p, podeDarLogin, onLogin }: { p: Perfil; podeDarLogin: boolean; onLogin: (e: MouseEvent) => void }) {
  if (p.temLogin && p.usuario)
    return (
      <span className="inline-flex items-center gap-2 min-w-0">
        <span className="inline-flex items-center gap-1.5 min-w-0 text-[13px] font-medium text-tinta">
          <Icone nome="pessoa" tamanho={14} className="shrink-0 text-tinta-fraca" />
          <span className="truncate">{p.usuario}</span>
        </span>
        {podeDarLogin && (
          <button
            type="button"
            onClick={onLogin}
            aria-label={`Login e senha de ${p.nome}`}
            className="inline-flex items-center h-8 px-2 rounded-controle text-[12px] font-medium text-tinta-suave hover:text-tinta hover:bg-cinza-100 transition-colors duration-150"
          >
            Trocar senha
          </button>
        )}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-[13px] text-tinta-fraca">Sem login</span>
      {podeDarLogin && (
        <Botao tamanho="denso" variante="contorno" aria-label={`Dar login a ${p.nome}`} onClick={onLogin}>
          Dar login
        </Botao>
      )}
    </span>
  );
}

/** Etapas em execução ou paradas agora, com a placa (o que a pessoa está fazendo). */
function Agora({ n, porOS, agora }: { n: NumerosPessoa; porOS: Map<string, OSVisao>; agora: string }) {
  if (n.emAndamento.length === 0) return <span className="text-[13px] text-tinta-fraca">Nenhuma etapa agora</span>;
  return (
    <ul className="flex flex-col gap-1.5">
      {n.emAndamento.slice(0, 2).map((e) => (
        <li key={e.id} className="flex items-center gap-2.5 min-w-0">
          <PlacaOS v={porOS.get(e.osId)} />
          <span className="min-w-0">
            <span className="block text-[13px] font-medium truncate">{e.nome}</span>
            {e.estado === "bloqueada" ? (
              <span className="block text-[12px] font-medium text-alerta">{ESTADO_ETAPA.bloqueada.texto}</span>
            ) : (
              <span className="block text-[12px] text-tinta-suave numero">em execução há {formatarDuracao(tempoEmExecucao(e, agora))}</span>
            )}
          </span>
        </li>
      ))}
      {n.emAndamento.length > 2 && <li className="text-[12px] text-tinta-suave">e mais {n.emAndamento.length - 2}</li>}
    </ul>
  );
}

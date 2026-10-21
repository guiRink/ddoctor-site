import { useDeferredValue, useState } from "react";
import type { Perfil, RegistroAuditoria } from "@compartilhado/tipos";
import { useAuditoria } from "../../dados/hooks";
import { LIMITE_AUDITORIA } from "../../dados/repositorio";
import { rotuloAcao } from "../../dominio/rotulos";
import { Botao, Responsavel, Vazio } from "../ui/Basicos";
import { Etiqueta } from "../ui/Estado";
import { CLASSE_TH } from "../ui/Tabela";
import { CLASSE_CAMPO } from "../gestao/formato";
import { marcoCurto } from "../orcamentos/formato";
import { Icone } from "../Icone";
import { Consulta, Secao } from "./Estrutura";


const semAcento = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const PAGINA = 50;

/** Registro de auditoria: quem fez o quê e quando. Só leitura; filtro por texto (resumo, pessoa ou ação). */
export function Auditoria({ perfis }: { perfis: Perfil[] }) {
  const q = useAuditoria();
  const [busca, setBusca] = useState("");
  const termo = useDeferredValue(semAcento(busca.trim()));
  const [limite, setLimite] = useState(PAGINA);
  const nome = (id?: string) => perfis.find((p) => p.id === id)?.nome;

  return (
    <Secao id="auditoria" titulo="Auditoria" descricao={`Quem mudou o quê, e quando. Na demonstração, as últimas ${LIMITE_AUDITORIA} ações.`}>
      <Consulta q={q}>
        {(linhas: RegistroAuditoria[]) => {
          const filtradas = termo
            ? linhas.filter((l) => semAcento(`${l.resumo} ${nome(l.perfilId) ?? ""} ${rotuloAcao(l.acao)}`).includes(termo))
            : linhas;
          const visiveis = filtradas.slice(0, limite);
          return (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-linha">
                <label htmlFor="auditoria-busca" className="relative flex-1 max-w-sm">
                  <span className="sr-only">Filtrar o registro</span>
                  <Icone nome="busca" tamanho={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tinta-fraca pointer-events-none" />
                  <input
                    id="auditoria-busca"
                    type="search"
                    value={busca}
                    onChange={(e) => {
                      setBusca(e.target.value);
                      setLimite(PAGINA);
                    }}
                    placeholder="Filtrar por pessoa, ação ou texto"
                    className={`${CLASSE_CAMPO} pl-8`}
                  />
                </label>
                <span className="text-[12px] text-tinta-suave numero">
                  {termo ? `${filtradas.length} de ${linhas.length} registros` : `${linhas.length} registros`}
                </span>
              </div>
              {linhas.length === 0 ? (
                <Vazio icone="documento" titulo="Nenhum registro ainda" texto="As alterações feitas no painel aparecem aqui assim que alguém registra algo." />
              ) : filtradas.length === 0 ? (
                <Vazio icone="busca" titulo="Nada encontrado" texto="Tente o nome de uma pessoa, uma placa ou parte do texto." acao={<Botao tamanho="denso" onClick={() => setBusca("")}>Limpar filtro</Botao>} />
              ) : (
                <>
                  <table className="hidden md:table w-full border-collapse text-[14px]">
                    <caption className="sr-only">Registro de auditoria</caption>
                    <thead>
                      <tr>
                        <th scope="col" className={`${CLASSE_TH} text-left w-32 pl-5`}>
                          Quando
                        </th>
                        <th scope="col" className={`${CLASSE_TH} text-left w-48`}>
                          Quem
                        </th>
                        <th scope="col" className={`${CLASSE_TH} text-left w-40`}>
                          Ação
                        </th>
                        <th scope="col" className={`${CLASSE_TH} text-left`}>
                          Resumo
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiveis.map((l) => (
                        <tr key={l.id} className="border-b border-linha last:border-b-0 hover:bg-cinza-50 transition-colors duration-150">
                          <td className="pl-5 pr-3 py-2.5 align-top text-[13px] text-tinta-suave numero whitespace-nowrap">{marcoCurto(l.em)}</td>
                          <td className="px-3 py-2 align-top">{nome(l.perfilId) ? <Responsavel nome={nome(l.perfilId)} /> : <span className="text-[13px] text-tinta-fraca">Sistema</span>}</td>
                          <td className="px-3 py-2.5 align-top">
                            <Etiqueta tom="neutro">{rotuloAcao(l.acao)}</Etiqueta>
                          </td>
                          <td className="px-3 py-2.5 align-top pr-5 break-words">{l.resumo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <ul className="md:hidden">
                    {visiveis.map((l) => (
                      <li key={l.id} className="px-4 py-3 border-b border-linha last:border-b-0">
                        <p className="flex items-center justify-between gap-2 text-[12px] text-tinta-suave numero">
                          <span className="truncate">
                            {nome(l.perfilId) ?? "Sistema"} · {rotuloAcao(l.acao)}
                          </span>
                          <span className="shrink-0">{marcoCurto(l.em)}</span>
                        </p>
                        <p className="mt-1 text-[14px] break-words">{l.resumo}</p>
                      </li>
                    ))}
                  </ul>
                  {filtradas.length > limite && (
                    <div className="px-5 py-3 border-t border-linha">
                      <Botao tamanho="denso" onClick={() => setLimite((n) => n + PAGINA)}>
                        Mostrar mais {Math.min(PAGINA, filtradas.length - limite)}
                      </Botao>
                    </div>
                  )}
                </>
              )}
            </>
          );
        }}
      </Consulta>
    </Secao>
  );
}

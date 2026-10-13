import { useMemo, useState } from "react";
import type { Fornecedor, Material } from "@compartilhado/tipos";
import { formatarDocumento } from "@compartilhado/dominio/documento";
import { Botao, SUPERFICIE, Vazio } from "../ui/Basicos";
import { Linha, Tabela, Td, Th } from "../ui/Tabela";
import { telefoneBR } from "../agenda/formato";
import { BarraFerramentas } from "../financeiro/Abas";
import { AcaoTexto, Busca } from "../financeiro/Campos";

const semAcento = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function AbaFornecedores({
  fornecedores,
  materiais,
  podeLancar,
  onNovo,
  onEditar,
}: {
  fornecedores: Fornecedor[];
  materiais: Material[];
  podeLancar: boolean;
  onNovo: () => void;
  onEditar: (f: Fornecedor) => void;
}) {
  const [termo, setTermo] = useState("");
  const qtdMateriais = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const m of materiais) if (m.fornecedorId && m.ativo !== false) mapa.set(m.fornecedorId, (mapa.get(m.fornecedorId) ?? 0) + 1);
    return mapa;
  }, [materiais]);

  const t = semAcento(termo.trim());
  const digitos = termo.replace(/\D/g, "");
  const lista = [...fornecedores]
    .filter((f) => !t || semAcento(f.nome).includes(t) || (digitos.length >= 3 && f.documento?.includes(digitos)))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const novo = podeLancar ? (
    <Botao tamanho="denso" icone="mais" onClick={onNovo}>
      Novo fornecedor
    </Botao>
  ) : undefined;

  if (fornecedores.length === 0) {
    return (
      <div className={SUPERFICIE}>
        <Vazio
          icone="pessoa"
          titulo="Nenhum fornecedor cadastrado"
          texto="Cadastre de quem a oficina compra material. O fornecedor aparece na entrada por compra e agrupa a lista de reposição."
          acao={novo}
        />
      </div>
    );
  }

  return (
    <>
      <BarraFerramentas filtros={<Busca valor={termo} onMudar={setTermo} rotulo="Buscar fornecedor" placeholder="Nome ou CNPJ" />} acoes={novo} />
      {lista.length === 0 ? (
        <div className={SUPERFICIE}>
          <Vazio icone="busca" titulo="Nenhum fornecedor encontrado" texto="Confira o nome ou o CNPJ digitado." acao={<Botao tamanho="denso" onClick={() => setTermo("")}>Limpar busca</Botao>} />
        </div>
      ) : (
        <>
          <Tabela legenda="Fornecedores" className="hidden md:block">
            <thead>
              <tr>
                <Th>Fornecedor</Th>
                <Th>CNPJ / CPF</Th>
                <Th>Contato</Th>
                <Th direita>Materiais</Th>
                <Th>Observação</Th>
                {podeLancar && (
                  <Th direita>
                    <span className="sr-only">Ações</span>
                  </Th>
                )}
              </tr>
            </thead>
            <tbody>
              {lista.map((f) => (
                <Linha key={f.id}>
                  <Td className="font-medium">{f.nome}</Td>
                  <Td className="numero text-tinta-suave whitespace-nowrap">{f.documento ? formatarDocumento(f.documento) : "—"}</Td>
                  <Td className="text-[13px]">
                    <span className="block numero whitespace-nowrap">{f.telefone ? telefoneBR(f.telefone) : <span className="text-tinta-fraca">—</span>}</span>
                    {f.email && <span className="block text-tinta-suave">{f.email}</span>}
                  </Td>
                  <Td numero>{qtdMateriais.get(f.id) ?? 0}</Td>
                  <Td className="max-w-[280px] text-tinta-suave">
                    <span className="block truncate" title={f.obs}>
                      {f.obs ?? "—"}
                    </span>
                  </Td>
                  {podeLancar && (
                    <Td className="text-right w-[1%]">
                      <AcaoTexto onClick={() => onEditar(f)} rotulo={`Editar ${f.nome}`}>
                        Editar
                      </AcaoTexto>
                    </Td>
                  )}
                </Linha>
              ))}
            </tbody>
          </Tabela>

          <ul className="md:hidden flex flex-col gap-2" aria-label="Fornecedores">
            {lista.map((f) => (
              <li key={f.id} className={`${SUPERFICIE} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-medium leading-snug">{f.nome}</span>
                    <span className="block text-[12px] text-tinta-suave numero">
                      {f.documento ? formatarDocumento(f.documento) : "Sem documento"} · {qtdMateriais.get(f.id) ?? 0} materiais
                    </span>
                  </span>
                  {podeLancar && (
                    <Botao tamanho="denso" variante="fantasma" onClick={() => onEditar(f)} aria-label={`Editar ${f.nome}`}>
                      Editar
                    </Botao>
                  )}
                </div>
                {(f.telefone || f.email) && (
                  <p className="mt-2 text-[13px] numero">{[f.telefone && telefoneBR(f.telefone), f.email].filter(Boolean).join(" · ")}</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

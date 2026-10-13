import { useId, useMemo, useState, type KeyboardEvent } from "react";
import type { ClienteResumo } from "../../dados/repositorio";
import { Icone } from "../Icone";
import { Placa } from "../ui/Placa";
import { AvatarCliente, EtiquetaPJ } from "./Comuns";
import { documentoExibicao, formatarTelefone, resumoCorresponde, tipoDoCliente } from "./formato";

const MAX_RESULTADOS = 6;

/**
 * Campo de busca de cliente já cadastrado (combobox com lista de sugestões).
 * Procura por nome, CPF/CNPJ, telefone/WhatsApp, e-mail ou placa. Setas escolhem, Enter confirma, Esc fecha.
 */
export function BuscaCliente({
  id,
  clientes,
  carregando,
  erro,
  onEscolher,
}: {
  id: string;
  clientes?: ClienteResumo[];
  carregando: boolean;
  erro: boolean;
  onEscolher: (r: ClienteResumo) => void;
}) {
  const lista = useId();
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);

  const resultados = useMemo(() => {
    const t = termo.trim();
    if (t.length < 2 || !clientes) return [];
    return clientes.filter((r) => resumoCorresponde(r, t)).slice(0, MAX_RESULTADOS);
  }, [clientes, termo]);

  const mostrar = aberto && termo.trim().length >= 2;

  function escolher(r: ClienteResumo) {
    onEscolher(r);
    setTermo("");
    setAberto(false);
  }

  function tecla(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAberto(true);
      setAtivo((a) => Math.min(a + 1, Math.max(resultados.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (mostrar && resultados[ativo]) {
        e.preventDefault();
        escolher(resultados[ativo]);
      } else if (mostrar) e.preventDefault(); // não envia o formulário pela busca
    } else if (e.key === "Escape" && mostrar) {
      e.preventDefault();
      setAberto(false);
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tinta-fraca pointer-events-none">
          <Icone nome="busca" tamanho={16} />
        </span>
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={mostrar}
          aria-controls={lista}
          aria-autocomplete="list"
          aria-activedescendant={mostrar && resultados[ativo] ? `${lista}-${ativo}` : undefined}
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value);
            setAberto(true);
            setAtivo(0);
          }}
          onFocus={() => setAberto(true)}
          onBlur={() => setAberto(false)}
          onKeyDown={tecla}
          placeholder="Nome, CPF/CNPJ, placa ou telefone"
          autoComplete="off"
          spellCheck={false}
          className="w-full h-11 md:h-10 pl-9 pr-3 bg-cartao border border-linha-forte shadow-controle text-[14px] outline-none transition-[border-color,box-shadow] duration-150 hover:border-tinta-fraca focus:border-tinta-fraca focus:ring-[3px] focus:ring-amarelo/30 placeholder:text-tinta-fraca"
        />
      </div>
      {mostrar && (
        <div className="absolute z-30 left-0 right-0 mt-1.5 bg-cartao border border-linha rounded-cartao elevacao overflow-hidden">
          {carregando ? (
            <p className="px-4 py-3 text-[13px] text-tinta-suave">Carregando clientes…</p>
          ) : erro ? (
            <p className="px-4 py-3 text-[13px] text-alerta">Não consegui carregar os clientes. Preencha os dados abaixo.</p>
          ) : resultados.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-tinta-suave">
              Nenhum cliente encontrado. Preencha os dados abaixo: o cadastro é criado junto com o atendimento.
            </p>
          ) : (
            <ul id={lista} role="listbox" aria-label="Clientes encontrados" className="max-h-[320px] overflow-y-auto py-1">
              {resultados.map((r, i) => {
                const doc = documentoExibicao(r.cliente);
                const tel = r.cliente.telefone ?? r.cliente.whatsapp;
                return (
                  <li
                    key={r.cliente.id}
                    id={`${lista}-${i}`}
                    role="option"
                    aria-selected={i === ativo}
                    // mousedown antes do blur do campo: escolhe sem perder o clique
                    onMouseDown={(e) => {
                      e.preventDefault();
                      escolher(r);
                    }}
                    onMouseEnter={() => setAtivo(i)}
                    className={`flex items-center gap-3 px-3 py-2.5 mx-1 rounded-controle cursor-pointer ${i === ativo ? "bg-cinza-100" : ""}`}
                  >
                    <AvatarCliente nome={r.cliente.nome} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold truncate">{r.cliente.nome}</span>
                        {tipoDoCliente(r.cliente) === "pj" && <EtiquetaPJ />}
                      </span>
                      <span className="block text-[12px] text-tinta-suave truncate numero">
                        {[doc?.valor, tel && formatarTelefone(tel)].filter(Boolean).join(" · ") || "Sem documento nem telefone"}
                      </span>
                    </span>
                    {r.veiculos[0] && (
                      <span className="hidden sm:inline-flex items-center gap-1.5 shrink-0">
                        <Placa placa={r.veiculos[0].placa} />
                        {r.veiculos.length > 1 && <span className="text-[12px] text-tinta-suave numero">+{r.veiculos.length - 1}</span>}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

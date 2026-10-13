import { useState, type FormEvent } from "react";
import type { Id, Veiculo } from "@compartilhado/tipos";
import { normalizarPlaca, placaValida } from "@compartilhado/dominio/placa";
import { mensagemErro, useAcoes } from "../../dados/hooks";
import { ERRO } from "../../dominio/rotulos";
import { Botao } from "../ui/Basicos";
import { Placa } from "../ui/Placa";
import { Icone } from "../Icone";
import { CLASSE_CAMPO, Campo, SecaoForm } from "./Campos";
import { Gaveta } from "./Gaveta";
import { descrito } from "./formato";

type Erros = Partial<Record<"placa" | "ano", string>>;

const CAMPO_DO_ERRO: Record<string, keyof Erros> = { placa_invalida: "placa", placa_duplicada: "placa", ano_invalido: "ano" };

/** Adicionar ou editar um veículo do cliente (salvarVeiculo). Placa com prévia Mercosul. */
export function FormVeiculo({ clienteId, veiculo, onFechar }: { clienteId: Id; veiculo?: Veiculo; onFechar: () => void }) {
  const acoes = useAcoes();
  const [placa, setPlaca] = useState(veiculo?.placa ?? "");
  const [marca, setMarca] = useState(veiculo?.marca ?? "");
  const [modelo, setModelo] = useState(veiculo?.modelo ?? "");
  const [cor, setCor] = useState(veiculo?.cor ?? "");
  const [ano, setAno] = useState(veiculo?.ano ? String(veiculo.ano) : "");
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState("");
  const enviando = acoes.salvarVeiculo.isPending;
  const placaNorm = normalizarPlaca(placa);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErroGeral("");
    const e: Erros = {};
    if (!placaValida(placa)) e.placa = ERRO.placa_invalida;
    const anoNum = ano.trim() ? Number(ano) : undefined;
    if (anoNum !== undefined && !Number.isInteger(anoNum)) e.ano = ERRO.ano_invalido;
    setErros(e);
    if (e.placa || e.ano) {
      requestAnimationFrame(() => document.getElementById(e.placa ? "vei-placa" : "vei-ano")?.focus());
      return;
    }
    try {
      const r = await acoes.salvarVeiculo.mutateAsync([
        { ...(veiculo ?? {}), id: veiculo?.id, clienteId, placa: placaNorm, marca, modelo, cor, ano: anoNum },
      ]);
      if (r.ok) {
        onFechar();
        return;
      }
      const campo = r.codigo ? CAMPO_DO_ERRO[r.codigo] : undefined;
      if (campo) {
        setErros({ [campo]: mensagemErro(r.codigo) });
        requestAnimationFrame(() => document.getElementById(`vei-${campo}`)?.focus());
      } else setErroGeral(mensagemErro(r.codigo));
    } catch {
      setErroGeral(mensagemErro());
    }
  }

  return (
    <Gaveta
      titulo={veiculo ? "Editar veículo" : "Adicionar veículo"}
      descricao={veiculo ? undefined : "O veículo fica ligado a este cliente."}
      onFechar={onFechar}
      onEnviar={salvar}
      rodape={
        <>
          <Botao variante="contorno" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" variante="primario" disabled={enviando} className="min-w-[148px]">
            {enviando ? "Salvando…" : veiculo ? "Salvar alterações" : "Adicionar veículo"}
          </Botao>
        </>
      }
    >
      {erroGeral && (
        <p role="alert" className="mb-5 flex items-start gap-2 px-3 py-2.5 rounded-controle bg-alerta-claro text-alerta text-[13px] font-medium">
          <Icone nome="alerta" tamanho={16} className="mt-0.5 shrink-0" />
          {erroGeral}
        </p>
      )}
      <SecaoForm titulo="Veículo">
        <Campo id="vei-placa" rotulo="Placa" erro={erros.placa} dica="7 caracteres, Mercosul ou antiga.">
          <div className="flex items-center gap-4">
            <input
              id="vei-placa"
              value={placa}
              onChange={(e) => {
                setPlaca(e.target.value.toUpperCase());
                if (erros.placa) setErros((er) => ({ ...er, placa: undefined }));
              }}
              onBlur={() => placa && !placaValida(placa) && setErros((er) => ({ ...er, placa: ERRO.placa_invalida }))}
              maxLength={8}
              placeholder="ABC1D23"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-invalid={Boolean(erros.placa)}
              aria-describedby={descrito("vei-placa", erros.placa, true)}
              className={`${CLASSE_CAMPO} max-w-[160px] uppercase font-semibold tracking-[0.06em] numero`}
            />
            <span aria-hidden="true" className={`transition-opacity duration-150 ${placaValida(placa) ? "" : "opacity-30"}`}>
              <Placa placa={placaNorm || "ABC1D23"} tamanho="m" />
            </span>
          </div>
        </Campo>
        <div className="grid gap-4 grid-cols-2">
          <Campo id="vei-marca" rotulo="Marca" opcional>
            <input id="vei-marca" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ex.: Jeep" autoComplete="off" className={CLASSE_CAMPO} />
          </Campo>
          <Campo id="vei-modelo" rotulo="Modelo" opcional>
            <input id="vei-modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Ex.: Compass" autoComplete="off" className={CLASSE_CAMPO} />
          </Campo>
          <Campo id="vei-cor" rotulo="Cor" opcional>
            <input id="vei-cor" value={cor} onChange={(e) => setCor(e.target.value)} placeholder="Ex.: Branco" autoComplete="off" className={CLASSE_CAMPO} />
          </Campo>
          <Campo id="vei-ano" rotulo="Ano" opcional erro={erros.ano}>
            <input
              id="vei-ano"
              inputMode="numeric"
              value={ano}
              onChange={(e) => {
                setAno(e.target.value.replace(/\D/g, "").slice(0, 4));
                if (erros.ano) setErros((er) => ({ ...er, ano: undefined }));
              }}
              placeholder="Ex.: 2021"
              autoComplete="off"
              aria-invalid={Boolean(erros.ano)}
              aria-describedby={descrito("vei-ano", erros.ano)}
              className={`${CLASSE_CAMPO} numero`}
            />
          </Campo>
        </div>
      </SecaoForm>
    </Gaveta>
  );
}

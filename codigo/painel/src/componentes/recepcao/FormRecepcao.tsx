import { useId } from "react";
import { NIVEIS_COMBUSTIVEL, type NivelCombustivel, type RecepcaoVeiculo } from "@compartilhado/tipos";
import { NIVEL_COMBUSTIVEL } from "../../dominio/rotulos";
import { AreaTexto, CampoComAfixo, Grupo } from "../os/Campos";
import { descritoPor, milhar } from "../os/formato";

/** Campos de texto e número da recepção (o checklist e as avarias têm componentes próprios). */
export type DadosRecepcao = Pick<RecepcaoVeiculo, "km" | "combustivel" | "reclamacao" | "obsInternas">;

/** Quantos dos 4 tracinhos do medidor ficam cheios em cada nível (reserva = meio tracinho vermelho). */
const CHEIOS: Record<NivelCombustivel, number> = { reserva: 0, "1/4": 1, "1/2": 2, "3/4": 3, cheio: 4 };

/** Fração tipográfica para o seletor (o texto acessível vem de NIVEL_COMBUSTIVEL). */
const GLIFO: Record<NivelCombustivel, string> = { reserva: "Reserva", "1/4": "¼", "1/2": "½", "3/4": "¾", cheio: "Cheio" };

/** Mini medidor de combustível: 4 tracinhos; reserva acende meio tracinho em `alerta`. */
export function MedidorCombustivel({ nivel, className = "" }: { nivel?: NivelCombustivel; className?: string }) {
  const cheios = nivel ? CHEIOS[nivel] : 0;
  return (
    <span aria-hidden="true" className={`inline-flex items-center gap-[2px] ${className}`}>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="relative w-[7px] h-[10px] rounded-[2px] bg-cinza-200 overflow-hidden">
          {i < cheios && <span className="absolute inset-0 bg-tinta" />}
          {nivel === "reserva" && i === 0 && <span className="absolute inset-y-0 left-0 w-1/2 bg-alerta" />}
        </span>
      ))}
    </span>
  );
}

/** Texto do nível com o medidor ao lado (leitura). */
export function NivelCombustivelTexto({ nivel }: { nivel?: NivelCombustivel }) {
  if (!nivel) return <span className="text-tinta-fraca">Não informado</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <MedidorCombustivel nivel={nivel} />
      <span className={nivel === "reserva" ? "text-alerta font-medium" : ""}>{NIVEL_COMBUSTIVEL[nivel]}</span>
    </span>
  );
}

/**
 * Formulário de dados da entrada: km (com separador de milhar enquanto digita), combustível em seletor
 * segmentado com mini medidor, reclamação do cliente e observações internas (não saem na impressão).
 */
export function FormRecepcao({
  valor,
  onMudar,
  erroKm,
  compacto = false,
}: {
  valor: DadosRecepcao;
  onMudar: (v: DadosRecepcao) => void;
  erroKm?: string;
  /** Duas colunas para km + combustível (padrão) ou tudo empilhado. */
  compacto?: boolean;
}) {
  const id = useId();
  const idKm = `${id}-km`;
  const idRec = `${id}-rec`;
  const idObs = `${id}-obs`;
  const dicaObs = "Só a equipe vê. Não sai na impressão para o cliente.";

  return (
    <div className="flex flex-col gap-5">
      <div className={`grid gap-5 ${compacto ? "" : "md:grid-cols-[minmax(0,200px)_minmax(0,1fr)]"} items-start`}>
        <Grupo id={idKm} rotulo="Quilometragem" erro={erroKm} opcional>
          <CampoComAfixo
            id={idKm}
            sufixo="km"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            maxLength={9}
            value={valor.km === undefined ? "" : milhar(String(valor.km))}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "").slice(0, 7);
              onMudar({ ...valor, km: d ? Number(d) : undefined });
            }}
            aria-invalid={Boolean(erroKm)}
            aria-describedby={descritoPor(idKm, erroKm)}
          />
        </Grupo>
        <fieldset className="min-w-0">
          <legend className="mb-1.5 flex w-full items-baseline justify-between gap-2 text-[13px] font-medium text-tinta-suave">
            <span>Combustível</span>
          </legend>
          <div className="flex max-w-full gap-0.5 p-0.5 rounded-cartao bg-cinza-100">
            {NIVEIS_COMBUSTIVEL.map((n) => {
              const ativo = valor.combustivel === n;
              return (
                <label
                  key={n}
                  className={`flex-1 min-w-0 inline-flex flex-col items-center justify-center gap-1 h-14 md:h-12 px-1.5 rounded-controle cursor-pointer transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-amarelo-escuro has-[:focus-visible]:outline-offset-1 ${
                    ativo ? "bg-cartao text-tinta font-semibold shadow-[0_1px_2px_rgba(17,17,17,0.08)] ring-1 ring-linha" : "text-tinta-suave font-medium hover:text-tinta"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${id}-comb`}
                    value={n}
                    checked={ativo}
                    onChange={() => onMudar({ ...valor, combustivel: n })}
                    onClick={() => ativo && onMudar({ ...valor, combustivel: undefined })}
                    aria-label={NIVEL_COMBUSTIVEL[n]}
                    className="sr-only"
                  />
                  <MedidorCombustivel nivel={n} className={ativo ? "" : "opacity-70"} />
                  <span className={`${n.includes("/") ? "text-[15px] leading-none" : "text-[12px] leading-none"} truncate max-w-full`}>{GLIFO[n]}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

      <Grupo id={idRec} rotulo="Reclamação do cliente" opcional>
        <AreaTexto
          id={idRec}
          rows={3}
          maxLength={1000}
          placeholder="O que o cliente relatou. Ex.: amassado na porta traseira esquerda depois de uma batida no estacionamento."
          value={valor.reclamacao ?? ""}
          onChange={(e) => onMudar({ ...valor, reclamacao: e.target.value || undefined })}
        />
      </Grupo>

      <Grupo id={idObs} rotulo="Observações internas" dica={dicaObs} opcional>
        <AreaTexto
          id={idObs}
          rows={2}
          maxLength={1000}
          placeholder="Ex.: guardar na área coberta; cliente pediu retorno por WhatsApp."
          value={valor.obsInternas ?? ""}
          onChange={(e) => onMudar({ ...valor, obsInternas: e.target.value || undefined })}
          aria-describedby={descritoPor(idObs, undefined, dicaObs)}
        />
      </Grupo>
    </div>
  );
}

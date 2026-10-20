import { useState, type KeyboardEvent, type ReactNode } from "react";
import type { ConfigParcial } from "@compartilhado/dominio/config";
import { mensagemErro, useAcoes } from "../../dados/hooks";
import { ERRO_CAMPO_CONFIG } from "../../dominio/rotulos";
import { Botao } from "../ui/Basicos";
import { AcaoTexto, Aviso, MensagemErro } from "../ui/Campos";
import { Etiqueta } from "../ui/Estado";
import { Icone } from "../Icone";

// Números editáveis da configuração (capacidade e semáforo) em Ajustes: um campo com stepper (− / +) por
// linha, com a explicação de onde o número é usado; barra Salvar/Descartar só quando algo mudou.
// Salvar confirma o campo (sai o "provisório — a confirmar"); "Confirmar" confirma o valor atual sem mudar.

export interface CampoNumero<K extends string> {
  chave: K;
  nome: string;
  /** Onde o número é usado (uma ou duas frases curtas). */
  explicacao: ReactNode;
  /** Elemento ao lado do nome (ex.: o Semaforo). */
  adorno?: ReactNode;
  unidade: (n: number) => string;
  limites: { min: number; max: number };
  valor: number;
  provisorio: boolean;
}

const inteiro = (t: string): number => (/^\d+$/.test(t.trim()) ? Number(t.trim()) : NaN);

export function EditorNumeros<K extends string>({
  id,
  campos,
  podeEditar,
  montar,
  rotuloSalvar,
  mensagemOk,
  depois,
}: {
  id: string;
  campos: CampoNumero<K>[];
  podeEditar: boolean;
  /** Edição parcial para salvarConfig a partir dos valores (só os que mudaram ou o que se quer confirmar). */
  montar: (valores: Partial<Record<K, number>>) => ConfigParcial;
  rotuloSalvar: string;
  mensagemOk: string;
  /** Linha de leitura depois dos campos (antes da barra de salvar). */
  depois?: ReactNode;
}) {
  const acoes = useAcoes();
  const [rascunho, setRascunho] = useState<Partial<Record<K, string>>>({});
  const [errosCampo, setErrosCampo] = useState<Partial<Record<K, string>>>({});
  const [erro, setErro] = useState<string>();
  const [ok, setOk] = useState<string>();
  const salvando = acoes.salvarConfig.isPending;

  const texto = (c: CampoNumero<K>) => rascunho[c.chave] ?? String(c.valor);
  const mudou = (c: CampoNumero<K>) => rascunho[c.chave] !== undefined && inteiro(rascunho[c.chave]!) !== c.valor;
  const alterados = campos.filter(mudou);

  function mudar(chave: K, t: string) {
    setOk(undefined);
    setErro(undefined);
    setErrosCampo((e) => ({ ...e, [chave]: undefined }));
    setRascunho((r) => ({ ...r, [chave]: t }));
  }

  function descartar() {
    setRascunho({});
    setErrosCampo({});
    setErro(undefined);
  }

  async function enviar(valores: Partial<Record<K, number>>, aoSalvar: string) {
    setErro(undefined);
    setOk(undefined);
    try {
      const r = await acoes.salvarConfig.mutateAsync([montar(valores)]);
      if (!r.ok) {
        const campo = campos.find((c) => c.chave === r.campo);
        if (campo) setErrosCampo((e) => ({ ...e, [campo.chave]: ERRO_CAMPO_CONFIG[campo.chave] ?? mensagemErro(r.codigo) }));
        else setErro(ERRO_CAMPO_CONFIG[r.campo ?? ""] ?? mensagemErro(r.codigo));
        return;
      }
      setRascunho({});
      setErrosCampo({});
      setOk(aoSalvar);
    } catch {
      setErro(mensagemErro());
    }
  }

  function salvar() {
    const erros: Partial<Record<K, string>> = {};
    const valores: Partial<Record<K, number>> = {};
    for (const c of alterados) {
      const n = inteiro(texto(c));
      if (!Number.isInteger(n) || n < c.limites.min || n > c.limites.max) erros[c.chave] = ERRO_CAMPO_CONFIG[c.chave] ?? mensagemErro("valor_invalido");
      else valores[c.chave] = n;
    }
    setErrosCampo(erros);
    const primeiro = alterados.find((c) => erros[c.chave]);
    if (primeiro) {
      document.getElementById(`${id}-${primeiro.chave}`)?.focus();
      return;
    }
    void enviar(valores, mensagemOk);
  }

  return (
    <>
      <div>
        {campos.map((c) => (
          <LinhaNumero
            key={c.chave}
            id={`${id}-${c.chave}`}
            campo={c}
            texto={texto(c)}
            alterado={mudou(c)}
            erro={errosCampo[c.chave]}
            podeEditar={podeEditar}
            ocupado={salvando}
            onMudar={(t) => mudar(c.chave, t)}
            onConfirmar={() => enviar({ [c.chave]: c.valor } as Partial<Record<K, number>>, `${c.nome}: ${c.valor} ${c.unidade(c.valor)} confirmado.`)}
          />
        ))}
      </div>
      {depois}
      {podeEditar && (alterados.length > 0 || erro || ok) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-linha bg-cinza-50">
          <div className="text-[13px] min-w-0">
            {alterados.length > 0 && (
              <p className="font-medium">
                {alterados.length === 1 ? "1 número alterado, ainda não salvo" : `${alterados.length} números alterados, ainda não salvos`}
              </p>
            )}
            {erro ? <Aviso tom="alerta">{erro}</Aviso> : ok && alterados.length === 0 ? <Aviso tom="ok">{ok}</Aviso> : null}
          </div>
          {alterados.length > 0 && (
            <span className="flex items-center gap-2 max-md:w-full">
              <Botao variante="fantasma" tamanho="denso" onClick={descartar} disabled={salvando} className="max-md:flex-1">
                Descartar
              </Botao>
              <Botao variante="primario" tamanho="denso" onClick={salvar} disabled={salvando} className="max-md:flex-[2]">
                {salvando ? "Salvando…" : rotuloSalvar}
              </Botao>
            </span>
          )}
        </div>
      )}
    </>
  );
}

function LinhaNumero<K extends string>({
  id,
  campo,
  texto,
  alterado,
  erro,
  podeEditar,
  ocupado,
  onMudar,
  onConfirmar,
}: {
  id: string;
  campo: CampoNumero<K>;
  texto: string;
  alterado: boolean;
  erro?: string;
  podeEditar: boolean;
  ocupado: boolean;
  onMudar: (t: string) => void;
  onConfirmar: () => void;
}) {
  const n = inteiro(texto);
  const unidade = campo.unidade(Number.isFinite(n) ? n : campo.valor);
  const selo = alterado ? (
    <Etiqueta tom="neutro">Alterado</Etiqueta>
  ) : campo.provisorio ? (
    <span className="inline-flex items-center gap-1">
      <Etiqueta tom="atencao">Provisório — a confirmar</Etiqueta>
      {podeEditar && (
        <AcaoTexto onClick={onConfirmar} rotulo={`Confirmar ${campo.nome.toLowerCase()}: ${campo.valor} ${campo.unidade(campo.valor)}`} desabilitado={ocupado}>
          Confirmar
        </AcaoTexto>
      )}
    </span>
  ) : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-x-8 gap-y-3 px-5 py-4 border-b border-linha last:border-b-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {podeEditar ? (
            <label htmlFor={id} className="text-[14px] font-medium text-tinta">
              {campo.nome}
            </label>
          ) : (
            <span className="text-[14px] font-medium text-tinta">{campo.nome}</span>
          )}
          {campo.adorno}
        </div>
        <p id={`${id}-dica`} className="mt-1 text-[13px] text-tinta-suave max-w-[56ch] leading-snug">
          {campo.explicacao}
        </p>
      </div>
      <div className="flex flex-col items-start md:items-end gap-2">
        {podeEditar ? (
          <span className="flex items-center gap-2.5">
            <Passo
              id={id}
              rotulo={campo.nome}
              texto={texto}
              limites={campo.limites}
              invalido={Boolean(erro)}
              descricao={erro ? `${id}-erro` : `${id}-dica`}
              desabilitado={ocupado}
              onMudar={onMudar}
            />
            <span className="text-[13px] text-tinta-suave min-w-14">{unidade}</span>
          </span>
        ) : (
          <span className="text-[15px] font-semibold numero">
            {campo.valor} <span className="text-[13px] font-normal text-tinta-suave">{campo.unidade(campo.valor)}</span>
          </span>
        )}
        {selo}
        {erro && (
          <div className="md:text-right">
            <MensagemErro id={`${id}-erro`}>{erro}</MensagemErro>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Número inteiro com − e + (um controle só, como o SeletorPeriodo): 40 px (44 no celular), botões fantasmas
 * por dentro, valor tabular no meio. Setas ↑ ↓ somam 1, PageUp/PageDown 5, Home/End vão aos limites.
 */
function Passo({
  id,
  rotulo,
  texto,
  limites,
  invalido,
  descricao,
  desabilitado,
  onMudar,
}: {
  id: string;
  rotulo: string;
  texto: string;
  limites: { min: number; max: number };
  invalido: boolean;
  descricao: string;
  desabilitado: boolean;
  onMudar: (t: string) => void;
}) {
  const n = inteiro(texto);
  const base = Number.isFinite(n) ? n : limites.min;
  const ir = (v: number) => onMudar(String(Math.min(limites.max, Math.max(limites.min, v))));

  function teclas(e: KeyboardEvent<HTMLInputElement>) {
    const passos: Record<string, number> = { ArrowUp: 1, ArrowDown: -1, PageUp: 5, PageDown: -5 };
    if (e.key in passos) {
      e.preventDefault();
      ir(base + passos[e.key]);
    } else if (e.key === "Home") {
      e.preventDefault();
      ir(limites.min);
    } else if (e.key === "End") {
      e.preventDefault();
      ir(limites.max);
    }
  }

  const botao =
    "inline-grid place-items-center w-11 md:w-10 shrink-0 text-tinta-suave hover:text-tinta hover:bg-cinza-100 transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-amarelo-escuro focus-visible:-outline-offset-2";
  return (
    <span
      className={`inline-flex items-stretch h-11 md:h-10 rounded-controle overflow-hidden border bg-cartao shadow-controle transition-[border-color,box-shadow] duration-150 focus-within:ring-[3px] ${
        invalido ? "border-alerta focus-within:ring-alerta/15" : "border-linha-forte hover:border-tinta-fraca focus-within:border-tinta-fraca focus-within:ring-amarelo/30"
      }`}
    >
      <button type="button" aria-label={`Diminuir ${rotulo.toLowerCase()}`} disabled={desabilitado || base <= limites.min} onClick={() => ir(base - 1)} className={botao}>
        <SinalMenos />
      </button>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        role="spinbutton"
        aria-valuemin={limites.min}
        aria-valuemax={limites.max}
        aria-valuenow={Number.isFinite(n) ? n : undefined}
        aria-invalid={invalido}
        aria-describedby={descricao}
        autoComplete="off"
        maxLength={3}
        value={texto}
        disabled={desabilitado}
        onChange={(e) => onMudar(e.target.value.replace(/\D/g, ""))}
        onKeyDown={teclas}
        onFocus={(e) => e.target.select()}
        className="w-14 h-full px-1 border-x border-y-0 border-linha rounded-none bg-transparent text-center text-[15px] font-semibold numero text-tinta outline-none shadow-none"
      />
      <button type="button" aria-label={`Aumentar ${rotulo.toLowerCase()}`} disabled={desabilitado || base >= limites.max} onClick={() => ir(base + 1)} className={botao}>
        <Icone nome="mais" tamanho={16} traco={2} />
      </button>
    </span>
  );
}

/** Sinal de menos no traço do `Icone` (o conjunto ainda não tem "menos"; mesmo desenho do "mais" sem a vertical). */
function SinalMenos() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <path d="M5 12h14" />
    </svg>
  );
}

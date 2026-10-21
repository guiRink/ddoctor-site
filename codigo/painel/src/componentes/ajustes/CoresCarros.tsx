import { useState, type ReactNode } from "react";
import type { AlertaCarroConfig, ConfigOficina, CorCarro } from "@compartilhado/tipos";
import { LIMITES_ALERTA, alertaCarroBase, campoConfigProvisorio } from "@compartilhado/dominio/config";
import { mensagemErro, useAcoes, useConfig } from "../../dados/hooks";
import { ERRO_CAMPO_CONFIG } from "../../dominio/rotulos";
import { Botao } from "../ui/Basicos";
import { AcaoTexto, Aviso, MensagemErro } from "../ui/Campos";
import { Provisorio } from "../ui/Estado";
import { SeloCor } from "../os/PrazoCarro";
import { Consulta, Interruptor, NotaProvisoria, Secao } from "./Estrutura";
import { Passo } from "./Numeros";

// Ajustes → "Cores dos carros" (pedido do dono, 2º áudio: docs/revisao-sh/pedido-dono-2.md): a base da cor de
// cada carro no painel e na TV. Cada carro pode ter a sua (ficha → Ajustar prazo). Edita quem tem
// podeEditarConfig; salvar (ou "Confirmar") tira o "provisório — a confirmar" (campo alertaCarro).

type CampoNum = "laranjaDiasAntes" | "vermelhoSemEtapaDiasAntes" | "prazoPadraoDiasUteis";

const AMOSTRAS: { cor: CorCarro; nome: string; quando: (a: Required<AlertaCarroConfig>) => string }[] = [
  {
    cor: "vermelho_piscando",
    nome: "Atrasado",
    quando: (a) => (a.piscarAtrasado ? "Passou da entrega prometida. Pisca no painel e na TV." : "Passou da entrega prometida (piscar desligado: fica vermelho)."),
  },
  { cor: "vermelho", nome: "Vermelho", quando: (a) => `${janela(a.vermelhoSemEtapaDiasAntes)} e nenhuma etapa concluída.` },
  { cor: "laranja", nome: "Laranja", quando: (a) => `${janela(a.laranjaDiasAntes)}, com etapa concluída.` },
  { cor: "verde", nome: "Verde", quando: () => "Tem folga até a entrega." },
];

/** "Entrega hoje" (0), "Entrega hoje ou no próximo dia útil" (1), "Faltam 3 dias úteis ou menos". */
function janela(n: number): string {
  if (n === 0) return "Entrega hoje";
  if (n === 1) return "Entrega hoje ou no próximo dia útil";
  return `Faltam ${n} dias úteis ou menos`;
}

const inteiro = (t: string): number => (/^\d+$/.test(t.trim()) ? Number(t.trim()) : NaN);

export function CoresCarros({ podeEditar }: { podeEditar: boolean }) {
  const q = useConfig();
  const provisorio = q.data ? campoConfigProvisorio(q.data, "alertaCarro") : false;
  return (
    <Secao
      id="cores"
      titulo="Cores dos carros"
      descricao="A cor de cada carro no painel e na TV, pelos dias úteis que faltam para a entrega. Cada carro pode ter a sua, na ficha."
      nota={provisorio ? <NotaProvisoria texto="a confirmar com o dono" /> : undefined}
    >
      <Consulta q={q}>{(c: ConfigOficina) => <Editor config={c} podeEditar={podeEditar} provisorio={provisorio} />}</Consulta>
    </Secao>
  );
}

function Editor({ config, podeEditar, provisorio }: { config: ConfigOficina; podeEditar: boolean; provisorio: boolean }) {
  const acoes = useAcoes();
  const base = alertaCarroBase(config);
  const [texto, setTexto] = useState<Record<CampoNum, string>>({
    laranjaDiasAntes: String(base.laranjaDiasAntes),
    vermelhoSemEtapaDiasAntes: String(base.vermelhoSemEtapaDiasAntes),
    prazoPadraoDiasUteis: String(base.prazoPadraoDiasUteis),
  });
  const [piscar, setPiscar] = useState(base.piscarAtrasado);
  const [erros, setErros] = useState<Partial<Record<CampoNum, string>>>({});
  const [erro, setErro] = useState<string>();
  const [ok, setOk] = useState<string>();
  const salvando = acoes.salvarConfig.isPending;

  const campos: CampoNum[] = ["laranjaDiasAntes", "vermelhoSemEtapaDiasAntes", "prazoPadraoDiasUteis"];
  const alterados = campos.filter((k) => inteiro(texto[k]) !== base[k]);
  const piscarMudou = piscar !== base.piscarAtrasado;
  const nAlterados = alterados.length + (piscarMudou ? 1 : 0);

  // amostras com os valores da tela (o que vai valer ao salvar)
  const vigente: Required<AlertaCarroConfig> = {
    laranjaDiasAntes: Number.isFinite(inteiro(texto.laranjaDiasAntes)) ? inteiro(texto.laranjaDiasAntes) : base.laranjaDiasAntes,
    vermelhoSemEtapaDiasAntes: Number.isFinite(inteiro(texto.vermelhoSemEtapaDiasAntes)) ? inteiro(texto.vermelhoSemEtapaDiasAntes) : base.vermelhoSemEtapaDiasAntes,
    prazoPadraoDiasUteis: base.prazoPadraoDiasUteis,
    piscarAtrasado: piscar,
  };

  function mudar(k: CampoNum, t: string) {
    setOk(undefined);
    setErro(undefined);
    setErros((e) => ({ ...e, [k]: undefined }));
    setTexto((x) => ({ ...x, [k]: t }));
  }

  function descartar() {
    setTexto({
      laranjaDiasAntes: String(base.laranjaDiasAntes),
      vermelhoSemEtapaDiasAntes: String(base.vermelhoSemEtapaDiasAntes),
      prazoPadraoDiasUteis: String(base.prazoPadraoDiasUteis),
    });
    setPiscar(base.piscarAtrasado);
    setErros({});
    setErro(undefined);
  }

  async function enviar(parcial: Partial<AlertaCarroConfig>, mensagem: string) {
    setErro(undefined);
    setOk(undefined);
    try {
      const r = await acoes.salvarConfig.mutateAsync([{ alertaCarro: parcial }]);
      if (!r.ok) {
        const k = campos.find((c) => c === r.campo);
        if (k) setErros({ [k]: ERRO_CAMPO_CONFIG[k] ?? mensagemErro(r.codigo) });
        else setErro(ERRO_CAMPO_CONFIG[r.campo ?? ""] ?? mensagemErro(r.codigo));
        return;
      }
      setOk(mensagem);
    } catch {
      setErro(mensagemErro());
    }
  }

  function salvar() {
    const novosErros: Partial<Record<CampoNum, string>> = {};
    const parcial: Partial<AlertaCarroConfig> = {};
    for (const k of alterados) {
      const n = inteiro(texto[k]);
      const lim = LIMITES_ALERTA[k];
      if (!Number.isInteger(n) || n < lim.min || n > lim.max) novosErros[k] = ERRO_CAMPO_CONFIG[k] ?? mensagemErro("valor_invalido");
      else parcial[k] = n;
    }
    if (piscarMudou) parcial.piscarAtrasado = piscar;
    setErros(novosErros);
    const primeiro = alterados.find((k) => novosErros[k]);
    if (primeiro) {
      document.getElementById(`ajustes-cor-${primeiro}`)?.focus();
      return;
    }
    void enviar(parcial, "Cores salvas. O painel e a TV já pintam os carros com os novos valores.");
  }

  return (
    <>
      {/* as 4 cores, com amostra e quando cada uma vale */}
      <ul className="grid gap-x-6 gap-y-2.5 md:grid-cols-2 px-5 py-4 border-b border-linha">
        {AMOSTRAS.map((s) => (
          <li key={s.cor} className="grid grid-cols-[112px_minmax(0,1fr)] items-start gap-3">
            <span>
              <SeloCor cor={s.cor} tamanho="p">
                {s.nome}
              </SeloCor>
            </span>
            <span className="text-[13px] text-tinta-suave leading-snug pt-0.5">{s.quando(vigente)}</span>
          </li>
        ))}
      </ul>

      <Linha
        id="ajustes-cor-laranjaDiasAntes"
        nome="Laranja a partir de"
        explicacao="Dias úteis antes da entrega, com etapa concluída. 1 = hoje e o próximo dia útil; 0 = só no dia."
        unidade="antes da entrega"
        campo="laranjaDiasAntes"
        texto={texto.laranjaDiasAntes}
        erro={erros.laranjaDiasAntes}
        podeEditar={podeEditar}
        ocupado={salvando}
        valor={base.laranjaDiasAntes}
        onMudar={(t) => mudar("laranjaDiasAntes", t)}
      />
      <Linha
        id="ajustes-cor-vermelhoSemEtapaDiasAntes"
        nome="Vermelho (sem etapa concluída) a partir de"
        explicacao="Dias úteis antes da entrega em que o carro sem nenhuma etapa concluída fica vermelho."
        unidade="antes da entrega"
        campo="vermelhoSemEtapaDiasAntes"
        texto={texto.vermelhoSemEtapaDiasAntes}
        erro={erros.vermelhoSemEtapaDiasAntes}
        podeEditar={podeEditar}
        ocupado={salvando}
        valor={base.vermelhoSemEtapaDiasAntes}
        onMudar={(t) => mudar("vermelhoSemEtapaDiasAntes", t)}
      />
      <Linha
        id="ajustes-cor-prazoPadraoDiasUteis"
        nome="Prazo padrão para um carro"
        explicacao="Sugestão ao receber o carro e ao ajustar o prazo; a entrega prometida conta a partir da entrada."
        campo="prazoPadraoDiasUteis"
        texto={texto.prazoPadraoDiasUteis}
        erro={erros.prazoPadraoDiasUteis}
        podeEditar={podeEditar}
        ocupado={salvando}
        valor={base.prazoPadraoDiasUteis}
        onMudar={(t) => mudar("prazoPadraoDiasUteis", t)}
      />
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-8 gap-y-2 px-5 py-4 border-b border-linha">
        <div className="min-w-0">
          <p className="text-[14px] font-medium">Piscar o vermelho quando atrasado</p>
          <p className="mt-1 text-[13px] text-tinta-suave max-w-[56ch] leading-snug">Para dar um gás quando tem muita gente atrasada. Desligado, o atrasado fica vermelho fixo.</p>
        </div>
        {podeEditar ? (
          <Interruptor
            ligado={piscar}
            onMudar={(b) => {
              setOk(undefined);
              setPiscar(b);
            }}
            rotulo="Piscar o vermelho quando atrasado"
            desabilitado={salvando}
          />
        ) : (
          <span className="text-[15px] font-semibold">{base.piscarAtrasado ? "Ligado" : "Desligado"}</span>
        )}
      </div>

      {podeEditar && (nAlterados > 0 || provisorio || erro || ok) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-cinza-50">
          <div className="text-[13px] min-w-0">
            {nAlterados > 0 ? (
              <p className="font-medium">{nAlterados === 1 ? "1 valor alterado, ainda não salvo" : `${nAlterados} valores alterados, ainda não salvos`}</p>
            ) : provisorio && !ok ? (
              <p className="text-tinta-suave">
                <Provisorio>Valores provisórios — a confirmar</Provisorio>. Se estiverem certos, confirme.
              </p>
            ) : null}
            {erro ? <Aviso tom="alerta">{erro}</Aviso> : ok && nAlterados === 0 ? <Aviso tom="ok">{ok}</Aviso> : null}
          </div>
          {nAlterados > 0 ? (
            <span className="flex items-center gap-2 max-md:w-full">
              <Botao variante="fantasma" tamanho="denso" onClick={descartar} disabled={salvando} className="max-md:flex-1">
                Descartar
              </Botao>
              <Botao variante="primario" tamanho="denso" onClick={salvar} disabled={salvando} className="max-md:flex-[2]">
                {salvando ? "Salvando…" : "Salvar cores"}
              </Botao>
            </span>
          ) : provisorio ? (
            <Botao
              variante="contorno"
              tamanho="denso"
              icone="ok"
              onClick={() => enviar({ ...base }, "Cores dos carros confirmadas.")}
              disabled={salvando}
              className="max-md:w-full"
            >
              {salvando ? "Salvando…" : "Confirmar estes valores"}
            </Botao>
          ) : null}
        </div>
      )}
    </>
  );
}

function Linha({
  id,
  nome,
  explicacao,
  unidade,
  campo,
  texto,
  erro,
  podeEditar,
  ocupado,
  valor,
  onMudar,
}: {
  id: string;
  nome: string;
  explicacao: ReactNode;
  unidade?: string;
  campo: CampoNum;
  texto: string;
  erro?: string;
  podeEditar: boolean;
  ocupado: boolean;
  valor: number;
  onMudar: (t: string) => void;
}) {
  const n = inteiro(texto);
  const mostra = Number.isFinite(n) ? n : valor;
  const un = `${mostra === 1 ? "dia útil" : "dias úteis"}${unidade ? ` ${unidade}` : ""}`;
  const alterado = Number.isFinite(n) ? n !== valor : texto !== String(valor);
  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-x-8 gap-y-3 px-5 py-4 border-b border-linha">
      <div className="min-w-0">
        {podeEditar ? (
          <label htmlFor={id} className="text-[14px] font-medium text-tinta">
            {nome}
          </label>
        ) : (
          <span className="text-[14px] font-medium text-tinta">{nome}</span>
        )}
        <p id={`${id}-dica`} className="mt-1 text-[13px] text-tinta-suave max-w-[56ch] leading-snug">
          {explicacao}
        </p>
      </div>
      <div className="flex flex-col items-start md:items-end gap-2">
        {podeEditar ? (
          <span className="flex items-center gap-2.5">
            <Passo
              id={id}
              rotulo={nome}
              texto={texto}
              limites={LIMITES_ALERTA[campo]}
              passo={1}
              invalido={Boolean(erro)}
              descricao={erro ? `${id}-erro` : `${id}-dica`}
              desabilitado={ocupado}
              onMudar={onMudar}
            />
            <span className="text-[13px] text-tinta-suave w-36 leading-tight">{un}</span>
          </span>
        ) : (
          <span className="text-[15px] font-semibold numero">
            {valor} <span className="text-[13px] font-normal text-tinta-suave">{un}</span>
          </span>
        )}
        {alterado && podeEditar && (
          <AcaoTexto onClick={() => onMudar(String(valor))} rotulo={`Voltar ${nome.toLowerCase()} para ${valor}`} desabilitado={ocupado}>
            Voltar para {valor}
          </AcaoTexto>
        )}
        {erro && (
          <div className="md:text-right">
            <MensagemErro id={`${id}-erro`}>{erro}</MensagemErro>
          </div>
        )}
      </div>
    </div>
  );
}

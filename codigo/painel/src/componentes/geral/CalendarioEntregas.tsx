import { useState } from "react";
import type { DataISO } from "@compartilhado/tipos";
import { diaSemana, diasDoMes } from "@compartilhado/dominio/fuso";
import type { OSVisao } from "../../dados/repositorio";
import { Botao, Cartao } from "../ui/Basicos";
import { LinhaCarro } from "../ui/Carro";
import { Etiqueta } from "../ui/Estado";
import { diaExtenso } from "../orcamentos/formato";
import { nomeMesAno, nomeMesCurto, somarMeses } from "../relatorios/formato";
import { entregasDoMes, type EntregaPrevista } from "./selecoes";

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Calendário de entregas do mês: carros e peças com entrega prevista por dia (OS em aberto).
 * Hoje em amarelo-claro; domingos apagados; dia já passado com carro em aberto fica em `alerta`.
 * Clicar no dia abre, logo abaixo da grade, a lista dos carros com a placa.
 */
export function CalendarioEntregas({ oss, hoje }: { oss: OSVisao[]; hoje: DataISO }) {
  const mesHoje = hoje.slice(0, 7);
  const [mes, setMes] = useState(mesHoje);
  const [selecionado, setSelecionado] = useState<DataISO | null>(hoje);
  const entregas = entregasDoMes(oss, mes);
  const dias = diasDoMes(mes);
  const vazios = diaSemana(dias[0]);
  const todas = [...entregas.values()].flat();
  const totalPecas = todas.reduce((s, e) => s + e.pecas, 0);
  const lista = selecionado && selecionado.startsWith(mes) ? (entregas.get(selecionado) ?? []) : null;

  function irPara(delta: number) {
    const novo = somarMeses(mes, delta);
    setMes(novo);
    setSelecionado(novo === mesHoje ? hoje : null);
  }

  return (
    <Cartao
      titulo={`Entregas de ${nomeMesCurto(mes).toLowerCase()}`}
      contagem={todas.length}
      acao={
        <span className="flex items-center gap-1">
          <Botao variante="fantasma" tamanho="denso" icone="voltar" aria-label="Mês anterior" onClick={() => irPara(-1)} />
          {mes !== mesHoje && (
            <Botao variante="fantasma" tamanho="denso" onClick={() => {
                setMes(mesHoje);
                setSelecionado(hoje);
              }}
            >
              Hoje
            </Botao>
          )}
          <Botao variante="fantasma" tamanho="denso" icone="seta" aria-label="Próximo mês" onClick={() => irPara(1)} />
        </span>
      }
    >
      <p className="px-4 pt-3 text-[13px] text-tinta-suave numero">
        {todas.length === 0
          ? `Nenhuma entrega prevista em ${nomeMesAno(mes)}.`
          : `${plural(todas.length, "carro", "carros")} · ${plural(totalPecas, "peça", "peças")} com entrega prevista`}
      </p>
      <div className="px-3 pt-2 pb-3">
        <div role="group" aria-label={`Entregas previstas em ${nomeMesAno(mes)}`} className="grid grid-cols-7 gap-1">
          {SEMANA.map((s, i) => (
            <span key={s} aria-hidden="true" className={`h-6 grid place-items-center text-[11px] font-medium ${i === 0 ? "text-tinta-fraca/60" : "text-tinta-fraca"}`}>
              {s}
            </span>
          ))}
          {Array.from({ length: vazios }, (_, i) => (
            <span key={`v${i}`} aria-hidden="true" />
          ))}
          {dias.map((d) => (
            <Dia key={d} data={d} itens={entregas.get(d) ?? []} hoje={hoje} selecionado={d === selecionado} onEscolher={() => setSelecionado(d === selecionado ? null : d)} />
          ))}
        </div>
      </div>
      {lista !== null && selecionado && <ListaDoDia data={selecionado} itens={lista} hoje={hoje} />}
    </Cartao>
  );
}

function Dia({ data, itens, hoje, selecionado, onEscolher }: { data: DataISO; itens: EntregaPrevista[]; hoje: DataISO; selecionado: boolean; onEscolher: () => void }) {
  const domingo = diaSemana(data) === 0;
  const ehHoje = data === hoje;
  const passado = data < hoje;
  const pecas = itens.reduce((s, e) => s + e.pecas, 0);
  const atrasado = passado && itens.length > 0;
  const numero = Number(data.slice(8));
  const base = `relative flex flex-col items-start justify-between h-14 md:h-[58px] px-1.5 py-1 rounded-controle text-left transition-colors duration-150`;
  const fundo = ehHoje ? "bg-amarelo-claro" : itens.length ? "bg-cinza-50" : "";
  const borda = selecionado ? "ring-[1.5px] ring-tinta" : ehHoje ? "ring-1 ring-amarelo" : "";
  const corNumero = ehHoje ? "text-amarelo-tinta font-semibold" : domingo || (passado && !itens.length) ? "text-tinta-fraca/60" : "text-tinta-suave";
  const conteudo = (
    <>
      <span className={`text-[12px] numero leading-none ${corNumero}`}>{numero}</span>
      {itens.length > 0 && (
        <span className="flex flex-col leading-none">
          <span className={`text-[15px] font-semibold numero ${atrasado ? "text-alerta" : "text-tinta"}`}>{itens.length}</span>
          <span className={`mt-0.5 text-[10px] numero ${atrasado ? "text-alerta" : "text-tinta-suave"}`}>{pecas} pç</span>
        </span>
      )}
    </>
  );
  const rotulo = `${diaExtenso(data)}${ehHoje ? " (hoje)" : ""}: ${itens.length ? `${plural(itens.length, "carro", "carros")}, ${plural(pecas, "peça", "peças")}${atrasado ? ", atrasado" : ""}` : "sem entrega"}`;
  return (
    <button
        type="button"
        aria-label={rotulo}
        aria-pressed={selecionado}
        onClick={onEscolher}
        className={`${base} w-full min-w-0 ${fundo} ${borda} hover:bg-cinza-100 ${ehHoje ? "hover:bg-amarelo-claro" : ""}`}
      >
        {conteudo}
      </button>
  );
}

function ListaDoDia({ data, itens, hoje }: { data: DataISO; itens: EntregaPrevista[]; hoje: DataISO }) {
  const pecas = itens.reduce((s, e) => s + e.pecas, 0);
  const atrasado = data < hoje && itens.length > 0;
  return (
    <div className="border-t border-linha" aria-live="polite">
      <p className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 bg-cinza-50 border-b border-linha text-[13px]">
        <span className="font-semibold">
          {diaExtenso(data)}
          {data === hoje && <span className="font-normal text-tinta-suave"> · hoje</span>}
        </span>
        <span className={`numero ${atrasado ? "text-alerta font-medium" : "text-tinta-suave"}`}>
          {itens.length ? `${plural(itens.length, "carro", "carros")} · ${plural(pecas, "peça", "peças")}${atrasado ? " · atrasado" : ""}` : "sem entrega prevista"}
        </span>
      </p>
      {itens.length === 0 ? (
        <p className="px-4 py-3 text-[13px] text-tinta-suave">Nenhum carro com entrega prevista neste dia.</p>
      ) : (
        itens.map((e) => (
          <LinhaCarro
            key={e.v.os.id}
            v={e.v}
            para={`/orcamentos/${e.v.os.id}`}
            detalhe={`${e.v.cliente.nome} · ${plural(e.pecas, "peça", "peças")}`}
            direita={e.v.os.estado === "pronta" ? <Etiqueta tom="ok">Pronto</Etiqueta> : atrasado ? <Etiqueta tom="alerta">Atrasado</Etiqueta> : undefined}
          />
        ))
      )}
    </div>
  );
}

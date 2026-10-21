import { useState, type ReactNode, type ThHTMLAttributes } from "react";
import { ORIGENS_OS } from "@compartilhado/tipos";
import { ORIGEM_OS } from "../../dominio/rotulos";
import { Icone } from "../Icone";
import { Botao } from "../ui/Basicos";
import { FiltroSelecao, Grupo, OpcoesEmGrade, Selecao } from "../ui/Campos";
import { Gaveta } from "../ui/Gaveta";
import { CLASSE_TH } from "../ui/Tabela";
import {
  ABAS_ESTADO,
  alternarOrdem,
  direcaoDaColuna,
  FAIXAS_TEMPO,
  FAIXAS_VALOR,
  FILTROS_VAZIOS,
  NOME_COM_SEGURADORA,
  nomeDoEstado,
  ORDEM_PADRAO,
  ORIGEM_COM_SEGURADORA,
  ORDENS,
  TEXTO_ORDEM,
  type ColunaOrdenavel,
  type FiltrosLista,
  type OrdemLista,
} from "./lista";

/**
 * Peças de filtro da lista de Orçamentos (sprint SG). Só apresentação: a lógica está em `lista.ts`
 * e o estado mora na URL (a tela passa `filtros` e `onMudar`).
 */

type Mudar = (f: FiltrosLista) => void;

// ------------------------------------------------------------------ opções

function OpcoesOrigem() {
  return (
    <>
      <option value="">Todas</option>
      {ORIGENS_OS.map((o) => (
        <option key={o} value={o}>
          {ORIGEM_OS[o]}
        </option>
      ))}
      <option value={ORIGEM_COM_SEGURADORA}>{NOME_COM_SEGURADORA}</option>
    </>
  );
}

/** Seguradoras da lista; a do link entra mesmo se não houver carro dela agora. */
function OpcoesSeguradora({ seguradoras, atual }: { seguradoras: string[]; atual?: string }) {
  const lista = atual && !seguradoras.includes(atual) ? [...seguradoras, atual] : seguradoras;
  return (
    <>
      <option value="">Todas</option>
      {lista.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </>
  );
}

const comOrigem = (f: FiltrosLista, v: string): FiltrosLista => ({ ...f, origem: (v || undefined) as FiltrosLista["origem"] });
const comSeguradora = (f: FiltrosLista, v: string): FiltrosLista => ({ ...f, seguradora: v || undefined });

// ------------------------------------------------------------------ barra (desktop)

/** Selects da barra de ferramentas (desktop): Seguradora · Origem · Valor · Há quanto tempo. */
export function SelectsFiltro({
  filtros,
  onMudar,
  seguradoras,
  mostraValor,
}: {
  filtros: FiltrosLista;
  onMudar: Mudar;
  seguradoras: string[];
  mostraValor: boolean;
}) {
  return (
    <>
      <FiltroSelecao rotulo="Seguradora" valor={filtros.seguradora ?? ""} onMudar={(v) => onMudar(comSeguradora(filtros, v))}>
        <OpcoesSeguradora seguradoras={seguradoras} atual={filtros.seguradora} />
      </FiltroSelecao>
      <FiltroSelecao rotulo="Origem" valor={filtros.origem ?? ""} onMudar={(v) => onMudar(comOrigem(filtros, v))}>
        <OpcoesOrigem />
      </FiltroSelecao>
      {mostraValor && (
        <FiltroSelecao rotulo="Valor" valor={filtros.valor ?? ""} onMudar={(v) => onMudar({ ...filtros, valor: (v || undefined) as FiltrosLista["valor"] })}>
          <option value="">Qualquer</option>
          {FAIXAS_VALOR.map((f) => (
            <option key={f.valor} value={f.valor}>
              {f.texto}
            </option>
          ))}
        </FiltroSelecao>
      )}
      <FiltroSelecao rotulo="Há quanto tempo" valor={filtros.tempo ?? ""} onMudar={(v) => onMudar({ ...filtros, tempo: (v || undefined) as FiltrosLista["tempo"] })}>
        <option value="">Qualquer</option>
        {FAIXAS_TEMPO.map((f) => (
          <option key={f.valor} value={f.valor}>
            {f.texto}
          </option>
        ))}
      </FiltroSelecao>
    </>
  );
}

// ------------------------------------------------------------------ pílulas

function Pilula({ rotulo, valor, onTirar, nomeTirar }: { rotulo: string; valor: ReactNode; onTirar: () => void; nomeTirar: string }) {
  return (
    <li className="inline-flex items-center gap-1 h-8 max-w-full pl-3 pr-0.5 bg-cartao border border-linha-forte rounded-controle shadow-controle text-[13px]">
      <span className="text-tinta-suave whitespace-nowrap">{rotulo}:</span>
      <strong className="font-semibold truncate min-w-0">{valor}</strong>
      <button
        type="button"
        onClick={onTirar}
        aria-label={nomeTirar}
        title={nomeTirar}
        className="shrink-0 inline-grid place-items-center w-7 h-7 rounded-[4px] text-tinta-suave hover:text-tinta hover:bg-cinza-100"
      >
        <Icone nome="fechar" tamanho={14} traco={2} />
      </button>
    </li>
  );
}

/** Filtros ligados em pílulas removíveis + "Limpar filtros". Nada aparece sem filtro. */
export function PilulasFiltro({ filtros, onMudar, mostraValor }: { filtros: FiltrosLista; onMudar: Mudar; mostraValor: boolean }) {
  const f = filtros;
  const itens: { chave: string; rotulo: string; valor: ReactNode; tirar: Partial<FiltrosLista> }[] = [];
  if (f.q.trim()) itens.push({ chave: "q", rotulo: "Busca", valor: `“${f.q.trim()}”`, tirar: { q: "" } });
  if (f.estado !== "todos") itens.push({ chave: "estado", rotulo: "Situação", valor: nomeDoEstado(f.estado), tirar: { estado: "todos" } });
  if (f.valor && mostraValor) itens.push({ chave: "valor", rotulo: "Valor", valor: FAIXAS_VALOR.find((x) => x.valor === f.valor)?.texto, tirar: { valor: undefined } });
  if (f.tempo) itens.push({ chave: "tempo", rotulo: "Há quanto tempo", valor: FAIXAS_TEMPO.find((x) => x.valor === f.tempo)?.texto, tirar: { tempo: undefined } });
  if (f.origem) itens.push({ chave: "origem", rotulo: "Origem", valor: f.origem === ORIGEM_COM_SEGURADORA ? NOME_COM_SEGURADORA : ORIGEM_OS[f.origem], tirar: { origem: undefined } });
  if (f.seguradora) itens.push({ chave: "seguradora", rotulo: "Seguradora", valor: f.seguradora, tirar: { seguradora: undefined } });
  if (f.ordem !== ORDEM_PADRAO && (mostraValor || !f.ordem.startsWith("valor")))
    itens.push({ chave: "ordem", rotulo: "Ordem", valor: TEXTO_ORDEM[f.ordem], tirar: { ordem: ORDEM_PADRAO } });
  if (itens.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ul aria-label="Filtros ligados" className="flex flex-wrap items-center gap-2 list-none m-0 p-0 min-w-0">
        {itens.map((i) => (
          <Pilula
            key={i.chave}
            rotulo={i.rotulo}
            valor={i.valor}
            nomeTirar={`Tirar o filtro ${i.rotulo.toLowerCase()}`}
            onTirar={() => onMudar({ ...f, ...i.tirar })}
          />
        ))}
      </ul>
      <Botao variante="fantasma" tamanho="denso" onClick={() => onMudar(FILTROS_VAZIOS)}>
        Limpar filtros
      </Botao>
    </div>
  );
}

// ------------------------------------------------------------------ cabeçalho ordenável

/** `<th>` com botão que ordena; seta para baixo = maior valor / mais parado primeiro. `aria-sort` na coluna ativa. */
export function ThOrdenavel({
  coluna,
  ordem,
  onOrdenar,
  direita = false,
  titulo,
  children,
  className = "",
  ...resto
}: ThHTMLAttributes<HTMLTableCellElement> & {
  coluna: ColunaOrdenavel;
  ordem: OrdemLista;
  onOrdenar: (o: OrdemLista) => void;
  direita?: boolean;
  titulo: string;
  children: ReactNode;
}) {
  const direcao = direcaoDaColuna(ordem, coluna);
  const proxima = alternarOrdem(ordem, coluna);
  return (
    <th scope="col" aria-sort={direcao ?? "none"} className={`${CLASSE_TH} ${direita ? "text-right" : "text-left"} ${className}`} {...resto}>
      <button
        type="button"
        onClick={() => onOrdenar(proxima)}
        title={`${titulo}: ${TEXTO_ORDEM[proxima].toLowerCase()}`}
        className={`group inline-flex items-center gap-1 h-8 -mx-1.5 px-1.5 rounded-[4px] hover:text-tinta hover:bg-cinza-100 transition-colors duration-150 ${
          direcao ? "text-tinta font-semibold" : ""
        } ${direita ? "flex-row-reverse" : ""}`}
      >
        {children}
        <Icone
          nome="baixo"
          tamanho={14}
          traco={2}
          className={`shrink-0 transition-transform duration-150 ${direcao === "ascending" ? "rotate-180" : ""} ${
            direcao ? "opacity-100" : "opacity-35 group-hover:opacity-70"
          }`}
        />
        <span className="sr-only">, {direcao ? TEXTO_ORDEM[ordem].toLowerCase() : "clique para ordenar"}</span>
      </button>
    </th>
  );
}

// ------------------------------------------------------------------ celular: botão + gaveta

/** Botão "Filtros" do celular, com o número de filtros ligados. */
export function BotaoFiltros({ quantos, onAbrir }: { quantos: number; onAbrir: () => void }) {
  return (
    <Botao onClick={onAbrir} icone="filtro" aria-label={quantos > 0 ? `Filtros, ${quantos} ligado${quantos > 1 ? "s" : ""}` : "Filtros"} className="shrink-0">
      Filtros
      {quantos > 0 && (
        <span aria-hidden="true" className="inline-grid place-items-center min-w-5 h-5 px-1.5 rounded-full bg-tinta text-cartao text-[12px] font-semibold numero">
          {quantos}
        </span>
      )}
    </Botao>
  );
}

/**
 * Gaveta de filtros do celular: monta um rascunho e só aplica em "Mostrar N carros" (a contagem acompanha).
 * Monte só quando aberta.
 */
export function GavetaFiltros({
  filtros,
  seguradoras,
  mostraValor,
  contar,
  onAplicar,
  onFechar,
}: {
  filtros: FiltrosLista;
  seguradoras: string[];
  mostraValor: boolean;
  /** Quantos carros sobram com o rascunho. */
  contar: (f: FiltrosLista) => number;
  onAplicar: Mudar;
  onFechar: () => void;
}) {
  const [rascunho, setRascunho] = useState(filtros);
  const n = contar(rascunho);
  const ordens = ORDENS.filter((o) => mostraValor || !o.startsWith("valor"));
  const estadoConhecido = ABAS_ESTADO.some((a) => a.chave === rascunho.estado);

  return (
    <Gaveta
      titulo="Filtros"
      descricao="A busca continua valendo."
      onFechar={onFechar}
      onEnviar={() => {
        onAplicar(rascunho);
        onFechar();
      }}
      rodape={
        <div className="flex items-center gap-2">
          <Botao variante="fantasma" onClick={() => setRascunho({ ...FILTROS_VAZIOS, q: rascunho.q })} className="flex-1">
            Limpar
          </Botao>
          <Botao type="submit" variante="primario" className="flex-[2]">
            {n === 1 ? "Mostrar 1 carro" : `Mostrar ${n} carros`}
          </Botao>
        </div>
      }
    >
      <Grupo id="filtro-estado" rotulo="Situação">
        <Selecao id="filtro-estado" value={rascunho.estado} onChange={(e) => setRascunho({ ...rascunho, estado: e.target.value })}>
          {!estadoConhecido && <option value={rascunho.estado}>{nomeDoEstado(rascunho.estado)}</option>}
          {ABAS_ESTADO.map((a) => (
            <option key={a.chave} value={a.chave}>
              {a.nome}
            </option>
          ))}
        </Selecao>
      </Grupo>
      <Grupo id="filtro-seguradora" rotulo="Seguradora">
        <Selecao id="filtro-seguradora" value={rascunho.seguradora ?? ""} onChange={(e) => setRascunho(comSeguradora(rascunho, e.target.value))}>
          <OpcoesSeguradora seguradoras={seguradoras} atual={rascunho.seguradora} />
        </Selecao>
      </Grupo>
      <Grupo id="filtro-origem" rotulo="Origem">
        <Selecao id="filtro-origem" value={rascunho.origem ?? ""} onChange={(e) => setRascunho(comOrigem(rascunho, e.target.value))}>
          <OpcoesOrigem />
        </Selecao>
      </Grupo>
      {mostraValor && (
        <OpcoesEmGrade
          nome="filtro-valor"
          legenda="Valor"
          valor={rascunho.valor ?? ""}
          onMudar={(v) => setRascunho({ ...rascunho, valor: (v || undefined) as FiltrosLista["valor"] })}
          opcoes={[{ valor: "", texto: "Qualquer" }, ...FAIXAS_VALOR.map((f) => ({ valor: f.valor, texto: f.texto }))]}
        />
      )}
      <OpcoesEmGrade
        nome="filtro-tempo"
        legenda="Há quanto tempo na situação"
        valor={rascunho.tempo ?? ""}
        onMudar={(v) => setRascunho({ ...rascunho, tempo: (v || undefined) as FiltrosLista["tempo"] })}
        opcoes={[{ valor: "", texto: "Qualquer" }, ...FAIXAS_TEMPO.map((f) => ({ valor: f.valor, texto: f.texto }))]}
      />
      <Grupo id="filtro-ordem" rotulo="Ordenar">
        <Selecao id="filtro-ordem" value={rascunho.ordem} onChange={(e) => setRascunho({ ...rascunho, ordem: e.target.value as OrdemLista })}>
          {ordens.map((o) => (
            <option key={o} value={o}>
              {TEXTO_ORDEM[o]}
            </option>
          ))}
        </Selecao>
      </Grupo>
    </Gaveta>
  );
}

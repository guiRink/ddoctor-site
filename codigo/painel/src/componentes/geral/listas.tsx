// O que cada quadrado do Geral mostra e o que a gaveta dele lista (revisão SG, item 1; docs/revisao-sg/sistemas-r2.md,
// "Regras de cada quadrado"). Todos os números vêm de src/dominio/contagens.ts (os mesmos da Produção, da TV e de
// Atendimentos) ou de ./dinheiro.ts (financeiro); o total do quadrado é o número de linhas da gaveta.
import type { ReactNode } from "react";
import type { ConfigOficina, MarcoISO, Perfil } from "@compartilhado/tipos";
import { formatarReais } from "@compartilhado/dominio/dinheiro";
import type { OSVisao } from "../../dados/repositorio";
import type {
  dinheiroVencido,
  entramHoje,
  esperandoSeguradora,
  ItemAfazer,
  naOficina,
  paradosEAtrasados,
  paraAgendar,
  paraFazerHoje,
  prontosCobrarFranquia,
  saemHoje,
} from "../../dominio/contagens";
import { rotuloPrazo } from "../../dominio/horarios";
import { JANELA, PAPEL } from "../../dominio/rotulos";
import { Botao, BotaoLink, Responsavel } from "../ui/Basicos";
import { Etiqueta } from "../ui/Estado";
import { Placa } from "../ui/Placa";
import { nomePerfil } from "../ui/Carro";
import { PilulaSituacao } from "../producao/Situacao";
import { dataCurta, telefoneLegivel } from "../orcamentos/formato";
import type { aPagarEm7Dias, recebidoNoMes, venceEm7Dias } from "./dinheiro";
import { textoDespesa, textoVence } from "./dinheiro";
import { Carro, type ColunaLista, type LinhaLista } from "./ListaGaveta";
import type { ItemQuadrado } from "./Quadrado";

export type ChaveLista =
  | "na_oficina"
  | "entram_hoje"
  | "saem_hoje"
  | "parados"
  | "esperando_seguradora"
  | "dinheiro_vencido"
  | "para_agendar"
  | "cobrar_franquia"
  | "vence_7"
  | "a_pagar_7"
  | "recebido_mes"
  | "afazer";

export const CHAVES_LISTA: readonly ChaveLista[] = [
  "na_oficina",
  "entram_hoje",
  "saem_hoje",
  "parados",
  "esperando_seguradora",
  "dinheiro_vencido",
  "para_agendar",
  "cobrar_franquia",
  "vence_7",
  "a_pagar_7",
  "recebido_mes",
  "afazer",
];

export interface DadosGeral {
  agora: MarcoISO;
  config: ConfigOficina;
  perfis: Perfil[];
  naOficina: ReturnType<typeof naOficina>;
  entram: ReturnType<typeof entramHoje>;
  saem: ReturnType<typeof saemHoje>;
  parados: ReturnType<typeof paradosEAtrasados>;
  esperando: ReturnType<typeof esperandoSeguradora>;
  vencido: ReturnType<typeof dinheiroVencido>;
  agendar: ReturnType<typeof paraAgendar>;
  cobrar: ReturnType<typeof prontosCobrarFranquia>;
  afazer: ReturnType<typeof paraFazerHoje>;
  aVencer: ReturnType<typeof venceEm7Dias>;
  aPagar: ReturnType<typeof aPagarEm7Dias>;
  recebido: ReturnType<typeof recebidoNoMes>;
}

export interface Bloco {
  chave: ChaveLista;
  titulo: string;
  total: number;
  resumo?: ReactNode;
  valor?: string;
  itens: ItemQuadrado[];
  problema?: boolean;
}

const s = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const ficha = (v: OSVisao) => `/orcamentos/${v.os.id}`;
const MAX = 6;
/** Células de uma linha da gaveta, na ordem das colunas. */
const cel = (...celulas: ReactNode[]) => celulas;

// ------------------------------------------------------------------ o quadrado

export function bloco(chave: ChaveLista, d: DadosGeral): Bloco {
  switch (chave) {
    case "na_oficina": {
      const c = d.naOficina;
      return {
        chave,
        titulo: "Na oficina",
        total: c.total,
        resumo: `${c.emServico} em serviço · ${s(c.prontos, "pronto", "prontos")}`,
        itens: c.itens.slice(0, MAX).map((i) => {
          if (i.situacao === "pronto") {
            const dias = i.prontoHaDias ?? 0;
            return { chave: i.v.os.id, placa: i.v.veiculo.placa, info: dias === 0 ? "pronto hoje" : `pronto há ${dias} d`, tom: i.naoBuscou ? "atencao" : "ok" };
          }
          const etapa = i.etapa?.nome ?? "Na fila";
          if (i.situacao === "impedido") return { chave: i.v.os.id, placa: i.v.veiculo.placa, info: `${etapa} · impedido`, tom: "alerta" };
          if (i.situacao === "atrasado") return { chave: i.v.os.id, placa: i.v.veiculo.placa, info: `${etapa} · atrasado`, tom: "alerta" };
          return { chave: i.v.os.id, placa: i.v.veiculo.placa, info: etapa, tom: i.situacao === "atencao" ? "atencao" : "neutro" };
        }),
      };
    }
    case "entram_hoje": {
      const c = d.entram;
      const aConfirmar = c.total - c.confirmados;
      return {
        chave,
        titulo: "Entram hoje",
        total: c.total,
        resumo: [porTurno(c.manha, c.tarde), aConfirmar ? `${aConfirmar} a confirmar` : ""].filter(Boolean).join(" · "),
        itens: c.itens.slice(0, MAX).map((i) => ({
          chave: i.ag.id,
          placa: i.v.veiculo.placa,
          info: `${JANELA[i.janela].toLowerCase()}${i.confirmado ? "" : " · a confirmar"}`,
          tom: i.confirmado ? "neutro" : "atencao",
        })),
      };
    }
    case "saem_hoje": {
      const c = d.saem;
      return {
        chave,
        titulo: "Saem hoje",
        total: c.total,
        resumo: `${s(c.prontos, "pronto", "prontos")} · ${c.emServico} em serviço`,
        itens: c.itens.slice(0, MAX).map((i) => ({
          chave: i.v.os.id,
          placa: i.v.veiculo.placa,
          info: i.pronto ? "pronto" : `falta ${i.falta || "terminar"}`,
          tom: i.pronto ? "ok" : "atencao",
        })),
      };
    }
    case "parados": {
      const c = d.parados;
      const impedidos = c.itens.filter((i) => i.tipo === "impedido").length;
      const atrasados = c.total - impedidos;
      return {
        chave,
        titulo: "Parados e atrasados",
        total: c.total,
        problema: true,
        resumo: [impedidos && s(impedidos, "impedido", "impedidos"), atrasados && s(atrasados, "atrasado", "atrasados")].filter(Boolean).join(" · "),
        itens: c.itens.slice(0, MAX).map((i) => ({
          chave: i.v.os.id,
          placa: i.v.veiculo.placa,
          info: i.tipo === "impedido" ? `impedido ${i.haQuanto}` : i.haQuanto,
          tom: "alerta",
        })),
      };
    }
    case "esperando_seguradora": {
      const c = d.esperando;
      return {
        chave,
        titulo: "Esperando seguradora",
        total: c.total,
        resumo: c.total ? `mais antigo ${c.maisAntigoDias === 0 ? "de hoje" : `há ${s(c.maisAntigoDias, "dia", "dias")}`}` : undefined,
        itens: c.itens.slice(0, MAX).map((i) => ({
          chave: i.v.os.id,
          placa: i.v.veiculo.placa,
          info: `${i.seguradora} · ${i.dias === 0 ? "hoje" : `há ${i.dias} d`}`,
        })),
      };
    }
    case "dinheiro_vencido": {
      const c = d.vencido;
      return {
        chave,
        titulo: "Dinheiro vencido",
        total: c.total,
        problema: true,
        valor: formatarReais(c.valor),
        resumo: nomesDevedores(c.porDevedor.map((g) => (g.tipo === "cliente" ? "cliente" : g.nome))),
        itens: c.itens.slice(0, MAX).map((i) => ({
          chave: i.t.id,
          placa: i.v?.veiculo.placa,
          texto: i.t.descricao,
          info: `há ${s(i.diasAtraso, "dia", "dias")}`,
          tom: "alerta",
        })),
      };
    }
    case "para_agendar": {
      const c = d.agendar;
      const semTelefone = c.itens.filter((i) => i.semTelefone).length;
      return {
        chave,
        titulo: "Para agendar",
        total: c.total,
        resumo: [c.total && `mais antigo há ${s(c.itens[0]?.dias ?? 0, "dia", "dias")}`, semTelefone && `${semTelefone} sem telefone`].filter(Boolean).join(" · "),
        itens: c.itens.slice(0, MAX).map((i) => ({
          chave: i.v.os.id,
          placa: i.v.veiculo.placa,
          info: i.semTelefone ? "sem telefone" : i.proposta ? "horário proposto" : i.dias === 0 ? "aprovado hoje" : `aprovado há ${i.dias} d`,
          tom: i.semTelefone ? "alerta" : "neutro",
        })),
      };
    }
    case "cobrar_franquia": {
      const c = d.cobrar;
      return {
        chave,
        titulo: "Prontos — cobrar franquia",
        total: c.total,
        valor: formatarReais(c.valor),
        itens: c.itens.slice(0, MAX).map((i) => ({ chave: i.v.os.id, placa: i.v.veiculo.placa, info: formatarReais(i.valor) })),
      };
    }
    case "vence_7": {
      const c = d.aVencer;
      return {
        chave,
        titulo: "Vence em 7 dias",
        total: c.total,
        valor: formatarReais(c.valor),
        resumo: nomesDevedores(c.itens.map((i) => (i.devedor.tipo === "cliente" ? "cliente" : i.devedor.nome))),
        itens: c.itens.slice(0, MAX).map((i) => ({ chave: i.t.id, placa: i.v?.veiculo.placa, texto: i.t.descricao, info: textoVence(i.dias), tom: i.dias === 0 ? "atencao" : "neutro" })),
      };
    }
    case "a_pagar_7": {
      const c = d.aPagar;
      return {
        chave,
        titulo: "A pagar em 7 dias",
        total: c.total,
        valor: formatarReais(c.valor),
        resumo: c.vencidas ? `${s(c.vencidas, "vencida", "vencidas")}` : undefined,
        itens: c.itens.slice(0, MAX).map((i) => ({ chave: i.d.id, texto: i.d.descricao, info: textoDespesa(i), tom: i.vencida ? "alerta" : i.dias === 0 ? "atencao" : "neutro" })),
      };
    }
    case "recebido_mes": {
      const c = d.recebido;
      return {
        chave,
        titulo: "Recebido no mês",
        total: c.total,
        valor: formatarReais(c.valor),
        resumo: c.total ? s(c.total, "recebimento", "recebimentos") : undefined,
        itens: c.itens.slice(0, MAX).map((i) => ({ chave: i.b.id, placa: i.v?.veiculo.placa, texto: i.t.descricao, info: `${formatarReais(i.b.valor)} · ${dataCurta(i.b.recebidoEm)}` })),
      };
    }
    case "afazer": {
      const c = d.afazer;
      return { chave, titulo: "Para fazer hoje", total: c.total, itens: [] };
    }
  }
}

/** "HDI · cliente" / "HDI, Liberty e mais 2". */
function nomesDevedores(nomes: string[]): string | undefined {
  const unicos = [...new Set(nomes)];
  if (unicos.length === 0) return undefined;
  if (unicos.length <= 2) return unicos.join(" · ");
  return `${unicos.slice(0, 2).join(" · ")} e mais ${unicos.length - 2}`;
}

// ------------------------------------------------------------------ a gaveta

export interface AcoesLista {
  podeReceber: boolean;
  podeAgendar: boolean;
  onReceber: (v: OSVisao) => void;
  onNaoVeio: (agendamentoId: string, placa: string) => void;
  onCopiar: (v: OSVisao) => void;
  copiadoId?: string;
  ocupado: boolean;
}

export interface ConteudoLista {
  titulo: string;
  descricao: string;
  rotuloIdent?: string;
  larguraIdent?: string;
  colunas: ColunaLista[];
  linhas: LinhaLista[];
  /** Largura da coluna de botões no computador (sem ela, a lista não tem botões). */
  larguraAcoes?: string;
  destino?: { para: string; rotulo: string };
  /** Texto do rodapé (total): "8 carros", "2 títulos · R$ 1.560,00". */
  total: string;
}

const placa = (v: OSVisao) => <Placa placa={v.veiculo.placa} />;
const textoIdent = (t: string) => <span className="font-semibold text-[13px] truncate">{t}</span>;
const nada = <span className="text-tinta-fraca">—</span>;
const modelo = (v: OSVisao) => v.veiculo.modelo ?? "Modelo não informado";

function prazoEntrega(data: string | undefined, d: DadosGeral) {
  if (!data) return nada;
  const texto = rotuloPrazo(data.slice(0, 10), d.agora, d.config);
  return <span className={`numero whitespace-nowrap ${texto.startsWith("atrasado") ? "text-alerta font-medium" : ""}`}>{texto}</span>;
}

function responsavel(d: DadosGeral, id?: string) {
  const nome = nomePerfil(d.perfis, id);
  return nome ? <Responsavel nome={nome} /> : nada;
}

export function conteudoLista(chave: ChaveLista, d: DadosGeral, a: AcoesLista): ConteudoLista {
  switch (chave) {
    case "na_oficina": {
      const c = d.naOficina;
      return {
        titulo: "Na oficina",
        descricao: `${s(c.total, "carro", "carros")} · ${c.emServico} em serviço · ${s(c.prontos, "pronto", "prontos")}`,
        total: s(c.total, "carro", "carros"),
        destino: { para: "/producao", rotulo: "Abrir a Produção" },
        colunas: [
          { rotulo: "Carro", largura: "minmax(0,1.3fr)", celular: "titulo" },
          { rotulo: "Etapa", largura: "minmax(0,1fr)" },
          { rotulo: "Responsável", largura: "minmax(0,1.1fr)", celular: "oculto" },
          { rotulo: "Entrega", largura: "minmax(0,0.9fr)", prefixo: "entrega" },
          { rotulo: "Situação", largura: "104px", celular: "lado" },
        ],
        linhas: c.itens.map((i) => ({
          id: i.v.os.id,
          ident: placa(i.v),
          para: ficha(i.v),
          rotulo: `Abrir a ficha do ${i.v.veiculo.placa}`,
          alerta: i.situacao === "atrasado" || i.situacao === "impedido",
          celulas: cel(
            <Carro titulo={modelo(i.v)} detalhe={i.v.cliente.nome} />,
            i.situacao === "pronto" ? (
              <span className={i.naoBuscou ? "text-atencao font-medium" : ""}>
                {(i.prontoHaDias ?? 0) === 0 ? "Pronto hoje" : `Pronto há ${s(i.prontoHaDias ?? 0, "dia", "dias")}`}
                {i.naoBuscou && <span className="block text-[12px]">cliente não buscou</span>}
              </span>
            ) : (
              <span className="truncate">{i.etapa?.nome ?? "Na fila"}</span>
            ),
            responsavel(d, i.responsavelId),
            prazoEntrega(i.entrega, d),
            <PilulaSituacao situacao={i.situacao} />,
          ),
        })),
      };
    }
    case "entram_hoje": {
      const c = d.entram;
      const comAcoes = a.podeReceber || a.podeAgendar;
      return {
        titulo: "Entram hoje",
        descricao: [s(c.total, "carro", "carros"), porTurno(c.manha, c.tarde)].filter(Boolean).join(" · "),
        total: s(c.total, "carro", "carros"),
        destino: { para: "/agenda", rotulo: "Abrir a Agenda" },
        larguraAcoes: comAcoes ? "216px" : undefined,
        colunas: [
          { rotulo: "Carro", largura: "minmax(0,1.3fr)", celular: "titulo" },
          { rotulo: "Turno", largura: "92px", celular: "lado" },
          { rotulo: "Telefone", largura: "minmax(0,1fr)" },
        ],
        linhas: c.itens.map((i) => ({
          id: i.ag.id,
          ident: placa(i.v),
          para: ficha(i.v),
          rotulo: `Abrir a ficha do ${i.v.veiculo.placa}`,
          celulas: cel(
            <Carro titulo={modelo(i.v)} detalhe={i.v.cliente.nome} />,
            <span className="block leading-tight">
              {JANELA[i.janela]}
              <span className={`block text-[12px] ${i.confirmado ? "text-tinta-suave" : "text-atencao font-medium"}`}>{i.confirmado ? "confirmado" : "a confirmar"}</span>
            </span>,
            i.telefone ? <span className="numero whitespace-nowrap">{telefoneLegivel(i.telefone)}</span> : <span className="text-alerta font-medium">Sem telefone</span>,
          ),
          acoes: comAcoes ? (
            <>
              {a.podeReceber && (
                <Botao tamanho="denso" onClick={() => a.onReceber(i.v)} disabled={a.ocupado}>
                  Registrar entrada
                </Botao>
              )}
              {/* "Não veio" só vale para horário confirmado; proposta da Calia ainda não é compromisso. */}
              {a.podeAgendar && i.confirmado && (
                <Botao tamanho="denso" variante="fantasma" onClick={() => a.onNaoVeio(i.ag.id, i.v.veiculo.placa)} disabled={a.ocupado}>
                  Não veio
                </Botao>
              )}
            </>
          ) : undefined,
        })),
      };
    }
    case "saem_hoje": {
      const c = d.saem;
      const comAcoes = a.podeReceber && c.prontos > 0;
      return {
        titulo: "Saem hoje",
        descricao: `${s(c.total, "carro", "carros")} · ${s(c.prontos, "pronto", "prontos")} · ${c.emServico} em serviço`,
        total: s(c.total, "carro", "carros"),
        destino: { para: "/producao?filtro=hoje", rotulo: "Abrir na Produção" },
        larguraAcoes: comAcoes ? "148px" : undefined,
        colunas: [
          { rotulo: "Carro", largura: "minmax(0,1.3fr)", celular: "titulo" },
          { rotulo: "O que falta", largura: "minmax(0,1.2fr)" },
          { rotulo: "Cliente paga", largura: "minmax(0,0.8fr)", direita: true, celular: "lado" },
        ],
        linhas: c.itens.map((i) => ({
          id: i.v.os.id,
          ident: placa(i.v),
          para: ficha(i.v),
          rotulo: `Abrir a ficha do ${i.v.veiculo.placa}`,
          celulas: cel(
            <Carro titulo={modelo(i.v)} detalhe={i.v.cliente.nome} />,
            i.pronto ? (
              <Etiqueta tom="ok">Pronto</Etiqueta>
            ) : (
              <span className="text-atencao font-medium">
                {i.falta || "Terminar"}
                <span className="block text-[12px] font-normal text-tinta-suave">{s(i.etapasRestantes, "etapa", "etapas")}</span>
              </span>
            ),
            i.aCobrarCliente > 0 ? <span className="font-medium">{formatarReais(i.aCobrarCliente)}</span> : nada,
          ),
          acoes:
            comAcoes && i.pronto ? (
              <BotaoLink tamanho="denso" para={ficha(i.v)}>
                Registrar entrega
              </BotaoLink>
            ) : undefined,
        })),
      };
    }
    case "parados": {
      const c = d.parados;
      return {
        titulo: "Parados e atrasados",
        descricao: `${s(c.total, "carro", "carros")} · o mais antigo primeiro`,
        total: s(c.total, "carro", "carros"),
        destino: { para: "/producao?filtro=atrasados", rotulo: "Abrir na Produção" },
        colunas: [
          { rotulo: "Carro", largura: "minmax(0,1.1fr)", celular: "titulo" },
          { rotulo: "Motivo", largura: "minmax(0,1.5fr)", celular: "titulo" },
          { rotulo: "Há quanto", largura: "minmax(0,0.8fr)" },
          { rotulo: "Quem resolve", largura: "minmax(0,1fr)" },
        ],
        linhas: c.itens.map((i) => {
          const nome = i.tipo === "impedido" ? undefined : nomePerfil(d.perfis, i.responsavelId);
          return {
            id: i.v.os.id,
            ident: placa(i.v),
            para: ficha(i.v),
            rotulo: `Abrir a ficha do ${i.v.veiculo.placa}`,
            celulas: cel(
              <Carro titulo={modelo(i.v)} detalhe={i.etapa?.nome} />,
              <span className="block text-alerta font-medium leading-snug line-clamp-2">{i.motivo}</span>,
              <span className="numero whitespace-nowrap">{i.haQuanto}</span>,
              nome ? <Responsavel nome={nome} /> : <span>{PAPEL[i.quemResolve]}</span>,
            ),
          };
        }),
      };
    }
    case "esperando_seguradora": {
      const c = d.esperando;
      return {
        titulo: "Esperando seguradora",
        descricao: `${s(c.total, "carro", "carros")} · o mais antigo primeiro`,
        total: s(c.total, "carro", "carros"),
        destino: { para: "/orcamentos?estado=aguardando_aprovacao&origem=com_seguradora", rotulo: "Abrir em Atendimentos" },
        colunas: [
          { rotulo: "Carro", largura: "minmax(0,1.2fr)", celular: "titulo" },
          { rotulo: "Seguradora", largura: "minmax(0,1.2fr)" },
          { rotulo: "Há quanto", largura: "minmax(0,0.8fr)" },
          { rotulo: "Valor orçado", largura: "minmax(0,0.9fr)", direita: true, celular: "lado" },
        ],
        linhas: c.itens.map((i) => ({
          id: i.v.os.id,
          ident: placa(i.v),
          para: ficha(i.v),
          rotulo: `Abrir a ficha do ${i.v.veiculo.placa}`,
          celulas: cel(
            <Carro titulo={modelo(i.v)} detalhe={i.v.cliente.nome} />,
            <Carro titulo={i.seguradora} detalhe={i.protocolo && <span className="numero">{i.protocolo}</span>} />,
            <span className="numero whitespace-nowrap">{i.dias === 0 ? "hoje" : `há ${s(i.dias, "dia", "dias")}`}</span>,
            i.valorOrcado > 0 ? <span className="font-medium">{formatarReais(i.valorOrcado)}</span> : nada,
          ),
        })),
      };
    }
    case "dinheiro_vencido": {
      const c = d.vencido;
      return {
        titulo: "Dinheiro vencido",
        descricao: `${s(c.total, "título", "títulos")} · ${formatarReais(c.valor)}`,
        total: `${s(c.total, "título", "títulos")} · ${formatarReais(c.valor)}`,
        destino: { para: "/recebiveis?faixa=vencido", rotulo: "Abrir A receber" },
        colunas: [
          { rotulo: "Quem deve", largura: "minmax(0,1.2fr)", celular: "titulo" },
          { rotulo: "Título", largura: "minmax(0,1.2fr)" },
          { rotulo: "Atraso", largura: "minmax(0,0.7fr)", prefixo: "atraso" },
          { rotulo: "Valor", largura: "minmax(0,0.9fr)", direita: true, celular: "lado" },
        ],
        linhas: c.itens.map((i) => ({
          id: i.t.id,
          ident: i.v ? placa(i.v) : textoIdent(i.t.descricao),
          para: i.v ? ficha(i.v) : "/recebiveis?faixa=vencido",
          rotulo: i.v ? `Abrir a ficha do ${i.v.veiculo.placa}` : `Abrir A receber: ${i.t.descricao}`,
          celulas: cel(
            <Carro titulo={i.devedor.nome} detalhe={i.devedor.tipo === "cliente" ? "Cliente" : i.devedor.tipo === "seguradora" ? "Seguradora" : undefined} />,
            <span className="block truncate text-tinta-suave">{i.t.descricao}</span>,
            <span className="text-alerta font-medium numero whitespace-nowrap">{s(i.diasAtraso, "dia", "dias")}</span>,
            <span className="font-medium">{formatarReais(i.saldo)}</span>,
          ),
        })),
      };
    }
    case "para_agendar": {
      const c = d.agendar;
      return {
        titulo: "Para agendar",
        descricao: `${s(c.total, "carro", "carros")} aprovados · o mais antigo primeiro`,
        total: s(c.total, "carro", "carros"),
        destino: { para: "/agenda", rotulo: "Abrir a Agenda" },
        larguraAcoes: a.podeAgendar ? "228px" : undefined,
        colunas: [
          { rotulo: "Carro", largura: "minmax(0,1.3fr)", celular: "titulo" },
          { rotulo: "Telefone", largura: "minmax(0,1fr)" },
          { rotulo: "Aprovado", largura: "minmax(0,0.9fr)" },
        ],
        linhas: c.itens.map((i) => ({
          id: i.v.os.id,
          ident: placa(i.v),
          para: ficha(i.v),
          rotulo: `Abrir a ficha do ${i.v.veiculo.placa}`,
          celulas: cel(
            <Carro titulo={modelo(i.v)} detalhe={i.v.cliente.nome} />,
            i.telefone ? <span className="numero whitespace-nowrap">{telefoneLegivel(i.telefone)}</span> : <span className="text-alerta font-medium">Sem telefone</span>,
            <span className="block numero leading-snug">
              {i.dias === 0 ? "hoje" : `há ${s(i.dias, "dia", "dias")}`}
              {i.proposta && <span className="block text-[12px] text-tinta-suave">horário proposto</span>}
            </span>,
          ),
          acoes: a.podeAgendar ? (
            <>
              {i.telefone && (
                <Botao tamanho="denso" icone="copiar" onClick={() => a.onCopiar(i.v)}>
                  {a.copiadoId === i.v.os.id ? "Copiada" : "Copiar mensagem"}
                </Botao>
              )}
              <BotaoLink tamanho="denso" variante="fantasma" para={`/agenda?os=${i.v.os.id}`}>
                Agendar
              </BotaoLink>
            </>
          ) : undefined,
        })),
      };
    }
    case "cobrar_franquia": {
      const c = d.cobrar;
      return {
        titulo: "Prontos — cobrar franquia",
        descricao: `${s(c.total, "carro", "carros")} · ${formatarReais(c.valor)} a receber na retirada`,
        total: `${s(c.total, "carro", "carros")} · ${formatarReais(c.valor)}`,
        colunas: [
          { rotulo: "Carro", largura: "minmax(0,1.3fr)", celular: "titulo" },
          { rotulo: "Cobrar", largura: "minmax(0,0.7fr)" },
          { rotulo: "Telefone", largura: "minmax(0,1fr)" },
          { rotulo: "Valor", largura: "minmax(0,0.8fr)", direita: true, celular: "lado" },
        ],
        linhas: c.itens.map((i) => ({
          id: i.v.os.id,
          ident: placa(i.v),
          para: ficha(i.v),
          rotulo: `Abrir a ficha do ${i.v.veiculo.placa}`,
          celulas: cel(
            <Carro titulo={modelo(i.v)} detalhe={i.v.cliente.nome} />,
            i.tipo === "franquia" ? "Franquia" : "Serviço",
            i.v.cliente.telefone ? <span className="numero whitespace-nowrap">{telefoneLegivel(i.v.cliente.telefone)}</span> : nada,
            <span className="font-medium">{formatarReais(i.valor)}</span>,
          ),
        })),
      };
    }
    case "vence_7": {
      const c = d.aVencer;
      return {
        titulo: "Vence em 7 dias",
        descricao: `${s(c.total, "título", "títulos")} · ${formatarReais(c.valor)}`,
        total: `${s(c.total, "título", "títulos")} · ${formatarReais(c.valor)}`,
        destino: { para: "/recebiveis?faixa=a_vencer", rotulo: "Abrir A receber" },
        colunas: [
          { rotulo: "Quem deve", largura: "minmax(0,1.2fr)", celular: "titulo" },
          { rotulo: "Título", largura: "minmax(0,1.2fr)" },
          { rotulo: "Vence", largura: "minmax(0,0.8fr)" },
          { rotulo: "Valor", largura: "minmax(0,0.9fr)", direita: true, celular: "lado" },
        ],
        linhas: c.itens.map((i) => ({
          id: i.t.id,
          ident: i.v ? placa(i.v) : textoIdent(i.t.descricao),
          para: i.v ? ficha(i.v) : "/recebiveis?faixa=a_vencer",
          rotulo: i.v ? `Abrir a ficha do ${i.v.veiculo.placa}` : `Abrir A receber: ${i.t.descricao}`,
          celulas: cel(
            <Carro titulo={i.devedor.nome} detalhe={i.devedor.tipo === "cliente" ? "Cliente" : i.devedor.tipo === "seguradora" ? "Seguradora" : undefined} />,
            <span className="block truncate text-tinta-suave">{i.t.descricao}</span>,
            <span className={`numero whitespace-nowrap ${i.dias === 0 ? "text-atencao font-medium" : ""}`}>{textoVence(i.dias)}</span>,
            <span className="font-medium">{formatarReais(i.saldo)}</span>,
          ),
        })),
      };
    }
    case "a_pagar_7": {
      const c = d.aPagar;
      return {
        titulo: "A pagar em 7 dias",
        descricao: `${s(c.total, "despesa", "despesas")} · ${formatarReais(c.valor)}`,
        total: `${s(c.total, "despesa", "despesas")} · ${formatarReais(c.valor)}`,
        destino: { para: "/financeiro", rotulo: "Abrir o Financeiro" },
        rotuloIdent: "Despesa",
        larguraIdent: "minmax(0,1.5fr)",
        colunas: [
          { rotulo: "Fornecedor", largura: "minmax(0,1.2fr)", celular: "titulo" },
          { rotulo: "Vence", largura: "minmax(0,0.9fr)" },
          { rotulo: "Valor", largura: "minmax(0,0.8fr)", direita: true, celular: "lado" },
        ],
        linhas: c.itens.map((i) => ({
          id: i.d.id,
          ident: textoIdent(i.d.descricao),
          para: "/financeiro",
          rotulo: `Abrir o Financeiro: ${i.d.descricao}`,
          alerta: i.vencida,
          celulas: cel(
            <Carro titulo={i.d.fornecedor ?? i.d.categoria} detalhe={i.d.fornecedor ? i.d.categoria : undefined} />,
            <span className={`numero whitespace-nowrap ${i.vencida ? "text-alerta font-medium" : i.dias === 0 ? "text-atencao font-medium" : ""}`}>{textoDespesa(i)}</span>,
            <span className="font-medium">{formatarReais(i.d.valorPrevisto)}</span>,
          ),
        })),
      };
    }
    case "recebido_mes": {
      const c = d.recebido;
      return {
        titulo: "Recebido no mês",
        descricao: `${s(c.total, "recebimento", "recebimentos")} · ${formatarReais(c.valor)}`,
        total: `${s(c.total, "recebimento", "recebimentos")} · ${formatarReais(c.valor)}`,
        destino: { para: "/financeiro", rotulo: "Abrir o Financeiro" },
        colunas: [
          { rotulo: "Quem pagou", largura: "minmax(0,1.2fr)", celular: "titulo" },
          { rotulo: "Título", largura: "minmax(0,1.2fr)" },
          { rotulo: "Recebido em", largura: "minmax(0,0.7fr)" },
          { rotulo: "Valor", largura: "minmax(0,0.9fr)", direita: true, celular: "lado" },
        ],
        linhas: c.itens.map((i) => ({
          id: i.b.id,
          ident: i.v ? placa(i.v) : textoIdent(i.t.descricao),
          para: i.v ? ficha(i.v) : "/financeiro",
          rotulo: i.v ? `Abrir a ficha do ${i.v.veiculo.placa}` : `Abrir o Financeiro: ${i.t.descricao}`,
          celulas: cel(
            <Carro titulo={i.devedor.nome} detalhe={i.devedor.tipo === "cliente" ? "Cliente" : i.devedor.tipo === "seguradora" ? "Seguradora" : undefined} />,
            <span className="block truncate text-tinta-suave">{i.t.descricao}</span>,
            <span className="numero whitespace-nowrap">{dataCurta(i.b.recebidoEm)}</span>,
            <span className="font-medium">{formatarReais(i.b.valor)}</span>,
          ),
        })),
      };
    }
    case "afazer": {
      const c = d.afazer;
      return {
        titulo: "Para fazer hoje",
        descricao: `${s(c.total, "item", "itens")} · com quem faz`,
        total: s(c.total, "item", "itens"),
        colunas: [
          { rotulo: "O que fazer", largura: "minmax(0,1.6fr)", celular: "titulo" },
          { rotulo: "Quando", largura: "minmax(0,0.8fr)" },
          { rotulo: "Quem faz", largura: "minmax(0,0.7fr)" },
        ],
        linhas: c.itens.map((i) => {
          const [oQue, quando] = partirAfazer(i);
          return {
            id: i.chave,
            ident: <Placa placa={i.placa} />,
            para: i.para,
            rotulo: `${i.placa}: ${i.texto}`,
            celulas: cel(<span className="font-medium">{oQue}</span>, quando ? <span className="numero whitespace-nowrap text-tinta-suave">{quando}</span> : nada, PAPEL[i.quem]),
          };
        }),
      };
    }
  }
}

/** "Reenviar documentação no portal · há 4 dias" → ["Reenviar documentação no portal", "há 4 dias"]. */
export function partirAfazer(i: ItemAfazer): [string, string | undefined] {
  const k = i.texto.lastIndexOf(" · ");
  // só separa quando a segunda parte é tempo ("há 4 dias", "aprovado há 1 dia"); "Sem telefone · pedir à seguradora" fica inteiro
  if (k < 0 || !/(^|\s)(há \d|hoje|amanhã|ontem)/.test(i.texto.slice(k + 3))) return [i.texto, undefined];
  return [i.texto.slice(0, k), i.texto.slice(k + 3)];
}

/** Rótulo do botão de cada afazer, pelo destino. */
export function rotuloDestino(para: string): string {
  if (para.startsWith("/agenda")) return "Agenda";
  if (para.startsWith("/clientes")) return "Cadastro";
  return "Abrir";
}

/** "1 de manhã · 2 à tarde" — o turno sem carro não aparece (antes: "manhã 0 · tarde 1"). */
function porTurno(manha: number, tarde: number): string {
  return [manha ? `${manha} de manhã` : "", tarde ? `${tarde} à tarde` : ""].filter(Boolean).join(" · ");
}

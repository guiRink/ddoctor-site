import { useId, useState } from "react";
import { useHref } from "react-router-dom";
import { useAgora } from "../../dados/hooks";
import type { OSVisao } from "../../dados/repositorio";
import { Botao, BotaoExterno } from "../ui/Basicos";
import { AreaTexto, Aviso, Grupo, LinhaPrevia, Previa } from "../ui/Campos";
import { Provisorio } from "../ui/Estado";
import { Gaveta } from "../ui/Gaveta";
import { Placa } from "../ui/Placa";
import { linkWhatsAppComMensagem, mensagemOrcamento, montarDocumento, numeroWhatsApp } from "./documento";
import { useEnvioOrcamento, type ResultadoEnvio } from "./envio";

/**
 * Ícones de envio no mesmo traço do `Icone` (1,75, pontas redondas, grade 24).
 * TODO: subir para o `Icone` (fora do escopo do SF neste arquivo).
 */
const CAMINHOS_ENVIO = {
  compartilhar: "M12 15V3M8 7l4-4 4 4M7 10H5v11h14V10h-2",
  baixar: "M12 3v12M8 11l4 4 4-4M5 20h14",
} as const;

export function IconeEnvio({ nome, tamanho = 18, className = "" }: { nome: keyof typeof CAMINHOS_ENVIO; tamanho?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={tamanho}
      height={tamanho}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d={CAMINHOS_ENVIO[nome]} />
    </svg>
  );
}

const AVISO_RESULTADO: Record<Exclude<ResultadoEnvio, "cancelado">, string> = {
  baixado: "PDF baixado. Anexe o arquivo na conversa do WhatsApp.",
  compartilhado: "Orçamento compartilhado.",
};

/**
 * "Enviar orçamento" (pedido do dono, SF): botão que abre a gaveta com o PDF do orçamento e as formas de
 * mandar ao cliente — Compartilhar (folha do aparelho: WhatsApp no celular), Baixar PDF, Abrir o WhatsApp
 * com a mensagem pronta (cliente real com número) e Imprimir. Quem não vê valores não recebe o botão
 * (a tela decide com veDadosSensiveis; a barreira é a RLS).
 */
export function BotaoEnviarOrcamento({ v, primario = false }: { v: OSVisao; primario?: boolean }) {
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <Botao
        tamanho="denso"
        variante={primario ? "primario" : "contorno"}
        onClick={() => setAberta(true)}
        aria-haspopup="dialog"
      >
        <IconeEnvio nome="compartilhar" tamanho={16} />
        Enviar orçamento
      </Botao>
      {aberta && <GavetaEnviarOrcamento v={v} onFechar={() => setAberta(false)} />}
    </>
  );
}

function GavetaEnviarOrcamento({ v, onFechar }: { v: OSVisao; onFechar: () => void }) {
  const envio = useEnvioOrcamento(v);
  const hrefImprimir = useHref(`/orcamentos/${v.os.id}/imprimir`);
  const idObs = useId();
  const [observacao, setObservacao] = useState("");
  const [aviso, setAviso] = useState<{ tom: "ok" | "alerta"; texto: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  // prévia (data de emissão só para a validade exibida; o PDF usa a hora do clique)
  const agora = useAgora(60_000);
  const doc = montarDocumento(v, agora);
  const mensagem = mensagemOrcamento(v, doc);
  const linkWhats = linkWhatsAppComMensagem(v, mensagem);
  const numero = numeroWhatsApp(v);
  const semPecas = doc.itens.length === 0;
  const total = doc.somas.find((s) => s.forte);

  async function compartilhar() {
    setAviso(null);
    try {
      const r = await envio.compartilhar(mensagem, observacao);
      if (r !== "cancelado") setAviso({ tom: "ok", texto: AVISO_RESULTADO[r] });
    } catch {
      setAviso({ tom: "alerta", texto: "Não consegui compartilhar. Baixe o PDF e anexe na conversa." });
    }
  }

  function baixar() {
    setAviso(null);
    try {
      setAviso({ tom: "ok", texto: AVISO_RESULTADO[envio.baixar(observacao)] });
    } catch {
      setAviso({ tom: "alerta", texto: "Não consegui gerar o PDF. Tente de novo." });
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setAviso({ tom: "alerta", texto: "Não consegui copiar. Selecione o texto da mensagem e copie." });
    }
  }

  const preparando = !envio.pronto && !envio.erroCarga;
  const desabilitado = !envio.pronto || semPecas;

  return (
    <Gaveta
      titulo="Enviar orçamento"
      descricao={`OS ${v.os.numero} · ${doc.veiculo.modelo} · ${v.cliente.nome}`}
      antesDoTitulo={<Placa placa={v.veiculo.placa} tamanho="p" />}
      onFechar={onFechar}
      rodape={
        <>
          {aviso && <Aviso tom={aviso.tom}>{aviso.texto}</Aviso>}
          <div className="flex items-center justify-end">
            <Botao variante="fantasma" onClick={onFechar} className="max-md:flex-1">
              Fechar
            </Botao>
          </div>
        </>
      }
    >
      {/* resumo do que vai no PDF */}
      <Previa titulo="O que vai no PDF">
        <LinhaPrevia rotulo="Arquivo">
          <span className="text-[13px] break-all">{doc.nomeArquivo}</span>
        </LinhaPrevia>
        <LinhaPrevia rotulo="Peças">{semPecas ? "nenhuma" : doc.itens.length}</LinhaPrevia>
        {doc.aprovado ? (
          <LinhaPrevia rotulo="Situação">{doc.aprovado}</LinhaPrevia>
        ) : (
          doc.validade && (
            <LinhaPrevia rotulo="Validade">
              <Provisorio>{doc.validade.dias} dias</Provisorio>
              <span className="text-tinta-suave"> · até {doc.validade.ate.slice(0, 5)}</span>
            </LinhaPrevia>
          )
        )}
        {total && (
          <LinhaPrevia rotulo={total.nome} forte>
            {total.valor}
          </LinhaPrevia>
        )}
      </Previa>

      {semPecas && <Aviso tom="alerta">Este orçamento ainda não tem peças. Lance as peças na ficha antes de enviar ao cliente.</Aviso>}

      <Grupo
        id={idObs}
        rotulo="Observação para o cliente"
        opcional
        dica="Sai no PDF, abaixo dos valores. As observações internas da OS não vão para o cliente."
      >
        <AreaTexto id={idObs} value={observacao} maxLength={600} onChange={(e) => setObservacao(e.target.value)} aria-describedby={`${idObs}-dica`} />
      </Grupo>

      {/* formas de envio */}
      <section aria-labelledby={`${idObs}-enviar`} className="flex flex-col gap-2">
        <h3 id={`${idObs}-enviar`} className="text-[13px] font-semibold">
          Enviar
        </h3>
        {envio.erroCarga && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-cartao bg-alerta-claro px-3 py-2">
            <Aviso tom="alerta">Não consegui preparar o PDF. Verifique a conexão.</Aviso>
            <Botao tamanho="denso" variante="contorno" onClick={envio.tentarDeNovo}>
              Tentar de novo
            </Botao>
          </div>
        )}
        {envio.compartilha && (
          <Botao variante="primario" onClick={compartilhar} disabled={desabilitado} className="w-full" data-foco-inicial>
            <IconeEnvio nome="compartilhar" />
            {preparando ? "Preparando o PDF…" : "Compartilhar PDF"}
          </Botao>
        )}
        <Botao
          variante={envio.compartilha ? "contorno" : "primario"}
          onClick={baixar}
          disabled={desabilitado}
          className="w-full"
          data-foco-inicial={envio.compartilha ? undefined : true}
        >
          <IconeEnvio nome="baixar" />
          {preparando && !envio.compartilha ? "Preparando o PDF…" : "Baixar PDF"}
        </Botao>
        {linkWhats && (
          <BotaoExterno href={linkWhats} icone="whatsapp" classeIcone="text-ok" className="w-full">
            Abrir o WhatsApp com a mensagem
          </BotaoExterno>
        )}
        <Botao variante="contorno" icone="documento" onClick={() => window.open(hrefImprimir, "_blank", "noopener")} className="w-full">
          Imprimir
          <span className="sr-only"> (abre em nova aba)</span>
        </Botao>
        <p className="mt-1 text-[12px] leading-snug text-tinta-suave">
          {envio.compartilha
            ? "“Compartilhar PDF” abre a lista do aparelho: escolha o WhatsApp e a conversa do cliente. Se o WhatsApp não aparecer, baixe o PDF e anexe na conversa."
            : "No computador: baixe o PDF, abra a conversa do cliente no WhatsApp e anexe o arquivo."}
        </p>
      </section>

      {/* mensagem */}
      <section aria-labelledby={`${idObs}-msg`} className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h3 id={`${idObs}-msg`} className="text-[13px] font-semibold">
            Mensagem
          </h3>
          <Botao tamanho="denso" variante="fantasma" icone={copiado ? "ok" : "copiar"} onClick={copiar}>
            {copiado ? "Mensagem copiada" : "Copiar mensagem"}
          </Botao>
        </div>
        <p className="rounded-cartao border border-linha bg-cinza-50 px-3 py-2.5 text-[14px] leading-snug break-words select-all">{mensagem}</p>
        {!numero ? (
          <p className="text-[12px] text-tinta-suave">Cliente sem telefone cadastrado: copie a mensagem e mande pelo número que o cliente passar.</p>
        ) : (
          !linkWhats && (
            <p className="text-[12px] text-tinta-suave">
              Cliente de demonstração: o WhatsApp não abre, para não cair num número real. Copie a mensagem.
            </p>
          )
        )}
        <span aria-live="polite" className="sr-only">
          {copiado ? "Mensagem copiada." : ""}
        </span>
      </section>
    </Gaveta>
  );
}

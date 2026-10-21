import type { SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import type { ChecklistItem } from "@compartilhado/tipos";
import { Botao, SUPERFICIE } from "../ui/Basicos";
import { Aviso } from "../ui/Campos";
import { Gaveta } from "../ui/Gaveta";
import { NotaProvisoria } from "../ajustes/Estrutura";
import { CorpoEditorChecklist } from "../ajustes/Checklist";
import { useEditorChecklist } from "../ajustes/editorChecklist";

/**
 * Gaveta "Editar checklist" (pedido do dono, sprint SI), aberta do passo Checklist do Receber o carro: o mesmo
 * editor de Ajustes (itens, grupos, ordem, ativo) com "Salvar checklist" no rodapé. Salvar grava a configuração
 * da oficina (salvarChecklistConfig) e fecha; o checklist do carro recarrega com as marcações dos itens que
 * continuam (os ids não mudam). Abre por cima do Receber o carro (portal no <body>).
 */
export function EditarChecklist({
  itens,
  padrao,
  onFechar,
  onSalvo,
}: {
  itens: readonly ChecklistItem[];
  /** Ainda é a lista genérica do demo (provisória). */
  padrao: boolean;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const ed = useEditorChecklist(itens);

  async function salvar() {
    if (await ed.salvar()) onSalvo();
  }

  const gaveta = (
    <Gaveta
      titulo="Editar checklist"
      descricao="Vale para este carro e para as próximas entradas. O que já foi marcado continua marcado."
      onFechar={onFechar}
      rotuloFechar="Fechar sem salvar"
      fundoCorpo="papel"
      rodape={
        <>
          {ed.erro && <Aviso tom="alerta">{ed.erro}</Aviso>}
          <div className="flex items-center gap-2">
            <span className="hidden md:block flex-1 text-[13px] text-tinta-suave">{ed.alterado ? "Alterações não salvas" : "Nada alterado ainda"}</span>
            <Botao variante="fantasma" onClick={onFechar} className="max-md:flex-1">
              Cancelar
            </Botao>
            <Botao variante="primario" onClick={salvar} disabled={!ed.alterado || ed.salvando} className="max-md:flex-[2]">
              {ed.salvando ? "Salvando…" : "Salvar checklist"}
            </Botao>
          </div>
        </>
      }
    >
      {padrao && (
        <p className="text-[12px]">
          <NotaProvisoria texto="lista genérica, a confirmar com a oficina" />
        </p>
      )}
      <div className={`${SUPERFICIE} shrink-0 overflow-hidden outline-none`} data-foco-inicial tabIndex={-1}>
        <CorpoEditorChecklist ed={ed} podeEditar compacto />
      </div>
      <p className="text-[12px] text-tinta-suave">Item já usado não se apaga: desative para tirar da conferência sem perder o histórico das OS.</p>
    </Gaveta>
  );

  const parar = { onCancel: (e: SyntheticEvent) => e.stopPropagation(), onSubmit: (e: SyntheticEvent) => e.stopPropagation() };
  return createPortal(
    <div className="contents" {...parar}>
      {gaveta}
    </div>,
    document.body,
  );
}

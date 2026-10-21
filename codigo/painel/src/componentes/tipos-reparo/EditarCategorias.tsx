import { useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import type { TipoReparo } from "@compartilhado/tipos";
import { Botao, SUPERFICIE } from "../ui/Basicos";
import { Aviso } from "../ui/Campos";
import { Gaveta } from "../ui/Gaveta";
import { FormTipoReparo } from "./FormTipoReparo";
import { ListaCategorias } from "./ListaCategorias";

/**
 * Gaveta "Editar categorias" (pedido do dono, sprint SI), aberta do passo Dados do Receber o carro: a lista
 * das categorias com Editar (FormTipoReparo com o tipo), Arquivar/Reativar e "Criar nova categoria" no rodapé.
 * Abre por cima de outra gaveta (portal no <body>, como o FormTipoReparo). A lista vem por props e se atualiza
 * sozinha quando as consultas são invalidadas; `onCriado` deixa quem abriu marcar a categoria nova.
 */
export function EditarCategorias({
  tipos,
  onFechar,
  onCriado,
}: {
  tipos: TipoReparo[];
  onFechar: () => void;
  onCriado?: (t: TipoReparo) => void;
}) {
  const [form, setForm] = useState<{ tipo?: TipoReparo } | null>(null);
  const [retorno, setRetorno] = useState<{ ok?: string; erro?: string }>({});

  const gaveta = (
    <Gaveta
      titulo="Categorias de serviço"
      descricao="Cada categoria gera as etapas da produção. Mudanças valem para os próximos carros."
      onFechar={onFechar}
      fundoCorpo="papel"
      rodape={
        <>
          {(retorno.ok || retorno.erro) && <Aviso tom={retorno.erro ? "alerta" : "ok"}>{retorno.erro ?? retorno.ok}</Aviso>}
          <div className="flex items-center gap-2">
            <Botao variante="fantasma" onClick={onFechar} className="max-md:flex-1">
              Fechar
            </Botao>
            <span className="flex-1 max-md:hidden" />
            <Botao
              variante="contorno"
              icone="mais"
              aria-haspopup="dialog"
              onClick={() => {
                setRetorno({});
                setForm({});
              }}
              className="max-md:flex-[2]"
            >
              Criar nova categoria
            </Botao>
          </div>
        </>
      }
    >
      <div className={`${SUPERFICIE} shrink-0 overflow-hidden outline-none`} data-foco-inicial tabIndex={-1}>
        <ListaCategorias
          tipos={tipos}
          podeEditar
          compacta
          onEditar={(t) => {
            setRetorno({});
            setForm({ tipo: t });
          }}
          onRetorno={setRetorno}
        />
      </div>
      <p className="text-[12px] text-tinta-suave">As OS que já entraram mantêm as etapas de quando foram recebidas. Arquivar só vale para categoria sem carro em aberto.</p>
      {form && (
        <FormTipoReparo
          inicial={form.tipo}
          existentes={tipos}
          onFechar={() => setForm(null)}
          onSalvo={(t) => {
            setRetorno({ ok: form.tipo ? `Categoria ${t.nome} atualizada.` : `Categoria ${t.nome} criada.` });
            if (!form.tipo) onCriado?.(t);
            setForm(null);
          }}
        />
      )}
    </Gaveta>
  );

  // mesmo cuidado do FormTipoReparo: Esc e envio daqui não chegam à gaveta de baixo
  const parar = { onCancel: (e: SyntheticEvent) => e.stopPropagation(), onSubmit: (e: SyntheticEvent) => e.stopPropagation() };
  return createPortal(
    <div className="contents" {...parar}>
      {gaveta}
    </div>,
    document.body,
  );
}

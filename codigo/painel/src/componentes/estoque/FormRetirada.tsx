import { useState } from "react";
import type { Id, Material, Perfil } from "@compartilhado/tipos";
import { formatarReais } from "@compartilhado/dominio/dinheiro";
import { mensagemErro, useAcoes } from "../../dados/hooks";
import { Gaveta } from "../ui/Gaveta";
import { Ajuda, AreaTexto, CLASSE_ENTRADA, CampoComAfixo, LinhaPrevia, OpcoesEmGrade, Previa, Rotulado, Selecao } from "../ui/Campos";
import { formatarQtd, lerQuantidade, marcoDoDia } from "../financeiro/formato";
import { GrupoFiltros } from "../ui/Filtros";
import { OpcoesMateriais } from "./OpcoesMateriais";

type Tipo = "consumo_interno" | "ajuste";

/**
 * Retirada sem OS (consumo interno da oficina) ou ajuste de estoque (+/−, motivo obrigatório).
 * A retirada para uma OS é lançada na ficha da OS, para entrar no custo do carro.
 */
export function FormRetirada({
  materiais,
  perfis,
  materialInicial,
  tipoInicial = "consumo_interno",
  hoje,
  veDinheiro,
  onFechar,
  onFeito,
}: {
  materiais: Material[];
  perfis: Perfil[];
  materialInicial?: Id;
  tipoInicial?: Tipo;
  hoje: string;
  veDinheiro: boolean;
  onFechar: () => void;
  onFeito: (mensagem: string) => void;
}) {
  const acoes = useAcoes();
  const [tipo, setTipo] = useState<Tipo>(tipoInicial);
  const [materialId, setMaterialId] = useState<Id>(materialInicial ?? "");
  const [quantidade, setQuantidade] = useState("");
  const [sentido, setSentido] = useState<"mais" | "menos" | "">("");
  const [perfilId, setPerfilId] = useState<Id>("");
  const [data, setData] = useState(hoje);
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState<string>();

  const material = materiais.find((m) => m.id === materialId);
  const q = lerQuantidade(quantidade);
  const sinal = tipo === "consumo_interno" ? -1 : sentido === "mais" ? 1 : sentido === "menos" ? -1 : 0;
  const novoSaldo = material && q !== null && q > 0 && sinal !== 0 ? material.saldoEstimado + sinal * q : null;
  const falta = novoSaldo !== null && novoSaldo < 0;
  const ativos = perfis.filter((p) => p.ativo && p.papel !== "dispositivo");

  async function enviar() {
    setErro(undefined);
    if (!material) return setErro("Escolha o material.");
    if (q === null || q <= 0) return setErro(mensagemErro("quantidade_invalida"));
    if (tipo === "ajuste" && !sentido) return setErro(mensagemErro("sentido_obrigatorio"));
    if (tipo === "ajuste" && !obs.trim()) return setErro(mensagemErro("motivo_obrigatorio"));
    if (falta) return setErro(mensagemErro("saldo_insuficiente"));
    if (!data || data > hoje) return setErro("Informe a data (hoje ou antes).");
    try {
      const r = await acoes.movimentarEstoque.mutateAsync([
        {
          tipo,
          materialId: material.id,
          quantidade: q,
          sentido: tipo === "ajuste" ? (sentido as "mais" | "menos") : undefined,
          perfilId: perfilId || undefined,
          obs: obs.trim() || undefined,
          em: marcoDoDia(data, hoje),
        },
      ]);
      if (!r.ok) return setErro(mensagemErro(r.codigo));
      onFeito(
        tipo === "ajuste"
          ? `Ajuste de ${sinal > 0 ? "+" : "−"}${formatarQtd(q)} ${material.unidade} em ${material.nome} registrado.`
          : `Retirada de ${formatarQtd(q)} ${material.unidade} de ${material.nome} registrada.`,
      );
    } catch {
      setErro(mensagemErro());
    }
  }

  return (
    <Gaveta
      titulo={tipo === "ajuste" ? "Ajuste de estoque" : "Retirada para consumo interno"}
      descricao={tipo === "ajuste" ? "Corrige o saldo depois de uma contagem. O custo médio não muda." : "Material usado pela oficina, fora de uma OS."}
      acao={tipo === "ajuste" ? "Registrar ajuste" : "Registrar retirada"}
      onFechar={onFechar}
      onEnviar={enviar}
      enviando={acoes.movimentarEstoque.isPending}
      erro={erro}
    >
      <GrupoFiltros<Tipo>
        rotulo="Tipo de movimentação"
        mostrarRotulo={false}
        valor={tipo}
        onMudar={setTipo}
        opcoes={[
          { valor: "consumo_interno", texto: "Consumo interno" },
          { valor: "ajuste", texto: "Ajuste (contagem)" },
        ]}
      />

      <Ajuda>
        Retirada para um carro é lançada na <strong className="font-semibold text-tinta">ficha da OS</strong>, em Custos: assim o material entra no custo
        daquela OS.
      </Ajuda>

      <Rotulado rotulo="Material">
        <Selecao value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
          <option value="">Escolha o material…</option>
          <OpcoesMateriais materiais={materiais.filter((m) => m.ativo !== false || m.id === materialId || tipo === "ajuste")} />
        </Selecao>
      </Rotulado>

      {tipo === "ajuste" && (
        <OpcoesEmGrade
          nome="sentido"
          legenda="Sentido"
          opcoes={(
            [
              ["mais", "Somar ao estoque", "+"],
              ["menos", "Tirar do estoque", "−"],
            ] as const
          ).map(([v, texto, sinal]) => ({
            valor: v,
            texto: (
              <>
                <span className="numero text-tinta-suave mr-1">{sinal}</span>
                {texto}
              </>
            ),
          }))}
          valor={sentido}
          onMudar={setSentido}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Rotulado rotulo="Quantidade">
          <CampoComAfixo
            inputMode="decimal"
            autoComplete="off"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            sufixo={material?.unidade}
            placeholder="0"
            aria-invalid={falta || undefined}
          />
        </Rotulado>
        <Rotulado rotulo="Data">
          <input type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value)} className={`${CLASSE_ENTRADA} numero`} />
        </Rotulado>
      </div>

      <Rotulado rotulo={tipo === "ajuste" ? "Responsável pela contagem" : "Quem retirou"} opcional={tipo === "ajuste"}>
        <Selecao value={perfilId} onChange={(e) => setPerfilId(e.target.value)}>
          <option value="">Não informado</option>
          {ativos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
              {p.funcao ? ` — ${p.funcao}` : ""}
            </option>
          ))}
        </Selecao>
      </Rotulado>

      <Rotulado
        rotulo={tipo === "ajuste" ? "Motivo" : "Para quê"}
        opcional={tipo !== "ajuste"}
        dica={tipo === "ajuste" ? "Obrigatório. Ex.: contagem mensal, avaria, vencido." : "Ex.: limpeza da área de entrega."}
      >
        <AreaTexto value={obs} onChange={(e) => setObs(e.target.value)} rows={2} required={tipo === "ajuste"} />
      </Rotulado>

      {material && (
        <Previa titulo="Depois da movimentação">
          <LinhaPrevia rotulo="Saldo">
            <span className="text-tinta-suave">{formatarQtd(material.saldoEstimado)}</span>
            {" → "}
            <strong className={`font-semibold ${falta ? "text-alerta" : ""}`}>
              {novoSaldo !== null ? formatarQtd(novoSaldo) : "—"} {material.unidade}
            </strong>
          </LinhaPrevia>
          {falta && (
            <p role="alert" className="text-[13px] font-medium text-alerta py-1">
              {mensagemErro("saldo_insuficiente")}
            </p>
          )}
          {veDinheiro && tipo === "consumo_interno" && q !== null && q > 0 && (
            <LinhaPrevia rotulo="Custo da saída (custo médio)">{formatarReais(Math.round(q * material.custoMedio))}</LinhaPrevia>
          )}
          {novoSaldo !== null && !falta && novoSaldo < material.saldoMinimo && (
            <p className="text-[13px] text-atencao py-1">
              Fica abaixo do mínimo ({formatarQtd(material.saldoMinimo)} {material.unidade}) e entra na lista de reposição.
            </p>
          )}
        </Previa>
      )}
    </Gaveta>
  );
}

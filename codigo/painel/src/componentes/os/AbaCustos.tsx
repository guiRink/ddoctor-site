import { useId, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import type { CustoOS, Material, Perfil } from "@compartilhado/tipos";
import { custoMaoDeObra, totalCusto, type ModoMaoDeObra } from "@compartilhado/dominio/custos";
import { formatarReais, reaisParaCentavos, somaCentavos } from "@compartilhado/dominio/dinheiro";
import { situacaoMaterial } from "@compartilhado/dominio/estoque";
import { dataNoFuso } from "@compartilhado/dominio/fuso";
import { formatarDuracao } from "@compartilhado/dominio/tempos";
import { mensagemErro, useAcoes, useFornecedores, useMateriais } from "../../dados/hooks";
import type { NovoCustoOS, OSVisao } from "../../dados/repositorio";
import { TIPO_CUSTO_OS } from "../../dominio/rotulos";
import { Botao, Cartao, Erro, FaixaIndicadores, Indicador } from "../ui/Basicos";
import { CLASSE_LINHA, CLASSE_TH } from "../ui/Tabela";
import { nomePerfil } from "../ui/Carro";
import { Icone } from "../Icone";
import { dataCurta } from "../orcamentos/formato";
import { Aviso, CLASSE_CAMPO, CampoComAfixo, Grupo, Segmentado, Selecao } from "../ui/Campos";
import { descritoPor, lerDecimal, qtd } from "./formato";

/**
 * Aba Custos (só dono, gestor e financeiro — veCustosOS): insumos retirados do estoque, mão de obra e
 * terceiros/outros. Cada bloco tem o formulário em cima e a lista embaixo; o total fica na faixa do topo.
 * Remover um insumo devolve a quantidade ao estoque (o repositório cuida disso).
 */
export function AbaCustos({ v, perfis, podeLancar }: { v: OSVisao; perfis: Perfil[]; podeLancar: boolean }) {
  const custos = v.custos;
  const insumos = custos.filter((c) => c.tipo === "insumo");
  const mao = custos.filter((c) => c.tipo === "mao_de_obra");
  const outros = custos.filter((c) => c.tipo === "terceiro" || c.tipo === "outro");
  const soma = (l: CustoOS[]) => somaCentavos(l.map((c) => c.total));
  const ativa = v.os.estado !== "cancelada" && podeLancar;
  const equipe = perfis.filter((p) => p.ativo && p.papel !== "dispositivo").sort((a, b) => ordemPapel(a) - ordemPapel(b) || a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <div className="flex flex-col gap-6">
      <FaixaIndicadores colunas={4}>
        <Indicador rotulo="Insumos" valor={formatarReais(soma(insumos))} detalhe={plural(insumos.length, "retirada")} />
        <Indicador rotulo="Mão de obra" valor={formatarReais(soma(mao))} detalhe={plural(mao.length, "apontamento")} />
        <Indicador rotulo="Terceiros e outros" valor={formatarReais(soma(outros))} detalhe={plural(outros.length, "lançamento")} />
        <Indicador rotulo="Total de custos" valor={formatarReais(soma(custos))} detalhe={custos.length === 0 ? "nada lançado ainda" : undefined} />
      </FaixaIndicadores>

      <Cartao titulo="Insumos do estoque" contagem={insumos.length}>
        {ativa && <FormInsumo osId={v.os.id} equipe={equipe} />}
        <ListaCustos tipo="insumo" custos={insumos} perfis={perfis} podeRemover={ativa} vazio="Nenhum insumo retirado para esta OS." />
      </Cartao>

      <Cartao titulo="Mão de obra" contagem={mao.length}>
        {ativa && <FormMaoDeObra osId={v.os.id} equipe={equipe} />}
        <ListaCustos tipo="mao_de_obra" custos={mao} perfis={perfis} podeRemover={ativa} vazio="Nenhuma mão de obra apontada." />
      </Cartao>

      <Cartao titulo="Terceiros e outros" contagem={outros.length}>
        {ativa && <FormTerceiro osId={v.os.id} />}
        <ListaCustos tipo="terceiro" custos={outros} perfis={perfis} podeRemover={ativa} vazio="Nenhum serviço de terceiro ou outro custo." />
      </Cartao>
    </div>
  );
}

const ORDEM_PAPEL: Record<string, number> = { producao: 0, gestor: 1, dono: 2, recepcao: 3, financeiro: 4 };
const ordemPapel = (p: Perfil) => ORDEM_PAPEL[p.papel] ?? 9;
const plural = (n: number, palavra: string) => `${n} ${palavra}${n === 1 ? "" : "s"}`;

// ------------------------------------------------------------------ envio comum

function useLancar(osId: string) {
  const acoes = useAcoes();
  const [aviso, setAviso] = useState<{ tom: "ok" | "alerta"; texto: string } | null>(null);
  async function lancar(custo: NovoCustoOS, sucesso: string): Promise<boolean> {
    setAviso(null);
    try {
      const r = await acoes.lancarCusto.mutateAsync([osId, custo]);
      if (!r.ok) {
        setAviso({ tom: "alerta", texto: mensagemErro(r.codigo) });
        return false;
      }
      setAviso({ tom: "ok", texto: sucesso });
      return true;
    } catch {
      setAviso({ tom: "alerta", texto: mensagemErro() });
      return false;
    }
  }
  return { lancar, aviso, setAviso, enviando: acoes.lancarCusto.isPending };
}

function Faixa({ onSubmit, children, aviso }: { onSubmit: (e: FormEvent) => void; children: ReactNode; aviso: { tom: "ok" | "alerta"; texto: string } | null }) {
  return (
    <form onSubmit={onSubmit} noValidate className="px-4 py-4 bg-cinza-50 border-b border-linha flex flex-col gap-3">
      {children}
      {aviso && <Aviso tom={aviso.tom}>{aviso.texto}</Aviso>}
    </form>
  );
}

function SelecaoFuncionario({ id, equipe, valor, onMudar }: { id: string; equipe: Perfil[]; valor: string; onMudar: (v: string) => void }) {
  return (
    <Grupo id={id} rotulo="Funcionário" opcional>
      <Selecao id={id} value={valor} onChange={(e) => onMudar(e.target.value)}>
        <option value="">Não informado</option>
        {equipe.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
            {p.funcao ? ` · ${p.funcao}` : ""}
          </option>
        ))}
      </Selecao>
    </Grupo>
  );
}

// ------------------------------------------------------------------ insumo

function FormInsumo({ osId, equipe }: { osId: string; equipe: Perfil[] }) {
  const materiais = useMateriais();
  const id = useId();
  const [material, setMaterial] = useState<Material | null>(null);
  const [quantidade, setQuantidade] = useState("");
  const [perfilId, setPerfilId] = useState("");
  const [erros, setErros] = useState<{ material?: string; quantidade?: string }>({});
  const { lancar, aviso, enviando } = useLancar(osId);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const q = lerDecimal(quantidade);
    const novos: typeof erros = {};
    if (!material) novos.material = "Escolha o material.";
    if (q === null || q <= 0) novos.quantidade = mensagemErro("quantidade_invalida");
    else if (material && q > material.saldoEstimado) novos.quantidade = mensagemErro("saldo_insuficiente");
    setErros(novos);
    if (!material || novos.material || novos.quantidade || q === null) return;
    const ok = await lancar(
      { tipo: "insumo", materialId: material.id, quantidade: q, perfilId: perfilId || undefined },
      `${qtd(q)} ${material.unidade} de ${material.nome} retirado(s) do estoque.`,
    );
    if (ok) {
      setMaterial(null);
      setQuantidade("");
    }
  }

  if (materiais.isError) return <div className="p-4 border-b border-linha"><Erro mensagem="Não consegui carregar o estoque." onTentar={() => materiais.refetch()} /></div>;

  const q = lerDecimal(quantidade);
  const previa = material && q && q > 0 ? totalCusto(q, material.custoMedio) : null;

  return (
    <Faixa onSubmit={enviar} aviso={aviso}>
      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,140px)_minmax(0,1fr)_auto] items-start">
        <BuscaMaterial
          id={`${id}-mat`}
          materiais={(materiais.data ?? []).filter((m) => m.ativo !== false)}
          carregando={materiais.isPending}
          valor={material}
          onMudar={(m) => {
            setMaterial(m);
            setErros((x) => ({ ...x, material: undefined }));
          }}
          erro={erros.material}
        />
        <Grupo id={`${id}-q`} rotulo="Quantidade" erro={erros.quantidade}>
          <CampoComAfixo
            id={`${id}-q`}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            sufixo={material?.unidade}
            value={quantidade}
            onChange={(e) => {
              setQuantidade(e.target.value);
              setErros((x) => ({ ...x, quantidade: undefined }));
            }}
            aria-invalid={Boolean(erros.quantidade)}
            aria-describedby={descritoPor(`${id}-q`, erros.quantidade)}
          />
        </Grupo>
        <SelecaoFuncionario id={`${id}-f`} equipe={equipe} valor={perfilId} onMudar={setPerfilId} />
        <div className="md:pt-[26px]">
          <Botao type="submit" variante="contorno" icone="mais" disabled={enviando} className="w-full md:w-auto">
            {enviando ? "Retirando…" : "Retirar do estoque"}
          </Botao>
        </div>
      </div>
      {previa !== null && (
        <p className="text-[13px] text-tinta-suave numero">
          Custo desta retirada: <span className="font-semibold text-tinta">{formatarReais(previa)}</span> ({qtd(q!)} × {formatarReais(material!.custoMedio)}/{material!.unidade}, custo médio)
        </p>
      )}
    </Faixa>
  );
}

/** Busca de material com saldo e unidade visíveis (combobox com lista). */
function BuscaMaterial({
  id,
  materiais,
  carregando,
  valor,
  onMudar,
  erro,
}: {
  id: string;
  materiais: Material[];
  carregando: boolean;
  valor: Material | null;
  onMudar: (m: Material | null) => void;
  erro?: string;
}) {
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const termo = texto.trim().toLowerCase();
  const achados = materiais
    .filter((m) => !termo || [m.nome, m.codigo, m.marca, m.categoria].some((c) => c?.toLowerCase().includes(termo)))
    .slice(0, 8);
  const lista = `${id}-lista`;

  function escolher(m: Material) {
    onMudar(m);
    setTexto("");
    setAberto(false);
  }

  function teclas(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAberto(true);
      setAtivo((i) => Math.min(achados.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && aberto && achados[ativo]) {
      e.preventDefault();
      escolher(achados[ativo]);
    } else if (e.key === "Escape" && aberto) {
      e.stopPropagation();
      setAberto(false);
    }
  }

  const dica = valor ? (
    <>
      Saldo{" "}
      <span className={`numero font-medium ${situacaoMaterial(valor) === "normal" ? "text-tinta" : "text-alerta"}`}>
        {qtd(valor.saldoEstimado)} {valor.unidade}
      </span>{" "}
      · custo médio <span className="numero">{formatarReais(valor.custoMedio)}</span>/{valor.unidade}
    </>
  ) : undefined;

  return (
    <Grupo id={id} rotulo="Material" erro={erro} dica={dica}>
      {valor ? (
        <div className={`${CLASSE_CAMPO} flex items-center justify-between gap-2 pr-1`}>
          <span className="truncate font-medium">{valor.nome}</span>
          <button
            type="button"
            id={id}
            onClick={() => onMudar(null)}
            aria-label={`Trocar o material ${valor.nome}`}
            className="shrink-0 h-8 px-2 rounded-controle text-[13px] font-medium text-tinta-suave hover:text-tinta hover:bg-cinza-100"
          >
            Trocar
          </button>
        </div>
      ) : (
        <div className="relative">
          <span className="relative flex">
            <Icone nome="busca" tamanho={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-fraca" />
            <input
              id={id}
              role="combobox"
              aria-expanded={aberto}
              aria-controls={lista}
              aria-autocomplete="list"
              aria-activedescendant={aberto && achados[ativo] ? `${lista}-${achados[ativo].id}` : undefined}
              aria-invalid={Boolean(erro)}
              aria-describedby={descritoPor(id, erro)}
              autoComplete="off"
              placeholder={carregando ? "Carregando o estoque…" : "Buscar por nome ou código"}
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setAberto(true);
                setAtivo(0);
              }}
              onFocus={() => setAberto(true)}
              onBlur={() => setTimeout(() => setAberto(false), 120)}
              onKeyDown={teclas}
              className={`${CLASSE_CAMPO} pl-9`}
            />
          </span>
          {aberto && !carregando && (
            <ul
              id={lista}
              role="listbox"
              aria-label="Materiais"
              className="absolute z-20 left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-cartao border border-linha rounded-cartao elevacao py-1"
            >
              {achados.length === 0 ? (
                <li className="px-3 py-2.5 text-[13px] text-tinta-suave">Nenhum material encontrado. Cadastre em Estoque.</li>
              ) : (
                achados.map((m, i) => {
                  const sit = situacaoMaterial(m);
                  return (
                    <li
                      key={m.id}
                      id={`${lista}-${m.id}`}
                      role="option"
                      aria-selected={i === ativo}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => escolher(m)}
                      onMouseEnter={() => setAtivo(i)}
                      className={`flex items-center justify-between gap-3 px-3 min-h-11 cursor-pointer ${i === ativo ? "bg-cinza-100" : ""}`}
                    >
                      <span className="min-w-0">
                        <span className="block text-[14px] font-medium truncate">{m.nome}</span>
                        <span className="block text-[12px] text-tinta-suave truncate">
                          {[m.codigo, m.marca, m.categoria].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className={`shrink-0 text-[13px] numero ${sit === "sem_estoque" ? "text-alerta font-medium" : sit === "critico" ? "text-atencao font-medium" : "text-tinta-suave"}`}>
                        {qtd(m.saldoEstimado)} {m.unidade}
                      </span>
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </div>
      )}
    </Grupo>
  );
}

// ------------------------------------------------------------------ mão de obra

/** "1:30" | "1h30" | "1 h" → 90; "45" → 45 (minutos). Inválido → null. */
function lerTempo(texto: string): number | null {
  const t = texto.trim().toLowerCase().replace(/\s/g, "");
  if (!t) return null;
  let m = /^(\d+):(\d{1,2})$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d+)h(\d{1,2})?(min)?$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0);
  m = /^(\d+)(min)?$/.exec(t);
  if (m) return Number(m[1]);
  return null;
}

const MODOS: { valor: ModoMaoDeObra; texto: string; valorRotulo: string }[] = [
  { valor: "hora", texto: "Por hora", valorRotulo: "Valor da hora" },
  { valor: "minuto", texto: "Por minuto", valorRotulo: "Valor do minuto" },
  { valor: "fixo", texto: "Valor fixo", valorRotulo: "Valor" },
];

function FormMaoDeObra({ osId, equipe }: { osId: string; equipe: Perfil[] }) {
  const id = useId();
  const [perfilId, setPerfilId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [modo, setModo] = useState<ModoMaoDeObra>("hora");
  const [tempo, setTempo] = useState("");
  const [valor, setValor] = useState("");
  const [erros, setErros] = useState<{ tempo?: string; valor?: string; descricao?: string }>({});
  const { lancar, aviso, enviando } = useLancar(osId);

  const minutos = modo === "fixo" ? 0 : lerTempo(tempo);
  const centavos = reaisParaCentavos(valor);
  let previa: number | null = null;
  if (centavos !== null && centavos >= 0 && minutos !== null) {
    try {
      previa = custoMaoDeObra({ modo, minutos, valorUnitario: centavos });
    } catch {
      previa = null;
    }
  }
  const nome = equipe.find((p) => p.id === perfilId)?.nome;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const novos: typeof erros = {};
    if (modo !== "fixo" && (minutos === null || minutos <= 0)) novos.tempo = mensagemErro("minutos_invalidos");
    if (centavos === null || centavos <= 0) novos.valor = mensagemErro("valor_invalido");
    const desc = descricao.trim() || (nome ? `Mão de obra — ${nome}` : "");
    if (!desc) novos.descricao = "Informe a descrição ou escolha o funcionário.";
    setErros(novos);
    if (Object.keys(novos).length > 0 || centavos === null) return;
    const ok = await lancar(
      { tipo: "mao_de_obra", descricao: desc, perfilId: perfilId || undefined, modo, minutos: minutos ?? 0, valorUnitario: centavos },
      `Mão de obra lançada: ${previa !== null ? formatarReais(previa) : desc}.`,
    );
    if (ok) {
      setDescricao("");
      setTempo("");
    }
  }

  const modoAtual = MODOS.find((m) => m.valor === modo)!;

  return (
    <Faixa onSubmit={enviar} aviso={aviso}>
      <div className="grid gap-3 md:grid-cols-2 items-start">
        <SelecaoFuncionario id={`${id}-f`} equipe={equipe} valor={perfilId} onMudar={setPerfilId} />
        <Grupo id={`${id}-d`} rotulo="Descrição" erro={erros.descricao} opcional={Boolean(perfilId)}>
          <input
            id={`${id}-d`}
            value={descricao}
            maxLength={120}
            placeholder={nome ? `Mão de obra — ${nome}` : "Ex.: desmontagem e montagem da porta"}
            onChange={(e) => {
              setDescricao(e.target.value);
              setErros((x) => ({ ...x, descricao: undefined }));
            }}
            aria-invalid={Boolean(erros.descricao)}
            aria-describedby={descritoPor(`${id}-d`, erros.descricao)}
            className={CLASSE_CAMPO}
          />
        </Grupo>
      </div>
      <div className="grid gap-3 md:grid-cols-[auto_minmax(0,160px)_minmax(0,180px)_1fr] items-start">
        <Segmentado nome={`${id}-modo`} legenda="Cobrança" valor={modo} onMudar={setModo} opcoes={MODOS.map((m) => ({ valor: m.valor, texto: m.texto }))} />
        {modo !== "fixo" ? (
          <Grupo id={`${id}-t`} rotulo="Tempo" erro={erros.tempo} dica={!erros.tempo && minutos ? formatarDuracao(minutos) : "h:mm ou minutos"}>
            <input
              id={`${id}-t`}
              value={tempo}
              inputMode="numeric"
              autoComplete="off"
              placeholder="1:30"
              onChange={(e) => {
                setTempo(e.target.value);
                setErros((x) => ({ ...x, tempo: undefined }));
              }}
              aria-invalid={Boolean(erros.tempo)}
              aria-describedby={descritoPor(`${id}-t`, erros.tempo, "dica")}
              className={`${CLASSE_CAMPO} numero`}
            />
          </Grupo>
        ) : (
          <span className="hidden md:block" />
        )}
        <Grupo id={`${id}-v`} rotulo={modoAtual.valorRotulo} erro={erros.valor}>
          <CampoComAfixo
            id={`${id}-v`}
            prefixo="R$"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={valor}
            onChange={(e) => {
              setValor(e.target.value);
              setErros((x) => ({ ...x, valor: undefined }));
            }}
            aria-invalid={Boolean(erros.valor)}
            aria-describedby={descritoPor(`${id}-v`, erros.valor)}
          />
        </Grupo>
        <div className="flex items-center justify-between md:justify-end gap-4 md:pt-[26px]">
          <span className="text-[13px] text-tinta-suave numero" aria-live="polite">
            Total <span className="text-[15px] font-semibold text-tinta">{previa !== null ? formatarReais(previa) : "—"}</span>
          </span>
          <Botao type="submit" variante="contorno" icone="mais" disabled={enviando}>
            {enviando ? "Lançando…" : "Lançar"}
          </Botao>
        </div>
      </div>
    </Faixa>
  );
}

// ------------------------------------------------------------------ terceiros e outros

function FormTerceiro({ osId }: { osId: string }) {
  const id = useId();
  const fornecedores = useFornecedores();
  const [tipo, setTipo] = useState<"terceiro" | "outro">("terceiro");
  const [descricao, setDescricao] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [valor, setValor] = useState("");
  const [erros, setErros] = useState<{ descricao?: string; valor?: string }>({});
  const { lancar, aviso, enviando } = useLancar(osId);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const centavos = reaisParaCentavos(valor);
    const novos: typeof erros = {};
    if (!descricao.trim()) novos.descricao = mensagemErro("descricao_obrigatoria");
    if (centavos === null || centavos <= 0) novos.valor = mensagemErro("valor_invalido");
    setErros(novos);
    if (Object.keys(novos).length > 0 || centavos === null) return;
    const ok = await lancar(
      { tipo, descricao: descricao.trim(), custoUnitario: centavos, fornecedor: fornecedor.trim() || undefined },
      `${TIPO_CUSTO_OS[tipo]} lançado: ${descricao.trim()}, ${formatarReais(centavos)}.`,
    );
    if (ok) {
      setDescricao("");
      setFornecedor("");
      setValor("");
    }
  }

  return (
    <Faixa onSubmit={enviar} aviso={aviso}>
      <Segmentado
        nome={`${id}-tipo`}
        legenda="Tipo"
        valor={tipo}
        onMudar={setTipo}
        opcoes={[
          { valor: "terceiro", texto: "Terceirizado" },
          { valor: "outro", texto: "Outro custo" },
        ]}
      />
      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,160px)_auto] items-start">
        <Grupo id={`${id}-d`} rotulo="Descrição" erro={erros.descricao}>
          <input
            id={`${id}-d`}
            value={descricao}
            maxLength={120}
            placeholder={tipo === "terceiro" ? "Ex.: pintura do para-choque na funilaria parceira" : "Ex.: frete da peça"}
            onChange={(e) => {
              setDescricao(e.target.value);
              setErros((x) => ({ ...x, descricao: undefined }));
            }}
            aria-invalid={Boolean(erros.descricao)}
            aria-describedby={descritoPor(`${id}-d`, erros.descricao)}
            className={CLASSE_CAMPO}
          />
        </Grupo>
        <Grupo id={`${id}-fo`} rotulo="Fornecedor" opcional>
          <input
            id={`${id}-fo`}
            list={`${id}-fo-lista`}
            value={fornecedor}
            maxLength={80}
            autoComplete="off"
            onChange={(e) => setFornecedor(e.target.value)}
            className={CLASSE_CAMPO}
          />
          <datalist id={`${id}-fo-lista`}>
            {(fornecedores.data ?? []).map((f) => (
              <option key={f.id} value={f.nome} />
            ))}
          </datalist>
        </Grupo>
        <Grupo id={`${id}-v`} rotulo="Valor" erro={erros.valor}>
          <CampoComAfixo
            id={`${id}-v`}
            prefixo="R$"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={valor}
            onChange={(e) => {
              setValor(e.target.value);
              setErros((x) => ({ ...x, valor: undefined }));
            }}
            aria-invalid={Boolean(erros.valor)}
            aria-describedby={descritoPor(`${id}-v`, erros.valor)}
          />
        </Grupo>
        <div className="md:pt-[26px]">
          <Botao type="submit" variante="contorno" icone="mais" disabled={enviando} className="w-full md:w-auto">
            {enviando ? "Lançando…" : "Lançar"}
          </Botao>
        </div>
      </div>
    </Faixa>
  );
}

// ------------------------------------------------------------------ lista de custos

type TipoLista = "insumo" | "mao_de_obra" | "terceiro";

function ListaCustos({
  tipo,
  custos,
  perfis,
  podeRemover,
  vazio,
}: {
  tipo: TipoLista;
  custos: CustoOS[];
  perfis: Perfil[];
  podeRemover: boolean;
  vazio: string;
}) {
  const acoes = useAcoes();
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tom: "ok" | "alerta"; texto: string } | null>(null);

  if (custos.length === 0) {
    return (
      <>
        {aviso && <div className="px-4 pt-3"><Aviso tom={aviso.tom}>{aviso.texto}</Aviso></div>}
        <p className="px-4 py-4 text-[13px] text-tinta-suave">{vazio}</p>
      </>
    );
  }

  async function remover(c: CustoOS) {
    setAviso(null);
    try {
      const r = await acoes.removerCusto.mutateAsync([c.id]);
      if (!r.ok) {
        setAviso({ tom: "alerta", texto: mensagemErro(r.codigo) });
        return;
      }
      setConfirmando(null);
      setAviso({
        tom: "ok",
        texto: c.tipo === "insumo" ? `${c.descricao} removido; ${qtd(c.quantidade)} ${c.unidade ?? ""} devolvido(s) ao estoque.` : `${c.descricao} removido.`,
      });
    } catch {
      setAviso({ tom: "alerta", texto: mensagemErro() });
    }
  }

  const quem = (c: CustoOS) => nomePerfil(perfis, c.perfilId) ?? <span className="text-tinta-fraca">—</span>;
  const quando = (c: CustoOS) => dataCurta(dataNoFuso(c.lancadoEm));
  const total = somaCentavos(custos.map((c) => c.total));

  const acao = (c: CustoOS) =>
    podeRemover &&
    (confirmando === c.id ? (
      <span className="inline-flex items-center gap-1">
        <Botao tamanho="denso" variante="perigo" onClick={() => remover(c)} disabled={acoes.removerCusto.isPending}>
          {c.tipo === "insumo" ? "Devolver" : "Remover"}
        </Botao>
        <Botao tamanho="denso" variante="fantasma" icone="fechar" aria-label="Manter o lançamento" onClick={() => setConfirmando(null)} />
      </span>
    ) : (
      <button
        type="button"
        onClick={() => setConfirmando(c.id)}
        aria-label={`Remover ${c.descricao}${c.tipo === "insumo" ? " (devolve ao estoque)" : ""}`}
        className="inline-grid place-items-center w-11 h-11 md:w-9 md:h-9 rounded-controle text-tinta-fraca hover:text-alerta hover:bg-alerta-claro transition-colors duration-150"
      >
        <Icone nome="fechar" tamanho={16} />
      </button>
    ));

  const colunas: { titulo: string; direita?: boolean; celula: (c: CustoOS) => ReactNode; esconder?: boolean }[] =
    tipo === "insumo"
      ? [
          { titulo: "Data", celula: quando },
          { titulo: "Funcionário", celula: quem },
          { titulo: "Material", celula: (c) => <span className="font-medium">{c.descricao}</span> },
          { titulo: "Qtd", direita: true, celula: (c) => `${qtd(c.quantidade)} ${c.unidade ?? ""}` },
          { titulo: "Custo un.", direita: true, celula: (c) => formatarReais(c.custoUnitario) },
        ]
      : tipo === "mao_de_obra"
        ? [
            { titulo: "Data", celula: quando },
            { titulo: "Funcionário", celula: quem },
            { titulo: "Descrição", celula: (c) => <span className="font-medium">{c.descricao}</span> },
            { titulo: "Tempo", direita: true, celula: (c) => (c.minutos ? formatarDuracao(c.minutos) : "valor fixo") },
            { titulo: "Valor un.", direita: true, celula: (c) => (c.minutos ? `${formatarReais(c.custoUnitario)}${c.unidade === "min" ? "/min" : "/h"}` : "—") },
          ]
        : [
            { titulo: "Data", celula: quando },
            { titulo: "Tipo", celula: (c) => TIPO_CUSTO_OS[c.tipo] },
            { titulo: "Descrição", celula: (c) => <span className="font-medium">{c.descricao}</span> },
            { titulo: "Fornecedor", celula: (c) => c.fornecedor ?? <span className="text-tinta-fraca">—</span> },
          ];

  return (
    <>
      {aviso && <div className="px-4 pt-3"><Aviso tom={aviso.tom}>{aviso.texto}</Aviso></div>}
      {/* desktop: tabela */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse text-[14px]">
          <caption className="sr-only">Lançamentos: {tipo === "insumo" ? "insumos" : tipo === "mao_de_obra" ? "mão de obra" : "terceiros e outros"}</caption>
          <thead>
            <tr>
              {colunas.map((c) => (
                <th key={c.titulo} scope="col" className={`${CLASSE_TH} ${c.direita ? "text-right" : "text-left"} first:pl-4`}>
                  {c.titulo}
                </th>
              ))}
              <th scope="col" className={`${CLASSE_TH} text-right`}>Total</th>
              {podeRemover && <th scope="col" className={`${CLASSE_TH} w-12 pr-4`}><span className="sr-only">Ações</span></th>}
            </tr>
          </thead>
          <tbody>
            {custos.map((c) => (
              <tr key={c.id} className={CLASSE_LINHA}>
                {colunas.map((col) => (
                  <td key={col.titulo} className={`h-12 px-3 first:pl-4 ${col.direita ? "text-right numero whitespace-nowrap" : ""} ${col.titulo === "Data" ? "numero text-tinta-suave whitespace-nowrap" : ""}`}>
                    {col.celula(c)}
                  </td>
                ))}
                <td className="h-12 px-3 text-right numero font-medium whitespace-nowrap">{formatarReais(c.total)}</td>
                {podeRemover && <td className="h-12 pl-1 pr-3 text-right whitespace-nowrap">{acao(c)}</td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-linha">
              <td colSpan={colunas.length} className="h-11 pl-4 px-3 text-[13px] font-medium text-tinta-suave">
                Subtotal
              </td>
              <td className="h-11 px-3 text-right numero font-semibold whitespace-nowrap">{formatarReais(total)}</td>
              {podeRemover && <td />}
            </tr>
          </tfoot>
        </table>
      </div>
      {/* celular: lista */}
      <ul className="md:hidden divide-y divide-linha">
        {custos.map((c) => (
          <li key={c.id} className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium break-words">{c.descricao}</p>
              <p className="text-[12px] text-tinta-suave numero">
                {quando(c)} · {nomePerfil(perfis, c.perfilId) ?? (c.fornecedor || TIPO_CUSTO_OS[c.tipo])}
                {c.tipo === "insumo" && (
                  <>
                    {" · "}
                    <span className="whitespace-nowrap">
                      {qtd(c.quantidade)} {c.unidade ?? ""} × {formatarReais(c.custoUnitario)}
                    </span>
                  </>
                )}
                {c.tipo === "mao_de_obra" && c.minutos ? ` · ${formatarDuracao(c.minutos)}` : ""}
              </p>
            </div>
            <span className="numero font-semibold whitespace-nowrap pt-0.5">{formatarReais(c.total)}</span>
            {acao(c)}
          </li>
        ))}
        <li className="flex items-center justify-between px-4 h-11 text-[13px]">
          <span className="font-medium text-tinta-suave">Subtotal</span>
          <span className="numero font-semibold">{formatarReais(total)}</span>
        </li>
      </ul>
    </>
  );
}

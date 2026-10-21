// Gera os seeds a partir do MESMO código do painel (fonte única):
//   seed/producao.sql — só o padrão da oficina (oficina, config provisória, checklist, tipos de reparo, categorias, pagadores).
//   seed/teste.sql    — os dados FICTÍCIOS do gerarDemo() (codigo/painel/src/dados/demo.ts) para o projeto ddoctor-teste.
// Uso (de codigo/): node supabase/scripts/gerar-seed-teste.ts   (ou npx tsx supabase/scripts/gerar-seed-teste.ts)
// Precisa do painel instalado (codigo/painel/node_modules): o demo é carregado pelo Vite do painel, que resolve o alias
// @compartilhado e o import.meta.env.BASE_URL.
//
// Ids: o demo usa ids de texto ("os-1", "p-diego"); o banco usa uuid. uid(texto) = uuid determinístico (sha1, formato v5),
// então o mesmo demo gera sempre os mesmos uuids e o producao.sql e o teste.sql casam (tipos, categorias, pagadores).
// Datas: o teste.sql fica RELATIVO ao momento em que roda (pg_temp.m(segundos) / pg_temp.d(dias) a partir de now()),
// então o exemplo continua fazendo sentido em qualquer dia. Repositório público: nada aqui é dado real.
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raizSupabase = join(aqui, "..");
const painel = join(raizSupabase, "..", "painel");

// ---------------------------------------------------------------- carregar o demo pelo Vite do painel
const requirePainel = createRequire(join(painel, "package.json"));
const vite = await import(pathToFileURL(requirePainel.resolve("vite")).href);
const servidor = await vite.createServer({
  root: painel,
  configFile: join(painel, "vite.config.ts"),
  logLevel: "error",
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: "custom",
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Qualquer = any;
let demoMod: Qualquer;
let configMod: Qualquer;
try {
  demoMod = await servidor.ssrLoadModule("/src/dados/demo.ts");
  configMod = await servidor.ssrLoadModule("@compartilhado/dominio/config");
} finally {
  await servidor.close();
}

const agoraMs = Date.now();
const demo: Qualquer = demoMod.gerarDemo(agoraMs);
const FUSO = "America/Sao_Paulo";

// ---------------------------------------------------------------- utilitários

/** uuid determinístico a partir do id de texto do demo (sha1, bits de versão 5). */
export function uid(texto: string): string {
  const h = createHash("sha1").update(`ddoctor:${texto}`).digest("hex");
  const v = `5${h.slice(13, 16)}`;
  const variante = ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${v}-${variante}${h.slice(18, 20)}-${h.slice(20, 32)}`;
}
const OFICINA = uid("oficina");

const q = (v: unknown): string => {
  if (v === undefined || v === null || v === "") return "null";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  return `'${String(v).replace(/'/g, "''")}'`;
};
const j = (v: unknown): string => (v === undefined || v === null ? "null" : `${q(JSON.stringify(v))}::jsonb`);
const id = (v: string | undefined | null): string => (v ? `'${uid(v)}'` : "null");

/** Dia de negócio (AAAA-MM-DD) do demo no fuso da oficina. */
function diaNoFuso(ms: number): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
  return p; // en-CA já sai AAAA-MM-DD
}
const hojeDemo = diaNoFuso(agoraMs);
const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/** Marco (timestamptz) relativo: pg_temp.m(segundos desde agora). */
const m = (marco: string | undefined | null): string => {
  if (!marco) return "null";
  const s = Math.round((Date.parse(marco) - agoraMs) / 1000);
  return `pg_temp.m(${s})`;
};
/** Data relativa: pg_temp.d(dias desde hoje). */
const d = (data: string | undefined | null): string => (data ? `pg_temp.d(${diasEntre(hojeDemo, data.slice(0, 10))})` : "null");
/** Marco relativo formatado como texto do painel, para dentro de jsonb. */
const mt = (marco: string | undefined | null): string => (marco ? `public._marco(${m(marco)}, '${FUSO}')` : "null");

function inserir(tabela: string, colunas: string[], linhas: string[][], conflito = "on conflict (id) do nothing"): string {
  if (!linhas.length) return `-- ${tabela}: nada\n`;
  const valores = linhas.map((l) => `  (${l.join(", ")})`).join(",\n");
  return `insert into public.${tabela} (${colunas.join(", ")}) values\n${valores}\n${conflito};\n`;
}

// ---------------------------------------------------------------- seed de produção (padrão, provisório)

const CONFIG = configMod.CONFIG_PADRAO;
const prod: string[] = [];
prod.push(`-- seed/producao.sql — GERADO por scripts/gerar-seed-teste.ts (não editar à mão).
-- Só o padrão da oficina, tudo PROVISÓRIO (a confirmar com o dono em Ajustes): expediente, semáforo, capacidade,
-- checklist de entrada, tipos de reparo, categorias financeiras e pagadores. Nenhum dado de exemplo.
-- Idempotente: rodar de novo não duplica nem sobrescreve o que o dono já mudou.
select set_config('ddoctor.sem_auditoria', 'on', false);
`);
prod.push(inserir("oficina", ["id", "nome", "fuso", "ultimo_numero_os"], [[q(OFICINA), q("D doctor"), q(FUSO), "0"]]));
prod.push(
  inserir(
    "config_oficina",
    ["oficina_id", "expediente", "semaforo", "capacidade_padrao", "alerta_carro", "checklist", "provisorio", "confirmado"],
    [[q(OFICINA), j(CONFIG.expediente), j(CONFIG.semaforo), j(CONFIG.capacidadePadrao), j(configMod.ALERTA_CARRO_PADRAO), j(configMod.CHECKLIST_PADRAO), "true", "'{}'::jsonb"]],
    "on conflict (oficina_id) do nothing",
  ),
);
prod.push(
  inserir(
    "tipo_reparo",
    ["id", "oficina_id", "nome", "etapas", "provisorio", "ativo", "ordem"],
    demoMod.TIPOS_REPARO_PADRAO.map((t: Qualquer, i: number) => [id(t.id), q(OFICINA), q(t.nome), j(t.etapas), "true", "true", String(i + 1)]),
  ),
);
prod.push(
  inserir(
    "categoria_financeira",
    ["id", "oficina_id", "nome", "tipo", "ativa"],
    configMod.CATEGORIAS_PADRAO.map((c: Qualquer) => [id(c.id), q(OFICINA), q(c.nome), q(c.tipo), "true"]),
  ),
);
prod.push(
  inserir(
    "pagador",
    ["id", "oficina_id", "nome", "tipo", "prazo_dias", "prazo_base", "prazo_dias_uteis", "prazo_provisorio", "desconta_franquia"],
    demo.pagadores.map((p: Qualquer) => [
      id(p.id), q(OFICINA), q(p.nome), q(p.tipo), String(p.prazo.dias), q(p.prazo.base), q(p.prazo.diasUteis), q(p.prazo.provisorio), q(p.descontaFranquia),
    ]),
  ),
);
prod.push(`select set_config('ddoctor.sem_auditoria', 'off', false);\n`);

// ---------------------------------------------------------------- seed de teste (fictício)

const t: string[] = [];
t.push(`-- seed/teste.sql — GERADO por scripts/gerar-seed-teste.ts a partir de gerarDemo() (não editar à mão).
-- DADOS FICTÍCIOS, só para o projeto ddoctor-teste: nomes, placas, telefones, documentos (gerados por dígito
-- verificador), protocolos e valores inventados. Rodar DEPOIS das migrations e do seed/producao.sql.
-- Datas relativas ao momento em que roda. Perfis de exemplo SEM login (auth_user_id null): o seu login de dono
-- vem de definir_primeiro_dono (README). Rodar de novo: apague antes os dados de exemplo (README) ou use um projeto limpo.
select set_config('ddoctor.sem_auditoria', 'on', false);
drop table if exists pg_temp._ancora;
create temp table _ancora as select now() as t0;
create or replace function pg_temp.m(s double precision) returns timestamptz language sql stable as
  $f$ select (select t0 from pg_temp._ancora) + make_interval(secs => s) $f$;
create or replace function pg_temp.d(n integer) returns date language sql stable as
  $f$ select ((select t0 from pg_temp._ancora) at time zone '${FUSO}')::date + n $f$;
`);

const perfis = demo.perfis as Qualquer[];
// usuário fora da regra do banco (validarUsuario: 3–30, [a-z0-9._-]) fica sem usuário no seed, com aviso
const USUARIO_OK = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;
for (const p of perfis) {
  if (p.usuario && (!USUARIO_OK.test(p.usuario) || p.usuario.length < 3 || p.usuario.length > 30 || p.usuario.includes(".."))) {
    console.warn(`aviso: perfil ${p.id} com usuário "${p.usuario}" fora da regra (validarUsuario); vai sem usuário no seed`);
    p.usuario = undefined;
  }
}
t.push(
  inserir(
    "perfil",
    ["id", "oficina_id", "nome", "papel", "funcao", "especialidade", "usuario", "email", "telefone", "admitido_em", "ativo", "usa_terminal"],
    perfis.map((p) => [
      id(p.id), q(OFICINA), q(p.nome), q(p.papel), q(p.funcao), q(p.especialidade), q(p.usuario), q(p.email), q(p.telefone),
      p.admitidoEm ? q(p.admitidoEm) : "null", q(p.ativo), q(p.usaTerminal),
    ]),
  ),
);
t.push(
  inserir(
    "perfil_salario",
    ["oficina_id", "perfil_id", "salario_mensal"],
    perfis.filter((p) => p.salarioMensal !== undefined).map((p) => [q(OFICINA), id(p.id), String(p.salarioMensal)]),
    "on conflict (perfil_id) do nothing",
  ),
);
const comissoes = (demo.config?.comissoes ?? []) as Qualquer[];
t.push(
  inserir(
    "regra_comissao",
    ["id", "oficina_id", "etapa_nome", "tipo_reparo_id", "valor", "ativa", "descricao"],
    comissoes.map((r) => [id(r.id), q(OFICINA), q(r.etapaNome), id(r.tipoReparoId), String(r.valor), q(r.ativa), q(r.descricao)]),
  ),
);

t.push(
  inserir(
    "cliente",
    ["id", "oficina_id", "nome", "tipo_pessoa", "documento", "telefone", "whatsapp", "email", "endereco", "observacoes", "proveniencia", "demo"],
    demo.clientes.map((c: Qualquer) => [
      id(c.id), q(OFICINA), q(c.nome), q(c.tipoPessoa), q(c.documento), q(c.telefone), q(c.whatsapp), q(c.email), j(c.endereco), q(c.observacoes),
      j(c.proveniencia), "true",
    ]),
  ),
);
t.push(
  inserir(
    "veiculo",
    ["id", "oficina_id", "cliente_id", "placa", "marca", "modelo", "cor", "ano", "proveniencia"],
    demo.veiculos.map((v: Qualquer) => [id(v.id), q(OFICINA), id(v.clienteId), q(v.placa), q(v.marca), q(v.modelo), q(v.cor), q(v.ano), j(v.proveniencia)]),
  ),
);
t.push(
  inserir(
    "atendimento_externo",
    ["id", "oficina_id", "fonte", "seguradora", "id_externo", "numero_sinistro", "produto", "status_bruto", "status_normalizado", "abertura_em",
      "limite_vistoria_em", "previsao_portal", "lido_em", "estado_conciliacao"],
    demo.atendimentos.map((a: Qualquer) => [
      id(a.id), q(OFICINA), q(a.fonte), q(a.seguradora), q(a.idExterno), q(a.numeroSinistro), q(a.produto), q(a.statusBruto), q(a.statusNormalizado),
      d(a.aberturaEm), d(a.limiteVistoriaEm), d(a.previsaoPortal), m(a.lidoEm), q(a.estadoConciliacao),
    ]),
  ),
);

/** Recepção com os carimbos relativos (registradaEm/atualizadaEm) e perfis em uuid. */
function recepcaoSql(r: Qualquer): string {
  if (!r) return "null";
  const { registradaEm, atualizadaEm, registradaPor, atualizadaPor, ...resto } = r;
  const extra: string[] = [];
  if (registradaEm) extra.push(`'registradaEm', ${mt(registradaEm)}`);
  if (atualizadaEm) extra.push(`'atualizadaEm', ${mt(atualizadaEm)}`);
  if (registradaPor) extra.push(`'registradaPor', '${uid(registradaPor)}'`);
  if (atualizadaPor) extra.push(`'atualizadaPor', '${uid(atualizadaPor)}'`);
  return extra.length ? `(${j(resto)} || jsonb_build_object(${extra.join(", ")}))` : j(resto);
}

t.push(
  inserir(
    "os",
    ["id", "oficina_id", "numero", "veiculo_id", "cliente_id", "tipo_reparo_id", "origem", "estado", "prioridade", "previsao_entrega", "entrada_real_em",
      "pronta_em", "entregue_em", "box", "observacoes", "recepcao", "alerta", "demo", "criado_em", "atualizado_em"],
    demo.oss.map((o: Qualquer) => [
      id(o.id), q(OFICINA), String(o.numero), id(o.veiculoId), id(o.clienteId), id(o.tipoReparoId), q(o.origem), q(o.estado), String(o.prioridade),
      d(o.previsaoEntrega), m(o.entradaRealEm), m(o.prontaEm), m(o.entregueEm), q(o.box), q(o.observacoes), recepcaoSql(o.recepcao), j(o.alerta), "true",
      m(o.criadoEm), m(o.atualizadoEm),
    ]),
  ),
);
t.push(
  inserir(
    "os_atendimento_externo",
    ["oficina_id", "os_id", "atendimento_externo_id"],
    demo.oss.flatMap((o: Qualquer) => o.atendimentosExternos.map((a: string) => [q(OFICINA), id(o.id), id(a)])),
    "on conflict (os_id, atendimento_externo_id) do nothing",
  ),
);
t.push(
  inserir(
    "orcamento_versao",
    ["id", "oficina_id", "os_id", "tipo", "numero_versao", "fonte", "estado", "teto_cobertura", "franquia", "complemento_particular", "aprovacao_tipo",
      "aprovado_em", "evidencia", "confiavel", "criado_em"],
    demo.versoes.map((v: Qualquer) => [
      id(v.id), q(OFICINA), id(v.osId), q(v.tipo), String(v.numeroVersao), q(v.fonte), q(v.estado), q(v.tetoCobertura), q(v.franquia),
      q(v.complementoParticular), q(v.aprovacao?.tipo), m(v.aprovacao?.aprovadoEm), q(v.aprovacao?.evidencia), q(v.aprovacao?.confiavel), m(v.criadoEm),
    ]),
  ),
);
t.push(
  inserir(
    "item_orcamento",
    ["id", "oficina_id", "versao_id", "ordem", "peca", "tecnica", "descricao", "valor", "status_item"],
    demo.versoes.flatMap((v: Qualquer) =>
      v.itens.map((i: Qualquer, k: number) => [id(i.id), q(OFICINA), id(v.id), String(k + 1), q(i.peca), q(i.tecnica), q(i.descricao), String(i.valor), q(i.statusItem)]),
    ),
  ),
);
t.push(
  inserir(
    "etapa_os",
    ["id", "oficina_id", "os_id", "ordem", "nome", "estado", "responsavel_id", "prazo_horas", "prazo_em", "entrou_fila_em", "iniciada_em", "concluida_em",
      "pecas_previstas", "pecas_feitas", "motivo_dispensa", "exige_foto", "exige_contagem_pecas"],
    demo.etapas.map((e: Qualquer) => [
      id(e.id), q(OFICINA), id(e.osId), String(e.ordem), q(e.nome), q(e.estado), id(e.responsavelId), String(e.prazoHoras), m(e.prazoEm), m(e.entrouFilaEm),
      m(e.iniciadaEm), m(e.concluidaEm), q(e.pecasPrevistas), q(e.pecasFeitas), q(e.motivoDispensa), q(e.exigeFoto), q(Boolean(e.exigeContagemPecas)),
    ]),
  ),
);
t.push(
  inserir(
    "bloqueio_etapa",
    ["id", "oficina_id", "etapa_id", "inicio_em", "fim_em", "motivo"],
    demo.etapas.flatMap((e: Qualquer) =>
      e.bloqueios.map((b: Qualquer, k: number) => [id(`${e.id}-bl${k}`), q(OFICINA), id(e.id), m(b.inicioEm), m(b.fimEm), q(b.motivo)]),
    ),
  ),
);
t.push(
  inserir(
    "agendamento",
    ["id", "oficina_id", "os_id", "data", "janela", "estado", "origem", "expira_em", "substitui_id", "motivo_cancelamento"],
    demo.agendamentos.map((a: Qualquer) => [
      id(a.id), q(OFICINA), id(a.osId), d(a.data), q(a.janela), q(a.estado), q(a.origem), m(a.expiraEm), id(a.substituiId), q(a.motivoCancelamento),
    ]),
  ),
);
t.push(
  inserir(
    "capacidade_dia",
    ["oficina_id", "data", "vagas_entrada", "bloqueado"],
    demo.capacidades.map((c: Qualquer) => [q(OFICINA), d(c.data), String(c.vagasEntrada), q(c.bloqueado)]),
    "on conflict (oficina_id, data) do nothing",
  ),
);
t.push(
  inserir(
    "foto",
    ["id", "oficina_id", "os_id", "etapa_id", "fase", "legenda", "url_externa", "autor_id", "origem", "tirada_em"],
    demo.fotos.map((f: Qualquer) => [id(f.id), q(OFICINA), id(f.osId), id(f.etapaId), q(f.fase), q(f.legenda), q(f.url), id(f.autorId), q(f.origem), m(f.tiradaEm)]),
  ),
);
t.push(
  inserir(
    "pendencia_externa",
    ["id", "oficina_id", "os_id", "tipo", "descricao", "estado", "responsavel_id", "criada_em", "concluida_em"],
    demo.pendencias.map((p: Qualquer) => [id(p.id), q(OFICINA), id(p.osId), q(p.tipo), q(p.descricao), q(p.estado), id(p.responsavelId), m(p.criadaEm), m(p.concluidaEm)]),
  ),
);
t.push(
  inserir(
    "titulo_receber",
    ["id", "oficina_id", "os_id", "pagador_id", "descricao", "valor", "nf_numero", "nf_emitida_em", "vencimento", "estado"],
    demo.titulos.map((x: Qualquer) => [
      id(x.id), q(OFICINA), id(x.osId), id(x.pagadorId), q(x.descricao), String(x.valor), q(x.nfNumero), d(x.nfEmitidaEm), d(x.vencimento), q(x.estado),
    ]),
  ),
);
t.push(
  inserir(
    "baixa",
    ["id", "oficina_id", "titulo_id", "valor", "recebido_em", "forma", "parcelas", "obs"],
    demo.titulos.flatMap((x: Qualquer) =>
      x.baixas.map((b: Qualquer) => [id(b.id), q(OFICINA), id(x.id), String(b.valor), d(b.recebidoEm), q(b.forma), q(b.parcelas), q(b.obs)]),
    ),
  ),
);
t.push(
  inserir(
    "despesa",
    ["id", "oficina_id", "categoria_id", "categoria", "descricao", "fornecedor", "valor_previsto", "vencimento", "pago_em", "valor_pago", "forma_pagamento", "obs"],
    demo.despesas.map((x: Qualquer) => [
      id(x.id), q(OFICINA), id(x.categoriaId), q(x.categoria), q(x.descricao), q(x.fornecedor), String(x.valorPrevisto), d(x.vencimento), d(x.pagoEm),
      q(x.valorPago), q(x.formaPagamento), q(x.obs),
    ]),
  ),
);
t.push(
  inserir(
    "fornecedor",
    ["id", "oficina_id", "nome", "documento", "telefone", "email", "obs", "demo"],
    demo.fornecedores.map((f: Qualquer) => [id(f.id), q(OFICINA), q(f.nome), q(f.documento), q(f.telefone), q(f.email), q(f.obs), "true"]),
  ),
);
t.push(
  inserir(
    "material",
    ["id", "oficina_id", "nome", "codigo", "marca", "categoria", "unidade", "saldo_estimado", "saldo_minimo", "ultima_conferencia_em", "custo_medio",
      "fornecedor_id", "ativo"],
    demo.materiais.map((x: Qualquer) => [
      id(x.id), q(OFICINA), q(x.nome), q(x.codigo), q(x.marca), q(x.categoria), q(x.unidade), String(x.saldoEstimado), String(x.saldoMinimo),
      d(x.ultimaConferenciaEm), String(x.custoMedio), id(x.fornecedorId), q(x.ativo !== false),
    ]),
  ),
);
t.push(
  inserir(
    "movimento_estoque",
    ["id", "oficina_id", "material_id", "tipo", "quantidade", "sentido", "custo_unitario", "os_id", "perfil_id", "fornecedor_id", "obs", "em"],
    demo.movimentos.map((x: Qualquer) => [
      id(x.id), q(OFICINA), id(x.materialId), q(x.tipo), String(x.quantidade), q(x.sentido), q(x.custoUnitario), id(x.osId), id(x.perfilId), id(x.fornecedorId),
      q(x.obs), m(x.em),
    ]),
  ),
);
const movIds = new Set((demo.movimentos as Qualquer[]).map((x) => x.id));
t.push(
  inserir(
    "custo_os",
    ["id", "oficina_id", "os_id", "tipo", "descricao", "quantidade", "unidade", "custo_unitario", "total", "material_id", "movimento_id", "perfil_id", "minutos",
      "fornecedor", "lancado_em", "lancado_por"],
    demo.custos.map((c: Qualquer) => [
      id(c.id), q(OFICINA), id(c.osId), q(c.tipo), q(c.descricao), String(c.quantidade), q(c.unidade), String(c.custoUnitario), String(c.total), id(c.materialId),
      movIds.has(`mv-${c.id}`) ? id(`mv-${c.id}`) : "null", id(c.perfilId), q(c.minutos), q(c.fornecedor), m(c.lancadoEm), id(c.lancadoPor),
    ]),
  ),
);
t.push(
  inserir(
    "fechamento_caixa",
    ["id", "oficina_id", "data", "saldo_inicial", "contado", "entradas_dinheiro", "saidas_dinheiro", "esperado", "diferenca", "obs", "fechado_por", "fechado_em"],
    demo.fechamentos.map((f: Qualquer) => [
      id(f.id), q(OFICINA), d(f.data), String(f.saldoInicial), String(f.contado), String(f.entradasDinheiro), String(f.saidasDinheiro), String(f.esperado),
      String(f.diferenca), q(f.obs), id(f.fechadoPor), m(f.fechadoEm),
    ]),
  ),
);
const pagamentosFolha = (demo.pagamentosFolha ?? demo.folha ?? []) as Qualquer[];
t.push(
  inserir(
    "pagamento_folha",
    ["id", "oficina_id", "perfil_id", "mes", "salario", "comissoes", "ajustes", "total", "pago_em", "despesa_id", "obs"],
    pagamentosFolha.map((p) => [
      id(p.id), q(OFICINA), id(p.perfilId), q(p.mes), String(p.salario), String(p.comissoes), q(p.ajustes), String(p.total), d(p.pagoEm), id(p.despesaId), q(p.obs),
    ]),
  ),
);
t.push(
  inserir(
    "evento_auditoria",
    ["id", "oficina_id", "tabela", "registro_id", "acao", "resumo", "perfil_id", "origem", "em"],
    demo.auditoria.map((a: Qualquer) => [id(a.id), q(OFICINA), q(a.entidade), id(a.entidadeId), q(a.acao), q(a.resumo), id(a.perfilId), q("app"), m(a.em)]),
  ),
);
t.push(`update public.oficina set ultimo_numero_os = greatest(ultimo_numero_os, ${demo.seqOS}) where id = '${OFICINA}';
select set_config('ddoctor.sem_auditoria', 'off', false);
drop function if exists pg_temp.m(double precision);
drop function if exists pg_temp.d(integer);
`);

writeFileSync(join(raizSupabase, "seed", "producao.sql"), prod.join("\n"));
writeFileSync(join(raizSupabase, "seed", "teste.sql"), t.join("\n"));
console.log(
  `seed/producao.sql e seed/teste.sql gerados: ${demo.oss.length} OS, ${demo.clientes.length} clientes, ${demo.perfis.length} perfis, ` +
    `${demo.materiais.length} materiais, ${demo.movimentos.length} movimentos (oficina ${OFICINA}).`,
);

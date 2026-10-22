import { describe, expect, it } from "vitest";
import { ACAO_AUDITORIA, ERRO } from "../dominio/rotulos";
import { caminhoFoto, codigoDoErro, deEtapa, deOS, deTitulo, deVersao, etapasDeProducao, type LinhaOS, type LinhaProducao } from "./mapeamento";
import { comoResultado } from "./repositorioSupabase";
import { codigoDoLogin } from "./autenticacao";

import edgeEquipeLogin from "../../../supabase/functions/equipe-login/index.ts?raw";

// texto das migrations (Vite lê como string): os códigos que o banco devolve
const SQL = Object.values(import.meta.glob<string>("../../../supabase/migrations/*.sql", { query: "?raw", import: "default", eager: true })).join("\n");

describe("codigoDoErro (PostgREST → código do painel)", () => {
  it("permissão, rede e sessão", () => {
    expect(codigoDoErro({ code: "42501", message: "new row violates row-level security policy" })).toBe("sem_permissao");
    expect(codigoDoErro({ message: "TypeError: Failed to fetch" })).toBe("sem_conexao");
    expect(codigoDoErro({ code: "PGRST301", message: "JWT expired" })).toBe("sem_sessao");
    expect(codigoDoErro(null)).toBe("erro_desconhecido");
    expect(codigoDoErro({ code: "XX000", message: "algo" })).toBe("erro_desconhecido");
  });

  it("regra do banco: a mensagem é o código (DD001) e imutáveis (DD002)", () => {
    expect(codigoDoErro({ code: "DD001", message: "saldo_so_por_movimento" })).toBe("saldo_so_por_movimento");
    expect(codigoDoErro({ code: "DD001", message: "ultimo_dono" })).toBe("ultimo_dono");
    expect(codigoDoErro({ code: "DD002", message: "registro_imutavel: baixa não aceita UPDATE" })).toBe("registro_imutavel");
  });

  it("constraint violada → o nome dela (ou o código equivalente)", () => {
    expect(codigoDoErro({ code: "23505", message: 'duplicate key value violates unique constraint "placa_duplicada"' })).toBe("placa_duplicada");
    expect(codigoDoErro({ code: "23505", message: 'duplicate key value violates unique constraint "fornecedor_documento_duplicado"' })).toBe("documento_duplicado");
    expect(codigoDoErro({ code: "23514", message: 'new row for relation "cliente" violates check constraint "whatsapp_invalido"' })).toBe("telefone_invalido");
    expect(codigoDoErro({ code: "23514", message: "sem nome" })).toBe("valor_invalido");
    expect(codigoDoErro({ code: "23503", message: 'violates foreign key constraint "veiculo_cliente_id_fkey"' })).toBe("registro_relacionado");
  });

  it("todo código que o banco e a Edge Function devolvem tem mensagem em pt-BR", () => {
    const sql = SQL;
    expect(sql).toContain("create or replace function public.agendar");
    const doBanco = [...sql.matchAll(/_(?:erro|falha)\('([a-z_]+)'/g), ...sql.matchAll(/raise exception '([a-z_]+)'/g)].map((m) => m[1]);
    const daEdge = [...edgeEquipeLogin.matchAll(/codigo: "([a-z_]+)"/g)].map((m) => m[1]);
    expect(daEdge).toContain("usuario_em_uso");
    // nomes de constraint/índice único que viram código direto (codigoDoErro devolve o nome ou o equivalente)
    const constraints = [...sql.matchAll(/constraint ([a-z_]+) check/g), ...sql.matchAll(/unique index if not exists ([a-z_]+) on/g)].map((m) => m[1]);
    // guardas internas de cálculo e o exemplo "_erro('codigo')" do comentário de 0005
    const ignorar = new Set(["expediente_sem_dias_uteis", "horas_invalidas", "dias_invalidos", "codigo"]);
    const faltam = [...new Set([...doBanco, ...daEdge, ...constraints])]
      .map((c) => codigoDoErro({ code: "23505", message: `constraint "${c}"` }))
      .filter((c) => !ignorar.has(c) && !ERRO[c]);
    expect(faltam).toEqual([]);
  });

  it("ações gravadas pelas funções do banco têm rótulo na auditoria", () => {
    const sql = SQL;
    const acoes = [...new Set([...sql.matchAll(/_auditar\('([a-z_]+)'/g)].map((m) => m[1]))];
    expect(acoes.filter((a) => !ACAO_AUDITORIA[a])).toEqual([]);
    for (const a of ["dispensar_etapa", "atribuir", "primeiro_dono"]) expect(ACAO_AUDITORIA[a]).toBeTruthy();
  });
});

describe("resposta das funções e do login", () => {
  it("comoResultado limpa campos vazios e garante o código da falha", () => {
    expect(comoResultado({ ok: true, id: "x", codigo: null })).toEqual({ ok: true, id: "x" });
    expect(comoResultado({ ok: false, codigo: "sem_vaga", campo: "" })).toEqual({ ok: false, codigo: "sem_vaga" });
    expect(comoResultado({ ok: false, codigo: "valor_invalido", campo: "vagasEntrada" })).toEqual({ ok: false, codigo: "valor_invalido", campo: "vagasEntrada" });
    expect(comoResultado({ ok: false })).toEqual({ ok: false, codigo: "erro_desconhecido" });
    expect(comoResultado(null)).toEqual({ ok: false, codigo: "erro_desconhecido" });
    expect(comoResultado({ ok: true, caminhos: ["a", "b"] })).toEqual({ ok: true, caminhos: ["a", "b"] });
  });

  it("codigoDoLogin traduz os erros do Supabase Auth", () => {
    expect(codigoDoLogin({ code: "invalid_credentials", status: 400, message: "Invalid login credentials" })).toBe("login_invalido");
    expect(codigoDoLogin({ message: "Invalid login credentials" })).toBe("login_invalido");
    expect(codigoDoLogin({ code: "user_banned", status: 400, message: "User is banned" })).toBe("login_bloqueado");
    expect(codigoDoLogin({ status: 429, message: "Request rate limit reached" })).toBe("muitas_tentativas");
    expect(codigoDoLogin({ name: "AuthRetryableFetchError", message: "Failed to fetch" })).toBe("sem_conexao");
    for (const c of ["login_invalido", "login_bloqueado", "muitas_tentativas", "sem_conexao", "usuario_ou_email_invalido", "senha_obrigatoria"]) expect(ERRO[c]).toBeTruthy();
  });
});

describe("conversores", () => {
  const linhaOS: LinhaOS = {
    id: "os-1",
    numero: 7,
    veiculo_id: "v-1",
    cliente_id: "c-1",
    tipo_reparo_id: null,
    origem: "particular",
    estado: "na_oficina",
    prioridade: 1,
    previsao_entrega: "2026-10-30",
    entrada_real_em: "2026-10-21T12:00:00+00:00",
    pronta_em: null,
    entregue_em: null,
    box: null,
    observacoes: "",
    recepcao: null,
    alerta: null,
    demo: false,
    criado_em: "2026-10-20T13:30:00+00:00",
    atualizado_em: "2026-10-21T12:00:00+00:00",
  };

  it("OS: null vira ausente, marcos no fuso da oficina", () => {
    const os = deOS(linhaOS, ["at-1"]);
    expect(os.entradaRealEm).toBe("2026-10-21T09:00:00-03:00");
    expect(os.criadoEm).toBe("2026-10-20T10:30:00-03:00");
    expect(os.tipoReparoId).toBeUndefined();
    expect(os.prontaEm).toBeUndefined();
    expect(os.atendimentosExternos).toEqual(["at-1"]);
    expect("demo" in os).toBe(false);
  });

  it("versão: itens na ordem e aprovação só com tipo e data", () => {
    const v = deVersao({
      id: "ver-1",
      os_id: "os-1",
      tipo: "interno",
      numero_versao: 2,
      fonte: "manual",
      estado: "aprovado",
      teto_cobertura: null,
      franquia: "50000" as unknown as number,
      complemento_particular: null,
      aprovacao_tipo: "cliente",
      aprovado_em: "2026-10-21T12:00:00+00:00",
      evidencia: "WhatsApp",
      confiavel: true,
      criado_em: "2026-10-21T11:00:00+00:00",
      item_orcamento: [
        { id: "i2", ordem: 2, peca: "Porta", tecnica: "pintura", descricao: null, valor: 30000, status_item: "autorizado" },
        { id: "i1", ordem: 1, peca: "Capô", tecnica: "martelinho", descricao: null, valor: 20000, status_item: "autorizado" },
      ],
    });
    expect(v.itens.map((i) => i.peca)).toEqual(["Capô", "Porta"]);
    expect(v.franquia).toBe(50000);
    expect(v.aprovacao).toEqual({ tipo: "cliente", aprovadoEm: "2026-10-21T09:00:00-03:00", evidencia: "WhatsApp", confiavel: true });
  });

  it("título: baixas em ordem de recebimento", () => {
    const t = deTitulo({
      id: "t1",
      os_id: "os-1",
      pagador_id: "pg",
      descricao: "Particular",
      valor: 100000,
      nf_numero: null,
      nf_emitida_em: null,
      vencimento: "2026-10-30",
      estado: "parcial",
      baixa: [
        { id: "b2", valor: 2000, recebido_em: "2026-10-22", forma: "pix", parcelas: null, obs: null, criado_em: "2026-10-22T10:00:00+00:00" },
        { id: "b1", valor: 1000, recebido_em: "2026-10-21", forma: "dinheiro", parcelas: null, obs: null, criado_em: "2026-10-21T10:00:00+00:00" },
      ],
    });
    expect(t.baixas.map((b) => b.id)).toEqual(["b1", "b2"]);
  });

  it("etapas: bloqueios ordenados; vw_producao no mesmo formato", () => {
    const e = deEtapa({
      id: "e1",
      os_id: "os-1",
      ordem: 1,
      nome: "Pintura",
      estado: "bloqueada",
      responsavel_id: "p-2",
      prazo_horas: 8,
      prazo_em: null,
      entrou_fila_em: "2026-10-21T11:00:00+00:00",
      iniciada_em: "2026-10-21T11:30:00+00:00",
      concluida_em: null,
      pecas_previstas: null,
      pecas_feitas: null,
      motivo_dispensa: null,
      exige_foto: true,
      exige_contagem_pecas: false,
      bloqueio_etapa: [
        { inicio_em: "2026-10-21T15:00:00+00:00", fim_em: null, motivo: "falta peça" },
        { inicio_em: "2026-10-21T12:00:00+00:00", fim_em: "2026-10-21T13:00:00+00:00", motivo: "almoço" },
      ],
    });
    expect(e.bloqueios.map((b) => b.motivo)).toEqual(["almoço", "falta peça"]);
    const p = etapasDeProducao({
      etapas: [{ ...e, iniciadaEm: "2026-10-21T11:30:00+00:00", responsavelId: null, bloqueios: [{ inicioEm: "2026-10-21T15:00:00+00:00", fimEm: null, motivo: "falta peça" }] }],
    } as unknown as LinhaProducao);
    expect(p[0].iniciadaEm).toBe("2026-10-21T08:30:00-03:00");
    expect(p[0].responsavelId).toBeUndefined();
    expect(p[0].bloqueios[0].fimEm).toBeUndefined();
  });

  it("caminho da foto no bucket", () => {
    expect(caminhoFoto("of", "os", "f1")).toBe("of/os/f1.webp");
    expect(caminhoFoto("of", "os", "f1", true)).toBe("of/os/f1.min.webp");
  });
});

import { describe, expect, it, vi } from "vitest";
import { criarRepositorioSupabase, ErroDados, novoUuid } from "./repositorioSupabase";
import { entrar, oficinaTemDono } from "./autenticacao";
import { supabaseFalso, type Op } from "./supabaseFalso";

const ISO = "2026-10-21T12:00:00+00:00";

function linhaOSVisao(extra: Record<string, unknown> = {}) {
  return {
    id: "os-1",
    numero: 12,
    veiculo_id: "v-1",
    cliente_id: "c-1",
    tipo_reparo_id: null,
    origem: "particular",
    estado: "na_oficina",
    prioridade: 0,
    previsao_entrega: "2026-10-30",
    entrada_real_em: ISO,
    pronta_em: null,
    entregue_em: null,
    box: null,
    observacoes: null,
    recepcao: null,
    alerta: null,
    demo: false,
    criado_em: ISO,
    atualizado_em: ISO,
    veiculo: { id: "v-1", cliente_id: "c-1", placa: "ABC1D23", marca: "Fiat", modelo: "Argo", cor: "Prata", ano: null, proveniencia: null },
    cliente: { id: "c-1", nome: "Cliente Exemplo", tipo_pessoa: null, documento: null, telefone: "+5541999990000", whatsapp: null, email: null, endereco: null, observacoes: null, proveniencia: null, demo: false },
    tipo_reparo: null,
    os_atendimento_externo: [],
    orcamento_versao: [],
    etapa_os: [],
    agendamento: [
      { id: "ag-velho", os_id: "os-1", data: "2026-10-01", janela: "manha", estado: "cancelado", origem: "recepcao", expira_em: null, substitui_id: null, motivo_cancelamento: "x" },
      { id: "ag-1", os_id: "os-1", data: "2026-10-22", janela: "tarde", estado: "confirmado", origem: "recepcao", expira_em: null, substitui_id: null, motivo_cancelamento: null },
    ],
    pendencia_externa: [],
    titulo_receber: [],
    foto: [
      foto("f-1", { caminho: "of-1/os-1/f-1.webp", caminho_miniatura: "of-1/os-1/f-1.min.webp" }),
      foto("f-2", { caminho: "of-1/os-1/f-2.webp", removida_em: ISO }),
    ],
    custo_os: [],
    ...extra,
  };
}

function foto(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    os_id: "os-1",
    etapa_id: null,
    fase: "entrada",
    legenda: null,
    caminho: null,
    caminho_miniatura: null,
    url_externa: null,
    bytes: 1000,
    largura: 1600,
    altura: 1200,
    autor_id: "p-1",
    origem: "interna",
    tirada_em: ISO,
    removida_em: null,
    ...extra,
  };
}

const temOp = (ops: Op[], metodo: string, ...args: unknown[]) => ops.some(([m, a]) => m === metodo && JSON.stringify(a.slice(0, args.length)) === JSON.stringify(args));

describe("RepositorioSupabase — leitura", () => {
  it("listarOS (operação): select com embedding, fotos assinadas em lote, removidas fora, agendamento ativo", async () => {
    const { cliente, consultas, balde } = supabaseFalso({ tabelas: { os: { data: [linhaOSVisao()], error: null } } });
    const repo = criarRepositorioSupabase(cliente);
    const [v] = await repo.listarOS();
    expect(v.os.numero).toBe(12);
    expect(v.veiculo.placa).toBe("ABC1D23");
    expect(v.cliente.nome).toBe("Cliente Exemplo");
    expect(v.agendamento?.id).toBe("ag-1");
    expect(v.fotos.map((f) => f.id)).toEqual(["f-1"]);
    expect(v.fotos[0].url).toBe("https://assinada.test/of-1/os-1/f-1.webp?token=x");
    expect(v.fotos[0].miniaturaUrl).toBe("https://assinada.test/of-1/os-1/f-1.min.webp?token=x");
    expect(v.fotos[0].expiraProvisorio).toBe(true);
    expect(balde.createSignedUrls).toHaveBeenCalledTimes(1);
    expect(balde.createSignedUrls.mock.calls[0][1]).toBe(3600);
    const os = consultas.find((c) => c.tabela === "os")!;
    expect(temOp(os.ops, "is", "foto.removida_em", null)).toBe(true);
    // a segunda leitura reaproveita as URLs (cache de ~1 h): a imagem não recarrega a cada refetch
    await repo.listarOS();
    expect(balde.createSignedUrls).toHaveBeenCalledTimes(1);
  });

  it("listarOS (produção): lê vw_producao, sem cliente e sem valores", async () => {
    const { cliente, consultas } = supabaseFalso({
      eu: { id: "p-diego", oficina_id: "of-1", papel: "producao" },
      tabelas: {
        vw_producao: {
          data: [
            {
              id: "os-1",
              numero: 12,
              estado: "na_oficina",
              origem: "maxpar",
              prioridade: 2,
              previsao_entrega: "2026-10-30",
              entrada_real_em: ISO,
              pronta_em: null,
              box: "3",
              alerta: null,
              tipo_reparo_id: "t-1",
              tipo_reparo_nome: "Martelinho",
              veiculo_id: "v-1",
              placa: "ABC1D23",
              marca: null,
              modelo: "Argo",
              cor: null,
              agendada_para: null,
              agendada_janela: null,
              etapas: [],
              pecas: [{ id: "i1", peca: "Capô", tecnica: "martelinho", statusItem: "autorizado" }],
              criado_em: ISO,
              atualizado_em: ISO,
            },
          ],
          error: null,
        },
        tipo_reparo: { data: [{ id: "t-1", nome: "Martelinho", etapas: [], provisorio: false, ativo: true, ordem: 1 }], error: null },
        foto: { data: [foto("f-9", { caminho: "of-1/os-1/f-9.webp" })], error: null },
      },
    });
    const repo = criarRepositorioSupabase(cliente);
    const [v] = await repo.listarOS();
    expect(consultas.some((c) => c.tabela === "os")).toBe(false);
    expect(v.cliente).toEqual({ id: "", nome: "" });
    expect(v.titulos).toEqual([]);
    expect(v.custos).toEqual([]);
    expect(v.versoes[0].itens).toEqual([{ id: "i1", peca: "Capô", tecnica: "martelinho", valor: 0, statusItem: "autorizado" }]);
    expect(v.tipoReparo?.nome).toBe("Martelinho");
    expect(v.os.box).toBe("3");
    expect(v.fotos.map((f) => f.id)).toEqual(["f-9"]);
  });

  it("TV (dispositivo): quadro sem fotos", async () => {
    const { cliente, consultas } = supabaseFalso({ eu: { id: "p-tv", oficina_id: "of-1", papel: "dispositivo" }, tabelas: { vw_producao: { data: [], error: null } } });
    expect(await criarRepositorioSupabase(cliente).listarOS()).toEqual([]);
    expect(consultas.some((c) => c.tabela === "foto")).toBe(false);
  });

  it("sem login ou perfil inativo: a leitura falha com código (a tela mostra Tentar de novo)", async () => {
    await expect(criarRepositorioSupabase(supabaseFalso({ uid: null }).cliente).listarOS()).rejects.toMatchObject({ codigo: "sem_sessao" });
    await expect(
      criarRepositorioSupabase(supabaseFalso({ eu: { id: "p", oficina_id: "of", papel: "dono", ativo: false } }).cliente).listarOS(),
    ).rejects.toBeInstanceOf(ErroDados);
  });

  it("erro do PostgREST na leitura vira ErroDados com o código", async () => {
    const { cliente } = supabaseFalso({ tabelas: { despesa: { data: null, error: { code: "42501", message: "permission denied" } } } });
    await expect(criarRepositorioSupabase(cliente).listarDespesas()).rejects.toMatchObject({ codigo: "sem_permissao" });
  });

  it("listarCapacidade completa os dias sem exceção com a capacidade padrão", async () => {
    const { cliente } = supabaseFalso({
      tabelas: {
        config_oficina: {
          data: { id: "cfg", oficina_id: "of-1", expediente: {}, semaforo: {}, capacidade_padrao: { vagasEntrada: 4, carrosSimultaneos: 12 }, alerta_carro: null, checklist: null, provisorio: true, confirmado: {} },
          error: null,
        },
        capacidade_dia: { data: [{ data: "2026-10-22", vagas_entrada: 2, bloqueado: null }], error: null },
      },
    });
    const dias = await criarRepositorioSupabase(cliente).listarCapacidade("2026-10-21", "2026-10-23");
    expect(dias).toEqual([
      { data: "2026-10-21", vagasEntrada: 4 },
      { data: "2026-10-22", vagasEntrada: 2 },
      { data: "2026-10-23", vagasEntrada: 4 },
    ]);
  });

  it("listarFolha monta a folha com as comissões do banco e recusa sem permissão", async () => {
    const { cliente } = supabaseFalso({
      tabelas: {
        vw_equipe: {
          data: [
            { id: "p-1", oficina_id: "of-1", nome: "Diego", papel: "producao", funcao: "Pintor", especialidade: null, ativo: true, usa_terminal: false, tem_login: true, usuario: "diego", email: null, telefone: null, admitido_em: null, salario_mensal: 280000 },
          ],
          error: null,
        },
      },
      rpc: {
        comissoes_do_mes: { data: [{ perfil_id: "p-1", os_id: "os-1", placa: "ABC1D23", etapa_id: "e-1", etapa: "Pintura", concluida_em: ISO, valor: 4000, regra_id: "r-1" }], error: null },
      },
    });
    const folha = await criarRepositorioSupabase(cliente).listarFolha("2026-10");
    expect(folha.linhas).toHaveLength(1);
    expect(folha.linhas[0]).toMatchObject({ salario: 280000, comissoes: 4000, total: 284000, pago: false });
    expect(folha.comissoes[0]).toMatchObject({ perfilId: "p-1", etapa: "Pintura", valor: 4000, concluidaEm: "2026-10-21T09:00:00-03:00" });

    const negado = supabaseFalso({ rpc: { comissoes_do_mes: { data: null, error: { code: "42501", message: "sem_permissao" } } } });
    await expect(criarRepositorioSupabase(negado.cliente).listarFolha("2026-10")).rejects.toMatchObject({ codigo: "sem_permissao" });
  });
});

describe("RepositorioSupabase — escrita", () => {
  it("funções do banco: parâmetros pela tabela RPC e o resultado do jsonb", async () => {
    const { cliente, falso } = supabaseFalso({
      rpc: {
        iniciar_etapa: { data: { ok: true, id: "e-1" }, error: null },
        agendar: { data: { ok: false, codigo: "sem_vaga" }, error: null },
        salvar_alerta_os: { data: { ok: false, codigo: "valor_invalido", campo: "prazoDiasUteis" }, error: null },
        criar_atendimento_rapido: { data: { ok: false, codigo: "protocolo_duplicado", osId: "os-existente" }, error: null },
      },
    });
    const repo = criarRepositorioSupabase(cliente);
    expect(await repo.iniciarEtapa("e-1", "p-2")).toMatchObject({ ok: true });
    expect(falso.rpc).toHaveBeenCalledWith("iniciar_etapa", { p_etapa: "e-1", p_responsavel: "p-2" });
    expect(await repo.agendar("os-1", "2026-10-22", "manha")).toEqual({ ok: false, codigo: "sem_vaga" });
    expect(falso.rpc).toHaveBeenLastCalledWith("agendar", { p_os: "os-1", p_data: "2026-10-22", p_janela: "manha", p_encaixe: false });
    expect(await repo.salvarAlertaOS("os-1", { prazoDiasUteis: 99 })).toEqual({ ok: false, codigo: "valor_invalido", campo: "prazoDiasUteis" });
    expect(await repo.criarAtendimentoRapido({ placa: "ABC1D23", clienteNome: "X", origem: "maxpar", pecas: [{ peca: "Capô", tecnica: "martelinho" }] })).toEqual({
      ok: false,
      codigo: "protocolo_duplicado",
      osId: "os-existente",
    });
  });

  it("erro de rede ou de permissão na função vira Resultado com código", async () => {
    const { cliente } = supabaseFalso({ rpc: { registrar_entrega: { data: null, error: { message: "TypeError: Failed to fetch" } } } });
    const repo = criarRepositorioSupabase(cliente);
    expect(await repo.registrarEntrega("os-1")).toEqual({ ok: false, codigo: "sem_conexao" });
    expect(await repo.registrarAprovacao("os-1", "ok")).toEqual({ ok: false, codigo: "erro_desconhecido" }); // função não configurada
  });

  it("salvarCliente normaliza antes de gravar e traduz a constraint", async () => {
    let gravado: Record<string, unknown> | undefined;
    const { cliente } = supabaseFalso({
      tabelas: {
        cliente: (ops) => {
          gravado = ops.find(([m]) => m === "insert")?.[1][0] as Record<string, unknown>;
          return { data: [{ id: "c-novo" }], error: null };
        },
      },
    });
    const repo = criarRepositorioSupabase(cliente);
    expect(await repo.salvarCliente({ nome: "  Ana  ", telefone: "(41) 99999-0000", documento: "529.982.247-25" })).toEqual({ ok: true, id: "c-novo" });
    expect(gravado).toMatchObject({ nome: "Ana", telefone: "+5541999990000", documento: "52998224725", tipo_pessoa: "pf" });
    expect(await repo.salvarCliente({ nome: "Ana", telefone: "123" })).toEqual({ ok: false, codigo: "telefone_invalido" });

    const dup = supabaseFalso({ tabelas: { cliente: { data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "documento_duplicado"' } } } });
    expect(await criarRepositorioSupabase(dup.cliente).salvarCliente({ nome: "Ana", documento: "52998224725" })).toEqual({ ok: false, codigo: "documento_duplicado" });
  });

  it("edição sem linha devolvida (RLS ou apagado) → não encontrado; proveniência fica", async () => {
    let atualizado: Record<string, unknown> | undefined;
    const { cliente } = supabaseFalso({
      tabelas: {
        cliente: (ops) => {
          atualizado = ops.find(([m]) => m === "update")?.[1][0] as Record<string, unknown>;
          return { data: [], error: null };
        },
      },
    });
    expect(await criarRepositorioSupabase(cliente).salvarCliente({ id: "c-1", nome: "Ana" })).toEqual({ ok: false, codigo: "cliente_nao_encontrado" });
    expect(atualizado && "proveniencia" in atualizado).toBe(false);
  });

  it("adicionarFoto sobe arquivo e miniatura, registra pela função e devolve a URL assinada", async () => {
    let registrada: Record<string, unknown> | undefined;
    const { cliente, balde } = supabaseFalso({
      rpc: {
        adicionar_foto: (p) => {
          registrada = p.p_foto as Record<string, unknown>;
          return { data: { ok: true, id: (p.p_foto as { id: string }).id }, error: null };
        },
      },
    });
    const arquivo = new Blob([new Uint8Array(2000)], { type: "image/webp" });
    const miniatura = new Blob([new Uint8Array(200)], { type: "image/webp" });
    const r = await criarRepositorioSupabase(cliente).adicionarFoto("os-1", { fase: "durante", etapaId: "e-1", arquivo, miniatura, largura: 1600, altura: 1200 });
    expect(r.ok).toBe(true);
    const id = r.id!;
    expect(balde.upload).toHaveBeenCalledTimes(2);
    expect(balde.upload.mock.calls[0][0]).toBe(`of-1/os-1/${id}.webp`);
    expect(balde.upload.mock.calls[1][0]).toBe(`of-1/os-1/${id}.min.webp`);
    expect(registrada).toMatchObject({ id, fase: "durante", etapaId: "e-1", caminho: `of-1/os-1/${id}.webp`, caminhoMiniatura: `of-1/os-1/${id}.min.webp`, bytes: 2000 });
    expect(r.url).toBe(`https://assinada.test/of-1/os-1/${id}.webp?token=x`);
  });

  it("adicionarFoto: falha da função apaga os arquivos já enviados; foto acima de 2 MB nem sobe", async () => {
    const { cliente, balde } = supabaseFalso({ rpc: { adicionar_foto: { data: { ok: false, codigo: "nao_responsavel" }, error: null } } });
    const repo = criarRepositorioSupabase(cliente);
    const img = (n: number) => new Blob([new Uint8Array(n)], { type: "image/jpeg" });
    expect(await repo.adicionarFoto("os-1", { fase: "durante", etapaId: "e-1", arquivo: img(1000), miniatura: img(100) })).toEqual({ ok: false, codigo: "nao_responsavel" });
    expect(balde.remove).toHaveBeenCalledTimes(1);
    expect(balde.remove.mock.calls[0][0]).toHaveLength(2);
    balde.upload.mockClear();
    expect(await repo.adicionarFoto("os-1", { fase: "entrada", arquivo: img(2 * 1024 * 1024 + 1), miniatura: img(100) })).toEqual({ ok: false, codigo: "foto_acima_limite" });
    expect(await repo.adicionarFoto("os-1", { fase: "entrada", etapaId: "e-1", arquivo: img(10), miniatura: img(10) })).toEqual({ ok: false, codigo: "fase_invalida" });
    expect(balde.upload).not.toHaveBeenCalled();
  });

  it("removerFoto marca pela função e apaga os caminhos devolvidos", async () => {
    const { cliente, balde } = supabaseFalso({ rpc: { remover_foto: { data: { ok: true, id: "f-1", caminhos: ["of-1/os-1/f-1.webp", "of-1/os-1/f-1.min.webp"] }, error: null } } });
    expect(await criarRepositorioSupabase(cliente).removerFoto("f-1")).toEqual({ ok: true });
    expect(balde.remove).toHaveBeenCalledWith(["of-1/os-1/f-1.webp", "of-1/os-1/f-1.min.webp"]);
  });

  it("definirLogin chama a Edge Function e traduz o erro do corpo (4xx)", async () => {
    const perfis = { vw_equipe: { data: [{ id: "p-2", oficina_id: "of-1", nome: "Diego", papel: "producao", funcao: null, especialidade: null, ativo: true, usa_terminal: false, tem_login: false, usuario: null, email: null, telefone: null, admitido_em: null, salario_mensal: null }], error: null } };
    const invoke = vi.fn(async (_nome: string, { body }: { body: unknown }) => {
      const b = body as { usuario: string };
      if (b.usuario === "ocupado") return { data: null, error: Object.assign(new Error("Edge Function returned a non-2xx status code"), { name: "FunctionsHttpError", context: new Response(JSON.stringify({ ok: false, codigo: "usuario_em_uso" }), { status: 409 }) }) };
      return { data: { ok: true, usuario: b.usuario, email: `${b.usuario}@equipe.ddoctor.app` }, error: null };
    });
    const { cliente } = supabaseFalso({ tabelas: perfis, invoke });
    const repo = criarRepositorioSupabase(cliente);
    expect(await repo.definirLogin("p-2", { usuario: "Diego", senha: "segredo-123" })).toEqual({ ok: true, usuario: "diego", email: "diego@equipe.ddoctor.app" });
    expect(invoke).toHaveBeenCalledWith("equipe-login", { body: { acao: "definir", perfilId: "p-2", usuario: "diego", senha: "segredo-123" } });
    expect(await repo.definirLogin("p-2", { usuario: "ocupado", senha: "segredo-123" })).toEqual({ ok: false, codigo: "usuario_em_uso", campo: "usuario" });
    expect(await repo.definirLogin("p-2", { usuario: "diego", senha: "curta" })).toEqual({ ok: false, codigo: "senha_curta", campo: "senha" });
    // 40 letras com acento = 80 bytes: passa do limite de 72 bytes do Auth sem ir ao servidor
    expect(await repo.definirLogin("p-2", { usuario: "diego", senha: "ç".repeat(40) })).toEqual({ ok: false, codigo: "senha_longa", campo: "senha" });
    expect(invoke).toHaveBeenCalledTimes(2);

    const gerente = supabaseFalso({ eu: { id: "p-g", oficina_id: "of-1", papel: "gestor" }, tabelas: perfis, invoke });
    expect(await criarRepositorioSupabase(gerente.cliente).definirLogin("p-2", { usuario: "diego", senha: "segredo-123" })).toEqual({ ok: false, codigo: "sem_permissao" });
  });

  it("Edge Function fora do ar → login_indisponivel; tirar o próprio login → proprio_login", async () => {
    const invoke = vi.fn(async () => ({ data: null, error: Object.assign(new Error("Failed to send a request to the Edge Function"), { name: "FunctionsFetchError" }) }));
    const { cliente } = supabaseFalso({ invoke });
    const repo = criarRepositorioSupabase(cliente);
    expect(await repo.removerLogin("p-outro")).toEqual({ ok: false, codigo: "login_indisponivel" });
    expect(await repo.removerLogin("p-1")).toEqual({ ok: false, codigo: "proprio_login" });
  });

  it("salvarFuncionario desligando alguém com login sincroniza o Auth", async () => {
    const invoke = vi.fn(async () => ({ data: { ok: true }, error: null }));
    const { cliente, falso } = supabaseFalso({
      invoke,
      tabelas: {
        vw_equipe: {
          data: [
            { id: "p-1", oficina_id: "of-1", nome: "Dono", papel: "dono", funcao: null, especialidade: null, ativo: true, usa_terminal: false, tem_login: true, usuario: "dono", email: null, telefone: null, admitido_em: null, salario_mensal: null },
            { id: "p-2", oficina_id: "of-1", nome: "Diego", papel: "producao", funcao: "Pintor", especialidade: null, ativo: true, usa_terminal: false, tem_login: true, usuario: "diego", email: null, telefone: null, admitido_em: null, salario_mensal: 250000 },
          ],
          error: null,
        },
      },
      rpc: { salvar_funcionario: { data: { ok: true, id: "p-2" }, error: null } },
    });
    const r = await criarRepositorioSupabase(cliente).salvarFuncionario({ id: "p-2", nome: "Diego", papel: "producao", funcao: "Pintor", ativo: false, salarioMensal: 250000 });
    expect(r).toEqual({ ok: true, id: "p-2" });
    const enviado = falso.rpc.mock.calls.find(([n]) => n === "salvar_funcionario")![1].p as Record<string, unknown>;
    expect(enviado).toMatchObject({ id: "p-2", nome: "Diego", ativo: false, usuario: "diego", salarioMensal: 250000 });
    expect(invoke).toHaveBeenCalledWith("equipe-login", { body: { acao: "sincronizar", perfilId: "p-2" } });
  });

  it("restaurarDemo é recusado no banco real", async () => {
    await expect(criarRepositorioSupabase(supabaseFalso().cliente).restaurarDemo()).rejects.toMatchObject({ codigo: "so_na_demonstracao" });
  });

  it("tempo real: assina as tabelas da operação e cancela", () => {
    const { cliente, falso } = supabaseFalso();
    const parar = criarRepositorioSupabase(cliente).assinarMudancas!(() => {});
    expect(falso.channel).toHaveBeenCalledTimes(1);
    parar();
    expect(falso.removeChannel).toHaveBeenCalledTimes(1);
  });
});

describe("login", () => {
  it("usuário curto vira o e-mail técnico; texto inválido nem chama o Auth", async () => {
    const { cliente, falso } = supabaseFalso();
    expect(await entrar("Diego", "segredo-123", cliente)).toEqual({ ok: true });
    expect(falso.auth.signInWithPassword).toHaveBeenCalledWith({ email: "diego@equipe.ddoctor.app", password: "segredo-123" });
    expect(await entrar("dono@exemplo.test", "x", cliente)).toEqual({ ok: true });
    expect(falso.auth.signInWithPassword).toHaveBeenLastCalledWith({ email: "dono@exemplo.test", password: "x" });
    expect(await entrar("a b", "x", cliente)).toEqual({ ok: false, codigo: "usuario_ou_email_invalido", campo: "usuario" });
    expect(await entrar("diego", "", cliente)).toEqual({ ok: false, codigo: "senha_obrigatoria", campo: "senha" });
    expect(falso.auth.signInWithPassword).toHaveBeenCalledTimes(2);
  });

  it("senha errada → login_invalido", async () => {
    const { cliente, falso } = supabaseFalso();
    falso.auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: { code: "invalid_credentials", status: 400, message: "Invalid login credentials" } });
    expect(await entrar("diego", "errada", cliente)).toEqual({ ok: false, codigo: "login_invalido" });
  });

  it("oficinaTemDono: lê a RPC oficina_tem_dono; erro ou resposta estranha = null (não sabe)", async () => {
    expect(await oficinaTemDono(supabaseFalso({ rpc: { oficina_tem_dono: { data: false, error: null } } }).cliente)).toBe(false);
    expect(await oficinaTemDono(supabaseFalso({ rpc: { oficina_tem_dono: { data: true, error: null } } }).cliente)).toBe(true);
    expect(await oficinaTemDono(supabaseFalso().cliente)).toBeNull(); // função ausente (PGRST202)
    expect(await oficinaTemDono(supabaseFalso({ rpc: { oficina_tem_dono: { data: "sim", error: null } } }).cliente)).toBeNull();
  });

  it("novoUuid gera uuid v4 mesmo sem crypto.randomUUID", () => {
    expect(novoUuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const original = globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      expect(novoUuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      Object.defineProperty(globalThis.crypto, "randomUUID", { value: original, configurable: true });
    }
  });
});

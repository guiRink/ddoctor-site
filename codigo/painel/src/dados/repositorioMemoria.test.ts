import { beforeEach, describe, expect, it, vi } from "vitest";
import { repositorioMemoria as repo } from "./repositorioMemoria";
import { validarDocumento } from "@compartilhado/dominio/documento";
import { calcularFechamento } from "@compartilhado/dominio/caixa";
import { normalizarFormaPagamento } from "@compartilhado/dominio/pagamentos";
import { LIMITE_AUDITORIA } from "./repositorio";

// Sequências que a revisão QA do sprint SD apontou (docs/qa-sprintSD.md).
const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

async function osPorPlaca(placa: string) {
  const lista = await repo.listarOS();
  return lista.find((v) => v.veiculo.placa === placa)!;
}

describe("repositório em memória", () => {
  beforeEach(async () => {
    localStorage.clear();
    await repo.restaurarDemo();
  });

  it("registrar entrada cancela a proposta da Calia e a OS não volta para a fila", async () => {
    const v = await osPorPlaca("RNA4S66"); // aguardando agendamento com proposta da Calia
    expect(v.agendamento?.estado).toBe("proposto");
    expect((await repo.registrarEntrada(v.os.id, "tr-martelinho")).ok).toBe(true);
    const depois = await repo.obterOS(v.os.id);
    expect(depois?.os.estado).toBe("na_oficina");
    expect(depois?.agendamento).toBeUndefined();
    const ags = (await repo.listarAgendamentos()).filter((a) => a.osId === v.os.id);
    expect(ags.every((a) => a.estado !== "proposto")).toBe(true);
    // cancelar um agendamento antigo dessa OS não rebaixa a OS
    for (const a of ags) await repo.cancelarAgendamento(a.id, "teste");
    expect((await repo.obterOS(v.os.id))?.os.estado).toBe("na_oficina");
  });

  it("cancelar um agendamento confirmado devolve a OS agendada para a fila", async () => {
    const v = await osPorPlaca("SBD7C41");
    expect(v.os.estado).toBe("agendada");
    expect((await repo.cancelarAgendamento(v.agendamento!.id, "Cliente pediu outra semana")).ok).toBe(true);
    expect((await repo.obterOS(v.os.id))?.os.estado).toBe("aguardando_agendamento");
  });

  it("não agenda em data passada nem em dia fechado", async () => {
    const v = await osPorPlaca("SAE5P73");
    expect((await repo.agendar(v.os.id, "2020-01-06", "manha")).codigo).toBe("data_passada");
    // próximo domingo
    const d = new Date(`${hoje()}T12:00:00`);
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
    const domingo = d.toISOString().slice(0, 10);
    expect((await repo.agendar(v.os.id, domingo, "tarde")).codigo).toBe("dia_fechado");
  });

  it("recusa protocolo repetido na mesma seguradora", async () => {
    const r = await repo.criarAtendimentoRapido({
      placa: "ABC1D23",
      clienteNome: "Teste",
      origem: "maxpar",
      seguradora: "HDI",
      protocolo: "18398760",
      pecas: [{ peca: "Capô", tecnica: "martelinho" }],
    });
    expect(r.ok).toBe(false);
    expect(r.codigo).toBe("protocolo_duplicado");
    expect(r.osId).toBeTruthy();
  });

  it("aprovação com conflito aberto com a Maxpar é bloqueada", async () => {
    const v = await osPorPlaca("RHK2C47"); // aguardando aprovação
    // simula conflito vindo da importação
    const estado = JSON.parse(localStorage.getItem("ddoctor.demo.v3")!);
    estado.atendimentos = estado.atendimentos.map((a: { id: string }) => (v.os.atendimentosExternos.includes(a.id) ? { ...a, estadoConciliacao: "conflito" } : a));
    localStorage.setItem("ddoctor.demo.v3", JSON.stringify(estado));
    vi.resetModules();
    const { repositorioMemoria: novo } = await import("./repositorioMemoria");
    expect((await novo.registrarAprovacao(v.os.id, "Vi no portal")).codigo).toBe("conflito_aberto");
  });

  it("concluir a última etapa deixa a OS pronta pela máquina de estados", async () => {
    const v = await osPorPlaca("SCH4A22"); // polimento + higienização, na oficina
    for (let i = 0; i < 10; i++) {
      const etapas = (await repo.obterOS(v.os.id))!.etapas;
      const atual = etapas.find((e) => e.estado === "na_fila" || e.estado === "em_execucao");
      if (!atual) break;
      if (atual.estado === "na_fila") await repo.iniciarEtapa(atual.id, "p-andre");
      expect((await repo.concluirEtapa(atual.id, { temFoto: true, pecasFeitas: 1 })).ok).toBe(true);
    }
    expect((await repo.obterOS(v.os.id))?.os.estado).toBe("pronta");
  });

  // ------------------------------------------------------------ sprint SE
  it("o demo é coerente: documentos válidos, saldo = soma dos movimentos, custos ligados às retiradas", async () => {
    const clientes = await repo.listarClientes();
    for (const { cliente } of clientes) if (cliente.documento) expect(validarDocumento(cliente.documento, cliente.tipoPessoa)).toBe(true);
    expect(clientes.some((c) => c.cliente.tipoPessoa === "pj")).toBe(true);
    expect(clientes.some((c) => c.veiculos.length > 1)).toBe(true);
    const movs = await repo.listarMovimentos();
    for (const m of await repo.listarMateriais()) {
      const soma = movs
        .filter((x) => x.materialId === m.id)
        .reduce((s, x) => s + (x.tipo === "entrada_compra" || x.sentido === "mais" ? 1 : -1) * x.quantidade, 0);
      expect(Math.round(soma * 1000) / 1000).toBe(m.saldoEstimado);
    }
    const oss = await repo.listarOS();
    const insumos = oss.flatMap((v) => v.custos).filter((c) => c.tipo === "insumo");
    expect(insumos.length).toBeGreaterThan(10);
    for (const c of insumos) expect(movs.some((m) => m.id === `mv-${c.id}` && m.tipo === "saida_os")).toBe(true);
  });

  it("insumo baixa o estoque e removerCusto devolve", async () => {
    const v = await osPorPlaca("RAV3K61");
    const antes = (await repo.listarMateriais()).find((m) => m.id === "m-2")!;
    const r = await repo.lancarCusto(v.os.id, { tipo: "insumo", materialId: "m-2", quantidade: 1.5, perfilId: "p-diego" });
    expect(r.ok).toBe(true);
    const depois = (await repo.listarMateriais()).find((m) => m.id === "m-2")!;
    expect(depois.saldoEstimado).toBeCloseTo(antes.saldoEstimado - 1.5, 3);
    const custo = (await repo.obterOS(v.os.id))!.custos.find((c) => c.id === r.id)!;
    expect(custo.custoUnitario).toBe(antes.custoMedio);
    expect(custo.total).toBe(Math.round(1.5 * antes.custoMedio));
    expect((await repo.listarMovimentos()).some((m) => m.id === `mv-${r.id}` && m.osId === v.os.id)).toBe(true);
    expect((await repo.removerCusto(r.id!)).ok).toBe(true);
    expect((await repo.listarMateriais()).find((m) => m.id === "m-2")!.saldoEstimado).toBeCloseTo(antes.saldoEstimado, 3);
    // a retirada continua no extrato e a devolução entra como ajuste "mais" ligado à OS (QA #6)
    const movs = await repo.listarMovimentos();
    expect(movs.some((m) => m.id === `mv-${r.id}` && m.tipo === "saida_os")).toBe(true);
    const dev = movs.find((m) => m.tipo === "ajuste" && m.sentido === "mais" && m.osId === v.os.id && m.materialId === "m-2");
    expect(dev).toMatchObject({ quantidade: 1.5, custoUnitario: antes.custoMedio, obs: `Devolução do insumo da OS nº ${v.os.numero}` });
    expect(movs[0].id).toBe(dev!.id); // mais recente primeiro
    expect((await repo.listarCustosOS(v.os.id)).some((c) => c.id === r.id)).toBe(false);
  });

  it("retirada maior que o saldo é recusada e nada muda", async () => {
    const v = await osPorPlaca("RAV3K61");
    const lixa = (await repo.listarMateriais()).find((m) => m.id === "m-3")!; // sem estoque no demo
    const r = await repo.lancarCusto(v.os.id, { tipo: "insumo", materialId: "m-3", quantidade: lixa.saldoEstimado + 1 });
    expect(r).toMatchObject({ ok: false, codigo: "saldo_insuficiente" });
    expect((await repo.movimentarEstoque({ materialId: "m-3", tipo: "consumo_interno", quantidade: lixa.saldoEstimado + 1 })).codigo).toBe("saldo_insuficiente");
    expect((await repo.listarMateriais()).find((m) => m.id === "m-3")!.saldoEstimado).toBe(lixa.saldoEstimado);
    // entrada de compra recalcula e libera a retirada
    expect((await repo.movimentarEstoque({ materialId: "m-3", tipo: "entrada_compra", quantidade: 50, custoUnitario: 400, fornecedorId: "f-2" })).ok).toBe(true);
    expect((await repo.lancarCusto(v.os.id, { tipo: "insumo", materialId: "m-3", quantidade: 5 })).ok).toBe(true);
  });

  it("mão de obra por hora usa o domínio", async () => {
    const v = await osPorPlaca("RAV3K61");
    const r = await repo.lancarCusto(v.os.id, { tipo: "mao_de_obra", descricao: "Martelinho", modo: "hora", minutos: 90, valorUnitario: 3000 });
    expect(r.ok).toBe(true);
    expect((await repo.listarCustosOS(v.os.id)).find((c) => c.id === r.id)!.total).toBe(4500);
  });

  it("pagamento sem título do cliente cria 'Particular/franquia' e dá baixa", async () => {
    const v = await osPorPlaca("RAV3K61"); // Maxpar na oficina, franquia R$ 160,00, sem título do cliente
    expect(v.titulos.filter((t) => t.pagadorId === "pg-cliente")).toHaveLength(0);
    const r = await repo.registrarPagamentoOS(v.os.id, { valor: 10000, forma: "pix", recebidoEm: hoje() });
    expect(r.ok).toBe(true);
    const t = (await repo.obterOS(v.os.id))!.titulos.find((x) => x.id === r.id)!;
    expect(t.descricao).toBe("Particular/franquia");
    expect(t.valor).toBe(16000);
    expect(t.estado).toBe("parcial");
    // o segundo pagamento usa o mesmo título; acima do saldo é recusado
    expect((await repo.registrarPagamentoOS(v.os.id, { valor: 9000, forma: "dinheiro", recebidoEm: hoje() })).codigo).toBe("baixa_maior_que_saldo");
    const r2 = await repo.registrarPagamentoOS(v.os.id, { valor: 6000, forma: "credito", parcelas: 2, recebidoEm: hoje() });
    expect(r2.id).toBe(r.id);
    expect((await repo.obterOS(v.os.id))!.titulos.find((x) => x.id === r.id)!.estado).toBe("recebido");
    // nada mais a cobrar do cliente: pagamento a mais é recusado e nenhum título novo nasce (QA #7)
    const nTitulos = (await repo.listarTitulos()).length;
    expect((await repo.registrarPagamentoOS(v.os.id, { valor: 100, forma: "pix", recebidoEm: hoje() })).codigo).toBe("os_quitada");
    expect((await repo.listarTitulos()).length).toBe(nTitulos);
  });

  it("documento e placa duplicados são recusados; documento inválido também", async () => {
    const [primeiro] = (await repo.listarClientes()).filter((c) => c.cliente.documento);
    expect((await repo.salvarCliente({ nome: "Outro", documento: primeiro.cliente.documento })).codigo).toBe("documento_duplicado");
    expect((await repo.salvarCliente({ nome: "Outro", documento: "123.456.789-00" })).codigo).toBe("documento_invalido");
    // editar o próprio cadastro com o mesmo documento é permitido
    expect((await repo.salvarCliente({ ...primeiro.cliente, telefone: "(41) 99999-0000" })).ok).toBe(true);
    expect((await repo.obterCliente(primeiro.cliente.id))!.cliente.telefone).toBe("+5541999990000");
    expect((await repo.salvarVeiculo({ placa: "rav-3k61" })).codigo).toBe("placa_duplicada");
    const novo = await repo.salvarVeiculo({ placa: "abc-1d23", clienteId: primeiro.cliente.id, marca: "Fiat" });
    expect(novo.ok).toBe(true);
    expect((await repo.listarVeiculos()).find((v) => v.id === novo.id)!.placa).toBe("ABC1D23");
  });

  it("fechamento de caixa usa só o dinheiro do dia e não fecha duas vezes", async () => {
    const dia = hoje();
    const titulos = await repo.listarTitulos();
    const despesas = await repo.listarDespesas();
    const baixas = titulos.flatMap((t) => t.baixas).filter((b) => b.recebidoEm === dia);
    expect(baixas.some((b) => normalizarFormaPagamento(b.forma) === "dinheiro")).toBe(true);
    const anterior = (await repo.listarFechamentos())[0];
    const esperado = calcularFechamento({ saldoInicial: anterior.contado, contado: 0, titulos, despesas, data: dia });
    // pagamento em pix hoje não entra na gaveta
    const v = await osPorPlaca("RAV3K61");
    await repo.registrarPagamentoOS(v.os.id, { valor: 5000, forma: "pix", recebidoEm: dia });
    const r = await repo.fecharCaixa({ data: dia, contado: esperado.esperado + 200 });
    expect(r.ok).toBe(true);
    const f = (await repo.listarFechamentos()).find((x) => x.id === r.id)!;
    expect(f.saldoInicial).toBe(anterior.contado);
    expect(f.entradasDinheiro).toBe(esperado.entradasDinheiro);
    expect(f.saidasDinheiro).toBe(esperado.saidasDinheiro);
    expect(f.diferenca).toBe(200);
    expect((await repo.fecharCaixa({ data: dia, contado: 0 })).codigo).toBe("caixa_ja_fechado");
  });

  it("toda escrita grava auditoria com o perfil atual", async () => {
    localStorage.setItem("ddoctor.perfil", "p-paula");
    const antes = (await repo.listarAuditoria()).length;
    const r = await repo.criarDespesa({ categoriaId: "desp_outras", descricao: "Água mineral", valorPrevisto: 1200, vencimento: hoje(), pagoEm: hoje(), formaPagamento: "dinheiro" });
    expect(r.ok).toBe(true);
    const log = await repo.listarAuditoria();
    expect(log.length).toBe(antes + 1);
    expect(log[0]).toMatchObject({ acao: "criar", entidade: "despesa", entidadeId: r.id, perfilId: "p-paula" });
    expect(log[0].resumo).toContain("Água mineral");
    expect((await repo.listarDespesas()).find((d) => d.id === r.id)!.categoria).toBe("Outras despesas");
  });

  it("recepção valida avarias e entra com a entrada do carro", async () => {
    const v = await osPorPlaca("SAE5P73");
    const avaria = { id: "", vista: "frente" as const, x: 1.4, y: 0.5, tipo: "amassado" as const, tamanho: "m" as const };
    expect((await repo.salvarRecepcao(v.os.id, { checklist: {}, avarias: [avaria] })).codigo).toBe("posicao_invalida");
    const rec = { km: 42000, combustivel: "1/2" as const, checklist: { estepe: true }, avarias: [{ ...avaria, x: 0.4 }] };
    // OS aguardando agendamento não pode entrar sem agendamento; a recepção pode ser salva antes
    expect((await repo.salvarRecepcao(v.os.id, rec)).ok).toBe(true);
    const salva = (await repo.obterOS(v.os.id))!.os.recepcao!;
    expect(salva.km).toBe(42000);
    expect(salva.avarias[0].id).toBeTruthy();
    expect(salva.registradaEm).toBeTruthy();
  });

  // ------------------------------------------------------------ correções da revisão QA do SE
  it("primeiro pagamento acima do saldo a cobrar não infla o título", async () => {
    const v = await osPorPlaca("RAV3K61"); // franquia R$ 160,00
    expect((await repo.registrarPagamentoOS(v.os.id, { valor: 20000, forma: "pix", recebidoEm: hoje() })).codigo).toBe("baixa_maior_que_saldo");
    expect((await repo.obterOS(v.os.id))!.titulos.filter((t) => t.pagadorId === "pg-cliente")).toHaveLength(0);
  });

  it("caixa fechado trava dinheiro com a data do dia fechado (pagamento, baixa, despesa)", async () => {
    const fechado = (await repo.listarFechamentos())[0].data; // o demo tem dois dias fechados
    const v = await osPorPlaca("RAV3K61");
    expect((await repo.registrarPagamentoOS(v.os.id, { valor: 1000, forma: "dinheiro", recebidoEm: fechado })).codigo).toBe("caixa_ja_fechado");
    // pix no mesmo dia não passa pela gaveta: aceito
    expect((await repo.registrarPagamentoOS(v.os.id, { valor: 1000, forma: "pix", recebidoEm: fechado })).ok).toBe(true);
    const aberto = (await repo.listarTitulos()).find((t) => t.estado !== "recebido" && t.estado !== "cancelado")!;
    expect((await repo.aplicarBaixa(aberto.id, { valor: 100, forma: "Dinheiro", recebidoEm: fechado })).codigo).toBe("caixa_ja_fechado");
    const nova = { categoriaId: "desp_outras", descricao: "Café", valorPrevisto: 500, vencimento: fechado };
    expect((await repo.criarDespesa({ ...nova, pagoEm: fechado, formaPagamento: "dinheiro" })).codigo).toBe("caixa_ja_fechado");
    const d = await repo.criarDespesa(nova);
    expect(d.ok).toBe(true);
    expect((await repo.pagarDespesa(d.id!, 500, fechado, "dinheiro")).codigo).toBe("caixa_ja_fechado");
    expect((await repo.pagarDespesa(d.id!, 500, hoje(), "dinheiro")).ok).toBe(true);
  });

  it("datas de recebimento e pagamento: dia real e não futuro; vencimento só formato", async () => {
    const v = await osPorPlaca("RAV3K61");
    const amanha = new Date(Date.now() + 86_400_000).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    expect((await repo.registrarPagamentoOS(v.os.id, { valor: 1000, forma: "pix", recebidoEm: amanha })).codigo).toBe("data_futura");
    expect((await repo.registrarPagamentoOS(v.os.id, { valor: 1000, forma: "pix", recebidoEm: "2026-02-30" })).codigo).toBe("data_invalida");
    const aberto = (await repo.listarTitulos()).find((t) => t.estado !== "recebido" && t.estado !== "cancelado")!;
    expect((await repo.aplicarBaixa(aberto.id, { valor: 100, forma: "pix", recebidoEm: amanha })).codigo).toBe("data_futura");
    const base = { categoriaId: "desp_outras", descricao: "Luz", valorPrevisto: 500 };
    expect((await repo.criarDespesa({ ...base, vencimento: "31/10/2026" })).codigo).toBe("data_invalida");
    expect((await repo.criarDespesa({ ...base, vencimento: amanha, pagoEm: amanha, formaPagamento: "pix" })).codigo).toBe("data_futura");
    const d = await repo.criarDespesa({ ...base, vencimento: amanha }); // vencimento futuro é normal
    expect(d.ok).toBe(true);
    expect((await repo.pagarDespesa(d.id!, 500, amanha, "pix")).codigo).toBe("data_futura");
    expect((await repo.pagarDespesa(d.id!, 500, "2026-13-01", "pix")).codigo).toBe("data_invalida");
  });

  it("baixas de título cancelado não entram no fechamento", async () => {
    const dia = hoje();
    const estado = JSON.parse(localStorage.getItem("ddoctor.demo.v3")!);
    estado.titulos.push({ id: "t-cancelado", osId: "os-1", pagadorId: "pg-cliente", descricao: "Cancelado", valor: 99900, vencimento: dia, estado: "cancelado", baixas: [{ id: "bx", valor: 99900, recebidoEm: dia, forma: "dinheiro" }] });
    localStorage.setItem("ddoctor.demo.v3", JSON.stringify(estado));
    vi.resetModules();
    const { repositorioMemoria: novo } = await import("./repositorioMemoria");
    const titulos = await novo.listarTitulos();
    const semCancelado = calcularFechamento({ saldoInicial: 0, contado: 0, titulos: titulos.filter((t) => t.id !== "t-cancelado"), despesas: await novo.listarDespesas(), data: dia });
    const r = await novo.fecharCaixa({ data: dia, contado: 0, saldoInicial: 0 });
    expect((await novo.listarFechamentos()).find((f) => f.id === r.id)!.entradasDinheiro).toBe(semCancelado.entradasDinheiro);
  });

  it("total pago e saldo do cliente só contam títulos do pagador cliente", async () => {
    const v = await osPorPlaca("RAV3K61");
    const pagadores = await repo.listarPagadores();
    const tipo = new Map(pagadores.map((p) => [p.id, p.tipo]));
    const ficha = (await repo.obterCliente(v.cliente.id))!;
    const doCliente = ficha.oss.flatMap((o) => o.titulos).filter((t) => tipo.get(t.pagadorId) === "cliente" && t.estado !== "cancelado");
    expect(ficha.totalPago).toBe(doCliente.flatMap((t) => t.baixas).reduce((s, b) => s + b.valor, 0));
    // há cliente com título da Maxpar recebido: ele não entra no total pago do cliente
    const clientes = await repo.listarClientes();
    const titulos = await repo.listarTitulos();
    const oss = await repo.listarOS();
    const comMaxpar = clientes.find((c) =>
      titulos.some((t) => tipo.get(t.pagadorId) !== "cliente" && t.baixas.length > 0 && oss.find((o) => o.os.id === t.osId)?.cliente.id === c.cliente.id),
    )!;
    expect(comMaxpar).toBeTruthy();
    const idsOS = new Set(oss.filter((o) => o.cliente.id === comMaxpar.cliente.id).map((o) => o.os.id));
    const soCliente = titulos
      .filter((t) => idsOS.has(t.osId) && tipo.get(t.pagadorId) === "cliente" && t.estado !== "cancelado")
      .flatMap((t) => t.baixas)
      .reduce((s, b) => s + b.valor, 0);
    expect(comMaxpar.totalPago).toBe(soCliente);
  });

  it("marcos gravados no formato do fuso e listas ordenadas pelo instante real", async () => {
    const v = await osPorPlaca("RAV3K61");
    const r = await repo.lancarCusto(v.os.id, { tipo: "outro", descricao: "Frete", custoUnitario: 1000 });
    const custo = (await repo.listarCustosOS(v.os.id)).find((c) => c.id === r.id)!;
    expect(custo.lancadoEm).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/);
    expect((await repo.listarAuditoria())[0].em).toMatch(/-03:00$/);
    // um movimento antigo gravado em UTC ("Z") não pode furar a ordem por ser texto "maior"
    const estado = JSON.parse(localStorage.getItem("ddoctor.demo.v3")!);
    const antigo = { id: "mv-utc", materialId: "m-1", tipo: "ajuste", sentido: "mais", quantidade: 1, obs: "teste", em: "2000-01-01T23:00:00Z" };
    estado.movimentos.push(antigo);
    estado.materiais = estado.materiais.map((m: { id: string; saldoEstimado: number }) => (m.id === "m-1" ? { ...m, saldoEstimado: m.saldoEstimado + 1 } : m));
    localStorage.setItem("ddoctor.demo.v3", JSON.stringify(estado));
    vi.resetModules();
    const { repositorioMemoria: novo } = await import("./repositorioMemoria");
    const movs = await novo.listarMovimentos();
    expect(movs.at(-1)!.id).toBe("mv-utc");
    const ms = movs.map((m) => Date.parse(m.em));
    expect(ms.every((x, i) => i === 0 || ms[i - 1] >= x)).toBe(true);
  });

  it("recepção preserva o primeiro registro e não edita OS entregue", async () => {
    const v = await osPorPlaca("SAE5P73");
    expect((await repo.salvarRecepcao(v.os.id, { checklist: {}, avarias: [], km: 100 })).ok).toBe(true);
    const primeira = (await repo.obterOS(v.os.id))!.os.recepcao!;
    localStorage.setItem("ddoctor.perfil", "p-dono");
    expect((await repo.salvarRecepcao(v.os.id, { ...primeira, km: 200, registradaEm: "2000-01-01T00:00:00-03:00" })).ok).toBe(true);
    const segunda = (await repo.obterOS(v.os.id))!.os.recepcao!;
    expect(segunda.km).toBe(200);
    expect(segunda.registradaEm).toBe(primeira.registradaEm);
    expect(segunda.registradaPor).toBe(primeira.registradaPor);
    expect(segunda.atualizadaEm).toBeTruthy();
    expect(segunda.atualizadaPor).toBe("p-dono");
    const entregue = (await repo.listarOS()).find((o) => o.os.estado === "entregue")!;
    expect((await repo.salvarRecepcao(entregue.os.id, { checklist: {}, avarias: [] })).codigo).toBe("os_fechada");
  });

  it("mão de obra de R$ 0,00 é recusada", async () => {
    const v = await osPorPlaca("RAV3K61");
    expect((await repo.lancarCusto(v.os.id, { tipo: "mao_de_obra", descricao: "Ajuste", modo: "fixo", minutos: 0, valorUnitario: 0 })).codigo).toBe("valor_invalido");
    expect((await repo.lancarCusto(v.os.id, { tipo: "mao_de_obra", descricao: "Ajuste", modo: "hora", minutos: 0, valorUnitario: 4000 })).codigo).toBe("minutos_invalidos");
  });

  it("restaurar a demonstração deixa linha na auditoria; limite exposto", async () => {
    localStorage.setItem("ddoctor.perfil", "p-dono");
    await repo.restaurarDemo();
    const [ultima] = await repo.listarAuditoria();
    expect(ultima).toMatchObject({ acao: "restaurar", entidade: "demo", perfilId: "p-dono" });
    expect(LIMITE_AUDITORIA).toBe(500);
  });

  it("clientes do demo vêm marcados (a UI não gera wa.me/tel: para eles)", async () => {
    const clientes = await repo.listarClientes();
    expect(clientes.every((c) => c.cliente.demo === true)).toBe(true);
    const novo = await repo.salvarCliente({ nome: "Cliente digitado" });
    expect((await repo.obterCliente(novo.id!))!.cliente.demo).toBeUndefined();
  });
});

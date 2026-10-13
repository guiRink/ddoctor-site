import type {
  Agendamento,
  AtendimentoExterno,
  CapacidadeDia,
  Cliente,
  ConfigOficina,
  Despesa,
  EtapaOS,
  Foto,
  Material,
  OrcamentoVersao,
  OS,
  Pagador,
  PendenciaExterna,
  Perfil,
  TipoReparo,
  TituloReceber,
  Veiculo,
} from "@compartilhado/tipos";

/**
 * Oficina de DEMONSTRAÇÃO. Tudo aqui é fictício: nomes, placas, telefones, protocolos e valores.
 * Seguradoras são as que têm produto Maxpar confirmado publicamente (docs/maxpar-estudo.md §1.3).
 * Tipos de reparo, prazos, capacidade e regras de pagamento são as sugestões do questionário
 * (docs/questionario-dono.md) e ficam marcados como provisórios.
 * As datas são geradas em relação ao momento em que a demonstração é carregada.
 */

export interface EstadoDemo {
  versao: 2;
  geradoEm: string;
  seqOS: number;
  perfis: Perfil[];
  clientes: Cliente[];
  veiculos: Veiculo[];
  atendimentos: AtendimentoExterno[];
  oss: OS[];
  versoes: OrcamentoVersao[];
  etapas: EtapaOS[];
  tiposReparo: TipoReparo[];
  agendamentos: Agendamento[];
  capacidades: CapacidadeDia[];
  fotos: Foto[];
  pendencias: PendenciaExterna[];
  pagadores: Pagador[];
  titulos: TituloReceber[];
  despesas: Despesa[];
  materiais: Material[];
  config: ConfigOficina;
}

const HORA = 3_600_000;
const DIA = 24 * HORA;

function iso(d: Date): string {
  return d.toISOString();
}
function dataISO(d: Date): string {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return z.toISOString().slice(0, 10);
}

export const FOTOS_DEMO = [
  "recepc-ao-d-doctor-com-carros-premium",
  "sed-a-azul-em-oficina-de-funilaria",
  "oficina-moderna-suv-e-sed-a-em-preparac-ao",
  "suv-grafite-em-baia-de-detalhamento",
  "preparac-ao-automotiva-com-suv-e-sed-a",
  "galeria-automotiva-com-suvs-premium",
  "oficina-automotiva-premium-com-carros-modernos",
  "oficina-coberta-com-dois-carros-premium",
].map((nome) => `${import.meta.env.BASE_URL}demo/${nome}.webp`);

export function gerarDemo(agoraMs = Date.now()): EstadoDemo {
  const agora = new Date(agoraMs);
  const h = (horas: number) => iso(new Date(agoraMs + horas * HORA));
  const d = (dias: number) => dataISO(new Date(agoraMs + dias * DIA));

  // ---------------------------------------------------------------- pessoas (fictícias)
  const perfis: Perfil[] = [
    { id: "p-dono", nome: "Carlos Dantas", papel: "dono", funcao: "Dono", ativo: true, usaTerminal: false },
    { id: "p-recepcao", nome: "Juliana Prado", papel: "recepcao", funcao: "Recepção e orçamento", ativo: true, usaTerminal: false },
    { id: "p-diego", nome: "Diego Ramos", papel: "producao", funcao: "Martelinho e funilaria", ativo: true, usaTerminal: false },
    { id: "p-marcos", nome: "Marcos Lima", papel: "producao", funcao: "Pintor", ativo: true, usaTerminal: true },
    { id: "p-rafael", nome: "Rafael Costa", papel: "producao", funcao: "Preparação e montagem", ativo: true, usaTerminal: true },
    { id: "p-andre", nome: "André Souza", papel: "producao", funcao: "Polimento e higienização", ativo: true, usaTerminal: true },
    { id: "p-paula", nome: "Paula Mendes", papel: "financeiro", funcao: "Financeiro", ativo: true, usaTerminal: false },
    { id: "p-tv", nome: "TV da oficina", papel: "dispositivo", ativo: true, usaTerminal: false },
  ];

  // ---------------------------------------------------------------- tipos de reparo (provisórios)
  const tiposReparo: TipoReparo[] = [
    {
      id: "tr-martelinho",
      nome: "Martelinho",
      provisorio: true,
      etapas: [
        { ordem: 1, nome: "Desmontagem", prazoPadraoHoras: 2, dispensavel: true, exigeFoto: false, exigeContagemPecas: false },
        { ordem: 2, nome: "Martelinho", prazoPadraoHoras: 4, dispensavel: false, exigeFoto: true, exigeContagemPecas: true },
        { ordem: 3, nome: "Polimento", prazoPadraoHoras: 2, dispensavel: false, exigeFoto: false, exigeContagemPecas: false },
        { ordem: 4, nome: "Montagem e revisão", prazoPadraoHoras: 2, dispensavel: false, exigeFoto: true, exigeContagemPecas: false },
      ],
    },
    {
      id: "tr-pintura",
      nome: "Pintura",
      provisorio: true,
      etapas: [
        { ordem: 1, nome: "Desmontagem", prazoPadraoHoras: 2, dispensavel: false, exigeFoto: false, exigeContagemPecas: false },
        { ordem: 2, nome: "Funilaria", prazoPadraoHoras: 4, dispensavel: true, exigeFoto: true, exigeContagemPecas: true },
        { ordem: 3, nome: "Preparação", prazoPadraoHoras: 4, dispensavel: false, exigeFoto: false, exigeContagemPecas: false },
        { ordem: 4, nome: "Pintura", prazoPadraoHoras: 8, dispensavel: false, exigeFoto: true, exigeContagemPecas: true },
        { ordem: 5, nome: "Polimento", prazoPadraoHoras: 2, dispensavel: false, exigeFoto: false, exigeContagemPecas: false },
        { ordem: 6, nome: "Montagem", prazoPadraoHoras: 2, dispensavel: false, exigeFoto: true, exigeContagemPecas: false },
      ],
    },
    {
      id: "tr-sra",
      nome: "SRA (arranhões)",
      provisorio: true,
      etapas: [
        { ordem: 1, nome: "Preparação", prazoPadraoHoras: 2, dispensavel: false, exigeFoto: false, exigeContagemPecas: false },
        { ordem: 2, nome: "Pintura localizada", prazoPadraoHoras: 4, dispensavel: false, exigeFoto: true, exigeContagemPecas: true },
        { ordem: 3, nome: "Polimento", prazoPadraoHoras: 2, dispensavel: false, exigeFoto: true, exigeContagemPecas: false },
      ],
    },
    {
      id: "tr-polimento",
      nome: "Polimento e higienização",
      provisorio: true,
      etapas: [
        { ordem: 1, nome: "Polimento", prazoPadraoHoras: 4, dispensavel: true, exigeFoto: false, exigeContagemPecas: false },
        { ordem: 2, nome: "Higienização", prazoPadraoHoras: 3, dispensavel: true, exigeFoto: true, exigeContagemPecas: false },
      ],
    },
  ];

  const config: ConfigOficina = {
    expediente: { diasSemana: [1, 2, 3, 4, 5, 6], inicio: "08:00", fim: "18:00", sabadoFim: "12:00" },
    semaforo: { laranjaAntesHoras: 8, vermelhoBloqueioHoras: 4 },
    capacidadePadrao: { vagasEntrada: 4, carrosSimultaneos: 12 },
    provisorio: true,
  };

  const pagadores: Pagador[] = [
    { id: "pg-maxpar", nome: "Maxpar", tipo: "maxpar", prazo: { dias: 30, base: "servico_realizado", diasUteis: false, provisorio: true } },
    { id: "pg-cliente", nome: "Cliente (particular / franquia)", tipo: "cliente", prazo: { dias: 0, base: "entrega", diasUteis: false, provisorio: true } },
    { id: "pg-direta", nome: "Seguradora direta", tipo: "seguradora", prazo: { dias: 3, base: "nf", diasUteis: true, provisorio: true } },
  ];

  // ---------------------------------------------------------------- casos
  const clientes: Cliente[] = [];
  const veiculos: Veiculo[] = [];
  const atendimentos: AtendimentoExterno[] = [];
  const oss: OS[] = [];
  const versoes: OrcamentoVersao[] = [];
  const etapas: EtapaOS[] = [];
  const agendamentos: Agendamento[] = [];
  const fotos: Foto[] = [];
  const pendencias: PendenciaExterna[] = [];
  const titulos: TituloReceber[] = [];
  let seqOS = 1040;

  interface Caso {
    placa: string;
    modelo: string;
    cor: string;
    cliente: string;
    telefone: string;
    origem: OS["origem"];
    seguradora?: string;
    protocolo?: string;
    status?: AtendimentoExterno["statusNormalizado"];
    estado: OS["estado"];
    tipo?: TipoReparo["id"];
    pecas: [string, ItemTec, number, ItemSt?][];
    abertoHaDias: number;
    // produção
    etapaAtual?: number; // índice (0-based) da etapa atual quando na oficina
    estadoAtual?: "na_fila" | "em_execucao" | "bloqueada";
    atualIniciadaHaHoras?: number;
    atualPrazoEmHoras?: number; // relativo a agora (negativo = vencido)
    bloqueio?: { haHoras: number; motivo: string };
    responsaveis?: string[];
    dispensar?: number[];
    previsaoDias?: number;
    box?: string;
    prioridade?: OS["prioridade"];
    limiteVistoriaDias?: number;
    agenda?: { dias: number; janela: "manha" | "tarde"; estado?: Agendamento["estado"]; origem?: Agendamento["origem"] };
    entregueHaDias?: number;
    pagamento?: "aberto" | "parcial" | "recebido" | "vencido";
    recusa?: string;
    observacoes?: string;
  }
  type ItemTec = "sra" | "martelinho" | "pintura" | "funilaria" | "polimento" | "outro";
  type ItemSt = "solicitado" | "autorizado" | "negado" | "reanalise" | "dispensado";

  const casos: Caso[] = [
    // ---- na oficina
    {
      placa: "RAV3K61", modelo: "BMW X5", cor: "Grafite", cliente: "Cláudia Mendes", telefone: "+5541991000005",
      origem: "maxpar", seguradora: "MAPFRE", protocolo: "18389907", status: "autorizado", estado: "na_oficina", tipo: "tr-martelinho",
      pecas: [["Para-lama dianteiro direito", "martelinho", 36000], ["Porta traseira direita", "martelinho", 34000]],
      abertoHaDias: 6, etapaAtual: 1, estadoAtual: "em_execucao", atualIniciadaHaHoras: 1.5, atualPrazoEmHoras: 2.5,
      responsaveis: ["p-diego", "p-diego", "p-andre", "p-rafael"], previsaoDias: 1, box: "Baia 1",
    },
    {
      placa: "RKP1L34", modelo: "Range Rover Sport", cor: "Preto", cliente: "Henrique Salles", telefone: "+5541991000006",
      origem: "particular", estado: "na_oficina", tipo: "tr-pintura",
      pecas: [["Capô", "pintura", 140000], ["Para-choque dianteiro", "funilaria", 90000]],
      abertoHaDias: 9, etapaAtual: 3, estadoAtual: "em_execucao", atualIniciadaHaHoras: 11, atualPrazoEmHoras: -3,
      responsaveis: ["p-rafael", "p-diego", "p-rafael", "p-marcos", "p-andre", "p-rafael"], previsaoDias: -1, box: "Cabine de pintura", prioridade: 2,
      observacoes: "Cliente particular; valor combinado na entrada.",
    },
    {
      placa: "QPZ6M77", modelo: "Volvo XC90", cor: "Prata", cliente: "Renata Bueno", telefone: "+5541991000007",
      origem: "maxpar", seguradora: "Bradesco", protocolo: "18395510", status: "autorizado", estado: "na_oficina", tipo: "tr-sra",
      pecas: [["Porta dianteira esquerda", "sra", 19000], ["Retrovisor esquerdo", "pintura", 26000]],
      abertoHaDias: 5, etapaAtual: 2, estadoAtual: "em_execucao", atualIniciadaHaHoras: 0.5, atualPrazoEmHoras: 1.5,
      responsaveis: ["p-rafael", "p-marcos", "p-andre"], previsaoDias: 0, box: "Polimento",
    },
    {
      placa: "RTB2E90", modelo: "Mercedes GLC", cor: "Branco", cliente: "Felipe Andrade", telefone: "+5541991000013",
      origem: "maxpar", seguradora: "Tokio Marine", protocolo: "18401876", status: "autorizado", estado: "na_oficina", tipo: "tr-pintura",
      pecas: [["Porta traseira esquerda", "funilaria", 42000], ["Para-lama traseiro esquerdo", "pintura", 48000]],
      abertoHaDias: 4, etapaAtual: 1, estadoAtual: "bloqueada", atualIniciadaHaHoras: 7, atualPrazoEmHoras: 1,
      bloqueio: { haHoras: 5, motivo: "Peça do segurado não chegou (moldura da porta)" },
      responsaveis: ["p-rafael", "p-diego", "p-rafael", "p-marcos", "p-andre", "p-rafael"], previsaoDias: 2, box: "Baia 2",
    },
    {
      placa: "RJC8T15", modelo: "Audi Q5", cor: "Azul", cliente: "Marina Albuquerque", telefone: "+5541991000001",
      origem: "maxpar", seguradora: "HDI", protocolo: "18398760", status: "parcialmente_autorizado", estado: "na_oficina", tipo: "tr-martelinho",
      pecas: [["Capô", "martelinho", 42000], ["Teto", "martelinho", 45000, "negado"]],
      abertoHaDias: 3, etapaAtual: 2, estadoAtual: "na_fila", atualPrazoEmHoras: 5,
      responsaveis: ["p-diego", "p-diego", "p-andre", "p-rafael"], dispensar: [0], previsaoDias: 1, box: "Baia 1",
      observacoes: "Teto negado pela HDI (exige remoção do forro). Oferecer serviço particular.",
    },
    {
      placa: "SCH4A22", modelo: "Porsche Macan", cor: "Vermelho", cliente: "Bruno Kessler", telefone: "+5541991000014",
      origem: "particular", estado: "na_oficina", tipo: "tr-polimento",
      pecas: [["Polimento completo", "polimento", 85000], ["Higienização interna", "outro", 45000]],
      abertoHaDias: 1, etapaAtual: 0, estadoAtual: "em_execucao", atualIniciadaHaHoras: 2.5, atualPrazoEmHoras: 1.5,
      responsaveis: ["p-andre", "p-andre"], previsaoDias: 0, box: "Higienização",
    },
    // ---- prontos
    {
      placa: "RFG5N90", modelo: "BMW Série 4", cor: "Cinza", cliente: "André Pacheco", telefone: "+5541991000008",
      origem: "maxpar", seguradora: "Tokio Marine", protocolo: "18386623", status: "autorizado", estado: "pronta", tipo: "tr-martelinho",
      pecas: [["Para-lama dianteiro esquerdo", "martelinho", 40000]],
      abertoHaDias: 7, previsaoDias: 0, box: "Pátio coberto",
    },
    {
      placa: "QXT4D88", modelo: "Jeep Compass", cor: "Branco", cliente: "Patrícia Konzen", telefone: "+5541991000003",
      origem: "maxpar", seguradora: "Liberty", protocolo: "18377102", status: "autorizado", estado: "pronta", tipo: "tr-pintura",
      pecas: [["Para-choque traseiro", "pintura", 65000]],
      abertoHaDias: 10, previsaoDias: 1, box: "Pátio coberto",
    },
    // ---- agendados
    {
      placa: "RTO9H02", modelo: "Mercedes C200", cor: "Branco", cliente: "Gustavo Ferreira", telefone: "+5541991000004",
      origem: "maxpar", seguradora: "Zurich", protocolo: "18391544", status: "autorizado", estado: "agendada",
      pecas: [["Porta dianteira direita", "martelinho", 38000], ["Coluna B", "pintura", 52000]],
      abertoHaDias: 5, agenda: { dias: 0, janela: "tarde" }, previsaoDias: 3,
    },
    {
      placa: "SBD7C41", modelo: "Volvo XC60", cor: "Branco", cliente: "Eduardo Taborda", telefone: "+5541991000002",
      origem: "maxpar", seguradora: "MAPFRE", protocolo: "18403312", status: "autorizado", estado: "agendada",
      pecas: [["Porta dianteira esquerda", "martelinho", 36000]],
      abertoHaDias: 4, agenda: { dias: 1, janela: "manha", origem: "calia" }, previsaoDias: 2,
    },
    {
      placa: "RHV0M58", modelo: "Land Rover Defender", cor: "Cinza", cliente: "Sérgio Wolff", telefone: "+5541991000015",
      origem: "seguradora_direta", seguradora: "Porto Seguro", protocolo: "PS-55102", status: "autorizado", estado: "agendada",
      pecas: [["Para-choque dianteiro", "pintura", 78000]],
      abertoHaDias: 6, agenda: { dias: 2, janela: "manha" }, previsaoDias: 5,
    },
    // ---- aguardando agendamento
    {
      placa: "SAE5P73", modelo: "BMW X1", cor: "Azul", cliente: "Sônia Machado", telefone: "+5541991000011",
      origem: "maxpar", seguradora: "MAPFRE", protocolo: "18405521", status: "autorizado", estado: "aguardando_agendamento",
      pecas: [["Porta dianteira direita", "martelinho", 38000], ["Para-lama dianteiro direito", "sra", 18000]],
      abertoHaDias: 2,
    },
    {
      placa: "RNA4S66", modelo: "Volvo XC40", cor: "Cinza", cliente: "Luciano Prado", telefone: "+5541991000012",
      origem: "maxpar", seguradora: "Zurich", protocolo: "18404409", status: "autorizado", estado: "aguardando_agendamento",
      pecas: [["Tampa traseira", "martelinho", 40000]],
      abertoHaDias: 3, agenda: { dias: 1, janela: "tarde", estado: "proposto", origem: "calia" },
    },
    {
      placa: "QWE3R27", modelo: "Toyota Corolla Cross", cor: "Prata", cliente: "Aline Ritter", telefone: "",
      origem: "maxpar", seguradora: "Liberty", protocolo: "18406038", status: "autorizado", estado: "aguardando_agendamento",
      pecas: [["Para-lama traseiro direito", "martelinho", 35000]],
      abertoHaDias: 1, observacoes: "Sem telefone no atendimento; pedir à Maxpar.",
    },
    // ---- aguardando aprovação
    {
      placa: "RHK2C47", modelo: "BMW 320i", cor: "Cinza", cliente: "Tatiane Lopes", telefone: "+5541991000016",
      origem: "maxpar", seguradora: "Tokio Marine", protocolo: "18402211", status: "aguardando_autorizacao", estado: "aguardando_aprovacao",
      pecas: [["Porta dianteira esquerda", "martelinho", 38000, "solicitado"], ["Para-lama dianteiro esquerdo", "martelinho", 36000, "solicitado"]],
      abertoHaDias: 5, limiteVistoriaDias: 1,
    },
    {
      placa: "SDF1G39", modelo: "Jeep Renegade", cor: "Verde", cliente: "Tiago Westphal", telefone: "+5541991000010",
      origem: "maxpar", seguradora: "HDI", protocolo: "18406650", status: "aguardando_autorizacao", estado: "aguardando_aprovacao",
      pecas: [["Capô", "martelinho", 42000, "solicitado"]],
      abertoHaDias: 1, limiteVistoriaDias: 3,
    },
    {
      placa: "RXY6U84", modelo: "Mercedes A200", cor: "Preto", cliente: "Fernanda Lins", telefone: "+5541991000009",
      origem: "particular", estado: "rascunho",
      pecas: [["Para-choque traseiro", "sra", 32000, "solicitado"]],
      abertoHaDias: 0, observacoes: "Orçamento particular em montagem; cliente volta amanhã.",
    },
    // ---- entregues (dinheiro)
    {
      placa: "RCD8P15", modelo: "Mercedes GLA", cor: "Vermelho", cliente: "Otávio Reis", telefone: "+5541991000017",
      origem: "maxpar", seguradora: "HDI", protocolo: "18370018", status: "servico_realizado", estado: "entregue", tipo: "tr-martelinho",
      pecas: [["Porta traseira esquerda", "martelinho", 38000], ["Teto", "martelinho", 45000]],
      abertoHaDias: 15, entregueHaDias: 3, pagamento: "aberto",
    },
    {
      placa: "SJQ7R03", modelo: "BMW X1", cor: "Branco", cliente: "Vanessa Hoffmann", telefone: "+5541991000018",
      origem: "maxpar", seguradora: "MAPFRE", protocolo: "18354477", status: "servico_realizado", estado: "entregue", tipo: "tr-martelinho",
      pecas: [["Porta dianteira direita", "martelinho", 38000], ["Para-lama dianteiro direito", "sra", 18000]],
      abertoHaDias: 22, entregueHaDias: 9, pagamento: "aberto", recusa: "Ordem dos documentos no PDF e assinatura fora do padrão",
    },
    {
      placa: "RLM2Q48", modelo: "Jeep Renegade", cor: "Cinza", cliente: "Rodrigo Nunes", telefone: "+5541991000019",
      origem: "maxpar", seguradora: "Liberty", protocolo: "18311200", status: "servico_realizado", estado: "entregue", tipo: "tr-martelinho",
      pecas: [["Capô", "martelinho", 42000]],
      abertoHaDias: 42, entregueHaDias: 36, pagamento: "vencido",
    },
    {
      placa: "SPA9X11", modelo: "Volvo XC40", cor: "Azul", cliente: "Camila Duarte", telefone: "+5541991000020",
      origem: "maxpar", seguradora: "Zurich", protocolo: "18290331", status: "pago", estado: "encerrada", tipo: "tr-martelinho",
      pecas: [["Porta traseira direita", "martelinho", 40000], ["Para-choque traseiro", "sra", 20000]],
      abertoHaDias: 50, entregueHaDias: 40, pagamento: "recebido",
    },
  ];

  casos.forEach((c, i) => {
    const n = i + 1;
    const clienteId = `c-${n}`;
    const veiculoId = `v-${n}`;
    const osId = `os-${n}`;
    seqOS += 1;
    const aberturaMs = agoraMs - c.abertoHaDias * DIA - 3 * HORA;
    const prov = c.origem === "maxpar" ? { fonte: "manual" as const, lidoEm: iso(new Date(aberturaMs)) } : undefined;

    clientes.push({
      id: clienteId,
      nome: c.cliente,
      telefone: c.telefone || undefined,
      proveniencia: prov ? { nome: prov, telefone: prov } : undefined,
    });
    veiculos.push({ id: veiculoId, clienteId, placa: c.placa, modelo: c.modelo, cor: c.cor, proveniencia: prov ? { placa: prov } : undefined });

    const atIds: string[] = [];
    if (c.seguradora && c.protocolo) {
      const atId = `at-${n}`;
      atIds.push(atId);
      atendimentos.push({
        id: atId,
        fonte: "manual",
        seguradora: c.seguradora,
        idExterno: c.protocolo,
        produto: c.origem === "maxpar" ? (c.seguradora === "Zurich" ? "Lataria e Pintura Premium" : "Maxassistência de Lataria e Pintura") : undefined,
        statusNormalizado: c.status ?? "desconhecido",
        aberturaEm: dataISO(new Date(aberturaMs)),
        limiteVistoriaEm: c.limiteVistoriaDias !== undefined ? d(c.limiteVistoriaDias) : undefined,
        previsaoPortal: c.previsaoDias !== undefined ? d(c.previsaoDias + 1) : undefined,
        lidoEm: iso(new Date(agoraMs - (c.abertoHaDias > 20 ? 30 : 6) * HORA)),
        estadoConciliacao: "ok",
      });
    }

    // orçamento (uma versão; externa quando vem da Maxpar/seguradora)
    const itens = c.pecas.map(([peca, tecnica, valor, st], k) => ({
      id: `it-${n}-${k}`,
      peca,
      tecnica,
      valor,
      statusItem: st ?? ("autorizado" as ItemSt),
    }));
    const aprovado = !["rascunho", "aguardando_aprovacao"].includes(c.estado);
    const franquia = c.origem === "maxpar" ? 16000 : undefined;
    versoes.push({
      id: `ver-${n}`,
      osId,
      tipo: c.origem === "particular" ? "interno" : "externo",
      numeroVersao: 1,
      fonte: "manual",
      estado: c.estado === "rascunho" ? "rascunho" : aprovado ? "aprovado" : "enviado",
      itens,
      tetoCobertura: c.origem === "maxpar" ? (c.seguradora === "Zurich" ? 150000 : 100000) : undefined,
      franquia,
      criadoEm: iso(new Date(aberturaMs + HORA)),
      aprovacao: aprovado
        ? {
            tipo: c.origem === "particular" ? "cliente" : "externa",
            aprovadoEm: iso(new Date(aberturaMs + 20 * HORA)),
            evidencia: c.origem === "particular" ? "Aprovado pelo cliente no balcão" : "Autorização vista no portal da Maxpar",
            confiavel: true,
          }
        : undefined,
    });

    // etapas de produção
    const tipo = tiposReparo.find((t) => t.id === c.tipo);
    const naOficina = ["na_oficina", "pronta", "entregue", "encerrada"].includes(c.estado);
    if (tipo && naOficina) {
      const entradaMs = agoraMs - Math.max(1, c.abertoHaDias - 1) * DIA;
      let cursor = entradaMs;
      tipo.etapas.forEach((m, k) => {
        const id = `et-${n}-${k}`;
        const base: EtapaOS = {
          id,
          osId,
          ordem: m.ordem,
          nome: m.nome,
          estado: "aguardando",
          responsavelId: c.responsaveis?.[k],
          prazoHoras: m.prazoPadraoHoras,
          exigeFoto: m.exigeFoto,
          exigeContagemPecas: m.exigeContagemPecas,
          pecasPrevistas: m.exigeContagemPecas ? c.pecas.filter((p) => (p[3] ?? "autorizado") === "autorizado").length : undefined,
          bloqueios: [],
        };
        const atual = c.estado === "na_oficina" ? c.etapaAtual ?? 0 : tipo.etapas.length; // pronta/entregue: tudo concluído
        if (c.dispensar?.includes(k)) {
          etapas.push({ ...base, estado: "dispensada", motivoDispensa: "Não foi preciso desmontar" });
          return;
        }
        if (k < atual) {
          const fila = cursor;
          const ini = fila + 0.5 * HORA;
          const fim = ini + m.prazoPadraoHoras * HORA * 0.9;
          cursor = fim;
          etapas.push({
            ...base,
            estado: "concluida",
            entrouFilaEm: iso(new Date(fila)),
            iniciadaEm: iso(new Date(ini)),
            concluidaEm: iso(new Date(fim)),
            prazoEm: iso(new Date(fila + m.prazoPadraoHoras * HORA)),
            pecasFeitas: base.pecasPrevistas,
          });
        } else if (k === atual) {
          const iniciada = c.atualIniciadaHaHoras !== undefined ? agoraMs - c.atualIniciadaHaHoras * HORA : undefined;
          etapas.push({
            ...base,
            estado: c.estadoAtual ?? "na_fila",
            entrouFilaEm: iso(new Date(Math.min(cursor, iniciada ?? agoraMs - HORA))),
            iniciadaEm: iniciada ? iso(new Date(iniciada)) : undefined,
            prazoEm: h(c.atualPrazoEmHoras ?? m.prazoPadraoHoras),
            bloqueios: c.bloqueio ? [{ inicioEm: h(-c.bloqueio.haHoras), motivo: c.bloqueio.motivo }] : [],
          });
        } else {
          etapas.push(base);
        }
      });
    }

    const entregueMs = c.entregueHaDias !== undefined ? agoraMs - c.entregueHaDias * DIA : undefined;
    oss.push({
      id: osId,
      numero: seqOS,
      veiculoId,
      clienteId,
      tipoReparoId: c.tipo,
      origem: c.origem,
      estado: c.estado,
      prioridade: c.prioridade ?? 0,
      atendimentosExternos: atIds,
      previsaoEntrega: c.previsaoDias !== undefined ? d(c.previsaoDias) : entregueMs ? dataISO(new Date(entregueMs)) : undefined,
      entradaRealEm: naOficina ? iso(new Date(agoraMs - Math.max(1, c.abertoHaDias - 1) * DIA)) : undefined,
      prontaEm: ["pronta", "entregue", "encerrada"].includes(c.estado) ? iso(new Date((entregueMs ?? agoraMs) - 5 * HORA)) : undefined,
      entregueEm: entregueMs ? iso(new Date(entregueMs)) : undefined,
      box: c.box,
      observacoes: c.observacoes,
      criadoEm: iso(new Date(aberturaMs)),
      atualizadoEm: iso(new Date(agoraMs - (n % 5) * HORA)),
      demo: true,
    });

    if (c.agenda) {
      agendamentos.push({
        id: `ag-${n}`,
        osId,
        data: d(c.agenda.dias),
        janela: c.agenda.janela,
        estado: c.agenda.estado ?? "confirmado",
        origem: c.agenda.origem ?? "recepcao",
        expiraEm: c.agenda.estado === "proposto" ? h(1.5) : undefined,
      });
    }
    if (naOficina && c.estado !== "na_oficina") {
      agendamentos.push({ id: `ag-${n}-r`, osId, data: d(-Math.max(1, c.abertoHaDias - 1)), janela: "manha", estado: "realizado", origem: "recepcao" });
    }

    // fotos de vistoria (fotos reais da oficina, reutilizadas só para demonstrar a galeria)
    if (naOficina) {
      const f1 = FOTOS_DEMO[n % FOTOS_DEMO.length];
      const f2 = FOTOS_DEMO[(n + 3) % FOTOS_DEMO.length];
      fotos.push({ id: `f-${n}-1`, osId, fase: "entrada", legenda: "Panorâmica com placa", url: f1, autorId: "p-recepcao", origem: "interna", tiradaEm: oss[oss.length - 1].entradaRealEm! });
      fotos.push({ id: `f-${n}-2`, osId, fase: "durante", legenda: c.pecas[0][0], url: f2, autorId: c.responsaveis?.[1] ?? "p-diego", origem: "interna", tiradaEm: h(-2) });
      if (c.origem === "maxpar") {
        fotos.push({ id: `f-${n}-3`, osId, fase: "externa", legenda: "Vistoria mobile do segurado", url: FOTOS_DEMO[(n + 5) % FOTOS_DEMO.length], origem: "maxpar", tiradaEm: iso(new Date(aberturaMs + 2 * HORA)) });
      }
    }

    // pendências no portal e títulos
    if (["entregue", "encerrada"].includes(c.estado) && c.origem !== "particular") {
      pendencias.push({
        id: `pd-${n}`,
        osId,
        tipo: "encerrar_portal",
        descricao: "Marcar Serviço Realizado e enviar fotos, PDF e assinatura no portal",
        estado: c.estado === "encerrada" || c.pagamento === "vencido" || c.recusa ? "concluida" : "aberta",
        responsavelId: "p-recepcao",
        criadaEm: iso(new Date(entregueMs!)),
        concluidaEm: c.estado === "encerrada" || c.pagamento === "vencido" || c.recusa ? iso(new Date(entregueMs! + DIA)) : undefined,
      });
      if (c.recusa) {
        pendencias.push({
          id: `pd-${n}-r`,
          osId,
          tipo: "reenviar_documentacao",
          descricao: `Documentação recusada: ${c.recusa}`,
          estado: "aberta",
          responsavelId: "p-recepcao",
          criadaEm: h(-4 * 24),
        });
      }
    }
    if (c.estado === "pronta" || c.estado === "na_oficina") {
      if (c.limiteVistoriaDias === undefined && c.status === "parcialmente_autorizado") {
        pendencias.push({ id: `pd-${n}-a`, osId, tipo: "solicitar_reanalise", descricao: "Pedir reanálise do teto ou registrar como particular", estado: "aberta", responsavelId: "p-recepcao", criadaEm: h(-30) });
      }
    }

    if (["entregue", "encerrada"].includes(c.estado)) {
      const total = itens.filter((it) => it.statusItem === "autorizado").reduce((s, it) => s + it.valor, 0);
      const baseVenc = new Date(entregueMs! + DIA);
      const vencMaxpar = dataISO(new Date(baseVenc.getTime() + 30 * DIA));
      const estadoT: TituloReceber["estado"] = c.pagamento === "recebido" ? "recebido" : "emitido";
      titulos.push({
        id: `t-${n}-m`,
        osId,
        pagadorId: "pg-maxpar",
        descricao: `Mão de obra autorizada · protocolo ${c.protocolo}`,
        valor: total - (franquia ?? 0),
        nfNumero: `${2300 + n}`,
        nfEmitidaEm: dataISO(baseVenc),
        vencimento: vencMaxpar,
        estado: estadoT,
        baixas: c.pagamento === "recebido" ? [{ id: `b-${n}`, valor: total - (franquia ?? 0), recebidoEm: d(-8), forma: "Transferência" }] : [],
      });
      if (franquia) {
        titulos.push({
          id: `t-${n}-f`,
          osId,
          pagadorId: "pg-cliente",
          descricao: "Franquia",
          valor: franquia,
          vencimento: dataISO(new Date(entregueMs!)),
          estado: "recebido",
          baixas: [{ id: `b-${n}-f`, valor: franquia, recebidoEm: dataISO(new Date(entregueMs!)), forma: "Pix" }],
        });
      }
    }
  });

  // particular em andamento: sinal recebido
  titulos.push({
    id: "t-rkp-sinal",
    osId: "os-2",
    pagadorId: "pg-cliente",
    descricao: "Serviço particular — pintura do capô e para-choque",
    valor: 230000,
    vencimento: d(-1),
    estado: "parcial",
    baixas: [{ id: "b-rkp", valor: 100000, recebidoEm: d(-8), forma: "Pix" }],
  });

  // ---------------------------------------------------------------- capacidade (exceções)
  const capacidades: CapacidadeDia[] = [{ data: d(4), vagasEntrada: 0, bloqueado: "Feriado municipal (exemplo)" }];

  // ---------------------------------------------------------------- despesas e estoque (fictícios)
  const despesas: Despesa[] = [
    { id: "d-1", categoria: "Aluguel", descricao: "Aluguel do barracão", valorPrevisto: 850000, vencimento: d(3) },
    { id: "d-2", categoria: "Energia e água", descricao: "Conta de energia", valorPrevisto: 128000, vencimento: d(6) },
    { id: "d-3", categoria: "Material de pintura", descricao: "Tinta base e verniz", fornecedor: "Distribuidora de tintas (exemplo)", valorPrevisto: 214000, vencimento: d(-2), pagoEm: d(-2), valorPago: 214000 },
    { id: "d-4", categoria: "Material de polimento", descricao: "Massa de polir e boinas", valorPrevisto: 46000, vencimento: d(-5), pagoEm: d(-5), valorPago: 46000 },
    { id: "d-5", categoria: "Ferramentas", descricao: "Kit de alavancas para martelinho", valorPrevisto: 98000, vencimento: d(12) },
    { id: "d-6", categoria: "Salários e pró-labore", descricao: "Folha do mês (lançamento manual)", valorPrevisto: 1820000, vencimento: d(18) },
    { id: "d-7", categoria: "Impostos", descricao: "Simples Nacional", valorPrevisto: 312000, vencimento: d(-1) },
    { id: "d-8", categoria: "Marketing", descricao: "Impulsionamento redes sociais", valorPrevisto: 30000, vencimento: d(-10), pagoEm: d(-10), valorPago: 30000 },
  ];

  const materiais: Material[] = [
    { id: "m-1", nome: "Verniz alto sólido", categoria: "Tinta e verniz", unidade: "L", saldoEstimado: 3.5, saldoMinimo: 5, ultimaConferenciaEm: d(-20), custoMedio: 18900 },
    { id: "m-2", nome: "Primer PU cinza", categoria: "Massa e primer", unidade: "L", saldoEstimado: 8, saldoMinimo: 4, ultimaConferenciaEm: d(-20), custoMedio: 9800 },
    { id: "m-3", nome: "Lixa P1500", categoria: "Lixa e abrasivo", unidade: "folha", saldoEstimado: 0, saldoMinimo: 50, ultimaConferenciaEm: d(-20), custoMedio: 350 },
    { id: "m-4", nome: "Massa de polir corte", categoria: "Polidor e cera", unidade: "kg", saldoEstimado: 2.2, saldoMinimo: 1, ultimaConferenciaEm: d(-120), custoMedio: 15400 },
    { id: "m-5", nome: "Fita crepe automotiva 48 mm", categoria: "Fita e mascaramento", unidade: "rolo", saldoEstimado: 14, saldoMinimo: 10, ultimaConferenciaEm: d(-20), custoMedio: 1900 },
    { id: "m-6", nome: "Thinner de limpeza", categoria: "Solvente", unidade: "L", saldoEstimado: 12, saldoMinimo: 6, ultimaConferenciaEm: d(-20), custoMedio: 2600 },
    { id: "m-7", nome: "Máscara PFF2", categoria: "EPI", unidade: "un", saldoEstimado: 6, saldoMinimo: 10, ultimaConferenciaEm: d(-20), custoMedio: 450 },
  ];

  return {
    versao: 2,
    geradoEm: iso(agora),
    seqOS,
    perfis,
    clientes,
    veiculos,
    atendimentos,
    oss,
    versoes,
    etapas,
    tiposReparo,
    agendamentos,
    capacidades,
    fotos,
    pendencias,
    pagadores,
    titulos,
    despesas,
    materiais,
    config,
  };
}

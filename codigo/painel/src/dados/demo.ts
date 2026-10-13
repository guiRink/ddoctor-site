import type {
  Agendamento,
  AtendimentoExterno,
  Avaria,
  Baixa,
  CapacidadeDia,
  CategoriaFinanceira,
  Cliente,
  ConfigOficina,
  CustoOS,
  Despesa,
  EtapaOS,
  FechamentoCaixa,
  Fornecedor,
  Foto,
  Material,
  MovimentoEstoque,
  NivelCombustivel,
  OrcamentoVersao,
  OS,
  Pagador,
  PendenciaExterna,
  Perfil,
  RecepcaoVeiculo,
  RegistroAuditoria,
  TipoReparo,
  TituloReceber,
  Veiculo,
  VistaAvaria,
} from "@compartilhado/tipos";
import { NIVEIS_COMBUSTIVEL } from "@compartilhado/tipos";
import { CATEGORIAS_PADRAO, CHECKLIST_PADRAO } from "@compartilhado/dominio/config";
import { custoMaoDeObra, totalCusto } from "@compartilhado/dominio/custos";
import { aplicarMovimento } from "@compartilhado/dominio/estoque";
import { calcularFechamento } from "@compartilhado/dominio/caixa";
import { compararMarcos, dataNoFuso, diaSemana, formatarMarco } from "@compartilhado/dominio/fuso";

/**
 * Oficina de DEMONSTRAÇÃO. Tudo aqui é fictício: nomes, placas, telefones, protocolos e valores.
 * Seguradoras são as que têm produto Maxpar confirmado publicamente (docs/maxpar-estudo.md §1.3).
 * Tipos de reparo, prazos, capacidade e regras de pagamento são as sugestões do questionário
 * (docs/questionario-dono.md) e ficam marcados como provisórios.
 * As datas são geradas em relação ao momento em que a demonstração é carregada.
 */

export interface EstadoDemo {
  versao: 3;
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
  // sprint SE
  custos: CustoOS[];
  movimentos: MovimentoEstoque[];
  fornecedores: Fornecedor[];
  categorias: CategoriaFinanceira[];
  fechamentos: FechamentoCaixa[];
  auditoria: RegistroAuditoria[];
}

const HORA = 3_600_000;
const DIA = 24 * HORA;

/** Marco no formato único do painel: "2026-10-12T14:30:00-03:00" (fuso da oficina, não o da máquina). */
function iso(d: Date): string {
  return formatarMarco(d.getTime());
}
/** Data de negócio AAAA-MM-DD no fuso da oficina. */
function dataISO(d: Date): string {
  return dataNoFuso(d.getTime());
}

// ---------------------------------------------------------------- documentos de demonstração
// CPF/CNPJ GERADOS por cálculo de dígito verificador a partir de bases sequenciais: válidos no formato,
// sem ligação com nenhuma pessoa ou empresa. Nunca usar documento real aqui (repositório público).
function digitoVerificador(base: string, pesos: readonly number[]): number {
  let soma = 0;
  for (let i = 0; i < base.length; i++) soma += (base.charCodeAt(i) - 48) * pesos[i];
  const r = soma % 11;
  return r < 2 ? 0 : 11 - r;
}
export function cpfDemo(seq: number): string {
  const base = String(123450000 + seq * 1013).padStart(9, "0").slice(-9);
  const d1 = digitoVerificador(base, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digitoVerificador(base + d1, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base}${d1}${d2}`;
}
export function cnpjDemo(seq: number): string {
  const pesos = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const base = `${String(12345600 + seq * 111).padStart(8, "0").slice(-8)}0001`;
  const d1 = digitoVerificador(base, pesos);
  const d2 = digitoVerificador(base + d1, [6, ...pesos]);
  return `${base}${d1}${d2}`;
}

const MARCAS: [string, string][] = [
  ["Range Rover", "Land Rover"],
  ["Land Rover", "Land Rover"],
  ["Mercedes", "Mercedes-Benz"],
  ["BMW", "BMW"],
  ["Volvo", "Volvo"],
  ["Audi", "Audi"],
  ["Porsche", "Porsche"],
  ["Jeep", "Jeep"],
  ["Toyota", "Toyota"],
];
const marcaDoModelo = (modelo: string) => MARCAS.find(([p]) => modelo.startsWith(p))?.[1];

const BAIRROS = ["Centro", "Batel", "Água Verde", "Bigorrilho", "Portão", "Cabral", "Juvevê", "Mercês", "Rebouças", "Hugo Lange"];

const semAcento = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "");

/** Vista do desenho onde a peça fica (aproximação para o mapa de avarias da demonstração). */
function vistaDaPeca(peca: string): VistaAvaria {
  const p = semAcento(peca).toLowerCase();
  if (p.includes("teto")) return "teto";
  if (p.includes("capo") || (p.includes("para-choque dianteiro"))) return "frente";
  if (p.includes("tampa traseira") || p.includes("para-choque traseiro")) return "traseira";
  if (p.includes("direit")) return "lateral_direita";
  return "lateral_esquerda";
}

/** Custo-hora de mão de obra da DEMONSTRAÇÃO (fictício; o valor real vem do dono). */
const CUSTO_HORA_DEMO = 2800;

/** Insumos típicos por tipo de reparo: [material, quantidade, multiplica pelo nº de peças]. */
const INSUMOS_POR_TIPO: Record<string, [string, number, boolean][]> = {
  "tr-martelinho": [["m-12", 6, true], ["m-3", 3, true], ["m-4", 0.1, false], ["m-15", 1, false]],
  "tr-pintura": [["m-9", 5, true], ["m-8", 0.3, true], ["m-2", 0.4, true], ["m-5", 2, false], ["m-13", 0.5, false], ["m-1", 0.5, true], ["m-6", 1, false], ["m-7", 2, false], ["m-10", 5, true]],
  "tr-sra": [["m-3", 4, false], ["m-5", 1, false], ["m-1", 0.2, false], ["m-4", 0.1, false]],
  "tr-polimento": [["m-4", 0.3, false], ["m-11", 0.2, false], ["m-14", 1, false], ["m-15", 2, false], ["m-16", 0.5, false]],
};

/** Formas da franquia nas OS entregues (índice = nº do caso % 4). */
const FORMA_FRANQUIA: Pick<Baixa, "forma" | "parcelas">[] = [{ forma: "credito", parcelas: 2 }, { forma: "pix" }, { forma: "dinheiro" }, { forma: "debito" }];

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
    capacidadePadrao: { vagasEntrada: 4, carrosSimultaneos: 12, pecasDia: 10 },
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
    // sprint SE
    pj?: string; // razão social fictícia: cliente pessoa jurídica (o nome do caso vira o contato)
    clienteDe?: string; // placa de outro caso: mesmo cliente (cliente com mais de um veículo)
    cadastroIncompleto?: boolean; // sem documento nem endereço (mostra o estado "falta cadastro")
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
      pj: "Salles Engenharia Exemplo Ltda", origem: "particular", estado: "na_oficina", tipo: "tr-pintura",
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
      pj: "Frota Exemplo Locações Ltda",
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
      clienteDe: "RTB2E90",
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
      placa: "QWE3R27", modelo: "Toyota Corolla Cross", cor: "Prata", cliente: "Aline Ritter", telefone: "", cadastroIncompleto: true,
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
      clienteDe: "RLM2Q48",
      origem: "maxpar", seguradora: "HDI", protocolo: "18406650", status: "aguardando_autorizacao", estado: "aguardando_aprovacao",
      pecas: [["Capô", "martelinho", 42000, "solicitado"]],
      abertoHaDias: 1, limiteVistoriaDias: 3,
    },
    {
      placa: "RXY6U84", modelo: "Mercedes A200", cor: "Preto", cliente: "Fernanda Lins", telefone: "+5541991000009", cadastroIncompleto: true,
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

  // insumos retirados para as OS (viram movimentos saida_os + custos depois do laço, em ordem de tempo)
  const retiradas: { osId: string; n: number; materialId: string; quantidade: number; em: number; perfilId?: string }[] = [];
  const custos: CustoOS[] = [];
  const indicePorPlaca = new Map(casos.map((c, i) => [c.placa, i + 1]));
  let seqPF = 0;
  let seqPJ = 0;

  casos.forEach((c, i) => {
    const n = i + 1;
    const clienteId = c.clienteDe ? `c-${indicePorPlaca.get(c.clienteDe)}` : `c-${n}`;
    const veiculoId = `v-${n}`;
    const osId = `os-${n}`;
    seqOS += 1;
    const aberturaMs = agoraMs - c.abertoHaDias * DIA - 3 * HORA;
    const prov = c.origem === "maxpar" ? { fonte: "manual" as const, lidoEm: iso(new Date(aberturaMs)) } : undefined;

    if (!c.clienteDe) {
      const pj = Boolean(c.pj);
      const nome = c.pj ?? c.cliente;
      const slug = semAcento(c.cliente).toLowerCase().replace(/[^a-z]+/g, ".");
      clientes.push({
        id: clienteId,
        nome,
        tipoPessoa: c.cadastroIncompleto ? undefined : pj ? "pj" : "pf",
        documento: c.cadastroIncompleto ? undefined : pj ? cnpjDemo(++seqPJ) : cpfDemo(++seqPF),
        telefone: c.telefone || undefined,
        whatsapp: c.telefone && n % 4 !== 0 ? c.telefone : undefined,
        email: !c.cadastroIncompleto && n % 2 === 0 ? `${slug}@example.com` : undefined,
        endereco:
          c.cadastroIncompleto || n % 3 === 0
            ? undefined
            : {
                cep: `80${String(10000 + n * 731).padStart(6, "0")}`,
                logradouro: `Rua Exemplo ${n}`,
                numero: String(100 + n * 17),
                complemento: pj ? "Sala 2" : undefined,
                bairro: BAIRROS[n % BAIRROS.length],
                cidade: "Curitiba",
                uf: "PR",
              },
        observacoes: pj ? `Contato: ${c.cliente}. Cliente de demonstração.` : undefined,
        proveniencia: prov ? { nome: prov, telefone: prov } : undefined,
        // telefones inventados, mas no formato real: a UI não gera link wa.me/tel: para cliente demo
        demo: true,
      });
    }
    veiculos.push({
      id: veiculoId,
      clienteId,
      placa: c.placa,
      marca: marcaDoModelo(c.modelo),
      modelo: c.modelo,
      cor: c.cor,
      ano: 2018 + (n % 7),
      proveniencia: prov ? { placa: prov } : undefined,
    });

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
      let cursor = agoraMs - Math.max(1, c.abertoHaDias - 1) * DIA;
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
    const entradaMs = agoraMs - Math.max(1, c.abertoHaDias - 1) * DIA;

    // recepção do veículo (só nas OS que já entraram): km, combustível, checklist parcial e 1–3 avarias
    let recepcao: RecepcaoVeiculo | undefined;
    if (naOficina) {
      const avarias: Avaria[] = c.pecas.slice(0, 3).map(([peca, tecnica, valor], k) => ({
        id: `av-${n}-${k}`,
        vista: tecnica === "polimento" || tecnica === "outro" ? "lateral_esquerda" : vistaDaPeca(peca),
        x: 0.25 + ((n * 37 + k * 53) % 50) / 100,
        y: 0.3 + ((n * 17 + k * 29) % 40) / 100,
        tipo: tecnica === "martelinho" || tecnica === "funilaria" ? "amassado" : tecnica === "pintura" ? "pintura" : "risco",
        tamanho: valor > 40000 ? "g" : valor > 30000 ? "m" : "p",
        obs: tecnica === "polimento" || tecnica === "outro" ? "Riscos leves de lavagem" : peca,
      }));
      recepcao = {
        km: 12000 + ((n * 7919) % 90000),
        combustivel: NIVEIS_COMBUSTIVEL[n % NIVEIS_COMBUSTIVEL.length] as NivelCombustivel,
        reclamacao: `Cliente relata: ${c.pecas.map((p) => p[0].toLowerCase()).join(", ")}.`,
        obsInternas: n % 4 === 0 ? "Guardar na área coberta; cliente sensível a prazo." : undefined,
        checklist: Object.fromEntries(CHECKLIST_PADRAO.map((item, k) => [item.id, (k + n) % 5 !== 0])),
        avarias,
        registradaEm: iso(new Date(entradaMs)),
        registradaPor: "p-recepcao",
      };
    }

    // custos: insumos (retirados do estoque), mão de obra e um terceiro. RLM2Q48 fica sem custo
    // lançado de propósito (o relatório de margem avisa "OS sem custo").
    if (tipo && naOficina && c.placa !== "RLM2Q48") {
      const pecasN = Math.max(1, c.pecas.filter((p) => (p[3] ?? "autorizado") === "autorizado").length);
      const lista = (INSUMOS_POR_TIPO[tipo.id] ?? []).map(([m, q, porPeca]) => [m, Math.round(q * (porPeca ? pecasN : 1) * 1000) / 1000] as const);
      const fracao = c.estado === "na_oficina" ? Math.min(1, ((c.etapaAtual ?? 0) + 1) / tipo.etapas.length) : 1;
      const quantos = Math.max(1, Math.ceil(lista.length * fracao));
      lista.slice(0, quantos).forEach(([materialId, quantidade], k) => {
        retiradas.push({
          osId,
          n,
          materialId,
          quantidade,
          em: Math.min(entradaMs + (k + 1) * 1.5 * HORA, agoraMs - 20 * 60_000),
          perfilId: c.responsaveis?.[Math.min(k, (c.responsaveis?.length ?? 1) - 1)],
        });
      });
      // mão de obra apontada: metade do tempo das etapas concluídas (a pessoa reveza entre carros), por responsável
      const atual = c.estado === "na_oficina" ? c.etapaAtual ?? 0 : tipo.etapas.length;
      const minutosPorPessoa = new Map<string, number>();
      tipo.etapas.forEach((m, k) => {
        if (k >= atual || c.dispensar?.includes(k)) return;
        const quem = c.responsaveis?.[k] ?? "p-diego";
        minutosPorPessoa.set(quem, (minutosPorPessoa.get(quem) ?? 0) + Math.round(m.prazoPadraoHoras * 0.9 * 60 * 0.5));
      });
      [...minutosPorPessoa].forEach(([perfilId, minutos], k) => {
        const total = custoMaoDeObra({ modo: "hora", minutos, valorUnitario: CUSTO_HORA_DEMO });
        custos.push({
          id: `cu-${n}-mo${k}`,
          osId,
          tipo: "mao_de_obra",
          descricao: `Mão de obra — ${perfis.find((p) => p.id === perfilId)?.nome ?? "funcionário"}`,
          quantidade: Math.round((minutos / 60) * 100) / 100,
          unidade: "h",
          custoUnitario: CUSTO_HORA_DEMO,
          total,
          perfilId,
          minutos,
          lancadoEm: iso(new Date(Math.min(entradaMs + 20 * HORA, agoraMs - HORA))),
          lancadoPor: "p-recepcao",
        });
      });
      if (c.placa === "RKP1L34") {
        custos.push({
          id: `cu-${n}-t1`,
          osId,
          tipo: "terceiro",
          descricao: "Solda plástica no para-choque",
          quantidade: 1,
          custoUnitario: 28000,
          total: totalCusto(1, 28000),
          fornecedor: "Recuperadora de plásticos (exemplo)",
          lancadoEm: iso(new Date(entradaMs + 30 * HORA)),
          lancadoPor: "p-recepcao",
        });
      }
    }

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
      recepcao,
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
        baixas: c.pagamento === "recebido" ? [{ id: `b-${n}`, valor: total - (franquia ?? 0), recebidoEm: d(-8), forma: "transferencia" }] : [],
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
          baixas: [{ id: `b-${n}-f`, valor: franquia, recebidoEm: dataISO(new Date(entregueMs!)), ...FORMA_FRANQUIA[n % FORMA_FRANQUIA.length] }],
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
    baixas: [{ id: "b-rkp", valor: 100000, recebidoEm: d(-8), forma: "pix" }],
  });
  // particular na oficina: sinal em dinheiro hoje (entra no fechamento de caixa)
  titulos.push({
    id: "t-sch-particular",
    osId: "os-6",
    pagadorId: "pg-cliente",
    descricao: "Serviço particular — polimento e higienização",
    valor: 130000,
    vencimento: d(0),
    estado: "parcial",
    baixas: [{ id: "b-sch", valor: 40000, recebidoEm: d(0), forma: "dinheiro", obs: "Sinal na entrada" }],
  });
  // pronto para entrega: franquia adiantada em dinheiro hoje
  titulos.push({
    id: "t-7-f",
    osId: "os-7",
    pagadorId: "pg-cliente",
    descricao: "Franquia",
    valor: 16000,
    vencimento: d(0),
    estado: "recebido",
    baixas: [{ id: "b-7-f", valor: 16000, recebidoEm: d(0), forma: "dinheiro" }],
  });

  // ---------------------------------------------------------------- capacidade (exceções)
  const capacidades: CapacidadeDia[] = [{ data: d(4), vagasEntrada: 0, bloqueado: "Feriado municipal (exemplo)" }];

  // ---------------------------------------------------------------- categorias, fornecedores e despesas (fictícios)
  const categorias: CategoriaFinanceira[] = CATEGORIAS_PADRAO.map((c) => ({ ...c }));
  const cat = (id: string) => ({ categoriaId: id, categoria: categorias.find((c) => c.id === id)!.nome });

  const fornecedores: Fornecedor[] = [
    { id: "f-1", nome: "Distribuidora de Tintas Exemplo", documento: cnpjDemo(11), telefone: "+554133000001", email: "vendas@example.com", obs: "Fornecedor de demonstração" },
    { id: "f-2", nome: "Abrasivos Modelo Comércio", documento: cnpjDemo(12), telefone: "+554133000002", obs: "Fornecedor de demonstração" },
    { id: "f-3", nome: "EPI e Químicos Fictícia", documento: cnpjDemo(13), telefone: "+554133000003", obs: "Fornecedor de demonstração" },
  ];

  // último dia antes de hoje em que a oficina abre (para o fechamento de caixa anterior)
  const ontemUtil = diaSemana(d(-1)) === 0 ? d(-2) : d(-1);

  const despesas: Despesa[] = [
    { id: "d-1", ...cat("desp_aluguel"), descricao: "Aluguel do barracão", valorPrevisto: 850000, vencimento: d(3) },
    { id: "d-2", ...cat("desp_energia_agua"), descricao: "Conta de energia", valorPrevisto: 128000, vencimento: d(6) },
    { id: "d-3", ...cat("desp_mat_pintura"), descricao: "Tinta base e verniz", fornecedor: "Distribuidora de Tintas Exemplo", valorPrevisto: 214000, vencimento: d(-2), pagoEm: d(-2), valorPago: 214000, formaPagamento: "boleto" },
    { id: "d-4", ...cat("desp_mat_polimento"), descricao: "Massa de polir e boinas", valorPrevisto: 46000, vencimento: d(-5), pagoEm: d(-5), valorPago: 46000, formaPagamento: "pix" },
    { id: "d-5", ...cat("desp_ferramentas"), descricao: "Kit de alavancas para martelinho", valorPrevisto: 98000, vencimento: d(12) },
    { id: "d-6", ...cat("desp_salarios"), descricao: "Folha do mês (lançamento manual)", valorPrevisto: 1820000, vencimento: d(18) },
    { id: "d-7", ...cat("desp_impostos"), descricao: "Simples Nacional", valorPrevisto: 312000, vencimento: d(-1) },
    { id: "d-8", ...cat("desp_marketing"), descricao: "Impulsionamento redes sociais", valorPrevisto: 30000, vencimento: d(-10), pagoEm: d(-10), valorPago: 30000, formaPagamento: "credito" },
    { id: "d-9", ...cat("desp_outras"), descricao: "Café e material de limpeza", valorPrevisto: 8500, vencimento: d(0), pagoEm: d(0), valorPago: 8500, formaPagamento: "dinheiro" },
    { id: "d-10", ...cat("desp_terceiros"), descricao: "Frete de material", valorPrevisto: 4500, vencimento: ontemUtil, pagoEm: ontemUtil, valorPago: 4500, formaPagamento: "dinheiro" },
    { id: "d-11", ...cat("desp_manutencao"), descricao: "Manutenção do compressor", valorPrevisto: 32000, vencimento: d(8) },
  ];

  // ---------------------------------------------------------------- estoque: materiais e movimentos dos últimos 60 dias
  // [id, nome, categoria, unidade, custo base, mínimo, saldo final desejado, fornecedor, conferência há N dias, entradas [há N dias, qtd]]
  const TABELA: [string, string, string, string, number, number, number, string, number, [number, number][]][] = [
    ["m-1", "Verniz alto sólido", "Tinta e verniz", "L", 18900, 5, 3.5, "f-1", 20, [[40, 4]]],
    ["m-2", "Primer PU cinza", "Massa e primer", "L", 9800, 4, 8, "f-1", 20, [[40, 5]]],
    ["m-3", "Lixa P1500", "Lixa e abrasivo", "folha", 350, 50, 0, "f-2", 20, [[45, 30]]],
    ["m-4", "Massa de polir corte", "Polidor e cera", "kg", 15400, 1, 2.2, "f-2", 120, []],
    ["m-5", "Fita crepe automotiva 48 mm", "Fita e mascaramento", "rolo", 1900, 10, 14, "f-3", 20, [[30, 12]]],
    ["m-6", "Thinner de limpeza", "Solvente", "L", 2600, 6, 12, "f-1", 20, [[35, 10]]],
    ["m-7", "Máscara PFF2", "EPI", "un", 450, 10, 6, "f-3", 20, [[50, 20]]],
    ["m-8", "Massa poliéster", "Massa e primer", "kg", 3200, 2, 4.5, "f-1", 25, [[38, 3]]],
    ["m-9", "Lixa P400", "Lixa e abrasivo", "folha", 280, 40, 85, "f-2", 25, [[42, 50]]],
    ["m-10", "Lixa P800", "Lixa e abrasivo", "folha", 300, 40, 60, "f-2", 25, [[42, 50]]],
    ["m-11", "Massa de polir refino", "Polidor e cera", "kg", 16800, 1, 1.6, "f-2", 25, []],
    ["m-12", "Bastão de cola para martelinho", "Martelinho", "un", 120, 30, 70, "f-3", 15, [[33, 60]]],
    ["m-13", "Papel de mascaramento", "Fita e mascaramento", "rolo", 4500, 2, 3, "f-1", 15, []],
    ["m-14", "Boina de lã para politriz", "Polidor e cera", "un", 3800, 3, 5, "f-2", 15, [[28, 4]]],
    ["m-15", "Flanela microfibra", "Limpeza", "un", 900, 12, 20, "f-3", 15, [[36, 24]]],
    ["m-16", "Limpador multiuso (APC)", "Limpeza", "L", 2200, 5, 9, "f-3", 15, [[31, 5]]],
  ];

  // retiradas da oficina sem OS (consumo interno)
  const consumos: { materialId: string; quantidade: number; diasAtras: number; perfilId: string; obs: string }[] = [
    { materialId: "m-15", quantidade: 4, diasAtras: 21, perfilId: "p-andre", obs: "Limpeza da área de entrega" },
    { materialId: "m-7", quantidade: 6, diasAtras: 12, perfilId: "p-marcos", obs: "Troca das máscaras da cabine" },
    { materialId: "m-16", quantidade: 1, diasAtras: 6, perfilId: "p-andre", obs: "Limpeza da recepção" },
  ];

  interface Plano {
    mov: Omit<MovimentoEstoque, "id"> & { id?: string };
    ms: number;
    custoId?: string;
    n?: number;
  }
  const planos: Plano[] = [];
  TABELA.forEach(([id, , , , base, , , forn, , entradas]) => {
    entradas.forEach(([dias, q], k) =>
      planos.push({
        mov: { materialId: id, tipo: "entrada_compra", quantidade: q, custoUnitario: Math.round(base * (k % 2 === 0 ? 1.06 : 0.97)), fornecedorId: forn, em: "" },
        ms: agoraMs - dias * DIA + 2 * HORA,
      }),
    );
  });
  consumos.forEach((c) =>
    planos.push({ mov: { materialId: c.materialId, tipo: "consumo_interno", quantidade: c.quantidade, perfilId: c.perfilId, obs: c.obs, em: "" }, ms: agoraMs - c.diasAtras * DIA }),
  );
  const contPorOS = new Map<number, number>();
  retiradas.forEach((r) => {
    const k = contPorOS.get(r.n) ?? 0;
    contPorOS.set(r.n, k + 1);
    planos.push({
      mov: { materialId: r.materialId, tipo: "saida_os", quantidade: r.quantidade, osId: r.osId, perfilId: r.perfilId, em: "" },
      ms: r.em,
      custoId: `cu-${r.n}-i${k}`,
      n: r.n,
    });
  });
  planos.sort((a, b) => a.ms - b.ms);

  const q3 = (v: number) => Math.round(v * 1000) / 1000;
  const materiais: Material[] = [];
  const movimentos: MovimentoEstoque[] = [];
  TABELA.forEach(([id, nome, categoria, unidade, base, minimo, alvo, forn, conf]) => {
    const meus = planos.filter((p) => p.mov.materialId === id);
    // saldo inicial (antes da janela de 60 dias) que leva ao saldo final desejado sem nunca ficar negativo
    let saldo0 = q3(alvo + meus.reduce((s, p) => s + (p.mov.tipo === "entrada_compra" ? -1 : 1) * p.mov.quantidade, 0));
    let corrente = saldo0;
    let minimoVisto = 0;
    for (const p of meus) {
      corrente = q3(corrente + (p.mov.tipo === "entrada_compra" ? 1 : -1) * p.mov.quantidade);
      minimoVisto = Math.min(minimoVisto, corrente);
    }
    saldo0 = q3(Math.max(0, saldo0 - minimoVisto));
    let mat: Material = { id, nome, categoria, unidade, saldoEstimado: 0, saldoMinimo: minimo, custoMedio: base, fornecedorId: forn, ultimaConferenciaEm: d(-conf) };
    const aplicar = (mov: MovimentoEstoque) => {
      const r = aplicarMovimento(mat, mov);
      if (!r.ok) throw new Error(`demo inconsistente (${id}): ${r.codigo}`);
      mat = r.material;
      movimentos.push(mov);
    };
    if (saldo0 > 0)
      aplicar({ id: `mv-${id}-ini`, materialId: id, tipo: "ajuste", sentido: "mais", quantidade: saldo0, obs: "Saldo inicial na implantação (demonstração)", em: iso(new Date(agoraMs - 60 * DIA)) });
    meus.forEach((p, k) => {
      const em = iso(new Date(p.ms));
      if (p.mov.tipo === "saida_os") {
        const custoUnitario = mat.custoMedio;
        const mov: MovimentoEstoque = { ...p.mov, id: `mv-${p.custoId}`, custoUnitario, em };
        aplicar(mov);
        custos.push({
          id: p.custoId!,
          osId: p.mov.osId!,
          tipo: "insumo",
          descricao: nome,
          quantidade: p.mov.quantidade,
          unidade,
          custoUnitario,
          total: totalCusto(p.mov.quantidade, custoUnitario),
          materialId: id,
          perfilId: p.mov.perfilId,
          lancadoEm: em,
          lancadoPor: "p-recepcao",
        });
      } else {
        aplicar({ ...p.mov, id: `mv-${id}-${k}`, em } as MovimentoEstoque);
      }
    });
    // se a correção de saldo negativo deixou o saldo acima do desejado, a conferência acerta (ajuste "menos")
    const sobra = q3(mat.saldoEstimado - alvo);
    if (sobra > 0) {
      const ultimo = Math.max(agoraMs - 60 * DIA, ...meus.map((p) => p.ms));
      const em = iso(new Date(Math.min(ultimo + HORA, agoraMs - 10 * 60_000)));
      aplicar({ id: `mv-${id}-conf`, materialId: id, tipo: "ajuste", sentido: "menos", quantidade: sobra, obs: "Conferência de estoque: contagem menor que o sistema", em });
      mat = { ...mat, ultimaConferenciaEm: em.slice(0, 10) };
    }
    materiais.push(mat);
  });

  // ---------------------------------------------------------------- caixa: dois fechamentos anteriores (só dinheiro)
  const fechamentos: FechamentoCaixa[] = [];
  const diaAnterior = d(-3) < ontemUtil ? d(-3) : d(-4);
  const f1 = calcularFechamento({ saldoInicial: 20000, contado: 0, titulos, despesas, data: diaAnterior });
  fechamentos.push({ id: "fc-1", ...f1, contado: f1.esperado, diferenca: 0, fechadoPor: "p-recepcao", fechadoEm: `${diaAnterior}T18:05:00-03:00` });
  const f2 = calcularFechamento({ saldoInicial: f1.esperado, contado: 0, titulos, despesas, data: ontemUtil });
  fechamentos.push({
    id: "fc-2",
    ...f2,
    contado: f2.esperado - 500,
    diferenca: -500,
    obs: "Faltaram R$ 5,00; provável troco errado.",
    fechadoPor: "p-recepcao",
    fechadoEm: `${ontemUtil}T18:10:00-03:00`,
  });

  // ---------------------------------------------------------------- auditoria (algumas linhas de exemplo)
  const auditoria: RegistroAuditoria[] = [
    { id: "au-1", em: `${diaAnterior}T18:05:00-03:00`, perfilId: "p-recepcao", acao: "fechar_caixa", entidade: "fechamento_caixa", entidadeId: "fc-1", resumo: "Fechamento de caixa sem diferença" },
    { id: "au-2", em: `${ontemUtil}T18:10:00-03:00`, perfilId: "p-recepcao", acao: "fechar_caixa", entidade: "fechamento_caixa", entidadeId: "fc-2", resumo: "Fechamento de caixa com falta de R$ 5,00" },
    { id: "au-3", em: iso(new Date(agoraMs - 40 * DIA + 2 * HORA)), perfilId: "p-dono", acao: "entrada_compra", entidade: "material", entidadeId: "m-1", resumo: "Entrada de 4 L de Verniz alto sólido" },
    { id: "au-4", em: h(-3), perfilId: "p-recepcao", acao: "baixa", entidade: "titulo_receber", entidadeId: "t-7-f", resumo: "Franquia de R$ 160,00 recebida em dinheiro (OS #1047)" },
    { id: "au-5", em: h(-2), perfilId: "p-recepcao", acao: "baixa", entidade: "titulo_receber", entidadeId: "t-sch-particular", resumo: "Sinal de R$ 400,00 recebido em dinheiro (OS #1046)" },
    { id: "au-6", em: h(-1), perfilId: "p-paula", acao: "pagar", entidade: "despesa", entidadeId: "d-9", resumo: "Despesa paga: Café e material de limpeza, R$ 85,00 em dinheiro" },
  ].sort((a, b) => compararMarcos(b.em, a.em));

  return {
    versao: 3,
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
    custos: custos.sort((a, b) => compararMarcos(a.lancadoEm, b.lancadoEm)),
    movimentos: movimentos.sort((a, b) => compararMarcos(b.em, a.em)),
    fornecedores,
    categorias,
    fechamentos: fechamentos.sort((a, b) => b.data.localeCompare(a.data)),
    auditoria,
  };
}

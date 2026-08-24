export type TipoArquivoSped = "efd_icms_ipi" | "efd_contribuicoes" | "ecd" | "ecf";

/** Um registro SPED já tokenizado: reg=nome do registro (ex.: "C100"), campos=valores entre pipes, na ordem do layout oficial. */
export interface RegistroSped {
  reg: string;
  campos: string[];
}

export type RegimeParceiro = "simples_nacional" | "pessoa_fisica" | "normal" | "desconhecido";

export interface Participante {
  codPart: string;
  nome: string;
  cnpj?: string;
  cpf?: string;
  /** preenchido depois, via consulta à Receita Federal (BrasilAPI) — participante não sabe seu próprio regime a partir do SPED */
  regime: RegimeParceiro;
  /** true quando o participante NÃO gera crédito integral de CBS/IBS para o cliente (Simples unificado ou PF) */
  restringeCreditoDoCliente: boolean;
  /** CNAE principal (código), preenchido junto com o regime via consulta à Receita Federal — usado para identificar produtor rural PESSOA JURÍDICA (divisão 01), que o CPF/CNPJ isolado não revela. */
  cnaePrincipal?: string | number;
}

export type NaturezaMovimento =
  | "faturamento"
  | "custoMercadoriaInsumo"
  | "despesaOperacional"
  | "despesaAdministrativa"
  | "usoConsumo"
  | "imobilizado"
  | "outros";

export interface MovimentoNota {
  origem: "efd_icms_ipi" | "efd_contribuicoes";
  indOper: "entrada" | "saida";
  codPart: string;
  cfop: string;
  valorItem: number;
  natureza: NaturezaMovimento;
  /** NCM do item, quando o registro 0200 (Tabela de Identificação do Item) cadastra o item movimentado — usado para cruzar com regimes especiais por produto (ver produtoRegimeEspecial.ts). */
  ncm?: string;
}

export interface ApuracaoTributoPeriodo {
  tributo: "icms" | "pis" | "cofins";
  periodo: string;
  valorRecolher: number;
}

export interface SaldoContaContabil {
  codCta: string;
  descricao: string;
  natureza: NaturezaMovimento;
  valorPeriodo: number;
}

/**
 * Resumo mínimo da ECF (Bloco M/Y) — extensão ADITIVA e opcional. Só existe
 * quando o valor pôde ser extraído com confiança de um registro cuja posição
 * de campo já foi validada contra um leiaute real; caso contrário, o campo
 * fica ausente (nunca um valor fabricado — ver docs/ingestao-documental-v2.md
 * §L). Nesta fase, sem fixture real de ECF disponível para validar posições
 * do Bloco M/Y, `resumoEcf` normalmente vem ausente/parcial — ver
 * `sped/ecf.ts` para o que já é seguro detectar (presença de blocos) vs. o
 * que exige validação empírica antes de extrair (valores).
 */
export interface ResumoEcf {
  regime?: string;
  receitaBruta?: number;
  resultadoAntesIr?: number;
  baseIrpj?: number;
  baseCsll?: number;
  prejuizoFiscalAcumulado?: number;
  baseNegativaCsllAcumulada?: number;
  /** Registros do leiaute detectados no arquivo (ex.: "M300", "Y540") — presença confirmada, conteúdo NÃO extraído/validado. */
  blocosDetectadosNaoExtraidos?: string[];
}

export interface ArquivoSpedProcessado {
  tipo: TipoArquivoSped;
  nomeArquivo: string;
  periodoInicio?: string;
  periodoFim?: string;
  participantes: Participante[];
  movimentos: MovimentoNota[];
  apuracoes: ApuracaoTributoPeriodo[];
  saldosContabeis: SaldoContaContabil[];
  /**
   * Receita bruta consolidada do período (registros F500/F550 da EFD Contribuições) —
   * fonte estrutural alternativa de faturamento para quando a empresa declara só o
   * demonstrativo de apuração consolidado, sem nota a nota (A100/C170). Ausente quando
   * o arquivo não tem F500/F550.
   */
  receitaConsolidada?: number;
  /** Só preenchido para `tipo === "ecf"` — ver `ResumoEcf`. */
  resumoEcf?: ResumoEcf;
  avisos: string[];
}

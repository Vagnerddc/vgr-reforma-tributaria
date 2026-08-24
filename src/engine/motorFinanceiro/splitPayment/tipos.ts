/**
 * Contrato do Motor de Split Payment / Capital de Giro — consome
 * `ResultadoRegime` (motor fiscal já calculado) e `ResultadoEconomicoFinanceiro`
 * (Motor Financeiro já calculado); NUNCA calcula tributo, NUNCA recalcula
 * IBS/CBS/DAS/IRPJ/CSLL, NUNCA determina cClassTrib/alíquota. Fronteira igual
 * à do Motor Financeiro (ver docs/motor-financeiro.md, seção B): só lê
 * `cargaTotal`/`resultado` já prontos.
 *
 * Este módulo responde uma pergunta diferente das duas camadas abaixo: não
 * "quanto a empresa paga" (Motor Fiscal) nem "o que isso faz com o
 * resultado" (Motor Financeiro), mas "QUANDO o dinheiro fica disponível" —
 * ver docs/motor-split-payment.md, seção B, para a fronteira completa.
 */

import type { CampoComProveniencia } from "../../operacaoTributaria";
import type { Regime, MeioPagamento } from "../../types";
import type { StatusComparabilidade } from "../../motorRegimes/comparadorConsolidado";

/**
 * Distingue explicitamente o que é regra normativa CONFIRMADA (ex.: LC
 * 214/2025, art. 348 — 2026 é ano-teste; art. 34, II — segregação
 * proporcional em parcelamento) do que é premissa de simulação financeira
 * porque a regulamentação infralegal (Comitê Gestor do IBS) ainda não fixou
 * o mecanismo/percentual definitivo — ver normativa.ts. NENHUM campo deste
 * módulo pode ser tratado como fato apurado quando sua origem aqui é
 * "premissa_simulacao".
 */
export type OrigemSplitPayment = "regra_normativa_confirmada" | "premissa_simulacao";

/**
 * Premissas explícitas do módulo — nenhuma tem valor padrão inventado pelo
 * sistema. Ausência de uma premissa não trava o cálculo, mas limita o que
 * pode ser calculado e produz `qualidade: "parcial"/"insuficiente"` (nunca
 * um número calculado silenciosamente com um percentual assumido).
 */
export interface PremissasSplitPayment {
  /** 0 a 1 — fração da RECEITA que está sujeita ao split payment (nunca assumido como 100%, seção 6 do pedido). */
  percentualRecebimentosSujeitos?: CampoComProveniencia<number>;
  /**
   * 0 a 1 — fração do RECEBIMENTO (não do tributo apurado, seção 7 do
   * pedido) que é segregada no momento da liquidação financeira, sobre a
   * parcela sujeita. Relação entre tributo apurado e tributo segregado
   * financeiramente é sempre uma premissa nesta fase — ver normativa.ts.
   */
  percentualTributoSegregado?: CampoComProveniencia<number>;
  /** Prazo médio (dias) entre o recebimento e o pagamento do tributo no fluxo ATUAL (sem split) — premissa, nunca um valor único assumido para todas as empresas (seção 14 do pedido). */
  prazoAtualPagamentoTributosDias?: CampoComProveniencia<number>;
  /** Taxa de custo de capital/financiamento, por mês (ex.: 0.01 = 1% a.m.) — ausente = custo financeiro "indeterminado", nunca uma taxa default (seção 16/17 do pedido). */
  taxaCustoCapitalMensal?: CampoComProveniencia<number>;
  /** Saldo mínimo de caixa operacional que a empresa pretende manter — opcional (seção 28 do pedido). */
  caixaMinimoOperacional?: CampoComProveniencia<number>;
  /**
   * Distribuição mensal da receita (12 posições, somando 1) para setores
   * sazonais (aviação agrícola, cerealista, frigorífico — seção 26/27 do
   * pedido). Ausente = distribuição uniforme (1/12 por mês), sempre com
   * alerta explícito de que é premissa, não dado real.
   */
  distribuicaoMensalReceita?: CampoComProveniencia<number[]>;
}

export type QualidadeImpactoCaixa = "alta" | "media" | "parcial" | "insuficiente";

export type CodigoAchadoCaixa =
  | "REDUCAO_DISPONIBILIDADE_CAIXA"
  | "CAPITAL_GIRO_ADICIONAL"
  | "PICO_CAPITAL_GIRO"
  | "CUSTO_FINANCEIRO_ADICIONAL"
  | "DADOS_SPLIT_INSUFICIENTES"
  | "PREMISSA_SPLIT_NAO_CONFIRMADA";

export interface AchadoCaixa {
  codigo: CodigoAchadoCaixa;
  /** Valor objetivo do fato (R$, dias ou %, conforme o código) — nunca um julgamento de severidade (mesmo princípio de motorFinanceiro/achados.ts). */
  valor: number;
  descricao: string;
}

export interface ResultadoMesImpactoCaixa {
  mes: number; // 1-12
  receita?: number;
  recebimentoBruto?: number;
  valorSegregado?: number;
  caixaLiquido?: number;
  caixaDisponivelAntesTributo?: number;
  reducaoDisponibilidadeCaixa?: number;
  necessidadeCapitalGiro?: number;
  /** `undefined` quando `taxaCustoCapitalMensal` não foi informada — nunca 0 (0 significaria "custo zero", não "não calculado"). */
  custoFinanceiro?: number;
  financiamentoAdicionalNecessario?: number;
}

export interface ResultadoImpactoCaixa {
  regime: Regime;
  ano: number;
  disponivel: boolean;
  meioPagamentoPredominante?: MeioPagamento;
  /** Tributo apurado no ano, reaproveitado de `ResultadoRegime.anos[].cargaTotal` — nunca recalculado aqui. */
  tributoFiscalReferencia?: number;
  meses: ResultadoMesImpactoCaixa[];
  valorTotalSegregado?: number;
  impactoMedioCaixa?: number;
  /** Maior necessidade de capital de giro adicional observada em um único mês do ano — não é a soma dos meses (seção 32/33 do pedido: nunca somar estoque como se fosse despesa mensal). */
  picoCapitalGiroAdicional?: number;
  mesPicoCapitalGiro?: number;
  /** Média simples dos 12 meses — métrica complementar ao pico, nunca substitui-o. */
  capitalGiroAdicionalMedio?: number;
  /** Soma do custo financeiro mensal — só quando todos os meses tiveram taxa informada; `undefined` caso contrário. */
  custoFinanceiroAnual?: number;
  /** redução anual de disponibilidade ÷ necessidade média diária de caixa (receita anual ÷ 360) — metodologia fixa, ver normativa.ts/docs seção J. */
  diasEquivalentesCaixaPerdidos?: number;
  qualidade: QualidadeImpactoCaixa;
  /** Comparabilidade fiscal herdada do Comparador Consolidado — nunca recalculada aqui (mesmo padrão do Motor Financeiro). */
  comparabilidadeFiscal?: StatusComparabilidade;
  /** true quando o resultado fiscal de origem não é comparável/está com ressalva, OU quando premissas-chave do split não são regra confirmada — nunca usado para construir um ranking definitivo entre regimes. */
  estimativaCondicionada: boolean;
  premissas: PremissasSplitPayment;
  alertas: string[];
  achados: AchadoCaixa[];
}

/** Indicador puramente matemático de comparação entre regimes (seção 34-37 do pedido) — NUNCA "regime recomendado". */
export interface ComparacaoImpactoCaixaRegimes {
  ano: number;
  resultados: ResultadoImpactoCaixa[];
  /** Regime com menor `picoCapitalGiroAdicional` entre os CALCULADOS com dados suficientes — indicador matemático, não recomendação. */
  regimeComMenorNecessidadeCapital?: Regime;
}

/**
 * Contrato do Motor Econômico-Financeiro — consome `ResultadoRegime`
 * (motores fiscais) e `CenarioEmpresa`; NUNCA calcula tributo. Fronteira
 * rígida (seção 1 do pedido): este módulo não importa `parametros.json`,
 * não lê tabelas do Simples/Presumido/Real, não recalcula IRPJ/CSLL/DAS/
 * IBS/CBS/Fator R — só lê `cargaTotal` já pronto de `ResultadoAnoRegime`.
 */

import type { CampoComProveniencia } from "../operacaoTributaria";
import type { Regime } from "../types";
import type { StatusComparabilidade } from "../motorRegimes/comparadorConsolidado";

/**
 * Premissas explícitas do Motor Financeiro — nunca inferidas. Todas
 * opcionais; ausência de uma premissa não trava o cálculo, mas limita o
 * que pode ser calculado (ex.: sem `percentualCustosVariaveis`, todo
 * custo é tratado como fixo — ver precoNecessario.ts).
 */
export interface PremissasFinanceiras {
  /** 0 a 1 — fração dos custos/despesas que escala com a receita quando o preço é reajustado. Ausente = 0 (todo custo tratado como fixo, premissa conservadora, nunca assume proporcionalidade sem dado — seção 23 do pedido). */
  percentualCustosVariaveis?: CampoComProveniencia<number>;
  /** Margem que o cenário de preservação de preço deve buscar — ausente = usa a margem do ano-base (seção 20). */
  margemAlvo?: CampoComProveniencia<number>;
}

export type QualidadeFinanceira = "alta" | "media" | "baixa" | "insuficiente";

export type CodigoAchadoFinanceiro = "MARGEM_REDUZIDA" | "MARGEM_PRESERVADA" | "MARGEM_NEGATIVA" | "IMPACTO_ANUAL_RELEVANTE" | "REAJUSTE_PRECO_NECESSARIO" | "DADOS_ECONOMICOS_INSUFICIENTES";

export interface AchadoFinanceiro {
  codigo: CodigoAchadoFinanceiro;
  /** Valor objetivo do fato (p.p., R$ ou %, conforme o código) — nunca um julgamento de severidade (seção 45 do pedido: threshold estratégico vem depois). */
  valor: number;
  descricao: string;
}

/** Um cenário de repasse de preço (seção 28) — sempre nomeado pelo percentual de repasse, nunca "recomendado". */
export interface ResultadoCenarioRepasse {
  percentualRepasse: number;
  receita: number;
  /** receita ÷ receita do ano-base − 1, em %. */
  reajusteEquivalente: number;
  resultado: number;
  margem: number;
  impactoReais: number;
}

export interface ResultadoAnoEconomicoFinanceiro {
  ano: number;
  regime: Regime;
  disponivel: boolean;
  receita?: number;
  custosDespesas?: number;
  cargaFiscalUtilizada?: number;
  resultado?: number;
  margem?: number;
  /** Em pontos percentuais — margem(ano) − margem(ano-base). Nunca confundido com variação relativa (seção 16 do pedido). */
  erosaoMargemPp?: number;
  impactoAnualReais?: number;
  impactoTributarioReais?: number;
  reajusteMedioNecessario?: number;
  cenariosRepasse?: ResultadoCenarioRepasse[];
  qualidade: QualidadeFinanceira;
  /** Comparabilidade fiscal herdada do Comparador Consolidado (seção 8 do pedido) — nunca recalculada aqui. */
  comparabilidadeFiscal?: StatusComparabilidade;
  alertas: string[];
  achados: AchadoFinanceiro[];
}

export interface ResultadoEconomicoFinanceiro {
  regime: Regime;
  anoBase: number;
  anos: ResultadoAnoEconomicoFinanceiro[];
  /** undefined quando algum ano do horizonte está indisponível — nunca soma anos indisponíveis como zero (seção 37 do pedido). */
  impactoAcumulado?: number;
  impactoAcumuladoParcial: boolean;
  premissas: PremissasFinanceiras;
}

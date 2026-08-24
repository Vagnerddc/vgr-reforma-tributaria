/**
 * Extratores de estado/métrica a partir de um `ResultadoCenario` JÁ
 * CALCULADO pelo Motor de Cenários — nenhum cálculo fiscal/financeiro
 * próprio, só leitura estruturada (mesmo princípio de
 * motorCenarios/achados.ts, cujo `anexoUsadoPorRegime` é reaproveitado
 * aqui, não duplicado).
 */

import type { Regime } from "../types";
import type { ResultadoCenario } from "../motorCenarios/tipos";
import { anexoUsadoPorRegime } from "../motorCenarios/achados";

export function menorCargaComparavelNoAno(resultado: ResultadoCenario, ano: number): Regime | undefined {
  return resultado.comparacaoRegimes?.porAno.find((a) => a.ano === ano)?.menorCargaComparavel;
}

export function anexoSimplesNoAno(resultado: ResultadoCenario, regime: Regime, ano: number): string | undefined {
  return anexoUsadoPorRegime(resultado, regime, ano);
}

export function statusJuridicoNoAno(resultado: ResultadoCenario, regime: Regime, ano: number): string | undefined {
  return resultado.comparacaoRegimes?.porAno.find((a) => a.ano === ano)?.porRegime.find((r) => r.regime === regime)?.statusJuridico;
}

export function margemDoRegimeNoAno(resultado: ResultadoCenario, regime: Regime, ano: number): number | undefined {
  return resultado.resultadoFinanceiroPorRegime.find((r) => r.regime === regime)?.resultado.anos.find((a) => a.ano === ano)?.margem;
}

export function resultadoEconomicoDoRegimeNoAno(resultado: ResultadoCenario, regime: Regime, ano: number): number | undefined {
  return resultado.resultadoFinanceiroPorRegime.find((r) => r.regime === regime)?.resultado.anos.find((a) => a.ano === ano)?.resultado;
}

export function custoFinanceiroDoRegimeNoAno(resultado: ResultadoCenario, regime: Regime, ano: number): number | undefined {
  return resultado.resultadoCaixaPorRegime?.find((r) => r.regime === regime)?.anos.find((a) => a.ano === ano)?.custoFinanceiroAnual;
}

export function picoCapitalGiroDoRegimeNoAno(resultado: ResultadoCenario, regime: Regime, ano: number): number | undefined {
  return resultado.resultadoCaixaPorRegime?.find((r) => r.regime === regime)?.anos.find((a) => a.ano === ano)?.picoCapitalGiroAdicional;
}

/** true quando ALGUM mês do ano exigiu financiamento adicional (caixa abaixo do mínimo operacional informado) — mesmo critério usado em motorCenarios/achados.ts::detectarMudancasEntrePontos. */
export function excedeuLimiteCapitalGiro(resultado: ResultadoCenario, regime: Regime, ano: number): boolean | undefined {
  const meses = resultado.resultadoCaixaPorRegime?.find((r) => r.regime === regime)?.anos.find((a) => a.ano === ano)?.meses;
  if (!meses) return undefined;
  return meses.some((m) => (m.financiamentoAdicionalNecessario ?? 0) > 0);
}

/** Comparabilidade do regime no ano — usada para detectar regiões `nao_comparavel`/`indeterminado` dentro do intervalo de busca (seção 35). */
export function comparabilidadeDoRegimeNoAno(resultado: ResultadoCenario, regime: Regime, ano: number) {
  return resultado.comparacaoRegimes?.porAno.find((a) => a.ano === ano)?.porRegime.find((r) => r.regime === regime)?.status;
}

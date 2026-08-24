/**
 * Coleta de indicadores por regime/ano — leitura direta de
 * `ResultadoCenario` (motorCenarios), nunca recálculo. Mesmo padrão de
 * coleta já usado em `motorDecisao/regime.ts::coletarMetricas` —
 * reaproveitado aqui via as mesmas fontes, não duplicado como fórmula.
 */

import type { Regime } from "../../types";
import type { ResultadoCenario } from "../../motorCenarios/tipos";
import type { ResumoComparativoRegimeAno } from "../../motorRegimes/comparadorConsolidado";

export interface IndicadoresRegime {
  regime: Regime;
  resumo: ResumoComparativoRegimeAno;
  resultadoEconomico?: number;
  margem?: number;
  picoCapitalGiro?: number;
  custoFinanceiroAnual?: number;
}

export function coletarIndicadores(resultado: ResultadoCenario, ano: number): IndicadoresRegime[] {
  const anoComp = resultado.comparacaoRegimes?.porAno.find((a) => a.ano === ano);
  const porRegime = anoComp?.porRegime ?? [];

  return porRegime.map((resumo) => {
    const financeiro = resultado.resultadoFinanceiroPorRegime.find((r) => r.regime === resumo.regime)?.resultado.anos.find((a) => a.ano === ano);
    const caixa = resultado.resultadoCaixaPorRegime?.find((r) => r.regime === resumo.regime)?.anos.find((a) => a.ano === ano);
    return { regime: resumo.regime, resumo, resultadoEconomico: financeiro?.resultado, margem: financeiro?.margem, picoCapitalGiro: caixa?.picoCapitalGiroAdicional, custoFinanceiroAnual: caixa?.custoFinanceiroAnual };
  });
}

/** Só os regimes efetivamente comparáveis participam do score relativo (seção 43/44/90) — inelegíveis/obrigatórios/não-comparáveis nunca entram na normalização. */
export function candidatosComparaveis(indicadores: IndicadoresRegime[]): IndicadoresRegime[] {
  return indicadores.filter((i) => i.resumo.status === "comparavel" || i.resumo.status === "comparavel_com_ressalvas");
}

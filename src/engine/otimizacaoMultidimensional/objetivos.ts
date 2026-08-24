/**
 * Extração de objetivos — leitura direta de `ResultadoCenario` (mesmo
 * padrão de coleta já usado em `motorDecisao/regime.ts` e
 * `scoreEstrategico/dimensoes/dados.ts`), nunca recálculo. `indisponível`
 * NUNCA se torna zero (seção "indeterminado nunca vira zero").
 */

import type { Regime } from "../types";
import type { ResultadoCenario } from "../motorCenarios/tipos";
import { DIRECAO_POR_OBJETIVO, type Objetivo, type ValoresObjetivo } from "./tipos";

export function extrairObjetivo(objetivo: Objetivo, resultado: ResultadoCenario, regime: Regime, ano: number): ValoresObjetivo {
  switch (objetivo) {
    case "minimizar_carga_fiscal": {
      const anoRegime = resultado.resultadoRegimes.find((r) => r.regime === regime)?.anos.find((a) => a.ano === ano);
      if (!anoRegime?.disponivel) return { disponivel: false, origem: "motor_fiscal" };
      return { valor: anoRegime.cargaTotal, disponivel: true, origem: "motor_fiscal:ResultadoRegime.cargaTotal" };
    }
    case "maximizar_resultado_economico": {
      const anoFinanceiro = resultado.resultadoFinanceiroPorRegime.find((r) => r.regime === regime)?.resultado.anos.find((a) => a.ano === ano);
      if (anoFinanceiro?.resultado === undefined) return { disponivel: false, origem: "motor_financeiro" };
      return { valor: anoFinanceiro.resultado, disponivel: true, origem: "motor_financeiro:ResultadoAnoEconomicoFinanceiro.resultado" };
    }
    case "minimizar_capital_giro_adicional": {
      const anoCaixa = resultado.resultadoCaixaPorRegime?.find((r) => r.regime === regime)?.anos.find((a) => a.ano === ano);
      if (anoCaixa?.picoCapitalGiroAdicional === undefined) return { disponivel: false, origem: "motor_split_payment" };
      return { valor: anoCaixa.picoCapitalGiroAdicional, disponivel: true, origem: "motor_split_payment:ResultadoImpactoCaixa.picoCapitalGiroAdicional" };
    }
  }
}

export { DIRECAO_POR_OBJETIVO };

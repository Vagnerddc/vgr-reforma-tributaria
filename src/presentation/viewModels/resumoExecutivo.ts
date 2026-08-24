/**
 * ViewModel dos KPIs da Visão Geral (seção 3 do pedido) — carga
 * projetada, margem projetada, impacto anual, capital adicional. Só
 * exibidos para uma alternativa identificável (`alternativaPreferida`);
 * quando a decisão não aponta uma (conflito/equivalência/dados
 * insuficientes), os KPIs ficam `disponivel: false` — a UI nunca
 * escolhe uma alternativa por conta própria para "preencher" o resumo.
 */

import type { Regime } from "../../engine/types";
import type { ResultadoCenario } from "../../engine/motorCenarios/tipos";
import type { ResultadoDecisaoEstrategica } from "../../engine/motorDecisao/tipos";

export interface KpiViewModel {
  disponivel: boolean;
  valor?: number;
}

export interface ResumoExecutivoViewModel {
  regimeReferencia?: Regime;
  cargaProjetada: KpiViewModel; // fração (0.154 = 15,4%)
  margemProjetada: KpiViewModel; // fração
  impactoAnualReais: KpiViewModel;
  capitalAdicionalReais: KpiViewModel;
}

export function construirResumoExecutivoViewModel(resultado: ResultadoCenario, decisao: ResultadoDecisaoEstrategica, ano: number): ResumoExecutivoViewModel {
  const regime = decisao.alternativaPreferida as Regime | undefined;
  if (!regime) {
    const vazio: KpiViewModel = { disponivel: false };
    return { cargaProjetada: vazio, margemProjetada: vazio, impactoAnualReais: vazio, capitalAdicionalReais: vazio };
  }

  const anoRegime = resultado.resultadoRegimes.find((r) => r.regime === regime)?.anos.find((a) => a.ano === ano);
  const receitaReferencia = resultado.comparacaoRegimes?.porAno.find((a) => a.ano === ano)?.porRegime.find((r) => r.regime === regime)?.receitaReferencia;
  const cargaProjetada: KpiViewModel = anoRegime?.disponivel && receitaReferencia ? { disponivel: true, valor: anoRegime.cargaTotal / receitaReferencia } : { disponivel: false };

  const anoFinanceiro = resultado.resultadoFinanceiroPorRegime.find((r) => r.regime === regime)?.resultado.anos.find((a) => a.ano === ano);
  const margemProjetada: KpiViewModel = anoFinanceiro?.margem !== undefined ? { disponivel: true, valor: anoFinanceiro.margem } : { disponivel: false };
  const impactoAnualReais: KpiViewModel = anoFinanceiro?.impactoAnualReais !== undefined ? { disponivel: true, valor: anoFinanceiro.impactoAnualReais } : { disponivel: false };

  const anoCaixa = resultado.resultadoCaixaPorRegime?.find((r) => r.regime === regime)?.anos.find((a) => a.ano === ano);
  const capitalAdicionalReais: KpiViewModel = anoCaixa?.picoCapitalGiroAdicional !== undefined ? { disponivel: true, valor: anoCaixa.picoCapitalGiroAdicional } : { disponivel: false };

  return { regimeReferencia: regime, cargaProjetada, margemProjetada, impactoAnualReais, capitalAdicionalReais };
}

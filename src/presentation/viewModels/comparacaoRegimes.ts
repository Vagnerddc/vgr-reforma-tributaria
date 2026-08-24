/**
 * ViewModel da tabela comparativa de regimes (seção 6 do pedido) — lê
 * `ResultadoCenario` já calculado (motorCenarios). Cada indicador tem
 * uma CÉLULA TIPADA (`disponivel: false` vs. `valor`) — nunca um
 * número solto que a UI possa confundir com zero.
 */

import type { Regime } from "../../engine/types";
import type { ResultadoCenario } from "../../engine/motorCenarios/tipos";

export type CelulaTabela = { disponivel: true; valor: number } | { disponivel: false; motivo: "indisponivel" | "nao_calculado" | "fora_da_comparacao" };

export interface LinhaComparacaoRegime {
  regime: Regime;
  statusJuridico: string;
  comparabilidade: string;
  carga: CelulaTabela;
  margem: CelulaTabela;
  resultado: CelulaTabela;
  capitalGiro: CelulaTabela;
  custoFinanceiro: CelulaTabela;
  qualidade: string;
}

function celula(valor: number | undefined, foraDaComparacao: boolean): CelulaTabela {
  if (foraDaComparacao) return { disponivel: false, motivo: "fora_da_comparacao" };
  if (valor === undefined) return { disponivel: false, motivo: "nao_calculado" };
  return { disponivel: true, valor };
}

export function construirComparacaoRegimesViewModel(resultado: ResultadoCenario, ano: number): LinhaComparacaoRegime[] {
  const anoComp = resultado.comparacaoRegimes?.porAno.find((a) => a.ano === ano);
  const porRegime = anoComp?.porRegime ?? [];

  return porRegime.map((resumo) => {
    const foraDaComparacao = resumo.status === "nao_comparavel" || resumo.status === "indeterminado";
    const financeiro = resultado.resultadoFinanceiroPorRegime.find((r) => r.regime === resumo.regime)?.resultado.anos.find((a) => a.ano === ano);
    const caixa = resultado.resultadoCaixaPorRegime?.find((r) => r.regime === resumo.regime)?.anos.find((a) => a.ano === ano);

    return {
      regime: resumo.regime,
      statusJuridico: resumo.statusJuridico,
      comparabilidade: resumo.status,
      carga: celula(resumo.disponivel ? resumo.cargaConhecida : undefined, foraDaComparacao),
      margem: celula(financeiro?.margem, foraDaComparacao),
      resultado: celula(financeiro?.resultado, foraDaComparacao),
      capitalGiro: celula(caixa?.picoCapitalGiroAdicional, foraDaComparacao || resultado.resultadoCaixaPorRegime === undefined),
      custoFinanceiro: celula(caixa?.custoFinanceiroAnual, foraDaComparacao || resultado.resultadoCaixaPorRegime === undefined),
      qualidade: resumo.qualidadeConsolidada,
    };
  });
}

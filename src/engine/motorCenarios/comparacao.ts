/**
 * Comparação entre cenários (seção 17-19 do pedido) — diferença absoluta
 * e relativa SEMPRE separadas, nunca misturadas. Compara UM regime por
 * vez, em UM ano por vez — quem quiser uma visão multi-ano/multi-regime
 * chama esta função várias vezes (nenhuma agregação escondida aqui).
 */

import type { Regime } from "../types";
import type { ResultadoCenario } from "./tipos";

export interface DiferencaFiscal {
  cargaReaisBase: number;
  cargaReaisCenario: number;
  /** cenário − base, em R$. */
  diferencaReais: number;
  /** diferencaReais ÷ cargaReaisBase, em % — `undefined` quando cargaReaisBase é 0 (divisão por zero nunca escondida como 0%). */
  diferencaPercentualRelativa?: number;
}

export interface DiferencaEconomica {
  resultadoBase?: number;
  resultadoCenario?: number;
  margemBase?: number;
  margemCenario?: number;
  /** Em pontos percentuais — margemCenario − margemBase. Nunca confundido com variação relativa (mesmo princípio de motorFinanceiro/tipos.ts). */
  erosaoOuGanhoMargemPp?: number;
  impactoAnualReais?: number;
}

export interface DiferencaCaixa {
  reducaoDisponibilidadeCaixaBase?: number;
  reducaoDisponibilidadeCaixaCenario?: number;
  diferencaReducaoDisponibilidadeReais?: number;
  capitalGiroAdicionalBase?: number;
  capitalGiroAdicionalCenario?: number;
  diferencaCapitalGiroReais?: number;
  custoFinanceiroBase?: number;
  custoFinanceiroCenario?: number;
  diferencaCustoFinanceiroReais?: number;
}

export interface ComparacaoCenarios {
  ano: number;
  regime: Regime;
  fiscal?: DiferencaFiscal;
  economico?: DiferencaEconomica;
  /** `undefined` quando qualquer um dos dois cenários não calculou caixa para este regime/ano — nunca comparado parcialmente sem sinalizar. */
  caixa?: DiferencaCaixa;
  alertas: string[];
}

function anoRegimeDe(resultado: ResultadoCenario, regime: Regime, ano: number) {
  return resultado.resultadoRegimes.find((r) => r.regime === regime)?.anos.find((a) => a.ano === ano);
}

function anoFinanceiroDe(resultado: ResultadoCenario, regime: Regime, ano: number) {
  return resultado.resultadoFinanceiroPorRegime.find((r) => r.regime === regime)?.resultado.anos.find((a) => a.ano === ano);
}

function anoCaixaDe(resultado: ResultadoCenario, regime: Regime, ano: number) {
  return resultado.resultadoCaixaPorRegime?.find((r) => r.regime === regime)?.anos.find((a) => a.ano === ano);
}

/** Compara `cenario` contra `baseline` para um regime e ano específicos. Retorna cada dimensão como `undefined` quando algum dos dois lados não tem o dado — nunca 0 forçado. */
export function compararCenarios(baseline: ResultadoCenario, cenario: ResultadoCenario, regime: Regime, ano: number): ComparacaoCenarios {
  const alertas: string[] = [];

  const fiscalBase = anoRegimeDe(baseline, regime, ano);
  const fiscalCenario = anoRegimeDe(cenario, regime, ano);
  let fiscal: DiferencaFiscal | undefined;
  if (fiscalBase?.disponivel && fiscalCenario?.disponivel) {
    const diferencaReais = fiscalCenario.cargaTotal - fiscalBase.cargaTotal;
    fiscal = {
      cargaReaisBase: fiscalBase.cargaTotal,
      cargaReaisCenario: fiscalCenario.cargaTotal,
      diferencaReais,
      diferencaPercentualRelativa: fiscalBase.cargaTotal !== 0 ? (diferencaReais / fiscalBase.cargaTotal) * 100 : undefined,
    };
  } else {
    alertas.push(`Fiscal (${regime}, ${ano}) não comparável — ano indisponível em um dos dois cenários.`);
  }

  const econBase = anoFinanceiroDe(baseline, regime, ano);
  const econCenario = anoFinanceiroDe(cenario, regime, ano);
  let economico: DiferencaEconomica | undefined;
  if (econBase?.disponivel || econCenario?.disponivel) {
    economico = {
      resultadoBase: econBase?.resultado,
      resultadoCenario: econCenario?.resultado,
      margemBase: econBase?.margem,
      margemCenario: econCenario?.margem,
      erosaoOuGanhoMargemPp: econBase?.margem !== undefined && econCenario?.margem !== undefined ? (econCenario.margem - econBase.margem) * 100 : undefined,
      impactoAnualReais: econBase?.resultado !== undefined && econCenario?.resultado !== undefined ? econCenario.resultado - econBase.resultado : undefined,
    };
  }

  const ambosCalcularamCaixa = baseline.resultadoCaixaPorRegime !== undefined && cenario.resultadoCaixaPorRegime !== undefined;
  const caixaBase = ambosCalcularamCaixa ? anoCaixaDe(baseline, regime, ano) : undefined;
  const caixaCenario = ambosCalcularamCaixa ? anoCaixaDe(cenario, regime, ano) : undefined;
  let caixa: DiferencaCaixa | undefined;
  if (ambosCalcularamCaixa && (caixaBase || caixaCenario)) {
    caixa = {
      reducaoDisponibilidadeCaixaBase: caixaBase?.valorTotalSegregado,
      reducaoDisponibilidadeCaixaCenario: caixaCenario?.valorTotalSegregado,
      diferencaReducaoDisponibilidadeReais: caixaBase?.valorTotalSegregado !== undefined && caixaCenario?.valorTotalSegregado !== undefined ? caixaCenario.valorTotalSegregado - caixaBase.valorTotalSegregado : undefined,
      capitalGiroAdicionalBase: caixaBase?.picoCapitalGiroAdicional,
      capitalGiroAdicionalCenario: caixaCenario?.picoCapitalGiroAdicional,
      diferencaCapitalGiroReais: caixaBase?.picoCapitalGiroAdicional !== undefined && caixaCenario?.picoCapitalGiroAdicional !== undefined ? caixaCenario.picoCapitalGiroAdicional - caixaBase.picoCapitalGiroAdicional : undefined,
      custoFinanceiroBase: caixaBase?.custoFinanceiroAnual,
      custoFinanceiroCenario: caixaCenario?.custoFinanceiroAnual,
      diferencaCustoFinanceiroReais: caixaBase?.custoFinanceiroAnual !== undefined && caixaCenario?.custoFinanceiroAnual !== undefined ? caixaCenario.custoFinanceiroAnual - caixaBase.custoFinanceiroAnual : undefined,
    };
  } else if (baseline.resultadoCaixaPorRegime === undefined || cenario.resultadoCaixaPorRegime === undefined) {
    alertas.push(`Caixa (${regime}, ${ano}) não comparável — dimensão de caixa indisponível em um dos dois cenários.`);
  }

  return { ano, regime, fiscal, economico, caixa, alertas };
}

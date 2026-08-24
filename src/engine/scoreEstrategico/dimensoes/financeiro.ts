/**
 * Score Financeiro/Caixa (seção 18) — capital de giro adicional (pico)
 * normalizado relativamente (menor = melhor). "Menor capital" nunca
 * produz nota máxima sem referência relativa válida (seção 18) — sem
 * `resultadoCaixaPorRegime` calculado, a dimensão fica `indeterminado`,
 * nunca zero.
 */

import type { IndicadoresRegime } from "./dados";
import { normalizarRelativo } from "../normalizacao";
import type { ScoreDimensao } from "../tipos";

export function calcularScoreFinanceiro(indicador: IndicadoresRegime, comparaveis: IndicadoresRegime[], caixaDisponivel: boolean): ScoreDimensao {
  const metodologia = "VGR_SCORE_V1: normalização relativa do pico de capital de giro adicional (motor_split_payment), menor = melhor; 0-100 entre os regimes comparáveis com caixa calculado.";

  if (!caixaDisponivel) {
    return { dimensao: "financeira", status: "indeterminado", escala: "0-100 relativo às alternativas comparáveis", indicadores: [], evidencias: [], qualidade: "insuficiente", cobertura: "indisponivel", premissas: {}, limitacoes: ["Nenhuma premissa de split payment foi informada — dimensão de caixa indisponível nesta análise."], metodologia };
  }
  if (indicador.resumo.status !== "comparavel" && indicador.resumo.status !== "comparavel_com_ressalvas") {
    return { dimensao: "financeira", status: "nao_aplicavel", escala: "0-100 relativo às alternativas comparáveis", indicadores: [], evidencias: [], qualidade: "insuficiente", cobertura: "indisponivel", premissas: {}, limitacoes: ["Regime não está em condição comparável neste ano."], metodologia };
  }
  if (indicador.picoCapitalGiro === undefined) {
    return { dimensao: "financeira", status: "indeterminado", escala: "0-100 relativo às alternativas comparáveis", indicadores: [], evidencias: [], qualidade: "insuficiente", cobertura: "indisponivel", premissas: {}, limitacoes: ["Pico de capital de giro adicional não calculado para este regime/ano."], metodologia };
  }

  const comCaixa = comparaveis.filter((c) => c.picoCapitalGiro !== undefined);
  if (comCaixa.length < 2) {
    return {
      dimensao: "financeira",
      status: "nao_aplicavel",
      escala: "0-100 relativo às alternativas comparáveis",
      indicadores: [],
      evidencias: [{ descricao: "Pico de capital de giro adicional", valor: indicador.picoCapitalGiro, unidade: "reais", origem: "motor_split_payment" }],
      qualidade: indicador.resumo.qualidadeConsolidada,
      cobertura: "parcial",
      premissas: {},
      limitacoes: ["Menos de dois regimes com capital de giro calculado — não é possível gerar posição relativa."],
      metodologia,
    };
  }

  const normalizados = normalizarRelativo(comCaixa.map((c) => ({ chave: c.regime, valor: c.picoCapitalGiro! })), "menor_melhor");
  const score = normalizados.find((n) => n.chave === indicador.regime)!.score;
  const evidenciaCusto = indicador.custoFinanceiroAnual !== undefined ? [{ descricao: "Custo financeiro anual", valor: indicador.custoFinanceiroAnual, unidade: "reais", origem: "motor_split_payment" }] : [];

  return {
    dimensao: "financeira",
    status: "calculado",
    valor: score,
    escala: "0-100 relativo às alternativas comparáveis",
    indicadores: [{ codigo: "capital_giro_relativo", valorNormalizado: score, evidencias: [{ descricao: "Pico de capital de giro adicional", valor: indicador.picoCapitalGiro, unidade: "reais", origem: "motor_split_payment" }], metodologia: "menor pico de capital de giro → maior score, normalização relativa entre comparáveis" }],
    evidencias: [{ descricao: "Pico de capital de giro adicional", valor: indicador.picoCapitalGiro, unidade: "reais", origem: "motor_split_payment" }, ...evidenciaCusto],
    qualidade: indicador.resumo.qualidadeConsolidada,
    cobertura: "disponivel",
    premissas: {},
    limitacoes: [],
    metodologia,
  };
}

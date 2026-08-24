/**
 * Score Econômico (seção 16/17) — resultado econômico já calculado
 * pelo Motor Financeiro, normalizado relativamente (maior = melhor).
 * Nunca recalcula margem/resultado; respeita a mesma comparabilidade do
 * Comparador Consolidado (seção 17 — nunca compara bases incompatíveis).
 */

import type { IndicadoresRegime } from "./dados";
import { normalizarRelativo } from "../normalizacao";
import type { ScoreDimensao } from "../tipos";

export function calcularScoreEconomico(indicador: IndicadoresRegime, comparaveis: IndicadoresRegime[]): ScoreDimensao {
  const metodologia = "VGR_SCORE_V1: normalização relativa do resultado econômico (motorFinanceiro), maior = melhor; 0-100 entre os regimes comparáveis com resultado disponível.";

  if (indicador.resumo.status !== "comparavel" && indicador.resumo.status !== "comparavel_com_ressalvas") {
    return { dimensao: "economica", status: "nao_aplicavel", escala: "0-100 relativo às alternativas comparáveis", indicadores: [], evidencias: [], qualidade: "insuficiente", cobertura: "indisponivel", premissas: {}, limitacoes: ["Regime não está em condição comparável neste ano."], metodologia };
  }
  if (indicador.resultadoEconomico === undefined) {
    return { dimensao: "economica", status: "indeterminado", escala: "0-100 relativo às alternativas comparáveis", indicadores: [], evidencias: [], qualidade: "insuficiente", cobertura: "indisponivel", premissas: {}, limitacoes: ["Resultado econômico não disponível para este regime/ano (motorFinanceiro)."], metodologia };
  }

  const comComResultado = comparaveis.filter((c) => c.resultadoEconomico !== undefined);
  if (comComResultado.length < 2) {
    return {
      dimensao: "economica",
      status: "nao_aplicavel",
      escala: "0-100 relativo às alternativas comparáveis",
      indicadores: [],
      evidencias: [{ descricao: "Resultado econômico", valor: indicador.resultadoEconomico, unidade: "reais", origem: "motor_financeiro" }],
      qualidade: indicador.resumo.qualidadeConsolidada,
      cobertura: "parcial",
      premissas: {},
      limitacoes: ["Menos de dois regimes com resultado econômico disponível — não é possível gerar posição relativa."],
      metodologia,
    };
  }

  const normalizados = normalizarRelativo(comComResultado.map((c) => ({ chave: c.regime, valor: c.resultadoEconomico! })), "maior_melhor");
  const score = normalizados.find((n) => n.chave === indicador.regime)!.score;
  const evidenciasMargem = indicador.margem !== undefined ? [{ descricao: "Margem projetada", valor: indicador.margem, unidade: "percentual", origem: "motor_financeiro" }] : [];

  return {
    dimensao: "economica",
    status: "calculado",
    valor: score,
    escala: "0-100 relativo às alternativas comparáveis",
    indicadores: [{ codigo: "resultado_relativo", valorNormalizado: score, evidencias: [{ descricao: "Resultado econômico", valor: indicador.resultadoEconomico, unidade: "reais", origem: "motor_financeiro" }], metodologia: "maior resultado → maior score, normalização relativa entre comparáveis" }],
    evidencias: [{ descricao: "Resultado econômico", valor: indicador.resultadoEconomico, unidade: "reais", origem: "motor_financeiro" }, ...evidenciasMargem],
    qualidade: indicador.resumo.qualidadeConsolidada,
    cobertura: "disponivel",
    premissas: {},
    limitacoes: [],
    metodologia,
  };
}

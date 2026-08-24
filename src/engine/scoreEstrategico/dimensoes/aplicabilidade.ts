/**
 * Score de Aplicabilidade (seção 6/24) — maturidade para decisão/
 * execução, NUNCA benefício jurídico. Obrigatoriedade não soma pontos
 * (seção 6); regimes inelegíveis não participam (`nao_aplicavel`,
 * nunca 0 — seção 44).
 */

import type { IndicadoresRegime } from "./dados";
import type { ScoreDimensao } from "../tipos";

export function calcularScoreAplicabilidade(indicador: IndicadoresRegime): ScoreDimensao {
  const metodologia = "VGR_SCORE_V1: regra fixa por status de comparabilidade/elegibilidade — comparável sem ressalva=100, comparável com ressalva=60; inelegível/obrigatório não participam (nao_aplicavel). Obrigatoriedade nunca soma pontos.";

  if (indicador.resumo.statusJuridico === "inelegivel") {
    return { dimensao: "aplicabilidade", status: "nao_aplicavel", escala: "0-100 por regra própria (não relativo)", indicadores: [], evidencias: [], qualidade: "insuficiente", cobertura: "indisponivel", premissas: {}, limitacoes: ["Regime juridicamente inelegível — não participa da comparação."], metodologia };
  }
  if (indicador.resumo.statusJuridico === "obrigatorio") {
    return { dimensao: "aplicabilidade", status: "nao_aplicavel", escala: "0-100 por regra própria (não relativo)", indicadores: [], evidencias: [{ descricao: "Regime juridicamente obrigatório — obrigatoriedade não é vantagem, não participa da comparação relativa.", origem: "comparador_consolidado" }], qualidade: indicador.resumo.qualidadeConsolidada, cobertura: "disponivel", premissas: {}, limitacoes: ["Obrigatoriedade jurídica identificada — fora do score comparativo."], metodologia };
  }
  if (indicador.resumo.statusJuridico === "indeterminado") {
    return { dimensao: "aplicabilidade", status: "indeterminado", escala: "0-100 por regra própria (não relativo)", indicadores: [], evidencias: [], qualidade: "insuficiente", cobertura: "indisponivel", premissas: {}, limitacoes: ["Elegibilidade jurídica indeterminada."], metodologia };
  }

  const valor = indicador.resumo.status === "comparavel" ? 100 : indicador.resumo.status === "comparavel_com_ressalvas" ? 60 : undefined;
  if (valor === undefined) {
    return { dimensao: "aplicabilidade", status: "nao_aplicavel", escala: "0-100 por regra própria (não relativo)", indicadores: [], evidencias: [], qualidade: "insuficiente", cobertura: "indisponivel", premissas: {}, limitacoes: ["Regime não comparável neste ano."], metodologia };
  }

  return {
    dimensao: "aplicabilidade",
    status: "calculado",
    valor,
    escala: "0-100 por regra própria (não relativo)",
    indicadores: [{ codigo: "maturidade_comparabilidade", valorNormalizado: valor, evidencias: [{ descricao: `Status jurídico: ${indicador.resumo.statusJuridico}`, origem: "comparador_consolidado" }], metodologia: "regra fixa por status" }],
    evidencias: [{ descricao: `Comparabilidade: ${indicador.resumo.status}`, origem: "comparador_consolidado" }],
    qualidade: indicador.resumo.qualidadeConsolidada,
    cobertura: "disponivel",
    premissas: {},
    limitacoes: [],
    metodologia,
  };
}

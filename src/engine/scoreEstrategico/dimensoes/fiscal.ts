/**
 * Score Fiscal (seção 5/14/15) — posição relativa de carga tributária
 * entre os regimes comparáveis. Menor carga NÃO produz automaticamente
 * score máximo quando a cobertura é incompleta: desempenho (posição
 * relativa) e confiabilidade (qualidade) são registrados
 * SEPARADAMENTE — `ScoreDimensao.valor` é só o desempenho; `qualidade`
 * carrega a confiabilidade (seção 15).
 */

import type { IndicadoresRegime } from "./dados";
import { normalizarRelativo } from "../normalizacao";
import type { ScoreDimensao } from "../tipos";

export function calcularScoreFiscal(indicador: IndicadoresRegime, comparaveis: IndicadoresRegime[]): ScoreDimensao {
  const metodologia = "VGR_SCORE_V1: normalização relativa da carga tributária comparável (menor = melhor); 0-100 entre os regimes comparáveis do mesmo ano.";

  if (indicador.resumo.status !== "comparavel" && indicador.resumo.status !== "comparavel_com_ressalvas") {
    return { dimensao: "fiscal", status: "nao_aplicavel", escala: "0-100 relativo às alternativas comparáveis", indicadores: [], evidencias: [], qualidade: "insuficiente", cobertura: "indisponivel", premissas: {}, limitacoes: ["Regime não está em condição comparável neste ano."], metodologia };
  }

  if (comparaveis.length < 2) {
    return {
      dimensao: "fiscal",
      status: "nao_aplicavel",
      escala: "0-100 relativo às alternativas comparáveis",
      indicadores: [],
      evidencias: [{ descricao: "Carga tributária comparável", valor: indicador.resumo.cargaConhecida, unidade: "reais", origem: "comparador_consolidado" }],
      qualidade: indicador.resumo.qualidadeConsolidada,
      cobertura: "parcial",
      premissas: {},
      limitacoes: ["Apenas um regime comparável — não é possível gerar posição relativa (seção 42/93)."],
      metodologia,
    };
  }

  const normalizados = normalizarRelativo(comparaveis.map((c) => ({ chave: c.regime, valor: c.resumo.cargaConhecida })), "menor_melhor");
  const score = normalizados.find((n) => n.chave === indicador.regime)!.score;

  return {
    dimensao: "fiscal",
    status: "calculado",
    valor: score,
    escala: "0-100 relativo às alternativas comparáveis",
    indicadores: [{ codigo: "carga_relativa", valorNormalizado: score, evidencias: [{ descricao: "Carga tributária comparável", valor: indicador.resumo.cargaConhecida, unidade: "reais", origem: "comparador_consolidado" }], metodologia: "menor carga → maior score, normalização relativa entre comparáveis" }],
    evidencias: [{ descricao: "Carga tributária comparável", valor: indicador.resumo.cargaConhecida, unidade: "reais", origem: "comparador_consolidado" }],
    qualidade: indicador.resumo.qualidadeConsolidada,
    cobertura: indicador.resumo.status === "comparavel_com_ressalvas" ? "parcial" : "disponivel",
    premissas: {},
    limitacoes: indicador.resumo.status === "comparavel_com_ressalvas" ? ["Comparável apenas com ressalvas — ver Comparador Consolidado."] : [],
    metodologia,
  };
}

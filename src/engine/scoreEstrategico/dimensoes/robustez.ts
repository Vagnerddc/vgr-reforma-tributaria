/**
 * Score de Robustez (seção 19/20/21/24/94/95) — usa pontos de virada e
 * sensibilidade JÁ EXECUTADOS, nunca uma nova busca. Distância "perto"/
 * "longe" nunca é inventada sem metodologia: só é convertida em valor
 * numérico quando o chamador fornece `distanciaRelativa` (0-1, já
 * calculada por quem chama — ex.: |valorAtual-pontoVirada|/|valorAtual| —
 * seção 20, "não aplicar fórmula universal a tudo": cada variável tem
 * sua própria noção de distância relativa, calculada fora deste módulo).
 * Sem esse parâmetro, a dimensão registra a distância objetiva
 * disponível (o próprio ponto de virada) sem produzir um valor 0-100.
 */

import type { ResultadoPontoVirada } from "../../motorPontosVirada/tipos";
import type { QualidadeAchado } from "../../motorAchados/tipos";
import type { EvidenciaScore, ScoreDimensao } from "../tipos";

export interface OpcoesRobustez {
  /** Fração 0-1 já calculada pelo chamador para cada ponto de virada relacionado — chave = variável. */
  distanciasRelativas?: Record<string, number>;
}

export function calcularScoreRobustez(pontosVirada: ResultadoPontoVirada[], qualidade: QualidadeAchado, opcoes: OpcoesRobustez = {}): ScoreDimensao {
  const metodologia = "VGR_SCORE_V1: quando distanciaRelativa (0-1) é fornecida pelo chamador para a variável do ponto de virada, valor = distanciaRelativa × 100 (0 = no próprio ponto de virada, 100 = distante); sem esse parâmetro, só a distância objetiva (ponto de virada em si) é registrada, sem produzir 0-100 (seção 20/25).";

  const encontrados = pontosVirada.filter((p) => p.status === "encontrado" && p.valorEncontrado !== undefined);
  if (encontrados.length === 0) {
    return { dimensao: "robustez", status: "nao_aplicavel", escala: "0-100 por regra própria (não relativo)", indicadores: [], evidencias: [], qualidade, cobertura: "indisponivel", premissas: {}, limitacoes: ["Nenhum ponto de virada relacionado foi informado para esta alternativa."], metodologia };
  }

  const evidencias: EvidenciaScore[] = encontrados.map((p) => ({ descricao: `Ponto de virada em ${p.variavel}`, valor: p.valorEncontrado, origem: "motor_pontos_virada" }));
  const distancias = encontrados.map((p) => opcoes.distanciasRelativas?.[p.variavel]).filter((d): d is number => d !== undefined);

  if (distancias.length === 0) {
    return { dimensao: "robustez", status: "parcial", escala: "0-100 por regra própria (não relativo)", indicadores: [], evidencias, qualidade, cobertura: "parcial", premissas: {}, limitacoes: ["Distância relativa aos pontos de virada não foi fornecida — apenas a distância objetiva (valor do ponto de virada) está registrada, sem classificação de proximidade."], metodologia };
  }

  const mediaDistancia = distancias.reduce((s, d) => s + d, 0) / distancias.length;
  const valor = Math.max(0, Math.min(100, mediaDistancia * 100));

  return {
    dimensao: "robustez",
    status: "calculado",
    valor,
    escala: "0-100 por regra própria (não relativo)",
    indicadores: encontrados.map((p, i) => ({ codigo: `distancia:${p.variavel}`, valorNormalizado: opcoes.distanciasRelativas?.[p.variavel] !== undefined ? opcoes.distanciasRelativas[p.variavel] * 100 : undefined, evidencias: [evidencias[i]], metodologia: "distanciaRelativa × 100" })),
    evidencias,
    qualidade,
    cobertura: "disponivel",
    premissas: opcoes.distanciasRelativas ? { distanciasRelativas: opcoes.distanciasRelativas } : {},
    limitacoes: [],
    metodologia,
  };
}

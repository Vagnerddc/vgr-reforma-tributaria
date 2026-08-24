/**
 * Coerência Score × Decisão (seção 48/49/50/97) — detecta divergência,
 * NUNCA corrige a decisão para caber no Score. A decisão sempre
 * prevalece; a divergência é registrada para auditoria.
 */

import type { ResultadoDecisaoEstrategica } from "../motorDecisao/tipos";
import type { AchadoCoerencia, ScoreEstrategico } from "./tipos";

/**
 * Só avalia coerência quando a decisão de fato produziu uma
 * `alternativaPreferida` (seção 51: em `conflito_nao_resolvido`/
 * `alternativas_equivalentes`/`dados_insuficientes` não há preferência
 * para comparar — divergência de scores nesses casos é esperada e
 * nunca convertida em achado de inconsistência).
 */
export function validarCoerenciaScoreDecisao(decisao: ResultadoDecisaoEstrategica, scores: ScoreEstrategico[]): AchadoCoerencia[] {
  if (!decisao.alternativaPreferida) return [];

  const comConsolidado = scores.filter((s) => s.scoreConsolidado !== undefined);
  if (comConsolidado.length < 2) return [];

  const maiorScore = comConsolidado.reduce((max, s) => (s.scoreConsolidado! > max.scoreConsolidado! ? s : max));
  if (maiorScore.alternativaId === decisao.alternativaPreferida) return [];

  return [
    {
      codigo: "INCONSISTENCIA_SCORE_DECISAO",
      descricao: `O Motor de Decisão prefere "${decisao.alternativaPreferida}", mas o Score consolidado aponta "${maiorScore.alternativaId}" como maior (${maiorScore.scoreConsolidado?.toFixed(1)}). A decisão determinística prevalece; esta divergência é registrada para auditoria da metodologia de Score, nunca para alterar a decisão.`,
      alternativaPreferidaDecisao: decisao.alternativaPreferida,
      alternativaComMaiorScore: maiorScore.alternativaId,
    },
  ];
}

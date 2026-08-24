/**
 * Motor do Score Estratégico — orquestra as dimensões acima sobre um
 * `ResultadoCenario` (motorCenarios) já calculado. Produz UM
 * `ScoreEstrategico` por regime comparável, por ano (seção 11/12).
 * Nunca decide, nunca substitui `motorDecisao` (seção 2/45/46).
 */

import type { ResultadoCenario } from "../motorCenarios/tipos";
import type { ResultadoPontoVirada } from "../motorPontosVirada/tipos";
import { coletarIndicadores, candidatosComparaveis } from "./dimensoes/dados";
import { calcularScoreFiscal } from "./dimensoes/fiscal";
import { calcularScoreEconomico } from "./dimensoes/economico";
import { calcularScoreFinanceiro } from "./dimensoes/financeiro";
import { calcularScoreQualidade } from "./dimensoes/qualidade";
import { calcularScoreAplicabilidade } from "./dimensoes/aplicabilidade";
import { calcularScoreRobustez, type OpcoesRobustez } from "./dimensoes/robustez";
import { consolidarScore } from "./consolidacao";
import { VGR_SCORE_V1, validarMetodologia, type MetodologiaScore } from "./metodologia";
import type { QualidadeAchado } from "../motorAchados/tipos";
import type { ScoreEstrategico } from "./tipos";

function hashContexto(valor: unknown): string {
  const texto = JSON.stringify(valor);
  let hash = 0;
  for (let i = 0; i < texto.length; i++) hash = (hash * 31 + texto.charCodeAt(i)) | 0;
  return `score-ctx-${(hash >>> 0).toString(16)}`;
}

function piorQualidade(qs: QualidadeAchado[]): QualidadeAchado {
  const ordem: Record<QualidadeAchado, number> = { insuficiente: 0, baixa: 1, media: 2, alta: 3 };
  const consideradas = qs.filter((q): q is QualidadeAchado => q !== undefined);
  if (consideradas.length === 0) return "insuficiente";
  return consideradas.reduce((pior, q) => (ordem[q] < ordem[pior] ? q : pior));
}

export interface OpcoesGerarScore {
  resultado: ResultadoCenario;
  ano: number;
  metodologia?: MetodologiaScore;
  pontosVirada?: ResultadoPontoVirada[];
  robustez?: OpcoesRobustez;
}

/** Gera um `ScoreEstrategico` por regime comparável, para UM ano — nunca uma média entre anos (seção 12/13/74). */
export function gerarScoresEstrategicos(opcoes: OpcoesGerarScore): ScoreEstrategico[] {
  const { resultado, ano, metodologia = VGR_SCORE_V1, pontosVirada = [], robustez = {} } = opcoes;
  validarMetodologia(metodologia);

  const indicadores = coletarIndicadores(resultado, ano);
  const comparaveis = candidatosComparaveis(indicadores);
  const caixaDisponivel = resultado.resultadoCaixaPorRegime !== undefined;

  return indicadores.map((indicador) => {
    const pontosDoRegime = pontosVirada; // pontos de virada são do cenário como um todo — cada regime pode ser um dos lados do estadoAntes/estadoDepois; não filtramos por regime, apenas reportamos os relacionados à decisão.

    const dimensoes = [
      calcularScoreFiscal(indicador, comparaveis),
      calcularScoreEconomico(indicador, comparaveis),
      calcularScoreFinanceiro(indicador, comparaveis, caixaDisponivel),
      calcularScoreRobustez(pontosDoRegime, indicador.resumo.qualidadeConsolidada, robustez),
      calcularScoreQualidade(indicador),
      calcularScoreAplicabilidade(indicador),
    ];

    const { scoreConsolidado, statusConsolidado, explicacao } = consolidarScore(dimensoes, metodologia);
    const alertas: string[] = [];
    if (indicador.resumo.statusJuridico === "obrigatorio") alertas.push("Regime juridicamente obrigatório — score de aplicabilidade não participa da comparação relativa (obrigatoriedade nunca é vantagem).");
    if (indicador.resumo.statusJuridico === "inelegivel") alertas.push("Regime juridicamente inelegível — não participa da comparação relativa.");

    return {
      alternativaId: indicador.regime,
      regime: indicador.regime,
      cenarioId: resultado.cenarioId,
      periodo: { ano },
      dimensoes,
      scoreConsolidado,
      statusConsolidado,
      qualidade: piorQualidade(dimensoes.filter((d) => d.status === "calculado").map((d) => d.qualidade)),
      cobertura: dimensoes.every((d) => d.cobertura === "disponivel") ? "disponivel" : dimensoes.some((d) => d.cobertura === "disponivel" || d.cobertura === "parcial") ? "parcial" : "indisponivel",
      metodologiaId: metodologia.id,
      metodologiaVersao: metodologia.versao,
      contextHash: hashContexto({ cenarioId: resultado.cenarioId, ano, regime: indicador.regime, metodologia: metodologia.id + metodologia.versao }),
      explicacao,
      evidencias: dimensoes.flatMap((d) => d.evidencias),
      premissas: dimensoes.reduce((acc, d) => ({ ...acc, ...d.premissas }), {} as Record<string, unknown>),
      alertas,
    };
  });
}

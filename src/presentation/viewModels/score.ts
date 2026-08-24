/**
 * ViewModel do Score Estratégico (seção 12 do pedido) — "Score
 * Estratégico da Alternativa", nunca "Score da Empresa". Perfil
 * dimensional em primeiro plano; o consolidado nunca recebe destaque
 * maior que as dimensões (a UI decide isso na composição do
 * componente, mas o ViewModel já não prioriza o consolidado
 * estruturalmente — ele é só mais um campo, `undefined` quando a
 * cobertura mínima não foi atingida). Qualidade NUNCA é promovida por
 * este ViewModel — é um retransmissão fiel do que veio do motor.
 */

import type { ScoreEstrategico, NomeDimensao } from "../../engine/scoreEstrategico/tipos";

const ROTULO_DIMENSAO: Record<NomeDimensao, string> = {
  fiscal: "Fiscal",
  economica: "Econômico",
  financeira: "Financeiro",
  robustez: "Robustez",
  qualidade_informacao: "Qualidade",
  aplicabilidade: "Aplicabilidade",
};

export interface DimensaoScoreViewModel {
  dimensao: NomeDimensao;
  rotulo: string;
  status: string;
  valor?: number;
  limitacoes: string[];
}

export interface ScoreAlternativaViewModel {
  alternativaId: string;
  titulo: string; // sempre "Score Estratégico da Alternativa <id>" — nunca "Score da Empresa".
  dimensoes: DimensaoScoreViewModel[];
  scoreConsolidado?: number;
  statusConsolidado: string;
  qualidade: string;
  fatoresPositivos: string[];
  fatoresLimitantes: string[];
}

export function construirScoreViewModel(scores: ScoreEstrategico[]): ScoreAlternativaViewModel[] {
  return scores.map((s) => ({
    alternativaId: s.alternativaId,
    titulo: `Score Estratégico da Alternativa — ${s.alternativaId}`,
    dimensoes: s.dimensoes.map((d) => ({ dimensao: d.dimensao, rotulo: ROTULO_DIMENSAO[d.dimensao], status: d.status, valor: d.status === "calculado" ? d.valor : undefined, limitacoes: d.limitacoes })),
    scoreConsolidado: s.statusConsolidado === "calculado" ? s.scoreConsolidado : undefined,
    statusConsolidado: s.statusConsolidado,
    qualidade: s.qualidade,
    fatoresPositivos: s.explicacao.principaisFatoresPositivos,
    fatoresLimitantes: s.explicacao.principaisFatoresLimitantes,
  }));
}

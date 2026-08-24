/**
 * Contrato do Score Estratégico Auditável — SÍNTESE de evidências já
 * produzidas pelos motores anteriores, nunca uma nova fonte de verdade
 * (seção 1). Não calcula tributo/margem/caixa, não recalcula pontos de
 * virada, não muda a decisão do `motorDecisao`, não cria estratégia.
 * "Quão sólida é esta alternativa?" — nunca "qual alternativa
 * escolher?" (isso permanece com `motorDecisao`).
 */

import type { Regime } from "../types";
import type { QualidadeAchado } from "../motorAchados/tipos";

export type NomeDimensao = "fiscal" | "economica" | "financeira" | "robustez" | "qualidade_informacao" | "aplicabilidade";

/** `calculado` produz `valor`; todos os demais NUNCA produzem `valor` — zero ≠ indisponível (seção 8/9). */
export type StatusScore = "calculado" | "parcial" | "indeterminado" | "nao_aplicavel" | "bloqueado";

export interface EvidenciaScore {
  descricao: string;
  valor?: number;
  unidade?: string;
  origem: string;
}

export interface SubscoreDimensao {
  codigo: string;
  valorNormalizado?: number;
  peso?: number;
  evidencias: EvidenciaScore[];
  metodologia: string;
}

/**
 * Escala fixa 0-100 (seção 35): 0 = pior posição observada ENTRE AS
 * ALTERNATIVAS COMPARÁVEIS deste mesmo cenário/ano (nunca um benchmark
 * absoluto universal — seção 36/37/38); 100 = melhor posição observada
 * no mesmo grupo. Dimensões que não admitem essa comparação relativa
 * (qualidade, aplicabilidade) usam regra própria, documentada em cada
 * módulo de `dimensoes/`.
 */
export interface ScoreDimensao {
  dimensao: NomeDimensao;
  status: StatusScore;
  valor?: number;
  escala: "0-100 relativo às alternativas comparáveis" | "0-100 por regra própria (não relativo)";
  indicadores: SubscoreDimensao[];
  evidencias: EvidenciaScore[];
  qualidade: QualidadeAchado;
  cobertura: "disponivel" | "indisponivel" | "parcial";
  premissas: Record<string, unknown>;
  limitacoes: string[];
  metodologia: string;
}

export interface ExplicacaoScore {
  principaisFatoresPositivos: string[];
  principaisFatoresLimitantes: string[];
  dimensoesIndisponiveis: NomeDimensao[];
}

export interface ScoreEstrategico {
  alternativaId: string;
  regime?: Regime;
  cenarioId: string;
  periodo: { ano: number };
  dimensoes: ScoreDimensao[];
  scoreConsolidado?: number;
  statusConsolidado: StatusScore;
  qualidade: QualidadeAchado;
  cobertura: "disponivel" | "indisponivel" | "parcial";
  metodologiaId: string;
  metodologiaVersao: string;
  contextHash: string;
  explicacao: ExplicacaoScore;
  evidencias: EvidenciaScore[];
  premissas: Record<string, unknown>;
  alertas: string[];
}

export type CodigoAchadoCoerencia = "INCONSISTENCIA_SCORE_DECISAO";

export interface AchadoCoerencia {
  codigo: CodigoAchadoCoerencia;
  descricao: string;
  alternativaPreferidaDecisao?: string;
  alternativaComMaiorScore?: string;
}

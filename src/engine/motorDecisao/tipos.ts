/**
 * Contrato do Motor de Decisão Estratégica Determinística — avalia
 * `AlternativaEstrategica[]` (Motor Estratégico) já estruturadas e
 * determina se o conjunto de evidências sustenta uma preferência
 * técnica, um empate, um conflito ou dados insuficientes. NUNCA
 * recalcula tributo/margem/caixa/capital de giro/custo financeiro —
 * só compara números já produzidos (seção 1/2 do pedido).
 *
 * Diferença central: o Motor Estratégico responde "quais caminhos
 * podem ser avaliados?"; este motor responde "o conjunto de evidências
 * permite preferir algum desses caminhos?" — nunca "qual caminho a
 * empresa deve seguir" (isso seria recomendação/IA consultiva, fora de
 * escopo).
 */

import type { Regime } from "../types";
import type { QualidadeAchado } from "../motorAchados/tipos";
import type { Bloqueio, Risco, ValidacaoNecessaria, ReferenciaPontoVirada } from "../motorEstrategico/tipos";

export type ObjetoDecisao = "regime_tributario" | "recomposicao_preco" | "fator_r";

/**
 * Estados centrais (seção 5) — nunca um booleano `recomendado: true`.
 */
export type StatusConclusao = "sem_conclusao" | "dados_insuficientes" | "bloqueado" | "alternativas_equivalentes" | "conflito_nao_resolvido" | "preferencia_tecnica_condicionada" | "preferencia_tecnica_robusta";

/** Distingue OBRIGAÇÃO jurídica de PREFERÊNCIA técnica (seção 31/32) — nunca misturadas. */
export type NaturezaConclusao = "obrigacao_juridica" | "preferencia_tecnica";

/** Relação de dominância entre duas alternativas, SEMPRE baseada em dimensões objetivas (seção 18/19) — nunca peso/score. */
export type Dominancia = "domina" | "dominado" | "incomparavel" | "conflitante" | "equivalente";

export interface EvidenciaDecisao {
  descricao: string;
  valor?: number;
  unidade?: "reais" | "pontos_percentuais" | "percentual" | "indice" | "meses" | "dias";
  origem: string;
}

/** Uma condição estruturada (seção 7) — nunca embutida só no texto (seção 56). */
export interface CondicaoDecisao {
  descricao: string;
  variavel?: string;
  limite?: number;
  origemPontoVirada?: string;
}

export interface AvaliacaoAlternativa {
  identificador: string;
  regime?: Regime;
  aplicabilidade: "aplicavel" | "condicionada" | "nao_aplicavel" | "indeterminada";
  evidenciasFavoraveis: EvidenciaDecisao[];
  evidenciasContrarias: EvidenciaDecisao[];
  bloqueios: Bloqueio[];
  riscos: Risco[];
  condicoes: CondicaoDecisao[];
  qualidade: QualidadeAchado;
  /** Dominância desta alternativa em relação a cada outra alternativa avaliada, por identificador. */
  dominancia: Record<string, Dominancia>;
}

export type CodigoRazaoConclusao =
  | "DOMINANCIA_FISCAL_E_FINANCEIRA"
  | "DIFERENCA_MARGEM_FAVORAVEL"
  | "CONFLITO_TRIBUTO_CAIXA"
  | "BASE_FISCAL_INCOMPLETA"
  | "DECISAO_SENSIVEL_A_FATURAMENTO"
  | "DECISAO_SENSIVEL_A_CUSTO_CAPITAL"
  | "MUDANCA_NO_HORIZONTE"
  | "REGIME_UNICO_DISPONIVEL"
  | "OBRIGACAO_JURIDICA"
  | "TODOS_BLOQUEADOS"
  | "ALTERNATIVAS_EQUIVALENTES_DENTRO_DA_PRECISAO";

export interface DecisaoPorPeriodo {
  ano: number;
  statusConclusao: StatusConclusao;
  alternativaPreferida?: string;
}

export type ConclusaoHorizonte = "preferencia_estavel_no_horizonte" | "preferencia_muda_no_horizonte" | "sem_preferencia_unica";

export interface TransicaoHorizonte {
  anoAntes: number;
  anoDepois: number;
  alternativaAntes?: string;
  alternativaDepois?: string;
}

export interface HorizonteDecisao {
  decisoesPorAno: DecisaoPorPeriodo[];
  conclusaoHorizonte: ConclusaoHorizonte;
  transicoes: TransicaoHorizonte[];
}

export interface ResultadoDecisaoEstrategica {
  id: string;
  cenarioId: string;
  periodo: { ano: number };
  objetoDecisao: ObjetoDecisao;
  alternativasAvaliadas: AvaliacaoAlternativa[];
  statusConclusao: StatusConclusao;
  naturezaConclusao?: NaturezaConclusao;
  alternativaPreferida?: string;
  alternativasEquivalentes: string[];
  evidenciasFavoraveis: EvidenciaDecisao[];
  evidenciasContrarias: EvidenciaDecisao[];
  conflitos: string[];
  bloqueios: Bloqueio[];
  riscos: Risco[];
  premissas: Record<string, unknown>;
  validacoesPendentes: ValidacaoNecessaria[];
  qualidade: QualidadeAchado;
  condicoes: CondicaoDecisao[];
  pontosViradaRelacionados: ReferenciaPontoVirada[];
  horizonte?: HorizonteDecisao;
  razoesConclusao: CodigoRazaoConclusao[];
  /** Determinístico, gerado por template — nunca a fonte da verdade (seção 52). */
  justificativaEstruturada: string;
}

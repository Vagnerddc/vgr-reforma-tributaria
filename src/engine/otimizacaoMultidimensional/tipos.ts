/**
 * Contrato da Otimização Multidimensional — busca, dentro de LIMITES
 * EXPLICITAMENTE FORNECIDOS (nunca inventados), combinações de
 * variáveis já suportadas pelo Motor de Cenários e localiza a
 * FRONTEIRA DE PARETO entre objetivos configurados. Toda combinação é
 * avaliada por `executarCenario` (motorCenarios) — nenhuma fórmula
 * fiscal/econômica/financeira própria. Nenhuma solução da fronteira é
 * chamada de "melhor" — Pareto só descreve trade-off, nunca decide
 * (isso permanece com `motorDecisao`).
 */

import type { Regime } from "../types";
import type { VariavelSensibilidade } from "../motorCenarios/sensibilidade";
import type { ResultadoCenario } from "../motorCenarios/tipos";

/**
 * Objetivos suportados na V1 — todos lidos de resultados JÁ
 * calculados pelos motores existentes, nunca recalculados aqui.
 */
export type Objetivo = "minimizar_carga_fiscal" | "maximizar_resultado_economico" | "minimizar_capital_giro_adicional";

export type DirecaoObjetivo = "minimizar" | "maximizar";

export const DIRECAO_POR_OBJETIVO: Record<Objetivo, DirecaoObjetivo> = {
  minimizar_carga_fiscal: "minimizar",
  maximizar_resultado_economico: "maximizar",
  minimizar_capital_giro_adicional: "minimizar",
};

/**
 * Limite de busca para UMA variável — `min`/`max`/`passos` sempre
 * fornecidos explicitamente por quem chama (seção "limites das
 * variáveis nunca são inventados"). `passos` é a resolução da grade,
 * nunca um valor default silencioso.
 */
export interface VariavelOtimizacao {
  variavel: VariavelSensibilidade;
  min: number;
  max: number;
  passos: number;
}

export interface ValoresObjetivo {
  valor?: number;
  disponivel: boolean;
  origem: string;
}

export interface PontoAvaliado {
  id: string;
  valoresVariaveis: Record<string, number>;
  resultado: ResultadoCenario;
  objetivos: Partial<Record<Objetivo, ValoresObjetivo>>;
  bloqueadoJuridicamente: boolean;
  motivoBloqueio?: string;
}

/**
 * Um ponto da fronteira — `naoDominadoPor` é sempre uma lista vazia por
 * definição (é isso que significa estar na fronteira); mantido no
 * contrato só para auditabilidade simétrica com `dominadoPor` nos
 * pontos fora da fronteira. NUNCA existe um campo "recomendado"/
 * "melhor" neste contrato.
 */
export interface PontoParetoFronteira {
  ponto: PontoAvaliado;
}

export interface ResultadoOtimizacao {
  cenarioBaseId: string;
  regime: Regime;
  objetivos: Objetivo[];
  variaveis: VariavelOtimizacao[];
  combinacoesAvaliadas: number;
  combinacoesBloqueadasJuridicamente: number;
  combinacoesDescartadasPorIndisponibilidade: number;
  fronteiraPareto: PontoParetoFronteira[];
  todosOsPontos: PontoAvaliado[];
  metodologiaId: string;
  metodologiaVersao: string;
  contextHash: string;
  alertas: string[];
}

export class LimiteComputacionalExcedidoError extends Error {
  totalCombinacoes: number;
  limite: number;
  constructor(totalCombinacoes: number, limite: number) {
    super(`Número de combinações (${totalCombinacoes}) excede o limite computacional configurado (${limite}). Reduza o número de variáveis, o intervalo ou a quantidade de passos.`);
    this.totalCombinacoes = totalCombinacoes;
    this.limite = limite;
  }
}

/**
 * Contrato do Motor de Pontos de Virada — ORQUESTRADOR PURO sobre o Motor
 * de Cenários (motorCenarios/), nunca sobre os motores fiscais/financeiros
 * diretamente. Responde "em qual valor de X o resultado muda?" — nunca
 * "qual valor devemos escolher?" (isso é otimização/recomendação, fora
 * de escopo).
 */

import type { Regime } from "../types";
import type { CenarioEmpresa } from "../cenarioEmpresa";
import type { MotorRegime } from "../motorRegimes/tipos";
import type { OpcoesExecucaoCenario, ResultadoCenario } from "../motorCenarios/tipos";
import type { VariavelSensibilidade } from "../motorCenarios/sensibilidade";

/**
 * `break-even` (igualdade financeira clássica) é só UM subtipo dentro de
 * um domínio mais amplo de mudança de estado (seção 2 do pedido).
 */
export type TipoPontoVirada =
  | "mudanca_regime_menor_carga"
  | "mudanca_anexo_simples"
  | "cruzamento_fator_r"
  | "preservacao_margem"
  | "margem_zero"
  | "igualdade_resultado_economico"
  | "igualdade_custo_financeiro"
  | "limite_capital_giro"
  | "mudanca_elegibilidade";

export type StatusPontoVirada = "encontrado" | "nao_encontrado" | "multiplos_pontos" | "intervalo_invalido" | "dados_insuficientes" | "resultado_indeterminado" | "limite_discreto";

export interface IntervaloBusca {
  min: number;
  max: number;
  /** Nº de amostras da varredura inicial (seção 26) — não é o passo final da precisão, só a granularidade da primeira sondagem. Default definido por variável (ver precisao.ts). */
  amostrasIniciais?: number;
  /** Tolerância final — moeda (R$) ou fração (0–1), conforme a variável (seção 30). Default definido por variável. */
  precisao?: number;
}

export interface DefinicaoPontoVirada {
  tipo: TipoPontoVirada;
  variavel: VariavelSensibilidade;
  intervalo: IntervaloBusca;
  ano: number;
  cenarioBase: CenarioEmpresa;
  motoresRegime: MotorRegime[];
  opcoes?: OpcoesExecucaoCenario;
  /** Obrigatório para `igualdade_resultado_economico`/`igualdade_custo_financeiro` — os DOIS regimes comparados. */
  regimesEnvolvidos?: [Regime, Regime];
  /** Regime de referência para métricas de um único regime (`margem_zero`, `limite_capital_giro`, `mudanca_elegibilidade`). */
  regimeReferencia?: Regime;
  /** Necessário para `preservacao_margem` (a margem buscada) — `margem_zero` usa 0 implicitamente, nunca precisa ser informado. */
  margemAlvo?: number;
  /** Necessário para `limite_capital_giro` — o limite vem do usuário/cenário, nunca inventado pelo sistema (seção 18). */
  limiteCapitalGiroInformado?: number;
}

export interface EstadoPontoVirada {
  valor: number;
  resultado: ResultadoCenario;
  /** Presente em critérios categóricos (regime, anexo, status jurídico). */
  estadoCategorico?: string;
  /** Presente em critérios numéricos (margem, diferença entre regimes). */
  metricaNumerica?: number;
}

export type CodigoAchadoPontoVirada =
  | "PONTO_VIRADA_ENCONTRADO"
  | "MULTIPLOS_PONTOS_VIRADA"
  | "PONTO_VIRADA_NAO_ENCONTRADO"
  | "MUDANCA_ELEGIBILIDADE"
  | "MUDANCA_ANEXO"
  | "MUDANCA_REGIME_MENOR_CARGA"
  | "MARGEM_ZERO_ENCONTRADA";

export interface AchadoPontoVirada {
  codigo: CodigoAchadoPontoVirada;
  valor: number;
  descricao: string;
}

export interface ResultadoPontoVirada {
  tipo: TipoPontoVirada;
  variavel: VariavelSensibilidade;
  status: StatusPontoVirada;
  valorEncontrado?: number;
  intervaloOriginal: IntervaloBusca;
  intervaloFinal?: [number, number];
  precisao: number;
  estadoAntes?: EstadoPontoVirada;
  estadoDepois?: EstadoPontoVirada;
  cenarioNoPonto?: ResultadoCenario;
  /** Quando `status === "multiplos_pontos"` — cada mudança detectada na varredura inicial, sem refinar todas (seção 25). */
  outrosPontos?: { intervalo: [number, number] }[];
  iteracoes: number;
  qualidade: "alta" | "media" | "baixa" | "insuficiente";
  origemSolucao: "analitica" | "numerica";
  premissas: Record<string, unknown>;
  alertas: string[];
  achados: AchadoPontoVirada[];
}

/** Ano-a-ano — mudança entre anos (seção 38/39), não é o mesmo objeto de `ResultadoPontoVirada` (não há "variável" contínua entre anos, só uma sequência discreta). */
export interface PontoDeViradaTemporal {
  regimeReferenciaAno: { ano: number; menorCargaComparavel?: Regime }[];
  transicoes: { anoAntes: number; anoDepois: number; regimeAntes?: Regime; regimeDepois?: Regime }[];
  alertas: string[];
}

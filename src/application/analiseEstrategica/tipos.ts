/**
 * Contrato agregado por REFERÊNCIA (seção 6/7 do pedido) — cada campo
 * é exatamente o contrato original do motor correspondente, nunca uma
 * cópia/reformatação. Nenhum "Mega DTO": `AnaliseEstrategicaCompleta`
 * só agrupa ponteiros para os resultados já produzidos pelos motores
 * existentes.
 */

import type { CenarioEmpresa } from "../../engine/cenarioEmpresa";
import type { ResultadoCenario } from "../../engine/motorCenarios/tipos";
import type { ResultadoPontoVirada, DefinicaoPontoVirada } from "../../engine/motorPontosVirada/tipos";
import type { RelatorioAuditoriaEstrategica } from "../../engine/motorAchados/tipos";
import type { PlanoAlternativasEstrategicas } from "../../engine/motorEstrategico/tipos";
import type { ResultadoDecisaoEstrategica, HorizonteDecisao } from "../../engine/motorDecisao/tipos";
import type { PlanoAcaoEstruturado } from "../../engine/planoAcao/tipos";
import type { ScoreEstrategico } from "../../engine/scoreEstrategico/tipos";
import type { ResultadoOtimizacao } from "../../engine/otimizacaoMultidimensional/tipos";
import type { OpcoesOtimizacao } from "../../engine/otimizacaoMultidimensional/motor";
import type { MotorRegime } from "../../engine/motorRegimes/tipos";
import type { PremissasFinanceiras } from "../../engine/motorFinanceiro/tipos";
import type { PremissasSplitPayment } from "../../engine/motorFinanceiro/splitPayment/tipos";

/** Nunca um booleano — cada dimensão tem seu próprio status (seção 12/13). */
export type StatusDimensaoAnalise = "disponivel" | "parcial" | "indisponivel" | "erro" | "nao_aplicavel";

export interface EstadoDimensao {
  status: StatusDimensaoAnalise;
  motivo?: string;
}

export interface AuditoriaExecucaoAnalise {
  inicio: string;
  fim: string;
  duracaoMs: number;
  etapasExecutadas: string[];
  etapasIndisponiveis: string[];
  erros: { etapa: string; mensagem: string }[];
}

export interface AnaliseEstrategicaCompleta {
  cenario: CenarioEmpresa;
  ano: number;

  resultadoCenario?: ResultadoCenario;
  statusRegimesComparador: EstadoDimensao;
  statusFinanceiro: EstadoDimensao;
  statusCaixa: EstadoDimensao;

  pontosVirada?: ResultadoPontoVirada[];
  statusPontosVirada: EstadoDimensao;

  relatorioAchados?: RelatorioAuditoriaEstrategica;
  statusAchados: EstadoDimensao;

  planoEstrategico?: PlanoAlternativasEstrategicas;
  statusEstrategia: EstadoDimensao;

  decisao?: ResultadoDecisaoEstrategica;
  statusDecisao: EstadoDimensao;

  /** Reaproveita `decidirRegimeTributarioNoHorizonte` (motorDecisao/temporal.ts, já existente) — nunca uma segunda lógica de decisão. Alimenta a Timeline 2026-2033. */
  horizonteDecisao?: HorizonteDecisao;
  statusHorizonte: EstadoDimensao;

  planoAcao?: PlanoAcaoEstruturado;
  statusPlanoAcao: EstadoDimensao;

  scores?: ScoreEstrategico[];
  statusScore: EstadoDimensao;

  otimizacao?: ResultadoOtimizacao;
  statusOtimizacao: EstadoDimensao;

  auditoriaExecucao: AuditoriaExecucaoAnalise;
}

export interface OpcoesAnaliseEstrategica {
  ano?: number;
  motoresRegime: MotorRegime[];
  premissasFinanceiras?: PremissasFinanceiras;
  premissasSplit?: PremissasSplitPayment;
  /** Só executa o Motor de Pontos de Virada quando definições explícitas forem fornecidas (seção 10: nada é obrigatório). `cenarioBase`/`motoresRegime` são preenchidos pelo orquestrador — o chamador só declara o que quer buscar. */
  pontosVirada?: Omit<DefinicaoPontoVirada, "cenarioBase" | "motoresRegime">[];
  /** Aciona a Etapa opcional que produz `horizonteDecisao` (Timeline) — reaproveita `decidirRegimeTributarioNoHorizonte`, já existente. */
  incluirHorizonte?: boolean;
  /** Só executa a Otimização quando um problema explícito for configurado (seção 9/12: "somente se houver problema de otimização configurado"). */
  otimizacao?: Omit<OpcoesOtimizacao, "cenarioBase">;
}

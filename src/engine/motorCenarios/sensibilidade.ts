/**
 * Motor de Sensibilidade — varia UMA variável por vez sobre uma
 * sequência de valores (seção 22/30 do pedido: sem busca multidimensional
 * automática nesta fase). Cada ponto é um `ResultadoCenario` completo e
 * auditável — nunca só um par (x, y) (seção 29).
 */

import type { CenarioEmpresa } from "../cenarioEmpresa";
import type { OrigemInformacao } from "../operacaoTributaria";
import type { MotorRegime } from "../motorRegimes/tipos";
import type { Regime } from "../types";
import { executarCenario } from "./motor";
import { detectarMudancasEntrePontos, type AchadoSensibilidade } from "./achados";
import type { AlteracoesCenario, OpcoesExecucaoCenario, ResultadoCenario } from "./tipos";

export type VariavelSensibilidade =
  | "faturamento"
  | "crescimento"
  | "creditosIbsCbs"
  | "custosFixos"
  | "folha"
  | "custoCapital"
  | "percentualRecebimentosSujeitosSplit"
  | "percentualTributoSegregadoSplit";

/** Traduz uma variável de sensibilidade + valor em `AlteracoesCenario` — sempre `tipo: "set"` (o próprio valor da sequência já é o valor absoluto desejado naquele ponto, nunca um incremento sobre incremento anterior). */
export function alteracaoParaVariavel(variavel: VariavelSensibilidade, valor: number, origem: OrigemInformacao = "informado_usuario"): AlteracoesCenario {
  const base = { tipo: "set" as const, valor, origem, status: "estimado" as const };
  switch (variavel) {
    case "faturamento":
      return { receita: { faturamentoAnual: base } };
    case "crescimento":
      return { receita: { crescimentoAnualEstimado: base } };
    case "creditosIbsCbs":
      return { custos: { fatorEscalaCustosCreditaveisIbsCbs: base } };
    case "custosFixos":
      return { custos: { fatorEscalaTodosItens: base } };
    case "folha":
      return { pessoas: { folhaAnual: base } };
    case "custoCapital":
      return { splitPayment: { taxaCustoCapitalMensal: base } };
    case "percentualRecebimentosSujeitosSplit":
      return { splitPayment: { percentualRecebimentosSujeitos: base } };
    case "percentualTributoSegregadoSplit":
      return { splitPayment: { percentualTributoSegregado: base } };
  }
}

export interface PontoSensibilidade {
  valor: number;
  resultado: ResultadoCenario;
}

/** Uma linha resumida por ponto — o `ResultadoCenario` completo continua disponível em `pontos` (seção 29 do pedido: resumo nunca substitui o resultado auditável). */
export interface LinhaResumoSensibilidade {
  valor: number;
  cargaTotalPeriodo?: number;
  margem?: number;
  resultado?: number;
  picoCapitalGiroAdicional?: number;
}

export interface ResultadoSensibilidade {
  variavel: VariavelSensibilidade;
  ano: number;
  regimeReferencia?: Regime;
  pontos: PontoSensibilidade[];
  resumo: LinhaResumoSensibilidade[];
  achados: AchadoSensibilidade[];
}

export interface ParametrosSensibilidade {
  variavel: VariavelSensibilidade;
  valores: number[];
  cenarioBase: CenarioEmpresa;
  motoresRegime: MotorRegime[];
  ano: number;
  /** Regime usado para extrair margem/capital de giro no resumo e nos achados de mudança de estado — sem ele, só `MUDANCA_REGIME_MENOR_CARGA`/`MUDANCA_ANEXO_SIMPLES` são avaliados. */
  regimeReferencia?: Regime;
  opcoes?: OpcoesExecucaoCenario;
  /** Repassado a `detectarMudancasEntrePontos` para o achado `CAPITAL_GIRO_CRUZOU_LIMITE_INFORMADO`. */
  caixaMinimoOperacional?: number;
}

/**
 * Executa a sensibilidade completa: um `executarCenario` por valor,
 * reexecutando de verdade os motores fiscais/financeiros/caixa (nunca
 * multiplica um resultado anterior — seção 26 do pedido). Detecta
 * mudanças de estado entre pontos CONSECUTIVOS da sequência informada —
 * não interpola, não busca o ponto exato (isso é a fase de break-even).
 */
export function executarSensibilidade(params: ParametrosSensibilidade): ResultadoSensibilidade {
  const { variavel, valores, cenarioBase, motoresRegime, ano, regimeReferencia, opcoes = {}, caixaMinimoOperacional } = params;

  const pontos: PontoSensibilidade[] = valores.map((valor) => ({
    valor,
    resultado: executarCenario(cenarioBase, motoresRegime, alteracaoParaVariavel(variavel, valor), opcoes, { tipo: "personalizado" }),
  }));

  const resumo: LinhaResumoSensibilidade[] = pontos.map(({ valor, resultado }) => {
    const regimeParaResumo = regimeReferencia ?? resultado.comparacaoRegimes?.porAno.find((a) => a.ano === ano)?.menorCargaComparavel;
    const anoRegime = regimeParaResumo ? resultado.resultadoRegimes.find((r) => r.regime === regimeParaResumo)?.anos.find((a) => a.ano === ano) : undefined;
    const anoFinanceiro = regimeParaResumo ? resultado.resultadoFinanceiroPorRegime.find((r) => r.regime === regimeParaResumo)?.resultado.anos.find((a) => a.ano === ano) : undefined;
    const anoCaixa = regimeParaResumo ? resultado.resultadoCaixaPorRegime?.find((r) => r.regime === regimeParaResumo)?.anos.find((a) => a.ano === ano) : undefined;
    return { valor, cargaTotalPeriodo: anoRegime?.cargaTotal, margem: anoFinanceiro?.margem, resultado: anoFinanceiro?.resultado, picoCapitalGiroAdicional: anoCaixa?.picoCapitalGiroAdicional };
  });

  const achados: AchadoSensibilidade[] = [];
  for (let i = 1; i < pontos.length; i++) {
    achados.push(...detectarMudancasEntrePontos(pontos[i - 1].valor, pontos[i - 1].resultado, pontos[i].valor, pontos[i].resultado, ano, regimeReferencia, caixaMinimoOperacional));
  }

  return { variavel, ano, regimeReferencia, pontos, resumo, achados };
}

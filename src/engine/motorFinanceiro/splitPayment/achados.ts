/**
 * Achados estruturados — fatos objetivos, nunca julgamento de severidade
 * nem recomendação (seção 42/43 do pedido, mesmo princípio de
 * motorFinanceiro/achados.ts).
 */

import type { AchadoCaixa } from "./tipos";

export function gerarAchadosCaixa(params: {
  valorTotalSegregado?: number;
  picoCapitalGiroAdicional?: number;
  mesPicoCapitalGiro?: number;
  custoFinanceiroAnual?: number;
  premissasCompletas: boolean;
  premissasSaoConfirmadas: boolean;
}): AchadoCaixa[] {
  const achados: AchadoCaixa[] = [];

  if (!params.premissasCompletas) {
    achados.push({ codigo: "DADOS_SPLIT_INSUFICIENTES", valor: 0, descricao: "Percentual sujeito ao split e/ou percentual segregado não informados — impacto de caixa não calculado (nunca assumido como 0% ou 100%)." });
    return achados;
  }

  if (!params.premissasSaoConfirmadas) {
    achados.push({ codigo: "PREMISSA_SPLIT_NAO_CONFIRMADA", valor: 0, descricao: "Percentuais de split utilizados são premissa de simulação, não regra normativa confirmada — ver docs/motor-split-payment.md." });
  }

  if (params.valorTotalSegregado !== undefined && params.valorTotalSegregado > 0) {
    achados.push({ codigo: "REDUCAO_DISPONIBILIDADE_CAIXA", valor: params.valorTotalSegregado, descricao: `Redução de disponibilidade financeira de R$ ${params.valorTotalSegregado.toFixed(2)} no ano, decorrente da segregação na liquidação (não é perda econômica).` });
    achados.push({ codigo: "CAPITAL_GIRO_ADICIONAL", valor: params.valorTotalSegregado, descricao: "Necessidade de capital de giro adicional decorrente da nova mecânica de segregação — ver pico e média mensal." });
  }

  if (params.picoCapitalGiroAdicional !== undefined && params.picoCapitalGiroAdicional > 0 && params.mesPicoCapitalGiro !== undefined) {
    achados.push({ codigo: "PICO_CAPITAL_GIRO", valor: params.picoCapitalGiroAdicional, descricao: `Pico de necessidade de capital de giro adicional de R$ ${params.picoCapitalGiroAdicional.toFixed(2)} no mês ${params.mesPicoCapitalGiro}.` });
  }

  if (params.custoFinanceiroAnual !== undefined && params.custoFinanceiroAnual > 0) {
    achados.push({ codigo: "CUSTO_FINANCEIRO_ADICIONAL", valor: params.custoFinanceiroAnual, descricao: `Custo financeiro adicional estimado de R$ ${params.custoFinanceiroAnual.toFixed(2)} no ano (capital adicional × taxa informada).` });
  }

  return achados;
}

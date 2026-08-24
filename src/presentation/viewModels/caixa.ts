/**
 * ViewModel de Caixa Executivo — consome `ResultadoImpactoCaixa`
 * (splitPayment/motorFinanceiro), sem recalcular nada. Preserva as
 * distinções de domínio: "redução de disponibilidade" nunca é "perda";
 * "capital de giro adicional" nunca é "novo tributo" (seção 4 do
 * pedido). Cada métrica é uma célula tipada (`disponivel: boolean`) —
 * indisponível nunca vira `0` (seção 6).
 */

import type { ResultadoImpactoCaixa, QualidadeImpactoCaixa } from "../../engine/motorFinanceiro/splitPayment/tipos";

export type StatusCaixaExecutivo = "disponivel" | "parcial" | "indisponivel";

export interface MetricaCaixa {
  disponivel: boolean;
  valor?: number;
  motivo?: string;
}

export interface PremissaCaixaViewModel {
  descricao: string;
  informada: boolean;
}

export interface CaixaExecutivoViewModel {
  status: StatusCaixaExecutivo;
  motivoIndisponibilidade?: string;
  reducaoDisponibilidade: MetricaCaixa;
  capitalGiroAdicional: MetricaCaixa;
  picoCapitalGiro: MetricaCaixa;
  periodoPico?: number; // mês (1-12) — só quando já produzido pelo domínio (seção 9), nunca derivado na UI.
  custoFinanceiro: MetricaCaixa;
  premissas: PremissaCaixaViewModel[];
  qualidade?: QualidadeImpactoCaixa;
  alertas: string[];
}

/**
 * `anoCaixa` é `undefined` quando não há premissa de split informada
 * (dimensão inteira indisponível, seção 6) — NUNCA confundido com
 * `disponivel === false` (que significa "o motor tentou calcular este
 * ano e não conseguiu", ex.: ano fora do horizonte calculado).
 */
export function construirCaixaExecutivoViewModel(anoCaixa: ResultadoImpactoCaixa | undefined, motivoIndisponibilidade?: string): CaixaExecutivoViewModel {
  const vazio: MetricaCaixa = { disponivel: false };

  if (!anoCaixa) {
    return {
      status: "indisponivel",
      motivoIndisponibilidade: motivoIndisponibilidade ?? "Premissas de split payment não informadas.",
      reducaoDisponibilidade: vazio,
      capitalGiroAdicional: vazio,
      picoCapitalGiro: vazio,
      custoFinanceiro: vazio,
      premissas: [],
      alertas: [],
    };
  }

  if (!anoCaixa.disponivel) {
    return {
      status: "indisponivel",
      motivoIndisponibilidade: anoCaixa.alertas[0] ?? "Impacto de caixa não calculado para este ano.",
      reducaoDisponibilidade: vazio,
      capitalGiroAdicional: vazio,
      picoCapitalGiro: vazio,
      custoFinanceiro: vazio,
      premissas: [],
      alertas: anoCaixa.alertas,
    };
  }

  const reducaoDisponibilidade: MetricaCaixa = anoCaixa.valorTotalSegregado !== undefined ? { disponivel: true, valor: anoCaixa.valorTotalSegregado } : { disponivel: false, motivo: "Percentual sujeito ao split e/ou percentual segregado não informados." };
  const capitalGiroAdicional: MetricaCaixa = anoCaixa.capitalGiroAdicionalMedio !== undefined ? { disponivel: true, valor: anoCaixa.capitalGiroAdicionalMedio } : { disponivel: false };
  const picoCapitalGiro: MetricaCaixa = anoCaixa.picoCapitalGiroAdicional !== undefined ? { disponivel: true, valor: anoCaixa.picoCapitalGiroAdicional } : { disponivel: false };
  const custoFinanceiro: MetricaCaixa = anoCaixa.custoFinanceiroAnual !== undefined ? { disponivel: true, valor: anoCaixa.custoFinanceiroAnual } : { disponivel: false, motivo: "Taxa de custo de capital não informada." };

  const todasDisponiveis = reducaoDisponibilidade.disponivel && capitalGiroAdicional.disponivel && picoCapitalGiro.disponivel && custoFinanceiro.disponivel;
  const algumaDisponivel = reducaoDisponibilidade.disponivel || capitalGiroAdicional.disponivel || picoCapitalGiro.disponivel || custoFinanceiro.disponivel;

  const premissas: PremissaCaixaViewModel[] = [
    { descricao: `Percentual sujeito ao split${anoCaixa.premissas.percentualRecebimentosSujeitos ? `: ${(anoCaixa.premissas.percentualRecebimentosSujeitos.valor * 100).toFixed(1)}%` : ""}`, informada: anoCaixa.premissas.percentualRecebimentosSujeitos !== undefined },
    { descricao: `Percentual segregado${anoCaixa.premissas.percentualTributoSegregado ? `: ${(anoCaixa.premissas.percentualTributoSegregado.valor * 100).toFixed(1)}%` : ""}`, informada: anoCaixa.premissas.percentualTributoSegregado !== undefined },
    { descricao: `Custo de capital${anoCaixa.premissas.taxaCustoCapitalMensal ? `: ${(anoCaixa.premissas.taxaCustoCapitalMensal.valor * 100).toFixed(2)}% a.m.` : ""}`, informada: anoCaixa.premissas.taxaCustoCapitalMensal !== undefined },
  ];

  return {
    status: todasDisponiveis ? "disponivel" : algumaDisponivel ? "parcial" : "indisponivel",
    reducaoDisponibilidade,
    capitalGiroAdicional,
    picoCapitalGiro,
    periodoPico: anoCaixa.mesPicoCapitalGiro,
    custoFinanceiro,
    premissas,
    qualidade: anoCaixa.qualidade,
    alertas: anoCaixa.alertas,
  };
}

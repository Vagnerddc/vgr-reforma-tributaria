/**
 * Motor de Split Payment / Capital de Giro — orquestra fluxo.ts/qualidade.ts/
 * achados.ts para produzir `ResultadoImpactoCaixa` de UM ano de UM regime.
 * Nunca calcula tributo: `tributoFiscalReferencia` vem só de
 * `ResultadoRegime.anos[].cargaTotal`, já pronto.
 */

import type { ResultadoRegime } from "../../motorRegimes/tipos";
import type { StatusComparabilidade } from "../../motorRegimes/comparadorConsolidado";
import type { CenarioEmpresa } from "../../cenarioEmpresa";
import { calcularMesImpactoCaixa } from "./fluxo";
import { calcularQualidadeImpactoCaixa } from "./qualidade";
import { gerarAchadosCaixa } from "./achados";
import type { PremissasSplitPayment, ResultadoImpactoCaixa, ResultadoMesImpactoCaixa } from "./tipos";

const DIAS_ANO_REFERENCIA = 360;

function distribuicaoUniforme(): number[] {
  return Array.from({ length: 12 }, () => 1 / 12);
}

/**
 * Calcula o impacto de caixa de um único ano de um `ResultadoRegime` já
 * calculado. `comparabilidadeFiscal` é opcional — herdado do Comparador
 * Consolidado, nunca recalculado (seção 34/36 do pedido: quando o regime é
 * `nao_comparavel`, o resultado carrega `estimativaCondicionada: true`).
 */
export function calcularImpactoCaixaDoAno(cenario: CenarioEmpresa, resultadoRegime: ResultadoRegime, ano: number, premissas: PremissasSplitPayment = {}, comparabilidadeFiscal?: StatusComparabilidade): ResultadoImpactoCaixa {
  const alertas: string[] = [];
  const anoRegime = resultadoRegime.anos.find((a) => a.ano === ano);
  const receitaAnual = cenario.receita.faturamentoAnual?.valor;
  const meioPagamentoPredominante = cenario.economicoFinanceiro.meioPagamentoPredominante?.valor;

  if (!anoRegime?.disponivel || receitaAnual === undefined) {
    alertas.push(`Ano ${ano} indisponível — resultado fiscal ou receita ausente (nunca tratado como zero).`);
    return {
      regime: resultadoRegime.regime,
      ano,
      disponivel: false,
      meses: [],
      qualidade: "insuficiente",
      estimativaCondicionada: true,
      premissas,
      alertas,
      achados: [],
    };
  }

  const percentualSujeito = premissas.percentualRecebimentosSujeitos?.valor;
  const percentualSegregado = premissas.percentualTributoSegregado?.valor;
  const premissasCompletas = percentualSujeito !== undefined && percentualSegregado !== undefined;
  if (!premissasCompletas) {
    alertas.push("Percentual sujeito ao split e/ou percentual de tributo segregado não informados — resultado mensal não calculado (premissa incompleta, nunca inventada).");
  }

  const premissasSaoConfirmadas = false; // Nenhum percentual desta fase tem fundamento normativo com valor fixo — ver normativa.ts. Sempre premissa de simulação.
  if (!premissas.distribuicaoMensalReceita) {
    alertas.push("Sem distribuição mensal de receita informada — receita distribuída uniformemente entre os 12 meses (premissa, não dado real; setores sazonais devem informar distribuicaoMensalReceita).");
  }
  const distribuicao = premissas.distribuicaoMensalReceita?.valor ?? distribuicaoUniforme();

  const taxaCustoCapitalMensal = premissas.taxaCustoCapitalMensal?.valor;
  if (taxaCustoCapitalMensal === undefined) alertas.push("Sem taxa de custo de capital informada — custoFinanceiro fica indeterminado (capital de giro adicional continua calculado).");

  const caixaMinimoOperacional = premissas.caixaMinimoOperacional?.valor;

  const meses: ResultadoMesImpactoCaixa[] = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const receitaMes = receitaAnual * distribuicao[i];
    return calcularMesImpactoCaixa({
      mes,
      receita: receitaMes,
      percentualRecebimentosSujeitos: percentualSujeito,
      percentualTributoSegregado: percentualSegregado,
      taxaCustoCapitalMensal,
      caixaMinimoOperacional,
    });
  });

  let valorTotalSegregado: number | undefined;
  let impactoMedioCaixa: number | undefined;
  let picoCapitalGiroAdicional: number | undefined;
  let mesPicoCapitalGiro: number | undefined;
  let capitalGiroAdicionalMedio: number | undefined;
  let custoFinanceiroAnual: number | undefined;
  let diasEquivalentesCaixaPerdidos: number | undefined;

  if (premissasCompletas) {
    const necessidades = meses.map((m) => m.necessidadeCapitalGiro ?? 0);
    valorTotalSegregado = meses.reduce((s, m) => s + (m.valorSegregado ?? 0), 0);
    impactoMedioCaixa = valorTotalSegregado / 12;
    capitalGiroAdicionalMedio = necessidades.reduce((s, v) => s + v, 0) / 12;
    picoCapitalGiroAdicional = Math.max(...necessidades);
    mesPicoCapitalGiro = meses[necessidades.indexOf(picoCapitalGiroAdicional)]?.mes;

    const custos = meses.map((m) => m.custoFinanceiro);
    custoFinanceiroAnual = custos.every((c) => c !== undefined) ? custos.reduce((s, c) => s + (c ?? 0), 0) : undefined;

    const necessidadeMediaDiariaCaixa = receitaAnual / DIAS_ANO_REFERENCIA;
    diasEquivalentesCaixaPerdidos = necessidadeMediaDiariaCaixa > 0 ? valorTotalSegregado / necessidadeMediaDiariaCaixa : undefined;
  }

  if (comparabilidadeFiscal === "comparavel_com_ressalvas") alertas.push("Resultado fiscal de origem é comparável apenas com ressalvas — impacto de caixa herda a mesma ressalva.");
  if (comparabilidadeFiscal === "nao_comparavel" || comparabilidadeFiscal === "indeterminado") alertas.push("Resultado fiscal de origem não é comparável/está indeterminado — este impacto de caixa NÃO deve ser lido como conclusão definitiva.");

  const qualidade = calcularQualidadeImpactoCaixa(premissasCompletas, comparabilidadeFiscal);
  const estimativaCondicionada = !premissasSaoConfirmadas || comparabilidadeFiscal === "nao_comparavel" || comparabilidadeFiscal === "indeterminado" || comparabilidadeFiscal === "comparavel_com_ressalvas";

  const achados = gerarAchadosCaixa({ valorTotalSegregado, picoCapitalGiroAdicional, mesPicoCapitalGiro, custoFinanceiroAnual, premissasCompletas, premissasSaoConfirmadas });

  return {
    regime: resultadoRegime.regime,
    ano,
    disponivel: true,
    meioPagamentoPredominante,
    tributoFiscalReferencia: anoRegime.cargaTotal,
    meses,
    valorTotalSegregado,
    impactoMedioCaixa,
    picoCapitalGiroAdicional,
    mesPicoCapitalGiro,
    capitalGiroAdicionalMedio,
    custoFinanceiroAnual,
    diasEquivalentesCaixaPerdidos,
    qualidade,
    comparabilidadeFiscal,
    estimativaCondicionada,
    premissas,
    alertas,
    achados,
  };
}

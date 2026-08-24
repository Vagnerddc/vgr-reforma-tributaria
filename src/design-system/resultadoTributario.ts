import type { ResultadoAno, ResultadoSimulacao } from "../engine/types";
import { compararCargaTributaria, type ComparativoCargaTributaria } from "./TaxStat";

/**
 * Único lugar que converte um ResultadoSimulacao (já calculado pelo engine)
 * na apresentação %+R$/p.p./redução relativa — usado por Dashboard, Resultado
 * (fluxo via SPED) e pelo simulador público (fluxo manual), para nenhum dos
 * três fazer essa conta de formas diferentes.
 *
 * Não recalcula nenhuma regra tributária: só usa os campos que o engine já
 * devolve. cargaAtualReferencia/cargaNovaPropriaEmpresa/deltaCargaPercentual/
 * deltaCargaReais são todos calculados em calculo.ts — aqui só convertemos
 * R$ em % (dividindo pelo faturamento do ano, recuperado algebricamente de
 * debitoBruto = faturamento × aliquotaTotal, já que ResultadoAno não guarda
 * faturamento por ano diretamente). `faturamentoFallback` só é usado no caso
 * extremo de aliquotaTotal = 0 (ex.: Simples com alíquota total zerada).
 */
function faturamentoDoAno(ano: ResultadoAno, faturamentoFallback: number): number {
  return ano.aliquotaTotal > 0 ? ano.debitoBruto / ano.aliquotaTotal : faturamentoFallback;
}

/** % de carga do ano (débito/crédito líquido do sistema NOVO ÷ faturamento do ano). */
export function cargaPercentualDoAno(ano: ResultadoAno, faturamentoFallback: number): number {
  const faturamento = faturamentoDoAno(ano, faturamentoFallback);
  return faturamento > 0 ? ano.cargaNovaPropriaEmpresa / faturamento : 0;
}

export function comparativoDoResultado(
  resultadoSimulacao: ResultadoSimulacao,
  faturamentoFallback: number = resultadoSimulacao.input.faturamentoAnual
): { comparativo: ComparativoCargaTributaria; anoAtual: ResultadoAno; anoPleno: ResultadoAno } {
  const anoAtual = resultadoSimulacao.anos[0];
  const anoPleno = resultadoSimulacao.anos[resultadoSimulacao.anos.length - 1];

  const faturamentoAnoAtual = faturamentoDoAno(anoAtual, faturamentoFallback);
  const faturamentoAnoPleno = faturamentoDoAno(anoPleno, faturamentoFallback);

  const cargaAtualPercent = faturamentoAnoAtual > 0 ? anoAtual.cargaAtualReferencia / faturamentoAnoAtual : 0;
  const cargaProjetadaPercent = faturamentoAnoPleno > 0 ? anoPleno.cargaNovaPropriaEmpresa / faturamentoAnoPleno : 0;

  const base = compararCargaTributaria(cargaAtualPercent, cargaProjetadaPercent, faturamentoAnoAtual, faturamentoAnoPleno);
  // deltaRelativoPercentual e economiaReais vêm diretamente do resultado do
  // engine (mais precisos que reconstruir a partir dos percentuais, porque
  // incluem custo de compliance etc.) — só o cálculo de p.p. é puramente
  // apresentação (diferença entre dois percentuais já obtidos acima).
  const comparativo: ComparativoCargaTributaria = {
    ...base,
    deltaRelativoPercentual: -anoPleno.deltaCargaPercentual * 100,
    economiaReais: -anoPleno.deltaCargaReais,
  };

  return { comparativo, anoAtual, anoPleno };
}

export interface PontoCargaAno {
  ano: number;
  percent: number;
  reais: number;
}

/**
 * Série ano a ano da carga projetada (%) — para o gráfico "Evolução da carga
 * tributária". Mesma função de recuperação de faturamento usada em
 * `comparativoDoResultado`, então o gráfico nunca pode divergir dos KPIs.
 */
export function serieCargaPorAno(resultadoSimulacao: ResultadoSimulacao, faturamentoFallback: number): PontoCargaAno[] {
  return resultadoSimulacao.anos.map((ano) => ({
    ano: ano.ano,
    percent: cargaPercentualDoAno(ano, faturamentoFallback),
    reais: ano.cargaNovaPropriaEmpresa,
  }));
}

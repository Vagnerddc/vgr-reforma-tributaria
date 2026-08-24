/**
 * Compensação de prejuízo fiscal (IRPJ) / base negativa (CSLL) — trava
 * de 30% do lucro líquido ajustado de cada período (Lei 9.065/1995,
 * arts. 15/16). Estrutura própria, separada de `AjusteFiscal` (seção 7
 * do pedido): prejuízo/base negativa não é uma adição nem exclusão, é um
 * saldo que se acumula e se consome ao longo do tempo.
 */

import { LIMITE_COMPENSACAO_PREJUIZO } from "./normativa";

export interface ResultadoCompensacaoPrejuizo {
  saldoAntes: number;
  /** lucroLiquidoAjustado × 30% — só maior que zero quando o lucro líquido ajustado é positivo. */
  limiteAplicavel: number;
  valorUtilizado: number;
  saldoDepois: number;
  /** Base fiscal FINAL do período, depois da compensação — 0 quando o lucro líquido ajustado é negativo (não há tributo devido, e o prejuízo do período se soma ao saldo). */
  baseFinal: number;
}

/**
 * Nunca modifica um saldo "global" por referência — recebe o saldo
 * ANTES e devolve o saldo DEPOIS como um valor novo (seção 46 do
 * pedido: imutabilidade — cada ano calcula sobre o saldo que o ano
 * anterior devolveu, nunca sobre um objeto mutado in-place).
 */
export function compensarPrejuizo(lucroLiquidoAjustado: number, saldoAnterior: number): ResultadoCompensacaoPrejuizo {
  if (lucroLiquidoAjustado <= 0) {
    // Sem lucro no período: nada a compensar; o prejuízo do próprio período (se houver) se soma ao saldo.
    const novoPrejuizoDoPeriodo = -lucroLiquidoAjustado;
    return { saldoAntes: saldoAnterior, limiteAplicavel: 0, valorUtilizado: 0, saldoDepois: saldoAnterior + novoPrejuizoDoPeriodo, baseFinal: 0 };
  }

  const limiteAplicavel = lucroLiquidoAjustado * LIMITE_COMPENSACAO_PREJUIZO.valor;
  const valorUtilizado = Math.min(saldoAnterior, limiteAplicavel);
  return {
    saldoAntes: saldoAnterior,
    limiteAplicavel,
    valorUtilizado,
    saldoDepois: saldoAnterior - valorUtilizado,
    baseFinal: lucroLiquidoAjustado - valorUtilizado,
  };
}

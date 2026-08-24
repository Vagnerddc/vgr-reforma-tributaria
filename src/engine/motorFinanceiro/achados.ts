/**
 * Achados estruturados — fatos objetivos, nunca julgamento de severidade
 * (seção 44/45 do pedido: thresholds estratégicos vêm depois). Cada
 * achado carrega o valor objetivo do fato.
 */

import type { AchadoFinanceiro } from "./tipos";

const EPSILON_PP = 0.01;

export function gerarAchadosFinanceiros(margemProjetada: number | undefined, erosaoMargemPp: number | undefined, impactoAnualReais: number | undefined, reajusteMedioNecessario: number | undefined): AchadoFinanceiro[] {
  const achados: AchadoFinanceiro[] = [];

  if (margemProjetada === undefined) {
    achados.push({ codigo: "DADOS_ECONOMICOS_INSUFICIENTES", valor: 0, descricao: "Margem projetada não pôde ser calculada — dados econômicos insuficientes." });
    return achados;
  }

  if (margemProjetada < 0) {
    achados.push({ codigo: "MARGEM_NEGATIVA", valor: margemProjetada, descricao: `Margem projetada negativa (${(margemProjetada * 100).toFixed(1)}%) — resultado abaixo de zero neste cenário.` });
  } else if (erosaoMargemPp !== undefined) {
    if (erosaoMargemPp < -EPSILON_PP) {
      achados.push({ codigo: "MARGEM_REDUZIDA", valor: erosaoMargemPp, descricao: `Margem reduzida em ${Math.abs(erosaoMargemPp).toFixed(2)} p.p. em relação ao ano-base.` });
    } else {
      achados.push({ codigo: "MARGEM_PRESERVADA", valor: erosaoMargemPp, descricao: `Margem preservada (variação de ${erosaoMargemPp.toFixed(2)} p.p. em relação ao ano-base).` });
    }
  }

  if (impactoAnualReais !== undefined && Math.abs(impactoAnualReais) > 0.01) {
    achados.push({ codigo: "IMPACTO_ANUAL_RELEVANTE", valor: impactoAnualReais, descricao: `Impacto de R$ ${impactoAnualReais.toFixed(2)} no resultado anual em relação ao ano-base.` });
  }

  if (reajusteMedioNecessario !== undefined && reajusteMedioNecessario > 0) {
    achados.push({ codigo: "REAJUSTE_PRECO_NECESSARIO", valor: reajusteMedioNecessario, descricao: `Reajuste médio equivalente de ${(reajusteMedioNecessario * 100).toFixed(2)}% preservaria a margem do ano-base.` });
  }

  return achados;
}

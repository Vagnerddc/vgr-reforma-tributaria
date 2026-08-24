/**
 * Precisão por tipo de variável (seção 30 do pedido) — nunca uma
 * tolerância única para tudo. Moeda usa tolerância monetária em R$;
 * percentual/fração usa casas decimais.
 */

import type { VariavelSensibilidade } from "../motorCenarios/sensibilidade";

const PRECISAO_PADRAO: Record<VariavelSensibilidade, number> = {
  faturamento: 10, // R$ 10
  crescimento: 0.001, // 0,1 p.p.
  creditosIbsCbs: 0.01, // fator de escala, 1%
  custosFixos: 0.01,
  folha: 10, // R$ 10
  custoCapital: 0.0001, // 0,01 p.p. a.m.
  percentualRecebimentosSujeitosSplit: 0.001,
  percentualTributoSegregadoSplit: 0.001,
};

const AMOSTRAS_PADRAO = 9;

export function precisaoPadrao(variavel: VariavelSensibilidade): number {
  return PRECISAO_PADRAO[variavel];
}

export function amostrasIniciaisPadrao(): number {
  return AMOSTRAS_PADRAO;
}

/** Mesma disciplina de arredondamento do Comparador Consolidado (comparadorConsolidado.ts::arredondarCentavos) — reaplicada aqui, nunca uma regra nova conflitante. */
export function arredondarCentavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

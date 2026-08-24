/**
 * Custos econômicos — reaproveita `CenarioEmpresa.custos.itens`
 * (GastoInformado/CategoriaGasto já existentes, creditoTributario.ts),
 * nunca reclassifica (seção 11 do pedido). Custo econômico é sempre o
 * valor bruto do gasto, independente de gerar crédito fiscal ou não
 * (seção 12) — o crédito já está refletido em `cargaFiscalUtilizada`
 * (o `ResultadoRegime` recebido do motor fiscal), nunca descontado de
 * novo aqui (seção 13 — evita dupla contagem).
 */

import type { CenarioEmpresa } from "../cenarioEmpresa";

export interface ResultadoCustosEconomicos {
  total: number;
  /** false quando `custos.itens` está vazio — não impede o cálculo, mas rebaixa a qualidade (custos.ts nunca decide isso, só informa). */
  informado: boolean;
}

export function calcularCustosEconomicos(cenario: CenarioEmpresa): ResultadoCustosEconomicos {
  const total = cenario.custos.itens.reduce((s, g) => s + g.valorAnual, 0);
  return { total, informado: cenario.custos.itens.length > 0 };
}

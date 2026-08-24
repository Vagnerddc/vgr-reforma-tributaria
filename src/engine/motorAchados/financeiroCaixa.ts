/**
 * Adapters — convertem achados JÁ PRODUZIDOS por motorFinanceiro/achados.ts
 * e motorFinanceiro/splitPayment/achados.ts para o contrato universal.
 * Nenhum cálculo novo: só empacotamento + herança de qualidade/proveniência
 * (seção 2/12 do pedido).
 */

import type { Regime } from "../types";
import type { ResultadoAnoEconomicoFinanceiro } from "../motorFinanceiro/tipos";
import type { ResultadoImpactoCaixa } from "../motorFinanceiro/splitPayment/tipos";
import type { AchadoEstrategico, CodigoAchadoEstrategico, QualidadeAchado } from "./tipos";

function qualidadeParaAchado(q: string): QualidadeAchado {
  return q === "alta" ? "alta" : q === "media" ? "media" : q === "baixa" || q === "parcial" ? "baixa" : "insuficiente";
}

const UNIDADE_POR_CODIGO_FINANCEIRO: Partial<Record<string, AchadoEstrategico["unidade"]>> = {
  MARGEM_REDUZIDA: "pontos_percentuais",
  MARGEM_PRESERVADA: "pontos_percentuais",
  MARGEM_NEGATIVA: "percentual",
  IMPACTO_ANUAL_RELEVANTE: "reais",
  REAJUSTE_PRECO_NECESSARIO: "percentual",
};

export function converterAchadosFinanceiros(anoFinanceiro: ResultadoAnoEconomicoFinanceiro, regime: Regime): AchadoEstrategico[] {
  return anoFinanceiro.achados.map((a) => ({
    id: `financeiro:${regime}:${anoFinanceiro.ano}:${a.codigo}`,
    codigo: a.codigo as CodigoAchadoEstrategico,
    categoria: "margem",
    tituloTecnico: a.codigo.replace(/_/g, " ").toLowerCase(),
    descricaoTecnica: a.descricao,
    valor: a.valor,
    unidade: UNIDADE_POR_CODIGO_FINANCEIRO[a.codigo],
    periodo: { ano: anoFinanceiro.ano },
    regime,
    evidencias: [{ origem: "motor_financeiro", referencia: `ResultadoAnoEconomicoFinanceiro.${regime}.anos[${anoFinanceiro.ano}]`, valor: a.valor }],
    qualidade: qualidadeParaAchado(anoFinanceiro.qualidade),
    premissas: {},
    origens: ["classificacao_vgr"],
    status: anoFinanceiro.qualidade === "alta" ? "confirmado" : "estimado",
  }));
}

/** `REAJUSTE_NECESSARIO_PARA_PRESERVAR_MARGEM` (seção 22) — mesmo dado de `reajusteMedioNecessario`, só com o código/categoria pedido explicitamente nesta fase; não duplica `REAJUSTE_PRECO_NECESSARIO` (esse é o achado ORIGINAL do Motor Financeiro; o de cenário abaixo é sempre o mesmo número, reapresentado com a premissa de repasse explícita quando aplicável). */
export function gerarAchadoReajustePreservacaoMargem(anoFinanceiro: ResultadoAnoEconomicoFinanceiro, regime: Regime): AchadoEstrategico[] {
  if (anoFinanceiro.reajusteMedioNecessario === undefined) return [];
  return [
    {
      id: `financeiro:${regime}:${anoFinanceiro.ano}:REAJUSTE_NECESSARIO_PARA_PRESERVAR_MARGEM`,
      codigo: "REAJUSTE_PRECO_NECESSARIO",
      categoria: "preco",
      tituloTecnico: "Reajuste necessário para preservar a margem do ano-base",
      descricaoTecnica: `Reajuste médio equivalente de ${(anoFinanceiro.reajusteMedioNecessario * 100).toFixed(2)}% preservaria a margem do ano-base em ${anoFinanceiro.ano}.`,
      valor: anoFinanceiro.reajusteMedioNecessario,
      unidade: "percentual",
      periodo: { ano: anoFinanceiro.ano },
      regime,
      evidencias: [{ origem: "motor_financeiro", referencia: `ResultadoAnoEconomicoFinanceiro.${regime}.anos[${anoFinanceiro.ano}].reajusteMedioNecessario`, valor: anoFinanceiro.reajusteMedioNecessario }],
      qualidade: qualidadeParaAchado(anoFinanceiro.qualidade),
      premissas: {},
      origens: ["classificacao_vgr"],
      status: anoFinanceiro.qualidade === "alta" ? "confirmado" : "estimado",
    },
  ];
}

const UNIDADE_POR_CODIGO_CAIXA: Partial<Record<string, AchadoEstrategico["unidade"]>> = {
  REDUCAO_DISPONIBILIDADE_CAIXA: "reais",
  CAPITAL_GIRO_ADICIONAL: "reais",
  PICO_CAPITAL_GIRO: "reais",
  CUSTO_FINANCEIRO_ADICIONAL: "reais",
};

export function converterAchadosCaixa(anoCaixa: ResultadoImpactoCaixa, regime: Regime): AchadoEstrategico[] {
  return anoCaixa.achados.map((a) => ({
    id: `caixa:${regime}:${anoCaixa.ano}:${a.codigo}`,
    codigo: a.codigo as CodigoAchadoEstrategico,
    categoria: a.codigo === "CAPITAL_GIRO_ADICIONAL" || a.codigo === "PICO_CAPITAL_GIRO" ? "capital_giro" : "caixa",
    tituloTecnico: a.codigo.replace(/_/g, " ").toLowerCase(),
    descricaoTecnica: a.descricao,
    valor: a.valor,
    unidade: UNIDADE_POR_CODIGO_CAIXA[a.codigo],
    periodo: { ano: anoCaixa.ano },
    regime,
    evidencias: [{ origem: "motor_split_payment", referencia: `ResultadoImpactoCaixa.${regime}.${anoCaixa.ano}`, valor: a.valor }],
    qualidade: qualidadeParaAchado(anoCaixa.qualidade),
    premissas: anoCaixa.premissas as AchadoEstrategico["premissas"],
    origens: ["classificacao_vgr"],
    status: anoCaixa.qualidade === "alta" ? "confirmado" : "estimado",
  }));
}

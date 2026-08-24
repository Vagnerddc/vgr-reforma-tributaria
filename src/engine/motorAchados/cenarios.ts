/**
 * Achados de comparação de cenário — SEMPRE relativos a um baseline
 * explícito (seção 29/30/45 do pedido). Nunca "MELHOR_CENARIO"; só fatos
 * dimensionais. Reaproveita `compararCenarios` (motorCenarios/comparacao.ts).
 */

import type { ComparacaoCenarios } from "../motorCenarios/comparacao";
import type { AchadoEstrategico } from "./tipos";

const EPSILON = 0.01;

export function gerarAchadosCenario(diff: ComparacaoCenarios, baselineId: string, cenarioId: string): AchadoEstrategico[] {
  const achados: AchadoEstrategico[] = [];

  if (diff.fiscal && Math.abs(diff.fiscal.diferencaReais) > EPSILON) {
    achados.push({
      id: `cenario:${cenarioId}:${diff.regime}:${diff.ano}:${diff.fiscal.diferencaReais > 0 ? "CENARIO_AUMENTA_CARGA" : "CENARIO_REDUZ_CARGA"}`,
      codigo: diff.fiscal.diferencaReais > 0 ? "CENARIO_AUMENTA_CARGA" : "CENARIO_REDUZ_CARGA",
      categoria: "cenario",
      tituloTecnico: diff.fiscal.diferencaReais > 0 ? "Cenário aumenta a carga tributária em relação ao baseline" : "Cenário reduz a carga tributária em relação ao baseline",
      descricaoTecnica: `Carga tributária de ${diff.regime} em ${diff.ano}: R$ ${diff.fiscal.cargaReaisCenario.toFixed(2)} no cenário vs. R$ ${diff.fiscal.cargaReaisBase.toFixed(2)} no baseline (diferença de R$ ${diff.fiscal.diferencaReais.toFixed(2)}).`,
      valor: diff.fiscal.diferencaReais,
      unidade: "reais",
      periodo: { ano: diff.ano },
      regime: diff.regime,
      cenarioId,
      evidencias: [{ origem: "motor_cenarios", referencia: `compararCenarios(${baselineId}, ${cenarioId}, ${diff.regime}, ${diff.ano}).fiscal`, valor: diff.fiscal.diferencaReais }],
      qualidade: "media",
      premissas: { baselineId },
      origens: ["classificacao_vgr"],
      status: "estimado",
    });
  }

  if (diff.economico?.erosaoOuGanhoMargemPp !== undefined && Math.abs(diff.economico.erosaoOuGanhoMargemPp) > EPSILON) {
    achados.push({
      id: `cenario:${cenarioId}:${diff.regime}:${diff.ano}:${diff.economico.erosaoOuGanhoMargemPp > 0 ? "CENARIO_MELHORA_MARGEM" : "CENARIO_PIORA_MARGEM"}`,
      codigo: diff.economico.erosaoOuGanhoMargemPp > 0 ? "CENARIO_MELHORA_MARGEM" : "CENARIO_PIORA_MARGEM",
      categoria: "cenario",
      tituloTecnico: diff.economico.erosaoOuGanhoMargemPp > 0 ? "Cenário melhora a margem em relação ao baseline" : "Cenário piora a margem em relação ao baseline",
      descricaoTecnica: `Margem de ${diff.regime} em ${diff.ano} varia ${diff.economico.erosaoOuGanhoMargemPp.toFixed(2)} p.p. em relação ao baseline.`,
      valor: diff.economico.erosaoOuGanhoMargemPp,
      unidade: "pontos_percentuais",
      periodo: { ano: diff.ano },
      regime: diff.regime,
      cenarioId,
      evidencias: [{ origem: "motor_cenarios", referencia: `compararCenarios(...).economico.erosaoOuGanhoMargemPp`, valor: diff.economico.erosaoOuGanhoMargemPp }],
      qualidade: "media",
      premissas: { baselineId },
      origens: ["classificacao_vgr"],
      status: "estimado",
    });
  }

  if (diff.caixa?.diferencaCapitalGiroReais !== undefined && Math.abs(diff.caixa.diferencaCapitalGiroReais) > EPSILON) {
    achados.push({
      id: `cenario:${cenarioId}:${diff.regime}:${diff.ano}:${diff.caixa.diferencaCapitalGiroReais < 0 ? "CENARIO_REDUZ_CAPITAL_GIRO" : "CENARIO_PIORA_CAIXA"}`,
      codigo: diff.caixa.diferencaCapitalGiroReais < 0 ? "CENARIO_REDUZ_CAPITAL_GIRO" : "CENARIO_PIORA_CAIXA",
      categoria: "cenario",
      tituloTecnico: diff.caixa.diferencaCapitalGiroReais < 0 ? "Cenário reduz o pico de capital de giro adicional" : "Cenário piora o pico de capital de giro adicional",
      descricaoTecnica: `Pico de capital de giro adicional de ${diff.regime} em ${diff.ano} varia R$ ${diff.caixa.diferencaCapitalGiroReais.toFixed(2)} em relação ao baseline.`,
      valor: diff.caixa.diferencaCapitalGiroReais,
      unidade: "reais",
      periodo: { ano: diff.ano },
      regime: diff.regime,
      cenarioId,
      evidencias: [{ origem: "motor_cenarios", referencia: `compararCenarios(...).caixa.diferencaCapitalGiroReais`, valor: diff.caixa.diferencaCapitalGiroReais }],
      qualidade: "media",
      premissas: { baselineId },
      origens: ["classificacao_vgr"],
      status: "estimado",
    });
  }

  return achados;
}

/**
 * Score de Qualidade da Informação (seção 22/23/40) — REGRA PRÓPRIA,
 * nunca normalização relativa (qualidade não deve receber 100 só por
 * ser "a menos ruim" entre três alternativas ruins). Mapeamento fixo
 * documentado, a partir do `QualidadeConsolidada` já produzido pelo
 * Comparador Consolidado — nunca recalculado.
 */

import type { IndicadoresRegime } from "./dados";
import type { ScoreDimensao } from "../tipos";

/** Mapeamento fixo e documentado (nunca normalização relativa) — alta=100, media=66, baixa=33, insuficiente=indeterminado (sem valor). */
const VALOR_POR_QUALIDADE: Record<"alta" | "media" | "baixa", number> = { alta: 100, media: 66, baixa: 33 };

export function calcularScoreQualidade(indicador: IndicadoresRegime): ScoreDimensao {
  const metodologia = "VGR_SCORE_V1: mapeamento fixo a partir de QualidadeConsolidada (Comparador Consolidado) — alta=100, media=66, baixa=33; insuficiente=indeterminado. Nunca normalização relativa entre alternativas.";
  const qualidade = indicador.resumo.qualidadeConsolidada;

  if (qualidade === "insuficiente") {
    return { dimensao: "qualidade_informacao", status: "indeterminado", escala: "0-100 por regra própria (não relativo)", indicadores: [], evidencias: [], qualidade: "insuficiente", cobertura: "indisponivel", premissas: {}, limitacoes: ["Qualidade consolidada insuficiente — nenhum valor numérico atribuído."], metodologia };
  }

  const valor = VALOR_POR_QUALIDADE[qualidade];
  return {
    dimensao: "qualidade_informacao",
    status: "calculado",
    valor,
    escala: "0-100 por regra própria (não relativo)",
    indicadores: [{ codigo: "qualidade_consolidada", valorNormalizado: valor, evidencias: [{ descricao: `Qualidade consolidada: ${qualidade}`, origem: "comparador_consolidado" }], metodologia: "mapeamento fixo" }],
    evidencias: [{ descricao: `Cobertura: ${indicador.resumo.cobertura.disponiveis.length}/${indicador.resumo.cobertura.esperados.length} componentes esperados calculados`, origem: "comparador_consolidado" }],
    qualidade,
    cobertura: indicador.resumo.cobertura.ausentesMateriais.length === 0 ? "disponivel" : "parcial",
    premissas: {},
    limitacoes: indicador.resumo.cobertura.ausentesMateriais.length > 0 ? [`Componentes ausentes: ${indicador.resumo.cobertura.ausentesMateriais.join(", ")}.`] : [],
    metodologia,
  };
}

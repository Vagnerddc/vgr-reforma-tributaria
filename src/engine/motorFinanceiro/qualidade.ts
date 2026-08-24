/**
 * Qualidade financeira consolidada — determinística, sem score 0–100
 * (seção 9/29 do pedido). Separa dois eixos independentes: completude
 * dos dados econômicos (receita/custos informados) e qualidade da carga
 * fiscal herdada do Comparador Consolidado — nunca misturados.
 */

import type { QualidadeFinanceira } from "./tipos";
import type { StatusComparabilidade } from "../motorRegimes/comparadorConsolidado";

export function calcularQualidadeFinanceira(dadosEconomicosCompletos: boolean, statusComparabilidadeFiscal: StatusComparabilidade | undefined): QualidadeFinanceira {
  if (!dadosEconomicosCompletos) return "insuficiente";
  if (statusComparabilidadeFiscal === "nao_comparavel" || statusComparabilidadeFiscal === "indeterminado") return "insuficiente";
  if (statusComparabilidadeFiscal === "comparavel_com_ressalvas") return "media";
  return "alta"; // "comparavel" ou nenhuma avaliação de comparabilidade fornecida (uso do motor fora do contexto do comparador)
}

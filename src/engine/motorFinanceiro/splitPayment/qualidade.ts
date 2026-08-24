/**
 * Qualidade do resultado de impacto de caixa (seção 39/40 do pedido) —
 * combina completude das premissas do split com a comparabilidade fiscal
 * herdada (mesmo padrão de motorFinanceiro/qualidade.ts).
 */

import type { QualidadeImpactoCaixa } from "./tipos";
import type { StatusComparabilidade } from "../../motorRegimes/comparadorConsolidado";

export function calcularQualidadeImpactoCaixa(premissasCompletas: boolean, comparabilidadeFiscal?: StatusComparabilidade): QualidadeImpactoCaixa {
  if (!premissasCompletas) return "insuficiente";
  if (comparabilidadeFiscal === "nao_comparavel" || comparabilidadeFiscal === "indeterminado") return "insuficiente";
  if (comparabilidadeFiscal === "comparavel_com_ressalvas") return "media";
  return "alta";
}

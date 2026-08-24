/**
 * Restrições jurídicas — lidas do Comparador Consolidado
 * (`ResumoComparativoRegimeAno`), nunca inventadas nem recalculadas. Uma
 * combinação cujo regime-alvo deixa de ser comparável/elegível é
 * EXCLUÍDA da fronteira de Pareto e dos objetivos — nunca avaliada como
 * se fosse uma solução válida.
 */

import type { Regime } from "../types";
import type { ResultadoCenario } from "../motorCenarios/tipos";

export interface AvaliacaoRestricaoJuridica {
  bloqueado: boolean;
  motivo?: string;
}

export function avaliarRestricaoJuridica(resultado: ResultadoCenario, regime: Regime, ano: number): AvaliacaoRestricaoJuridica {
  const resumo = resultado.comparacaoRegimes?.porAno.find((a) => a.ano === ano)?.porRegime.find((r) => r.regime === regime);
  if (!resumo) return { bloqueado: true, motivo: `Regime ${regime} não avaliado pelo Comparador Consolidado neste ano.` };

  if (resumo.status === "nao_comparavel" || resumo.status === "indeterminado") {
    return { bloqueado: true, motivo: resumo.motivos.map((m) => m.descricao).join(" ") || `Regime ${regime} não comparável/elegível neste ano.` };
  }
  return { bloqueado: false };
}

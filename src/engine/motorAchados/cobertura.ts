/**
 * Cobertura da auditoria (seção 58/59/70) — distingue explicitamente
 * "não analisado" de "nenhum achado" (critério obrigatório). Nunca
 * inferido a partir da ausência de achados de uma categoria.
 */

import type { ResultadoCenario } from "../motorCenarios/tipos";
import type { CoberturaAuditoria } from "./tipos";

export function avaliarCobertura(resultado: ResultadoCenario, temDadosSetoriais: boolean, temPontosVirada: boolean, temComparacaoCenarios: boolean): CoberturaAuditoria {
  return {
    fiscal: resultado.qualidade.fiscal === "indisponivel" ? "indisponivel" : resultado.resultadoRegimes.length > 0 ? "disponivel" : "indisponivel",
    creditos: "disponivel", // gerarAchadosCredito sempre roda; retorna achado de indeterminação quando faltam dados — nunca "indisponível" para o eixo em si.
    margem: resultado.qualidade.economica === "indisponivel" ? "indisponivel" : resultado.resultadoFinanceiroPorRegime.length > 0 ? "disponivel" : "indisponivel",
    caixa: resultado.resultadoCaixaPorRegime === undefined ? "indisponivel" : "disponivel",
    cenarios: temComparacaoCenarios ? "disponivel" : "indisponivel",
    pontosVirada: temPontosVirada ? "disponivel" : "indisponivel",
    setorial: temDadosSetoriais ? "disponivel" : "indisponivel",
  };
}

import type { CasoPiloto, AvaliacaoCasoPiloto, ProblemaPiloto, StatusOperacionalCaso } from "./tipos";
import type { ResultadoComparacaoFluxos } from "../comparacaoV2Legado/tipos";
import { avaliarCriteriosTecnicos, problemaBloqueiaProntidao } from "./criteriosAceitacao";

export interface OpcoesAvaliacaoCaso {
  resultadoComparacao?: ResultadoComparacaoFluxos;
  problemas?: ProblemaPiloto[];
  ganhosV2?: string[];
  apresentacao?: "passou" | "ressalva" | "nao_avaliada";
  auditabilidade?: "passou" | "ressalva" | "nao_avaliada";
}

/**
 * Avaliação operacional do caso — distinta da classificação técnica
 * de divergência (seção 19): `statusFinal` reflete se o caso pode ser
 * usado como evidência de prontidão, não se o resultado fiscal está
 * "certo" ou "errado".
 */
export function construirAvaliacaoCaso(caso: CasoPiloto, opcoes: OpcoesAvaliacaoCaso = {}): AvaliacaoCasoPiloto {
  const problemas = (opcoes.problemas ?? []).filter((p) => p.casoId === caso.id);
  const criteriosTecnicos = avaliarCriteriosTecnicos(caso, problemas, opcoes.resultadoComparacao?.classificacao);

  const temProblemaCritico = problemas.some((p) => p.severidade === "critica");
  const temProblemaBloqueante = problemas.some(problemaBloqueiaProntidao);
  const divergenciaMaterial = opcoes.resultadoComparacao?.classificacao === "divergencia_material";
  const temRessalva = problemas.length > 0 || caso.pendencias.length > 0 || Object.values(caso.qualidadeEntrada).some((q) => q === "indeterminado" || q === "parcial");

  let statusFinal: StatusOperacionalCaso;
  if (temProblemaCritico) statusFinal = "bloqueado";
  else if (divergenciaMaterial || temProblemaBloqueante) statusFinal = "requer_ajuste";
  else if (temRessalva) statusFinal = "aprovado_com_ressalvas";
  else statusFinal = "aprovado";

  return {
    casoId: caso.id,
    validacaoTecnica: criteriosTecnicos.atendido,
    validacaoEntrada: caso.statusExecucaoV2 === "executado",
    validacaoComparativa: opcoes.resultadoComparacao?.classificacao ?? "nao_avaliada",
    validacaoApresentacao: opcoes.apresentacao ?? "nao_avaliada",
    validacaoAuditabilidade: opcoes.auditabilidade ?? "nao_avaliada",
    divergencias: opcoes.resultadoComparacao?.divergenciasResultado ?? [],
    problemas,
    ressalvas: caso.pendencias,
    ganhosV2: opcoes.ganhosV2 ?? opcoes.resultadoComparacao?.ganhosCoberturaV2 ?? [],
    statusFinal,
  };
}

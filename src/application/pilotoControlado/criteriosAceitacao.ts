/**
 * Critérios objetivos de aceitação — técnicos e de experiência,
 * deliberadamente separados (seção 21/22 do pedido): opinião de UX
 * nunca vira verdade técnica, e vice-versa.
 */
import type { CasoPiloto, ProblemaPiloto } from "./tipos";
import type { ClassificacaoDivergencia } from "../comparacaoV2Legado/tipos";

/** Critérios técnicos (seção 20) — todos precisam ser verdadeiros. */
export function avaliarCriteriosTecnicos(caso: CasoPiloto, problemas: ProblemaPiloto[], classificacaoComparativa?: ClassificacaoDivergencia): { atendido: boolean; motivos: string[] } {
  const motivos: string[] = [];

  if (caso.statusExecucaoV2 !== "executado") motivos.push("Pipeline V2 não executou com sucesso.");

  const problemasDoCase = problemas.filter((p) => p.casoId === caso.id);
  if (problemasDoCase.some((p) => p.severidade === "critica")) motivos.push("Existe problema de severidade crítica não resolvido.");

  if (classificacaoComparativa === "divergencia_material") motivos.push("Existe divergência material com o legado não explicada por cobertura.");

  return { atendido: motivos.length === 0, motivos };
}

/** Critérios de experiência (seção 21) — informativos, nunca bloqueiam sozinhos a aprovação técnica. */
export interface CriteriosExperiencia {
  conseguiuPreencher: boolean;
  entendeuWarnings: boolean;
  identificouCamposObrigatorios: boolean;
  chegouAAnalise: boolean;
  conseguiuExplicarResultado: boolean;
  usouModoApresentacao: boolean;
  abriuMemoriaTecnicaQuandoQuestionado: boolean;
}

export function avaliarCriteriosExperiencia(criterios: CriteriosExperiencia): { atendidos: number; total: number; itensNaoAtendidos: string[] } {
  const entradas = Object.entries(criterios) as [keyof CriteriosExperiencia, boolean][];
  const itensNaoAtendidos = entradas.filter(([, valor]) => !valor).map(([chave]) => chave);
  return { atendidos: entradas.length - itensNaoAtendidos.length, total: entradas.length, itensNaoAtendidos };
}

/** Severidade que bloqueia prontidão técnica — problemas fiscais/técnicos/de dados críticos ou altos (seção 55-60/82). */
export function problemaBloqueiaProntidao(problema: ProblemaPiloto): boolean {
  if (problema.categoria === "ux" || problema.categoria === "apresentacao") return false;
  return problema.severidade === "critica" || problema.severidade === "alta";
}

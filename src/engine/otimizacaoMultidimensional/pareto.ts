/**
 * Dominância de Pareto — calculada EXCLUSIVAMENTE sobre os valores
 * objetivos brutos (carga fiscal, resultado econômico, capital de giro
 * adicional), NUNCA sobre `ScoreEstrategico` (Score não interfere na
 * dominância — princípio explícito desta fase). Um objetivo
 * indisponível em qualquer um dos dois pontos é EXCLUÍDO da comparação
 * daquele par (nunca tratado como 0 — "indeterminado nunca vira zero").
 * Nenhum ponto da fronteira é rotulado como "melhor"/"recomendado".
 */

import { DIRECAO_POR_OBJETIVO, type Objetivo, type PontoAvaliado } from "./tipos";

const TOLERANCIA = 0.01;

/** `true` quando `a` domina `b`: melhor ou igual em todos os objetivos comparáveis, estritamente melhor em pelo menos um. Pares sem nenhum objetivo comparável (ambos indisponíveis) nunca produzem dominância — ver seção "incomparável". */
function domina(a: PontoAvaliado, b: PontoAvaliado, objetivos: Objetivo[]): boolean {
  let temVantagemEstrita = false;
  let temComparavel = false;

  for (const objetivo of objetivos) {
    const va = a.objetivos[objetivo];
    const vb = b.objetivos[objetivo];
    if (!va?.disponivel || !vb?.disponivel || va.valor === undefined || vb.valor === undefined) continue;
    temComparavel = true;

    const diferenca = va.valor - vb.valor;
    const direcao = DIRECAO_POR_OBJETIVO[objetivo];
    const aMelhor = direcao === "minimizar" ? diferenca < -TOLERANCIA : diferenca > TOLERANCIA;
    const aPior = direcao === "minimizar" ? diferenca > TOLERANCIA : diferenca < -TOLERANCIA;

    if (aPior) return false; // a perde em algum objetivo comparável → não domina.
    if (aMelhor) temVantagemEstrita = true;
  }

  return temComparavel && temVantagemEstrita;
}

/** Fronteira de Pareto entre pontos JURIDICAMENTE VÁLIDOS — pontos bloqueados juridicamente nunca entram na comparação (são excluídos antes de chamar esta função). */
export function calcularFronteiraPareto(pontos: PontoAvaliado[], objetivos: Objetivo[]): PontoAvaliado[] {
  return pontos.filter((candidato) => !pontos.some((outro) => outro.id !== candidato.id && domina(outro, candidato, objetivos)));
}

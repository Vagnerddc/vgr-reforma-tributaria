/**
 * Consolidação (seção 4/32/33/34) — soma ponderada SÓ quando todas as
 * dimensões materiais estão `"calculado"` (regra de cobertura mínima da
 * metodologia). Nunca redistribui peso de uma dimensão indisponível
 * (seção 32) — preferência conservadora: `undefined` + `parcial`/
 * `indeterminado` em vez de fabricar precisão (seção 33).
 */

import { validarMetodologia, type MetodologiaScore } from "./metodologia";
import type { ExplicacaoScore, ScoreDimensao, StatusScore } from "./tipos";

export interface ResultadoConsolidacao {
  scoreConsolidado?: number;
  statusConsolidado: StatusScore;
  explicacao: ExplicacaoScore;
}

const LIMIAR_FATOR_FAVORAVEL = 65;
const LIMIAR_FATOR_LIMITANTE = 40;

export function consolidarScore(dimensoes: ScoreDimensao[], metodologia: MetodologiaScore): ResultadoConsolidacao {
  validarMetodologia(metodologia);

  const calculadas = dimensoes.filter((d) => d.status === "calculado");
  const naoAplicaveis = dimensoes.filter((d) => d.status === "nao_aplicavel");
  const indisponiveis = dimensoes.filter((d) => d.status !== "calculado" && d.status !== "nao_aplicavel");

  const dimensoesMateriais = dimensoes.filter((d) => !naoAplicaveis.includes(d));
  const todasCalculadas = dimensoesMateriais.length > 0 && dimensoesMateriais.every((d) => d.status === "calculado");

  const explicacao: ExplicacaoScore = {
    principaisFatoresPositivos: calculadas.filter((d) => (d.valor ?? 0) >= LIMIAR_FATOR_FAVORAVEL).map((d) => `${d.dimensao}: ${d.valor?.toFixed(0)}/100`),
    principaisFatoresLimitantes: calculadas.filter((d) => (d.valor ?? 0) < LIMIAR_FATOR_LIMITANTE).map((d) => `${d.dimensao}: ${d.valor?.toFixed(0)}/100`),
    dimensoesIndisponiveis: indisponiveis.map((d) => d.dimensao),
  };

  if (!todasCalculadas) {
    const status: StatusScore = calculadas.length === 0 ? "indeterminado" : "parcial";
    return { scoreConsolidado: undefined, statusConsolidado: status, explicacao };
  }

  const scoreConsolidado = calculadas.reduce((soma, d) => soma + d.valor! * metodologia.pesos[d.dimensao], 0);
  return { scoreConsolidado, statusConsolidado: "calculado", explicacao };
}

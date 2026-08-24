/**
 * Metodologia versionada (seção 28/29/69/70) — todo peso usado é
 * explícito, configurado aqui e validado em runtime (seção 26/27:
 * nenhum peso escondido/hardcoded espalhado pelo código). `VGR_SCORE_V1`
 * é a primeira versão, deliberadamente não declarada como definitiva.
 */

import type { NomeDimensao } from "./tipos";

export interface MetodologiaScore {
  id: string;
  versao: string;
  dimensoes: NomeDimensao[];
  pesos: Record<NomeDimensao, number>;
  /** Regra de cobertura mínima para o score consolidado (seção 34) — nesta versão, todas as dimensões precisam estar `"calculado"`; nenhum threshold parcial (70%/80%) foi inventado sem fundamento. */
  regraCoberturaMinima: "todas_dimensoes_calculadas";
  escala: { min: number; max: number };
}

export const VGR_SCORE_V1: MetodologiaScore = {
  id: "VGR_SCORE",
  versao: "V1",
  dimensoes: ["fiscal", "economica", "financeira", "robustez", "qualidade_informacao", "aplicabilidade"],
  pesos: { fiscal: 0.25, economica: 0.25, financeira: 0.2, robustez: 0.15, qualidade_informacao: 0.1, aplicabilidade: 0.05 },
  regraCoberturaMinima: "todas_dimensoes_calculadas",
  escala: { min: 0, max: 100 },
};

export class MetodologiaInvalidaError extends Error {}

/** Validação obrigatória em runtime (seção 31/100/101/102) — nunca confia em uma metodologia configurada sem checar. */
export function validarMetodologia(metodologia: MetodologiaScore): void {
  const somaPesos = metodologia.dimensoes.reduce((s, d) => s + (metodologia.pesos[d] ?? 0), 0);
  if (Math.abs(somaPesos - 1) > 1e-9) {
    throw new MetodologiaInvalidaError(`Soma dos pesos deve ser exatamente 1 (recebido: ${somaPesos}).`);
  }
  for (const dimensao of metodologia.dimensoes) {
    const peso = metodologia.pesos[dimensao];
    if (peso === undefined) throw new MetodologiaInvalidaError(`Peso ausente para a dimensão "${dimensao}".`);
    if (peso < 0) throw new MetodologiaInvalidaError(`Peso negativo para a dimensão "${dimensao}": ${peso}.`);
  }
  for (const chave of Object.keys(metodologia.pesos)) {
    if (!metodologia.dimensoes.includes(chave as NomeDimensao)) {
      throw new MetodologiaInvalidaError(`Peso definido para dimensão inexistente na metodologia: "${chave}".`);
    }
  }
}

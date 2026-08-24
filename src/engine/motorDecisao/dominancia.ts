/**
 * Dominância estratégica — nunca peso/score (seção 17/18/19 do
 * pedido). Cada dimensão declara qual direção é favorável (menor ou
 * maior) e uma tolerância PRÓPRIA (reaproveitando
 * `arredondarCentavos` para R$, e uma tolerância explícita para
 * percentuais — nunca uma tolerância única para tudo).
 */

import { arredondarCentavos } from "../motorPontosVirada/precisao";
import type { Dominancia } from "./tipos";

/** Mesma tolerância já usada em motorFinanceiro/achados.ts (EPSILON_PP) para não tratar ruído de ponto flutuante como diferença real de margem. */
export const EPSILON_PP = 0.01;

export type DirecaoFavoravel = "menor" | "maior";

export interface DimensaoComparavel {
  nome: string;
  direcao: DirecaoFavoravel;
  /** `undefined` = dimensão indisponível para este par — NUNCA tratada como empate (seção 20). */
  valorA?: number;
  valorB?: number;
  tolerancia: number;
}

export type VencedorDimensao = "A" | "B" | "empate" | "indisponivel";

export function vencedorDaDimensao(dim: DimensaoComparavel): VencedorDimensao {
  if (dim.valorA === undefined || dim.valorB === undefined) return "indisponivel";
  const diferenca = arredondarCentavos(dim.valorA - dim.valorB);
  if (Math.abs(diferenca) <= dim.tolerancia) return "empate";
  const aVence = dim.direcao === "menor" ? diferenca < 0 : diferenca > 0;
  return aVence ? "A" : "B";
}

/**
 * Compara A×B em todas as dimensões informadas. `domina` só quando A
 * vence em pelo menos uma dimensão E nunca perde em nenhuma
 * (dimensões indisponíveis não contam nem a favor nem contra — seção
 * 20). `conflitante` quando A vence em algumas e perde em outras.
 * `equivalente` só quando TODAS as dimensões disponíveis empatam.
 * `incomparavel` quando não há nenhuma dimensão disponível.
 */
export function calcularDominancia(dimensoes: DimensaoComparavel[]): { dominanciaAB: Dominancia; porDimensao: Record<string, VencedorDimensao> } {
  const porDimensao: Record<string, VencedorDimensao> = {};
  let ganhosA = 0;
  let ganhosB = 0;
  let empates = 0;
  let disponiveis = 0;

  for (const dim of dimensoes) {
    const vencedor = vencedorDaDimensao(dim);
    porDimensao[dim.nome] = vencedor;
    if (vencedor === "indisponivel") continue;
    disponiveis++;
    if (vencedor === "A") ganhosA++;
    else if (vencedor === "B") ganhosB++;
    else empates++;
  }

  let dominanciaAB: Dominancia;
  if (disponiveis === 0) dominanciaAB = "incomparavel";
  else if (ganhosA > 0 && ganhosB === 0) dominanciaAB = "domina";
  else if (ganhosB > 0 && ganhosA === 0) dominanciaAB = "dominado";
  else if (ganhosA > 0 && ganhosB > 0) dominanciaAB = "conflitante";
  else dominanciaAB = "equivalente"; // ganhosA === 0 && ganhosB === 0 && empates > 0

  return { dominanciaAB, porDimensao };
}

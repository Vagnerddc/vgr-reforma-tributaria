/**
 * Geração de grade combinatória — limites computacionais explícitos
 * (nunca uma varredura infinita). `MAX_COMBINACOES` é uma trava dura
 * documentada; excedê-la lança erro estruturado em vez de truncar
 * silenciosamente (o que esconderia que parte do espaço não foi
 * avaliado).
 */

import { LimiteComputacionalExcedidoError, type VariavelOtimizacao } from "./tipos";

/** Trava dura de segurança — muito acima de qualquer uso real esperado na V1 (poucas variáveis, poucos passos cada). */
export const MAX_COMBINACOES = 2000;

function linspace(min: number, max: number, passos: number): number[] {
  if (passos <= 1) return [min];
  const passo = (max - min) / (passos - 1);
  return Array.from({ length: passos }, (_, i) => min + i * passo);
}

/** Produto cartesiano dos valores de cada variável — cada combinação é um `Record<variavel, valor>`. */
export function gerarGrade(variaveis: VariavelOtimizacao[]): Record<string, number>[] {
  const totalCombinacoes = variaveis.reduce((s, v) => s * Math.max(1, v.passos), 1);
  if (totalCombinacoes > MAX_COMBINACOES) throw new LimiteComputacionalExcedidoError(totalCombinacoes, MAX_COMBINACOES);
  if (variaveis.length === 0) return [{}];

  const eixos = variaveis.map((v) => ({ variavel: v.variavel, valores: linspace(v.min, v.max, v.passos) }));

  let combinacoes: Record<string, number>[] = [{}];
  for (const eixo of eixos) {
    const proximas: Record<string, number>[] = [];
    for (const combinacaoParcial of combinacoes) {
      for (const valor of eixo.valores) {
        proximas.push({ ...combinacaoParcial, [eixo.variavel]: valor });
      }
    }
    combinacoes = proximas;
  }
  return combinacoes;
}

/**
 * Busca numérica genérica sobre ESTADO CATEGÓRICO (seção 20/21/23 do
 * pedido) — cobre tanto mudanças discretas de verdade (Anexo, regime
 * de menor carga, elegibilidade) quanto igualdades numéricas reduzidas a
 * 3 estados ("A menor" / "empate" / "B menor"), sem duplicar a lógica de
 * bisseção para cada caso. Nunca assume monotonicidade — só reage ao que
 * observa (seção 11/26).
 */

import type { ResultadoCenario } from "../motorCenarios/tipos";

export interface PontoAmostra {
  valor: number;
  resultado: ResultadoCenario;
  estado: string | undefined;
}

export function amostrarIntervalo(min: number, max: number, n: number, avaliar: (valor: number) => ResultadoCenario, extrairEstado: (resultado: ResultadoCenario) => string | undefined): PontoAmostra[] {
  const passo = (max - min) / (n - 1);
  return Array.from({ length: n }, (_, i) => {
    const valor = i === n - 1 ? max : min + i * passo;
    const resultado = avaliar(valor);
    return { valor, resultado, estado: extrairEstado(resultado) };
  });
}

/** Todas as transições ENTRE amostras consecutivas cujo estado difere — inclui transições envolvendo `undefined` (região indeterminada), nunca ignoradas silenciosamente. */
export function detectarTransicoes(amostras: PontoAmostra[]): { a: PontoAmostra; b: PontoAmostra }[] {
  const transicoes: { a: PontoAmostra; b: PontoAmostra }[] = [];
  for (let i = 1; i < amostras.length; i++) {
    if (amostras[i - 1].estado !== amostras[i].estado) transicoes.push({ a: amostras[i - 1], b: amostras[i] });
  }
  return transicoes;
}

export interface ResultadoRefinamento {
  esquerda: PontoAmostra;
  direita: PontoAmostra;
  iteracoes: number;
  status: "encontrado" | "resultado_indeterminado";
  motivo?: string;
}

const MAX_ITERACOES = 60;

/**
 * Bisseção sobre estado: assume que `a`/`b` têm estados DIFERENTES
 * (chamador garante isso via `detectarTransicoes`). Encolhe o intervalo
 * mantendo sempre um lado com o estado de `a`, outro com o de `b`. Se o
 * ponto médio revelar um TERCEIRO estado (nem `a` nem `b`), interrompe
 * com `resultado_indeterminado` — nunca assume que a fronteira é única
 * ou monotônica (seção 11/22).
 */
export function refinarBissecao(a: PontoAmostra, b: PontoAmostra, precisao: number, avaliar: (valor: number) => ResultadoCenario, extrairEstado: (resultado: ResultadoCenario) => string | undefined): ResultadoRefinamento {
  let esquerda = a;
  let direita = b;
  let iteracoes = 0;

  while (direita.valor - esquerda.valor > precisao && iteracoes < MAX_ITERACOES) {
    const valorMeio = (esquerda.valor + direita.valor) / 2;
    const resultado = avaliar(valorMeio);
    const estado = extrairEstado(resultado);
    const ponto: PontoAmostra = { valor: valorMeio, resultado, estado };
    iteracoes++;

    if (estado === esquerda.estado) {
      esquerda = ponto;
    } else if (estado === direita.estado) {
      direita = ponto;
    } else {
      return { esquerda, direita, iteracoes, status: "resultado_indeterminado", motivo: `Um terceiro estado ("${estado}") apareceu durante o refinamento entre "${esquerda.estado}" e "${direita.estado}" — a mudança não é uma fronteira única/monotônica neste intervalo.` };
    }
  }

  if (iteracoes >= MAX_ITERACOES) {
    return { esquerda, direita, iteracoes, status: "resultado_indeterminado", motivo: `Limite de ${MAX_ITERACOES} iterações atingido sem convergir dentro da precisão solicitada.` };
  }
  return { esquerda, direita, iteracoes, status: "encontrado" };
}

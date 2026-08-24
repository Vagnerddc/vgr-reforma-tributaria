/**
 * Normalização relativa (seção 36/39/41) — melhor valor observado entre
 * as alternativas comparáveis → 100; pior → 0. Só usada para dimensões
 * monotonicamente interpretáveis (fiscal/econômica/financeira) — NUNCA
 * para qualidade (seção 40, regra própria em dimensoes/qualidade.ts).
 * Precisão em centavos (mesma disciplina do Comparador Consolidado) —
 * valores empatados dentro da tolerância recebem o MESMO score (seção
 * 41).
 */

const TOLERANCIA = 0.01;

export interface ValorParaNormalizar {
  chave: string;
  valor: number;
}

export interface ResultadoNormalizacao {
  chave: string;
  score: number;
}

/**
 * `direcao: "menor_melhor"` (ex.: carga tributária, capital de giro) ou
 * `"maior_melhor"` (ex.: resultado, margem). Com 1 único valor, não há
 * comparação possível — o chamador deve tratar esse caso ANTES de
 * chamar esta função (seção 42/93: não gerar ranking relativo fictício
 * com uma única alternativa).
 */
export function normalizarRelativo(valores: ValorParaNormalizar[], direcao: "menor_melhor" | "maior_melhor"): ResultadoNormalizacao[] {
  if (valores.length === 0) return [];
  if (valores.length === 1) return [{ chave: valores[0].chave, score: 100 }];

  const ordenados = [...valores].sort((a, b) => a.valor - b.valor);
  const menor = ordenados[0].valor;
  const maior = ordenados[ordenados.length - 1].valor;
  const amplitude = maior - menor;

  if (amplitude <= TOLERANCIA) {
    // Todos equivalentes dentro da precisão — mesmo score para todos (seção 41).
    return valores.map((v) => ({ chave: v.chave, score: 100 }));
  }

  return valores.map((v) => {
    const fracao = (v.valor - menor) / amplitude;
    const scoreBrutal = fracao * 100;
    return { chave: v.chave, score: direcao === "menor_melhor" ? 100 - scoreBrutal : scoreBrutal };
  });
}

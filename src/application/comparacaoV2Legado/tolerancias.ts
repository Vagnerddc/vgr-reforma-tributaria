/**
 * Tolerâncias centralizadas — nunca usadas para esconder diferença
 * real (seção 11), só para absorver ruído de arredondamento
 * (seção 9/10). `undefined` nunca é tratado como equivalente a `0`
 * (seção 67) — essa distinção é feita explicitamente por
 * `compararMetrica`, não aqui.
 */

/** Tolerância monetária: R$0,01 fixo OU 0,1% do valor, o que for maior — absorve ruído de ponto flutuante em valores grandes sem esconder divergência de escala. */
export function valoresMonetariosEquivalentes(a: number, b: number): boolean {
  const diferenca = Math.abs(a - b);
  const tolerancia = Math.max(0.01, Math.abs(a) * 0.001, Math.abs(b) * 0.001);
  return diferenca <= tolerancia;
}

/** Tolerância percentual: 0,1 ponto percentual (0.001 em fração) — ruído binário, não diferença de regime/alíquota. */
export function percentuaisEquivalentes(a: number, b: number): boolean {
  return Math.abs(a - b) <= 0.001;
}

export function textosEquivalentes(a: string, b: string): boolean {
  return a === b;
}

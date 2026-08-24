/**
 * Navegação entre capítulos — lógica pura, sem DOM, para ser testável
 * isoladamente. Nunca dispara execução de motor/IA (seção 66/67/100):
 * é só aritmética de índice sobre uma lista já pronta.
 */

export function indiceProximo(atual: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(atual + 1, total - 1);
}

export function indiceAnterior(atual: number): number {
  return Math.max(atual - 1, 0);
}

/** Garante que um índice guardado (ex.: vindo de query string) nunca ultrapasse a contagem real e dinâmica de capítulos (seção 50/103). */
export function indiceValido(indice: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(indice, 0), total - 1);
}

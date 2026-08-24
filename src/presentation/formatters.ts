/**
 * Formatação centralizada (seção 27 do pedido) — reaproveita
 * `formatarReais`/`formatarPercentualPt` já existentes no design
 * system (TaxStat.tsx), nunca duplica lógica de máscara. Adiciona só o
 * que faltava: pontos percentuais e o rótulo padrão para valores
 * indisponíveis — NUNCA `0` (seção 6/25/31).
 */

import { formatarPercentualPt, formatarReais } from "../design-system";

export { formatarPercentualPt, formatarReais };

/** Nunca confundir p.p. com variação relativa (seção 34 do pedido) — sempre rotulado explicitamente. */
export function formatarPontosPercentuais(valor: number, casas = 1): string {
  const sinal = valor > 0 ? "+" : "";
  return `${sinal}${valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })} p.p.`;
}

export function formatarReaisCompacto(valor: number): string {
  const abs = Math.abs(valor);
  if (abs >= 1_000_000) return `${valor < 0 ? "-" : ""}R$ ${(abs / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  if (abs >= 1_000) return `${valor < 0 ? "-" : ""}R$ ${(abs / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return formatarReais(valor);
}

/** Rótulo padrão para "não temos esse dado" — nunca `0`, nunca escondido (seção 6/25/31: "indisponível !== 0"). */
export const ROTULO_INDISPONIVEL = "Indisponível";
export const ROTULO_NAO_CALCULADO = "Não calculado";
export const ROTULO_FORA_DA_COMPARACAO = "Fora da comparação";

export function formatarValorOuIndisponivel(valor: number | undefined, formatar: (v: number) => string): string {
  return valor === undefined ? ROTULO_INDISPONIVEL : formatar(valor);
}

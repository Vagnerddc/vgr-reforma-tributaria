/**
 * Qualidade consolidada por dimensão — nunca uma média 0-100 (seção 15/16
 * do pedido). Cada dimensão é o PIOR veredito entre todos os regimes/anos
 * considerados naquela dimensão — nunca deixa uma dimensão boa esconder
 * outra ruim (ex.: Fiscal alta + Caixa insuficiente não vira "alta").
 */

import type { QualidadeDimensao } from "./tipos";

const ORDEM_QUALIDADE: Record<string, number> = { insuficiente: 0, baixa: 1, parcial: 1, media: 2, alta: 3, indisponivel: -1 };

/** `"indisponivel"` (dimensão nunca calculada) é reportado separadamente — nunca comparado como "pior que insuficiente" nem "melhor". */
export function piorQualidade(valores: QualidadeDimensao[]): QualidadeDimensao {
  const consideradas = valores.filter((v) => v !== "indisponivel");
  if (consideradas.length === 0) return "indisponivel";
  return consideradas.reduce((pior, atual) => (ORDEM_QUALIDADE[atual] < ORDEM_QUALIDADE[pior] ? atual : pior));
}

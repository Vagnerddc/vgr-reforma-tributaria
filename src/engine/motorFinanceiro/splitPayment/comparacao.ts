/**
 * Comparação de impacto de caixa ENTRE regimes (seção 34-37 do pedido) —
 * indicador puramente matemático, nunca "regime recomendado" (isso é
 * responsabilidade do futuro Motor Estratégico). Preserva deliberadamente
 * o caso em que o regime de menor tributo NÃO é o de menor necessidade de
 * capital de giro (seção 37/50 — divergência obrigatória de existir na
 * arquitetura, nunca escondida por um ranking único).
 */

import type { ComparacaoImpactoCaixaRegimes, ResultadoImpactoCaixa } from "./tipos";

export function compararImpactoCaixaRegimes(ano: number, resultados: ResultadoImpactoCaixa[]): ComparacaoImpactoCaixaRegimes {
  const calculados = resultados.filter((r) => r.disponivel && r.picoCapitalGiroAdicional !== undefined);
  if (calculados.length === 0) return { ano, resultados };

  const menor = calculados.reduce((min, r) => (r.picoCapitalGiroAdicional! < min.picoCapitalGiroAdicional! ? r : min));
  return { ano, resultados, regimeComMenorNecessidadeCapital: menor.regime };
}

import type { RelatorioAuditoriaEstrategica, AchadoEstrategico, CodigoAchadoEstrategico } from "../motorAchados/tipos";
import type { ResultadoCenario } from "../motorCenarios/tipos";
import type { ResultadoPontoVirada } from "../motorPontosVirada/tipos";
import type { Regime } from "../types";

export interface ContextoEstrategico {
  relatorio: RelatorioAuditoriaEstrategica;
  resultado: ResultadoCenario;
  ano: number;
  pontosVirada: ResultadoPontoVirada[];
}

export function achadosPorCodigo(ctx: ContextoEstrategico, codigo: CodigoAchadoEstrategico): AchadoEstrategico[] {
  return ctx.relatorio.achados.filter((a) => a.codigo === codigo);
}

export function temAchado(ctx: ContextoEstrategico, codigo: CodigoAchadoEstrategico): boolean {
  return achadosPorCodigo(ctx, codigo).length > 0;
}

/** Menor qualidade entre um conjunto de achados essenciais — nunca promovida (seção 53). */
export function qualidadeMinima(achados: AchadoEstrategico[]): AchadoEstrategico["qualidade"] {
  const ordem = { insuficiente: 0, baixa: 1, media: 2, alta: 3 } as const;
  if (achados.length === 0) return "insuficiente";
  return achados.reduce((pior, a) => (ordem[a.qualidade] < ordem[pior] ? a.qualidade : pior), "alta" as AchadoEstrategico["qualidade"]);
}

export function pontoViradaPorVariavel(ctx: ContextoEstrategico, variavel: string): ResultadoPontoVirada | undefined {
  return ctx.pontosVirada.find((p) => p.variavel === variavel && p.status === "encontrado");
}

export function regimesComResultadoCaixa(ctx: ContextoEstrategico): Regime[] {
  return (ctx.resultado.resultadoCaixaPorRegime ?? []).map((r) => r.regime);
}

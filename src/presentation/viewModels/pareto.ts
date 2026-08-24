/**
 * ViewModel da Fronteira de Pareto (seção 14 do pedido) — "Configurações
 * eficientes encontradas", NUNCA "solução ótima". Nenhuma numeração
 * 1º/2º/3º (isso seria ranking, proibido); rótulos como "menor carga"/
 * "maior margem" só quando objetivamente derivados (o próprio ponto é
 * o extremo daquele objetivo entre os pontos da fronteira — calculado
 * aqui só como leitura de min/max, nunca uma nova otimização).
 */

import type { Objetivo, PontoParetoFronteira } from "../../engine/otimizacaoMultidimensional/tipos";

const ROTULO_OBJETIVO: Record<Objetivo, string> = {
  minimizar_carga_fiscal: "Menor carga",
  maximizar_resultado_economico: "Maior resultado econômico",
  minimizar_capital_giro_adicional: "Menor capital de giro adicional",
};

export interface ConfiguracaoParetoViewModel {
  id: string;
  valoresVariaveis: Record<string, number>;
  objetivos: { objetivo: Objetivo; rotulo: string; valor?: number }[];
  /** Só populado quando este ponto é objetivamente o extremo (melhor valor) de algum objetivo ENTRE os pontos da fronteira — nunca um rótulo subjetivo. */
  rotulosObjetivosExtremos: string[];
}

export interface ParetoViewModel {
  explicacaoMetodologica: string;
  configuracoes: ConfiguracaoParetoViewModel[];
}

export function construirParetoViewModel(fronteira: PontoParetoFronteira[], objetivos: Objetivo[]): ParetoViewModel {
  const extremosPorObjetivo = new Map<Objetivo, string>(); // objetivo -> id do ponto extremo (se único)

  for (const objetivo of objetivos) {
    const comValor = fronteira.map((f) => ({ id: f.ponto.id, valor: f.ponto.objetivos[objetivo]?.valor })).filter((v): v is { id: string; valor: number } => v.valor !== undefined);
    if (comValor.length === 0) continue;
    const direcaoMinimiza = objetivo.startsWith("minimizar");
    const melhor = comValor.reduce((m, v) => (direcaoMinimiza ? (v.valor < m.valor ? v : m) : v.valor > m.valor ? v : m));
    const empatados = comValor.filter((v) => v.valor === melhor.valor);
    if (empatados.length === 1) extremosPorObjetivo.set(objetivo, melhor.id);
  }

  const configuracoes: ConfiguracaoParetoViewModel[] = fronteira.map((f) => ({
    id: f.ponto.id,
    valoresVariaveis: f.ponto.valoresVariaveis,
    objetivos: objetivos.map((objetivo) => ({ objetivo, rotulo: ROTULO_OBJETIVO[objetivo], valor: f.ponto.objetivos[objetivo]?.valor })),
    rotulosObjetivosExtremos: objetivos.filter((o) => extremosPorObjetivo.get(o) === f.ponto.id).map((o) => ROTULO_OBJETIVO[o]),
  }));

  return {
    explicacaoMetodologica: "Estas configurações pertencem à fronteira eficiente porque nenhuma é simultaneamente superior às demais em todos os objetivos analisados.",
    configuracoes,
  };
}

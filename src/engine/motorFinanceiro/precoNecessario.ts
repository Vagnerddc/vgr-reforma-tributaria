/**
 * Preço/reajuste necessário para preservar margem — fórmula ANALÍTICA
 * fechada (seção 21 do pedido: "não usar aproximação iterativa se houver
 * fórmula analítica segura"). Resolve corretamente o caso em que o
 * próprio tributo é função da receita (seção 22) — nunca faz
 * `preço + aumento do imposto`.
 *
 * Modelo (documentado, não escondido — ver docs/motor-financeiro.md,
 * seção I, para o racional completo):
 *
 *   Resultado(R) = R × (1 − k − t) − CF
 *   margem(R)    = Resultado(R) ÷ R
 *
 * onde:
 *   R  = receita/preço equivalente
 *   k  = fração dos custos que escala com a receita (PremissasFinanceiras.percentualCustosVariaveis; 0 quando ausente — todo custo tratado como FIXO por padrão, nunca assumido proporcional sem dado)
 *   CF = custos fixos = custos totais × (1 − k)
 *   t  = alíquota efetiva implícita da carga tributária = cargaFiscal ÷ receita do ano (premissa: a carga escala linearmente com a receita ao redor do ponto atual — só vale para pequenas variações de preço, não para reajustes extremos)
 *
 * Resolvendo margem(R*) = m (margem-alvo):
 *   R* = CF ÷ (1 − k − t − m)
 *
 * Sem solução finita positiva quando (1 − k − t − m) ≤ 0 — a margem-alvo
 * é matematicamente inatingível mesmo com preço infinito (custos
 * variáveis + carga tributária + margem-alvo já consomem tudo).
 */

export interface ModeloReceitaResultado {
  custosFixos: number;
  fracaoCustosVariaveis: number;
  aliquotaEfetivaImplicita: number;
}

export function resultadoNaReceita(receita: number, modelo: ModeloReceitaResultado): number {
  return receita * (1 - modelo.fracaoCustosVariaveis - modelo.aliquotaEfetivaImplicita) - modelo.custosFixos;
}

export function margemNaReceita(receita: number, modelo: ModeloReceitaResultado): number {
  if (receita <= 0) return 0;
  return resultadoNaReceita(receita, modelo) / receita;
}

export type ResultadoReceitaNecessaria = { possivel: true; receitaNecessaria: number } | { possivel: false; motivo: string };

/** Resolve R* tal que margem(R*) = margemAlvo — fórmula fechada, nunca iterativa. */
export function calcularReceitaNecessariaParaMargem(modelo: ModeloReceitaResultado, margemAlvo: number): ResultadoReceitaNecessaria {
  const denominador = 1 - modelo.fracaoCustosVariaveis - modelo.aliquotaEfetivaImplicita - margemAlvo;
  if (denominador <= 0) {
    return { possivel: false, motivo: "Margem-alvo matematicamente inatingível: custos variáveis + carga tributária + margem-alvo somam 100% ou mais da receita, mesmo com preço infinito." };
  }
  return { possivel: true, receitaNecessaria: modelo.custosFixos / denominador };
}

export interface CenarioRepasseCalculado {
  percentualRepasse: number;
  receita: number;
  resultado: number;
  margem: number;
}

/**
 * Repasse 0% = absorção integral (receita não muda); repasse 100% =
 * receita necessária para restaurar a margem-alvo (seção 25 — "ajuste
 * suficiente para neutralizar o impacto tributário alvo", aqui definido
 * como igualar a margem-alvo); repasse intermediário = interpolação
 * linear em receita entre os dois extremos (nunca em margem diretamente,
 * para preservar a fórmula fechada acima).
 */
export function calcularCenarioRepasse(percentualRepasse: number, receitaAtual: number, receitaNoRepasseIntegral: number, modelo: ModeloReceitaResultado): CenarioRepasseCalculado {
  const receita = receitaAtual + percentualRepasse * (receitaNoRepasseIntegral - receitaAtual);
  return { percentualRepasse, receita, resultado: resultadoNaReceita(receita, modelo), margem: margemNaReceita(receita, modelo) };
}

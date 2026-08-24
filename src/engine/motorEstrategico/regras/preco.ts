/**
 * AVALIAR_RECOMPOSICAO_PRECO — nasce de MARGEM_REDUZIDA/MARGEM_NEGATIVA
 * + REAJUSTE_PRECO_NECESSARIO (achados já produzidos pelo Motor de
 * Achados/Motor Financeiro). Nunca recalcula preço (seção 9); usa
 * exatamente `cenariosRepasse` já produzido — reutilizado, não
 * duplicado (seção 10/45).
 */

import type { AlternativaEstrategica } from "../tipos";
import { achadosPorCodigo, qualidadeMinima, type ContextoEstrategico } from "../contexto";

export function gerarAvaliarRecomposicaoPreco(ctx: ContextoEstrategico): AlternativaEstrategica[] {
  const reajuste = achadosPorCodigo(ctx, "REAJUSTE_PRECO_NECESSARIO")[0];
  const margemReduzida = [...achadosPorCodigo(ctx, "MARGEM_REDUZIDA"), ...achadosPorCodigo(ctx, "MARGEM_NEGATIVA")][0];
  if (!reajuste || !margemReduzida) return [];

  const regime = reajuste.regime;
  const anoFinanceiro = regime ? ctx.resultado.resultadoFinanceiroPorRegime.find((r) => r.regime === regime)?.resultado.anos.find((a) => a.ano === ctx.ano) : undefined;

  const impactosConhecidos = (anoFinanceiro?.cenariosRepasse ?? []).map((c) => ({
    descricao: `Repasse de ${(c.percentualRepasse * 100).toFixed(0)}% → margem resultante`,
    valor: c.margem,
    unidade: "percentual" as const,
    origem: "motor_financeiro:ResultadoAnoEconomicoFinanceiro.cenariosRepasse",
  }));

  return [
    {
      id: `alternativa:AVALIAR_RECOMPOSICAO_PRECO:${regime ?? "geral"}:${ctx.ano}`,
      codigo: "AVALIAR_RECOMPOSICAO_PRECO",
      categoria: "preco",
      titulo: "Avaliar recomposição de preço",
      objetivo: "Existe uma alternativa de recomposição de preço capaz de preservar matematicamente a margem, condicionada ao reajuste médio equivalente calculado pelo Motor Financeiro.",
      descricaoTecnica: `Reajuste médio de referência: ${((reajuste.valor ?? 0) * 100).toFixed(2)}% (fonte: ${reajuste.codigo}). Margem reduzida em ${margemReduzida.valor?.toFixed(2)} p.p. em relação ao ano-base.`,
      achadosOrigem: [reajuste.id, margemReduzida.id],
      evidencias: [...reajuste.evidencias, ...margemReduzida.evidencias],
      aplicabilidade: "condicionada",
      condicoes: ["Reajuste médio de referência calculado pelo Motor Financeiro é matematicamente possível para a margem-alvo informada."],
      dependencias: ["viabilidade_comercial_nao_analisada"],
      restricoes: ["O Motor Financeiro prova viabilidade matemática — não prova aceitação pelo cliente, elasticidade, concorrência ou manutenção de volume."],
      impactosConhecidos,
      impactosIndeterminados: ["elasticidade de demanda", "reação da concorrência", "perda de volume"],
      cenariosRelacionados: regime ? [{ cenarioId: ctx.resultado.cenarioId, descricao: `Cenários de repasse (0%/50%/100%) do regime ${regime} em ${ctx.ano}` }] : [],
      pontosViradaRelacionados: [],
      periodosAplicaveis: [{ ano: ctx.ano }],
      qualidade: qualidadeMinima([reajuste, margemReduzida]),
      premissas: { reajusteMedioNecessario: reajuste.valor ?? 0 },
      riscos: [{ tipo: "RISCO_COMERCIAL", descricao: "Viabilidade comercial do reajuste (aceitação do cliente, elasticidade, concorrência) não foi analisada por nenhum motor desta plataforma." }],
      bloqueios: [],
      validacoesNecessarias: [{ tipo: "VALIDACAO_COMERCIAL", descricao: "Avaliar viabilidade comercial do reajuste com a área responsável.", motivo: "Motor Financeiro só valida viabilidade matemática.", bloqueante: false }],
      origens: reajuste.origens,
      regime,
    },
  ];
}

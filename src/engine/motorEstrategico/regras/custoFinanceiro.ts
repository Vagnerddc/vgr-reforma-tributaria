/**
 * AVALIAR_CUSTO_FINANCEIRO — nasce de CUSTO_FINANCEIRO_ADICIONAL (só
 * calculado quando a taxa de custo de capital foi informada — split
 * payment/motor.ts). Ponto de virada de custo de capital, quando
 * existir, é vinculado por referência.
 */

import type { AlternativaEstrategica } from "../tipos";
import { achadosPorCodigo, pontoViradaPorVariavel, qualidadeMinima, type ContextoEstrategico } from "../contexto";

export function gerarAvaliarCustoFinanceiro(ctx: ContextoEstrategico): AlternativaEstrategica[] {
  const custoFinanceiro = achadosPorCodigo(ctx, "CUSTO_FINANCEIRO_ADICIONAL")[0];
  if (!custoFinanceiro) return [];

  const pontoVirada = pontoViradaPorVariavel(ctx, "custoCapital");

  return [
    {
      id: `alternativa:AVALIAR_CUSTO_FINANCEIRO:${custoFinanceiro.regime ?? "geral"}:${ctx.ano}`,
      codigo: "AVALIAR_CUSTO_FINANCEIRO",
      categoria: "custo_financeiro",
      titulo: "Avaliar custo financeiro do capital adicional",
      objetivo: "O custo financeiro do capital de giro adicional (taxa informada × capital adicional) é uma dimensão separada da carga tributária — avaliar seu impacto sobre o resultado.",
      descricaoTecnica: custoFinanceiro.descricaoTecnica,
      achadosOrigem: [custoFinanceiro.id],
      evidencias: custoFinanceiro.evidencias,
      aplicabilidade: "potencialmente_aplicavel",
      condicoes: ["Taxa de custo de capital informada (sem ela, o custo financeiro fica indeterminado, não zero)."],
      dependencias: [],
      restricoes: ["Custo financeiro nunca é somado à carga tributária — são naturezas diferentes (ver motorFinanceiro/splitPayment)."],
      impactosConhecidos: [{ descricao: custoFinanceiro.tituloTecnico, valor: custoFinanceiro.valor, unidade: custoFinanceiro.unidade, origem: "motor_split_payment:CUSTO_FINANCEIRO_ADICIONAL" }],
      impactosIndeterminados: ["condições de mercado para financiamento futuro"],
      cenariosRelacionados: [],
      pontosViradaRelacionados: pontoVirada?.valorEncontrado !== undefined ? [{ tipo: pontoVirada.tipo, variavel: pontoVirada.variavel, valorEncontrado: pontoVirada.valorEncontrado, estadoAntes: pontoVirada.estadoAntes?.estadoCategorico, estadoDepois: pontoVirada.estadoDepois?.estadoCategorico }] : [],
      periodosAplicaveis: [{ ano: ctx.ano }],
      qualidade: qualidadeMinima([custoFinanceiro]),
      premissas: {},
      riscos: [],
      bloqueios: [],
      validacoesNecessarias: [],
      origens: custoFinanceiro.origens,
      regime: custoFinanceiro.regime,
    },
  ];
}

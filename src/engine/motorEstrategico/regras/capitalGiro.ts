/**
 * AVALIAR_CAPITAL_GIRO — nasce de CAPITAL_GIRO_ADICIONAL/PICO_CAPITAL_GIRO/
 * REDUCAO_DISPONIBILIDADE_CAIXA (splitPayment/achados.ts, já
 * consolidados pelo Motor de Achados). Nunca recomenda linha de crédito
 * (seção 23) — só o valor incremental estimado.
 */

import type { AlternativaEstrategica } from "../tipos";
import { achadosPorCodigo, pontoViradaPorVariavel, qualidadeMinima, type ContextoEstrategico } from "../contexto";

export function gerarAvaliarCapitalGiro(ctx: ContextoEstrategico): AlternativaEstrategica[] {
  const capitalAdicional = achadosPorCodigo(ctx, "CAPITAL_GIRO_ADICIONAL")[0];
  const pico = achadosPorCodigo(ctx, "PICO_CAPITAL_GIRO")[0];
  const reducao = achadosPorCodigo(ctx, "REDUCAO_DISPONIBILIDADE_CAIXA")[0];
  const essenciais = [capitalAdicional, pico, reducao].filter((a): a is NonNullable<typeof a> => a !== undefined);
  if (essenciais.length === 0) return [];

  const pontoVirada = pontoViradaPorVariavel(ctx, "percentualRecebimentosSujeitosSplit") ?? pontoViradaPorVariavel(ctx, "percentualTributoSegregadoSplit");

  return [
    {
      id: `alternativa:AVALIAR_CAPITAL_GIRO:${capitalAdicional?.regime ?? pico?.regime ?? "geral"}:${ctx.ano}`,
      codigo: "AVALIAR_CAPITAL_GIRO",
      categoria: "capital_giro",
      titulo: "Avaliar capital de giro",
      objetivo: "Existe necessidade incremental de capital de giro estimada, decorrente da mecânica de split payment — sem indicar fonte de financiamento.",
      descricaoTecnica: essenciais.map((a) => a.descricaoTecnica).join(" "),
      achadosOrigem: essenciais.map((a) => a.id),
      evidencias: essenciais.flatMap((a) => a.evidencias),
      aplicabilidade: "potencialmente_aplicavel",
      condicoes: ["Premissas de split payment (percentual sujeito e percentual segregado) informadas."],
      dependencias: [],
      restricoes: ["Este motor não recomenda contratação de linha de crédito ou qualquer produto financeiro — apenas o valor incremental estimado."],
      impactosConhecidos: essenciais.map((a) => ({ descricao: a.tituloTecnico, valor: a.valor, unidade: a.unidade, origem: `motor_split_payment:${a.codigo}` })),
      impactosIndeterminados: ["custo e condições de eventual financiamento", "impacto sobre linhas de crédito já contratadas"],
      cenariosRelacionados: [],
      pontosViradaRelacionados: pontoVirada?.valorEncontrado !== undefined ? [{ tipo: pontoVirada.tipo, variavel: pontoVirada.variavel, valorEncontrado: pontoVirada.valorEncontrado, estadoAntes: pontoVirada.estadoAntes?.estadoCategorico, estadoDepois: pontoVirada.estadoDepois?.estadoCategorico }] : [],
      periodosAplicaveis: [{ ano: ctx.ano }],
      qualidade: qualidadeMinima(essenciais),
      premissas: {},
      riscos: [{ tipo: "RISCO_CAIXA", descricao: "Necessidade de capital de giro adicional não coberta pode reduzir a disponibilidade financeira operacional." }],
      bloqueios: [],
      validacoesNecessarias: [],
      origens: essenciais[0].origens,
      regime: capitalAdicional?.regime ?? pico?.regime,
    },
  ];
}

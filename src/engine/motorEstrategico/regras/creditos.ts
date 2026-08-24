/**
 * AVALIAR_ESTRUTURA_CREDITOS — nasce de INDICE_CREDITO_CALCULADO/
 * CREDITOS_INDETERMINADOS/CREDITO_ADICIONAL_PARA_NEUTRALIZAR_REFORMA
 * (+ ponto de virada de créditos, quando existir). Separa
 * credito_confirmado/estimado/potencial (seção 13) via `status` do
 * achado de origem — nunca inventa classificação nova.
 */

import type { AlternativaEstrategica } from "../tipos";
import { achadosPorCodigo, pontoViradaPorVariavel, qualidadeMinima, type ContextoEstrategico } from "../contexto";

export function gerarAvaliarEstruturaCreditos(ctx: ContextoEstrategico): AlternativaEstrategica[] {
  const indice = achadosPorCodigo(ctx, "INDICE_CREDITO_CALCULADO")[0];
  const indeterminados = achadosPorCodigo(ctx, "CREDITOS_INDETERMINADOS")[0];
  const creditoNecessario = achadosPorCodigo(ctx, "CREDITO_ADICIONAL_PARA_NEUTRALIZAR_REFORMA")[0];
  const essenciais = [indice, indeterminados, creditoNecessario].filter((a): a is NonNullable<typeof a> => a !== undefined);
  if (essenciais.length === 0) return [];

  const pontoVirada = pontoViradaPorVariavel(ctx, "creditosIbsCbs");
  const statusCredito = indice ? (indice.status === "confirmado" ? "credito_confirmado" : "credito_estimado") : indeterminados ? "credito_potencial" : undefined;

  return [
    {
      id: `alternativa:AVALIAR_ESTRUTURA_CREDITOS:${ctx.ano}`,
      codigo: "AVALIAR_ESTRUTURA_CREDITOS",
      categoria: "creditos",
      titulo: "Avaliar estrutura de créditos",
      objetivo: "Investigar a estrutura de créditos IBS/CBS já classificada e a parcela ainda indeterminada, com o valor que neutralizaria matematicamente o impacto tributário identificado, quando aplicável.",
      descricaoTecnica: [
        indice ? `Índice de crédito calculado: ${((indice.valor ?? 0) * 100).toFixed(1)}% do faturamento (${statusCredito}).` : undefined,
        indeterminados ? `${((indeterminados.valor ?? 0) * 100).toFixed(1)}% do faturamento em categorias com tratamento de crédito ainda não confirmado.` : undefined,
        creditoNecessario ? `Crédito adicional que neutralizaria o aumento de carga identificado: R$ ${creditoNecessario.valor?.toFixed(2)}.` : undefined,
      ]
        .filter(Boolean)
        .join(" "),
      achadosOrigem: essenciais.map((a) => a.id),
      evidencias: essenciais.flatMap((a) => a.evidencias),
      aplicabilidade: indeterminados ? "condicionada" : "potencialmente_aplicavel",
      condicoes: ["Estrutura de custos/despesas informada com categorias classificadas quanto ao tratamento de crédito IBS/CBS."],
      dependencias: indeterminados ? ["classificacao_completa_das_categorias_de_custo"] : [],
      restricoes: ["Este motor não afirma que a empresa deve buscar crédito adicional — apenas o valor que, matematicamente, neutralizaria o impacto identificado."],
      impactosConhecidos: essenciais.map((a) => ({ descricao: a.tituloTecnico, valor: a.valor, unidade: a.unidade, origem: `motor_achados:${a.codigo}` })),
      impactosIndeterminados: indeterminados ? ["tratamento de crédito das categorias ainda não classificadas"] : [],
      cenariosRelacionados: [],
      pontosViradaRelacionados: pontoVirada?.valorEncontrado !== undefined ? [{ tipo: pontoVirada.tipo, variavel: pontoVirada.variavel, valorEncontrado: pontoVirada.valorEncontrado, estadoAntes: pontoVirada.estadoAntes?.estadoCategorico, estadoDepois: pontoVirada.estadoDepois?.estadoCategorico }] : [],
      periodosAplicaveis: [{ ano: ctx.ano }],
      qualidade: qualidadeMinima(essenciais),
      premissas: statusCredito ? { statusCredito } : {},
      riscos: [],
      bloqueios: indeterminados ? [{ tipo: "premissa_nao_confirmada", descricao: "Parcela relevante dos custos ainda não tem tratamento de crédito confirmado." }] : [],
      validacoesNecessarias: indeterminados ? [{ tipo: "VALIDACAO_FISCAL", descricao: "Classificar o tratamento de crédito IBS/CBS das categorias de custo ainda indeterminadas.", motivo: "Sem essa classificação, o índice de crédito é apenas parcial.", bloqueante: false }] : [],
      origens: essenciais[0].origens,
    },
  ];
}

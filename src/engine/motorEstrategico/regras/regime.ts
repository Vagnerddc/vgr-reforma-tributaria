/**
 * AVALIAR_REGIME_TRIBUTARIO — nasce de `menorCargaComparavel` (nunca
 * `regimeMenorCarga` bruto — seção 19) já calculado pelo Comparador
 * Consolidado. Quando existir divergência (achados
 * MENOR_TRIBUTO_NAO_COINCIDE_COM_*), registra o conflito explicitamente
 * — nunca elege vencedor (seção 20/21/61).
 */

import type { AlternativaEstrategica, ConflitoEstrategico } from "../tipos";
import { achadosPorCodigo, pontoViradaPorVariavel, type ContextoEstrategico } from "../contexto";
import type { QualidadeAchado } from "../../motorAchados/tipos";

function qualidadeConsolidadaParaAchado(q: "alta" | "media" | "baixa" | "insuficiente"): QualidadeAchado {
  return q;
}

export function gerarAvaliarRegimeTributario(ctx: ContextoEstrategico): { alternativas: AlternativaEstrategica[]; conflitos: ConflitoEstrategico[] } {
  const anoComp = ctx.resultado.comparacaoRegimes?.porAno.find((a) => a.ano === ctx.ano);
  const menorCarga = anoComp?.menorCargaComparavel;
  if (!menorCarga) return { alternativas: [], conflitos: [] };

  const divergenciaCaixa = achadosPorCodigo(ctx, "MENOR_TRIBUTO_NAO_COINCIDE_COM_MELHOR_CAIXA")[0];
  const divergenciaMargem = achadosPorCodigo(ctx, "MENOR_TRIBUTO_NAO_COINCIDE_COM_MAIOR_MARGEM")[0];
  const pontoViradaCusto = pontoViradaPorVariavel(ctx, "custoCapital");
  const pontoViradaFaturamento = pontoViradaPorVariavel(ctx, "faturamento");

  const regimeComparavel = anoComp?.porRegime.find((r) => r.regime === menorCarga);
  const essenciais = [regimeComparavel].filter((r): r is NonNullable<typeof r> => r !== undefined);

  const alternativa: AlternativaEstrategica = {
    id: `alternativa:AVALIAR_REGIME_TRIBUTARIO:${ctx.ano}`,
    codigo: "AVALIAR_REGIME_TRIBUTARIO",
    categoria: "regime",
    titulo: "Avaliar regime tributário",
    objetivo: `${menorCarga} apresenta menor carga comparável no cenário analisado — avaliar também margem, caixa, custo financeiro e qualidade antes de qualquer conclusão.`,
    descricaoTecnica: `Menor carga comparável em ${ctx.ano}: ${menorCarga}.${divergenciaCaixa ? ` ${divergenciaCaixa.descricaoTecnica}` : ""}${divergenciaMargem ? ` ${divergenciaMargem.descricaoTecnica}` : ""}`,
    achadosOrigem: [divergenciaCaixa?.id, divergenciaMargem?.id].filter((x): x is string => x !== undefined),
    evidencias: [...(divergenciaCaixa?.evidencias ?? []), ...(divergenciaMargem?.evidencias ?? [])],
    aplicabilidade: regimeComparavel?.status === "comparavel" ? "aplicavel" : "condicionada",
    condicoes: ["Comparabilidade fiscal entre os regimes avaliados (Comparador Consolidado)."],
    dependencias: [],
    restricoes: ["Menor carga comparável não é recomendação de migração de regime — margem, caixa, custo financeiro e horizonte também precisam ser avaliados."],
    impactosConhecidos: [
      { descricao: `Regime de menor carga comparável em ${ctx.ano}`, origem: "comparador_consolidado:ComparacaoAno.menorCargaComparavel" },
      ...(divergenciaCaixa ? [{ descricao: divergenciaCaixa.tituloTecnico, origem: "motor_achados:MENOR_TRIBUTO_NAO_COINCIDE_COM_MELHOR_CAIXA" }] : []),
      ...(divergenciaMargem ? [{ descricao: divergenciaMargem.tituloTecnico, origem: "motor_achados:MENOR_TRIBUTO_NAO_COINCIDE_COM_MAIOR_MARGEM" }] : []),
    ],
    impactosIndeterminados: [],
    cenariosRelacionados: pontoViradaFaturamento ? [{ cenarioId: ctx.resultado.cenarioId, descricao: "Ponto de virada de faturamento indica possível mudança do regime de menor carga comparável." }] : [],
    pontosViradaRelacionados: [pontoViradaCusto, pontoViradaFaturamento]
      .filter((p): p is NonNullable<typeof p> => p !== undefined)
      .map((p) => ({ tipo: p.tipo, variavel: p.variavel, valorEncontrado: p.valorEncontrado, estadoAntes: p.estadoAntes?.estadoCategorico, estadoDepois: p.estadoDepois?.estadoCategorico })),
    periodosAplicaveis: [{ ano: ctx.ano }],
    qualidade: essenciais.length > 0 ? qualidadeConsolidadaParaAchado(essenciais[0].qualidadeConsolidada) : "media",
    premissas: {},
    riscos: [],
    bloqueios: regimeComparavel?.status === "nao_comparavel" || regimeComparavel?.status === "indeterminado" ? [{ tipo: "regime_nao_comparavel", descricao: "O regime de menor carga não está em condição plenamente comparável neste ano." }] : [],
    validacoesNecessarias: [],
    origens: ["classificacao_vgr"],
    regime: menorCarga,
  };

  const conflitos: ConflitoEstrategico[] = [];
  if (divergenciaCaixa) {
    conflitos.push({ codigo: "TRIBUTO_VS_CAIXA", descricao: divergenciaCaixa.descricaoTecnica, alternativasEnvolvidas: [alternativa.id], evidencias: divergenciaCaixa.evidencias });
  }
  if (divergenciaMargem) {
    conflitos.push({ codigo: "TRIBUTO_VS_MARGEM", descricao: divergenciaMargem.descricaoTecnica, alternativasEnvolvidas: [alternativa.id], evidencias: divergenciaMargem.evidencias });
  }

  return { alternativas: [alternativa], conflitos };
}

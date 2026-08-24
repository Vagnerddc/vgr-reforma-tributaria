/**
 * Templates determinísticos por `statusConclusao` — garantem que a
 * plataforma continue explicando decisões SEM nenhum provedor de IA
 * (seção 52/53/54: "IA nunca pode ser ponto único de falha"). Também
 * servem de fallback quando a resposta do provedor é rejeitada pelos
 * guardrails. Nunca usam linguagem absoluta ("definitivamente",
 * "garantido", "sempre") nem prescritiva ("recomendamos", "deve").
 */

import type { ContextoIaConsultiva, NivelComunicacao, RespostaBrutaIa } from "./tipos";

function formatarValor(e: { descricao: string; valor?: number; unidade?: string }): string {
  if (e.valor === undefined) return e.descricao;
  const unidade = e.unidade === "reais" ? `R$ ${e.valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}` : e.unidade === "pontos_percentuais" ? `${e.valor.toFixed(2)} p.p.` : e.unidade === "percentual" ? `${(e.valor * 100).toFixed(2)}%` : `${e.valor}`;
  return `${e.descricao} (${unidade})`;
}

function condicoesTexto(ctx: ContextoIaConsultiva): string {
  return ctx.condicoes.map((c) => c.descricao).join("; ");
}

export function gerarRespostaFallback(ctx: ContextoIaConsultiva, nivel: NivelComunicacao): RespostaBrutaIa {
  const evidenciasFav = ctx.evidenciasFavoraveis.map((e) => e.id);
  const evidenciasCon = ctx.evidenciasContrarias.map((e) => e.id);
  const condicoesIds = ctx.condicoes.map((c) => c.id);
  const validacoesIds = ctx.validacoesPendentes.map((v) => v.tipo);

  switch (ctx.statusConclusao) {
    case "preferencia_tecnica_robusta": {
      if (ctx.naturezaConclusao === "obrigacao_juridica") {
        return {
          titulo: `${ctx.alternativaPreferida} é obrigatório neste cenário`,
          resumoExecutivo: `Neste cenário, ${ctx.alternativaPreferida} decorre de obrigatoriedade jurídica identificada pelo motor — não de uma comparação de conveniência econômica entre regimes.`,
          explicacao: `${ctx.alternativaPreferida} aparece como resultado de obrigatoriedade jurídica, não de preferência técnica. Os indicadores econômicos e financeiros continuam disponíveis para planejamento, mas não alteram essa obrigatoriedade.`,
          principaisEvidencias: [],
          condicoesCitadas: [],
          ressalvas: [],
          validacoesPendentesCitadas: [],
          pontosAtencao: [],
          alternativaComunicada: ctx.alternativaPreferida,
          qualidadeComunicada: ctx.qualidade,
        };
      }
      return {
        titulo: `${ctx.alternativaPreferida} apresenta preferência técnica robusta`,
        resumoExecutivo: `Nas condições e dados analisados, ${ctx.alternativaPreferida} apresenta preferência técnica robusta em relação às demais alternativas comparáveis${ctx.identificacaoAnalise.ano ? ` em ${ctx.identificacaoAnalise.ano}` : ""}.`,
        explicacao: [
          nivel !== "executiva" && ctx.evidenciasFavoraveis.length > 0 ? `Entre as evidências favoráveis: ${ctx.evidenciasFavoraveis.map(formatarValor).join("; ")}.` : undefined,
          nivel === "tecnica" && ctx.evidenciasContrarias.length > 0 ? `Evidências contrárias registradas: ${ctx.evidenciasContrarias.map(formatarValor).join("; ")}.` : undefined,
        ]
          .filter(Boolean)
          .join(" "),
        principaisEvidencias: nivel === "executiva" ? evidenciasFav.slice(0, 2) : [...evidenciasFav, ...(nivel === "tecnica" ? evidenciasCon : [])],
        condicoesCitadas: [],
        ressalvas: ctx.qualidade !== "alta" ? [`A análise possui qualidade ${ctx.qualidade}.`] : [],
        validacoesPendentesCitadas: nivel === "tecnica" ? validacoesIds : [],
        pontosAtencao: [],
        alternativaComunicada: ctx.alternativaPreferida,
        qualidadeComunicada: ctx.qualidade,
      };
    }

    case "preferencia_tecnica_condicionada": {
      const condicaoTexto = condicoesTexto(ctx) || "condições específicas registradas pelo motor de decisão";
      return {
        titulo: `${ctx.alternativaPreferida} apresenta preferência técnica condicionada`,
        resumoExecutivo: `Nas premissas analisadas, ${ctx.alternativaPreferida} apresenta vantagem técnica. Essa posição depende de: ${condicaoTexto}.`,
        explicacao: [
          `${ctx.alternativaPreferida} apresenta preferência técnica condicionada${ctx.identificacaoAnalise.ano ? ` em ${ctx.identificacaoAnalise.ano}` : ""}.`,
          ctx.evidenciasFavoraveis.length > 0 ? `Evidências favoráveis: ${ctx.evidenciasFavoraveis.map(formatarValor).join("; ")}.` : undefined,
          ctx.evidenciasContrarias.length > 0 ? `Evidências contrárias: ${ctx.evidenciasContrarias.map(formatarValor).join("; ")}.` : undefined,
          `A conclusão depende de: ${condicaoTexto}.`,
          ctx.qualidade !== "alta" ? `A análise possui qualidade ${ctx.qualidade}.` : undefined,
        ]
          .filter(Boolean)
          .join(" "),
        principaisEvidencias: [...evidenciasFav, ...evidenciasCon],
        condicoesCitadas: condicoesIds,
        ressalvas: ctx.qualidade !== "alta" ? [`Qualidade ${ctx.qualidade}.`] : [],
        validacoesPendentesCitadas: validacoesIds,
        pontosAtencao: ctx.pontosVirada.map((p) => `Ponto de virada em ${p.variavel}${p.valorEncontrado !== undefined ? ` (aproximadamente ${p.valorEncontrado})` : ""}: antes ${p.estadoAntes ?? "?"}, depois ${p.estadoDepois ?? "?"}.`),
        alternativaComunicada: ctx.alternativaPreferida,
        qualidadeComunicada: ctx.qualidade,
      };
    }

    case "conflito_nao_resolvido": {
      return {
        titulo: "Os dados atuais não sustentam uma preferência técnica única",
        resumoExecutivo: `Os resultados atuais não sustentam uma preferência técnica única entre ${ctx.alternativasAvaliadas.join(", ")}. As vantagens estão distribuídas entre dimensões distintas.`,
        explicacao: `${ctx.conflitos.join(" ")} Como as vantagens estão distribuídas entre dimensões distintas e os dados atuais não permitem resolver esse conflito, todas as alternativas comparáveis (${ctx.alternativasAvaliadas.join(", ")}) permanecem relevantes.`,
        principaisEvidencias: [...evidenciasFav, ...evidenciasCon],
        condicoesCitadas: [],
        ressalvas: [`Qualidade ${ctx.qualidade}.`],
        validacoesPendentesCitadas: validacoesIds,
        pontosAtencao: [],
        alternativaComunicada: undefined,
        qualidadeComunicada: ctx.qualidade,
      };
    }

    case "dados_insuficientes": {
      return {
        titulo: "A comparação ainda não é conclusiva",
        resumoExecutivo: "A comparação ainda não é conclusiva porque parte relevante dos dados permanece incompleta.",
        explicacao: [
          ctx.evidenciasFavoraveis.length > 0 || ctx.evidenciasContrarias.length > 0 ? `O que já sabemos: ${[...ctx.evidenciasFavoraveis, ...ctx.evidenciasContrarias].map(formatarValor).join("; ")}.` : undefined,
          `O que ainda não sabemos/impede a conclusão: ${ctx.bloqueios.map((b) => b.descricao).join("; ") || ctx.validacoesPendentes.map((v) => v.descricao).join("; ") || "dados insuficientes registrados pelo motor de decisão."}`,
        ]
          .filter(Boolean)
          .join(" "),
        principaisEvidencias: [...evidenciasFav, ...evidenciasCon],
        condicoesCitadas: [],
        ressalvas: [],
        validacoesPendentesCitadas: validacoesIds,
        pontosAtencao: [],
        alternativaComunicada: undefined,
        qualidadeComunicada: ctx.qualidade,
      };
    }

    case "bloqueado": {
      return {
        titulo: "A análise está bloqueada",
        resumoExecutivo: `A análise está bloqueada: ${ctx.bloqueios.map((b) => b.descricao).join("; ")}.`,
        explicacao: `Não é possível concluir esta análise pelos seguintes motivos: ${ctx.bloqueios.map((b) => b.descricao).join("; ")}.`,
        principaisEvidencias: [],
        condicoesCitadas: [],
        ressalvas: [],
        validacoesPendentesCitadas: validacoesIds,
        pontosAtencao: [],
        alternativaComunicada: undefined,
        qualidadeComunicada: ctx.qualidade,
      };
    }

    case "alternativas_equivalentes": {
      return {
        titulo: "As alternativas são equivalentes dentro da precisão analisada",
        resumoExecutivo: `As alternativas (${ctx.alternativasEquivalentes.join(", ")}) produzem resultados equivalentes dentro da precisão e metodologia utilizadas — não há vantagem material entre elas.`,
        explicacao: `As alternativas (${ctx.alternativasEquivalentes.join(", ")}) estão equivalentes dentro da precisão/metodologia considerada.`,
        principaisEvidencias: [],
        condicoesCitadas: [],
        ressalvas: [],
        validacoesPendentesCitadas: [],
        pontosAtencao: [],
        alternativaComunicada: undefined,
        qualidadeComunicada: ctx.qualidade,
      };
    }

    default: {
      return {
        titulo: "As informações disponíveis ainda não sustentam uma preferência",
        resumoExecutivo: "As informações disponíveis permitem descrever os impactos, mas ainda não sustentam preferência entre as alternativas.",
        explicacao: "As informações disponíveis permitem descrever os impactos identificados, mas ainda não sustentam preferência entre as alternativas avaliadas.",
        principaisEvidencias: [...evidenciasFav, ...evidenciasCon],
        condicoesCitadas: [],
        ressalvas: [],
        validacoesPendentesCitadas: validacoesIds,
        pontosAtencao: [],
        alternativaComunicada: undefined,
        qualidadeComunicada: ctx.qualidade,
      };
    }
  }
}

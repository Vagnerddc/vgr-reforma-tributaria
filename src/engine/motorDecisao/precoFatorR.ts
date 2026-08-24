/**
 * Decisões simples de preço/Fator R (seção 48-50 do pedido) — leem a
 * `AlternativaEstrategica` já produzida pelo Motor Estratégico e
 * determinam se ela sustenta uma preferência condicionada. NUNCA
 * "reajuste recomendado" ou "aumentar pró-labore" — apenas condicionam
 * a preferência à validação pendente correspondente (viabilidade
 * comercial / composição de FS12).
 */

import type { PlanoAlternativasEstrategicas, AlternativaEstrategica } from "../motorEstrategico/tipos";
import type { CodigoRazaoConclusao, ResultadoDecisaoEstrategica } from "./tipos";

function decisaoSemConclusao(cenarioId: string, ano: number, objetoDecisao: "recomposicao_preco" | "fator_r"): ResultadoDecisaoEstrategica {
  return {
    id: `decisao:${objetoDecisao}:${cenarioId}:${ano}`,
    cenarioId,
    periodo: { ano },
    objetoDecisao,
    alternativasAvaliadas: [],
    statusConclusao: "sem_conclusao",
    alternativasEquivalentes: [],
    evidenciasFavoraveis: [],
    evidenciasContrarias: [],
    conflitos: [],
    bloqueios: [],
    riscos: [],
    premissas: {},
    validacoesPendentes: [],
    qualidade: "insuficiente",
    condicoes: [],
    pontosViradaRelacionados: [],
    razoesConclusao: [],
    justificativaEstruturada: "Nenhuma alternativa correspondente foi identificada pelo Motor Estratégico — sem base para conclusão.",
  };
}

function decisaoDeAlternativaCondicionada(alternativa: AlternativaEstrategica, cenarioId: string, ano: number, objetoDecisao: "recomposicao_preco" | "fator_r", razoes: CodigoRazaoConclusao[]): ResultadoDecisaoEstrategica {
  const bloqueada = alternativa.bloqueios.length > 0;
  return {
    id: `decisao:${objetoDecisao}:${cenarioId}:${ano}`,
    cenarioId,
    periodo: { ano },
    objetoDecisao,
    alternativasAvaliadas: [
      {
        identificador: alternativa.id,
        regime: alternativa.regime,
        aplicabilidade: bloqueada ? "nao_aplicavel" : "condicionada",
        evidenciasFavoraveis: alternativa.impactosConhecidos.map((i) => ({ descricao: i.descricao, valor: i.valor, unidade: i.unidade, origem: i.origem })),
        evidenciasContrarias: alternativa.impactosIndeterminados.map((d) => ({ descricao: d, origem: "motor_estrategico" })),
        bloqueios: alternativa.bloqueios,
        riscos: alternativa.riscos,
        condicoes: alternativa.validacoesNecessarias.map((v) => ({ descricao: v.descricao })),
        qualidade: alternativa.qualidade,
        dominancia: {},
      },
    ],
    statusConclusao: bloqueada ? "bloqueado" : "preferencia_tecnica_condicionada",
    naturezaConclusao: "preferencia_tecnica",
    alternativaPreferida: bloqueada ? undefined : alternativa.id,
    alternativasEquivalentes: [],
    evidenciasFavoraveis: alternativa.impactosConhecidos.map((i) => ({ descricao: i.descricao, valor: i.valor, unidade: i.unidade, origem: i.origem })),
    evidenciasContrarias: alternativa.impactosIndeterminados.map((d) => ({ descricao: d, origem: "motor_estrategico" })),
    conflitos: [],
    bloqueios: alternativa.bloqueios,
    riscos: alternativa.riscos,
    premissas: alternativa.premissas,
    validacoesPendentes: alternativa.validacoesNecessarias,
    qualidade: alternativa.qualidade,
    condicoes: alternativa.validacoesNecessarias.map((v) => ({ descricao: v.descricao })),
    pontosViradaRelacionados: alternativa.pontosViradaRelacionados,
    razoesConclusao: razoes,
    justificativaEstruturada: bloqueada
      ? `${alternativa.titulo} está bloqueada: ${alternativa.bloqueios.map((b) => b.descricao).join(" ")}`
      : `${alternativa.titulo} sustenta uma preferência técnica condicionada às validações pendentes (${alternativa.validacoesNecessarias.map((v) => v.tipo).join(", ")}) — não é uma instrução de execução.`,
  };
}

export function decidirRecomposicaoPreco(plano: PlanoAlternativasEstrategicas, ano: number): ResultadoDecisaoEstrategica {
  const alternativa = plano.alternativas.find((a) => a.codigo === "AVALIAR_RECOMPOSICAO_PRECO");
  if (!alternativa) return decisaoSemConclusao(plano.cenarioId, ano, "recomposicao_preco");
  return decisaoDeAlternativaCondicionada(alternativa, plano.cenarioId, ano, "recomposicao_preco", ["DIFERENCA_MARGEM_FAVORAVEL"]);
}

export function decidirFatorR(plano: PlanoAlternativasEstrategicas, ano: number): ResultadoDecisaoEstrategica {
  const alternativa = plano.alternativas.find((a) => a.codigo === "AVALIAR_FATOR_R");
  if (!alternativa) return decisaoSemConclusao(plano.cenarioId, ano, "fator_r");
  return decisaoDeAlternativaCondicionada(alternativa, plano.cenarioId, ano, "fator_r", []);
}

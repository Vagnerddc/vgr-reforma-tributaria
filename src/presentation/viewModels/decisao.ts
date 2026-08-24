/**
 * ViewModel do Card de Decisão — consome `ResultadoDecisaoEstrategica`
 * (motorDecisao) sem recalcular nada (regra central desta fase). Cada
 * `StatusConclusao` tem um rótulo e uma apresentação fixos e
 * determinísticos — a UI nunca inventa texto novo, nunca escolhe
 * vencedor em conflito, nunca chama obrigação de "melhor regime"
 * (seção 4 do pedido).
 */

import type { ResultadoDecisaoEstrategica, StatusConclusao } from "../../engine/motorDecisao/tipos";
import { formatarPontosPercentuais, formatarReais } from "../formatters";

export type ToneDecisao = "neutral" | "good" | "warn" | "bad";

const APRESENTACAO_POR_STATUS: Record<StatusConclusao, { rotulo: string; tone: ToneDecisao }> = {
  preferencia_tecnica_robusta: { rotulo: "Preferência técnica robusta", tone: "good" },
  preferencia_tecnica_condicionada: { rotulo: "Preferência técnica condicionada", tone: "warn" },
  conflito_nao_resolvido: { rotulo: "Conflito não resolvido entre alternativas", tone: "warn" },
  alternativas_equivalentes: { rotulo: "Alternativas equivalentes", tone: "neutral" },
  dados_insuficientes: { rotulo: "Dados insuficientes para conclusão", tone: "bad" },
  bloqueado: { rotulo: "Análise bloqueada", tone: "bad" },
  sem_conclusao: { rotulo: "Ainda sem preferência técnica sustentada", tone: "neutral" },
};

export interface EvidenciaResumida {
  descricao: string;
  favoravel: boolean;
}

export interface CondicaoResumida {
  descricao: string;
}

export interface DecisaoViewModel {
  status: StatusConclusao;
  rotuloStatus: string;
  tone: ToneDecisao;
  /**
   * `true` quando a conclusão decorre de OBRIGATORIEDADE jurídica —
   * nunca apresentado como "melhor regime"/preferência (seção 4/21 do
   * pedido). O componente de UI DEVE usar este campo para escolher o
   * texto, nunca inferir a partir do nome da alternativa.
   */
  ehObrigacaoJuridica: boolean;
  /** `undefined` quando não há alternativa a comunicar (conflito/equivalência/dados insuficientes/sem conclusão) — nunca um "vencedor" inventado pela UI. */
  alternativaPreferida?: string;
  alternativasEquivalentes: string[];
  alternativasEmConflito: string[];
  evidencias: EvidenciaResumida[];
  /** Sempre preenchido quando `status === "preferencia_tecnica_condicionada"` — a UI NUNCA pode omitir a condição (seção 4/17 do pedido). */
  condicoes: CondicaoResumida[];
  motivoIndisponibilidade?: string;
  qualidade: string;
  ano: number;
}

/**
 * Constrói o ViewModel a partir do resultado do Motor de Decisão — pura
 * leitura/reformatação, nenhum recálculo. `decisao` nunca é mutado.
 */
export function construirDecisaoViewModel(decisao: ResultadoDecisaoEstrategica): DecisaoViewModel {
  const apresentacao = APRESENTACAO_POR_STATUS[decisao.statusConclusao];
  const ehObrigacaoJuridica = decisao.naturezaConclusao === "obrigacao_juridica";

  const evidencias: EvidenciaResumida[] = [
    ...decisao.evidenciasFavoraveis.map((e) => ({ descricao: formatarEvidencia(e), favoravel: true })),
    ...decisao.evidenciasContrarias.map((e) => ({ descricao: formatarEvidencia(e), favoravel: false })),
  ];

  const alternativasEmConflito = decisao.statusConclusao === "conflito_nao_resolvido" ? decisao.alternativasAvaliadas.map((a) => a.identificador) : [];

  return {
    status: decisao.statusConclusao,
    rotuloStatus: apresentacao.rotulo,
    tone: apresentacao.tone,
    ehObrigacaoJuridica,
    // Conflito/equivalência/dados insuficientes/bloqueado nunca comunicam uma alternativa "preferida" — mesmo que o campo bruto por algum motivo viesse preenchido, a apresentação nunca destaca vencedor nesses estados.
    alternativaPreferida: decisao.statusConclusao === "conflito_nao_resolvido" || decisao.statusConclusao === "alternativas_equivalentes" || decisao.statusConclusao === "dados_insuficientes" || decisao.statusConclusao === "bloqueado" ? undefined : decisao.alternativaPreferida,
    alternativasEquivalentes: decisao.alternativasEquivalentes,
    alternativasEmConflito,
    evidencias,
    condicoes: decisao.condicoes.map((c) => ({ descricao: c.descricao })),
    motivoIndisponibilidade: decisao.statusConclusao === "dados_insuficientes" || decisao.statusConclusao === "bloqueado" ? decisao.bloqueios.map((b) => b.descricao).join(" ") || decisao.justificativaEstruturada : undefined,
    qualidade: decisao.qualidade,
    ano: decisao.periodo.ano,
  };
}

function formatarEvidencia(e: { descricao: string; valor?: number; unidade?: string }): string {
  if (e.valor === undefined) return e.descricao;
  if (e.unidade === "reais") return `${e.descricao} (${formatarReais(e.valor)})`;
  if (e.unidade === "pontos_percentuais") return `${e.descricao} (${formatarPontosPercentuais(e.valor)})`;
  return e.descricao;
}

/**
 * ViewModel da IA Consultiva Visual — consome `RespostaIaConsultiva`
 * (engine/iaConsultiva) já validada pelos guardrails, sem recalcular
 * ou reinterpretar nada. Resolve IDs de evidência/condição em texto
 * legível a partir do `ContextoIaConsultiva` (seção 32) — nunca exibe
 * o ID técnico bruto. Fallback nunca é tratado como erro na leitura
 * padrão (seção 10) — só o modo técnico expõe `statusValidacao` real.
 */

import type { ContextoIaConsultiva, NivelComunicacao, RespostaIaConsultiva, StatusGeracao } from "../../engine/iaConsultiva/tipos";

export type StatusVisualIa = "nao_gerada" | "carregando" | "gerada" | "fallback" | "rejeitada" | "erro_provedor" | "indisponivel";

const STATUS_VISUAL_POR_GERACAO: Record<StatusGeracao, StatusVisualIa> = {
  gerada: "gerada",
  fallback: "fallback",
  rejeitada: "rejeitada",
  erro_provedor: "erro_provedor",
  indisponivel: "indisponivel",
};

export interface MetadadosTecnicosIa {
  provider: string;
  model?: string;
  promptVersion: string;
  status: StatusGeracao;
  timestamp: string;
}

export interface IaConsultivaViewModel {
  status: StatusVisualIa;
  nivelSelecionado: NivelComunicacao;
  titulo: string;
  resumoExecutivo: string;
  explicacao: string;
  evidencias: string[];
  condicoes: string[];
  ressalvas: string[];
  validacoesPendentes: string[];
  pontosAtencao: string[];
  textoTecnico?: string;
  /** Nunca expõe provedor/modelo na leitura padrão (seção 48/49) — só presente quando `nivelSelecionado === "tecnica"`. */
  origemGeracao: string;
  metadadosTecnicos?: MetadadosTecnicosIa;
}

function resolverId(id: string, contexto: ContextoIaConsultiva): string | undefined {
  const evidencia = [...contexto.evidenciasFavoraveis, ...contexto.evidenciasContrarias].find((e) => e.id === id);
  if (evidencia) return evidencia.descricao;
  return contexto.condicoes.find((c) => c.id === id)?.descricao;
}

function resolverIds(ids: string[], contexto: ContextoIaConsultiva): string[] {
  return ids.map((id) => resolverId(id, contexto)).filter((d): d is string => d !== undefined);
}

export function construirIaConsultivaViewModel(resposta: RespostaIaConsultiva, contexto: ContextoIaConsultiva, nivel: NivelComunicacao): IaConsultivaViewModel {
  const status = STATUS_VISUAL_POR_GERACAO[resposta.statusValidacao];

  return {
    status,
    nivelSelecionado: nivel,
    titulo: resposta.titulo,
    resumoExecutivo: resposta.resumoExecutivo,
    explicacao: resposta.explicacao,
    evidencias: resolverIds(resposta.principaisEvidencias, contexto),
    condicoes: resolverIds(resposta.condicoesCitadas, contexto),
    ressalvas: resposta.ressalvas,
    validacoesPendentes: resposta.validacoesPendentesCitadas,
    pontosAtencao: resposta.pontosAtencao,
    textoTecnico: nivel === "tecnica" ? resposta.textoTecnico : undefined,
    origemGeracao: nivel === "tecnica" ? `${resposta.auditoria.provider === "nenhum" ? "Explicação estruturada determinística" : `IA Consultiva (${resposta.auditoria.promptVersion})`} — status: ${resposta.statusValidacao}` : "Leitura consultiva da análise",
    metadadosTecnicos: nivel === "tecnica" ? { provider: resposta.auditoria.provider, model: resposta.auditoria.model, promptVersion: resposta.auditoria.promptVersion, status: resposta.statusValidacao, timestamp: resposta.auditoria.timestamp } : undefined,
  };
}

/**
 * Ponto de entrada da IA Consultiva — SEMPRE depois do Motor de
 * Decisão (seção 1). Chama o provedor (quando configurado), valida a
 * resposta com `guardrails.ts` e usa fallback determinístico quando o
 * provedor está indisponível, falha, ou a resposta é rejeitada (seção
 * 52-61). Nenhum cálculo/decisão próprio.
 */

import type { ResultadoDecisaoEstrategica } from "../motorDecisao/tipos";
import { construirContexto, hashContexto } from "./contexto";
import { gerarRespostaFallback } from "./templatesFallback";
import { validarResposta } from "./guardrails";
import type { NivelComunicacao, PoliticaDadosIa, ProvedorIaConsultiva, RegistroAuditoriaIa, RespostaIaConsultiva, StatusGeracao } from "./tipos";
import { POLITICA_DADOS_PADRAO } from "./tipos";

const PROMPT_VERSION = "PROMPT_IA_CONSULTIVA_V1";
const TIMEOUT_MS_PADRAO = 8000;

export interface OpcoesGerarExplicacao {
  decisao: ResultadoDecisaoEstrategica;
  nivel: NivelComunicacao;
  provedor?: ProvedorIaConsultiva;
  politicaDados?: PoliticaDadosIa;
  perfilSetorial?: string;
  timeoutMs?: number;
  requestId?: string;
}

function comTimeout<T>(promessa: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promessa, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

function montarAuditoria(opts: { requestId: string; contextHash: string; resultadoDecisaoId: string; nivel: NivelComunicacao; provider: string; model?: string; status: StatusGeracao }): RegistroAuditoriaIa {
  return { requestId: opts.requestId, contextHash: opts.contextHash, resultadoDecisaoId: opts.resultadoDecisaoId, nivelComunicacao: opts.nivel, promptVersion: PROMPT_VERSION, provider: opts.provider, model: opts.model, status: opts.status, timestamp: new Date().toISOString() };
}

/**
 * Gera a explicação consultiva para UM nível de comunicação. Se
 * `provedor` não for informado, ou falhar/timeoutar/for rejeitado pelos
 * guardrails, usa o template determinístico (`gerarRespostaFallback`) —
 * a plataforma nunca fica sem explicação (seção 52-54).
 */
export async function gerarExplicacaoConsultiva(opcoes: OpcoesGerarExplicacao): Promise<RespostaIaConsultiva> {
  const { decisao, nivel, provedor, politicaDados = POLITICA_DADOS_PADRAO, perfilSetorial, timeoutMs = TIMEOUT_MS_PADRAO, requestId = `req-${decisao.id}-${nivel}` } = opcoes;
  const contexto = construirContexto(decisao, politicaDados, perfilSetorial);
  const contextHash = hashContexto(contexto);

  if (!provedor) {
    const resposta = gerarRespostaFallback(contexto, nivel);
    return { ...resposta, nivel, statusValidacao: "indisponivel", auditoria: montarAuditoria({ requestId, contextHash, resultadoDecisaoId: decisao.id, nivel, provider: "nenhum", status: "indisponivel" }) };
  }

  try {
    const respostaBruta = await comTimeout(provedor.gerar({ contexto, nivel, promptVersion: PROMPT_VERSION }), timeoutMs);
    const { valido, motivos } = validarResposta(respostaBruta, contexto);

    if (!valido) {
      const fallback = gerarRespostaFallback(contexto, nivel);
      return { ...fallback, nivel, statusValidacao: "rejeitada", motivosRejeicao: motivos, auditoria: montarAuditoria({ requestId, contextHash, resultadoDecisaoId: decisao.id, nivel, provider: provedor.nome, model: provedor.modelo, status: "rejeitada" }) };
    }

    return { ...respostaBruta, nivel, statusValidacao: "gerada", auditoria: montarAuditoria({ requestId, contextHash, resultadoDecisaoId: decisao.id, nivel, provider: provedor.nome, model: provedor.modelo, status: "gerada" }) };
  } catch {
    const fallback = gerarRespostaFallback(contexto, nivel);
    return { ...fallback, nivel, statusValidacao: "erro_provedor", auditoria: montarAuditoria({ requestId, contextHash, resultadoDecisaoId: decisao.id, nivel, provider: provedor.nome, model: provedor.modelo, status: "erro_provedor" }) };
  }
}

/** Mesma decisão, três apresentações (seção 12) — nunca três análises independentes: os três níveis partem do MESMO `contexto`. */
export async function gerarTresNiveis(opcoes: Omit<OpcoesGerarExplicacao, "nivel">): Promise<Record<NivelComunicacao, RespostaIaConsultiva>> {
  const [executiva, consultiva, tecnica] = await Promise.all([gerarExplicacaoConsultiva({ ...opcoes, nivel: "executiva" }), gerarExplicacaoConsultiva({ ...opcoes, nivel: "consultiva" }), gerarExplicacaoConsultiva({ ...opcoes, nivel: "tecnica" })]);
  return { executiva, consultiva, tecnica };
}

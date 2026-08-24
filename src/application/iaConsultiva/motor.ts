/**
 * Camada de aplicação para a IA Consultiva Visual — a página React
 * NUNCA monta `ContextoIaConsultiva` diretamente (seção 4/5 do pedido).
 * Este arquivo só extrai `ResultadoDecisaoEstrategica` de
 * `AnaliseEstrategicaCompleta` e delega para `gerarTresNiveis`
 * (engine/iaConsultiva/motor.ts, já existente) — nenhuma IA nova,
 * nenhum recálculo, nenhuma segunda lógica de guardrail.
 */

import type { AnaliseEstrategicaCompleta } from "../analiseEstrategica/tipos";
import { gerarTresNiveis } from "../../engine/iaConsultiva/motor";
import { construirContexto, hashContexto } from "../../engine/iaConsultiva/contexto";
import type { ContextoIaConsultiva, NivelComunicacao, PoliticaDadosIa, ProvedorIaConsultiva, RespostaIaConsultiva } from "../../engine/iaConsultiva/tipos";

export interface OpcoesExplicacaoAnalise {
  analise: AnaliseEstrategicaCompleta;
  provedor?: ProvedorIaConsultiva;
  politicaDados?: PoliticaDadosIa;
  perfilSetorial?: string;
}

export interface ExplicacaoDaAnaliseResultado {
  respostas: Record<NivelComunicacao, RespostaIaConsultiva>;
  /** Mesmo contexto reaproveitado internamente por `gerarTresNiveis` — devolvido aqui só para a UI resolver IDs de evidência/condição em texto (seção 32), nunca para reconstruir a explicação. */
  contexto: ContextoIaConsultiva;
  contextHash: string;
}

/**
 * `undefined` quando a análise não produziu uma decisão (dependência
 * essencial indisponível) — nada para explicar ainda; a UI deve tratar
 * isso como `indisponivel`, nunca como erro (seção 11).
 */
/** Recalcula o hash do contexto ATUAL sem gerar nenhuma explicação — usado pela UI só para detectar se uma explicação já exibida ficou desatualizada (seção 46), nunca para decidir conteúdo. */
export function calcularContextHashAtual(analise: AnaliseEstrategicaCompleta, politicaDados?: PoliticaDadosIa, perfilSetorial?: string): string | undefined {
  if (!analise.decisao) return undefined;
  return hashContexto(construirContexto(analise.decisao, politicaDados, perfilSetorial));
}

export async function gerarExplicacaoDaAnalise(opcoes: OpcoesExplicacaoAnalise): Promise<ExplicacaoDaAnaliseResultado | undefined> {
  if (!opcoes.analise.decisao) return undefined;
  const contexto = construirContexto(opcoes.analise.decisao, opcoes.politicaDados, opcoes.perfilSetorial);
  const respostas = await gerarTresNiveis({ decisao: opcoes.analise.decisao, provedor: opcoes.provedor, politicaDados: opcoes.politicaDados, perfilSetorial: opcoes.perfilSetorial });
  return { respostas, contexto, contextHash: hashContexto(contexto) };
}

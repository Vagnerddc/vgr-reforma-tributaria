/**
 * Construção determinística do contexto (seção 8) — decide o que é
 * relevante ANTES de qualquer chamada de IA; o LLM nunca precisa
 * descobrir sozinho o que importa em milhares de campos. Nunca acessa
 * `motorRegimes`/`calculo.ts`/`parametros.json` — só lê
 * `ResultadoDecisaoEstrategica` (motorDecisao), já pronto.
 */

import type { ResultadoDecisaoEstrategica } from "../motorDecisao/tipos";
import type { ContextoIaConsultiva, EvidenciaContexto, PoliticaDadosIa } from "./tipos";
import { POLITICA_DADOS_PADRAO } from "./tipos";

function evidenciasComId(prefixo: string, evidencias: ResultadoDecisaoEstrategica["evidenciasFavoraveis"], permitirValores: boolean): EvidenciaContexto[] {
  return evidencias.map((e, i) => ({ id: `${prefixo}-${i}`, descricao: e.descricao, valor: permitirValores ? e.valor : undefined, unidade: e.unidade }));
}

/**
 * Constrói o `ContextoIaConsultiva` a partir do resultado determinístico
 * — nunca envia identificação da empresa quando
 * `permitirIdentificacaoEmpresa` for `false` (default), nunca envia
 * valores quando `permitirValoresFinanceiros` for `false` (seção 49-51).
 */
export function construirContexto(decisao: ResultadoDecisaoEstrategica, politica: PoliticaDadosIa = POLITICA_DADOS_PADRAO, perfilSetorial?: string): ContextoIaConsultiva {
  return {
    identificacaoAnalise: { cenarioId: politica.permitirIdentificacaoEmpresa ? decisao.cenarioId : "anonimizado", objetoDecisao: decisao.objetoDecisao, ano: decisao.periodo.ano },
    perfilSetorial,
    statusConclusao: decisao.statusConclusao,
    naturezaConclusao: decisao.naturezaConclusao,
    alternativaPreferida: decisao.alternativaPreferida,
    alternativasAvaliadas: decisao.alternativasAvaliadas.map((a) => a.identificador),
    alternativasEquivalentes: decisao.alternativasEquivalentes,
    evidenciasFavoraveis: evidenciasComId("fav", decisao.evidenciasFavoraveis, politica.permitirValoresFinanceiros),
    evidenciasContrarias: evidenciasComId("con", decisao.evidenciasContrarias, politica.permitirValoresFinanceiros),
    condicoes: decisao.condicoes.map((c, i) => ({ id: `cond-${i}`, descricao: c.descricao, variavel: c.variavel, limite: politica.permitirValoresFinanceiros ? c.limite : undefined })),
    bloqueios: decisao.bloqueios.map((b) => ({ tipo: b.tipo, descricao: b.descricao })),
    riscos: decisao.riscos.map((r) => ({ tipo: r.tipo, descricao: r.descricao })),
    validacoesPendentes: decisao.validacoesPendentes.map((v) => ({ tipo: v.tipo, descricao: v.descricao, bloqueante: v.bloqueante })),
    conflitos: decisao.conflitos,
    qualidade: decisao.qualidade,
    pontosVirada: decisao.pontosViradaRelacionados.map((p) => ({ variavel: p.variavel, valorEncontrado: politica.permitirValoresFinanceiros ? p.valorEncontrado : undefined, estadoAntes: p.estadoAntes, estadoDepois: p.estadoDepois })),
    horizonte: decisao.horizonte ? { conclusaoHorizonte: decisao.horizonte.conclusaoHorizonte, transicoes: decisao.horizonte.transicoes.map((t) => ({ anoAntes: t.anoAntes, anoDepois: t.anoDepois, alternativaAntes: t.alternativaAntes, alternativaDepois: t.alternativaDepois })) } : undefined,
  };
}

/** Hash estável e simples (não criptográfico) do contexto — usado só para auditoria/cache futuro (seção 57), nunca para segurança. */
export function hashContexto(contexto: ContextoIaConsultiva): string {
  const texto = JSON.stringify(contexto);
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = (hash * 31 + texto.charCodeAt(i)) | 0;
  }
  return `ctx-${(hash >>> 0).toString(16)}`;
}

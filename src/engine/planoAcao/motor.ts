/**
 * Motor do Plano de Ação — orquestra as regras (regras.ts), deduplica
 * (mesma ação ativada por múltiplas origens vira UMA ação, preservando
 * todas as origens — seção 50/51), resolve dependências por código,
 * ordena topologicamente (ordenacao.ts) e monta `PlanoAcaoEstruturado`.
 * Nenhum cálculo/decisão/estratégia própria.
 */

import type { RelatorioAuditoriaEstrategica } from "../motorAchados/tipos";
import type { PlanoAlternativasEstrategicas } from "../motorEstrategico/tipos";
import type { ResultadoDecisaoEstrategica } from "../motorDecisao/tipos";
import type { ResultadoPontoVirada } from "../motorPontosVirada/tipos";
import { regraValidacoesFiscais, regraFatorR, regraPreco, regraCreditos, regraCapitalGiro, regraCustoFinanceiro, regraPontosVirada, regraHorizonte, regraConclusaoRegime, type AcaoRascunho } from "./regras";
import { ordenarTopologicamente } from "./ordenacao";
import { avaliarCoberturaPlano } from "./cobertura";
import type { AcaoEstruturada, CodigoAcao, PlanoAcaoEstruturado, QualidadeAchado, StatusPlano } from "./tipos";

export interface OpcoesGerarPlanoAcao {
  decisao: ResultadoDecisaoEstrategica;
  relatorio?: RelatorioAuditoriaEstrategica;
  planoEstrategico?: PlanoAlternativasEstrategicas;
  pontosVirada?: ResultadoPontoVirada[];
}

/** Chave de deduplicação — código + parâmetros que tornam a ação DIFERENTE mesmo com o mesmo código (gatilho/período — seção 52). */
function chaveDedup(a: AcaoRascunho): string {
  return [a.codigo, a.periodoAplicavel?.ano ?? "", a.gatilho ? `${a.gatilho.variavel}:${a.gatilho.valorReferencia}` : ""].join("|");
}

function piorQualidade(qs: QualidadeAchado[]): QualidadeAchado {
  const ordem: Record<QualidadeAchado, number> = { insuficiente: 0, baixa: 1, media: 2, alta: 3 };
  if (qs.length === 0) return "insuficiente";
  return qs.reduce((pior, q) => (ordem[q] < ordem[pior] ? q : pior));
}

function deduplicarERotular(rascunhos: AcaoRascunho[]): AcaoRascunho[] {
  const porChave = new Map<string, AcaoRascunho>();
  for (const r of rascunhos) {
    const chave = chaveDedup(r);
    const existente = porChave.get(chave);
    if (!existente) {
      porChave.set(chave, { ...r });
      continue;
    }
    porChave.set(chave, {
      ...existente,
      origens: [...new Set([...existente.origens, ...r.origens])],
      achadosOrigem: [...new Set([...existente.achadosOrigem, ...r.achadosOrigem])],
      alternativasOrigem: [...new Set([...existente.alternativasOrigem, ...r.alternativasOrigem])],
      decisoesOrigem: [...new Set([...existente.decisoesOrigem, ...r.decisoesOrigem])],
      evidencias: [...existente.evidencias, ...r.evidencias],
      condicoes: [...new Set([...existente.condicoes, ...r.condicoes])],
      bloqueios: [...existente.bloqueios, ...r.bloqueios],
      riscos: [...existente.riscos, ...r.riscos],
      qualidade: piorQualidade([existente.qualidade, r.qualidade]),
    });
  }
  return [...porChave.values()];
}

function resolverDependencias(rascunhos: AcaoRascunho[]): AcaoEstruturada[] {
  const idPorCodigo = new Map<CodigoAcao, string[]>();
  const comId = rascunhos.map((r, i) => {
    const id = `acao:${r.codigo}:${i}`;
    idPorCodigo.set(r.codigo, [...(idPorCodigo.get(r.codigo) ?? []), id]);
    return { ...r, id };
  });

  return comId.map((r) => {
    const dependeDe = (r.dependeDeCodigo ?? []).flatMap((codigo) => idPorCodigo.get(codigo) ?? []).filter((id) => id !== r.id);
    const { dependeDeCodigo, id, ...resto } = r;
    return { ...resto, id, dependeDe, status: "pendente" as const };
  });
}

function statusDoPlano(acoes: AcaoEstruturada[], decisao: ResultadoDecisaoEstrategica): StatusPlano {
  if (acoes.length === 0) return "sem_acoes";
  if (decisao.statusConclusao === "bloqueado" || decisao.statusConclusao === "dados_insuficientes") return "bloqueado";
  const temFormalizacao = acoes.some((a) => a.tipo === "formalizacao");
  const temValidacaoBloqueante = acoes.some((a) => a.tipo === "validacao" && a.bloqueios.length > 0);
  if (temFormalizacao && !temValidacaoBloqueante) return "pronto_para_formalizacao";
  if (temValidacaoBloqueante) return "bloqueado";
  return acoes.some((a) => a.tipo === "validacao" || a.tipo === "simulacao") ? "pronto_para_validacao" : "parcial";
}

/**
 * Ponto de entrada. Gera o plano de ação a partir de uma decisão já
 * produzida pelo Motor de Decisão (obrigatória) e, opcionalmente, do
 * relatório de achados e do plano de alternativas estratégicas — nunca
 * chama nenhum motor determinístico para recalcular.
 */
export function gerarPlanoAcao(opcoes: OpcoesGerarPlanoAcao): PlanoAcaoEstruturado {
  const { decisao, relatorio, planoEstrategico, pontosVirada = [] } = opcoes;

  const validacoesFiscais = regraValidacoesFiscais(relatorio);
  const acoesDasFamilias = [...validacoesFiscais, ...regraFatorR(planoEstrategico), ...regraPreco(planoEstrategico), ...regraCreditos(planoEstrategico), ...regraCapitalGiro(planoEstrategico), ...regraCustoFinanceiro(planoEstrategico, pontosVirada)];
  const validacoesParaConsolidacao = acoesDasFamilias.filter((a) => a.tipo === "validacao");

  const rascunhos: AcaoRascunho[] = [...acoesDasFamilias, ...regraPontosVirada(decisao), ...regraHorizonte(decisao), ...regraConclusaoRegime(decisao, validacoesParaConsolidacao)];

  const deduplicados = deduplicarERotular(rascunhos);
  const acoes = resolverDependencias(deduplicados);
  const etapas = ordenarTopologicamente(acoes);

  const bloqueiosGlobais = acoes.flatMap((a) => a.bloqueios).filter((b, i, arr) => arr.findIndex((x) => x.tipo === b.tipo && x.descricao === b.descricao) === i);
  const condicoesGlobais = [...new Set(acoes.flatMap((a) => a.condicoes))];
  const gatilhosMonitoramento = acoes.map((a) => a.gatilho).filter((g): g is NonNullable<typeof g> => g !== undefined);

  return {
    cenarioId: decisao.cenarioId,
    decisaoId: decisao.id,
    statusDecisao: decisao.statusConclusao,
    acoes,
    etapas,
    bloqueiosGlobais,
    condicoesGlobais,
    gatilhosMonitoramento,
    cobertura: avaliarCoberturaPlano(acoes, planoEstrategico),
    qualidade: piorQualidade([decisao.qualidade, ...acoes.map((a) => a.qualidade)]),
    status: statusDoPlano(acoes, decisao),
  };
}

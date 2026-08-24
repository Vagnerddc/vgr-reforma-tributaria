/**
 * Orquestrador da Memória Técnica. NUNCA executa fórmulas fiscais,
 * financeiras ou decisórias — apenas junta os itens já extraídos
 * pelos adapters, cada um lendo campos já calculados pelos motores.
 */
import type { AnaliseEstrategicaCompleta, EstadoDimensao } from "../analiseEstrategica/tipos";
import type { PerdaAdaptacaoLegado } from "../analiseEstrategica/adapters/legadoParaCenarioEmpresa";
import type { RespostaIaConsultiva } from "../../engine/iaConsultiva/tipos";
import type { MemoriaTecnicaAnalise, MetodologiaMemoriaTecnica, PremissaMemoriaTecnica } from "./tipos";
import { hashObjeto } from "./hash";
import { construirItensFiscais } from "./adapters/fiscal";
import { construirItensFinanceiros } from "./adapters/financeiro";
import { construirItensCaixa } from "./adapters/caixa";
import { construirItensDecisao } from "./adapters/decisao";
import { construirItensScore } from "./adapters/score";
import { construirItensPontosVirada } from "./adapters/pontosVirada";
import { construirItensPareto } from "./adapters/pareto";
import { construirItensPlano } from "./adapters/plano";
import { construirItensExecucao } from "./adapters/execucao";

export interface OpcoesMemoriaTecnica {
  perdasLegado?: PerdaAdaptacaoLegado[];
  iaResposta?: RespostaIaConsultiva;
}

const CATEGORIAS_COBERTURA: { label: string; estado: "statusRegimesComparador" | "statusFinanceiro" | "statusCaixa" | "statusPontosVirada" | "statusDecisao" | "statusScore" | "statusOtimizacao" | "statusPlanoAcao" }[] = [
  { label: "Fiscal", estado: "statusRegimesComparador" },
  { label: "Econômico", estado: "statusFinanceiro" },
  { label: "Caixa", estado: "statusCaixa" },
  { label: "Pontos de Virada", estado: "statusPontosVirada" },
  { label: "Decisão", estado: "statusDecisao" },
  { label: "Score", estado: "statusScore" },
  { label: "Otimização", estado: "statusOtimizacao" },
  { label: "Plano de Ação", estado: "statusPlanoAcao" },
];

const ROTULO_STATUS: Record<string, string> = {
  disponivel: "disponível",
  parcial: "parcial",
  indisponivel: "indisponível",
  erro: "erro",
  nao_aplicavel: "não aplicável",
};

function construirAssinaturaContexto(analise: AnaliseEstrategicaCompleta) {
  return {
    ano: analise.ano,
    cenarioId: analise.cenario.id,
    statusRegimesComparador: analise.statusRegimesComparador,
    statusFinanceiro: analise.statusFinanceiro,
    statusCaixa: analise.statusCaixa,
    statusPontosVirada: analise.statusPontosVirada,
    statusEstrategia: analise.statusEstrategia,
    statusDecisao: analise.statusDecisao,
    statusHorizonte: analise.statusHorizonte,
    statusPlanoAcao: analise.statusPlanoAcao,
    statusScore: analise.statusScore,
    statusOtimizacao: analise.statusOtimizacao,
    decisao: analise.decisao
      ? {
          id: analise.decisao.id,
          statusConclusao: analise.decisao.statusConclusao,
          alternativaPreferida: analise.decisao.alternativaPreferida,
          naturezaConclusao: analise.decisao.naturezaConclusao,
        }
      : undefined,
    scores: analise.scores?.map((s) => ({ alternativaId: s.alternativaId, scoreConsolidado: s.scoreConsolidado, contextHash: s.contextHash })),
    otimizacaoContextHash: analise.otimizacao?.contextHash,
    pontosVirada: analise.pontosVirada?.map((p) => ({ tipo: p.tipo, status: p.status, valorEncontrado: p.valorEncontrado })),
  };
}

export function construirMemoriaTecnicaAnalise(analise: AnaliseEstrategicaCompleta, opcoes: OpcoesMemoriaTecnica = {}): MemoriaTecnicaAnalise {
  const itens = [
    ...construirItensFiscais(analise),
    ...construirItensFinanceiros(analise),
    ...construirItensCaixa(analise),
    ...construirItensDecisao(analise),
    ...construirItensScore(analise),
    ...construirItensPontosVirada(analise),
    ...construirItensPareto(analise),
    ...construirItensPlano(analise),
    ...construirItensExecucao(analise, opcoes.perdasLegado),
  ];

  const idsVistos = new Set<string>();
  for (const item of itens) {
    if (idsVistos.has(item.id)) {
      throw new Error(`ID de memória técnica duplicado: ${item.id}`);
    }
    idsVistos.add(item.id);
  }

  const resumoCobertura: Record<string, string> = {};
  for (const { label, estado } of CATEGORIAS_COBERTURA) {
    const dimensao: EstadoDimensao | undefined = analise[estado];
    resumoCobertura[label] = dimensao ? ROTULO_STATUS[dimensao.status] ?? dimensao.status : "não executado";
  }

  const premissasMap = new Map<string, PremissaMemoriaTecnica>();
  for (const item of itens) {
    for (const chave of item.premissas) {
      if (!premissasMap.has(chave)) {
        premissasMap.set(chave, { id: chave, descricao: chave, itensRelacionados: [] });
      }
      premissasMap.get(chave)!.itensRelacionados.push(item.id);
    }
  }

  const metodologiasMap = new Map<string, MetodologiaMemoriaTecnica>();
  for (const item of itens) {
    if (!item.metodologia) continue;
    const chave = `${item.metodologia}:${item.metodologiaVersao ?? ""}`;
    if (!metodologiasMap.has(chave)) {
      metodologiasMap.set(chave, { id: item.metodologia, versao: item.metodologiaVersao ?? "", aplicavelA: [] });
    }
    metodologiasMap.get(chave)!.aplicavelA.push(item.id);
  }

  const limitacoes = new Set<string>();
  for (const item of itens) {
    for (const limitacao of item.limitacoes) limitacoes.add(limitacao);
  }

  return {
    analiseId: `${analise.cenario.id}:${analise.ano}`,
    cenarioId: analise.cenario.id,
    contextHash: hashObjeto(construirAssinaturaContexto(analise)),
    periodo: { ano: analise.ano },
    resumoCobertura,
    itens,
    premissas: Array.from(premissasMap.values()),
    fontes: Array.from(new Set(itens.map((i) => i.origemInformacao))),
    metodologias: Array.from(metodologiasMap.values()),
    limitacoes: Array.from(limitacoes),
    auditoriaExecucao: {
      duracaoMs: analise.auditoriaExecucao.duracaoMs,
      etapasExecutadas: analise.auditoriaExecucao.etapasExecutadas,
      etapasIndisponiveis: analise.auditoriaExecucao.etapasIndisponiveis,
      erros: analise.auditoriaExecucao.erros,
    },
    iaMetadado: opcoes.iaResposta
      ? {
          status: opcoes.iaResposta.statusValidacao,
          promptVersion: opcoes.iaResposta.auditoria.promptVersion,
          contextHash: opcoes.iaResposta.auditoria.contextHash,
          origem: opcoes.iaResposta.auditoria.provider,
        }
      : undefined,
  };
}

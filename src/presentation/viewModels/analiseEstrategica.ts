/**
 * Composição final: `AnaliseEstrategicaCompleta` (application layer) →
 * ViewModels já existentes. Nenhuma lógica de apresentação nova aqui —
 * só decide QUAIS ViewModels construir, conforme a disponibilidade de
 * cada dimensão (seção 49 do pedido: a página não pode ter uma segunda
 * lógica de apresentação).
 */

import type { AnaliseEstrategicaCompleta } from "../../application/analiseEstrategica/tipos";
import { construirDecisaoViewModel, type DecisaoViewModel } from "./decisao";
import { construirResumoExecutivoViewModel, type ResumoExecutivoViewModel } from "./resumoExecutivo";
import { construirComparacaoRegimesViewModel, type LinhaComparacaoRegime } from "./comparacaoRegimes";
import { construirScoreViewModel, type ScoreAlternativaViewModel } from "./score";
import { construirParetoViewModel, type ParetoViewModel } from "./pareto";
import { construirPlanoAcaoViewModel, type EtapaPlanoViewModel } from "./planoAcao";
import { construirCaixaExecutivoViewModel, type CaixaExecutivoViewModel } from "./caixa";
import { construirTimelineViewModel, type TimelineEstrategicaViewModel } from "./timeline";
import { construirPontosViradaViewModel, type PontoViradaViewModel } from "./pontosVirada";

export interface PaginaAnaliseEstrategicaViewModel {
  ano: number;
  nomeEmpresa?: string;
  resumo?: ResumoExecutivoViewModel;
  decisao?: DecisaoViewModel;
  comparacaoRegimes: LinhaComparacaoRegime[];
  caixa: CaixaExecutivoViewModel;
  timeline?: TimelineEstrategicaViewModel;
  pontosVirada: PontoViradaViewModel[];
  scores?: ScoreAlternativaViewModel[];
  pareto?: ParetoViewModel;
  planoAcao?: { etapas: EtapaPlanoViewModel[]; statusPlano: string };
  statusOtimizacaoMotivo?: string;
  statusScoreMotivo?: string;
}

export function construirPaginaAnaliseEstrategicaViewModel(analise: AnaliseEstrategicaCompleta, nomeEmpresa?: string): PaginaAnaliseEstrategicaViewModel {
  const decisao = analise.decisao ? construirDecisaoViewModel(analise.decisao) : undefined;
  const resumo = analise.resultadoCenario && analise.decisao ? construirResumoExecutivoViewModel(analise.resultadoCenario, analise.decisao, analise.ano) : undefined;
  const comparacaoRegimes = analise.resultadoCenario ? construirComparacaoRegimesViewModel(analise.resultadoCenario, analise.ano) : [];
  const scores = analise.statusScore.status === "disponivel" && analise.scores ? construirScoreViewModel(analise.scores) : undefined;
  const pareto = analise.statusOtimizacao.status === "disponivel" && analise.otimizacao ? construirParetoViewModel(analise.otimizacao.fronteiraPareto, analise.otimizacao.objetivos) : undefined;
  const planoAcao = analise.statusPlanoAcao.status === "disponivel" && analise.planoAcao ? construirPlanoAcaoViewModel(analise.planoAcao) : undefined;

  const regimePreferido = analise.decisao?.alternativaPreferida;
  const anoCaixaDoRegime = regimePreferido ? analise.resultadoCenario?.resultadoCaixaPorRegime?.find((r) => r.regime === regimePreferido)?.anos.find((a) => a.ano === analise.ano) : undefined;
  const caixa = construirCaixaExecutivoViewModel(anoCaixaDoRegime, analise.statusCaixa.status !== "disponivel" ? analise.statusCaixa.motivo : undefined);

  const timeline = analise.statusHorizonte.status === "disponivel" && analise.resultadoCenario ? construirTimelineViewModel(analise.resultadoCenario, analise.horizonteDecisao) : undefined;

  const pontosVirada = analise.statusPontosVirada.status === "disponivel" && analise.pontosVirada ? construirPontosViradaViewModel(analise.pontosVirada, analise.ano) : [];

  return {
    ano: analise.ano,
    nomeEmpresa,
    resumo,
    decisao,
    comparacaoRegimes,
    caixa,
    timeline,
    pontosVirada,
    scores,
    pareto,
    planoAcao,
    statusOtimizacaoMotivo: analise.statusOtimizacao.status === "nao_aplicavel" ? analise.statusOtimizacao.motivo : undefined,
    statusScoreMotivo: analise.statusScore.status !== "disponivel" ? analise.statusScore.motivo : undefined,
  };
}

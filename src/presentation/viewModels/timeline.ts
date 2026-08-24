/**
 * Timeline 2026-2033 — consome `ResultadoCenario` (todos os anos já
 * calculados) + `HorizonteDecisao` (motorDecisao/temporal.ts, já
 * existente). Um item por ano do horizonte, SEM interpolação: quando
 * um indicador não existe naquele ano, fica `disponivel: false`, nunca
 * herdado do ano anterior (seção 11 do pedido).
 */

import { ANOS_SIMULACAO } from "../../engine/parametros";
import type { Regime } from "../../engine/types";
import type { ResultadoCenario } from "../../engine/motorCenarios/tipos";
import type { HorizonteDecisao, StatusConclusao } from "../../engine/motorDecisao/tipos";

export interface IndicadorAno {
  disponivel: boolean;
  valor?: number;
}

export interface TimelineAnoViewModel {
  ano: number;
  regimeReferencia?: Regime;
  carga: IndicadorAno;
  margem: IndicadorAno;
  resultado: IndicadorAno;
  capitalGiroAdicional: IndicadorAno;
  regimeComparavel?: Regime;
  statusDecisao?: StatusConclusao;
  alternativaPreferida?: string;
  qualidade?: string;
  /** Comparação simples com o ano anterior — apresentação, nunca regra de domínio (seção 19/20): não interpreta CAUSA, só sinaliza QUE mudou. */
  marcos: string[];
}

export interface TimelineEstrategicaViewModel {
  anos: TimelineAnoViewModel[];
}

function indicador(valor: number | undefined): IndicadorAno {
  return valor === undefined ? { disponivel: false } : { disponivel: true, valor };
}

export function construirTimelineViewModel(resultado: ResultadoCenario, horizonte: HorizonteDecisao | undefined): TimelineEstrategicaViewModel {
  const decisoesPorAno = new Map((horizonte?.decisoesPorAno ?? []).map((d) => [d.ano, d]));

  const anos: TimelineAnoViewModel[] = ANOS_SIMULACAO.map((ano) => {
    const decisaoDoAno = decisoesPorAno.get(ano);
    const regimeReferencia = decisaoDoAno?.alternativaPreferida as Regime | undefined;

    const anoRegime = regimeReferencia ? resultado.resultadoRegimes.find((r) => r.regime === regimeReferencia)?.anos.find((a) => a.ano === ano) : undefined;
    const anoComp = resultado.comparacaoRegimes?.porAno.find((a) => a.ano === ano);
    const receitaReferencia = regimeReferencia ? anoComp?.porRegime.find((r) => r.regime === regimeReferencia)?.receitaReferencia : undefined;
    const anoFinanceiro = regimeReferencia ? resultado.resultadoFinanceiroPorRegime.find((r) => r.regime === regimeReferencia)?.resultado.anos.find((a) => a.ano === ano) : undefined;
    const anoCaixa = regimeReferencia ? resultado.resultadoCaixaPorRegime?.find((r) => r.regime === regimeReferencia)?.anos.find((a) => a.ano === ano) : undefined;

    return {
      ano,
      regimeReferencia,
      carga: indicador(anoRegime?.disponivel && receitaReferencia ? anoRegime.cargaTotal / receitaReferencia : undefined),
      margem: indicador(anoFinanceiro?.margem),
      resultado: indicador(anoFinanceiro?.resultado),
      capitalGiroAdicional: indicador(anoCaixa?.picoCapitalGiroAdicional),
      regimeComparavel: anoComp?.menorCargaComparavel,
      statusDecisao: decisaoDoAno?.statusConclusao,
      alternativaPreferida: decisaoDoAno?.alternativaPreferida,
      qualidade: anoFinanceiro?.qualidade,
      marcos: [],
    };
  });

  for (let i = 1; i < anos.length; i++) {
    const anterior = anos[i - 1];
    const atual = anos[i];
    if (atual.statusDecisao && anterior.statusDecisao && atual.statusDecisao !== anterior.statusDecisao) atual.marcos.push("Houve mudança de conclusão.");
    if (atual.alternativaPreferida && anterior.alternativaPreferida && atual.alternativaPreferida !== anterior.alternativaPreferida) atual.marcos.push("Houve mudança de alternativa preferida.");
    if (atual.regimeComparavel && anterior.regimeComparavel && atual.regimeComparavel !== anterior.regimeComparavel) atual.marcos.push("Houve mudança no regime de menor carga comparável.");
  }

  return { anos };
}

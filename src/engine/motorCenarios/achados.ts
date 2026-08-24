/**
 * Achados de mudança de estado ENTRE dois pontos consecutivos de
 * sensibilidade (seção 33/34 do pedido) — detecta que uma mudança
 * ocorreu, nunca interpola o ponto exato (isso é break-even, fase
 * futura). Nenhuma severidade estratégica arbitrária.
 */

import type { Regime } from "../types";
import type { ResultadoCenario } from "./tipos";

export type CodigoAchadoSensibilidade = "MUDANCA_REGIME_MENOR_CARGA" | "MUDANCA_ANEXO_SIMPLES" | "MARGEM_CRUZOU_ZERO" | "CAPITAL_GIRO_CRUZOU_LIMITE_INFORMADO";

export interface AchadoSensibilidade {
  codigo: CodigoAchadoSensibilidade;
  entrePontos: [number, number];
  descricao: string;
}

/** Exportado para reuso pelo Motor de Pontos de Virada (motorPontosVirada/estado.ts) — nunca reimplementado lá. */
export function anexoUsadoPorRegime(resultado: ResultadoCenario, regime: Regime, ano: number): string | undefined {
  const r = resultado.resultadoRegimes.find((x) => x.regime === regime);
  const anoRegime = r?.anos.find((a) => a.ano === ano);
  const memoria = anoRegime?.componentes.find((c) => c.componente === "das")?.memoriaCalculo;
  if (!memoria || (!memoria.includes("Anexo III") && !memoria.includes("Anexo V"))) return undefined;
  return memoria.includes("Anexo III") ? "anexo_iii" : "anexo_v";
}

/**
 * Compara dois pontos consecutivos de uma sensibilidade e detecta
 * mudanças de estado — não avalia magnitude, só "mudou ou não mudou".
 */
export function detectarMudancasEntrePontos(valorA: number, resultadoA: ResultadoCenario, valorB: number, resultadoB: ResultadoCenario, ano: number, regimeReferencia?: Regime, caixaMinimoOperacional?: number): AchadoSensibilidade[] {
  const achados: AchadoSensibilidade[] = [];
  const entrePontos: [number, number] = [valorA, valorB];

  const menorCargaA = resultadoA.comparacaoRegimes?.porAno.find((a) => a.ano === ano)?.menorCargaComparavel;
  const menorCargaB = resultadoB.comparacaoRegimes?.porAno.find((a) => a.ano === ano)?.menorCargaComparavel;
  if (menorCargaA !== undefined && menorCargaB !== undefined && menorCargaA !== menorCargaB) {
    achados.push({ codigo: "MUDANCA_REGIME_MENOR_CARGA", entrePontos, descricao: `Regime de menor carga comparável muda de ${menorCargaA} para ${menorCargaB} entre os valores ${valorA} e ${valorB}.` });
  }

  for (const regime of ["simples_unificado", "simples_hibrido"] as const) {
    const anexoA = anexoUsadoPorRegime(resultadoA, regime, ano);
    const anexoB = anexoUsadoPorRegime(resultadoB, regime, ano);
    if (anexoA !== undefined && anexoB !== undefined && anexoA !== anexoB) {
      achados.push({ codigo: "MUDANCA_ANEXO_SIMPLES", entrePontos, descricao: `Anexo do Simples (${regime}) muda de ${anexoA} para ${anexoB} entre os valores ${valorA} e ${valorB} (efeito do Fator R).` });
    }
  }

  if (regimeReferencia) {
    const margemA = resultadoA.resultadoFinanceiroPorRegime.find((r) => r.regime === regimeReferencia)?.resultado.anos.find((a) => a.ano === ano)?.margem;
    const margemB = resultadoB.resultadoFinanceiroPorRegime.find((r) => r.regime === regimeReferencia)?.resultado.anos.find((a) => a.ano === ano)?.margem;
    if (margemA !== undefined && margemB !== undefined && Math.sign(margemA) !== Math.sign(margemB) && margemA !== 0 && margemB !== 0) {
      achados.push({ codigo: "MARGEM_CRUZOU_ZERO", entrePontos, descricao: `Margem (${regimeReferencia}, ${ano}) cruza zero entre os valores ${valorA} e ${valorB} (de ${(margemA * 100).toFixed(2)}% para ${(margemB * 100).toFixed(2)}%).` });
    }

    if (caixaMinimoOperacional !== undefined) {
      const mesesA = resultadoA.resultadoCaixaPorRegime?.find((r) => r.regime === regimeReferencia)?.anos.find((a) => a.ano === ano)?.meses ?? [];
      const mesesB = resultadoB.resultadoCaixaPorRegime?.find((r) => r.regime === regimeReferencia)?.anos.find((a) => a.ano === ano)?.meses ?? [];
      const precisouA = mesesA.some((m) => (m.financiamentoAdicionalNecessario ?? 0) > 0);
      const precisouB = mesesB.some((m) => (m.financiamentoAdicionalNecessario ?? 0) > 0);
      if (precisouA !== precisouB) {
        achados.push({ codigo: "CAPITAL_GIRO_CRUZOU_LIMITE_INFORMADO", entrePontos, descricao: `Necessidade de financiamento adicional (caixa abaixo do mínimo operacional informado) passa a ${precisouB ? "ocorrer" : "não ocorrer"} entre os valores ${valorA} e ${valorB}.` });
      }
    }
  }

  return achados;
}

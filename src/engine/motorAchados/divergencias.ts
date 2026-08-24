/**
 * Achados cruzados (seção 26-28 do pedido) — comparam regimes já
 * calculados/comparáveis entre si, nunca decidem um vencedor. Só
 * afirmam divergência quando TODOS os regimes envolvidos têm o dado
 * disponível e comparável.
 */

import type { ResultadoCenario } from "../motorCenarios/tipos";
import type { AchadoEstrategico } from "./tipos";

export function gerarAchadosDivergencia(resultado: ResultadoCenario, ano: number): AchadoEstrategico[] {
  const achados: AchadoEstrategico[] = [];
  const anoComp = resultado.comparacaoRegimes?.porAno.find((a) => a.ano === ano);
  const menorCarga = anoComp?.menorCargaComparavel;
  if (!menorCarga) return achados;

  const financeiros = resultado.resultadoFinanceiroPorRegime.map((r) => ({ regime: r.regime, margem: r.resultado.anos.find((a) => a.ano === ano)?.margem })).filter((r): r is { regime: typeof r.regime; margem: number } => r.margem !== undefined);
  const maiorMargem = financeiros.length > 0 ? financeiros.reduce((max, r) => (r.margem > max.margem ? r : max)) : undefined;

  if (maiorMargem && maiorMargem.regime !== menorCarga && financeiros.some((r) => r.regime === menorCarga)) {
    achados.push({
      id: `divergencia:${ano}:MENOR_TRIBUTO_NAO_COINCIDE_COM_MAIOR_MARGEM`,
      codigo: "MENOR_TRIBUTO_NAO_COINCIDE_COM_MAIOR_MARGEM",
      categoria: "divergencia",
      tituloTecnico: "Menor carga comparável não coincide com maior margem",
      descricaoTecnica: `Em ${ano}, o regime de menor carga comparável é ${menorCarga}, enquanto o regime de maior margem projetada é ${maiorMargem.regime}.`,
      periodo: { ano },
      evidencias: [
        { origem: "comparador_consolidado", referencia: `ComparacaoAno.${ano}.menorCargaComparavel` },
        { origem: "motor_financeiro", referencia: `ResultadoAnoEconomicoFinanceiro.${maiorMargem.regime}.anos[${ano}].margem`, valor: maiorMargem.margem },
      ],
      qualidade: "media",
      premissas: {},
      origens: ["classificacao_vgr"],
      status: "estimado",
    });
  }

  if (resultado.resultadoCaixaPorRegime) {
    const caixas = resultado.resultadoCaixaPorRegime.map((r) => ({ regime: r.regime, pico: r.anos.find((a) => a.ano === ano)?.picoCapitalGiroAdicional })).filter((r): r is { regime: typeof r.regime; pico: number } => r.pico !== undefined);
    const menorCapitalGiro = caixas.length > 0 ? caixas.reduce((min, r) => (r.pico < min.pico ? r : min)) : undefined;

    if (menorCapitalGiro && menorCapitalGiro.regime !== menorCarga && caixas.some((r) => r.regime === menorCarga)) {
      achados.push({
        id: `divergencia:${ano}:MENOR_TRIBUTO_NAO_COINCIDE_COM_MELHOR_CAIXA`,
        codigo: "MENOR_TRIBUTO_NAO_COINCIDE_COM_MELHOR_CAIXA",
        categoria: "divergencia",
        tituloTecnico: "Menor carga comparável não coincide com menor necessidade de capital de giro",
        descricaoTecnica: `Em ${ano}, o regime de menor carga comparável é ${menorCarga}, enquanto o regime de menor pico de capital de giro adicional é ${menorCapitalGiro.regime}.`,
        periodo: { ano },
        evidencias: [
          { origem: "comparador_consolidado", referencia: `ComparacaoAno.${ano}.menorCargaComparavel` },
          { origem: "motor_split_payment", referencia: `ResultadoImpactoCaixa.${menorCapitalGiro.regime}.${ano}.picoCapitalGiroAdicional`, valor: menorCapitalGiro.pico },
        ],
        qualidade: "media",
        premissas: {},
        origens: ["classificacao_vgr"],
        status: "estimado",
      });
    }

    if (maiorMargem && menorCapitalGiro && maiorMargem.regime !== menorCapitalGiro.regime && caixas.some((r) => r.regime === maiorMargem.regime)) {
      achados.push({
        id: `divergencia:${ano}:MAIOR_MARGEM_NAO_COINCIDE_COM_MELHOR_CAIXA`,
        codigo: "MAIOR_MARGEM_NAO_COINCIDE_COM_MELHOR_CAIXA",
        categoria: "divergencia",
        tituloTecnico: "Maior margem não coincide com menor necessidade de capital de giro",
        descricaoTecnica: `Em ${ano}, o regime de maior margem projetada é ${maiorMargem.regime}, enquanto o regime de menor pico de capital de giro adicional é ${menorCapitalGiro.regime}.`,
        periodo: { ano },
        evidencias: [
          { origem: "motor_financeiro", referencia: `ResultadoAnoEconomicoFinanceiro.${maiorMargem.regime}.anos[${ano}].margem`, valor: maiorMargem.margem },
          { origem: "motor_split_payment", referencia: `ResultadoImpactoCaixa.${menorCapitalGiro.regime}.${ano}.picoCapitalGiroAdicional`, valor: menorCapitalGiro.pico },
        ],
        qualidade: "media",
        premissas: {},
        origens: ["classificacao_vgr"],
        status: "estimado",
      });
    }
  }

  return achados;
}

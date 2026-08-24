/**
 * Decisão entre regimes tributários — primeira família prioritária
 * (seção 12/13 do pedido). Só compara regimes juridicamente
 * disponíveis e comparáveis (`menorCargaComparavel`/`ResumoComparativoRegimeAno`,
 * nunca `regimeMenorCarga` bruto — seção 14). Nenhuma fórmula fiscal/
 * financeira própria: lê `ResultadoCenario` já calculado pelo Motor de
 * Cenários.
 */

import type { Regime } from "../types";
import type { ResultadoCenario } from "../motorCenarios/tipos";
import type { ResumoComparativoRegimeAno } from "../motorRegimes/comparadorConsolidado";
import type { ResultadoPontoVirada } from "../motorPontosVirada/tipos";
import { calcularDominancia, type DimensaoComparavel } from "./dominancia";
import { arredondarCentavos } from "../motorPontosVirada/precisao";
import type { AvaliacaoAlternativa, CodigoRazaoConclusao, CondicaoDecisao, EvidenciaDecisao, ResultadoDecisaoEstrategica } from "./tipos";

export interface OpcoesDecisaoRegime {
  ano: number;
  pontosVirada?: ResultadoPontoVirada[];
  /**
   * Fração do valor atual (0-1) que define "próximo" de um ponto de
   * virada relacionado, o suficiente para rebaixar uma preferência
   * robusta a condicionada (seção 25: nunca inventado por default —
   * sem este parâmetro, a distância é só registrada como fato, o
   * status não é rebaixado por proximidade).
   */
  margemMaterialidadeProximidade?: number;
}

interface MetricasRegime {
  regime: Regime;
  resumo: ResumoComparativoRegimeAno;
  resultadoEconomico?: number;
  margem?: number;
  picoCapitalGiro?: number;
  custoFinanceiroAnual?: number;
  /** resultado econômico já líquido do custo financeiro do capital adicional — combinação aritmética simples de dois números já calculados por motores distintos, nunca uma fórmula nova (seção 47). */
  resultadoLiquido?: number;
}

function coletarMetricas(resultado: ResultadoCenario, resumo: ResumoComparativoRegimeAno, ano: number): MetricasRegime {
  const financeiro = resultado.resultadoFinanceiroPorRegime.find((r) => r.regime === resumo.regime)?.resultado.anos.find((a) => a.ano === ano);
  const caixa = resultado.resultadoCaixaPorRegime?.find((r) => r.regime === resumo.regime)?.anos.find((a) => a.ano === ano);
  const resultadoEconomico = financeiro?.resultado;
  const custoFinanceiroAnual = caixa?.custoFinanceiroAnual;
  const resultadoLiquido = resultadoEconomico !== undefined ? resultadoEconomico - (custoFinanceiroAnual ?? 0) : undefined;

  return { regime: resumo.regime, resumo, resultadoEconomico, margem: financeiro?.margem, picoCapitalGiro: caixa?.picoCapitalGiroAdicional, custoFinanceiroAnual, resultadoLiquido };
}

function dimensoesDoPar(a: MetricasRegime, b: MetricasRegime): DimensaoComparavel[] {
  return [
    { nome: "fiscal", direcao: "menor", valorA: a.resumo.cargaConhecida, valorB: b.resumo.cargaConhecida, tolerancia: 0.01 },
    { nome: "economica", direcao: "maior", valorA: a.resultadoLiquido, valorB: b.resultadoLiquido, tolerancia: 0.01 },
    { nome: "caixa", direcao: "menor", valorA: a.picoCapitalGiro, valorB: b.picoCapitalGiro, tolerancia: 0.01 },
  ];
}

function evidenciasDoPar(preferido: MetricasRegime, outro: MetricasRegime, porDimensao: Record<string, string>): { favoraveis: EvidenciaDecisao[]; contrarias: EvidenciaDecisao[] } {
  const favoraveis: EvidenciaDecisao[] = [];
  const contrarias: EvidenciaDecisao[] = [];

  if (porDimensao.fiscal === "A") favoraveis.push({ descricao: `Carga tributária R$ ${arredondarCentavos(outro.resumo.cargaConhecida - preferido.resumo.cargaConhecida).toFixed(2)} menor que ${outro.regime}`, valor: outro.resumo.cargaConhecida - preferido.resumo.cargaConhecida, unidade: "reais", origem: "comparador_consolidado" });
  else if (porDimensao.fiscal === "B") contrarias.push({ descricao: `Carga tributária R$ ${arredondarCentavos(preferido.resumo.cargaConhecida - outro.resumo.cargaConhecida).toFixed(2)} maior que ${outro.regime}`, valor: preferido.resumo.cargaConhecida - outro.resumo.cargaConhecida, unidade: "reais", origem: "comparador_consolidado" });

  if (porDimensao.economica === "A" && preferido.resultadoLiquido !== undefined && outro.resultadoLiquido !== undefined) {
    favoraveis.push({ descricao: `Resultado econômico (líquido de custo financeiro, quando aplicável) R$ ${arredondarCentavos(preferido.resultadoLiquido - outro.resultadoLiquido).toFixed(2)} maior que ${outro.regime}`, valor: preferido.resultadoLiquido - outro.resultadoLiquido, unidade: "reais", origem: "motor_financeiro+motor_split_payment" });
  } else if (porDimensao.economica === "B" && preferido.resultadoLiquido !== undefined && outro.resultadoLiquido !== undefined) {
    contrarias.push({ descricao: `Resultado econômico (líquido de custo financeiro, quando aplicável) R$ ${arredondarCentavos(outro.resultadoLiquido - preferido.resultadoLiquido).toFixed(2)} menor que ${outro.regime}`, valor: outro.resultadoLiquido - preferido.resultadoLiquido, unidade: "reais", origem: "motor_financeiro+motor_split_payment" });
  }

  if (porDimensao.caixa === "A") favoraveis.push({ descricao: `Capital de giro adicional (pico) menor que ${outro.regime}`, valor: (outro.picoCapitalGiro ?? 0) - (preferido.picoCapitalGiro ?? 0), unidade: "reais", origem: "motor_split_payment" });
  else if (porDimensao.caixa === "B") contrarias.push({ descricao: `Capital de giro adicional (pico) R$ ${arredondarCentavos((preferido.picoCapitalGiro ?? 0) - (outro.picoCapitalGiro ?? 0)).toFixed(2)} maior que ${outro.regime}`, valor: (preferido.picoCapitalGiro ?? 0) - (outro.picoCapitalGiro ?? 0), unidade: "reais", origem: "motor_split_payment" });

  return { favoraveis, contrarias };
}

function condicaoDeProximidade(pontosVirada: ResultadoPontoVirada[], margemMaterialidade?: number): CondicaoDecisao | undefined {
  const pv = pontosVirada.find((p) => (p.variavel === "custoCapital" || p.variavel === "faturamento") && p.status === "encontrado" && p.valorEncontrado !== undefined);
  if (!pv || pv.valorEncontrado === undefined) return undefined;
  if (margemMaterialidade === undefined) return undefined; // seção 25: sem parâmetro explícito, não rebaixa status por proximidade.

  return { descricao: `A preferência é condicionada a ${pv.variavel} permanecer no lado atual do ponto de virada (valor ${pv.valorEncontrado.toFixed(4)}).`, variavel: pv.variavel, limite: pv.valorEncontrado, origemPontoVirada: `${pv.tipo}:${pv.variavel}` };
}

export function decidirRegimeTributario(resultado: ResultadoCenario, opcoes: OpcoesDecisaoRegime): ResultadoDecisaoEstrategica {
  const { ano, pontosVirada = [], margemMaterialidadeProximidade } = opcoes;
  const anoComp = resultado.comparacaoRegimes?.porAno.find((a) => a.ano === ano);
  const porRegime = anoComp?.porRegime ?? [];

  const base = { id: `decisao:regime_tributario:${resultado.cenarioId}:${ano}`, cenarioId: resultado.cenarioId, periodo: { ano }, objetoDecisao: "regime_tributario" as const };

  const obrigatorio = porRegime.find((r) => r.statusJuridico === "obrigatorio");
  if (obrigatorio) {
    return {
      ...base,
      alternativasAvaliadas: [],
      statusConclusao: "preferencia_tecnica_robusta",
      naturezaConclusao: "obrigacao_juridica",
      alternativaPreferida: obrigatorio.regime,
      alternativasEquivalentes: [],
      evidenciasFavoraveis: [],
      evidenciasContrarias: [],
      conflitos: [],
      bloqueios: [],
      riscos: [],
      premissas: {},
      validacoesPendentes: [],
      qualidade: obrigatorio.qualidadeConsolidada,
      condicoes: [],
      pontosViradaRelacionados: [],
      razoesConclusao: ["OBRIGACAO_JURIDICA"],
      justificativaEstruturada: `${obrigatorio.regime} é o regime juridicamente obrigatório no cenário — não se trata de preferência técnica.`,
    };
  }

  const comparaveis = porRegime.filter((r) => r.status === "comparavel" || r.status === "comparavel_com_ressalvas");
  const bloqueados = porRegime.filter((r) => r.status === "nao_comparavel" || r.status === "indeterminado");

  const bloqueiosAvaliacao: { tipo: "elegibilidade_indeterminada" | "regime_nao_comparavel"; descricao: string }[] = bloqueados.map((r) => ({ tipo: r.statusJuridico === "inelegivel" ? "elegibilidade_indeterminada" : "regime_nao_comparavel", descricao: `${r.regime}: ${r.motivos.map((m) => m.descricao).join(" ")}` }));

  if (comparaveis.length === 0) {
    return {
      ...base,
      alternativasAvaliadas: [],
      statusConclusao: bloqueados.length > 0 ? "bloqueado" : "dados_insuficientes",
      alternativasEquivalentes: [],
      evidenciasFavoraveis: [],
      evidenciasContrarias: [],
      conflitos: [],
      bloqueios: bloqueiosAvaliacao,
      riscos: [],
      premissas: {},
      validacoesPendentes: [],
      qualidade: "insuficiente",
      condicoes: [],
      pontosViradaRelacionados: [],
      razoesConclusao: ["TODOS_BLOQUEADOS"],
      justificativaEstruturada: "Nenhum regime está em condição comparável neste ano — não há base para preferência técnica.",
    };
  }

  const metricas = comparaveis.map((r) => coletarMetricas(resultado, r, ano));

  if (metricas.length === 1) {
    const unico = metricas[0];
    return {
      ...base,
      alternativasAvaliadas: [{ identificador: unico.regime, regime: unico.regime, aplicabilidade: "aplicavel", evidenciasFavoraveis: [], evidenciasContrarias: [], bloqueios: [], riscos: [], condicoes: [], qualidade: unico.resumo.qualidadeConsolidada, dominancia: {} }],
      statusConclusao: unico.resumo.qualidadeConsolidada === "insuficiente" ? "dados_insuficientes" : "preferencia_tecnica_robusta",
      naturezaConclusao: "preferencia_tecnica",
      alternativaPreferida: unico.resumo.qualidadeConsolidada === "insuficiente" ? undefined : unico.regime,
      alternativasEquivalentes: [],
      evidenciasFavoraveis: [],
      evidenciasContrarias: [],
      conflitos: [],
      bloqueios: bloqueiosAvaliacao,
      riscos: [],
      premissas: {},
      validacoesPendentes: [],
      qualidade: unico.resumo.qualidadeConsolidada,
      condicoes: [],
      pontosViradaRelacionados: [],
      razoesConclusao: ["REGIME_UNICO_DISPONIVEL"],
      justificativaEstruturada: `${unico.regime} é o único regime comparável neste ano.`,
    };
  }

  // Dominância par-a-par entre todos os candidatos comparáveis.
  const dominanciaPorRegime = new Map<Regime, Map<Regime, ReturnType<typeof calcularDominancia>>>();
  for (const a of metricas) {
    const mapa = new Map<Regime, ReturnType<typeof calcularDominancia>>();
    for (const b of metricas) {
      if (a.regime === b.regime) continue;
      mapa.set(b.regime, calcularDominancia(dimensoesDoPar(a, b)));
    }
    dominanciaPorRegime.set(a.regime, mapa);
  }

  const vencedorGlobal = metricas.find((a) => [...(dominanciaPorRegime.get(a.regime)?.values() ?? [])].every((d) => d.dominanciaAB === "domina"));
  const alternativasAvaliadas: AvaliacaoAlternativa[] = metricas.map((m) => ({
    identificador: m.regime,
    regime: m.regime,
    aplicabilidade: m.resumo.status === "comparavel" ? "aplicavel" : "condicionada",
    evidenciasFavoraveis: [],
    evidenciasContrarias: [],
    bloqueios: [],
    riscos: [],
    condicoes: [],
    qualidade: m.resumo.qualidadeConsolidada,
    dominancia: Object.fromEntries([...(dominanciaPorRegime.get(m.regime)?.entries() ?? [])].map(([regime, d]) => [regime, d.dominanciaAB])),
  }));

  const qualidadeGeral = metricas.reduce((pior, m) => (["insuficiente", "baixa", "media", "alta"].indexOf(m.resumo.qualidadeConsolidada) < ["insuficiente", "baixa", "media", "alta"].indexOf(pior) ? m.resumo.qualidadeConsolidada : pior), "alta" as (typeof metricas)[number]["resumo"]["qualidadeConsolidada"]);

  const outroCandidato = metricas.find((m) => m !== vencedorGlobal);
  const dominanciaVencedor = vencedorGlobal && outroCandidato ? dominanciaPorRegime.get(vencedorGlobal.regime)?.get(outroCandidato.regime) : undefined;
  if (vencedorGlobal && outroCandidato && dominanciaVencedor) {
    const outro = outroCandidato;
    const dominancia = dominanciaVencedor;
    const { favoraveis, contrarias } = evidenciasDoPar(vencedorGlobal, outro, dominancia.porDimensao);
    const condicao = condicaoDeProximidade(pontosVirada, margemMaterialidadeProximidade);
    const razoes: CodigoRazaoConclusao[] = ["DOMINANCIA_FISCAL_E_FINANCEIRA"];
    if (dominancia.porDimensao.economica === "A") razoes.push("DIFERENCA_MARGEM_FAVORAVEL");

    return {
      ...base,
      alternativasAvaliadas,
      statusConclusao: qualidadeGeral === "insuficiente" ? "dados_insuficientes" : condicao ? "preferencia_tecnica_condicionada" : "preferencia_tecnica_robusta",
      naturezaConclusao: "preferencia_tecnica",
      alternativaPreferida: qualidadeGeral === "insuficiente" ? undefined : vencedorGlobal.regime,
      alternativasEquivalentes: [],
      evidenciasFavoraveis: favoraveis,
      evidenciasContrarias: contrarias,
      conflitos: [],
      bloqueios: bloqueiosAvaliacao,
      riscos: [],
      premissas: {},
      validacoesPendentes: [],
      qualidade: qualidadeGeral,
      condicoes: condicao ? [condicao] : [],
      pontosViradaRelacionados: pontosVirada.filter((p) => p.status === "encontrado").map((p) => ({ tipo: p.tipo, variavel: p.variavel, valorEncontrado: p.valorEncontrado, estadoAntes: p.estadoAntes?.estadoCategorico, estadoDepois: p.estadoDepois?.estadoCategorico })),
      razoesConclusao: razoes,
      justificativaEstruturada: `${vencedorGlobal.regime} apresenta preferência técnica ${condicao ? "condicionada" : "nas condições analisadas"} em relação a ${outro.regime} em ${ano}.`,
    };
  }

  // Sem dominante único: verificar se são todos equivalentes, ou há conflito real.
  const paresRelevantes = metricas.flatMap((a) => metricas.filter((b) => b.regime !== a.regime).map((b) => dominanciaPorRegime.get(a.regime)!.get(b.regime)!.dominanciaAB));
  const todosEquivalentes = paresRelevantes.every((d) => d === "equivalente" || d === "incomparavel");

  if (todosEquivalentes) {
    return {
      ...base,
      alternativasAvaliadas,
      statusConclusao: "alternativas_equivalentes",
      naturezaConclusao: "preferencia_tecnica",
      alternativasEquivalentes: metricas.map((m) => m.regime),
      evidenciasFavoraveis: [],
      evidenciasContrarias: [],
      conflitos: [],
      bloqueios: bloqueiosAvaliacao,
      riscos: [],
      premissas: {},
      validacoesPendentes: [],
      qualidade: qualidadeGeral,
      condicoes: [],
      pontosViradaRelacionados: [],
      razoesConclusao: ["ALTERNATIVAS_EQUIVALENTES_DENTRO_DA_PRECISAO"],
      justificativaEstruturada: `As alternativas comparáveis (${metricas.map((m) => m.regime).join(", ")}) produzem resultados equivalentes dentro da precisão utilizada em ${ano}.`,
    };
  }

  const descricoesConflito = metricas.map((m) => `${m.regime}: carga R$ ${m.resumo.cargaConhecida.toFixed(2)}${m.resultadoLiquido !== undefined ? `, resultado líquido R$ ${m.resultadoLiquido.toFixed(2)}` : ""}${m.picoCapitalGiro !== undefined ? `, capital de giro adicional R$ ${m.picoCapitalGiro.toFixed(2)}` : ""}`);

  return {
    ...base,
    alternativasAvaliadas,
    statusConclusao: "conflito_nao_resolvido",
    naturezaConclusao: "preferencia_tecnica",
    alternativasEquivalentes: [],
    evidenciasFavoraveis: [],
    evidenciasContrarias: [],
    conflitos: descricoesConflito,
    bloqueios: bloqueiosAvaliacao,
    riscos: [],
    premissas: {},
    validacoesPendentes: [],
    qualidade: qualidadeGeral,
    condicoes: [],
    pontosViradaRelacionados: [],
    razoesConclusao: ["CONFLITO_TRIBUTO_CAIXA"],
    justificativaEstruturada: `As alternativas (${metricas.map((m) => m.regime).join(", ")}) apresentam vantagens em dimensões distintas em ${ano} — os dados atuais não permitem preferência única.`,
  };
}

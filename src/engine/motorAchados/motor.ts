/**
 * Motor de Achados — orquestra os conversores acima sobre um
 * `ResultadoCenario` (motorCenarios) já calculado + `ResultadoPontoVirada`
 * opcionais; produz `RelatorioAuditoriaEstrategica`. Nenhum cálculo
 * fiscal/financeiro/caixa/cenário/ponto-de-virada próprio (seção 1).
 */

import type { CenarioEmpresa } from "../cenarioEmpresa";
import type { ResultadoCenario } from "../motorCenarios/tipos";
import type { ResultadoPontoVirada } from "../motorPontosVirada/tipos";
import type { ComparacaoCenarios } from "../motorCenarios/comparacao";
import { buscarPerfil } from "../setores/catalogo";
import { classificarAnexo } from "../motorRegimes/simplesNacional/anexo";
import { ANOS_SIMULACAO } from "../parametros";
import { gerarAchadosCargaFiscal, gerarAchadosComparabilidade } from "./fiscal";
import { gerarAchadosCredito, gerarAchadoCreditoNecessarioParaNeutralizar } from "./creditos";
import { gerarAchadosFatorR } from "./fatorR";
import { converterAchadosFinanceiros, gerarAchadoReajustePreservacaoMargem, converterAchadosCaixa } from "./financeiroCaixa";
import { gerarAchadosDivergencia } from "./divergencias";
import { gerarAchadosCenario } from "./cenarios";
import { converterPontoVirada } from "./pontosVirada";
import { deduplicarAchados } from "./dedup";
import { avaliarCobertura } from "./cobertura";
import type { AchadoEstrategico, CategoriaAchado, QualidadeAchado, RelatorioAuditoriaEstrategica } from "./tipos";

const ORDEM_CATEGORIAS: CategoriaAchado[] = ["qualidade", "dados", "fiscal", "comparabilidade", "creditos", "regimes", "fator_r", "margem", "preco", "caixa", "capital_giro", "divergencia", "cenario", "ponto_virada", "setorial"];

function ordenarAchados(achados: AchadoEstrategico[]): AchadoEstrategico[] {
  return [...achados].sort((a, b) => {
    const bloqueioA = a.severidadeTecnica ? 0 : 1;
    const bloqueioB = b.severidadeTecnica ? 0 : 1;
    if (bloqueioA !== bloqueioB) return bloqueioA - bloqueioB;
    return ORDEM_CATEGORIAS.indexOf(a.categoria) - ORDEM_CATEGORIAS.indexOf(b.categoria);
  });
}

function piorQualidadeGeral(achados: AchadoEstrategico[]): QualidadeAchado {
  if (achados.length === 0) return "insuficiente";
  const ordem: Record<QualidadeAchado, number> = { insuficiente: 0, baixa: 1, media: 2, alta: 3 };
  return achados.reduce((pior, a) => (ordem[a.qualidade] < ordem[pior] ? a.qualidade : pior), "alta" as QualidadeAchado);
}

function aplicavelFatorR(cenario: CenarioEmpresa): boolean {
  const perfilId = cenario.identificacao.atividadePrincipal?.perfilId;
  if (!perfilId) return false;
  const perfil = buscarPerfil(perfilId);
  if (!perfil) return false;
  return classificarAnexo(perfil).anexo === "indeterminado_fator_r";
}

function gerarResumoTecnico(achados: AchadoEstrategico[]): string {
  if (achados.length === 0) return "Nenhum achado estruturado foi identificado com os dados disponíveis.";
  const porCategoria = new Map<CategoriaAchado, number>();
  for (const a of achados) porCategoria.set(a.categoria, (porCategoria.get(a.categoria) ?? 0) + 1);
  const partes = [...porCategoria.entries()].map(([cat, n]) => `${n} em ${cat}`);
  return `${achados.length} achado(s) identificado(s): ${partes.join(", ")}.`;
}

export interface OpcoesGerarRelatorio {
  ano?: number;
  cenario: CenarioEmpresa;
  resultado: ResultadoCenario;
  pontosVirada?: ResultadoPontoVirada[];
  /** Diferenças já calculadas via `compararCenarios` (motorCenarios) — este módulo nunca chama `compararCenarios` sozinho, pois exige um baseline explícito escolhido por quem orquestra. */
  diferencasCenario?: { diff: ComparacaoCenarios; baselineId: string }[];
}

export function gerarRelatorioAuditoriaEstrategica(opcoes: OpcoesGerarRelatorio): RelatorioAuditoriaEstrategica {
  const ano = opcoes.ano ?? ANOS_SIMULACAO[0];
  const { cenario, resultado } = opcoes;
  const achados: AchadoEstrategico[] = [];

  for (const r of resultado.resultadoRegimes) {
    achados.push(...gerarAchadosCargaFiscal(r, ano));
  }
  if (resultado.comparacaoRegimes) achados.push(...gerarAchadosComparabilidade(resultado.comparacaoRegimes, ano));
  achados.push(...gerarAchadosFatorR(cenario, ano, aplicavelFatorR(cenario)));

  achados.push(...gerarAchadosCredito(cenario, ano));

  for (const { regime, resultado: financeiro } of resultado.resultadoFinanceiroPorRegime) {
    const anoFinanceiro = financeiro.anos.find((a) => a.ano === ano);
    if (!anoFinanceiro) continue;
    achados.push(...converterAchadosFinanceiros(anoFinanceiro, regime));
    achados.push(...gerarAchadoReajustePreservacaoMargem(anoFinanceiro, regime));
    achados.push(...gerarAchadoCreditoNecessarioParaNeutralizar(anoFinanceiro.impactoTributarioReais, cenario.receita.faturamentoAnual?.valor, ano));
  }

  for (const { regime, anos } of resultado.resultadoCaixaPorRegime ?? []) {
    const anoCaixa = anos.find((a) => a.ano === ano);
    if (anoCaixa) achados.push(...converterAchadosCaixa(anoCaixa, regime));
  }

  achados.push(...gerarAchadosDivergencia(resultado, ano));

  for (const { diff, baselineId } of opcoes.diferencasCenario ?? []) {
    achados.push(...gerarAchadosCenario(diff, baselineId, resultado.cenarioId));
  }

  for (const pv of opcoes.pontosVirada ?? []) {
    achados.push(...converterPontoVirada(pv, ano, resultado.cenarioAnaliseId));
  }

  const consolidados = ordenarAchados(deduplicarAchados(achados));
  const temDadosSetoriais = cenario.dadosSetoriais.length > 0;

  return {
    cenarioId: resultado.cenarioId,
    periodo: { anoInicio: ANOS_SIMULACAO[0], anoFim: ANOS_SIMULACAO[ANOS_SIMULACAO.length - 1] },
    perfilSetorial: cenario.identificacao.atividadePrincipal?.perfilId,
    achados: consolidados,
    qualidade: piorQualidadeGeral(consolidados),
    resumoTecnico: gerarResumoTecnico(consolidados),
    cobertura: avaliarCobertura(resultado, temDadosSetoriais, (opcoes.pontosVirada?.length ?? 0) > 0, (opcoes.diferencasCenario?.length ?? 0) > 0),
    premissas: {},
  };
}

/**
 * Motor de Cenários — orquestra os motores existentes; nenhuma fórmula
 * fiscal/econômica/financeira própria (seção 1 do pedido). Fluxo:
 * CenarioEmpresa base → aplicarAlteracoes → compararRegimes →
 * avaliarComparacaoConsolidada → calcularResultadoEconomicoFinanceiro
 * (por regime) → calcularImpactoCaixaDoAno (por regime × ano, só quando
 * houver ao menos uma premissa de split informada).
 */

import { ANOS_SIMULACAO } from "../parametros";
import type { CenarioEmpresa } from "../cenarioEmpresa";
import type { MotorRegime } from "../motorRegimes/tipos";
import { compararRegimes } from "../motorRegimes/comparador";
import { avaliarComparacaoConsolidada, type StatusComparabilidade } from "../motorRegimes/comparadorConsolidado";
import { calcularResultadoEconomicoFinanceiro } from "../motorFinanceiro/motor";
import { calcularImpactoCaixaDoAno } from "../motorFinanceiro/splitPayment/motor";
import type { PremissasSplitPayment } from "../motorFinanceiro/splitPayment/tipos";
import { validarAlteracoes, aplicarAlteracoes, resolverValorAlterado } from "./patch";
import { piorQualidade } from "./qualidade";
import type { AlteracoesCenario, OpcoesExecucaoCenario, ResultadoCaixaPorRegime, ResultadoCenario, ResultadoFinanceiroPorRegime } from "./tipos";

function comparabilidadePorAnoDoRegime(comparacaoConsolidada: ReturnType<typeof avaliarComparacaoConsolidada>, regime: string): Map<number, StatusComparabilidade> {
  const mapa = new Map<number, StatusComparabilidade>();
  for (const anoComp of comparacaoConsolidada.porAno) {
    const doRegime = anoComp.porRegime.find((r) => r.regime === regime);
    if (doRegime) mapa.set(anoComp.ano, doRegime.status);
  }
  return mapa;
}

/**
 * Mescla `AlteracaoFinanceiro`/`AlteracaoSplitPayment` em premissas
 * concretas para os motores correspondentes — essas alterações NUNCA
 * tocam `CenarioEmpresa` (não são dados da empresa, são parâmetros do
 * próprio Motor Financeiro/Split); a base para `incremento_*` é a
 * premissa já presente em `opcoes`, quando houver.
 */
function resolverPremissasFinanceiras(alteracoes: AlteracoesCenario, opcoes: OpcoesExecucaoCenario) {
  const premissas = { ...opcoes.premissasFinanceiras };
  if (alteracoes.financeiro?.margemAlvo) {
    const alterado = alteracoes.financeiro.margemAlvo;
    premissas.margemAlvo = { valor: resolverValorAlterado(premissas.margemAlvo?.valor, alterado), origem: alterado.origem, status: alterado.status };
  }
  if (alteracoes.financeiro?.percentualCustosVariaveis) {
    const alterado = alteracoes.financeiro.percentualCustosVariaveis;
    premissas.percentualCustosVariaveis = { valor: resolverValorAlterado(premissas.percentualCustosVariaveis?.valor, alterado), origem: alterado.origem, status: alterado.status };
  }
  return premissas;
}

function resolverPremissasSplit(alteracoes: AlteracoesCenario, opcoes: OpcoesExecucaoCenario): PremissasSplitPayment {
  const premissas: PremissasSplitPayment = { ...opcoes.premissasSplit };
  for (const [chave, alterado] of Object.entries(alteracoes.splitPayment ?? {})) {
    if (!alterado) continue;
    const base = (premissas as Record<string, { valor: number } | undefined>)[chave]?.valor;
    (premissas as Record<string, { valor: number; origem: string; status: string }>)[chave] = { valor: resolverValorAlterado(base, alterado), origem: alterado.origem, status: alterado.status };
  }
  return premissas;
}

function algumaPremissaSplitInformada(premissas: PremissasSplitPayment): boolean {
  return Object.values(premissas).some((v) => v !== undefined);
}

/**
 * Executa um cenário completo (fiscal + financeiro + caixa) sobre um
 * `CenarioEmpresa` base + alterações. Nunca lança em premissa
 * incompleta/impossível — resultados parciais são preservados com
 * `qualidade`/`alertas` explicando o motivo (seção 13/44/66 do pedido).
 * Só rejeita (status "erro_validacao") quando a própria alteração é
 * estruturalmente inválida (receita negativa, percentual fora de 0-100%
 * etc. — ver `validarAlteracoes`).
 */
export function executarCenario(
  cenarioBase: CenarioEmpresa,
  motoresRegime: MotorRegime[],
  alteracoes: AlteracoesCenario = {},
  opcoes: OpcoesExecucaoCenario = {},
  contexto: { cenarioAnaliseId?: string; tipo?: ResultadoCenario["tipo"] } = {}
): ResultadoCenario {
  const dataAnalise = new Date().toISOString();
  const errosValidacao = validarAlteracoes(cenarioBase, alteracoes);
  if (errosValidacao.length > 0) {
    return {
      cenarioAnaliseId: contexto.cenarioAnaliseId,
      tipo: contexto.tipo ?? "personalizado",
      cenarioId: cenarioBase.id,
      status: "erro_validacao",
      errosValidacao,
      resultadoRegimes: [],
      resultadoFinanceiroPorRegime: [],
      qualidade: { fiscal: "indisponivel", economica: "indisponivel", caixa: "indisponivel" },
      premissasEfetivas: alteracoes,
      premissasNormativasHipoteticas: alteracoes.tributario?.premissasNormativasHipoteticas ?? [],
      versaoMotores: { motoresRegime: motoresRegime.map((m) => m.regime), origemIbsCbsPorRegime: {}, dataAnalise },
      alertas: [],
    };
  }

  const { cenario: cenarioDerivado, alertas: alertasPatch } = aplicarAlteracoes(cenarioBase, alteracoes);
  const alertas = [...alertasPatch];

  const { resultados: resultadoRegimes } = compararRegimes(cenarioDerivado, motoresRegime);
  const comparacaoRegimes = avaliarComparacaoConsolidada(cenarioDerivado, resultadoRegimes);

  const premissasFinanceiras = resolverPremissasFinanceiras(alteracoes, opcoes);
  const premissasSplit = resolverPremissasSplit(alteracoes, opcoes);
  const calcularCaixa = algumaPremissaSplitInformada(premissasSplit);
  if (!calcularCaixa) alertas.push("Nenhuma premissa de split payment informada — dimensão de caixa indisponível nesta análise (não é o mesmo que 'insuficiente').");

  const resultadoFinanceiroPorRegime: ResultadoFinanceiroPorRegime[] = [];
  const resultadoCaixaPorRegime: ResultadoCaixaPorRegime[] = [];

  for (const resultadoRegime of resultadoRegimes) {
    if (resultadoRegime.anos.length === 0) continue; // regime não calculado (inelegível/indeterminado) — nada a projetar economicamente.
    const comparabilidadePorAno = comparabilidadePorAnoDoRegime(comparacaoRegimes, resultadoRegime.regime);
    const resultadoFinanceiro = calcularResultadoEconomicoFinanceiro(cenarioDerivado, resultadoRegime, premissasFinanceiras, comparabilidadePorAno);
    resultadoFinanceiroPorRegime.push({ regime: resultadoRegime.regime, resultado: resultadoFinanceiro });

    if (calcularCaixa) {
      const anosCaixa = ANOS_SIMULACAO.map((ano) => calcularImpactoCaixaDoAno(cenarioDerivado, resultadoRegime, ano, premissasSplit, comparabilidadePorAno.get(ano)));
      resultadoCaixaPorRegime.push({ regime: resultadoRegime.regime, anos: anosCaixa });
    }
  }

  const qualidadeFiscal = piorQualidade(comparacaoRegimes.porAno.flatMap((a) => a.porRegime.map((r) => r.qualidadeConsolidada)));
  const qualidadeEconomica = piorQualidade(resultadoFinanceiroPorRegime.flatMap((r) => r.resultado.anos.map((a) => a.qualidade)));
  const qualidadeCaixa = calcularCaixa ? piorQualidade(resultadoCaixaPorRegime.flatMap((r) => r.anos.map((a) => a.qualidade))) : "indisponivel";

  const origemIbsCbsPorRegime: Partial<Record<string, string>> = {};
  for (const r of resultadoRegimes) origemIbsCbsPorRegime[r.regime] = r.qualidade.origemIbsCbs;

  return {
    cenarioAnaliseId: contexto.cenarioAnaliseId,
    tipo: contexto.tipo ?? "personalizado",
    cenarioId: cenarioDerivado.id,
    status: "executado",
    errosValidacao: [],
    resultadoRegimes,
    comparacaoRegimes,
    resultadoFinanceiroPorRegime,
    resultadoCaixaPorRegime: calcularCaixa ? resultadoCaixaPorRegime : undefined,
    qualidade: { fiscal: qualidadeFiscal, economica: qualidadeEconomica, caixa: qualidadeCaixa },
    premissasEfetivas: alteracoes,
    premissasNormativasHipoteticas: alteracoes.tributario?.premissasNormativasHipoteticas ?? [],
    versaoMotores: { motoresRegime: motoresRegime.map((m) => m.regime), origemIbsCbsPorRegime, dataAnalise },
    alertas,
  };
}

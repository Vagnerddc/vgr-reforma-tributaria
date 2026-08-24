/**
 * Motor Econômico-Financeiro — consome `ResultadoRegime` (motor fiscal
 * já calculado) e `CenarioEmpresa`; nunca calcula tributo (seção 1 do
 * pedido). Ano-base = primeiro ano de `ANOS_SIMULACAO` (2026) — mesma
 * convenção já usada no produto ("carga atual/ano-teste", ver
 * docs/base-legal.md e panorama.ts).
 */

import { ANOS_SIMULACAO } from "../parametros";
import type { CenarioEmpresa } from "../cenarioEmpresa";
import type { ResultadoRegime } from "../motorRegimes/tipos";
import type { StatusComparabilidade } from "../motorRegimes/comparadorConsolidado";
import { calcularCustosEconomicos } from "./custos";
import { calcularReceitaNecessariaParaMargem, calcularCenarioRepasse, type ModeloReceitaResultado } from "./precoNecessario";
import { calcularQualidadeFinanceira } from "./qualidade";
import { gerarAchadosFinanceiros } from "./achados";
import type { PremissasFinanceiras, ResultadoAnoEconomicoFinanceiro, ResultadoEconomicoFinanceiro, ResultadoCenarioRepasse } from "./tipos";

const ANO_BASE = ANOS_SIMULACAO[0];
const PERCENTUAIS_REPASSE = [0, 0.5, 1];

function projetar(valorBase: number, crescimento: number, ano: number): number {
  return valorBase * Math.pow(1 + crescimento, ano - ANO_BASE);
}

interface DadosBrutosDoAno {
  disponivel: boolean;
  receita?: number;
  custosDespesas?: number;
  cargaFiscal?: number;
}

function coletarDadosDoAno(cenario: CenarioEmpresa, resultadoRegime: ResultadoRegime, custosTotais: number, crescimento: number, ano: number): DadosBrutosDoAno {
  const anoRegime = resultadoRegime.anos.find((a) => a.ano === ano);
  if (!anoRegime?.disponivel) return { disponivel: false };
  const receitaBase = cenario.receita.faturamentoAnual?.valor;
  if (receitaBase === undefined) return { disponivel: false };
  return { disponivel: true, receita: projetar(receitaBase, crescimento, ano), custosDespesas: projetar(custosTotais, crescimento, ano), cargaFiscal: anoRegime.cargaTotal };
}

/**
 * Calcula o resultado econômico-financeiro completo (2026–2033) para UM
 * `ResultadoRegime` já calculado por um motor fiscal. `comparabilidadePorAno`
 * é opcional — quando fornecido (tipicamente a partir do Comparador
 * Consolidado), a qualidade fiscal herdada é refletida (seção 8 do pedido);
 * sem ele, a qualidade financeira considera só a completude econômica.
 */
export function calcularResultadoEconomicoFinanceiro(cenario: CenarioEmpresa, resultadoRegime: ResultadoRegime, premissas: PremissasFinanceiras = {}, comparabilidadePorAno?: Map<number, StatusComparabilidade>): ResultadoEconomicoFinanceiro {
  const custosInfo = calcularCustosEconomicos(cenario);
  const crescimento = cenario.receita.crescimentoAnualEstimado?.valor ?? 0;
  const fracaoCustosVariaveis = premissas.percentualCustosVariaveis?.valor ?? 0;

  const dadosBase = coletarDadosDoAno(cenario, resultadoRegime, custosInfo.total, crescimento, ANO_BASE);
  const resultadoBase = dadosBase.disponivel ? dadosBase.receita! - dadosBase.custosDespesas! - dadosBase.cargaFiscal! : undefined;
  const margemBase = dadosBase.disponivel && dadosBase.receita! > 0 ? resultadoBase! / dadosBase.receita! : undefined;

  const anos: ResultadoAnoEconomicoFinanceiro[] = ANOS_SIMULACAO.map((ano) => {
    const dados = coletarDadosDoAno(cenario, resultadoRegime, custosInfo.total, crescimento, ano);
    const comparabilidade = comparabilidadePorAno?.get(ano);
    const alertas: string[] = [];

    if (!dados.disponivel) {
      alertas.push(`Ano ${ano} indisponível — resultado fiscal ou receita ausente.`);
      return { ano, regime: resultadoRegime.regime, disponivel: false, qualidade: "insuficiente", alertas, achados: gerarAchadosFinanceiros(undefined, undefined, undefined, undefined), comparabilidadeFiscal: comparabilidade };
    }

    const { receita, custosDespesas, cargaFiscal } = dados as Required<DadosBrutosDoAno>;
    const resultado = receita - custosDespesas - cargaFiscal;
    const margem = receita > 0 ? resultado / receita : undefined;
    const erosaoMargemPp = margem !== undefined && margemBase !== undefined ? (margem - margemBase) * 100 : undefined;
    const impactoAnualReais = resultadoBase !== undefined ? resultado - resultadoBase : undefined;
    const impactoTributarioReais = dadosBase.disponivel ? cargaFiscal - dadosBase.cargaFiscal! : undefined;

    if (!premissas.percentualCustosVariaveis) alertas.push("Sem premissa de custos variáveis — todo custo tratado como fixo (não escala com reajuste de preço).");
    if (!cenario.receita.crescimentoAnualEstimado) alertas.push("Sem taxa de crescimento informada — receita e custos mantidos constantes ao longo do horizonte (premissa).");

    const margemAlvo = premissas.margemAlvo?.valor ?? margemBase;
    let reajusteMedioNecessario: number | undefined;
    let cenariosRepasse: ResultadoCenarioRepasse[] | undefined;

    if (margemAlvo !== undefined) {
      const modelo: ModeloReceitaResultado = { custosFixos: custosDespesas * (1 - fracaoCustosVariaveis), fracaoCustosVariaveis, aliquotaEfetivaImplicita: receita > 0 ? cargaFiscal / receita : 0 };
      const receitaNecessaria = calcularReceitaNecessariaParaMargem(modelo, margemAlvo);
      if (receitaNecessaria.possivel) {
        reajusteMedioNecessario = receitaNecessaria.receitaNecessaria / receita - 1;
        cenariosRepasse = PERCENTUAIS_REPASSE.map((p) => {
          const c = calcularCenarioRepasse(p, receita, receitaNecessaria.receitaNecessaria, modelo);
          return { percentualRepasse: p, receita: c.receita, reajusteEquivalente: (c.receita / receita - 1) * 100, resultado: c.resultado, margem: c.margem, impactoReais: resultadoBase !== undefined ? c.resultado - resultadoBase : c.resultado };
        });
      } else {
        alertas.push(receitaNecessaria.motivo);
      }
    } else {
      alertas.push("Margem-alvo não determinável (sem margem do ano-base nem premissa explícita) — reajuste necessário não calculado.");
    }

    if (comparabilidade === "comparavel_com_ressalvas") alertas.push("Carga fiscal utilizada é comparável apenas com ressalvas (ver Comparador Consolidado) — resultado financeiro herda a mesma ressalva.");
    if (comparabilidade === "nao_comparavel" || comparabilidade === "indeterminado") alertas.push("Carga fiscal utilizada não é comparável/está indeterminada — este resultado financeiro NÃO deve ser lido como conclusão definitiva.");

    const qualidade = calcularQualidadeFinanceira(custosInfo.informado, comparabilidade);
    const achados = gerarAchadosFinanceiros(margem, erosaoMargemPp, impactoAnualReais, reajusteMedioNecessario);

    return {
      ano,
      regime: resultadoRegime.regime,
      disponivel: true,
      receita,
      custosDespesas,
      cargaFiscalUtilizada: cargaFiscal,
      resultado,
      margem,
      erosaoMargemPp,
      impactoAnualReais,
      impactoTributarioReais,
      reajusteMedioNecessario,
      cenariosRepasse,
      qualidade,
      comparabilidadeFiscal: comparabilidade,
      alertas,
      achados,
    };
  });

  const anosDisponiveis = anos.filter((a) => a.disponivel && a.impactoAnualReais !== undefined);
  const impactoAcumuladoParcial = anosDisponiveis.length < anos.length;
  const impactoAcumulado = anosDisponiveis.length > 0 ? anosDisponiveis.reduce((s, a) => s + (a.impactoAnualReais ?? 0), 0) : undefined;

  return { regime: resultadoRegime.regime, anoBase: ANO_BASE, anos, impactoAcumulado, impactoAcumuladoParcial, premissas };
}

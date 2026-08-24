import { adaptarClienteLegadoParaCenarioEmpresa } from "../../analiseEstrategica/adapters/legadoParaCenarioEmpresa";
import { executarAnaliseEstrategica } from "../../analiseEstrategica/motor";
import type { AnaliseEstrategicaCompleta } from "../../analiseEstrategica/tipos";
import type { ClienteData } from "../../../context/ClienteDataContext";
import type { SimulacaoInput } from "../../../engine/types";
import { criarRascunhoVazio } from "../../../features/wizardEstrategico/tipos";
import type { RascunhoCenarioEmpresa } from "../../../features/wizardEstrategico/tipos";
import { converterRascunhoParaCenario } from "../../../features/wizardEstrategico/validacao";
import { construirOpcoesExecucao } from "../../../features/wizardEstrategico/execucao";
import { campoComProveniencia as campo } from "../../../engine/operacaoTributaria";
import { motorLucroPresumido } from "../../../engine/motorRegimes/lucroPresumido/motor";
import { motorLucroReal } from "../../../engine/motorRegimes/lucroReal/motor";
import { motorSimplesUnificado } from "../../../engine/motorRegimes/simplesNacional/motor";

const MOTORES_TODOS = [motorLucroPresumido, motorLucroReal, motorSimplesUnificado];

export interface EntradaEquivalente {
  nomeEmpresa: string;
  faturamentoAnual: number;
  regimeAtual: SimulacaoInput["regimeAtual"];
  pisCofinsPercentualAtual: number;
  icmsIpiPercentualAtual: number;
  b2b: number;
  b2c: number;
  meioPagamentoPredominante: SimulacaoInput["meioPagamentoPredominante"];
}

/** Constrói o ClienteData legado com exatamente os mesmos dados econômicos que `rascunhoV2Equivalente` recebe — base para os casos de equivalência. */
export function clienteLegadoEquivalente(entrada: EntradaEquivalente): ClienteData {
  const simulacaoInput: SimulacaoInput = {
    nomeEmpresa: entrada.nomeEmpresa,
    regimeAtual: entrada.regimeAtual,
    faturamentoAnual: entrada.faturamentoAnual,
    pisCofinsPercentualAtual: entrada.pisCofinsPercentualAtual,
    icmsIpiPercentualAtual: entrada.icmsIpiPercentualAtual,
    percentualCustosCreditaveis: 0.3,
    perfilClientes: { percentualClienteContribuinte: entrada.b2b, percentualClienteNaoContribuinte: entrada.b2c },
    meioPagamentoPredominante: entrada.meioPagamentoPredominante,
  };
  return {
    nomeEmpresa: entrada.nomeEmpresa,
    dados: {} as never,
    resultadoSimulacao: { input: simulacaoInput, anos: [], recomendacao: "", avisos: [] },
    panorama: null,
  };
}

/** Rascunho V2 com exatamente os mesmos dados econômicos — sem custos/créditos/FS12/split, para que a comparação seja sobre entrada equivalente, não sobre cobertura superior. */
export function rascunhoV2Equivalente(entrada: EntradaEquivalente, regimesSelecionados: SimulacaoInput["regimeAtual"][] = [entrada.regimeAtual]): RascunhoCenarioEmpresa {
  const rascunho = criarRascunhoVazio(`v2:${entrada.nomeEmpresa}`);
  rascunho.identificacao.nomeEmpresa = campo(entrada.nomeEmpresa, "informado_usuario", "confirmado");
  rascunho.receita.faturamentoAnual = campo(entrada.faturamentoAnual, "informado_usuario", "confirmado");
  rascunho.receita.mixMercado = { b2b: campo(entrada.b2b, "informado_usuario", "confirmado"), b2c: campo(entrada.b2c, "informado_usuario", "confirmado") };
  rascunho.tributario.regimeAtual = campo(entrada.regimeAtual, "informado_usuario", "confirmado");
  rascunho.tributario.premissas = {
    pisCofinsPercentualAtual: campo(entrada.pisCofinsPercentualAtual, "informado_usuario", "confirmado"),
    icmsIpiPercentualAtual: campo(entrada.icmsIpiPercentualAtual, "informado_usuario", "confirmado"),
  };
  rascunho.economicoFinanceiro.meioPagamentoPredominante = campo(entrada.meioPagamentoPredominante, "informado_usuario", "confirmado");
  rascunho.regimesSelecionados = regimesSelecionados as never;
  return rascunho;
}

export function executarFluxoLegado(entrada: EntradaEquivalente): AnaliseEstrategicaCompleta {
  const cliente = clienteLegadoEquivalente(entrada);
  const adaptado = adaptarClienteLegadoParaCenarioEmpresa(cliente)!;
  return executarAnaliseEstrategica(adaptado.cenario, { motoresRegime: MOTORES_TODOS, incluirHorizonte: false });
}

export function executarFluxoV2(rascunho: RascunhoCenarioEmpresa): AnaliseEstrategicaCompleta {
  const { cenario } = converterRascunhoParaCenario(rascunho);
  return executarAnaliseEstrategica(cenario, construirOpcoesExecucao(rascunho));
}

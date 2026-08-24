import { describe, it, expect } from "vitest";
import { executarCenario } from "../motor";
import { compararCenarios } from "../comparacao";
import { motorLucroPresumido } from "../../motorRegimes/lucroPresumido/motor";
import { motorSimplesUnificado } from "../../motorRegimes/simplesNacional/motor";
import { campoComProveniencia as campo } from "../../operacaoTributaria";
import type { CenarioEmpresa } from "../../cenarioEmpresa";
import { ANOS_SIMULACAO } from "../../parametros";

function cenario(): CenarioEmpresa {
  return {
    id: "c",
    identificacao: { nomeEmpresa: campo("Empresa", "informado_usuario", "confirmado"), atividadePrincipal: { perfilId: "varejo_generico", status: "confirmado", origem: "informado_usuario" } },
    receita: { faturamentoAnual: campo(2_000_000, "informado_usuario", "confirmado"), crescimentoAnualEstimado: campo(0.03, "informado_usuario", "estimado"), mixMercado: { b2b: campo(0.7, "informado_usuario", "confirmado"), b2c: campo(0.3, "informado_usuario", "confirmado") } },
    custos: { itens: [] },
    pessoas: {},
    tributario: { regimeAtual: campo("lucro_presumido", "informado_usuario", "confirmado"), premissas: { pisCofinsPercentualAtual: campo(0.0365, "informado_usuario", "confirmado"), icmsIpiPercentualAtual: campo(0.05, "informado_usuario", "confirmado") } },
    economicoFinanceiro: { lucroAtual: campo(400_000, "informado_usuario", "confirmado"), meioPagamentoPredominante: campo("pix", "informado_usuario", "confirmado") },
    dadosSetoriais: [],
  };
}

describe("compararCenarios — diferença absoluta e relativa nunca misturadas (seção 17-19)", () => {
  it("carga 15% baseline vs 13% cenário produz diferença absoluta em R$ e relativa em % SEPARADAS", () => {
    const base = cenario();
    const resultadoBase = executarCenario(base, [motorLucroPresumido]);
    const resultadoCenario = executarCenario(base, [motorLucroPresumido], { receita: { faturamentoAnual: { tipo: "incremento_percentual", valor: -0.1, origem: "informado_usuario", status: "estimado" } } });

    const diff = compararCenarios(resultadoBase, resultadoCenario, "lucro_presumido", ANOS_SIMULACAO[0]);
    expect(diff.fiscal).toBeDefined();
    expect(diff.fiscal!.diferencaReais).toBeCloseTo(diff.fiscal!.cargaReaisCenario - diff.fiscal!.cargaReaisBase);
    expect(diff.fiscal!.diferencaPercentualRelativa).toBeCloseTo((diff.fiscal!.diferencaReais / diff.fiscal!.cargaReaisBase) * 100);
    // As duas grandezas nunca podem ser a mesma coisa (uma é R$, outra é %).
    expect(diff.fiscal!.diferencaReais).not.toBe(diff.fiscal!.diferencaPercentualRelativa);
  });

  it("dimensão de caixa ausente em um dos dois lados nunca é comparada como zero — fica undefined com alerta", () => {
    const base = cenario();
    const resultadoBase = executarCenario(base, [motorLucroPresumido]);
    const resultadoComCaixa = executarCenario(base, [motorLucroPresumido], {
      splitPayment: { percentualRecebimentosSujeitos: { tipo: "set", valor: 1, origem: "informado_usuario", status: "estimado" }, percentualTributoSegregado: { tipo: "set", valor: 0.1, origem: "informado_usuario", status: "estimado" } },
    });
    const diff = compararCenarios(resultadoBase, resultadoComCaixa, "lucro_presumido", ANOS_SIMULACAO[0]);
    expect(diff.caixa).toBeUndefined();
    expect(diff.alertas.some((a) => a.includes("Caixa"))).toBe(true);
  });
});

describe("Comparação multi-ano — cenários que trocam de posição ao longo do horizonte (seção 36/63)", () => {
  it("preserva a diferença por ano, sem achatar em um único número", () => {
    const base = cenario();
    const resultadoBase = executarCenario(base, [motorLucroPresumido, motorSimplesUnificado]);
    const resultadoCenario = executarCenario(base, [motorLucroPresumido, motorSimplesUnificado], { receita: { crescimentoAnualEstimado: { tipo: "set", valor: 0.15, origem: "informado_usuario", status: "estimado" } } });

    const diffsPorAno = ANOS_SIMULACAO.map((ano) => compararCenarios(resultadoBase, resultadoCenario, "simples_unificado", ano));
    const diferencasReais = diffsPorAno.map((d) => d.fiscal?.diferencaReais);
    // Como o crescimento composto ao longo dos anos, a diferença em R$ não é constante — cada ano preserva seu próprio valor.
    expect(new Set(diferencasReais.filter((d): d is number => d !== undefined)).size).toBeGreaterThan(1);
  });
});

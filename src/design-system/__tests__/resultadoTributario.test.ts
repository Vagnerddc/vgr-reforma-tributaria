import { describe, it, expect } from "vitest";
import { simular } from "../../engine/calculo";
import type { SimulacaoInput } from "../../engine/types";
import { comparativoDoResultado } from "../resultadoTributario";

const input: SimulacaoInput = {
  nomeEmpresa: "Regressão Design System Ltda",
  regimeAtual: "lucro_real",
  faturamentoAnual: 2_000_000,
  pisCofinsPercentualAtual: 0.0365,
  icmsIpiPercentualAtual: 0.04,
  percentualCustosCreditaveis: 0.3,
  perfilClientes: { percentualClienteContribuinte: 0.6, percentualClienteNaoContribuinte: 0.4 },
  meioPagamentoPredominante: "pix",
};

describe("comparativoDoResultado — regressão: a apresentação nunca altera o resultado do engine", () => {
  it("deltaRelativoPercentual e economiaReais são exatamente os do engine (sinal invertido), nunca recalculados de outra forma", () => {
    const resultado = simular(input);
    const anoPleno = resultado.anos[resultado.anos.length - 1];
    const { comparativo } = comparativoDoResultado(resultado, input.faturamentoAnual);

    expect(comparativo.deltaRelativoPercentual).toBeCloseTo(-anoPleno.deltaCargaPercentual * 100, 6);
    expect(comparativo.economiaReais).toBeCloseTo(-anoPleno.deltaCargaReais, 2);
  });

  it("mesmos dados de entrada produzem sempre o mesmo comparativo (determinístico, sem estado escondido)", () => {
    const resultado = simular(input);
    const a = comparativoDoResultado(resultado, input.faturamentoAnual).comparativo;
    const b = comparativoDoResultado(resultado, input.faturamentoAnual).comparativo;
    expect(a).toEqual(b);
  });

  it("a % de carga recuperada algebricamente (débito bruto ÷ alíquota total) reproduz o faturamento real do ano informado", () => {
    const resultado = simular(input);
    const anoAtual = resultado.anos[0];
    // faturamento do ano-teste (2026) não cresce ainda — deve ser igual ao informado
    expect(anoAtual.debitoBruto / anoAtual.aliquotaTotal).toBeCloseTo(input.faturamentoAnual, 0);
  });

  it("p.p. de redução nunca é apresentado como se fosse a redução relativa (regressão do requisito do protótipo aprovado)", () => {
    const resultado = simular(input);
    const { comparativo } = comparativoDoResultado(resultado, input.faturamentoAnual);
    if (Math.abs(comparativo.deltaPontosPercentuais) > 0.5) {
      expect(comparativo.deltaPontosPercentuais).not.toBeCloseTo(comparativo.deltaRelativoPercentual, 0);
    }
  });
});

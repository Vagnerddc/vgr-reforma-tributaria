import { describe, it, expect } from "vitest";
import { calcularMesImpactoCaixa } from "../fluxo";

describe("calcularMesImpactoCaixa — matemática básica", () => {
  it("recebimento R$100.000, 100% sujeito, 10% segregado sobre a parcela → segregado R$10.000, líquido R$90.000", () => {
    const r = calcularMesImpactoCaixa({ mes: 1, receita: 100_000, percentualRecebimentosSujeitos: 1, percentualTributoSegregado: 0.1 });
    expect(r.valorSegregado).toBe(10_000);
    expect(r.caixaLiquido).toBe(90_000);
    expect(r.reducaoDisponibilidadeCaixa).toBe(10_000);
  });

  it("percentual parcial: 80% sujeitos × 10% de segregação sobre a parcela sujeita", () => {
    const r = calcularMesImpactoCaixa({ mes: 1, receita: 100_000, percentualRecebimentosSujeitos: 0.8, percentualTributoSegregado: 0.1 });
    // parcela sujeita = 80.000; segregado = 10% de 80.000 = 8.000
    expect(r.valorSegregado).toBeCloseTo(8_000);
    expect(r.caixaLiquido).toBeCloseTo(92_000);
  });

  it("custo de capital: R$100.000 de necessidade × 1% a.m. = R$1.000", () => {
    const r = calcularMesImpactoCaixa({ mes: 1, receita: 1_000_000, percentualRecebimentosSujeitos: 1, percentualTributoSegregado: 0.1, taxaCustoCapitalMensal: 0.01 });
    expect(r.necessidadeCapitalGiro).toBeCloseTo(100_000);
    expect(r.custoFinanceiro).toBeCloseTo(1_000);
  });

  it("sem taxa de custo de capital informada: custoFinanceiro indeterminado (undefined), mas capital de giro continua calculado", () => {
    const r = calcularMesImpactoCaixa({ mes: 1, receita: 100_000, percentualRecebimentosSujeitos: 1, percentualTributoSegregado: 0.1 });
    expect(r.custoFinanceiro).toBeUndefined();
    expect(r.necessidadeCapitalGiro).toBe(10_000);
  });

  it("premissa incompleta (percentual sujeito ausente): resultado mensal fica indeterminado, nunca inventado", () => {
    const r = calcularMesImpactoCaixa({ mes: 1, receita: 100_000, percentualTributoSegregado: 0.1 });
    expect(r.valorSegregado).toBeUndefined();
    expect(r.caixaLiquido).toBeUndefined();
    expect(r.caixaDisponivelAntesTributo).toBe(100_000);
  });

  it("saldo mínimo de caixa: financiamento adicional necessário quando o líquido cai abaixo do mínimo", () => {
    const r = calcularMesImpactoCaixa({ mes: 1, receita: 100_000, percentualRecebimentosSujeitos: 1, percentualTributoSegregado: 0.5, caixaMinimoOperacional: 60_000 });
    // líquido = 50.000, mínimo = 60.000 → financiamento adicional = 10.000
    expect(r.caixaLiquido).toBe(50_000);
    expect(r.financiamentoAdicionalNecessario).toBe(10_000);
  });

  it("sem risco de caixa mínimo: financiamentoAdicionalNecessario fica undefined, nunca 0 forçado", () => {
    const r = calcularMesImpactoCaixa({ mes: 1, receita: 100_000, percentualRecebimentosSujeitos: 1, percentualTributoSegregado: 0.1, caixaMinimoOperacional: 10_000 });
    expect(r.financiamentoAdicionalNecessario).toBeUndefined();
  });
});

import { describe, it, expect } from "vitest";
import { agregarCreditoPorSistema, fracaoCreditavel, type CategoriaGasto, type TratamentoTributarioCategoria } from "../creditoTributario";

function tratamento(overrides: Partial<TratamentoTributarioCategoria>): TratamentoTributarioCategoria {
  return { tratamento: "creditavel", status: "confirmado", ...overrides };
}

function categoria(chave: string, overrides: Partial<CategoriaGasto> = {}): CategoriaGasto {
  return {
    chave,
    label: chave,
    naturezaEconomica: "custo_direto",
    creditoPisCofins: tratamento({}),
    creditoIcmsIpi: tratamento({}),
    creditoIbsCbs: tratamento({}),
    ...overrides,
  };
}

describe("fracaoCreditavel", () => {
  it("creditavel = 100%, nao_creditavel = 0%", () => {
    expect(fracaoCreditavel(tratamento({ tratamento: "creditavel" }))).toBe(1);
    expect(fracaoCreditavel(tratamento({ tratamento: "nao_creditavel" }))).toBe(0);
  });

  it("parcial usa percentualCredito, e assume 0 se ausente (nunca otimista por omissão)", () => {
    expect(fracaoCreditavel(tratamento({ tratamento: "parcial", percentualCredito: 0.6 }))).toBe(0.6);
    expect(fracaoCreditavel(tratamento({ tratamento: "parcial" }))).toBe(0);
  });

  it("indeterminado só credita a premissa explícita — nunca assume 100% nem 0% silenciosamente", () => {
    expect(fracaoCreditavel(tratamento({ tratamento: "indeterminado", percentualPremissaCalculo: 0.5 }))).toBe(0.5);
    expect(fracaoCreditavel(tratamento({ tratamento: "indeterminado" }))).toBe(0);
  });
});

describe("agregarCreditoPorSistema", () => {
  it("separa creditável, não-creditável, indeterminado e a parcela sob premissa — exemplo da proposta aprovada", () => {
    const faturamento = 1_000_000;
    const gastos = [
      { categoria: categoria("direto", { creditoIbsCbs: tratamento({ tratamento: "creditavel" }) }), valorAnual: 420_000 },
      { categoria: categoria("folha", { creditoIbsCbs: tratamento({ tratamento: "nao_creditavel" }) }), valorAnual: 180_000 },
      {
        categoria: categoria("administrativo_indeterminado", {
          creditoIbsCbs: tratamento({ tratamento: "indeterminado", percentualPremissaCalculo: 1, status: "herdado" }),
        }),
        valorAnual: 120_000,
      },
    ];

    const resultado = agregarCreditoPorSistema(gastos, "ibsCbs", faturamento);

    // 420k creditável + 120k sob premissa (100% da indeterminada) = 540k / 1M
    expect(resultado.percentualCreditavel).toBeCloseTo(0.54, 5);
    expect(resultado.percentualNaoCreditavel).toBeCloseTo(0.18, 5);
    expect(resultado.percentualIndeterminado).toBeCloseTo(0.12, 5);
    expect(resultado.percentualSobPremissa).toBeCloseTo(0.12, 5);
  });

  it("categoria 'parcial' soma a fração creditável em percentualCreditavel e o resto em percentualNaoCreditavel", () => {
    const gastos = [{ categoria: categoria("misto", { creditoIbsCbs: tratamento({ tratamento: "parcial", percentualCredito: 0.6 }) }), valorAnual: 100_000 }];
    const resultado = agregarCreditoPorSistema(gastos, "ibsCbs", 1_000_000);
    expect(resultado.percentualCreditavel).toBeCloseTo(0.06, 5);
    expect(resultado.percentualNaoCreditavel).toBeCloseTo(0.04, 5);
  });

  it("indeterminado sem premissa explícita não credita nada (conservador por padrão)", () => {
    const gastos = [{ categoria: categoria("sem_premissa", { creditoIbsCbs: tratamento({ tratamento: "indeterminado" }) }), valorAnual: 200_000 }];
    const resultado = agregarCreditoPorSistema(gastos, "ibsCbs", 1_000_000);
    expect(resultado.percentualCreditavel).toBe(0);
    expect(resultado.percentualIndeterminado).toBeCloseTo(0.2, 5);
    expect(resultado.percentualSobPremissa).toBe(0);
  });

  it("cada sistema tributário (pisCofins/icmsIpi/ibsCbs) pode ter tratamento diferente para a MESMA categoria", () => {
    const cat = categoria("misto_por_sistema", {
      creditoPisCofins: tratamento({ tratamento: "creditavel" }),
      creditoIcmsIpi: tratamento({ tratamento: "nao_creditavel" }),
      creditoIbsCbs: tratamento({ tratamento: "indeterminado", percentualPremissaCalculo: 0.5 }),
    });
    const gastos = [{ categoria: cat, valorAnual: 100_000 }];
    const faturamento = 1_000_000;
    expect(agregarCreditoPorSistema(gastos, "pisCofins", faturamento).percentualCreditavel).toBeCloseTo(0.1, 5);
    expect(agregarCreditoPorSistema(gastos, "icmsIpi", faturamento).percentualCreditavel).toBe(0);
    expect(agregarCreditoPorSistema(gastos, "ibsCbs", faturamento).percentualCreditavel).toBeCloseTo(0.05, 5);
  });

  it("faturamento zero não gera NaN/Infinity", () => {
    const resultado = agregarCreditoPorSistema([{ categoria: categoria("x"), valorAnual: 1000 }], "ibsCbs", 0);
    expect(resultado).toEqual({ percentualCreditavel: 0, percentualNaoCreditavel: 0, percentualIndeterminado: 0, percentualSobPremissa: 0 });
  });
});

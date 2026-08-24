import { describe, it, expect } from "vitest";
import { construirCaixaExecutivoViewModel } from "../viewModels/caixa";
import type { ResultadoImpactoCaixa } from "../../engine/motorFinanceiro/splitPayment/tipos";
import { campoComProveniencia as campo } from "../../engine/operacaoTributaria";

function caixaBase(overrides: Partial<ResultadoImpactoCaixa> = {}): ResultadoImpactoCaixa {
  return {
    regime: "lucro_presumido",
    ano: 2027,
    disponivel: true,
    meses: [],
    valorTotalSegregado: 320_000,
    capitalGiroAdicionalMedio: 26_666,
    picoCapitalGiroAdicional: 180_000,
    mesPicoCapitalGiro: 3,
    custoFinanceiroAnual: 21_600,
    qualidade: "media",
    estimativaCondicionada: true,
    premissas: { percentualRecebimentosSujeitos: campo(1, "informado_usuario", "estimado"), percentualTributoSegregado: campo(0.3, "informado_usuario", "estimado"), taxaCustoCapitalMensal: campo(0.011, "informado_usuario", "estimado") },
    alertas: [],
    achados: [],
    ...overrides,
  };
}

describe("50 — Caixa disponível chega corretamente ao ViewModel", () => {
  it("redução de disponibilidade, capital adicional e custo financeiro presentes", () => {
    const vm = construirCaixaExecutivoViewModel(caixaBase());
    expect(vm.status).toBe("disponivel");
    expect(vm.reducaoDisponibilidade).toEqual({ disponivel: true, valor: 320_000 });
    expect(vm.capitalGiroAdicional).toEqual({ disponivel: true, valor: 26_666 });
    expect(vm.picoCapitalGiro).toEqual({ disponivel: true, valor: 180_000 });
    expect(vm.periodoPico).toBe(3);
    expect(vm.custoFinanceiro).toEqual({ disponivel: true, valor: 21_600 });
  });

  it("redução de disponibilidade nunca é rotulada como 'perda' nem capital de giro como 'tributo' (contrato)", () => {
    const vm = construirCaixaExecutivoViewModel(caixaBase());
    expect(vm).toHaveProperty("reducaoDisponibilidade");
    expect(vm).toHaveProperty("capitalGiroAdicional");
    expect(vm).not.toHaveProperty("perda");
    expect(vm).not.toHaveProperty("novoTributo");
  });
});

describe("51 — Caixa indisponível nunca vira zero", () => {
  it("sem ResultadoImpactoCaixa (sem premissa de split), status indisponivel e nenhuma métrica com valor", () => {
    const vm = construirCaixaExecutivoViewModel(undefined, "Premissas de split payment não informadas.");
    expect(vm.status).toBe("indisponivel");
    expect(vm.reducaoDisponibilidade.disponivel).toBe(false);
    expect(vm.reducaoDisponibilidade.valor).toBeUndefined();
    expect(vm.capitalGiroAdicional.valor).toBeUndefined();
    expect(vm.picoCapitalGiro.valor).toBeUndefined();
    expect(vm.custoFinanceiro.valor).toBeUndefined();
  });

  it("ano indisponível no domínio (disponivel: false) também produz status indisponivel, nunca zero", () => {
    const vm = construirCaixaExecutivoViewModel(caixaBase({ disponivel: false, valorTotalSegregado: undefined, alertas: ["Ano indisponível."] }));
    expect(vm.status).toBe("indisponivel");
    expect(vm.reducaoDisponibilidade.valor).toBeUndefined();
  });
});

describe("52 — custo financeiro indisponível produz status parcial", () => {
  it("capital calculado, taxa ausente => parcial, custoFinanceiro.disponivel = false com motivo", () => {
    const vm = construirCaixaExecutivoViewModel(caixaBase({ custoFinanceiroAnual: undefined }));
    expect(vm.status).toBe("parcial");
    expect(vm.custoFinanceiro.disponivel).toBe(false);
    expect(vm.custoFinanceiro.motivo).toContain("capital");
    expect(vm.picoCapitalGiro.disponivel).toBe(true);
  });
});

describe("8 — premissas materiais de caixa ficam visíveis", () => {
  it("premissas com valor formatado aparecem na lista, nunca escondidas", () => {
    const vm = construirCaixaExecutivoViewModel(caixaBase());
    expect(vm.premissas.length).toBeGreaterThan(0);
    expect(vm.premissas.every((p) => p.informada)).toBe(true);
    expect(vm.premissas.some((p) => p.descricao.includes("1.10") || p.descricao.includes("1,10"))).toBe(true);
  });

  it("premissa não informada aparece marcada como tal, nunca omitida", () => {
    const vm = construirCaixaExecutivoViewModel(caixaBase({ premissas: { percentualRecebimentosSujeitos: campo(1, "informado_usuario", "estimado"), percentualTributoSegregado: campo(0.3, "informado_usuario", "estimado") }, custoFinanceiroAnual: undefined }));
    const custoCapital = vm.premissas.find((p) => p.descricao.startsWith("Custo de capital"));
    expect(custoCapital?.informada).toBe(false);
  });
});

describe("qualidade herdada, nunca promovida", () => {
  it("qualidade do ViewModel é idêntica à do domínio", () => {
    const vm = construirCaixaExecutivoViewModel(caixaBase({ qualidade: "parcial" }));
    expect(vm.qualidade).toBe("parcial");
  });
});

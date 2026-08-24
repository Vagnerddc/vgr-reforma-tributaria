import { describe, it, expect } from "vitest";
import { compararCargaTributaria, formatarPercentualPt } from "../TaxStat";

describe("compararCargaTributaria", () => {
  it("reproduz exatamente o exemplo do protótipo aprovado: 18,7% → 15,4% = 3,3 p.p. (não 3,3%) e 17,6% de redução relativa", () => {
    const faturamento = 10_000_000;
    const resultado = compararCargaTributaria(0.187, 0.154, faturamento);

    expect(resultado.deltaPontosPercentuais).toBeCloseTo(3.3, 5);
    expect(resultado.deltaRelativoPercentual).toBeCloseTo(17.6, 1);
    expect(resultado.economiaReais).toBeCloseTo(330_000, 2);
  });

  it("p.p. e redução relativa NUNCA são o mesmo número quando a carga atual não é 100% — não confundir os dois", () => {
    const resultado = compararCargaTributaria(0.187, 0.154, 10_000_000);
    expect(resultado.deltaPontosPercentuais).not.toBeCloseTo(resultado.deltaRelativoPercentual, 1);
  });

  it("quando a carga atual é zero, a redução relativa é definida como zero (evita divisão por zero) em vez de NaN/Infinity", () => {
    const resultado = compararCargaTributaria(0, 0.05, 1_000_000);
    expect(Number.isFinite(resultado.deltaRelativoPercentual)).toBe(true);
    expect(resultado.deltaRelativoPercentual).toBe(0);
  });

  it("faturamento projetado diferente do atual é usado corretamente na economia em R$", () => {
    const resultado = compararCargaTributaria(0.2, 0.1, 1_000_000, 1_200_000);
    // 0.2*1_000_000 - 0.1*1_200_000 = 200_000 - 120_000 = 80_000
    expect(resultado.economiaReais).toBeCloseTo(80_000, 2);
  });
});

describe("formatarPercentualPt", () => {
  it("nunca formata p.p. e % relativo da mesma forma implícita — o chamador precisa anexar o sufixo certo", () => {
    expect(formatarPercentualPt(3.3)).toBe("3,3%");
    expect(formatarPercentualPt(17.6)).toBe("17,6%");
  });
});

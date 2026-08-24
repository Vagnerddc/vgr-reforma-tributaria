import { describe, it, expect } from "vitest";
import { calcularIrpjCsllAnual } from "../irpjCsll";

describe("calcularIrpjCsllAnual — casos conferíveis manualmente", () => {
  it("comércio, R$ 1.200.000/ano, sem adicional: IRPJ e CSLL calculados por trimestre e somados", () => {
    // Receita trimestral: 300.000. Base IRPJ: 300.000 × 8% = 24.000 (< 60.000, sem adicional).
    // IRPJ trimestral: 24.000 × 15% = 3.600 → anual: 14.400.
    // Base CSLL: 300.000 × 12% = 36.000. CSLL trimestral: 36.000 × 9% = 3.240 → anual: 12.960.
    const r = calcularIrpjCsllAnual(1_200_000, "comercio_industria_transporte_cargas");
    const irpj = r.componentes.find((c) => c.componente === "irpj")!;
    const csll = r.componentes.find((c) => c.componente === "csll")!;
    expect(irpj.valor).toBeCloseTo(14_400, 2);
    expect(irpj.base).toBeCloseTo(96_000, 2); // 24.000 × 4
    expect(csll.valor).toBeCloseTo(12_960, 2);
    expect(r.componentes.find((c) => c.componente === "adicional_irpj")).toBeUndefined(); // nunca aparece um componente de valor zero
  });

  it("comércio, R$ 4.000.000/ano: dispara o adicional de IRPJ (teste de fronteira — acima de R$ 60.000 de base trimestral)", () => {
    // Receita trimestral: 1.000.000. Base IRPJ: 1.000.000 × 8% = 80.000 (> 60.000).
    // Excedente: 20.000 × 4 trimestres = 80.000. Adicional: 80.000 × 10% = 8.000.
    // IRPJ principal: 80.000 × 15% × 4 = 48.000.
    const r = calcularIrpjCsllAnual(4_000_000, "comercio_industria_transporte_cargas");
    const irpj = r.componentes.find((c) => c.componente === "irpj")!;
    const adicional = r.componentes.find((c) => c.componente === "adicional_irpj")!;
    expect(irpj.valor).toBeCloseTo(48_000, 2);
    expect(adicional.valor).toBeCloseTo(8_000, 2);
    expect(adicional.base).toBeCloseTo(80_000, 2);
  });

  it("serviço (32%) dispara o adicional com receita bem menor que comércio — a base de presunção mais alta muda o ponto de fronteira", () => {
    // Receita trimestral: 200.000. Base IRPJ: 200.000 × 32% = 64.000 (> 60.000).
    // Excedente trimestral: 4.000 × 4 = 16.000. Adicional: 16.000 × 10% = 1.600.
    const r = calcularIrpjCsllAnual(800_000, "prestacao_servicos_geral");
    const adicional = r.componentes.find((c) => c.componente === "adicional_irpj")!;
    expect(adicional.valor).toBeCloseTo(1_600, 2);
  });

  it("exatamente no limite trimestral (base = R$ 60.000,00) não gera adicional (teste de fronteira: 'exceder', não 'atingir')", () => {
    // Receita anual tal que a base trimestral IRPJ seja EXATAMENTE 60.000: receita trimestral = 60.000/0.08 = 750.000 → anual 3.000.000.
    const r = calcularIrpjCsllAnual(3_000_000, "comercio_industria_transporte_cargas");
    expect(r.componentes.find((c) => c.componente === "adicional_irpj")).toBeUndefined();
  });

  it("R$ 1,00 acima do limite trimestral já gera adicional (teste de fronteira)", () => {
    // Base trimestral 60.000 + um pouco: receita trimestral = 750.012,5 → anual ~3.000.050.
    const r = calcularIrpjCsllAnual(3_000_050, "comercio_industria_transporte_cargas");
    const adicional = r.componentes.find((c) => c.componente === "adicional_irpj");
    expect(adicional).toBeDefined();
    expect(adicional!.valor).toBeGreaterThan(0);
  });

  it("transporte de passageiros usa 16% de presunção de IRPJ, diferente de cargas (8%) — mesma receita, resultado diferente", () => {
    const cargas = calcularIrpjCsllAnual(1_000_000, "comercio_industria_transporte_cargas");
    const passageiros = calcularIrpjCsllAnual(1_000_000, "transporte_passageiros");
    const irpjCargas = cargas.componentes.find((c) => c.componente === "irpj")!.valor;
    const irpjPassageiros = passageiros.componentes.find((c) => c.componente === "irpj")!.valor;
    expect(irpjPassageiros).toBeGreaterThan(irpjCargas * 1.9); // ~2x, já que a base dobra (16% vs 8%)
  });

  it("todo componente carrega fundamento legal e status — nunca só o valor final", () => {
    const r = calcularIrpjCsllAnual(500_000, "prestacao_servicos_geral");
    for (const c of r.componentes) {
      expect(c.fundamentoLegal).toBeTruthy();
      expect(c.status).toBe("estimado");
      expect(c.memoriaCalculo).toBeTruthy();
    }
  });
});

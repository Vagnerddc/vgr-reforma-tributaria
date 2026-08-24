import { describe, it, expect } from "vitest";
import { calcularIrpjCsllAnual } from "../irpjCsll";

describe("calcularIrpjCsllAnual — apuração trimestral real, conferível manualmente", () => {
  it("sem prejuízo, sem adicional: lucro líquido ajustado anual 200.000 (50.000/trimestre) — abaixo do limite do adicional", () => {
    const r = calcularIrpjCsllAnual(200_000, 200_000, 0, 0);
    // Base trimestral = 50.000 (< 60.000, sem adicional). IRPJ trimestral = 50.000×15%=7.500 → anual 30.000.
    // CSLL trimestral = 50.000×9%=4.500 → anual 18.000.
    const irpj = r.componentes.find((c) => c.componente === "irpj")!;
    const csll = r.componentes.find((c) => c.componente === "csll")!;
    expect(irpj.valor).toBeCloseTo(30_000, 2);
    expect(csll.valor).toBeCloseTo(18_000, 2);
    expect(r.componentes.find((c) => c.componente === "adicional_irpj")).toBeUndefined();
  });

  it("dispara o adicional quando a base trimestral (já sem prejuízo a compensar) excede R$ 60.000", () => {
    // Lucro líquido ajustado anual 400.000 → trimestral 100.000. Sem saldo de prejuízo, base = 100.000.
    // Excedente trimestral: 40.000 × 4 = 160.000. Adicional: 160.000 × 10% = 16.000.
    const r = calcularIrpjCsllAnual(400_000, 400_000, 0, 0);
    const adicional = r.componentes.find((c) => c.componente === "adicional_irpj")!;
    expect(adicional.valor).toBeCloseTo(16_000, 2);
  });

  it("com saldo de prejuízo suficiente: a compensação reduz a base ANTES do cálculo do adicional — pode até eliminar o adicional", () => {
    // Sem compensação, base trimestral seria 100.000 (gera adicional). Com saldo de prejuízo alto,
    // a trava de 30% permite abater até 30.000/trimestre → base final 70.000/trimestre (ainda > 60.000, adicional menor).
    const semPrejuizo = calcularIrpjCsllAnual(400_000, 400_000, 0, 0);
    const comPrejuizo = calcularIrpjCsllAnual(400_000, 400_000, 1_000_000, 1_000_000); // saldo bem maior que o limite de 30%
    const irpjSem = semPrejuizo.componentes.find((c) => c.componente === "irpj")!.valor;
    const irpjCom = comPrejuizo.componentes.find((c) => c.componente === "irpj")!.valor;
    expect(irpjCom).toBeLessThan(irpjSem);
  });

  it("saldo de prejuízo final é reportado corretamente para transporte ao próximo ano", () => {
    // Lucro líquido ajustado anual 0 (sem lucro) com saldo de prejuízo anterior de 50.000 — nada é compensado
    // (base <= 0 em todos os trimestres), saldo permanece intacto.
    const r = calcularIrpjCsllAnual(0, 0, 50_000, 50_000);
    expect(r.saldoPrejuizoIrpjFinal).toBe(50_000);
    expect(r.saldoBaseNegativaCsllFinal).toBe(50_000);
  });

  it("bases de IRPJ e CSLL podem gerar valores diferentes mesmo com a mesma alíquota nominal aplicada sobre bases distintas", () => {
    const r = calcularIrpjCsllAnual(400_000, 200_000, 0, 0); // bases anuais diferentes
    const irpj = r.componentes.find((c) => c.componente === "irpj")!;
    const csll = r.componentes.find((c) => c.componente === "csll")!;
    expect(irpj.base).not.toBeCloseTo(csll.base!, 0);
  });
});

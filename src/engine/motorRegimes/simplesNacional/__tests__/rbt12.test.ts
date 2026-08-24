import { describe, it, expect } from "vitest";
import { calcularRbt12MensalDoAno } from "../rbt12";

describe("calcularRbt12MensalDoAno — nunca confunde RBT12 com faturamento anual projetado", () => {
  it("empresa com histórico completo (ano anterior conhecido) e SEM crescimento: RBT12 constante = receita anual", () => {
    const meses = calcularRbt12MensalDoAno(1_200_000, 1_200_000, undefined, 2027);
    expect(meses).toHaveLength(12);
    expect(meses.every((m) => Math.abs(m.rbt12 - 1_200_000) < 0.01)).toBe(true);
    expect(meses.every((m) => m.status === "estimado")).toBe(true); // nunca "confirmado" — é sempre premissa sobre dado anual
  });

  it("empresa com crescimento entre o ano anterior e o atual: RBT12 sobe gradualmente mês a mês (rolagem real, não escalão único)", () => {
    const meses = calcularRbt12MensalDoAno(2_400_000, 1_200_000, undefined, 2027);
    // mês 1: praticamente todo o RBT12 vem do ano anterior (mensal menor); mês 12: já é 100% do ano atual.
    expect(meses[0].rbt12).toBeCloseTo(11 * (1_200_000 / 12) + 1 * (2_400_000 / 12), 2);
    expect(meses[11].rbt12).toBeCloseTo(2_400_000, 2);
    // estritamente crescente mês a mês, nunca um "salto" único de ano para ano
    for (let i = 1; i < 12; i++) expect(meses[i].rbt12).toBeGreaterThan(meses[i - 1].rbt12);
  });

  it("sem dado do ano anterior (primeiro ano simulado): RBT12 aproximada pela receita do próprio ano, sinalizada explicitamente na metodologia", () => {
    const meses = calcularRbt12MensalDoAno(1_000_000, undefined, undefined, 2026);
    expect(meses.every((m) => Math.abs(m.rbt12 - 1_000_000) < 0.01)).toBe(true);
    expect(meses[0].metodologia).toContain("Sem receita do ano anterior");
  });

  it("início de atividade no meio do ano: RBT12 proporcionalizada, e meses antes da abertura não existem", () => {
    // Empresa abriu em julho/2027 (mês 7) — só existem 6 meses de atividade nesse ano (jul-dez).
    // Receita do ano parcial: R$ 600.000 → RBT12 proporcional = (600.000 ÷ 6) × 12 = 1.200.000.
    const meses = calcularRbt12MensalDoAno(600_000, undefined, "2027-07-15", 2027);
    expect(meses).toHaveLength(6); // só jul a dez
    expect(meses.map((m) => m.mes)).toEqual([7, 8, 9, 10, 11, 12]);
    expect(meses.every((m) => Math.abs(m.rbt12 - 1_200_000) < 0.01)).toBe(true);
    expect(meses[0].metodologia).toContain("Início de atividade");
  });

  it("início de atividade no primeiro mês do ano (janeiro): todos os 12 meses existem, RBT12 = receita do próprio ano (proporção trivial)", () => {
    const meses = calcularRbt12MensalDoAno(900_000, undefined, "2027-01-10", 2027);
    expect(meses).toHaveLength(12);
    expect(meses.every((m) => Math.abs(m.rbt12 - 900_000) < 0.01)).toBe(true);
  });

  it("abertura em ano ANTERIOR ao ano calculado não ativa a regra de início de atividade (cai na rolagem normal)", () => {
    const meses = calcularRbt12MensalDoAno(1_500_000, 1_200_000, "2025-03-01", 2027);
    expect(meses).toHaveLength(12);
    expect(meses[0].metodologia).not.toContain("Início de atividade");
  });
});

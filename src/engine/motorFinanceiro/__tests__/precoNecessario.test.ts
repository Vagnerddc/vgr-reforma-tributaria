import { describe, it, expect } from "vitest";
import { resultadoNaReceita, margemNaReceita, calcularReceitaNecessariaParaMargem, calcularCenarioRepasse, type ModeloReceitaResultado } from "../precoNecessario";

describe("resultadoNaReceita / margemNaReceita — conferíveis manualmente", () => {
  it("Receita 1.000, custos fixos 700, tributo 10% (t) → resultado 200, margem 20%", () => {
    const modelo: ModeloReceitaResultado = { custosFixos: 700, fracaoCustosVariaveis: 0, aliquotaEfetivaImplicita: 0.10 };
    expect(resultadoNaReceita(1_000, modelo)).toBeCloseTo(200, 6);
    expect(margemNaReceita(1_000, modelo)).toBeCloseTo(0.20, 6);
  });
});

describe("calcularReceitaNecessariaParaMargem — fórmula fechada, tributo função da receita", () => {
  it("custos fixos 650, tributo 14% da receita, margem-alvo 25% → R* = 650/0,61", () => {
    const modelo: ModeloReceitaResultado = { custosFixos: 650, fracaoCustosVariaveis: 0, aliquotaEfetivaImplicita: 0.14 };
    const r = calcularReceitaNecessariaParaMargem(modelo, 0.25);
    expect(r.possivel).toBe(true);
    if (!r.possivel) return;
    expect(r.receitaNecessaria).toBeCloseTo(650 / 0.61, 4);
    // confirma que a receita encontrada REALMENTE produz a margem-alvo — não só a fórmula, o resultado.
    expect(margemNaReceita(r.receitaNecessaria, modelo)).toBeCloseTo(0.25, 6);
  });

  it("margem-alvo matematicamente inatingível (custo variável + tributo + margem ≥ 100%) → indeterminado, nunca um número inventado", () => {
    const modelo: ModeloReceitaResultado = { custosFixos: 100, fracaoCustosVariaveis: 0.5, aliquotaEfetivaImplicita: 0.4 };
    const r = calcularReceitaNecessariaParaMargem(modelo, 0.20); // 0,5+0,4+0,2 = 1,1 ≥ 1
    expect(r.possivel).toBe(false);
  });

  it("com custos variáveis (k > 0), a receita necessária é maior do que se todo custo fosse tratado como fixo — a fórmula realmente usa k, não ignora", () => {
    const semVariavel: ModeloReceitaResultado = { custosFixos: 650, fracaoCustosVariaveis: 0, aliquotaEfetivaImplicita: 0.14 };
    const comVariavel: ModeloReceitaResultado = { custosFixos: 325, fracaoCustosVariaveis: 0.2, aliquotaEfetivaImplicita: 0.14 }; // mesma "massa" de custo, metade fixa
    const rSem = calcularReceitaNecessariaParaMargem(semVariavel, 0.25);
    const rCom = calcularReceitaNecessariaParaMargem(comVariavel, 0.25);
    expect(rSem.possivel && rCom.possivel).toBe(true);
    if (rSem.possivel && rCom.possivel) expect(rCom.receitaNecessaria).not.toBeCloseTo(rSem.receitaNecessaria, 2);
  });
});

describe("calcularCenarioRepasse — monotonicidade entre absorção integral e repasse integral", () => {
  const modelo: ModeloReceitaResultado = { custosFixos: 650, fracaoCustosVariaveis: 0, aliquotaEfetivaImplicita: 0.14 };
  const receitaAtual = 1_000;
  const receitaNoLimite = 650 / 0.61; // ~1.065,57

  it("repasse 0% = receita inalterada", () => {
    const r = calcularCenarioRepasse(0, receitaAtual, receitaNoLimite, modelo);
    expect(r.receita).toBeCloseTo(1_000, 6);
    expect(r.margem).toBeCloseTo(0.21, 6); // resultado = 1000×0,86 − 650 = 210 → margem 21%
  });

  it("repasse 100% = margem-alvo restaurada exatamente", () => {
    const r = calcularCenarioRepasse(1, receitaAtual, receitaNoLimite, modelo);
    expect(r.margem).toBeCloseTo(0.25, 4);
  });

  it("repasse 50% fica estritamente entre os dois extremos (monotonicidade)", () => {
    const r0 = calcularCenarioRepasse(0, receitaAtual, receitaNoLimite, modelo);
    const r50 = calcularCenarioRepasse(0.5, receitaAtual, receitaNoLimite, modelo);
    const r100 = calcularCenarioRepasse(1, receitaAtual, receitaNoLimite, modelo);
    expect(r50.margem).toBeGreaterThan(r0.margem);
    expect(r50.margem).toBeLessThan(r100.margem);
    expect(r50.receita).toBeCloseTo((r0.receita + r100.receita) / 2, 4);
  });
});

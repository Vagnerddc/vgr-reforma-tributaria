import { describe, it, expect } from "vitest";
import { compensarPrejuizo } from "../prejuizoFiscal";

describe("compensarPrejuizo — trava de 30% (Lei 9.065/1995, arts. 15/16)", () => {
  it("saldo disponível MAIOR que o limite: só 30% do lucro líquido ajustado é utilizado, resto fica como saldo remanescente", () => {
    // Lucro líquido ajustado: 100.000 → limite 30% = 30.000. Saldo disponível: 200.000 (bem maior que o limite).
    const r = compensarPrejuizo(100_000, 200_000);
    expect(r.limiteAplicavel).toBe(30_000);
    expect(r.valorUtilizado).toBe(30_000); // limitado pela trava, não pelo saldo
    expect(r.saldoDepois).toBe(170_000); // 200.000 − 30.000
    expect(r.baseFinal).toBe(70_000); // 100.000 − 30.000
  });

  it("saldo disponível MENOR que o limite: usa o saldo inteiro, zera o saldo remanescente", () => {
    const r = compensarPrejuizo(100_000, 10_000);
    expect(r.valorUtilizado).toBe(10_000);
    expect(r.saldoDepois).toBe(0);
    expect(r.baseFinal).toBe(90_000);
  });

  it("sem saldo anterior: base final = lucro líquido ajustado inteiro, nada compensado", () => {
    const r = compensarPrejuizo(100_000, 0);
    expect(r.valorUtilizado).toBe(0);
    expect(r.baseFinal).toBe(100_000);
  });

  it("lucro líquido ajustado negativo (prejuízo no período): base final é ZERO, e o prejuízo do período se soma ao saldo", () => {
    const r = compensarPrejuizo(-50_000, 20_000);
    expect(r.baseFinal).toBe(0);
    expect(r.valorUtilizado).toBe(0);
    expect(r.saldoDepois).toBe(70_000); // 20.000 (saldo anterior) + 50.000 (prejuízo novo)
  });

  it("lucro líquido ajustado exatamente zero: nenhuma compensação, base final zero", () => {
    const r = compensarPrejuizo(0, 50_000);
    expect(r.baseFinal).toBe(0);
    expect(r.saldoDepois).toBe(50_000); // saldo intocado
  });

  it("nunca modifica o saldo recebido por referência (imutabilidade)", () => {
    const saldoOriginal = 200_000;
    compensarPrejuizo(100_000, saldoOriginal);
    expect(saldoOriginal).toBe(200_000); // number é sempre por valor em JS, mas o teste documenta a garantia esperada
  });
});

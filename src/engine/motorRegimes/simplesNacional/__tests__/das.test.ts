import { describe, it, expect } from "vitest";
import { calcularAliquotaEfetiva, calcularDasMensal, consolidarDasAnual } from "../das";
import { calcularRbt12MensalDoAno } from "../rbt12";

describe("calcularAliquotaEfetiva — fórmula normativa (RBT12×aliq-PD)/RBT12", () => {
  it("faixa 1 do Anexo I (sem parcela a deduzir): alíquota efetiva = alíquota nominal", () => {
    const r = calcularAliquotaEfetiva(100_000, "anexo_i");
    expect(r.faixa.indice).toBe(1);
    expect(r.aliquotaEfetiva).toBeCloseTo(0.04, 6);
  });

  it("faixa 2 do Anexo I: RBT12 R$ 200.000 → alíquota efetiva conferível manualmente", () => {
    // (200.000 × 7,3% − 5.940) ÷ 200.000 = (14.600 − 5.940) ÷ 200.000 = 8.660 ÷ 200.000 = 0,0433
    const r = calcularAliquotaEfetiva(200_000, "anexo_i");
    expect(r.faixa.indice).toBe(2);
    expect(r.aliquotaEfetiva).toBeCloseTo(0.0433, 4);
  });

  it("continuidade na fronteira entre faixas — a alíquota efetiva não salta abruptamente (R$ 180.000,00 vs R$ 180.000,01)", () => {
    const noLimite = calcularAliquotaEfetiva(180_000, "anexo_i");
    const acimaDoLimite = calcularAliquotaEfetiva(180_000.01, "anexo_i");
    expect(noLimite.faixa.indice).toBe(1);
    expect(acimaDoLimite.faixa.indice).toBe(2);
    expect(Math.abs(acimaDoLimite.aliquotaEfetiva - noLimite.aliquotaEfetiva)).toBeLessThan(0.0001);
  });

  it("Anexo II tem alíquota efetiva diferente do Anexo I para a mesma RBT12 (tabelas distintas)", () => {
    const anexoI = calcularAliquotaEfetiva(1_000_000, "anexo_i");
    const anexoII = calcularAliquotaEfetiva(1_000_000, "anexo_ii");
    expect(anexoI.aliquotaEfetiva).not.toBeCloseTo(anexoII.aliquotaEfetiva, 4);
  });

  it("faixa 6 (topo): RBT12 R$ 4.800.000, Anexo I — conferível manualmente: (4.800.000×19% − 378.000)/4.800.000", () => {
    const r = calcularAliquotaEfetiva(4_800_000, "anexo_i");
    expect(r.faixa.indice).toBe(6);
    expect(r.aliquotaEfetiva).toBeCloseTo((4_800_000 * 0.19 - 378_000) / 4_800_000, 6);
  });
});

describe("calcularDasMensal / consolidarDasAnual — apuração mensal real, não receita anual × alíquota média", () => {
  it("RBT12 constante ao longo do ano: DAS anual = 12 × DAS mensal, conferível manualmente", () => {
    // Anexo I, faixa 4 (720k-1.8M): aliq 10,7%, PD 22.500. RBT12 = 1.200.000 (constante).
    // Alíquota efetiva = (1.200.000×10,7% − 22.500)/1.200.000 = (128.400−22.500)/1.200.000 = 0,08825.
    // Receita mensal (receita anual 1.200.000 ÷ 12) = 100.000. DAS mensal = 100.000×0,08825 = 8.825. Anual = 105.900.
    const rbt12Constante = calcularRbt12MensalDoAno(1_200_000, 1_200_000, undefined, 2027);
    const dasMensal = calcularDasMensal(rbt12Constante, 1_200_000, "anexo_i");
    expect(dasMensal.every((m) => m.faixa === 4)).toBe(true);
    const componente = consolidarDasAnual(dasMensal, "anexo_i");
    expect(componente.valor).toBeCloseTo(105_900, 0);
  });

  it("RBT12 rolante muda de faixa NO MEIO DO ANO — a alíquota é recalculada mês a mês, não fixada no início do ano", () => {
    // Receita do ano anterior: 3.000.000 (mensal 250.000). Receita do ano atual: 4.200.000 (mensal 350.000).
    // RBT12(mês) = (12-mês)×250.000 + mês×350.000. Cruza 3.600.000 exatamente no mês 6 (fica na faixa 5);
    // no mês 7 já é 3.700.000 (faixa 6).
    const rbt12PorMes = calcularRbt12MensalDoAno(4_200_000, 3_000_000, undefined, 2027);
    const dasMensal = calcularDasMensal(rbt12PorMes, 4_200_000, "anexo_i");

    const faixasAte6 = dasMensal.filter((m) => m.mes <= 6).map((m) => m.faixa);
    const faixasApos6 = dasMensal.filter((m) => m.mes >= 7).map((m) => m.faixa);
    expect(faixasAte6.every((f) => f === 5)).toBe(true);
    expect(faixasApos6.every((f) => f === 6)).toBe(true);

    // A alíquota efetiva muda de valor entre os meses 6 e 7 — a mudança de faixa tem efeito real no
    // DAS. NÃO necessariamente para cima: na faixa 6 do Anexo I, o ICMS deixa de ser recolhido
    // dentro do DAS (passa a ser separado, direto ao estado) — por isso a parcela a deduzir da
    // faixa 6 é desenhada para excluir esse componente, e a alíquota efetiva DENTRO do DAS pode
    // até cair, mesmo com RBT12 maior. Isso é comportamento real da lei, não um bug de tabela.
    const mes6 = dasMensal.find((m) => m.mes === 6)!;
    const mes7 = dasMensal.find((m) => m.mes === 7)!;
    expect(mes7.aliquotaEfetiva).not.toBeCloseTo(mes6.aliquotaEfetiva, 4);

    const componente = consolidarDasAnual(dasMensal, "anexo_i");
    expect(componente.memoriaCalculo).toContain("5 → 6"); // trilha da mudança de faixa preservada na memória
  });
});

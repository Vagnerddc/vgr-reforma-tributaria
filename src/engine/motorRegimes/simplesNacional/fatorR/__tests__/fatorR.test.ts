import { describe, it, expect } from "vitest";
import { calcularFatorRDoAno } from "../fatorR";
import { calcularRbt12MensalDoAno } from "../../rbt12";
import { calcularFs12MensalDoAno } from "../fs12Mensal";

function rbt12Constante(valor: number) {
  return calcularRbt12MensalDoAno(valor, valor, undefined, 2027);
}
function fs12Constante(valor: number) {
  return calcularFs12MensalDoAno(valor, valor, undefined, 2027);
}

describe("calcularFatorRDoAno — fórmula FS12 ÷ RBT12, casos conferíveis manualmente", () => {
  it("RBT12 1.000.000, FS12 270.000 → Fator R 27% → Anexo V", () => {
    const r = calcularFatorRDoAno(rbt12Constante(1_000_000), fs12Constante(270_000), false);
    expect(r.disponivel).toBe(true);
    if (!r.disponivel) return;
    expect(r.meses[0].fatorR).toBeCloseTo(0.27, 4);
    expect(r.meses[0].anexoResultante).toBe("anexo_v");
  });

  it("RBT12 1.000.000, FS12 300.000 → Fator R 30% → Anexo III", () => {
    const r = calcularFatorRDoAno(rbt12Constante(1_000_000), fs12Constante(300_000), false);
    if (!r.disponivel) throw new Error("esperava disponível");
    expect(r.meses[0].fatorR).toBeCloseTo(0.30, 4);
    expect(r.meses[0].anexoResultante).toBe("anexo_iii");
  });

  it("FS12 necessária para o limite e FS12 adicional necessária — matemática pura, não recomendação", () => {
    const r = calcularFatorRDoAno(rbt12Constante(1_000_000), fs12Constante(270_000), false);
    if (!r.disponivel) throw new Error("esperava disponível");
    expect(r.meses[0].fs12NecessariaParaLimite).toBeCloseTo(280_000, 2); // 1.000.000 × 28%
    expect(r.meses[0].fs12AdicionalNecessaria).toBeCloseTo(10_000, 2); // 280.000 − 270.000
  });

  it("quando já está acima do limite, a FS12 adicional necessária é ZERO (nunca negativa)", () => {
    const r = calcularFatorRDoAno(rbt12Constante(1_000_000), fs12Constante(300_000), false);
    if (!r.disponivel) throw new Error("esperava disponível");
    expect(r.meses[0].fs12AdicionalNecessaria).toBe(0);
  });

  it("distanciaLimitePp: negativa abaixo do limite, positiva acima", () => {
    const abaixo = calcularFatorRDoAno(rbt12Constante(1_000_000), fs12Constante(270_000), false);
    const acima = calcularFatorRDoAno(rbt12Constante(1_000_000), fs12Constante(300_000), false);
    if (!abaixo.disponivel || !acima.disponivel) throw new Error("esperava disponível");
    expect(abaixo.meses[0].distanciaLimitePp).toBeCloseTo(-1.0, 4);
    expect(acima.meses[0].distanciaLimitePp).toBeCloseTo(2.0, 4);
  });
});

describe("Fronteira dos 28% — precisão decimal, sem erro de ponto flutuante", () => {
  it("27,99% → Anexo V; 28,00% → Anexo III; 28,01% → Anexo III", () => {
    const r2799 = calcularFatorRDoAno(rbt12Constante(1_000_000), fs12Constante(279_900), false);
    const r2800 = calcularFatorRDoAno(rbt12Constante(1_000_000), fs12Constante(280_000), false);
    const r2801 = calcularFatorRDoAno(rbt12Constante(1_000_000), fs12Constante(280_100), false);
    if (!r2799.disponivel || !r2800.disponivel || !r2801.disponivel) throw new Error("esperava disponível");
    expect(r2799.meses[0].anexoResultante).toBe("anexo_v");
    expect(r2800.meses[0].anexoResultante).toBe("anexo_iii");
    expect(r2801.meses[0].anexoResultante).toBe("anexo_iii");
  });

  it("valor que daria 28% exato mas cai em 27,9999999...% por ponto flutuante ainda decide corretamente (arredondamento a 4 casas)", () => {
    // 0.1 + 0.2 é o clássico erro de ponto flutuante em JS — construímos um RBT12/FS12 que force
    // uma divisão não exata perto do limite.
    const rbt12 = 3;
    const fs12 = 0.84; // 0.84 / 3 = 0.28 exatamente em decimal, mas pode não ser exato em binário
    const r = calcularFatorRDoAno(rbt12Constante(rbt12), fs12Constante(fs12), false);
    if (!r.disponivel) throw new Error("esperava disponível");
    expect(r.meses[0].anexoResultante).toBe("anexo_iii"); // deve arredondar para 28,00% e não cair para V por 1 bit de diferença
  });
});

describe("Janela móvel — Fator R cruzando 28% no meio do ano (RBT12 constante, FS12 crescendo)", () => {
  it("o anexo muda de V para III no mês exato em que o Fator R cruza 28%, nunca fixado no início do ano", () => {
    const rbt12PorMes = rbt12Constante(1_000_000);
    const fs12PorMes = calcularFs12MensalDoAno(320_000, 240_000, undefined, 2027);
    const r = calcularFatorRDoAno(rbt12PorMes, fs12PorMes, false);
    if (!r.disponivel) throw new Error("esperava disponível");

    expect(r.meses[0].anexoResultante).toBe("anexo_v"); // início do ano: FS12 ainda dominada pelo ano anterior (240k → 20%)
    expect(r.meses[11].anexoResultante).toBe("anexo_iii"); // fim do ano: FS12 já é 320k/12 anualizado = 32%

    // existe uma transição real dentro do ano — não é V o ano todo nem III o ano todo
    const indices = r.meses.map((m) => m.anexoResultante);
    expect(new Set(indices).size).toBe(2);

    // o Fator R é estritamente crescente mês a mês (FS12 cresce, RBT12 constante)
    for (let i = 1; i < 12; i++) expect(r.meses[i].fatorR).toBeGreaterThan(r.meses[i - 1].fatorR);
  });
});

describe("Indeterminação — nunca aproximada", () => {
  it("FS12 indeterminada (undefined) → Fator R indeterminado, com código de alerta estruturado", () => {
    const r = calcularFatorRDoAno(rbt12Constante(1_000_000), undefined, false);
    expect(r.disponivel).toBe(false);
    if (r.disponivel) return;
    expect(r.alertas[0].codigo).toBe("FATOR_R_INDETERMINADO");
  });

  it("início de atividade no ano → indeterminado, com fundamento da incerteza explicitado no alerta", () => {
    const r = calcularFatorRDoAno(rbt12Constante(1_000_000), fs12Constante(300_000), true);
    expect(r.disponivel).toBe(false);
    if (r.disponivel) return;
    expect(r.alertas[0].codigo).toBe("HISTORICO_FOLHA_INSUFICIENTE");
    expect(r.alertas[0].mensagem).toContain("não foi confirmado");
  });

  it("alerta de proximidade do limite quando o Fator R fica a até 2 p.p. de 28%", () => {
    const r = calcularFatorRDoAno(rbt12Constante(1_000_000), fs12Constante(275_000), false); // 27,5% — 0,5pp abaixo
    if (!r.disponivel) throw new Error("esperava disponível");
    expect(r.alertas.some((a) => a.codigo === "FATOR_R_PROXIMO_LIMITE")).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { calcularBaseAjustada } from "../baseFiscal";
import type { AjusteFiscal } from "../../../cenarioEmpresa";

const ADICAO_MULTA: AjusteFiscal = { tipo: "adicao", tributoAplicavel: "ambos", valor: 50_000, descricao: "Multa não dedutível", origem: "informado_usuario", status: "confirmado" };
const EXCLUSAO_DIVIDENDOS: AjusteFiscal = { tipo: "exclusao", tributoAplicavel: "ambos", valor: 30_000, descricao: "Dividendos recebidos de outra PJ", origem: "informado_usuario", status: "confirmado" };
const ADICAO_SO_CSLL: AjusteFiscal = { tipo: "adicao", tributoAplicavel: "csll", valor: 10_000, descricao: "Ajuste específico de CSLL", origem: "informado_usuario", status: "confirmado" };

describe("calcularBaseAjustada — lucro contábil ≠ lucro tributável", () => {
  it("sem ajustes: base ajustada é igual ao lucro contábil, mas ajustesInformados é false (nunca confundido com 'sem ajustes reais')", () => {
    const r = calcularBaseAjustada(1_000_000, undefined, "irpj");
    expect(r.lucroLiquidoAjustado).toBe(1_000_000);
    expect(r.ajustesInformados).toBe(false);
  });

  it("adição sozinha: base = lucro + adição", () => {
    const r = calcularBaseAjustada(1_000_000, [ADICAO_MULTA], "irpj");
    expect(r.lucroLiquidoAjustado).toBe(1_050_000);
  });

  it("exclusão sozinha: base = lucro − exclusão", () => {
    const r = calcularBaseAjustada(1_000_000, [EXCLUSAO_DIVIDENDOS], "irpj");
    expect(r.lucroLiquidoAjustado).toBe(970_000);
  });

  it("combinação adição + exclusão: base = lucro + adições − exclusões", () => {
    const r = calcularBaseAjustada(1_000_000, [ADICAO_MULTA, EXCLUSAO_DIVIDENDOS], "irpj");
    expect(r.lucroLiquidoAjustado).toBe(1_020_000);
  });

  it("ajuste com tributoAplicavel específico só entra na base do tributo correspondente — bases de IRPJ e CSLL podem ser diferentes", () => {
    const baseIrpj = calcularBaseAjustada(1_000_000, [ADICAO_SO_CSLL], "irpj");
    const baseCsll = calcularBaseAjustada(1_000_000, [ADICAO_SO_CSLL], "csll");
    expect(baseIrpj.lucroLiquidoAjustado).toBe(1_000_000); // ajuste não aplicável a IRPJ
    expect(baseCsll.lucroLiquidoAjustado).toBe(1_010_000); // ajuste aplicado à CSLL
    expect(baseIrpj.lucroLiquidoAjustado).not.toBe(baseCsll.lucroLiquidoAjustado);
  });
});

import { describe, it, expect } from "vitest";
import { pisCofinsAutomatico, icmsAutomatico } from "../tributosAtuais";

describe("pisCofinsAutomatico", () => {
  it("retorna PIS+Cofins do Lucro Real (9,25%)", () => {
    expect(pisCofinsAutomatico("lucro_real").aliquota).toBeCloseTo(0.0925);
  });

  it("retorna PIS+Cofins do Lucro Presumido (3,65%)", () => {
    expect(pisCofinsAutomatico("lucro_presumido").aliquota).toBeCloseTo(0.0365);
  });

  it("retorna estimativa por anexo do Simples unificado", () => {
    expect(pisCofinsAutomatico("simples_unificado", "anexoIII").aliquota).toBeCloseTo(0.0201);
    expect(pisCofinsAutomatico("simples_unificado", "anexoV").aliquota).toBeCloseTo(0.0227);
  });

  it("usa anexoIII como padrão quando anexo não é informado", () => {
    expect(pisCofinsAutomatico("simples_hibrido").aliquota).toBeCloseTo(0.0201);
  });
});

describe("icmsAutomatico", () => {
  it("retorna a alíquota interna estimada para a UF informada", () => {
    expect(icmsAutomatico("SP", null).aliquota).toBeCloseTo(0.18);
    expect(icmsAutomatico("rj", null).aliquota).toBeCloseTo(0.22);
  });

  it("sempre inclui a advertência de confirmar com a contabilidade", () => {
    const res = icmsAutomatico("MG", "transporte_rodoviario_cargas");
    expect(res.observacao.toLowerCase()).toContain("confirme sempre com sua contabilidade");
  });

  it("inclui observação específica do perfil quando disponível", () => {
    const res = icmsAutomatico("SP", "aviacao_agricola");
    expect(res.observacao).toContain("ISS");
  });

  it("retorna alíquota 0 e aviso para UF não reconhecida", () => {
    const res = icmsAutomatico("XX", null);
    expect(res.aliquota).toBe(0);
    expect(res.observacao).toContain("UF não reconhecida");
  });
});

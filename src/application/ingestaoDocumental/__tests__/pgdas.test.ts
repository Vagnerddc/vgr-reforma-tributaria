import { describe, it, expect } from "vitest";
import { parsePgdasTexto } from "../adapters/pgdas";

const TEXTO_PGDAS = `
PERÍODO DE APURAÇÃO (PA): 01/2026
ANEXO: ANEXO III
RECEITA BRUTA DO PA (RBT): 400.000,00
RBT12 (RECEITA BRUTA ACUMULADA NOS DOZE MESES ANTERIORES): 3.920.000,00
ALÍQUOTA EFETIVA: 8,5%
VALOR TOTAL DO DÉBITO: 34.000,00
IRPJ: 1.200,00
CSLL: 1.100,00
COFINS: 3.400,00
PIS/PASEP: 800,00
CPP: 12.000,00
ICMS: 15.500,00
`.trim();

describe("parsePgdasTexto — fonte nativa do Simples", () => {
  it("extrai período, RBT12, receita do período, anexo, alíquota efetiva e DAS apurado", () => {
    const resultado = parsePgdasTexto(TEXTO_PGDAS, "doc-pgdas-1");
    expect(resultado.tipoDocumento).toBe("pgdas");
    expect(resultado.periodo).toBe("01/2026");

    const porObservacao = new Map(resultado.camposExtraidos.map((c) => [c.observacao, c.valor]));
    expect(porObservacao.get("rbt12")).toBe(3920000);
    expect(porObservacao.get("receita.periodoApuracao")).toBe(400000);
    expect(porObservacao.get("anexo")).toBe("III");
    expect(porObservacao.get("aliquotaEfetiva")).toBeCloseTo(8.5);
    expect(porObservacao.get("dasApurado")).toBe(34000);
    expect(porObservacao.get("tributoComponente.irpj")).toBe(1200);
    expect(porObservacao.get("tributoComponente.icms")).toBe(15500);
  });

  it("marca campos ausentes como indeterminado (nenhum valor fabricado) quando o rótulo não é encontrado", () => {
    const resultado = parsePgdasTexto("documento sem nenhum rótulo reconhecível", "doc-pgdas-2");
    expect(resultado.status).toBe("falhou");
    expect(resultado.camposExtraidos).toHaveLength(0);
    expect(resultado.alertas.some((a) => a.codigo === "periodo_nao_identificado")).toBe(true);
  });
});

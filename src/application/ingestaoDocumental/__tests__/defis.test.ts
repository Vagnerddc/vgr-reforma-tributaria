import { describe, it, expect } from "vitest";
import { parseDefisTexto } from "../adapters/defis";

const TEXTO_DEFIS = `
ANO-CALENDÁRIO: 2025
RECEITA BRUTA TOTAL: 4.500.000,00
QUANTIDADE DE EMPREGADOS: 12
`.trim();

describe("parseDefisTexto — complementar ao PGDAS-D, nunca o substitui", () => {
  it("extrai ano-calendário, receita bruta anual e número de empregados", () => {
    const resultado = parseDefisTexto(TEXTO_DEFIS, "doc-defis-1");
    expect(resultado.periodo).toBe("2025");
    const porObservacao = new Map(resultado.camposExtraidos.map((c) => [c.observacao, c.valor]));
    expect(porObservacao.get("receitaBrutaAnual")).toBe(4500000);
    expect(porObservacao.get("numeroEmpregados")).toBe(12);
  });

  it("sempre carrega o alerta de que é complementar, nunca substituto do PGDAS-D", () => {
    const resultado = parseDefisTexto(TEXTO_DEFIS, "doc-defis-2");
    expect(resultado.alertas.some((a) => a.codigo === "defis_nao_substitui_pgdas")).toBe(true);
  });
});

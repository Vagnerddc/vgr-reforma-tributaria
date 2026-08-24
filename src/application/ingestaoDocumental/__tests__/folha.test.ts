import { describe, it, expect } from "vitest";
import { ingerirResumoFolha } from "../adapters/folha";

describe("ingerirResumoFolha", () => {
  it("aceita um resumo estruturado e só inclui os campos explicitamente informados", () => {
    const resultado = ingerirResumoFolha({ periodo: "2026", folhaBruta: 500000 }, "doc-folha-1");
    expect(resultado.camposExtraidos).toHaveLength(1);
    expect(resultado.camposExtraidos[0].observacao).toBe("folhaAnual");
  });

  it("nunca fabrica pró-labore quando não informado", () => {
    const resultado = ingerirResumoFolha({ periodo: "2026", folhaBruta: 500000 }, "doc-folha-2");
    expect(resultado.camposExtraidos.some((c) => c.observacao === "proLaboreAnual")).toBe(false);
  });
});

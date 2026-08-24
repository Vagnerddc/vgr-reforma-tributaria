import { describe, it, expect } from "vitest";
import { calcularCustosEconomicos } from "../custos";
import type { CenarioEmpresa } from "../../cenarioEmpresa";

function cenarioComItens(valores: number[]): CenarioEmpresa {
  return {
    id: "c",
    identificacao: {},
    receita: {},
    custos: {
      itens: valores.map((v, i) => ({
        categoria: { chave: `c${i}`, label: "x", naturezaEconomica: "custo_operacional", creditoPisCofins: { tratamento: "creditavel", status: "confirmado" }, creditoIcmsIpi: { tratamento: "creditavel", status: "confirmado" }, creditoIbsCbs: { tratamento: "creditavel", status: "confirmado" } },
        valorAnual: v,
      })),
    },
    pessoas: {},
    tributario: {},
    economicoFinanceiro: {},
    dadosSetoriais: [],
  };
}

describe("calcularCustosEconomicos — custo econômico é sempre o valor bruto, nunca reduzido por crédito fiscal", () => {
  it("soma direta dos itens, independente de tratamento de crédito", () => {
    const r = calcularCustosEconomicos(cenarioComItens([100, 200, 50]));
    expect(r.total).toBe(350);
    expect(r.informado).toBe(true);
  });

  it("sem itens: total zero, informado=false (distingue 'zero real' de 'ausente')", () => {
    const r = calcularCustosEconomicos(cenarioComItens([]));
    expect(r.total).toBe(0);
    expect(r.informado).toBe(false);
  });
});

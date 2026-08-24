import { describe, it, expect } from "vitest";
import { avaliarElegibilidadeSimples } from "../elegibilidade";
import { campoComProveniencia as campo } from "../../../operacaoTributaria";
import type { CenarioEmpresa } from "../../../cenarioEmpresa";

function cenarioComFaturamento(faturamento: number | undefined): CenarioEmpresa {
  return {
    id: "c1",
    identificacao: { atividadePrincipal: { perfilId: "varejo_generico", status: "confirmado", origem: "informado_usuario" } },
    receita: { faturamentoAnual: faturamento === undefined ? undefined : campo(faturamento, "informado_usuario", "confirmado") },
    custos: { itens: [] },
    pessoas: {},
    tributario: {},
    economicoFinanceiro: {},
    dadosSetoriais: [],
  };
}

describe("avaliarElegibilidadeSimples", () => {
  it("elegível dentro do limite de R$ 4.800.000", () => {
    const r = avaliarElegibilidadeSimples(cenarioComFaturamento(2_000_000), "simples_unificado");
    expect(r.status).toBe("elegivel");
    expect(r.regime).toBe("simples_unificado"); // regime carimbado conforme parâmetro, núcleo compartilhado
  });

  it("no limite exato (R$ 4.800.000,00) ainda é elegível (fronteira)", () => {
    expect(avaliarElegibilidadeSimples(cenarioComFaturamento(4_800_000), "simples_unificado").status).toBe("elegivel");
  });

  it("R$ 0,01 acima do limite já é inelegível (fronteira)", () => {
    expect(avaliarElegibilidadeSimples(cenarioComFaturamento(4_800_000.01), "simples_unificado").status).toBe("inelegivel");
  });

  it("indeterminado quando a receita não foi informada", () => {
    expect(avaliarElegibilidadeSimples(cenarioComFaturamento(undefined), "simples_unificado").status).toBe("indeterminado");
  });

  it("o mesmo cenário produz o mesmo veredito para simples_hibrido — núcleo de elegibilidade idêntico", () => {
    const cenario = cenarioComFaturamento(10_000_000);
    const unificado = avaliarElegibilidadeSimples(cenario, "simples_unificado");
    const hibrido = avaliarElegibilidadeSimples(cenario, "simples_hibrido");
    expect(unificado.status).toBe(hibrido.status);
    expect(hibrido.regime).toBe("simples_hibrido");
  });
});

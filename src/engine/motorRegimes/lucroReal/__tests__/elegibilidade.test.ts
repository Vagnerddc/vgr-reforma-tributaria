import { describe, it, expect } from "vitest";
import { avaliarElegibilidadeReal } from "../elegibilidade";
import { campoComProveniencia as campo } from "../../../operacaoTributaria";
import type { CenarioEmpresa } from "../../../cenarioEmpresa";

function cenarioComFaturamento(faturamento: number | undefined, perfilId = "varejo_generico"): CenarioEmpresa {
  return {
    id: "c1",
    identificacao: { atividadePrincipal: { perfilId, status: "confirmado", origem: "informado_usuario" } },
    receita: { faturamentoAnual: faturamento === undefined ? undefined : campo(faturamento, "informado_usuario", "confirmado") },
    custos: { itens: [] },
    pessoas: {},
    tributario: {},
    economicoFinanceiro: {},
    dadosSetoriais: [],
  };
}

describe("avaliarElegibilidadeReal — nunca 'elegivel'/'inelegivel' puros, sempre obrigatorio/opcional/indeterminado", () => {
  it("obrigatório quando a receita excede R$ 78 milhões (Lei 9.718/1998, art. 14, I)", () => {
    const r = avaliarElegibilidadeReal(cenarioComFaturamento(100_000_000));
    expect(r.status).toBe("obrigatorio");
  });

  it("opcional (nunca 'elegivel') quando não há hipótese de obrigatoriedade — Real está sempre disponível", () => {
    const r = avaliarElegibilidadeReal(cenarioComFaturamento(2_000_000));
    expect(r.status).toBe("opcional");
  });

  it("indeterminado quando a receita não foi informada — nunca assume 'empresa grande = obrigatório' sem verificar", () => {
    const r = avaliarElegibilidadeReal(cenarioComFaturamento(undefined));
    expect(r.status).toBe("indeterminado");
  });

  it("no limite exato ainda é opcional (fronteira) — só ACIMA de R$ 78.000.000 obriga", () => {
    expect(avaliarElegibilidadeReal(cenarioComFaturamento(78_000_000)).status).toBe("opcional");
    expect(avaliarElegibilidadeReal(cenarioComFaturamento(78_000_000.01)).status).toBe("obrigatorio");
  });

  it("arquétipo financeiro sem confirmação explícita → indeterminado, nunca obrigatório por aproximação", () => {
    const r = avaliarElegibilidadeReal(cenarioComFaturamento(1_000_000, "meios_pagamento"));
    expect(r.status).toBe("indeterminado");
  });

  it("flag explícita de atividade obrigatória → obrigatório, com critério confirmado (não estimado)", () => {
    const cenario = cenarioComFaturamento(1_000_000);
    cenario.tributario.tratamentosEspeciais = ["atividade_obrigatoria_lucro_real"];
    const r = avaliarElegibilidadeReal(cenario);
    expect(r.status).toBe("obrigatorio");
    expect(r.criterios.find((c) => c.id === "obrigatoriedade_por_atividade")?.fonte.status).toBe("confirmado");
  });
});

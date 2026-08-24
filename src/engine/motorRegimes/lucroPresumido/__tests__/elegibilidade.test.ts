import { describe, it, expect } from "vitest";
import { avaliarElegibilidadePresumido } from "../elegibilidade";
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

describe("avaliarElegibilidadePresumido", () => {
  it("elegível quando a receita está dentro do limite e nenhum impedimento é identificado", () => {
    const r = avaliarElegibilidadePresumido(cenarioComFaturamento(10_000_000));
    expect(r.status).toBe("elegivel");
    expect(r.motivo).toContain("ausência de impedimento");
  });

  it("inelegível quando a receita excede o limite de R$ 78 milhões (Lei 9.718/1998, art. 13)", () => {
    const r = avaliarElegibilidadePresumido(cenarioComFaturamento(100_000_000));
    expect(r.status).toBe("inelegivel");
    const criterio = r.criterios.find((c) => c.id === "limite_receita_bruta_anual")!;
    expect(criterio.atendido).toBe(false);
  });

  it("no limite exato (R$ 78.000.000,00) ainda é elegível — o limite é 'até', não 'menor que' (teste de fronteira)", () => {
    const r = avaliarElegibilidadePresumido(cenarioComFaturamento(78_000_000));
    expect(r.status).toBe("elegivel");
  });

  it("R$ 0,01 acima do limite já é inelegível (teste de fronteira)", () => {
    const r = avaliarElegibilidadePresumido(cenarioComFaturamento(78_000_000.01));
    expect(r.status).toBe("inelegivel");
  });

  it("indeterminado quando a receita não foi informada — nunca assume elegibilidade por ausência de dado", () => {
    const r = avaliarElegibilidadePresumido(cenarioComFaturamento(undefined));
    expect(r.status).toBe("indeterminado");
  });

  it("inelegível quando o cenário sinaliza explicitamente atividade impeditiva", () => {
    const cenario = cenarioComFaturamento(1_000_000);
    cenario.tributario.tratamentosEspeciais = ["atividade_impeditiva_presumido"];
    const r = avaliarElegibilidadePresumido(cenario);
    expect(r.status).toBe("inelegivel");
  });

  it("indeterminado (não elegível por omissão) quando a atividade tem arquétipo financeiro e não há confirmação explícita de ausência de impedimento", () => {
    const cenario: CenarioEmpresa = {
      id: "c2",
      identificacao: { atividadePrincipal: { perfilId: "meios_pagamento", status: "confirmado", origem: "informado_usuario" } },
      receita: { faturamentoAnual: campo(1_000_000, "informado_usuario", "confirmado") },
      custos: { itens: [] },
      pessoas: {},
      tributario: {},
      economicoFinanceiro: {},
      dadosSetoriais: [],
    };
    const r = avaliarElegibilidadePresumido(cenario);
    expect(r.status).toBe("indeterminado");
    const criterio = r.criterios.find((c) => c.id === "atividade_impeditiva")!;
    expect(criterio.atendido).toBe("indeterminado");
  });
});

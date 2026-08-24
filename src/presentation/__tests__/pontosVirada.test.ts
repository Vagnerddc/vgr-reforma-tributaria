import { describe, it, expect } from "vitest";
import { construirPontosViradaViewModel } from "../viewModels/pontosVirada";
import type { ResultadoPontoVirada } from "../../engine/motorPontosVirada/tipos";

function pontoBase(overrides: Partial<ResultadoPontoVirada>): ResultadoPontoVirada {
  return {
    tipo: "igualdade_resultado_economico",
    variavel: "custoCapital",
    status: "encontrado",
    valorEncontrado: 0.0128,
    estadoAntes: { valor: 0.01, resultado: {} as never, estadoCategorico: "lucro_presumido_maior" },
    estadoDepois: { valor: 0.015, resultado: {} as never, estadoCategorico: "lucro_real_maior" },
    intervaloOriginal: { min: 0.0001, max: 0.05 },
    precisao: 0.0001,
    iteracoes: 8,
    qualidade: "media",
    premissas: {},
    alertas: [],
    achados: [],
    origemSolucao: "numerica",
    ...overrides,
  };
}

describe("58 — ponto de virada simples preserva antes/depois", () => {
  it("antes e depois chegam intactos ao ViewModel", () => {
    const vm = construirPontosViradaViewModel([pontoBase({})], 2028);
    expect(vm[0].antes).toBe("lucro_presumido_maior");
    expect(vm[0].depois).toBe("lucro_real_maior");
    expect(vm[0].valorReferencia).toBe(0.0128);
  });
});

describe("59 — múltiplos pontos da mesma variável são todos preservados", () => {
  it("nenhum ponto é descartado", () => {
    const pontos = [pontoBase({ variavel: "faturamento", valorEncontrado: 500_000 }), pontoBase({ variavel: "faturamento", valorEncontrado: 900_000 })];
    const vm = construirPontosViradaViewModel(pontos, 2028);
    expect(vm.length).toBe(2);
  });
});

describe("60 — região indeterminada é exibida honestamente", () => {
  it("status resultado_indeterminado preserva o intervalo, nunca força uma fronteira única", () => {
    const ponto = pontoBase({ status: "resultado_indeterminado", valorEncontrado: undefined, intervaloFinal: [400_000, 600_000] });
    const vm = construirPontosViradaViewModel([ponto], 2028);
    expect(vm[0].status).toBe("resultado_indeterminado");
    expect(vm[0].valorReferencia).toBeUndefined();
    expect(vm[0].intervaloIndeterminado).toEqual({ min: 400_000, max: 600_000 });
  });
});

describe("61 — Fator R nunca gera texto de pró-labore (contrato)", () => {
  it("o ViewModel de ponto de virada de folha não possui nenhum campo textual prescritivo", () => {
    const vm = construirPontosViradaViewModel([pontoBase({ variavel: "folha", valorEncontrado: 280_000, estadoAntes: { valor: 0, resultado: {} as never, estadoCategorico: "anexo_v" }, estadoDepois: { valor: 0, resultado: {} as never, estadoCategorico: "anexo_iii" } })], 2028);
    const texto = JSON.stringify(vm[0]).toLowerCase();
    expect(texto).not.toContain("pró-labore");
    expect(texto).not.toContain("aumente");
  });
});

describe("62 — ponto de preço nunca gera instrução de reajuste (contrato)", () => {
  it("nenhum campo do ViewModel contém linguagem de ordem comercial", () => {
    const vm = construirPontosViradaViewModel([pontoBase({ tipo: "preservacao_margem", variavel: "faturamento", valorEncontrado: 0.038 })], 2028);
    const texto = JSON.stringify(vm[0]).toLowerCase();
    expect(texto).not.toContain("reajuste o preço");
    expect(texto).not.toContain("deve reajustar");
  });
});

describe("63 — qualidade herdada, nunca promovida", () => {
  it("qualidade do ViewModel é idêntica à do ResultadoPontoVirada", () => {
    const vm = construirPontosViradaViewModel([pontoBase({ qualidade: "baixa" })], 2028);
    expect(vm[0].qualidade).toBe("baixa");
  });
});

describe("ordenação executiva determinística", () => {
  it("ordena por período e depois por variável, nunca por um score inventado", () => {
    const pontos = [pontoBase({ variavel: "faturamento" }), pontoBase({ variavel: "custoCapital" })];
    const vm = construirPontosViradaViewModel(pontos, 2028);
    expect(vm.map((v) => v.variavel)).toEqual(["custoCapital", "faturamento"]);
  });
});

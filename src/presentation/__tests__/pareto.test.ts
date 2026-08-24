import { describe, it, expect } from "vitest";
import { construirParetoViewModel } from "../viewModels/pareto";
import type { PontoParetoFronteira } from "../../engine/otimizacaoMultidimensional/tipos";

function ponto(id: string, carga: number, resultado: number): PontoParetoFronteira {
  return {
    ponto: {
      id,
      valoresVariaveis: {},
      resultado: {} as never,
      bloqueadoJuridicamente: false,
      objetivos: {
        minimizar_carga_fiscal: { valor: carga, disponivel: true, origem: "x" },
        maximizar_resultado_economico: { valor: resultado, disponivel: true, origem: "y" },
      },
    },
  };
}

describe("Pareto nunca vira ranking numerado", () => {
  it("o contrato de configuração não possui campo de posição/ranking", () => {
    const vm = construirParetoViewModel([ponto("a", 100, 10), ponto("b", 50, 5)], ["minimizar_carga_fiscal", "maximizar_resultado_economico"]);
    for (const c of vm.configuracoes) {
      expect(c).not.toHaveProperty("posicao");
      expect(c).not.toHaveProperty("ranking");
    }
  });

  it("rótulos de extremo só aparecem quando objetivamente derivados (sem empate)", () => {
    const vm = construirParetoViewModel([ponto("a", 100, 10), ponto("b", 50, 5)], ["minimizar_carga_fiscal"]);
    const b = vm.configuracoes.find((c) => c.id === "b")!;
    expect(b.rotulosObjetivosExtremos).toContain("Menor carga");
    const a = vm.configuracoes.find((c) => c.id === "a")!;
    expect(a.rotulosObjetivosExtremos).not.toContain("Menor carga");
  });

  it("empate no objetivo não atribui o rótulo de extremo a nenhum ponto", () => {
    const vm = construirParetoViewModel([ponto("a", 50, 10), ponto("b", 50, 5)], ["minimizar_carga_fiscal"]);
    for (const c of vm.configuracoes) expect(c.rotulosObjetivosExtremos).toEqual([]);
  });

  it("explicação metodológica nunca usa a palavra 'ótima'", () => {
    const vm = construirParetoViewModel([ponto("a", 100, 10)], ["minimizar_carga_fiscal"]);
    expect(vm.explicacaoMetodologica.toLowerCase()).not.toContain("ótima");
    expect(vm.explicacaoMetodologica.toLowerCase()).not.toContain("melhor");
  });
});

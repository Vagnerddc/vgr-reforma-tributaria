import { describe, it, expect } from "vitest";
import { aplicarAlteracoes, validarAlteracoes, resolverValorAlterado } from "../patch";
import { campoComProveniencia as campo } from "../../operacaoTributaria";
import type { CenarioEmpresa } from "../../cenarioEmpresa";

function cenario(): CenarioEmpresa {
  return {
    id: "c",
    identificacao: {},
    receita: { faturamentoAnual: campo(1_000_000, "informado_usuario", "confirmado") },
    custos: {
      itens: [
        { categoria: { chave: "insumos", label: "Insumos", naturezaEconomica: "custo_operacional", creditoPisCofins: { tratamento: "creditavel", status: "confirmado" }, creditoIcmsIpi: { tratamento: "creditavel", status: "confirmado" }, creditoIbsCbs: { tratamento: "creditavel", status: "confirmado" } }, valorAnual: 100_000 },
      ],
    },
    pessoas: { folhaAnual: campo(50_000, "informado_usuario", "confirmado") },
    tributario: {},
    economicoFinanceiro: {},
    dadosSetoriais: [],
  };
}

describe("resolverValorAlterado — ordem determinística set > incremento_absoluto > incremento_percentual (seção 41)", () => {
  it("set ignora a base", () => expect(resolverValorAlterado(100, { tipo: "set", valor: 50, origem: "informado_usuario", status: "estimado" })).toBe(50));
  it("incremento_absoluto soma à base", () => expect(resolverValorAlterado(100, { tipo: "incremento_absoluto", valor: 20, origem: "informado_usuario", status: "estimado" })).toBe(120));
  it("incremento_percentual multiplica a base — +10% é diferente de =10", () => {
    const percentual = resolverValorAlterado(1_000_000, { tipo: "incremento_percentual", valor: 0.1, origem: "informado_usuario", status: "estimado" });
    const absoluto = resolverValorAlterado(1_000_000, { tipo: "set", valor: 10, origem: "informado_usuario", status: "estimado" });
    expect(percentual).toBe(1_100_000);
    expect(percentual).not.toBe(absoluto);
  });
});

describe("aplicarAlteracoes — pura, nunca muta o base (seção 5)", () => {
  it("retorna um novo objeto; o cenário-base permanece intocado", () => {
    const base = cenario();
    const antes = JSON.stringify(base);
    const { cenario: derivado } = aplicarAlteracoes(base, { receita: { faturamentoAnual: { tipo: "set", valor: 9_999_999, origem: "informado_usuario", status: "estimado" } } });
    expect(JSON.stringify(base)).toBe(antes);
    expect(derivado.receita.faturamentoAnual?.valor).toBe(9_999_999);
    expect(derivado).not.toBe(base);
  });

  it("proveniência da alteração nunca herda status do campo base — estimativa não vira 'confirmado' silenciosamente", () => {
    const base = cenario();
    const { cenario: derivado } = aplicarAlteracoes(base, { receita: { faturamentoAnual: { tipo: "set", valor: 2_000_000, origem: "estimativa" as never, status: "estimado" } } });
    expect(derivado.receita.faturamentoAnual?.status).toBe("estimado");
    expect(derivado.receita.faturamentoAnual?.status).not.toBe(base.receita.faturamentoAnual?.status);
  });

  it("fatorEscalaCustosCreditaveisIbsCbs escala só os itens creditáveis, nunca os não-creditáveis", () => {
    const base = cenario();
    base.custos.itens.push({ categoria: { chave: "aluguel", label: "Aluguel", naturezaEconomica: "custo_operacional", creditoPisCofins: { tratamento: "nao_creditavel", status: "confirmado" }, creditoIcmsIpi: { tratamento: "nao_creditavel", status: "confirmado" }, creditoIbsCbs: { tratamento: "nao_creditavel", status: "confirmado" } }, valorAnual: 30_000 });
    const { cenario: derivado } = aplicarAlteracoes(base, { custos: { fatorEscalaCustosCreditaveisIbsCbs: { tipo: "set", valor: 2, origem: "informado_usuario", status: "estimado" } } });
    expect(derivado.custos.itens.find((i) => i.categoria.chave === "insumos")!.valorAnual).toBe(200_000);
    expect(derivado.custos.itens.find((i) => i.categoria.chave === "aluguel")!.valorAnual).toBe(30_000);
  });
});

describe("validarAlteracoes — rejeita, nunca corrige premissa absurda (seção 42/43)", () => {
  it("receita resultante negativa é rejeitada", () => {
    const erros = validarAlteracoes(cenario(), { receita: { faturamentoAnual: { tipo: "incremento_absoluto", valor: -2_000_000, origem: "informado_usuario", status: "estimado" } } });
    expect(erros.length).toBeGreaterThan(0);
  });

  it("custo de item existente resultando negativo é rejeitado", () => {
    const erros = validarAlteracoes(cenario(), { custos: { itens: [{ categoriaChave: "insumos", valorAnual: { tipo: "incremento_absoluto", valor: -200_000, origem: "informado_usuario", status: "estimado" } }] } });
    expect(erros.length).toBeGreaterThan(0);
  });

  it("categoria de custo inexistente é rejeitada (nunca cria categoria nova)", () => {
    const erros = validarAlteracoes(cenario(), { custos: { itens: [{ categoriaChave: "categoria_nao_existe", valorAnual: { tipo: "set", valor: 1_000, origem: "informado_usuario", status: "estimado" } }] } });
    expect(erros.some((e) => e.campo.includes("categoria_nao_existe"))).toBe(true);
  });

  it("FS12/folha resultante negativa é rejeitada", () => {
    const erros = validarAlteracoes(cenario(), { pessoas: { folhaAnual: { tipo: "incremento_absoluto", valor: -100_000, origem: "informado_usuario", status: "estimado" } } });
    expect(erros.length).toBeGreaterThan(0);
  });

  it("percentual de split fora de 0-100% é rejeitado, nunca truncado", () => {
    const erros = validarAlteracoes(cenario(), { splitPayment: { percentualRecebimentosSujeitos: { tipo: "set", valor: 1.5, origem: "informado_usuario", status: "estimado" } } });
    expect(erros.length).toBeGreaterThan(0);
  });

  it("cenário válido não produz erro", () => {
    const erros = validarAlteracoes(cenario(), { receita: { faturamentoAnual: { tipo: "incremento_percentual", valor: 0.1, origem: "informado_usuario", status: "estimado" } } });
    expect(erros).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { otimizar } from "../motor";
import { gerarGrade, MAX_COMBINACOES } from "../grade";
import { calcularFronteiraPareto } from "../pareto";
import { LimiteComputacionalExcedidoError } from "../tipos";
import { motorLucroPresumido } from "../../motorRegimes/lucroPresumido/motor";
import { motorSimplesUnificado } from "../../motorRegimes/simplesNacional/motor";
import { campoComProveniencia as campo } from "../../operacaoTributaria";
import type { CenarioEmpresa } from "../../cenarioEmpresa";
import { ANOS_SIMULACAO } from "../../parametros";

const ANO = ANOS_SIMULACAO[0];

function cenarioComercio(faturamento = 300_000, margem = 0.24): CenarioEmpresa {
  return {
    id: "c-comercio",
    identificacao: { nomeEmpresa: campo("Empresa", "informado_usuario", "confirmado"), atividadePrincipal: { perfilId: "varejo_generico", status: "confirmado", origem: "informado_usuario" } },
    receita: { faturamentoAnual: campo(faturamento, "informado_usuario", "confirmado"), mixMercado: { b2b: campo(0.7, "informado_usuario", "confirmado"), b2c: campo(0.3, "informado_usuario", "confirmado") } },
    custos: { itens: [{ categoria: { chave: "insumos", label: "Insumos", naturezaEconomica: "custo_operacional", creditoPisCofins: { tratamento: "creditavel", status: "confirmado" }, creditoIcmsIpi: { tratamento: "creditavel", status: "confirmado" }, creditoIbsCbs: { tratamento: "creditavel", status: "confirmado" } }, valorAnual: faturamento * (1 - margem) * 0.5 }] },
    pessoas: {},
    tributario: { regimeAtual: campo("lucro_presumido", "informado_usuario", "confirmado"), premissas: { pisCofinsPercentualAtual: campo(0.0365, "informado_usuario", "confirmado"), icmsIpiPercentualAtual: campo(0.05, "informado_usuario", "confirmado") } },
    economicoFinanceiro: { lucroAtual: campo(faturamento * margem, "informado_usuario", "confirmado"), meioPagamentoPredominante: campo("pix", "informado_usuario", "confirmado") },
    dadosSetoriais: [],
  };
}

describe("toda combinação passa pelo MotorCenarios", () => {
  it("cada ponto avaliado carrega um ResultadoCenario completo, real, com resultadoRegimes", () => {
    const cenario = cenarioComercio();
    const resultado = otimizar({ cenarioBase: cenario, motorRegime: motorLucroPresumido, regime: "lucro_presumido", ano: ANO, variaveis: [{ variavel: "faturamento", min: 200_000, max: 400_000, passos: 3 }], objetivos: ["minimizar_carga_fiscal", "maximizar_resultado_economico"] });
    expect(resultado.combinacoesAvaliadas).toBe(3);
    for (const p of resultado.todosOsPontos) {
      expect(p.resultado.resultadoRegimes.length).toBeGreaterThan(0);
      expect(p.resultado.resultadoRegimes[0].anos.length).toBeGreaterThan(0);
    }
  });
});

describe("restrições jurídicas bloqueiam combinações reais", () => {
  it("faturamento que ultrapassa o limite do Simples é excluído da fronteira, nunca tratado como solução válida", () => {
    const cenario = cenarioComercio(300_000);
    const resultado = otimizar({ cenarioBase: cenario, motorRegime: motorSimplesUnificado, regime: "simples_unificado", ano: ANO, variaveis: [{ variavel: "faturamento", min: 300_000, max: 10_000_000, passos: 5 }], objetivos: ["minimizar_carga_fiscal"] });
    expect(resultado.combinacoesBloqueadasJuridicamente).toBeGreaterThan(0);
    for (const item of resultado.fronteiraPareto) expect(item.ponto.bloqueadoJuridicamente).toBe(false);
  });
});

describe("limites das variáveis nunca são inventados", () => {
  it("a grade usa exatamente min/max/passos informados, sem padding automático", () => {
    const grade = gerarGrade([{ variavel: "faturamento", min: 100_000, max: 200_000, passos: 3 }]);
    expect(grade.map((g) => g.faturamento)).toEqual([100_000, 150_000, 200_000]);
  });
});

describe("indeterminado nunca vira zero", () => {
  it("sem premissa de split, o objetivo de capital de giro fica indisponível, nunca 0", () => {
    const cenario = cenarioComercio();
    const resultado = otimizar({ cenarioBase: cenario, motorRegime: motorLucroPresumido, regime: "lucro_presumido", ano: ANO, variaveis: [{ variavel: "faturamento", min: 200_000, max: 400_000, passos: 2 }], objetivos: ["minimizar_capital_giro_adicional"] });
    for (const p of resultado.todosOsPontos) {
      const obj = p.objetivos.minimizar_capital_giro_adicional!;
      expect(obj.disponivel).toBe(false);
      expect(obj.valor).toBeUndefined();
    }
  });
});

describe("Pareto considera todos os objetivos configurados e preserva trade-offs", () => {
  it("dois objetivos conflitantes preservam múltiplos pontos na fronteira", () => {
    const a = { id: "a", valoresVariaveis: {}, resultado: {} as never, bloqueadoJuridicamente: false, objetivos: { minimizar_carga_fiscal: { valor: 100, disponivel: true, origem: "x" }, maximizar_resultado_economico: { valor: 10, disponivel: true, origem: "y" } } };
    const b = { id: "b", valoresVariaveis: {}, resultado: {} as never, bloqueadoJuridicamente: false, objetivos: { minimizar_carga_fiscal: { valor: 50, disponivel: true, origem: "x" }, maximizar_resultado_economico: { valor: 5, disponivel: true, origem: "y" } } };
    const fronteira = calcularFronteiraPareto([a, b], ["minimizar_carga_fiscal", "maximizar_resultado_economico"]);
    expect(fronteira.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  it("dominância clara remove o ponto dominado da fronteira", () => {
    const a = { id: "a", valoresVariaveis: {}, resultado: {} as never, bloqueadoJuridicamente: false, objetivos: { minimizar_carga_fiscal: { valor: 50, disponivel: true, origem: "x" }, maximizar_resultado_economico: { valor: 10, disponivel: true, origem: "y" } } };
    const b = { id: "b", valoresVariaveis: {}, resultado: {} as never, bloqueadoJuridicamente: false, objetivos: { minimizar_carga_fiscal: { valor: 100, disponivel: true, origem: "x" }, maximizar_resultado_economico: { valor: 5, disponivel: true, origem: "y" } } };
    const fronteira = calcularFronteiraPareto([a, b], ["minimizar_carga_fiscal", "maximizar_resultado_economico"]);
    expect(fronteira.map((p) => p.id)).toEqual(["a"]);
  });
});

describe("Score não interfere na dominância", () => {
  it("calcularFronteiraPareto opera apenas sobre PontoAvaliado.objetivos — dois pontos com o mesmo objetivo bruto produzem a mesma dominância independentemente de qualquer score externo (que nem é um parâmetro da função)", () => {
    const a = { id: "a", valoresVariaveis: {}, resultado: {} as never, bloqueadoJuridicamente: false, objetivos: { minimizar_carga_fiscal: { valor: 50, disponivel: true, origem: "x" } } };
    const b = { id: "b", valoresVariaveis: {}, resultado: {} as never, bloqueadoJuridicamente: false, objetivos: { minimizar_carga_fiscal: { valor: 100, disponivel: true, origem: "x" } } };
    // A assinatura de calcularFronteiraPareto não aceita nem lê nenhum ScoreEstrategico — só objetivos brutos.
    const fronteira = calcularFronteiraPareto([a, b], ["minimizar_carga_fiscal"]);
    expect(fronteira.map((p) => p.id)).toEqual(["a"]);
  });
});

describe("nenhuma solução Pareto é chamada de melhor", () => {
  it("o contrato de saída não contém campo de recomendação", () => {
    const cenario = cenarioComercio();
    const resultado = otimizar({ cenarioBase: cenario, motorRegime: motorLucroPresumido, regime: "lucro_presumido", ano: ANO, variaveis: [{ variavel: "faturamento", min: 200_000, max: 400_000, passos: 2 }], objetivos: ["minimizar_carga_fiscal"] });
    expect(resultado).not.toHaveProperty("melhorSolucao");
    expect(resultado).not.toHaveProperty("solucaoRecomendada");
    expect(JSON.stringify(resultado.fronteiraPareto)).not.toContain("melhor");
  });
});

describe("baseline continua imutável", () => {
  it("cenarioBase permanece idêntico após a otimização", () => {
    const cenario = cenarioComercio();
    const antes = JSON.stringify(cenario);
    otimizar({ cenarioBase: cenario, motorRegime: motorLucroPresumido, regime: "lucro_presumido", ano: ANO, variaveis: [{ variavel: "faturamento", min: 200_000, max: 400_000, passos: 3 }], objetivos: ["minimizar_carga_fiscal"] });
    expect(JSON.stringify(cenario)).toBe(antes);
  });
});

describe("limites computacionais evitam explosão combinatória", () => {
  it("grade acima do limite lança LimiteComputacionalExcedidoError, nunca trunca silenciosamente", () => {
    const variaveisExcessivas = Array.from({ length: 4 }, () => ({ variavel: "faturamento" as const, min: 1, max: 2, passos: 10 }));
    expect(() => gerarGrade(variaveisExcessivas)).toThrow(LimiteComputacionalExcedidoError);
  });

  it("MAX_COMBINACOES é uma constante explícita e finita", () => {
    expect(MAX_COMBINACOES).toBeGreaterThan(0);
    expect(Number.isFinite(MAX_COMBINACOES)).toBe(true);
  });
});

describe("metodologia versionada e auditável", () => {
  it("todo resultado carrega metodologiaId/versao/contextHash", () => {
    const cenario = cenarioComercio();
    const resultado = otimizar({ cenarioBase: cenario, motorRegime: motorLucroPresumido, regime: "lucro_presumido", ano: ANO, variaveis: [{ variavel: "faturamento", min: 200_000, max: 400_000, passos: 2 }], objetivos: ["minimizar_carga_fiscal"] });
    expect(resultado.metodologiaId).toBe("VGR_OTIMIZACAO");
    expect(resultado.metodologiaVersao).toBe("V1");
    expect(resultado.contextHash.length).toBeGreaterThan(0);
  });
});

describe("determinismo", () => {
  it("mesma entrada produz a mesma fronteira", () => {
    const cenario = cenarioComercio();
    const opcoes = { cenarioBase: cenario, motorRegime: motorLucroPresumido, regime: "lucro_presumido" as const, ano: ANO, variaveis: [{ variavel: "faturamento" as const, min: 200_000, max: 400_000, passos: 3 }], objetivos: ["minimizar_carga_fiscal" as const] };
    const r1 = otimizar(opcoes);
    const r2 = otimizar(opcoes);
    expect(r1.fronteiraPareto.map((p) => p.ponto.id)).toEqual(r2.fronteiraPareto.map((p) => p.ponto.id));
  });
});

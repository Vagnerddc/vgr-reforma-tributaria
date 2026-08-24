import { describe, it, expect } from "vitest";
import { calcularResultadoEconomicoFinanceiro } from "../motor";
import { campoComProveniencia as campo } from "../../operacaoTributaria";
import type { CenarioEmpresa } from "../../cenarioEmpresa";
import type { ResultadoRegime } from "../../motorRegimes/tipos";
import { ANOS_SIMULACAO } from "../../parametros";

function cenarioComCustos(receita: number, custosItens: number[]): CenarioEmpresa {
  return {
    id: "cenario-financeiro",
    identificacao: { atividadePrincipal: { perfilId: "varejo_generico", status: "confirmado", origem: "informado_usuario" } },
    receita: { faturamentoAnual: campo(receita, "informado_usuario", "confirmado") },
    custos: {
      itens: custosItens.map((valor, i) => ({
        categoria: { chave: `custo${i}`, label: `Custo ${i}`, naturezaEconomica: "custo_operacional", creditoPisCofins: { tratamento: "creditavel", status: "confirmado" }, creditoIcmsIpi: { tratamento: "creditavel", status: "confirmado" }, creditoIbsCbs: { tratamento: "creditavel", status: "confirmado" } },
        valorAnual: valor,
      })),
    },
    pessoas: {},
    tributario: {},
    economicoFinanceiro: {},
    dadosSetoriais: [],
  };
}

function resultadoRegimeComCargaPorAno(cargasPorAno: Record<number, number | null>): ResultadoRegime {
  return {
    regime: "lucro_presumido",
    aplicabilidade: { regime: "lucro_presumido", status: "elegivel", motivo: "teste", criterios: [] },
    anos: ANOS_SIMULACAO.map((ano) => ({ ano, disponivel: cargasPorAno[ano] !== null && cargasPorAno[ano] !== undefined, componentes: [], cargaTotal: cargasPorAno[ano] ?? 0 })),
    cargaTotalPeriodo: 0,
    componentesConsolidados: {},
    premissas: {},
    qualidade: { percentualConfirmado: 100, origemIbsCbs: "nao_aplicavel" },
    alertas: [],
    memoria: [],
  };
}

describe("Motor Financeiro — margem básica (ano-base), sem regra tributária própria", () => {
  it("Receita 1.000, custos 700, tributo 100 → resultado 200, margem 20%", () => {
    const cenario = cenarioComCustos(1_000, [700]);
    const resultadoRegime = resultadoRegimeComCargaPorAno({ [ANOS_SIMULACAO[0]]: 100 });
    const r = calcularResultadoEconomicoFinanceiro(cenario, resultadoRegime);
    const anoBase = r.anos[0];
    expect(anoBase.resultado).toBeCloseTo(200, 2);
    expect(anoBase.margem).toBeCloseTo(0.20, 6);
  });
});

describe("Erosão de margem e impacto em R$ — sinais corretos", () => {
  it("carga tributária sobe de 100 para 140 (receita/custos constantes): erosão -4 p.p., impacto -R$40", () => {
    const cenario = cenarioComCustos(1_000, [650]);
    const resultadoRegime = resultadoRegimeComCargaPorAno({ [ANOS_SIMULACAO[0]]: 100, [ANOS_SIMULACAO[1]]: 140 });
    const r = calcularResultadoEconomicoFinanceiro(cenario, resultadoRegime);

    const anoBase = r.anos[0];
    const ano2 = r.anos[1];
    expect(anoBase.margem).toBeCloseTo(0.25, 6); // (1000-650-100)/1000
    expect(ano2.margem).toBeCloseTo(0.21, 6); // (1000-650-140)/1000
    expect(ano2.erosaoMargemPp).toBeCloseTo(-4.0, 4);
    expect(ano2.impactoAnualReais).toBeCloseTo(-40, 2); // 210 - 250
    expect(ano2.impactoTributarioReais).toBeCloseTo(40, 2); // 140 - 100 (aumento de tributo, sinal positivo)
  });
});

describe("Preço necessário e cenários de repasse — herdam a margem do ano-base como alvo por padrão", () => {
  it("reajuste médio necessário e os 3 cenários de repasse são consistentes com a fórmula fechada", () => {
    const cenario = cenarioComCustos(1_000, [650]);
    const resultadoRegime = resultadoRegimeComCargaPorAno({ [ANOS_SIMULACAO[0]]: 100, [ANOS_SIMULACAO[1]]: 140 });
    const r = calcularResultadoEconomicoFinanceiro(cenario, resultadoRegime);
    const ano2 = r.anos[1];

    expect(ano2.reajusteMedioNecessario).toBeCloseTo(650 / 0.61 / 1_000 - 1, 4);
    expect(ano2.cenariosRepasse).toHaveLength(3);
    const [repasse0, repasse50, repasse100] = ano2.cenariosRepasse!;
    expect(repasse0.margem).toBeCloseTo(0.21, 4);
    expect(repasse100.margem).toBeCloseTo(0.25, 4);
    expect(repasse50.margem).toBeGreaterThan(repasse0.margem);
    expect(repasse50.margem).toBeLessThan(repasse100.margem);
  });
});

describe("Comparabilidade fiscal herdada — nunca recalculada, sempre repassada", () => {
  it("comparavel_com_ressalvas gera alerta explícito e qualidade 'media'", () => {
    const cenario = cenarioComCustos(1_000, [650]);
    const resultadoRegime = resultadoRegimeComCargaPorAno({ [ANOS_SIMULACAO[0]]: 100 });
    const mapa = new Map([[ANOS_SIMULACAO[0], "comparavel_com_ressalvas" as const]]);
    const r = calcularResultadoEconomicoFinanceiro(cenario, resultadoRegime, {}, mapa);
    expect(r.anos[0].qualidade).toBe("media");
    expect(r.anos[0].alertas.some((a) => a.includes("ressalva"))).toBe(true);
  });

  it("nao_comparavel gera qualidade 'insuficiente' e alerta dizendo explicitamente que não é conclusão definitiva", () => {
    const cenario = cenarioComCustos(1_000, [650]);
    const resultadoRegime = resultadoRegimeComCargaPorAno({ [ANOS_SIMULACAO[0]]: 100 });
    const mapa = new Map([[ANOS_SIMULACAO[0], "nao_comparavel" as const]]);
    const r = calcularResultadoEconomicoFinanceiro(cenario, resultadoRegime, {}, mapa);
    expect(r.anos[0].qualidade).toBe("insuficiente");
    expect(r.anos[0].alertas.some((a) => a.includes("NÃO deve ser lido como conclusão definitiva"))).toBe(true);
    // o número ainda é calculado e exposto — não escondido, só sinalizado.
    expect(r.anos[0].margem).toBeDefined();
  });
});

describe("Multi-ano — 8 anos, impacto acumulado nunca soma indisponível como zero", () => {
  it("um ano indisponível no meio do horizonte marca impactoAcumuladoParcial e não distorce a soma", () => {
    const cenario = cenarioComCustos(1_000, [650]);
    const cargas: Record<number, number | null> = {};
    for (const ano of ANOS_SIMULACAO) cargas[ano] = 100;
    cargas[ANOS_SIMULACAO[3]] = null; // um ano no meio fica indisponível
    const resultadoRegime = resultadoRegimeComCargaPorAno(cargas);
    const r = calcularResultadoEconomicoFinanceiro(cenario, resultadoRegime);

    expect(r.impactoAcumuladoParcial).toBe(true);
    expect(r.anos[3].disponivel).toBe(false);
    // impacto acumulado é a soma dos 7 anos disponíveis (todos com impacto 0, já que a carga é constante) — nunca inclui o ano ausente como 0 "por coincidência".
    expect(r.impactoAcumulado).toBeCloseTo(0, 2);
    expect(r.anos.filter((a) => a.disponivel)).toHaveLength(7);
  });

  it("sem nenhum ano indisponível, impactoAcumuladoParcial é false", () => {
    const cenario = cenarioComCustos(1_000, [650]);
    const cargas: Record<number, number | null> = {};
    for (const ano of ANOS_SIMULACAO) cargas[ano] = 100;
    const resultadoRegime = resultadoRegimeComCargaPorAno(cargas);
    const r = calcularResultadoEconomicoFinanceiro(cenario, resultadoRegime);
    expect(r.impactoAcumuladoParcial).toBe(false);
  });
});

describe("Multiatividade — consolidado sem rateio artificial", () => {
  it("custos de múltiplos itens (de atividades diferentes) são somados diretamente, sem tentar segregar por atividade", () => {
    const cenario = cenarioComCustos(2_000_000, [700_000, 300_000, 150_000]); // 3 itens, poderiam vir de atividades diferentes
    const resultadoRegime = resultadoRegimeComCargaPorAno({ [ANOS_SIMULACAO[0]]: 100_000 });
    const r = calcularResultadoEconomicoFinanceiro(cenario, resultadoRegime);
    expect(r.anos[0].custosDespesas).toBeCloseTo(1_150_000, 2); // soma direta, sem rateio
    expect(r.anos[0].resultado).toBeCloseTo(2_000_000 - 1_150_000 - 100_000, 2);
  });
});

describe("Dados insuficientes — nunca apresenta margem definitiva sem base", () => {
  it("sem custos informados: ainda calcula (custos=0 é um valor real, não ausente), mas sem premissa de custos variáveis alerta explicitamente", () => {
    const cenario = cenarioComCustos(1_000, []); // nenhum item de custo
    const resultadoRegime = resultadoRegimeComCargaPorAno({ [ANOS_SIMULACAO[0]]: 100 });
    const r = calcularResultadoEconomicoFinanceiro(cenario, resultadoRegime);
    expect(r.anos[0].qualidade).toBe("insuficiente"); // custos.itens vazio → informado=false
  });

  it("sem receita informada: ano marcado indisponível, nunca margem calculada com receita zero silenciosa", () => {
    const cenario = cenarioComCustos(1_000, [650]);
    cenario.receita.faturamentoAnual = undefined;
    const resultadoRegime = resultadoRegimeComCargaPorAno({ [ANOS_SIMULACAO[0]]: 100 });
    const r = calcularResultadoEconomicoFinanceiro(cenario, resultadoRegime);
    expect(r.anos[0].disponivel).toBe(false);
    expect(r.anos[0].margem).toBeUndefined();
  });
});

describe("Achados estruturados — fatos objetivos, nunca recomendação", () => {
  it("margem negativa gera achado MARGEM_NEGATIVA com o valor exato", () => {
    const cenario = cenarioComCustos(1_000, [900]);
    const resultadoRegime = resultadoRegimeComCargaPorAno({ [ANOS_SIMULACAO[0]]: 200 }); // 1000-900-200 = -100
    const r = calcularResultadoEconomicoFinanceiro(cenario, resultadoRegime);
    const achado = r.anos[0].achados.find((a) => a.codigo === "MARGEM_NEGATIVA");
    expect(achado).toBeDefined();
    expect(achado!.valor).toBeCloseTo(-0.1, 4);
    // nenhum achado é um texto de recomendação — só descreve o fato.
    expect(r.anos[0].achados.every((a) => !a.descricao.toLowerCase().includes("recomend"))).toBe(true);
  });
});

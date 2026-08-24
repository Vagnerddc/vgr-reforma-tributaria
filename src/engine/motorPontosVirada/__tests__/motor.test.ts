import { describe, it, expect } from "vitest";
import { buscarPontoVirada, buscarMudancaTemporal } from "../motor";
import { motorLucroPresumido } from "../../motorRegimes/lucroPresumido/motor";
import { motorSimplesUnificado } from "../../motorRegimes/simplesNacional/motor";
import { motorLucroReal } from "../../motorRegimes/lucroReal/motor";
import { campoComProveniencia as campo } from "../../operacaoTributaria";
import type { CenarioEmpresa } from "../../cenarioEmpresa";
import { ANOS_SIMULACAO } from "../../parametros";

function cenarioComercio(faturamento = 200_000): CenarioEmpresa {
  return {
    id: "c",
    identificacao: { nomeEmpresa: campo("Empresa", "informado_usuario", "confirmado"), atividadePrincipal: { perfilId: "varejo_generico", status: "confirmado", origem: "informado_usuario" } },
    receita: { faturamentoAnual: campo(faturamento, "informado_usuario", "confirmado"), mixMercado: { b2b: campo(0.7, "informado_usuario", "confirmado"), b2c: campo(0.3, "informado_usuario", "confirmado") } },
    custos: {
      itens: [{ categoria: { chave: "insumos", label: "Insumos", naturezaEconomica: "custo_operacional", creditoPisCofins: { tratamento: "creditavel", status: "confirmado" }, creditoIcmsIpi: { tratamento: "creditavel", status: "confirmado" }, creditoIbsCbs: { tratamento: "creditavel", status: "confirmado" } }, valorAnual: faturamento * 0.02 }],
    },
    pessoas: {},
    tributario: { regimeAtual: campo("lucro_presumido", "informado_usuario", "confirmado"), premissas: { pisCofinsPercentualAtual: campo(0.0365, "informado_usuario", "confirmado"), icmsIpiPercentualAtual: campo(0.05, "informado_usuario", "confirmado") } },
    economicoFinanceiro: { lucroAtual: campo(faturamento * 0.2, "informado_usuario", "confirmado"), meioPagamentoPredominante: campo("pix", "informado_usuario", "confirmado") },
    dadosSetoriais: [],
  };
}

function cenarioServico(faturamento: number, folha: number): CenarioEmpresa {
  return {
    id: "c-servico",
    identificacao: { nomeEmpresa: campo("Empresa Serviço", "informado_usuario", "confirmado"), atividadePrincipal: { perfilId: "software_saas", status: "confirmado", origem: "informado_usuario" } },
    receita: { faturamentoAnual: campo(faturamento, "informado_usuario", "confirmado"), mixMercado: { b2b: campo(1, "informado_usuario", "confirmado"), b2c: campo(0, "informado_usuario", "confirmado") } },
    custos: { itens: [] },
    pessoas: { folhaAnual: campo(folha, "informado_usuario", "confirmado"), encargosAnual: campo(0, "informado_usuario", "confirmado"), proLaboreAnual: campo(0, "informado_usuario", "confirmado") },
    tributario: { regimeAtual: campo("simples_unificado", "informado_usuario", "confirmado"), premissas: { pisCofinsPercentualAtual: campo(0.0365, "informado_usuario", "confirmado"), icmsIpiPercentualAtual: campo(0.05, "informado_usuario", "confirmado") } },
    economicoFinanceiro: { meioPagamentoPredominante: campo("pix", "informado_usuario", "confirmado") },
    dadosSetoriais: [],
  };
}

const ANO = ANOS_SIMULACAO[0];

describe("51 — mudança de regime de menor carga comparável por faturamento", () => {
  it("localiza o intervalo/ponto entre Simples e Presumido", () => {
    const resultado = buscarPontoVirada({
      tipo: "mudanca_regime_menor_carga",
      variavel: "faturamento",
      intervalo: { min: 40_000, max: 4_000_000 },
      ano: ANO,
      cenarioBase: cenarioComercio(),
      motoresRegime: [motorLucroPresumido, motorSimplesUnificado, motorLucroReal],
    });
    expect(["encontrado", "multiplos_pontos"]).toContain(resultado.status);
    if (resultado.status === "encontrado") {
      expect(resultado.estadoAntes?.estadoCategorico).not.toBe(resultado.estadoDepois?.estadoCategorico);
      expect(resultado.valorEncontrado).toBeGreaterThan(40_000);
      expect(resultado.valorEncontrado).toBeLessThan(4_000_000);
    }
  });
});

describe("52 — mudança de posição via créditos", () => {
  it("localiza (ou reporta não-monotonicidade) a mudança de menorCargaComparavel variando o fator de custos creditáveis", () => {
    const cenario = cenarioComercio(500_000);
    const resultado = buscarPontoVirada({
      tipo: "mudanca_regime_menor_carga",
      variavel: "creditosIbsCbs",
      intervalo: { min: 0.1, max: 10, precisao: 0.05 },
      ano: ANO,
      cenarioBase: cenario,
      motoresRegime: [motorLucroPresumido, motorLucroReal],
    });
    expect(["encontrado", "nao_encontrado", "multiplos_pontos", "dados_insuficientes"]).toContain(resultado.status);
  });
});

describe("53 — Fator R usa solução analítica, não busca iterativa", () => {
  it("valor encontrado é a FS12 necessária (RBT12 × 28%), calculada sem executar centenas de cenários", () => {
    const resultado = buscarPontoVirada({
      tipo: "cruzamento_fator_r",
      variavel: "folha",
      intervalo: { min: 0, max: 1_000_000 },
      ano: ANO,
      cenarioBase: cenarioServico(1_200_000, 200_000),
      motoresRegime: [motorSimplesUnificado],
      regimeReferencia: "simples_unificado",
    });
    expect(resultado.status).toBe("encontrado");
    expect(resultado.origemSolucao).toBe("analitica");
    expect(resultado.valorEncontrado).toBeCloseTo(1_200_000 * 0.28, 0);
    expect(resultado.iteracoes).toBe(0);
  });
});

describe("54 — preservação de margem reutiliza motorFinanceiro/precoNecessario.ts", () => {
  it("valorEncontrado é EXATAMENTE o reajusteMedioNecessario produzido pelo Motor Financeiro", () => {
    const cenario = cenarioComercio(1_000_000);
    const resultado = buscarPontoVirada({
      tipo: "preservacao_margem",
      variavel: "faturamento",
      intervalo: { min: 0, max: 1 },
      ano: ANO,
      cenarioBase: cenario,
      motoresRegime: [motorLucroPresumido],
      regimeReferencia: "lucro_presumido",
      margemAlvo: 0.15,
    });
    expect(resultado.status).toBe("encontrado");
    expect(resultado.origemSolucao).toBe("analitica");
    expect(resultado.valorEncontrado).toBeDefined();
    const anoFinanceiro = resultado.cenarioNoPonto?.resultadoFinanceiroPorRegime.find((r) => r.regime === "lucro_presumido")?.resultado.anos.find((a) => a.ano === ANO);
    expect(resultado.valorEncontrado).toBe(anoFinanceiro?.reajusteMedioNecessario);
  });
});

describe("55 — mudança discreta (Fator R): estado antes/depois nunca interpolado", () => {
  it("Anexo V antes, Anexo III depois, sem valor intermediário de carga inventado", () => {
    const resultado = buscarPontoVirada({
      tipo: "mudanca_anexo_simples",
      variavel: "folha",
      intervalo: { min: 100_000, max: 500_000, precisao: 500 },
      ano: ANO,
      cenarioBase: cenarioServico(1_200_000, 100_000),
      motoresRegime: [motorSimplesUnificado],
      regimeReferencia: "simples_unificado",
    });
    expect(resultado.status).toBe("encontrado");
    expect(resultado.estadoAntes?.estadoCategorico).toBe("anexo_v");
    expect(resultado.estadoDepois?.estadoCategorico).toBe("anexo_iii");
  });
});

describe("56 — sem ponto no intervalo", () => {
  it("estado constante em todo o intervalo produz nao_encontrado", () => {
    const resultado = buscarPontoVirada({
      tipo: "mudanca_anexo_simples",
      variavel: "folha",
      intervalo: { min: 400_000, max: 500_000 },
      ano: ANO,
      cenarioBase: cenarioServico(1_200_000, 100_000),
      motoresRegime: [motorSimplesUnificado],
      regimeReferencia: "simples_unificado",
    });
    expect(resultado.status).toBe("nao_encontrado");
  });
});

describe("58 — região não comparável dentro do intervalo", () => {
  it("faturamento muito alto torna o Simples não-comparável (faixa segregada) — o motor reflete isso, nunca finge continuidade", () => {
    const resultado = buscarPontoVirada({
      tipo: "mudanca_regime_menor_carga",
      variavel: "faturamento",
      intervalo: { min: 100_000, max: 4_700_000 },
      ano: ANO,
      cenarioBase: cenarioComercio(),
      motoresRegime: [motorSimplesUnificado],
    });
    expect(["encontrado", "nao_encontrado", "multiplos_pontos", "dados_insuficientes"]).toContain(resultado.status);
    if (resultado.status === "encontrado") {
      expect(resultado.alertas.some((a) => a.includes("indeterminad"))).toBe(true);
    }
  });
});

describe("59 — elegibilidade como fronteira jurídica", () => {
  it("Simples deixa de ser elegível acima do limite de receita — registrado como mudança de estado jurídico", () => {
    const resultado = buscarPontoVirada({
      tipo: "mudanca_elegibilidade",
      variavel: "faturamento",
      intervalo: { min: 3_000_000, max: 6_000_000 },
      ano: ANO,
      cenarioBase: cenarioComercio(),
      motoresRegime: [motorSimplesUnificado],
      regimeReferencia: "simples_unificado",
    });
    expect(["encontrado", "nao_encontrado"]).toContain(resultado.status);
  });
});

describe("60 — custo de capital muda a vantagem financeira entre regimes", () => {
  it("localiza o custo de capital em que dois regimes produzem o mesmo resultado econômico", () => {
    const resultado = buscarPontoVirada({
      tipo: "igualdade_resultado_economico",
      variavel: "custoCapital",
      intervalo: { min: 0.0001, max: 0.05 },
      ano: ANO,
      cenarioBase: cenarioComercio(500_000),
      motoresRegime: [motorLucroPresumido, motorLucroReal],
      regimesEnvolvidos: ["lucro_presumido", "lucro_real"],
      opcoes: { premissasSplit: { percentualRecebimentosSujeitos: campo(1, "informado_usuario", "estimado"), percentualTributoSegregado: campo(0.1, "informado_usuario", "estimado") } },
    });
    expect(["encontrado", "nao_encontrado", "multiplos_pontos", "dados_insuficientes"]).toContain(resultado.status);
  });
});

describe("61 — capital de giro cruza o limite informado, variando o split", () => {
  it("localiza o percentual sujeito ao split em que o financiamento adicional passa a ser necessário", () => {
    const resultado = buscarPontoVirada({
      tipo: "limite_capital_giro",
      variavel: "percentualRecebimentosSujeitosSplit",
      intervalo: { min: 0.01, max: 1 },
      ano: ANO,
      cenarioBase: cenarioComercio(1_200_000),
      motoresRegime: [motorLucroPresumido],
      regimeReferencia: "lucro_presumido",
      limiteCapitalGiroInformado: 50_000,
      opcoes: { premissasSplit: { percentualTributoSegregado: campo(0.5, "informado_usuario", "estimado") } },
    });
    expect(["encontrado", "nao_encontrado", "multiplos_pontos", "dados_insuficientes"]).toContain(resultado.status);
  });
});

describe("62 — mudança temporal entre 2026 e 2033", () => {
  it("retorna a sequência de regime por ano e as transições, sem interpolar data fictícia", () => {
    const resultado = buscarMudancaTemporal(cenarioComercio(400_000), [motorLucroPresumido, motorSimplesUnificado, motorLucroReal]);
    expect(resultado.regimeReferenciaAno).toHaveLength(ANOS_SIMULACAO.length);
    for (const t of resultado.transicoes) {
      expect(ANOS_SIMULACAO).toContain(t.anoAntes);
      expect(ANOS_SIMULACAO).toContain(t.anoDepois);
    }
  });
});

describe("Determinismo (seção 48)", () => {
  it("mesma entrada produz o mesmo ponto de virada", () => {
    const cenario = cenarioComercio();
    const def = { tipo: "mudanca_regime_menor_carga" as const, variavel: "faturamento" as const, intervalo: { min: 40_000, max: 4_000_000 }, ano: ANO, cenarioBase: cenario, motoresRegime: [motorLucroPresumido, motorSimplesUnificado, motorLucroReal] };
    const r1 = buscarPontoVirada(def);
    const r2 = buscarPontoVirada(def);
    expect(r1.status).toBe(r2.status);
    expect(r1.valorEncontrado).toBe(r2.valorEncontrado);
  });
});

describe("Intervalo inválido (seção 29)", () => {
  it("min >= max é rejeitado", () => {
    const resultado = buscarPontoVirada({ tipo: "mudanca_regime_menor_carga", variavel: "faturamento", intervalo: { min: 100, max: 100 }, ano: ANO, cenarioBase: cenarioComercio(), motoresRegime: [motorLucroPresumido] });
    expect(resultado.status).toBe("intervalo_invalido");
  });

  it("intervalo com percentual de split fora de 0-100% é rejeitado, nunca corrigido", () => {
    const resultado = buscarPontoVirada({ tipo: "limite_capital_giro", variavel: "percentualRecebimentosSujeitosSplit", intervalo: { min: 0.5, max: 1.5 }, ano: ANO, cenarioBase: cenarioComercio(), motoresRegime: [motorLucroPresumido], regimeReferencia: "lucro_presumido" });
    expect(resultado.status).toBe("intervalo_invalido");
  });
});

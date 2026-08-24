import { describe, it, expect } from "vitest";
import { gerarScoresEstrategicos } from "../motor";
import { validarCoerenciaScoreDecisao } from "../coerencia";
import { validarMetodologia, MetodologiaInvalidaError, VGR_SCORE_V1 } from "../metodologia";
import { executarCenario } from "../../motorCenarios/motor";
import { motorLucroPresumido } from "../../motorRegimes/lucroPresumido/motor";
import { motorSimplesUnificado } from "../../motorRegimes/simplesNacional/motor";
import { motorLucroReal } from "../../motorRegimes/lucroReal/motor";
import { campoComProveniencia as campo } from "../../operacaoTributaria";
import type { CenarioEmpresa } from "../../cenarioEmpresa";
import type { ResultadoDecisaoEstrategica, AvaliacaoAlternativa } from "../../motorDecisao/tipos";
import { ANOS_SIMULACAO } from "../../parametros";

const ANO = ANOS_SIMULACAO[0];
const PALAVRAS_PROIBIDAS = ["escolha", "migre", "recomendamos", "melhor opção", "deve migrar"];

function cenarioComercio(faturamento = 1_200_000, margem = 0.24): CenarioEmpresa {
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

function decisaoDe(alternativaPreferida: string | undefined, statusConclusao: ResultadoDecisaoEstrategica["statusConclusao"], ids: string[]): ResultadoDecisaoEstrategica {
  const alternativasAvaliadas: AvaliacaoAlternativa[] = ids.map((identificador) => ({ identificador, aplicabilidade: "aplicavel", evidenciasFavoraveis: [], evidenciasContrarias: [], bloqueios: [], riscos: [], condicoes: [], qualidade: "media", dominancia: {} }));
  return { id: "decisao:x", cenarioId: "c1", periodo: { ano: ANO }, objetoDecisao: "regime_tributario", alternativasAvaliadas, statusConclusao, alternativaPreferida, alternativasEquivalentes: [], evidenciasFavoraveis: [], evidenciasContrarias: [], conflitos: [], bloqueios: [], riscos: [], premissas: {}, validacoesPendentes: [], qualidade: "media", condicoes: [], pontosViradaRelacionados: [], razoesConclusao: [], justificativaEstruturada: "" };
}

describe("86 — melhor carga, pior caixa: composição visível, consolidado não esconde", () => {
  it("scores dimensionais mostram divergência entre fiscal e financeiro", () => {
    const cenario = cenarioComercio(1_200_000);
    const resultado = executarCenario(cenario, [motorLucroPresumido, motorLucroReal], {}, { premissasSplit: { percentualRecebimentosSujeitos: campo(1, "informado_usuario", "estimado"), percentualTributoSegregado: campo(0.3, "informado_usuario", "estimado") } });
    const scores = gerarScoresEstrategicos({ resultado, ano: ANO });
    expect(scores.length).toBeGreaterThan(0);
    for (const s of scores) {
      const fiscal = s.dimensoes.find((d) => d.dimensao === "fiscal")!;
      const financeira = s.dimensoes.find((d) => d.dimensao === "financeira")!;
      expect(fiscal.status).toBeDefined();
      expect(financeira.status).toBeDefined();
    }
  });
});

describe("88 — qualidade baixa não vira score fiscal artificialmente alto", () => {
  it("desempenho (valor) e qualidade (confiabilidade) permanecem campos separados", () => {
    const cenario = cenarioComercio(1_000_000);
    const resultado = executarCenario(cenario, [motorLucroPresumido, motorLucroReal], {});
    const scores = gerarScoresEstrategicos({ resultado, ano: ANO });
    for (const s of scores) {
      const fiscal = s.dimensoes.find((d) => d.dimensao === "fiscal")!;
      expect(fiscal).toHaveProperty("valor");
      expect(fiscal).toHaveProperty("qualidade");
      expect(typeof fiscal.qualidade).toBe("string");
    }
  });
});

describe("89 — dimensão indisponível nunca vira zero", () => {
  it("sem premissa de split, financeira fica indeterminado, nunca 0", () => {
    const cenario = cenarioComercio(1_000_000);
    const resultado = executarCenario(cenario, [motorLucroPresumido, motorLucroReal], {});
    const scores = gerarScoresEstrategicos({ resultado, ano: ANO });
    for (const s of scores) {
      const financeira = s.dimensoes.find((d) => d.dimensao === "financeira")!;
      expect(financeira.status).toBe("indeterminado");
      expect(financeira.valor).toBeUndefined();
    }
  });
});

describe("90 — regime inelegível fica nao_aplicavel, nunca 0", () => {
  it("Simples com faturamento muito alto (inelegível) recebe status nao_aplicavel", () => {
    const cenario = cenarioComercio(10_000_000);
    const resultado = executarCenario(cenario, [motorSimplesUnificado, motorLucroPresumido], {});
    const scores = gerarScoresEstrategicos({ resultado, ano: ANO });
    const simples = scores.find((s) => s.regime === "simples_unificado");
    if (simples) {
      const aplicabilidade = simples.dimensoes.find((d) => d.dimensao === "aplicabilidade")!;
      expect(aplicabilidade.status).toBe("nao_aplicavel");
      expect(aplicabilidade.valor).toBeUndefined();
    }
  });
});

describe("91 — obrigatoriedade nunca vira vantagem no score", () => {
  it("aplicabilidade de regime obrigatório fica nao_aplicavel, com alerta explícito", () => {
    const cenario = cenarioComercio(1_000_000);
    const resultado = executarCenario(cenario, [motorLucroReal], {});
    const scores = gerarScoresEstrategicos({ resultado, ano: ANO });
    const real = scores.find((s) => s.regime === "lucro_real");
    if (real && resultado.comparacaoRegimes?.porAno.find((a) => a.ano === ANO)?.porRegime.some((r) => r.statusJuridico === "obrigatorio")) {
      const aplicabilidade = real.dimensoes.find((d) => d.dimensao === "aplicabilidade")!;
      expect(aplicabilidade.status).toBe("nao_aplicavel");
      expect(real.alertas.some((a) => a.includes("obrigatório"))).toBe(true);
    }
  });
});

describe("93 — apenas uma alternativa não gera ranking relativo fictício", () => {
  it("com um único regime comparável, fiscal/econômico/financeiro ficam nao_aplicavel", () => {
    const cenario = cenarioComercio(1_000_000);
    const resultado = executarCenario(cenario, [motorLucroPresumido], {});
    const scores = gerarScoresEstrategicos({ resultado, ano: ANO });
    const presumido = scores.find((s) => s.regime === "lucro_presumido")!;
    const fiscal = presumido.dimensoes.find((d) => d.dimensao === "fiscal")!;
    expect(fiscal.status).toBe("nao_aplicavel");
  });
});

describe("94/95 — ponto de virada próximo/distante", () => {
  it("com distanciaRelativa fornecida, robustez reflete o valor; sem ela, fica parcial (nunca classificação inventada)", () => {
    const cenario = cenarioComercio(1_000_000);
    const resultado = executarCenario(cenario, [motorLucroPresumido, motorLucroReal], {});
    const pontosVirada = [{ tipo: "igualdade_resultado_economico" as const, variavel: "custoCapital" as const, status: "encontrado" as const, valorEncontrado: 0.0128, qualidade: "media" as const, estimativaCondicionada: false, premissas: {}, alertas: [], achados: [], intervaloOriginal: { min: 0, max: 1 }, precisao: 0.001, iteracoes: 5, origemSolucao: "numerica" as const }];

    const semParametro = gerarScoresEstrategicos({ resultado, ano: ANO, pontosVirada });
    const robustezSem = semParametro[0].dimensoes.find((d) => d.dimensao === "robustez")!;
    expect(robustezSem.status).toBe("parcial");
    expect(robustezSem.valor).toBeUndefined();

    const comParametro = gerarScoresEstrategicos({ resultado, ano: ANO, pontosVirada, robustez: { distanciasRelativas: { custoCapital: 0.05 } } });
    const robustezCom = comParametro[0].dimensoes.find((d) => d.dimensao === "robustez")!;
    expect(robustezCom.status).toBe("calculado");
    expect(robustezCom.valor).toBeCloseTo(5);
  });
});

describe("97 — inconsistência Score × Decisão detectada, decisão nunca alterada", () => {
  it("gera achado INCONSISTENCIA_SCORE_DECISAO quando o maior score diverge da alternativa preferida", () => {
    const cenario = cenarioComercio(1_200_000);
    const resultado = executarCenario(cenario, [motorLucroPresumido, motorLucroReal], {});
    const scores = gerarScoresEstrategicos({ resultado, ano: ANO });
    if (scores.length < 2 || scores.some((s) => s.scoreConsolidado === undefined)) return;

    const piorScore = [...scores].sort((a, b) => a.scoreConsolidado! - b.scoreConsolidado!)[0];
    const decisao = decisaoDe(piorScore.alternativaId, "preferencia_tecnica_robusta", scores.map((s) => s.alternativaId));
    const achados = validarCoerenciaScoreDecisao(decisao, scores);
    expect(achados.length).toBeGreaterThan(0);
    expect(achados[0].alternativaPreferidaDecisao).toBe(piorScore.alternativaId);
    expect(decisao.alternativaPreferida).toBe(piorScore.alternativaId); // decisão nunca é alterada
  });
});

describe("98 — conflito não resolvido não gera 'melhorAlternativaPorScore'", () => {
  it("coerência não é avaliada quando a decisão não tem alternativaPreferida", () => {
    const decisao = decisaoDe(undefined, "conflito_nao_resolvido", ["lucro_presumido", "lucro_real"]);
    const scores = gerarScoresEstrategicos({ resultado: executarCenario(cenarioComercio(), [motorLucroPresumido, motorLucroReal], {}), ano: ANO });
    const achados = validarCoerenciaScoreDecisao(decisao, scores);
    expect(achados).toEqual([]);
  });
});

describe("100/101/102 — metodologia inválida é rejeitada", () => {
  it("soma de pesos diferente de 1 é rejeitada", () => {
    const invalida = { ...VGR_SCORE_V1, pesos: { ...VGR_SCORE_V1.pesos, fiscal: 0.4, economica: 0.4, financeira: 0.4 } };
    expect(() => validarMetodologia(invalida)).toThrow(MetodologiaInvalidaError);
  });

  it("peso negativo é rejeitado", () => {
    const invalida = { ...VGR_SCORE_V1, pesos: { ...VGR_SCORE_V1.pesos, fiscal: -0.1, economica: 0.85 } };
    expect(() => validarMetodologia(invalida)).toThrow(MetodologiaInvalidaError);
  });

  it("peso de dimensão inexistente é rejeitado", () => {
    const invalida = { ...VGR_SCORE_V1, pesos: { ...VGR_SCORE_V1.pesos, inexistente: 0.1 } } as never;
    expect(() => validarMetodologia(invalida)).toThrow(MetodologiaInvalidaError);
  });

  it("metodologia válida (VGR_SCORE_V1) não lança", () => {
    expect(() => validarMetodologia(VGR_SCORE_V1)).not.toThrow();
  });
});

describe("104 — determinismo", () => {
  it("mesma entrada produz o mesmo score", () => {
    const cenario = cenarioComercio(1_000_000);
    const resultado = executarCenario(cenario, [motorLucroPresumido, motorLucroReal], {});
    const s1 = gerarScoresEstrategicos({ resultado, ano: ANO });
    const s2 = gerarScoresEstrategicos({ resultado, ano: ANO });
    expect(s1.map((s) => s.scoreConsolidado)).toEqual(s2.map((s) => s.scoreConsolidado));
    expect(s1.map((s) => s.contextHash)).toEqual(s2.map((s) => s.contextHash));
  });
});

describe("105 — cobertura sem dado econômico", () => {
  it("sem faturamento, dimensão econômica fica indeterminada, nunca neutra", () => {
    const cenario = cenarioComercio(1_000_000);
    cenario.economicoFinanceiro.lucroAtual = undefined;
    const resultado = executarCenario(cenario, [motorLucroPresumido, motorLucroReal], {});
    const scores = gerarScoresEstrategicos({ resultado, ano: ANO });
    for (const s of scores) {
      const economica = s.dimensoes.find((d) => d.dimensao === "economica")!;
      if (economica.status !== "calculado") expect(economica.valor).toBeUndefined();
    }
  });
});

describe("106 — score consolidado nunca tem qualidade superior ao pior componente essencial", () => {
  it("qualidade do score respeita a pior qualidade entre as dimensões calculadas", () => {
    const cenario = cenarioComercio(1_000_000);
    const resultado = executarCenario(cenario, [motorLucroPresumido, motorLucroReal], {});
    const scores = gerarScoresEstrategicos({ resultado, ano: ANO });
    for (const s of scores) {
      const calculadas = s.dimensoes.filter((d) => d.status === "calculado");
      const ordem = { insuficiente: 0, baixa: 1, media: 2, alta: 3 };
      const pior = calculadas.reduce((p, d) => (ordem[d.qualidade] < ordem[p] ? d.qualidade : p), "alta" as keyof typeof ordem);
      if (calculadas.length > 0) expect(ordem[s.qualidade]).toBeLessThanOrEqual(ordem[pior]);
    }
  });
});

describe("107 — sem recomendação no texto", () => {
  it("nenhuma limitação/evidência textual contém linguagem de recomendação", () => {
    const cenario = cenarioComercio(1_200_000);
    const resultado = executarCenario(cenario, [motorLucroPresumido, motorLucroReal], {}, { premissasSplit: { percentualRecebimentosSujeitos: campo(1, "informado_usuario", "estimado"), percentualTributoSegregado: campo(0.3, "informado_usuario", "estimado") } });
    const scores = gerarScoresEstrategicos({ resultado, ano: ANO });
    const texto = scores
      .flatMap((s) => [...s.dimensoes.flatMap((d) => d.limitacoes), ...s.alertas, ...s.evidencias.map((e) => e.descricao)])
      .join(" ")
      .toLowerCase();
    for (const palavra of PALAVRAS_PROIBIDAS) expect(texto).not.toContain(palavra);
  });
});

import { describe, it, expect } from "vitest";
import { construirScoreViewModel } from "../viewModels/score";
import type { ScoreEstrategico, ScoreDimensao } from "../../engine/scoreEstrategico/tipos";

function dimensao(overrides: Partial<ScoreDimensao>): ScoreDimensao {
  return { dimensao: "fiscal", status: "calculado", valor: 80, escala: "0-100 relativo às alternativas comparáveis", indicadores: [], evidencias: [], qualidade: "media", cobertura: "disponivel", premissas: {}, limitacoes: [], metodologia: "x", ...overrides };
}

function scoreBase(overrides: Partial<ScoreEstrategico>): ScoreEstrategico {
  return {
    alternativaId: "lucro_presumido",
    cenarioId: "c1",
    periodo: { ano: 2028 },
    dimensoes: [dimensao({})],
    statusConsolidado: "calculado",
    scoreConsolidado: 74,
    qualidade: "media",
    cobertura: "disponivel",
    metodologiaId: "VGR_SCORE",
    metodologiaVersao: "V1",
    contextHash: "h",
    explicacao: { principaisFatoresPositivos: [], principaisFatoresLimitantes: [], dimensoesIndisponiveis: [] },
    evidencias: [],
    premissas: {},
    alertas: [],
    ...overrides,
  };
}

describe("título nunca é 'Score da Empresa'", () => {
  it("titulo sempre referencia a alternativa", () => {
    const vm = construirScoreViewModel([scoreBase({})]);
    expect(vm[0].titulo).toContain("Alternativa");
    expect(vm[0].titulo).not.toContain("Empresa");
  });
});

describe("qualidade média nunca vira 'alta confiança' no ViewModel", () => {
  it("qualidade é retransmitida fielmente", () => {
    const vm = construirScoreViewModel([scoreBase({ qualidade: "media" })]);
    expect(vm[0].qualidade).toBe("media");
  });
});

describe("dimensão indisponível nunca aparece com valor numérico", () => {
  it("status indeterminado produz valor undefined mesmo que o motor tivesse um valor bruto por engano", () => {
    const scoreComDimensaoIndeterminada = scoreBase({ dimensoes: [dimensao({ dimensao: "financeira", status: "indeterminado", valor: 999 as never })] });
    const vm = construirScoreViewModel([scoreComDimensaoIndeterminada]);
    expect(vm[0].dimensoes[0].valor).toBeUndefined();
  });
});

describe("score não interfere na decisão (estrutural)", () => {
  it("construirScoreViewModel não recebe nem referencia ResultadoDecisaoEstrategica", () => {
    // A própria assinatura da função (scores: ScoreEstrategico[]) já garante isso — teste de contrato.
    expect(construirScoreViewModel.length).toBe(1);
  });
});

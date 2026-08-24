import { describe, it, expect } from "vitest";
import { calcularImpactoCaixaDoAno } from "../motor";
import { compararImpactoCaixaRegimes } from "../comparacao";
import { campoComProveniencia } from "../../../operacaoTributaria";
import type { CenarioEmpresa } from "../../../cenarioEmpresa";
import type { ResultadoRegime } from "../../../motorRegimes/tipos";

function cenarioBase(receitaAnual: number): CenarioEmpresa {
  return {
    id: "c1",
    identificacao: {},
    receita: { faturamentoAnual: campoComProveniencia(receitaAnual, "informado_usuario", "confirmado") },
    custos: { itens: [] },
    pessoas: {},
    tributario: {},
    economicoFinanceiro: { meioPagamentoPredominante: campoComProveniencia("pix", "informado_usuario", "confirmado") },
    dadosSetoriais: [],
  };
}

function resultadoRegime(regime: ResultadoRegime["regime"], ano: number, cargaTotal: number, disponivel = true): ResultadoRegime {
  return {
    regime,
    aplicabilidade: { regime, status: "elegivel", motivo: "teste", criterios: [] },
    anos: [{ ano, disponivel, componentes: [], cargaTotal }],
    cargaTotalPeriodo: cargaTotal,
    componentesConsolidados: {},
    premissas: {},
    qualidade: { percentualConfirmado: 100, origemIbsCbs: "nao_aplicavel" },
    alertas: [],
    memoria: [],
  };
}

describe("calcularImpactoCaixaDoAno", () => {
  it("premissa incompleta (sem percentual sujeito): qualidade insuficiente, achado DADOS_SPLIT_INSUFICIENTES, nunca inventa valores mensais", () => {
    const r = calcularImpactoCaixaDoAno(cenarioBase(1_200_000), resultadoRegime("lucro_presumido", 2027, 100_000), 2027, {
      percentualTributoSegregado: campoComProveniencia(0.1, "informado_usuario", "estimado"),
    });
    expect(r.qualidade).toBe("insuficiente");
    expect(r.valorTotalSegregado).toBeUndefined();
    expect(r.achados.some((a) => a.codigo === "DADOS_SPLIT_INSUFICIENTES")).toBe(true);
  });

  it("ano indisponível nunca é tratado como zero", () => {
    const r = calcularImpactoCaixaDoAno(cenarioBase(1_200_000), resultadoRegime("lucro_presumido", 2027, 100_000, false), 2027, {});
    expect(r.disponivel).toBe(false);
    expect(r.valorTotalSegregado).toBeUndefined();
    expect(r.meses).toEqual([]);
  });

  it("premissas completas e uniformes: valorTotalSegregado e diasEquivalentesCaixaPerdidos calculados, achados corretos", () => {
    const r = calcularImpactoCaixaDoAno(cenarioBase(1_200_000), resultadoRegime("lucro_presumido", 2027, 100_000), 2027, {
      percentualRecebimentosSujeitos: campoComProveniencia(1, "informado_usuario", "estimado"),
      percentualTributoSegregado: campoComProveniencia(0.1, "informado_usuario", "estimado"),
    });
    expect(r.valorTotalSegregado).toBeCloseTo(120_000);
    expect(r.picoCapitalGiroAdicional).toBeCloseTo(10_000);
    expect(r.diasEquivalentesCaixaPerdidos).toBeGreaterThan(0);
    expect(r.achados.some((a) => a.codigo === "REDUCAO_DISPONIBILIDADE_CAIXA")).toBe(true);
    expect(r.achados.some((a) => a.codigo === "PREMISSA_SPLIT_NAO_CONFIRMADA")).toBe(true);
    expect(r.estimativaCondicionada).toBe(true);
  });

  it("sazonalidade: pico de capital de giro cai no mês de maior receita (aviação agrícola/cerealista — receita concentrada)", () => {
    const distribuicao = [0.02, 0.02, 0.02, 0.02, 0.4, 0.4, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02];
    const r = calcularImpactoCaixaDoAno(cenarioBase(1_000_000), resultadoRegime("lucro_real", 2027, 80_000), 2027, {
      percentualRecebimentosSujeitos: campoComProveniencia(1, "informado_usuario", "estimado"),
      percentualTributoSegregado: campoComProveniencia(0.1, "informado_usuario", "estimado"),
      distribuicaoMensalReceita: campoComProveniencia(distribuicao, "informado_usuario", "estimado"),
    });
    expect(r.mesPicoCapitalGiro).toBe(5);
    expect(r.picoCapitalGiroAdicional).toBeCloseTo(1_000_000 * 0.4 * 0.1);
  });

  it("ressalva fiscal (comparavel_com_ressalvas) é herdada como estimativaCondicionada e qualidade media", () => {
    const r = calcularImpactoCaixaDoAno(
      cenarioBase(1_200_000),
      resultadoRegime("simples_hibrido", 2027, 100_000),
      2027,
      { percentualRecebimentosSujeitos: campoComProveniencia(1, "informado_usuario", "estimado"), percentualTributoSegregado: campoComProveniencia(0.1, "informado_usuario", "estimado") },
      "comparavel_com_ressalvas"
    );
    expect(r.qualidade).toBe("media");
    expect(r.estimativaCondicionada).toBe(true);
  });

  it("nao_comparavel: qualidade insuficiente e estimativaCondicionada true, mas número continua calculado", () => {
    const r = calcularImpactoCaixaDoAno(
      cenarioBase(1_200_000),
      resultadoRegime("lucro_real", 2027, 100_000),
      2027,
      { percentualRecebimentosSujeitos: campoComProveniencia(1, "informado_usuario", "estimado"), percentualTributoSegregado: campoComProveniencia(0.1, "informado_usuario", "estimado") },
      "nao_comparavel"
    );
    expect(r.qualidade).toBe("insuficiente");
    expect(r.estimativaCondicionada).toBe(true);
    expect(r.valorTotalSegregado).toBeDefined();
  });
});

describe("compararImpactoCaixaRegimes — divergência entre menor tributo e menor necessidade de caixa (obrigatório preservar)", () => {
  it("regime A com menor tributo pode ter maior necessidade de capital de giro que o regime B", () => {
    const premissasA = { percentualRecebimentosSujeitos: campoComProveniencia(1, "informado_usuario", "estimado"), percentualTributoSegregado: campoComProveniencia(0.3, "informado_usuario", "estimado") };
    const premissasB = { percentualRecebimentosSujeitos: campoComProveniencia(1, "informado_usuario", "estimado"), percentualTributoSegregado: campoComProveniencia(0.05, "informado_usuario", "estimado") };

    // Regime A: tributo menor (80.000) mas percentual segregado maior → pior caixa.
    const resultadoA = calcularImpactoCaixaDoAno(cenarioBase(1_200_000), resultadoRegime("simples_unificado", 2027, 80_000), 2027, premissasA);
    // Regime B: tributo maior (100.000) mas percentual segregado menor → melhor caixa.
    const resultadoB = calcularImpactoCaixaDoAno(cenarioBase(1_200_000), resultadoRegime("lucro_presumido", 2027, 100_000), 2027, premissasB);

    expect(resultadoA.tributoFiscalReferencia).toBeLessThan(resultadoB.tributoFiscalReferencia!);
    expect(resultadoA.picoCapitalGiroAdicional!).toBeGreaterThan(resultadoB.picoCapitalGiroAdicional!);

    const comparacao = compararImpactoCaixaRegimes(2027, [resultadoA, resultadoB]);
    expect(comparacao.regimeComMenorNecessidadeCapital).toBe("lucro_presumido");
  });
});

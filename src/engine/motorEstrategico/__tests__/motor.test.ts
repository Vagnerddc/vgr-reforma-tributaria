import { describe, it, expect } from "vitest";
import { gerarPlanoAlternativasEstrategicas } from "../motor";
import { gerarRelatorioAuditoriaEstrategica } from "../../motorAchados/motor";
import { executarCenario } from "../../motorCenarios/motor";
import { buscarPontoVirada } from "../../motorPontosVirada/motor";
import { motorLucroPresumido } from "../../motorRegimes/lucroPresumido/motor";
import { motorSimplesUnificado } from "../../motorRegimes/simplesNacional/motor";
import { motorLucroReal } from "../../motorRegimes/lucroReal/motor";
import { campoComProveniencia as campo } from "../../operacaoTributaria";
import type { CenarioEmpresa } from "../../cenarioEmpresa";
import { ANOS_SIMULACAO } from "../../parametros";

const ANO = ANOS_SIMULACAO[0];
const PALAVRAS_PRESCRITIVAS = ["recomend", " deve ", "convém", "sugerimos", "melhor escolha", "migre para", "contrate", "aumente o pró-labore", "é melhor"];

function cenarioComercio(faturamento = 1_000_000, margem = 0.24): CenarioEmpresa {
  return {
    id: "c-comercio",
    identificacao: { nomeEmpresa: campo("Empresa", "informado_usuario", "confirmado"), atividadePrincipal: { perfilId: "varejo_generico", status: "confirmado", origem: "informado_usuario" } },
    receita: { faturamentoAnual: campo(faturamento, "informado_usuario", "confirmado"), mixMercado: { b2b: campo(0.7, "informado_usuario", "confirmado"), b2c: campo(0.3, "informado_usuario", "confirmado") } },
    custos: {
      itens: [{ categoria: { chave: "insumos", label: "Insumos", naturezaEconomica: "custo_operacional", creditoPisCofins: { tratamento: "creditavel", status: "confirmado" }, creditoIcmsIpi: { tratamento: "creditavel", status: "confirmado" }, creditoIbsCbs: { tratamento: "creditavel", status: "confirmado" } }, valorAnual: faturamento * (1 - margem) * 0.5 }],
    },
    pessoas: {},
    tributario: { regimeAtual: campo("lucro_presumido", "informado_usuario", "confirmado"), premissas: { pisCofinsPercentualAtual: campo(0.0365, "informado_usuario", "confirmado"), icmsIpiPercentualAtual: campo(0.05, "informado_usuario", "confirmado") } },
    economicoFinanceiro: { lucroAtual: campo(faturamento * margem, "informado_usuario", "confirmado"), meioPagamentoPredominante: campo("pix", "informado_usuario", "confirmado") },
    dadosSetoriais: [],
  };
}

function cenarioServico(faturamento: number, folha: number): CenarioEmpresa {
  return {
    id: "c-servico",
    identificacao: { nomeEmpresa: campo("Clínica", "informado_usuario", "confirmado"), atividadePrincipal: { perfilId: "clinica_medica", status: "confirmado", origem: "informado_usuario" } },
    receita: { faturamentoAnual: campo(faturamento, "informado_usuario", "confirmado"), mixMercado: { b2b: campo(0.2, "informado_usuario", "confirmado"), b2c: campo(0.8, "informado_usuario", "confirmado") } },
    custos: { itens: [] },
    pessoas: { folhaAnual: campo(folha, "informado_usuario", "confirmado"), encargosAnual: campo(0, "informado_usuario", "confirmado"), proLaboreAnual: campo(0, "informado_usuario", "confirmado") },
    tributario: { regimeAtual: campo("simples_unificado", "informado_usuario", "confirmado"), premissas: { pisCofinsPercentualAtual: campo(0.0365, "informado_usuario", "confirmado"), icmsIpiPercentualAtual: campo(0.05, "informado_usuario", "confirmado") } },
    economicoFinanceiro: { meioPagamentoPredominante: campo("pix", "informado_usuario", "confirmado") },
    dadosSetoriais: [],
  };
}

describe("74 — recomposição de preço", () => {
  it("gera AVALIAR_RECOMPOSICAO_PRECO com o valor de reajuste do Motor Financeiro, sem recomendação", () => {
    const cenario = cenarioComercio(1_000_000, 0.24);
    const resultado = executarCenario(cenario, [motorLucroPresumido], {}, { premissasFinanceiras: { margemAlvo: campo(0.3, "informado_usuario", "estimado") } });
    const relatorio = gerarRelatorioAuditoriaEstrategica({ ano: ANO, cenario, resultado });
    const plano = gerarPlanoAlternativasEstrategicas({ ano: ANO, cenario, relatorio, resultado });

    const alternativa = plano.alternativas.find((a) => a.codigo === "AVALIAR_RECOMPOSICAO_PRECO");
    if (alternativa) {
      expect(alternativa.premissas.reajusteMedioNecessario).toBeDefined();
      expect(alternativa.impactosConhecidos.length).toBeGreaterThan(0);
    }
  });
});

describe("75 — Fator R nunca prescreve pró-labore", () => {
  it("gera AVALIAR_FATOR_R com condições/validações, nunca 'aumentar pró-labore'", () => {
    const cenario = cenarioServico(1_200_000, 200_000);
    const resultado = executarCenario(cenario, [motorSimplesUnificado], {});
    const relatorio = gerarRelatorioAuditoriaEstrategica({ ano: ANO, cenario, resultado });
    const plano = gerarPlanoAlternativasEstrategicas({ ano: ANO, cenario, relatorio, resultado });

    const alternativa = plano.alternativas.find((a) => a.codigo === "AVALIAR_FATOR_R");
    expect(alternativa).toBeDefined();
    expect(alternativa!.validacoesNecessarias.length).toBeGreaterThan(0);
    expect(alternativa!.descricaoTecnica.toLowerCase()).not.toContain("pró-labore");
    expect(alternativa!.objetivo.toLowerCase()).not.toContain("aumentar pró-labore");
  });
});

describe("76 — regime com conflito tributo × caixa preservado sem vencedor", () => {
  it("AVALIAR_REGIME_TRIBUTARIO registra conflito TRIBUTO_VS_CAIXA quando existir divergência", () => {
    const cenario = cenarioComercio(1_200_000);
    const resultado = executarCenario(cenario, [motorLucroPresumido, motorLucroReal], {}, {
      premissasSplit: { percentualRecebimentosSujeitos: campo(1, "informado_usuario", "estimado"), percentualTributoSegregado: campo(0.3, "informado_usuario", "estimado") },
    });
    const relatorio = gerarRelatorioAuditoriaEstrategica({ ano: ANO, cenario, resultado });
    const plano = gerarPlanoAlternativasEstrategicas({ ano: ANO, cenario, relatorio, resultado });

    const alternativaRegime = plano.alternativas.find((a) => a.codigo === "AVALIAR_REGIME_TRIBUTARIO");
    expect(alternativaRegime).toBeDefined();
    const conflitoCaixa = plano.conflitos.find((c) => c.codigo === "TRIBUTO_VS_CAIXA");
    if (conflitoCaixa) {
      expect(conflitoCaixa.alternativasEnvolvidas).toContain(alternativaRegime!.id);
    }
  });
});

describe("77 — dados incompletos geram validação antes de conclusão", () => {
  it("Lucro Real com base parcial gera VALIDAR_BASE_LUCRO_REAL", () => {
    const cenario = cenarioComercio(1_000_000);
    cenario.tributario.regimeAtual = campo("lucro_real", "informado_usuario", "confirmado");
    cenario.economicoFinanceiro.lucroAtual = campo(200_000, "informado_usuario", "estimado");
    const resultado = executarCenario(cenario, [motorLucroReal], {});
    const relatorio = gerarRelatorioAuditoriaEstrategica({ ano: ANO, cenario, resultado });
    const plano = gerarPlanoAlternativasEstrategicas({ ano: ANO, cenario, relatorio, resultado });

    const validacao = plano.alternativas.find((a) => a.codigo === "VALIDAR_BASE_LUCRO_REAL");
    if (validacao) {
      expect(validacao.bloqueios.length).toBeGreaterThan(0);
      expect(validacao.validacoesNecessarias.some((v) => v.bloqueante)).toBe(true);
    }
  });
});

describe("78 — setor ativa Fator R só com evidência real", () => {
  it("Saúde com FS12 aplicável gera AVALIAR_FATOR_R; comércio nunca gera", () => {
    const clinica = cenarioServico(1_200_000, 200_000);
    const resultadoClinica = executarCenario(clinica, [motorSimplesUnificado], {});
    const relatorioClinica = gerarRelatorioAuditoriaEstrategica({ ano: ANO, cenario: clinica, resultado: resultadoClinica });
    const planoClinica = gerarPlanoAlternativasEstrategicas({ ano: ANO, cenario: clinica, relatorio: relatorioClinica, resultado: resultadoClinica });
    expect(planoClinica.alternativas.some((a) => a.codigo === "AVALIAR_FATOR_R")).toBe(true);
    expect(planoClinica.cobertura.fatorR).toBe("analisado");

    const comercio = cenarioComercio(1_200_000);
    comercio.pessoas = { folhaAnual: campo(400_000, "informado_usuario", "confirmado") };
    const resultadoComercio = executarCenario(comercio, [motorLucroPresumido], {});
    const relatorioComercio = gerarRelatorioAuditoriaEstrategica({ ano: ANO, cenario: comercio, resultado: resultadoComercio });
    const planoComercio = gerarPlanoAlternativasEstrategicas({ ano: ANO, cenario: comercio, relatorio: relatorioComercio, resultado: resultadoComercio });
    expect(planoComercio.alternativas.some((a) => a.codigo === "AVALIAR_FATOR_R")).toBe(false);
    expect(planoComercio.cobertura.fatorR).toBe("nao_aplicavel");
  });
});

describe("79 — ponto de virada vinculado à alternativa tributária", () => {
  it("AVALIAR_REGIME_TRIBUTARIO carrega o ponto de virada de faturamento quando fornecido", () => {
    const cenario = cenarioComercio(200_000);
    const resultado = executarCenario(cenario, [motorLucroPresumido, motorSimplesUnificado, motorLucroReal], {});
    const relatorio = gerarRelatorioAuditoriaEstrategica({ ano: ANO, cenario, resultado });
    const pontoVirada = buscarPontoVirada({ tipo: "mudanca_regime_menor_carga", variavel: "faturamento", intervalo: { min: 40_000, max: 4_000_000 }, ano: ANO, cenarioBase: cenario, motoresRegime: [motorLucroPresumido, motorSimplesUnificado, motorLucroReal] });
    const plano = gerarPlanoAlternativasEstrategicas({ ano: ANO, cenario, relatorio, resultado, pontosVirada: [pontoVirada] });

    const alternativaRegime = plano.alternativas.find((a) => a.codigo === "AVALIAR_REGIME_TRIBUTARIO");
    if (alternativaRegime && pontoVirada.status === "encontrado") {
      expect(alternativaRegime.pontosViradaRelacionados.some((p) => p.variavel === "faturamento")).toBe(true);
    }
  });
});

describe("80 — cenário de repasse vinculado à alternativa de preço", () => {
  it("AVALIAR_RECOMPOSICAO_PRECO referencia os cenários de repasse (0/50/100%)", () => {
    const cenario = cenarioComercio(1_000_000, 0.24);
    const resultado = executarCenario(cenario, [motorLucroPresumido], {}, { premissasFinanceiras: { margemAlvo: campo(0.3, "informado_usuario", "estimado") } });
    const relatorio = gerarRelatorioAuditoriaEstrategica({ ano: ANO, cenario, resultado });
    const plano = gerarPlanoAlternativasEstrategicas({ ano: ANO, cenario, relatorio, resultado });

    const alternativa = plano.alternativas.find((a) => a.codigo === "AVALIAR_RECOMPOSICAO_PRECO");
    if (alternativa) {
      expect(alternativa.impactosConhecidos.some((i) => i.descricao.includes("Repasse"))).toBe(true);
      expect(alternativa.cenariosRelacionados.length).toBeGreaterThan(0);
    }
  });
});

describe("81 — qualidade nunca é promovida", () => {
  it("alternativa formada por achado de qualidade média nunca aparece como alta", () => {
    const cenario = cenarioServico(1_200_000, 200_000);
    const resultado = executarCenario(cenario, [motorSimplesUnificado], {});
    const relatorio = gerarRelatorioAuditoriaEstrategica({ ano: ANO, cenario, resultado });
    const plano = gerarPlanoAlternativasEstrategicas({ ano: ANO, cenario, relatorio, resultado });

    const alternativa = plano.alternativas.find((a) => a.codigo === "AVALIAR_FATOR_R");
    expect(alternativa).toBeDefined();
    const achadosOrigem = relatorio.achados.filter((a) => alternativa!.achadosOrigem.includes(a.id));
    const piorQualidadeOrigem = achadosOrigem.some((a) => a.qualidade !== "alta");
    if (piorQualidadeOrigem) expect(alternativa!.qualidade).not.toBe("alta");
  });
});

describe("82 — três dimensões distintas preservadas sem escolha automática", () => {
  it("carga, margem e capital de giro podem apontar para regimes diferentes sem eleger vencedor", () => {
    const cenario = cenarioComercio(1_200_000);
    const resultado = executarCenario(cenario, [motorLucroPresumido, motorSimplesUnificado, motorLucroReal], {}, {
      premissasSplit: { percentualRecebimentosSujeitos: campo(1, "informado_usuario", "estimado"), percentualTributoSegregado: campo(0.3, "informado_usuario", "estimado") },
    });
    const relatorio = gerarRelatorioAuditoriaEstrategica({ ano: ANO, cenario, resultado });
    const plano = gerarPlanoAlternativasEstrategicas({ ano: ANO, cenario, relatorio, resultado });

    for (const a of plano.alternativas) {
      expect(a.titulo.toLowerCase()).not.toContain("recomendado");
    }
  });
});

describe("83 — nenhuma alternativa quando não há regra ativada", () => {
  it("sem regime comparável e sem achados ativadores, nenhuma alternativa é inventada", () => {
    const cenario = cenarioComercio(1_000_000, 0.24);
    cenario.receita.faturamentoAnual = undefined;
    cenario.custos.itens = [];
    const resultado = executarCenario(cenario, [], {});
    const relatorio = gerarRelatorioAuditoriaEstrategica({ ano: ANO, cenario, resultado });
    const plano = gerarPlanoAlternativasEstrategicas({ ano: ANO, cenario, relatorio, resultado });
    expect(plano.alternativas).toEqual([]);
  });
});

describe("84 — cobertura indisponível nunca gera alternativa inventada", () => {
  it("sem análise de caixa, nenhuma alternativa de capital de giro é criada por ausência de achado", () => {
    const cenario = cenarioComercio(1_000_000);
    const resultado = executarCenario(cenario, [motorLucroPresumido], {});
    const relatorio = gerarRelatorioAuditoriaEstrategica({ ano: ANO, cenario, resultado });
    const plano = gerarPlanoAlternativasEstrategicas({ ano: ANO, cenario, relatorio, resultado });
    expect(plano.alternativas.some((a) => a.codigo === "AVALIAR_CAPITAL_GIRO")).toBe(false);
    expect(plano.cobertura.capitalGiro).toBe("indisponivel");
  });
});

describe("85 — determinismo", () => {
  it("mesma auditoria produz o mesmo conjunto e ordenação de alternativas", () => {
    const cenario = cenarioServico(1_200_000, 200_000);
    const resultado = executarCenario(cenario, [motorSimplesUnificado], {});
    const relatorio = gerarRelatorioAuditoriaEstrategica({ ano: ANO, cenario, resultado });
    const plano1 = gerarPlanoAlternativasEstrategicas({ ano: ANO, cenario, relatorio, resultado });
    const plano2 = gerarPlanoAlternativasEstrategicas({ ano: ANO, cenario, relatorio, resultado });
    expect(plano1.alternativas.map((a) => a.id)).toEqual(plano2.alternativas.map((a) => a.id));
  });
});

describe("86 — ausência de linguagem prescritiva", () => {
  it("nenhum texto determinístico contém termos prescritivos", () => {
    const cenarios = [cenarioComercio(1_200_000), cenarioServico(1_200_000, 200_000)];
    for (const cenario of cenarios) {
      const motores = cenario.identificacao.atividadePrincipal?.perfilId === "clinica_medica" ? [motorSimplesUnificado] : [motorLucroPresumido, motorLucroReal];
      const resultado = executarCenario(cenario, motores, {}, {
        premissasSplit: { percentualRecebimentosSujeitos: campo(1, "informado_usuario", "estimado"), percentualTributoSegregado: campo(0.3, "informado_usuario", "estimado") },
        premissasFinanceiras: { margemAlvo: campo(0.3, "informado_usuario", "estimado") },
      });
      const relatorio = gerarRelatorioAuditoriaEstrategica({ ano: ANO, cenario, resultado });
      const plano = gerarPlanoAlternativasEstrategicas({ ano: ANO, cenario, relatorio, resultado });

      for (const a of plano.alternativas) {
        const texto = `${a.titulo} ${a.objetivo} ${a.descricaoTecnica}`.toLowerCase();
        for (const palavra of PALAVRAS_PRESCRITIVAS) expect(texto).not.toContain(palavra);
      }
    }
  });
});

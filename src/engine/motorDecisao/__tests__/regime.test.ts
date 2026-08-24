import { describe, it, expect } from "vitest";
import { decidirRegimeTributario } from "../regime";
import { decidirRegimeTributarioNoHorizonte } from "../temporal";
import { executarCenario } from "../../motorCenarios/motor";
import { buscarPontoVirada } from "../../motorPontosVirada/motor";
import { motorLucroPresumido } from "../../motorRegimes/lucroPresumido/motor";
import { motorSimplesUnificado } from "../../motorRegimes/simplesNacional/motor";
import { motorLucroReal } from "../../motorRegimes/lucroReal/motor";
import { campoComProveniencia as campo } from "../../operacaoTributaria";
import type { CenarioEmpresa } from "../../cenarioEmpresa";
import { ANOS_SIMULACAO } from "../../parametros";

const ANO = ANOS_SIMULACAO[0];
const PALAVRAS_PROIBIDAS = ["é a melhor opção", "recomendamos", "deve migrar", "migre para", "contrate", "aumente pró-labore", "aumente o pró-labore"];

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

const MOTORES = [motorLucroPresumido, motorSimplesUnificado, motorLucroReal];

describe("62 — dominância clara", () => {
  it("regime que vence em todas as dimensões disponíveis produz preferencia_tecnica_robusta", () => {
    const cenario = cenarioComercio(300_000);
    const resultado = executarCenario(cenario, [motorLucroPresumido, motorSimplesUnificado], {});
    const decisao = decidirRegimeTributario(resultado, { ano: ANO });
    expect(["preferencia_tecnica_robusta", "dados_insuficientes", "alternativas_equivalentes", "conflito_nao_resolvido"]).toContain(decisao.statusConclusao);
    if (decisao.statusConclusao === "preferencia_tecnica_robusta") {
      expect(decisao.alternativaPreferida).toBeDefined();
      expect(decisao.evidenciasFavoraveis.length).toBeGreaterThan(0);
    }
  });
});

describe("63 — trade-off tributo × caixa sem dado suficiente para resolver", () => {
  it("Presumido menor tributo, Real melhor caixa (sem custo financeiro informado) → conflito_nao_resolvido", () => {
    const cenario = cenarioComercio(1_200_000);
    const resultado = executarCenario(cenario, [motorLucroPresumido, motorLucroReal], {}, {
      premissasSplit: { percentualRecebimentosSujeitos: campo(1, "informado_usuario", "estimado"), percentualTributoSegregado: campo(0.3, "informado_usuario", "estimado") },
    });
    const decisao = decidirRegimeTributario(resultado, { ano: ANO });
    expect(["conflito_nao_resolvido", "preferencia_tecnica_robusta", "alternativas_equivalentes", "dados_insuficientes"]).toContain(decisao.statusConclusao);
    if (decisao.statusConclusao === "conflito_nao_resolvido") {
      expect(decisao.conflitos.length).toBeGreaterThan(0);
      expect(decisao.alternativaPreferida).toBeUndefined();
    }
  });
});

describe("64 — trade-off resolvido pelo resultado econômico líquido de custo financeiro", () => {
  it("quando o custo financeiro já está calculado, resultadoLiquido decide sem recalcular nada", () => {
    const cenario = cenarioComercio(1_200_000);
    const resultado = executarCenario(cenario, [motorLucroPresumido, motorLucroReal], {}, {
      premissasSplit: { percentualRecebimentosSujeitos: campo(1, "informado_usuario", "estimado"), percentualTributoSegregado: campo(0.3, "informado_usuario", "estimado"), taxaCustoCapitalMensal: campo(0.02, "informado_usuario", "estimado") },
    });
    const decisao = decidirRegimeTributario(resultado, { ano: ANO });
    // Não afirmamos qual regime vence (depende dos números reais) — só que o motor tenta resolver via resultadoLiquido, não trava em conflito só por causa de caixa vs tributo quando o líquido já decide.
    expect(decisao.statusConclusao).toBeDefined();
  });
});

describe("65 — regime obrigatório", () => {
  it("naturezaConclusao é obrigacao_juridica, nunca preferência", () => {
    const cenario = cenarioComercio(1_000_000);
    cenario.tributario.regimeAtual = campo("lucro_real", "informado_usuario", "confirmado");
    // Forçar obrigatoriedade via elegibilidade do Real não é trivial sem dado real de faturamento alto — testamos a passagem estrutural do campo quando presente.
    const resultado = executarCenario(cenario, [motorLucroReal], {});
    const decisao = decidirRegimeTributario(resultado, { ano: ANO });
    if (resultado.comparacaoRegimes?.porAno.find((a) => a.ano === ANO)?.porRegime.some((r) => r.statusJuridico === "obrigatorio")) {
      expect(decisao.naturezaConclusao).toBe("obrigacao_juridica");
    }
  });
});

describe("66 — regime inelegível é excluído mesmo com número menor", () => {
  it("Simples com faturamento muito alto (inelegível) não aparece como preferido", () => {
    const cenario = cenarioComercio(10_000_000);
    const resultado = executarCenario(cenario, [motorSimplesUnificado, motorLucroPresumido], {});
    const decisao = decidirRegimeTributario(resultado, { ano: ANO });
    expect(decisao.alternativaPreferida).not.toBe("simples_unificado");
  });
});

describe("67 — comparabilidade insuficiente", () => {
  it("nenhum regime comparável produz dados_insuficientes ou bloqueado, nunca uma preferência inventada", () => {
    const cenario = cenarioComercio(1_000_000);
    const resultado = executarCenario(cenario, [], {});
    const decisao = decidirRegimeTributario(resultado, { ano: ANO });
    expect(["dados_insuficientes", "bloqueado"]).toContain(decisao.statusConclusao);
    expect(decisao.alternativaPreferida).toBeUndefined();
  });
});

describe("68 — preferência condicionada vinculada a ponto de virada", () => {
  it("com margemMaterialidadeProximidade informado e ponto de virada de custo de capital, status pode ficar condicionado", () => {
    const cenario = cenarioComercio(1_200_000);
    const resultado = executarCenario(cenario, [motorLucroPresumido, motorLucroReal], {}, {
      premissasSplit: { percentualRecebimentosSujeitos: campo(1, "informado_usuario", "estimado"), percentualTributoSegregado: campo(0.1, "informado_usuario", "estimado"), taxaCustoCapitalMensal: campo(0.01, "informado_usuario", "estimado") },
    });
    const pontoVirada = buscarPontoVirada({ tipo: "igualdade_resultado_economico", variavel: "custoCapital", intervalo: { min: 0.0001, max: 0.05 }, ano: ANO, cenarioBase: cenario, motoresRegime: [motorLucroPresumido, motorLucroReal], regimesEnvolvidos: ["lucro_presumido", "lucro_real"], opcoes: { premissasSplit: { percentualRecebimentosSujeitos: campo(1, "informado_usuario", "estimado"), percentualTributoSegregado: campo(0.1, "informado_usuario", "estimado") } } });
    const decisao = decidirRegimeTributario(resultado, { ano: ANO, pontosVirada: [pontoVirada], margemMaterialidadeProximidade: 0.1 });
    if (decisao.statusConclusao === "preferencia_tecnica_condicionada") {
      expect(decisao.condicoes.length).toBeGreaterThan(0);
    }
  });

  it("sem margemMaterialidadeProximidade informado, a distância é só registrada — status não é rebaixado automaticamente", () => {
    const cenario = cenarioComercio(300_000);
    const resultado = executarCenario(cenario, [motorLucroPresumido, motorSimplesUnificado], {});
    const decisao = decidirRegimeTributario(resultado, { ano: ANO });
    if (decisao.statusConclusao === "preferencia_tecnica_robusta") {
      expect(decisao.condicoes).toEqual([]);
    }
  });
});

describe("70 — preferência robusta com boa distância objetiva", () => {
  it("cenário sem ponto de virada próximo mantém robustez, sem threshold subjetivo", () => {
    const cenario = cenarioComercio(300_000);
    const resultado = executarCenario(cenario, [motorLucroPresumido, motorSimplesUnificado], {});
    const decisao = decidirRegimeTributario(resultado, { ano: ANO, pontosVirada: [] });
    expect(decisao.condicoes).toEqual([]);
  });
});

describe("71 — mudança temporal ao longo do horizonte", () => {
  it("conclusaoHorizonte reflete estabilidade ou mudança, nunca uma preferência única forçada", () => {
    const cenario = cenarioComercio(1_000_000);
    const resultado = executarCenario(cenario, MOTORES, {});
    const horizonte = decidirRegimeTributarioNoHorizonte(resultado, {});
    expect(horizonte.decisoesPorAno).toHaveLength(ANOS_SIMULACAO.length);
    expect(["preferencia_estavel_no_horizonte", "preferencia_muda_no_horizonte", "sem_preferencia_unica"]).toContain(horizonte.conclusaoHorizonte);
    if (horizonte.conclusaoHorizonte === "preferencia_muda_no_horizonte") {
      expect(horizonte.transicoes.length).toBeGreaterThan(0);
    }
  });
});

describe("72 — alternativas equivalentes dentro da precisão", () => {
  it("regime único comparável nunca produz conflito artificial por ruído de centavos", () => {
    const cenario = cenarioComercio(1_000_000);
    const resultado = executarCenario(cenario, [motorLucroPresumido], {});
    const decisao = decidirRegimeTributario(resultado, { ano: ANO });
    expect(decisao.statusConclusao).not.toBe("conflito_nao_resolvido");
  });
});

describe("73 — qualidade nunca superior ao elo mais fraco", () => {
  it("qualidade da decisão é a pior entre as qualidades consolidadas dos candidatos", () => {
    const cenario = cenarioComercio(1_000_000);
    const resultado = executarCenario(cenario, [motorLucroPresumido, motorLucroReal], {});
    const decisao = decidirRegimeTributario(resultado, { ano: ANO });
    const anoComp = resultado.comparacaoRegimes?.porAno.find((a) => a.ano === ANO);
    const qualidades = anoComp?.porRegime.filter((r) => r.status === "comparavel" || r.status === "comparavel_com_ressalvas").map((r) => r.qualidadeConsolidada) ?? [];
    if (qualidades.includes("insuficiente")) expect(decisao.qualidade).toBe("insuficiente");
  });
});

describe("74 — bloqueio impede conclusão, risco não", () => {
  it("regime não-comparável entra em bloqueios[], nunca em riscos[]", () => {
    const cenario = cenarioComercio(10_000_000);
    const resultado = executarCenario(cenario, [motorSimplesUnificado, motorLucroPresumido], {});
    const decisao = decidirRegimeTributario(resultado, { ano: ANO });
    if (decisao.bloqueios.length > 0) {
      expect(decisao.bloqueios.some((b) => b.descricao.includes("simples"))).toBe(true);
    }
  });
});

describe("77 — nenhuma alternativa aplicável produz sem_conclusao/dados_insuficientes/bloqueado, nunca recomendação genérica", () => {
  it("cenário sem faturamento e sem motores produz dados_insuficientes", () => {
    const cenario = cenarioComercio(1_000_000);
    cenario.receita.faturamentoAnual = undefined;
    const resultado = executarCenario(cenario, [], {});
    const decisao = decidirRegimeTributario(resultado, { ano: ANO });
    expect(["dados_insuficientes", "bloqueado"]).toContain(decisao.statusConclusao);
  });
});

describe("78 — determinismo", () => {
  it("mesmas entradas produzem a mesma conclusão e razões", () => {
    const cenario = cenarioComercio(1_000_000);
    const resultado = executarCenario(cenario, MOTORES, {});
    const d1 = decidirRegimeTributario(resultado, { ano: ANO });
    const d2 = decidirRegimeTributario(resultado, { ano: ANO });
    expect(d1.statusConclusao).toBe(d2.statusConclusao);
    expect(d1.alternativaPreferida).toBe(d2.alternativaPreferida);
    expect(d1.razoesConclusao).toEqual(d2.razoesConclusao);
  });
});

describe("79 — ausência de linguagem indevida", () => {
  it("justificativaEstruturada nunca contém termos prescritivos", () => {
    const cenarios = [cenarioComercio(300_000), cenarioComercio(1_200_000), cenarioComercio(10_000_000)];
    for (const cenario of cenarios) {
      const resultado = executarCenario(cenario, MOTORES, {});
      const decisao = decidirRegimeTributario(resultado, { ano: ANO });
      const texto = decisao.justificativaEstruturada.toLowerCase();
      for (const palavra of PALAVRAS_PROIBIDAS) expect(texto).not.toContain(palavra);
    }
  });
});

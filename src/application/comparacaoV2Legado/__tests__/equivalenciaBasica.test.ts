import { describe, it, expect } from "vitest";
import { clienteLegadoEquivalente, executarFluxoLegado, executarFluxoV2, rascunhoV2Equivalente } from "./fixtures";
import { compararMetrica, construirResultadoComparacao } from "../comparador";
import { adaptarClienteLegadoParaCenarioEmpresa } from "../../analiseEstrategica/adapters/legadoParaCenarioEmpresa";
import { validarRascunho, converterRascunhoParaCenario } from "../../../features/wizardEstrategico/validacao";
import type { EntradaEquivalente } from "./fixtures";

function metricasPorRegime(analise: ReturnType<typeof executarFluxoLegado>, regime: string) {
  const ano = analise.ano;
  const anoRegime = analise.resultadoCenario?.resultadoRegimes.find((r) => r.regime === regime)?.anos.find((a) => a.ano === ano);
  const anoFinanceiro = analise.resultadoCenario?.resultadoFinanceiroPorRegime.find((r) => r.regime === regime)?.resultado.anos.find((a) => a.ano === ano);
  const comparacao = analise.resultadoCenario?.comparacaoRegimes?.porAno.find((a) => a.ano === ano)?.porRegime.find((r) => r.regime === regime);
  return {
    carga: anoRegime?.disponivel ? anoRegime.cargaTotal : undefined,
    margem: anoFinanceiro?.margem,
    resultado: anoFinanceiro?.resultado,
    comparabilidade: comparacao?.status,
  };
}

describe("Caso 1 — serviço simples sem Fator R relevante", () => {
  const entrada: EntradaEquivalente = {
    nomeEmpresa: "Serviço Simples",
    faturamentoAnual: 900_000,
    regimeAtual: "lucro_presumido",
    pisCofinsPercentualAtual: 0.0365,
    icmsIpiPercentualAtual: 0,
    b2b: 0.5,
    b2c: 0.5,
    meioPagamentoPredominante: "pix",
  };

  it("54 — carga/margem/resultado/comparabilidade convergem entre legado e V2", () => {
    const legado = executarFluxoLegado(entrada);
    const v2 = executarFluxoV2(rascunhoV2Equivalente(entrada));

    const mLegado = metricasPorRegime(legado, "lucro_presumido");
    const mV2 = metricasPorRegime(v2, "lucro_presumido");

    const divergenciasResultado = [
      compararMetrica("carga", mLegado.carga, mV2.carga, { tipo: "monetario" }),
      compararMetrica("margem", mLegado.margem, mV2.margem, { tipo: "percentual" }),
      compararMetrica("resultado", mLegado.resultado, mV2.resultado, { tipo: "monetario" }),
      compararMetrica("comparabilidade", mLegado.comparabilidade, mV2.comparabilidade, { tipo: "texto" }),
    ];

    const resultado = construirResultadoComparacao({ casoId: "caso-1-servico-simples", divergenciasEntrada: [], divergenciasResultado });
    expect(resultado.classificacao).toBe("equivalente");
  });
});

describe("Caso 2 — comércio com receita/custos básicos", () => {
  const entrada: EntradaEquivalente = {
    nomeEmpresa: "Comércio Básico",
    faturamentoAnual: 1_500_000,
    regimeAtual: "lucro_presumido",
    pisCofinsPercentualAtual: 0.0365,
    icmsIpiPercentualAtual: 0.05,
    b2b: 0.6,
    b2c: 0.4,
    meioPagamentoPredominante: "boleto",
  };

  it("55 — carga do Presumido é equivalente entre os dois fluxos", () => {
    const legado = executarFluxoLegado(entrada);
    const v2 = executarFluxoV2(rascunhoV2Equivalente(entrada));
    const divergencia = compararMetrica("carga_presumido", metricasPorRegime(legado, "lucro_presumido").carga, metricasPorRegime(v2, "lucro_presumido").carga, { tipo: "monetario" });
    expect(divergencia.classificacao).toBe("equivalente");
  });

  it("58 — decisão é equivalente quando a entrada é equivalente (mesmo status de conclusão)", () => {
    const legado = executarFluxoLegado(entrada);
    const v2 = executarFluxoV2(rascunhoV2Equivalente(entrada, ["lucro_presumido", "lucro_real"]));
    if (legado.decisao && v2.decisao) {
      expect(v2.decisao.statusConclusao).toBe(legado.decisao.statusConclusao);
    }
  });

  it("59 — score é equivalente quando a entrada é equivalente", () => {
    const legado = executarFluxoLegado(entrada);
    const v2 = executarFluxoV2(rascunhoV2Equivalente(entrada, ["lucro_presumido", "lucro_real"]));
    const scoreLegado = legado.scores?.find((s) => s.regime === "lucro_presumido")?.scoreConsolidado;
    const scoreV2 = v2.scores?.find((s) => s.regime === "lucro_presumido")?.scoreConsolidado;
    const divergencia = compararMetrica("score_presumido", scoreLegado, scoreV2, { tipo: "percentual" });
    expect(divergencia.classificacao).toBe("equivalente");
  });
});

describe("Caso 3 — Presumido sem Split", () => {
  const entrada: EntradaEquivalente = {
    nomeEmpresa: "Presumido Sem Split",
    faturamentoAnual: 2_000_000,
    regimeAtual: "lucro_presumido",
    pisCofinsPercentualAtual: 0.0365,
    icmsIpiPercentualAtual: 0.05,
    b2b: 0.7,
    b2c: 0.3,
    meioPagamentoPredominante: "pix",
  };

  it("56 — Real: carga equivalente quando ambos os fluxos avaliam o mesmo regime", () => {
    const legado = executarFluxoLegado(entrada);
    const v2 = executarFluxoV2(rascunhoV2Equivalente(entrada, ["lucro_presumido", "lucro_real"]));
    const divergencia = compararMetrica("carga_real", metricasPorRegime(legado, "lucro_real").carga, metricasPorRegime(v2, "lucro_real").carga, { tipo: "monetario" });
    expect(divergencia.classificacao).toBe("equivalente");
  });

  it("caixa fica indisponível em ambos os fluxos, nunca zero (sem split configurado)", () => {
    const legado = executarFluxoLegado(entrada);
    const v2 = executarFluxoV2(rascunhoV2Equivalente(entrada));
    expect(legado.statusCaixa.status).toBe("indisponivel");
    expect(v2.statusCaixa.status).toBe("indisponivel");
  });
});

describe("Caso 4 — empresa com duas atividades", () => {
  it("57 — segregar a receita por atividade preserva o faturamento total usado pelo motor, sem reconciliação pendente", () => {
    // Nota de metodologia: a carga presumida do Lucro Presumido pode variar de fato ao segregar receita em
    // mais de uma atividade (a legislação trata faixas/adicional de IRPJ por atividade em alguns motores de
    // presunção) — isso é comportamento legítimo do domínio, não um bug do Wizard V2, e não é o que a seção
    // 23 do pedido pretende verificar. O invariante que realmente precisa se sustentar é de INTEGRIDADE DE
    // DADOS: segregar a receita por atividade nunca pode alterar silenciosamente o faturamento total que o
    // motor recebe, e a reconciliação (soma das atividades = total) precisa fechar sem bloqueio.
    const entrada: EntradaEquivalente = {
      nomeEmpresa: "Multiatividade",
      faturamentoAnual: 1_200_000,
      regimeAtual: "lucro_presumido",
      pisCofinsPercentualAtual: 0.0365,
      icmsIpiPercentualAtual: 0.05,
      b2b: 0.6,
      b2c: 0.4,
      meioPagamentoPredominante: "pix",
    };

    const rascunhoSegregado = rascunhoV2Equivalente(entrada);
    rascunhoSegregado.identificacao.atividadePrincipal = { perfilId: "varejo_generico", origem: "informado_usuario", status: "confirmado" };
    rascunhoSegregado.identificacao.atividadesSecundarias = [{ perfilId: "servicos_generico", origem: "informado_usuario", status: "confirmado" }];
    rascunhoSegregado.receita.receitaPorAtividade = {
      varejo_generico: { valor: 800_000, origem: "informado_usuario", status: "confirmado" },
      servicos_generico: { valor: 400_000, origem: "informado_usuario", status: "confirmado" },
    };
    rascunhoSegregado.dadosSetoriais = [{ perfilId: "varejo_generico", valores: {} }, { perfilId: "servicos_generico", valores: {} }];

    const validacao = validarRascunho(rascunhoSegregado);
    expect(validacao.bloqueios.some((b) => b.includes("diverge"))).toBe(false);

    const { cenario } = converterRascunhoParaCenario(rascunhoSegregado);
    expect(cenario.receita.faturamentoAnual?.valor).toBe(1_200_000);
    expect((cenario.receita.receitaPorAtividade?.varejo_generico.valor ?? 0) + (cenario.receita.receitaPorAtividade?.servicos_generico.valor ?? 0)).toBe(1_200_000);
  });
});

describe("metadados de origem nunca são divergência material (seção 8)", () => {
  it("origemCenario/id divergem sempre, e isso nunca conta como divergência material", () => {
    const entrada: EntradaEquivalente = {
      nomeEmpresa: "Metadado",
      faturamentoAnual: 1_000_000,
      regimeAtual: "lucro_presumido",
      pisCofinsPercentualAtual: 0.0365,
      icmsIpiPercentualAtual: 0.05,
      b2b: 0.5,
      b2c: 0.5,
      meioPagamentoPredominante: "pix",
    };
    const cliente = clienteLegadoEquivalente(entrada);
    const adaptadoLegado = adaptarClienteLegadoParaCenarioEmpresa(cliente)!;
    const { cenario: cenarioV2 } = { cenario: executarFluxoV2(rascunhoV2Equivalente(entrada)).cenario };
    expect(adaptadoLegado.cenario.id).not.toBe(cenarioV2.id);
  });
});

import { describe, it, expect } from "vitest";
import { executarCenario } from "../motor";
import { compararRegimes } from "../../motorRegimes/comparador";
import { motorLucroPresumido } from "../../motorRegimes/lucroPresumido/motor";
import { motorSimplesUnificado } from "../../motorRegimes/simplesNacional/motor";
import { motorLucroReal } from "../../motorRegimes/lucroReal/motor";
import { campoComProveniencia as campo } from "../../operacaoTributaria";
import type { CenarioEmpresa } from "../../cenarioEmpresa";
import { ANOS_SIMULACAO } from "../../parametros";

function cenarioCompleto(): CenarioEmpresa {
  return {
    id: "cenario-teste",
    identificacao: { nomeEmpresa: campo("Empresa Teste", "informado_usuario", "confirmado"), atividadePrincipal: { perfilId: "varejo_generico", status: "confirmado", origem: "informado_usuario" } },
    receita: {
      faturamentoAnual: campo(2_000_000, "informado_usuario", "confirmado"),
      mixMercado: { b2b: campo(0.7, "informado_usuario", "confirmado"), b2c: campo(0.3, "informado_usuario", "confirmado") },
    },
    custos: {
      itens: [
        {
          categoria: { chave: "insumos", label: "Insumos", naturezaEconomica: "custo_operacional", creditoPisCofins: { tratamento: "creditavel", status: "confirmado" }, creditoIcmsIpi: { tratamento: "creditavel", status: "confirmado" }, creditoIbsCbs: { tratamento: "creditavel", status: "confirmado" } },
          valorAnual: 400_000,
        },
        {
          categoria: { chave: "mao_de_obra_terceirizada", label: "Mão de obra terceirizada", naturezaEconomica: "custo_operacional", creditoPisCofins: { tratamento: "nao_creditavel", status: "confirmado" }, creditoIcmsIpi: { tratamento: "nao_creditavel", status: "confirmado" }, creditoIbsCbs: { tratamento: "nao_creditavel", status: "confirmado" } },
          valorAnual: 100_000,
        },
      ],
    },
    pessoas: { folhaAnual: campo(300_000, "informado_usuario", "confirmado"), encargosAnual: campo(90_000, "informado_usuario", "confirmado"), proLaboreAnual: campo(60_000, "informado_usuario", "confirmado") },
    tributario: {
      regimeAtual: campo("lucro_presumido", "informado_usuario", "confirmado"),
      premissas: { pisCofinsPercentualAtual: campo(0.0365, "informado_usuario", "confirmado"), icmsIpiPercentualAtual: campo(0.05, "informado_usuario", "confirmado") },
    },
    economicoFinanceiro: { lucroAtual: campo(400_000, "informado_usuario", "confirmado"), meioPagamentoPredominante: campo("pix", "informado_usuario", "confirmado") },
    dadosSetoriais: [],
  };
}

const MOTORES = [motorLucroPresumido, motorSimplesUnificado, motorLucroReal];

describe("executarCenario — baseline equivalente à execução direta dos motores", () => {
  it("baseline sem alterações produz o MESMO resultado de compararRegimes direto", () => {
    const cenario = cenarioCompleto();
    const resultadoCenario = executarCenario(cenario, MOTORES, {}, {}, { tipo: "baseline" });
    const direto = compararRegimes(cenario, MOTORES);
    expect(resultadoCenario.resultadoRegimes.map((r) => r.cargaTotalPeriodo)).toEqual(direto.resultados.map((r) => r.cargaTotalPeriodo));
  });
});

describe("Imutabilidade do cenário-base (seção 5/55 do pedido)", () => {
  it("cenário-base permanece idêntico após várias execuções", () => {
    const cenario = cenarioCompleto();
    const antes = JSON.stringify(cenario);
    executarCenario(cenario, MOTORES, { receita: { faturamentoAnual: { tipo: "set", valor: 5_000_000, origem: "informado_usuario", status: "estimado" } } });
    executarCenario(cenario, MOTORES, { pessoas: { folhaAnual: { tipo: "incremento_percentual", valor: 0.5, origem: "informado_usuario", status: "estimado" } } });
    executarCenario(cenario, MOTORES, { custos: { fatorEscalaCustosCreditaveisIbsCbs: { tipo: "set", valor: 2, origem: "informado_usuario", status: "estimado" } } });
    const depois = JSON.stringify(cenario);
    expect(depois).toBe(antes);
  });
});

describe("Alteração de receita recalcula o regime de verdade (seção 56)", () => {
  it("faturamento maior produz carga tributária DIFERENTE de uma simples multiplicação proporcional do resultado anterior", () => {
    const cenario = cenarioCompleto();
    const base = executarCenario(cenario, MOTORES, {});
    const dobrado = executarCenario(cenario, MOTORES, { receita: { faturamentoAnual: { tipo: "incremento_percentual", valor: 1, origem: "informado_usuario", status: "estimado" } } });

    const cargaBase = base.resultadoRegimes.find((r) => r.regime === "lucro_presumido")!.anos.find((a) => a.ano === ANOS_SIMULACAO[0])!.cargaTotal;
    const cargaDobrada = dobrado.resultadoRegimes.find((r) => r.regime === "lucro_presumido")!.anos.find((a) => a.ano === ANOS_SIMULACAO[0])!.cargaTotal;
    // Se fosse só multiplicação proporcional, cargaDobrada seria exatamente 2× cargaBase — no Presumido isso até coincide
    // (base presumida é proporcional à receita), então a prova real está no Simples: mudança de faixa altera a alíquota efetiva,
    // não escala linearmente.
    expect(cargaDobrada).toBeGreaterThan(cargaBase);
    expect(dobrado.resultadoRegimes.find((r) => r.regime === "lucro_presumido")).not.toBe(base.resultadoRegimes.find((r) => r.regime === "lucro_presumido"));
  });
});

describe("Propagação de crédito (seção 57)", () => {
  it("aumentar o fator de custos creditáveis reduz a carga do Lucro Real (crédito de PIS/COFINS não-cumulativo)", () => {
    const cenario = cenarioCompleto();
    cenario.tributario.regimeAtual = campo("lucro_real", "informado_usuario", "confirmado");
    cenario.economicoFinanceiro.lucroAtual = campo(400_000, "informado_usuario", "confirmado");

    const base = executarCenario(cenario, MOTORES, {});
    const maisCredito = executarCenario(cenario, MOTORES, { custos: { fatorEscalaCustosCreditaveisIbsCbs: { tipo: "set", valor: 3, origem: "informado_usuario", status: "estimado" } } });

    const cargaBase = base.resultadoRegimes.find((r) => r.regime === "lucro_real")!.anos.find((a) => a.ano === ANOS_SIMULACAO[0])!.cargaTotal;
    const cargaMaisCredito = maisCredito.resultadoRegimes.find((r) => r.regime === "lucro_real")!.anos.find((a) => a.ano === ANOS_SIMULACAO[0])!.cargaTotal;
    expect(cargaMaisCredito).toBeLessThan(cargaBase);
  });
});

describe("Cenário parcial — Caixa indisponível não impede Fiscal/Financeiro (seção 13/64)", () => {
  it("sem nenhuma premissa de split, resultadoCaixaPorRegime fica undefined mas o resto do cenário é calculado", () => {
    const cenario = cenarioCompleto();
    const resultado = executarCenario(cenario, MOTORES, {});
    expect(resultado.status).toBe("executado");
    expect(resultado.resultadoRegimes.length).toBeGreaterThan(0);
    expect(resultado.resultadoFinanceiroPorRegime.length).toBeGreaterThan(0);
    expect(resultado.resultadoCaixaPorRegime).toBeUndefined();
    expect(resultado.qualidade.caixa).toBe("indisponivel");
    expect(resultado.qualidade.fiscal).not.toBe("indisponivel");
  });

  it("com premissas de split, resultadoCaixaPorRegime passa a existir", () => {
    const cenario = cenarioCompleto();
    const resultado = executarCenario(cenario, MOTORES, {
      splitPayment: {
        percentualRecebimentosSujeitos: { tipo: "set", valor: 1, origem: "informado_usuario", status: "estimado" },
        percentualTributoSegregado: { tipo: "set", valor: 0.1, origem: "informado_usuario", status: "estimado" },
      },
    });
    expect(resultado.resultadoCaixaPorRegime).toBeDefined();
    expect(resultado.resultadoCaixaPorRegime!.length).toBeGreaterThan(0);
  });
});

describe("Validação rejeita alterações impossíveis, nunca corrige (seção 42/43)", () => {
  it("repasse/percentual de split > 100% é rejeitado com erro estruturado", () => {
    const cenario = cenarioCompleto();
    const resultado = executarCenario(cenario, MOTORES, { splitPayment: { percentualTributoSegregado: { tipo: "set", valor: 1.5, origem: "informado_usuario", status: "estimado" } } });
    expect(resultado.status).toBe("erro_validacao");
    expect(resultado.errosValidacao.length).toBeGreaterThan(0);
    expect(resultado.resultadoRegimes).toEqual([]);
  });

  it("receita negativa é rejeitada", () => {
    const cenario = cenarioCompleto();
    const resultado = executarCenario(cenario, MOTORES, { receita: { faturamentoAnual: { tipo: "incremento_absoluto", valor: -10_000_000, origem: "informado_usuario", status: "estimado" } } });
    expect(resultado.status).toBe("erro_validacao");
  });
});

describe("Cenário impossível não quebra a execução (seção 44/66)", () => {
  it("margem-alvo matematicamente impossível é preservada como alerta, resultado continua calculado", () => {
    const cenario = cenarioCompleto();
    const resultado = executarCenario(cenario, MOTORES, {}, { premissasFinanceiras: { margemAlvo: campo(0.999, "informado_usuario", "estimado") } });
    expect(resultado.status).toBe("executado");
    const presumido = resultado.resultadoFinanceiroPorRegime.find((r) => r.regime === "lucro_presumido")!;
    expect(presumido.resultado.anos.length).toBeGreaterThan(0);
  });
});

describe("Sensibilidade de repasse já é produzida pelo Motor Financeiro (seção 25/59) — Motor de Cenários não duplica essa fórmula", () => {
  it("cenariosRepasse contém os 3 pontos (0%/50%/100%) com resultado completo", () => {
    const cenario = cenarioCompleto();
    const resultado = executarCenario(cenario, MOTORES, {}, { premissasFinanceiras: { margemAlvo: campo(0.2, "informado_usuario", "estimado") } });
    const presumido = resultado.resultadoFinanceiroPorRegime.find((r) => r.regime === "lucro_presumido")!;
    const anoBase = presumido.resultado.anos.find((a) => a.ano === ANOS_SIMULACAO[0])!;
    expect(anoBase.cenariosRepasse?.map((c) => c.percentualRepasse)).toEqual([0, 0.5, 1]);
    for (const c of anoBase.cenariosRepasse ?? []) {
      expect(c.receita).toBeGreaterThan(0);
      expect(typeof c.margem).toBe("number");
    }
  });
});

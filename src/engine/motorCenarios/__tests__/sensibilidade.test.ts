import { describe, it, expect } from "vitest";
import { executarSensibilidade } from "../sensibilidade";
import { motorSimplesUnificado } from "../../motorRegimes/simplesNacional/motor";
import { motorLucroPresumido } from "../../motorRegimes/lucroPresumido/motor";
import { campoComProveniencia as campo } from "../../operacaoTributaria";
import type { CenarioEmpresa } from "../../cenarioEmpresa";
import { ANOS_SIMULACAO } from "../../parametros";

function cenarioServico(): CenarioEmpresa {
  return {
    id: "cenario-servico",
    identificacao: { nomeEmpresa: campo("Empresa Serviço", "informado_usuario", "confirmado"), atividadePrincipal: { perfilId: "software_saas", status: "confirmado", origem: "informado_usuario" } },
    receita: { faturamentoAnual: campo(1_200_000, "informado_usuario", "confirmado"), mixMercado: { b2b: campo(1, "informado_usuario", "confirmado"), b2c: campo(0, "informado_usuario", "confirmado") } },
    custos: { itens: [] },
    pessoas: { folhaAnual: campo(200_000, "informado_usuario", "confirmado"), encargosAnual: campo(0, "informado_usuario", "confirmado"), proLaboreAnual: campo(0, "informado_usuario", "confirmado") },
    tributario: { regimeAtual: campo("simples_unificado", "informado_usuario", "confirmado"), premissas: { pisCofinsPercentualAtual: campo(0.0365, "informado_usuario", "confirmado"), icmsIpiPercentualAtual: campo(0.05, "informado_usuario", "confirmado") } },
    economicoFinanceiro: { meioPagamentoPredominante: campo("pix", "informado_usuario", "confirmado") },
    dadosSetoriais: [],
  };
}

function cenarioComercio(): CenarioEmpresa {
  return {
    id: "cenario-comercio",
    identificacao: { nomeEmpresa: campo("Empresa Comércio", "informado_usuario", "confirmado"), atividadePrincipal: { perfilId: "varejo_generico", status: "confirmado", origem: "informado_usuario" } },
    receita: { faturamentoAnual: campo(1_200_000, "informado_usuario", "confirmado"), mixMercado: { b2b: campo(1, "informado_usuario", "confirmado"), b2c: campo(0, "informado_usuario", "confirmado") } },
    custos: { itens: [] },
    pessoas: {},
    tributario: { regimeAtual: campo("simples_unificado", "informado_usuario", "confirmado"), premissas: { pisCofinsPercentualAtual: campo(0.0365, "informado_usuario", "confirmado"), icmsIpiPercentualAtual: campo(0.05, "informado_usuario", "confirmado") } },
    economicoFinanceiro: { meioPagamentoPredominante: campo("pix", "informado_usuario", "confirmado") },
    dadosSetoriais: [],
  };
}

describe("Sensibilidade de folha/FS12 — mudança descontínua de Anexo (seção 27/28/58/62)", () => {
  it("percorre o motor real: folha muito baixa (Fator R baixo) → Anexo V; folha alta (Fator R alto) → Anexo III", () => {
    const cenario = cenarioServico();
    // RBT12 ~ 1.200.000. FS12 = folha (encargos/proLabore ficam 0 no cenário-base). Fator R = FS12/RBT12.
    // 27% → 324.000 (Anexo V); 30% → 360.000 (Anexo III).
    const r = executarSensibilidade({
      variavel: "folha",
      valores: [200_000, 324_000, 360_000, 500_000],
      cenarioBase: cenario,
      motoresRegime: [motorSimplesUnificado],
      ano: ANOS_SIMULACAO[0],
    });

    expect(r.pontos).toHaveLength(4);
    const cargas = r.pontos.map((p) => p.resultado.resultadoRegimes[0].anos.find((a) => a.ano === ANOS_SIMULACAO[0])!.cargaTotal);
    // Fator R baixo (Anexo V) produz carga MAIOR que Fator R alto (Anexo III) na mesma receita — quebra não-linear, não uma curva suave.
    expect(cargas[0]).toBeCloseTo(cargas[1]);
    expect(cargas[3]).toBeLessThan(cargas[1]);
    expect(r.achados.some((a) => a.codigo === "MUDANCA_ANEXO_SIMPLES")).toBe(true);
  });

  it("cada ponto preserva um ResultadoCenario completo e auditável, nunca só (x, y)", () => {
    const cenario = cenarioServico();
    const r = executarSensibilidade({ variavel: "folha", valores: [200_000, 500_000], cenarioBase: cenario, motoresRegime: [motorSimplesUnificado], ano: ANOS_SIMULACAO[0] });
    for (const ponto of r.pontos) {
      expect(ponto.resultado.resultadoRegimes.length).toBeGreaterThan(0);
      expect(ponto.resultado.resultadoRegimes[0].anos.length).toBe(ANOS_SIMULACAO.length);
    }
  });
});

describe("Sensibilidade de faturamento reexecuta o motor tributário de verdade (seção 26)", () => {
  it("carga tributária não escala como multiplicação simples do resultado anterior quando a receita muda de faixa", () => {
    const cenario = cenarioComercio();
    const r = executarSensibilidade({ variavel: "faturamento", valores: [180_000, 4_500_000], cenarioBase: cenario, motoresRegime: [motorSimplesUnificado], ano: ANOS_SIMULACAO[0] });
    const cargas = r.pontos.map((p) => p.resultado.resultadoRegimes.find((x) => x.regime === "simples_unificado")!.anos.find((a) => a.ano === ANOS_SIMULACAO[0])!.cargaTotal);
    expect(cargas.length).toBe(2);
    // Faixas do Simples têm alíquota efetiva CRESCENTE — a carga em % da receita no ponto maior não é a mesma do ponto menor.
    const percentual = (i: number) => cargas[i] / r.pontos[i].valor;
    expect(percentual(1)).not.toBeCloseTo(percentual(0), 3);
  });
});

describe("Sensibilidade de custo de capital separa capital de giro de custo financeiro (seção 61)", () => {
  it("variar a taxa não altera a necessidade de capital de giro, só o custo financeiro", () => {
    const cenario = cenarioServico();
    const r = executarSensibilidade({
      variavel: "custoCapital",
      valores: [0.005, 0.02],
      cenarioBase: cenario,
      motoresRegime: [motorLucroPresumido],
      ano: ANOS_SIMULACAO[0],
      regimeReferencia: "lucro_presumido",
      opcoes: { premissasSplit: { percentualRecebimentosSujeitos: campo(1, "informado_usuario", "estimado"), percentualTributoSegregado: campo(0.1, "informado_usuario", "estimado") } },
    });
    const picos = r.resumo.map((x) => x.picoCapitalGiroAdicional).filter((p): p is number => p !== undefined);
    expect(picos[0]).toBeCloseTo(picos[1]!);

    const custoA = r.pontos[0].resultado.resultadoCaixaPorRegime?.find((x) => x.regime === "lucro_presumido")?.anos.find((a) => a.ano === ANOS_SIMULACAO[0])?.custoFinanceiroAnual;
    const custoB = r.pontos[1].resultado.resultadoCaixaPorRegime?.find((x) => x.regime === "lucro_presumido")?.anos.find((a) => a.ano === ANOS_SIMULACAO[0])?.custoFinanceiroAnual;
    expect(custoA).toBeDefined();
    expect(custoB).toBeDefined();
    expect(custoB!).toBeGreaterThan(custoA!);
  });
});

describe("Sensibilidade de split — capital de giro responde ao percentual sujeito (seção 60)", () => {
  it("aumentar percentualRecebimentosSujeitosSplit aumenta o pico de capital de giro adicional", () => {
    const cenario = cenarioServico();
    const r = executarSensibilidade({
      variavel: "percentualRecebimentosSujeitosSplit",
      valores: [0.2, 1],
      cenarioBase: cenario,
      motoresRegime: [motorLucroPresumido],
      ano: ANOS_SIMULACAO[0],
      opcoes: { premissasSplit: { percentualTributoSegregado: campo(0.1, "informado_usuario", "estimado") } },
    });
    const picos = r.resumo.map((x) => x.picoCapitalGiroAdicional).filter((p): p is number => p !== undefined);
    expect(picos).toHaveLength(2);
    expect(picos[1]).toBeGreaterThan(picos[0]);
  });
});

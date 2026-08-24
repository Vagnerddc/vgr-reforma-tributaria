import { describe, it, expect } from "vitest";
import { motorSimplesUnificado, motorSimplesHibrido } from "../motor";
import { motorLucroPresumido } from "../../lucroPresumido/motor";
import { compararRegimes } from "../../comparador";
import type { MotorRegime, ResultadoRegime } from "../../tipos";
import { campoComProveniencia as campo } from "../../../operacaoTributaria";
import type { CenarioEmpresa } from "../../../cenarioEmpresa";
import { ANOS_SIMULACAO } from "../../../parametros";

function cenarioMonoAtividade(perfilId: string, faturamento: number): CenarioEmpresa {
  return {
    id: `cenario-${perfilId}`,
    identificacao: {
      nomeEmpresa: campo("Empresa Teste", "informado_usuario", "confirmado"),
      atividadePrincipal: { perfilId, status: "confirmado", origem: "informado_usuario" },
    },
    receita: {
      faturamentoAnual: campo(faturamento, "informado_usuario", "confirmado"),
      mixMercado: { b2b: campo(0.7, "informado_usuario", "confirmado"), b2c: campo(0.3, "informado_usuario", "confirmado") },
    },
    custos: { itens: [] },
    pessoas: {},
    tributario: {
      regimeAtual: campo("simples_unificado", "informado_usuario", "confirmado"),
      premissas: { pisCofinsPercentualAtual: campo(0.0365, "informado_usuario", "confirmado"), icmsIpiPercentualAtual: campo(0.05, "informado_usuario", "confirmado") },
    },
    economicoFinanceiro: { meioPagamentoPredominante: campo("pix", "informado_usuario", "confirmado") },
    dadosSetoriais: [],
  };
}

describe("MotorSimplesUnificado — mono-atividade (comércio, sem crescimento)", () => {
  const cenario = cenarioMonoAtividade("varejo_generico", 1_200_000);
  const elegibilidade = motorSimplesUnificado.avaliarElegibilidade(cenario);
  const resultado = motorSimplesUnificado.calcular(cenario, elegibilidade);

  it("elegibilidade elegível, regime carimbado corretamente", () => {
    expect(elegibilidade.status).toBe("elegivel");
    expect(resultado.regime).toBe("simples_unificado");
  });

  it("cobre os 8 anos, componente 'das' presente e auditável", () => {
    expect(resultado.anos).toHaveLength(8);
    expect(resultado.anos.map((a) => a.ano)).toEqual(ANOS_SIMULACAO);
    const das2026 = resultado.anos[0].componentes.find((c) => c.componente === "das")!;
    expect(das2026.fundamentoLegal).toContain("18");
    expect(das2026.base).toBeGreaterThan(0);
  });

  it("IBS/CBS reaproveitados do Motor VGR (origemCalculo: motor_vgr)", () => {
    const ibs = resultado.anos[0].componentes.find((c) => c.componente === "ibs");
    expect(ibs?.origemCalculo).toBe("motor_vgr");
  });

  it("DAS não é sinônimo de cargaTotal — cargaTotal soma DAS + IBS/CBS reaproveitados", () => {
    const ano = resultado.anos[0];
    const das = ano.componentes.find((c) => c.componente === "das")!.valor;
    const ibs = ano.componentes.find((c) => c.componente === "ibs")?.valor ?? 0;
    const cbs = ano.componentes.find((c) => c.componente === "cbs")?.valor ?? 0;
    expect(ano.cargaTotal).toBeCloseTo(das + ibs + cbs, 2);
    expect(ano.cargaTotal).not.toBeCloseTo(das, 2); // nunca DAS sozinho apresentado como carga total
  });
});

describe("MotorSimplesUnificado vs MotorSimplesHibrido — mesmo cenário, resultados que podem divergir só no componente CBS/IBS", () => {
  it("o núcleo (DAS) é idêntico; a diferença possível fica nos componentes reaproveitados do Motor VGR", () => {
    const cenario = cenarioMonoAtividade("varejo_generico", 1_200_000);
    const rUnificado = motorSimplesUnificado.calcular(cenario, motorSimplesUnificado.avaliarElegibilidade(cenario));
    const rHibrido = motorSimplesHibrido.calcular(cenario, motorSimplesHibrido.avaliarElegibilidade(cenario));

    const dasUnificado = rUnificado.anos[0].componentes.find((c) => c.componente === "das")!.valor;
    const dasHibrido = rHibrido.anos[0].componentes.find((c) => c.componente === "das")!.valor;
    expect(dasUnificado).toBeCloseTo(dasHibrido, 2); // núcleo do Simples não muda entre os dois motores
  });
});

describe("Atividade dependente de Fator R — indeterminada, nunca calculada por aproximação", () => {
  it("clínica médica (serviço) não é calculada — alerta explica a dependência de Fator R", () => {
    const cenario = cenarioMonoAtividade("clinica_medica", 800_000);
    const resultado = motorSimplesUnificado.calcular(cenario, motorSimplesUnificado.avaliarElegibilidade(cenario));
    expect(resultado.porAtividade).toBeUndefined();
    expect(resultado.alertas.some((a) => a.includes("Fator R"))).toBe(true);
    // sem DAS calculado — só IBS/CBS reaproveitado pode aparecer
    expect(resultado.anos[0].componentes.find((c) => c.componente === "das")).toBeUndefined();
  });
});

describe("Multiatividade no Simples — frigorífico (indeterminado) + transporte de cargas (Anexo III determinável)", () => {
  it("só a atividade com anexo determinável entra no cálculo; a outra fica em alertas", () => {
    const cenario: CenarioEmpresa = {
      id: "cenario-multi-simples",
      identificacao: {
        nomeEmpresa: campo("Multi Simples", "informado_usuario", "confirmado"),
        atividadePrincipal: { perfilId: "transporte_rodoviario_cargas", status: "confirmado", origem: "informado_usuario" },
        atividadesSecundarias: [{ perfilId: "frigorifico", status: "confirmado", origem: "informado_usuario" }],
      },
      receita: {
        faturamentoAnual: campo(2_000_000, "informado_usuario", "confirmado"),
        receitaPorAtividade: {
          transporte_rodoviario_cargas: campo(1_200_000, "informado_usuario", "confirmado"),
          frigorifico: campo(800_000, "informado_usuario", "confirmado"),
        },
        mixMercado: { b2b: campo(1, "informado_usuario", "confirmado"), b2c: campo(0, "informado_usuario", "confirmado") },
      },
      custos: { itens: [] },
      pessoas: {},
      tributario: {
        regimeAtual: campo("simples_unificado", "informado_usuario", "confirmado"),
        premissas: { pisCofinsPercentualAtual: campo(0.03, "informado_usuario", "confirmado"), icmsIpiPercentualAtual: campo(0.04, "informado_usuario", "confirmado") },
      },
      economicoFinanceiro: { meioPagamentoPredominante: campo("boleto", "informado_usuario", "confirmado") },
      dadosSetoriais: [],
    };

    const resultado = motorSimplesUnificado.calcular(cenario, motorSimplesUnificado.avaliarElegibilidade(cenario));
    expect(resultado.porAtividade).toBeUndefined(); // só 1 atividade calculável → sem decomposição (mesma regra do Presumido)
    expect(resultado.alertas.some((a) => a.includes("Frigorífico"))).toBe(true);
    expect(resultado.anos[0].componentes.find((c) => c.componente === "das")).toBeDefined(); // transporte de cargas foi calculado
  });
});

describe("Integração com compararRegimes — Presumido real + Simples real + Real fake", () => {
  it("os três coexistem sem o comparador conhecer nenhuma fórmula fiscal", () => {
    const cenario = cenarioMonoAtividade("varejo_generico", 1_200_000);
    const motorRealFake: MotorRegime = {
      regime: "lucro_real",
      avaliarElegibilidade: () => ({ regime: "lucro_real", status: "elegivel", motivo: "fake", criterios: [] }),
      calcular: (): ResultadoRegime => ({
        regime: "lucro_real",
        aplicabilidade: { regime: "lucro_real", status: "elegivel", motivo: "fake", criterios: [] },
        anos: [{ ano: 2026, disponivel: true, componentes: [], cargaTotal: 50_000 }],
        cargaTotalPeriodo: 50_000,
        componentesConsolidados: {},
        premissas: {},
        qualidade: { percentualConfirmado: 100, origemIbsCbs: "nao_aplicavel" },
        alertas: [],
        memoria: [],
      }),
    };

    const r = compararRegimes(cenario, [motorLucroPresumido, motorSimplesUnificado, motorRealFake]);
    expect(r.resultados).toHaveLength(3);
    expect(r.resultados.find((res) => res.regime === "simples_unificado")!.anos.length).toBe(8);
    expect(r.resultados.find((res) => res.regime === "lucro_presumido")!.anos.length).toBe(8);
    expect(r.regimeMenorCarga).toBeDefined();
  });
});

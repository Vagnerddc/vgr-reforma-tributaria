import { describe, it, expect } from "vitest";
import { motorLucroPresumido } from "../motor";
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
      regimeAtual: campo("lucro_presumido", "informado_usuario", "confirmado"),
      premissas: { pisCofinsPercentualAtual: campo(0.0365, "informado_usuario", "confirmado"), icmsIpiPercentualAtual: campo(0.05, "informado_usuario", "confirmado") },
    },
    economicoFinanceiro: { meioPagamentoPredominante: campo("pix", "informado_usuario", "confirmado") },
    dadosSetoriais: [],
  };
}

function fakeMotor(regime: MotorRegime["regime"], status: "elegivel" | "inelegivel", carga: number): MotorRegime {
  return {
    regime,
    avaliarElegibilidade: () => ({ regime, status, motivo: "fake", criterios: [] }),
    calcular: (): ResultadoRegime => ({
      regime,
      aplicabilidade: { regime, status, motivo: "fake", criterios: [] },
      anos: [{ ano: 2026, disponivel: true, componentes: [], cargaTotal: carga }],
      cargaTotalPeriodo: carga,
      componentesConsolidados: {},
      premissas: {},
      qualidade: { percentualConfirmado: 100, origemIbsCbs: "nao_aplicavel" },
      alertas: [],
      memoria: [],
    }),
  };
}

describe("MotorLucroPresumido — mono-atividade (comércio)", () => {
  const cenario = cenarioMonoAtividade("varejo_generico", 3_600_000); // 300.000/mês, sem adicional
  const elegibilidade = motorLucroPresumido.avaliarElegibilidade(cenario);
  const resultado = motorLucroPresumido.calcular(cenario, elegibilidade);

  it("elegibilidade é 'elegivel' e o motivo é explicativo", () => {
    expect(elegibilidade.status).toBe("elegivel");
    expect(elegibilidade.motivo).toBeTruthy();
  });

  it("cobre os 8 anos de ANOS_SIMULACAO (2026-2033), todos disponíveis", () => {
    expect(resultado.anos).toHaveLength(8);
    expect(resultado.anos.map((a) => a.ano)).toEqual(ANOS_SIMULACAO);
    expect(resultado.anos.every((a) => a.disponivel)).toBe(true);
  });

  it("componentes incluem irpj e csll com auditoria completa, e IBS/CBS reaproveitado do Motor VGR", () => {
    const ano2026 = resultado.anos.find((a) => a.ano === 2026)!;
    const irpj = ano2026.componentes.find((c) => c.componente === "irpj")!;
    const csll = ano2026.componentes.find((c) => c.componente === "csll")!;
    const ibs = ano2026.componentes.find((c) => c.componente === "ibs")!;
    const cbs = ano2026.componentes.find((c) => c.componente === "cbs")!;

    expect(irpj.fundamentoLegal).toContain("9.249");
    expect(irpj.status).toBe("estimado");
    expect(csll.fundamentoLegal).toBeTruthy();
    expect(ibs.origemCalculo).toBe("motor_vgr"); // reaproveitado, não recalculado
    expect(cbs.origemCalculo).toBe("motor_vgr");
    expect(resultado.qualidade.origemIbsCbs).toBe("motor_vgr");
  });

  it("sem multiatividade, porAtividade fica ausente (consolidado já é o resultado final)", () => {
    expect(resultado.porAtividade).toBeUndefined();
  });

  it("cargaTotalPeriodo é a soma dos 8 anos disponíveis", () => {
    const somaManual = resultado.anos.reduce((s, a) => s + a.cargaTotal, 0);
    expect(resultado.cargaTotalPeriodo).toBeCloseTo(somaManual, 2);
  });
});

describe("MotorLucroPresumido — multiatividade (frigorífico + distribuição atacadista)", () => {
  const cenario: CenarioEmpresa = {
    id: "cenario-multi",
    identificacao: {
      nomeEmpresa: campo("Empresa Multi", "informado_usuario", "confirmado"),
      atividadePrincipal: { perfilId: "frigorifico", status: "confirmado", origem: "informado_usuario" },
      atividadesSecundarias: [{ perfilId: "atacado_distribuicao", status: "confirmado", origem: "informado_usuario" }],
    },
    receita: {
      faturamentoAnual: campo(5_000_000, "informado_usuario", "confirmado"),
      receitaPorAtividade: {
        frigorifico: campo(3_000_000, "informado_usuario", "confirmado"),
        atacado_distribuicao: campo(2_000_000, "informado_usuario", "confirmado"),
      },
      mixMercado: { b2b: campo(1, "informado_usuario", "confirmado"), b2c: campo(0, "informado_usuario", "confirmado") },
    },
    custos: { itens: [] },
    pessoas: {},
    tributario: {
      regimeAtual: campo("lucro_presumido", "informado_usuario", "confirmado"),
      premissas: { pisCofinsPercentualAtual: campo(0.03, "informado_usuario", "confirmado"), icmsIpiPercentualAtual: campo(0.04, "informado_usuario", "confirmado") },
    },
    economicoFinanceiro: { meioPagamentoPredominante: campo("boleto", "informado_usuario", "confirmado") },
    dadosSetoriais: [],
  };

  const elegibilidade = motorLucroPresumido.avaliarElegibilidade(cenario);
  const resultado = motorLucroPresumido.calcular(cenario, elegibilidade);

  it("calcula as duas atividades separadamente (porAtividade) e consolida", () => {
    expect(resultado.porAtividade).toHaveLength(2);
    const perfis = resultado.porAtividade!.map((a) => a.perfilId);
    expect(perfis).toContain("frigorifico");
    expect(perfis).toContain("atacado_distribuicao");
  });

  it("a soma dos componentes por atividade bate com o consolidado (nenhuma base somada incorretamente)", () => {
    const ano2026 = resultado.anos.find((a) => a.ano === 2026)!;
    const irpjConsolidado = ano2026.componentes.find((c) => c.componente === "irpj")!.valor;
    const irpjPorAtividade = resultado.porAtividade!.reduce((s, a) => {
      const irpjAtividade = a.anos.find((r) => r.ano === 2026)!.componentes.find((c) => c.componente === "irpj")?.valor ?? 0;
      return s + irpjAtividade;
    }, 0);
    expect(irpjConsolidado).toBeCloseTo(irpjPorAtividade, 2);
  });
});

describe("MotorLucroPresumido — não inventa segregação de receita (seção 7 do pedido)", () => {
  it("multiatividade SEM receitaPorAtividade: nenhuma atividade é calculada, e o motivo é registrado em alertas", () => {
    const cenario: CenarioEmpresa = {
      id: "cenario-sem-segregacao",
      identificacao: {
        atividadePrincipal: { perfilId: "frigorifico", status: "confirmado", origem: "informado_usuario" },
        atividadesSecundarias: [{ perfilId: "atacado_distribuicao", status: "confirmado", origem: "informado_usuario" }],
      },
      receita: { faturamentoAnual: campo(5_000_000, "informado_usuario", "confirmado") }, // sem receitaPorAtividade
      custos: { itens: [] },
      pessoas: {},
      tributario: {},
      economicoFinanceiro: {},
      dadosSetoriais: [],
    };
    const elegibilidade = motorLucroPresumido.avaliarElegibilidade(cenario);
    const resultado = motorLucroPresumido.calcular(cenario, elegibilidade);

    expect(resultado.porAtividade).toBeUndefined(); // nenhuma atividade calculada
    expect(resultado.cargaTotalPeriodo).toBe(0);
    expect(resultado.anos.every((a) => !a.disponivel)).toBe(true); // indisponível, não "carga zero"
    expect(resultado.alertas.some((a) => a.includes("frigorifico"))).toBe(true);
    expect(resultado.alertas.some((a) => a.includes("atacado_distribuicao"))).toBe(true);
  });

  it("atividade com natureza tributária indeterminada (ex.: construção civil) não é calculada, mas fica registrada em alertas", () => {
    const cenario = cenarioMonoAtividade("construcao_civil", 2_000_000);
    const elegibilidade = motorLucroPresumido.avaliarElegibilidade(cenario);
    const resultado = motorLucroPresumido.calcular(cenario, elegibilidade);
    expect(resultado.porAtividade).toBeUndefined();
    expect(resultado.anos.every((a) => !a.disponivel)).toBe(true);
    expect(resultado.alertas.some((a) => a.includes("presunção"))).toBe(true);
  });
});

describe("Integração com compararRegimes — o motor real convive com motores fake dos outros regimes", () => {
  it("executa o Presumido real ao lado de fakes de Simples/Real, e regimeMenorCarga considera os três", () => {
    const cenario = cenarioMonoAtividade("varejo_generico", 3_600_000);
    const r = compararRegimes(cenario, [motorLucroPresumido, fakeMotor("simples_unificado", "elegivel", 999_999_999), fakeMotor("lucro_real", "elegivel", 1)]);

    expect(r.resultados).toHaveLength(3);
    const presumido = r.resultados.find((res) => res.regime === "lucro_presumido")!;
    expect(presumido.anos.length).toBe(8); // motor real, não fake — resultado completo

    expect(r.regimeMenorCarga).toBe("lucro_real"); // fake com carga 1, deliberadamente menor que qualquer cálculo real
  });

  it("quando o cenário é inelegível ao Presumido (receita acima do limite), o comparador não chama calcular() e o regime aparece sem anos", () => {
    const cenario = cenarioMonoAtividade("varejo_generico", 100_000_000);
    const r = compararRegimes(cenario, [motorLucroPresumido, fakeMotor("lucro_real", "elegivel", 500_000)]);
    const presumido = r.resultados.find((res) => res.regime === "lucro_presumido")!;
    expect(presumido.aplicabilidade.status).toBe("inelegivel");
    expect(presumido.anos).toEqual([]);
    expect(r.regimeMenorCarga).toBe("lucro_real");
  });
});

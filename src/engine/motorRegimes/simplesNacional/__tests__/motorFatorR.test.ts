import { describe, it, expect } from "vitest";
import { motorSimplesUnificado, motorSimplesHibrido } from "../motor";
import { campoComProveniencia as campo } from "../../../operacaoTributaria";
import type { CenarioEmpresa } from "../../../cenarioEmpresa";

function cenarioServicoComFatorR(perfilId: string, faturamento: number, folhaAnual: number, encargosAnual: number, proLaboreAnual: number): CenarioEmpresa {
  return {
    id: `cenario-${perfilId}`,
    identificacao: { nomeEmpresa: campo("Empresa Serviço", "informado_usuario", "confirmado"), atividadePrincipal: { perfilId, status: "confirmado", origem: "informado_usuario" } },
    receita: {
      faturamentoAnual: campo(faturamento, "informado_usuario", "confirmado"),
      mixMercado: { b2b: campo(0.5, "informado_usuario", "confirmado"), b2c: campo(0.5, "informado_usuario", "confirmado") },
    },
    custos: { itens: [] },
    pessoas: {
      folhaAnual: campo(folhaAnual, "informado_usuario", "confirmado"),
      encargosAnual: campo(encargosAnual, "informado_usuario", "confirmado"),
      proLaboreAnual: campo(proLaboreAnual, "informado_usuario", "confirmado"),
    },
    tributario: {
      regimeAtual: campo("simples_unificado", "informado_usuario", "confirmado"),
      premissas: { pisCofinsPercentualAtual: campo(0.0365, "informado_usuario", "confirmado"), icmsIpiPercentualAtual: campo(0, "informado_usuario", "confirmado") },
    },
    economicoFinanceiro: { meioPagamentoPredominante: campo("pix", "informado_usuario", "confirmado") },
    dadosSetoriais: [],
  };
}

describe("Clínica médica com Fator R calculável — deixa de ser indeterminada", () => {
  it("com RBT12 e FS12 suficientes, produz Fator R, anexo, DAS e memória — sem equiparação hospitalar", () => {
    // Receita 1.200.000/ano (RBT12≈1.200.000); folha+encargos+pró-labore somam 360.000 (FS12≈360.000) → Fator R = 30% → Anexo III.
    const cenario = cenarioServicoComFatorR("clinica_medica", 1_200_000, 250_000, 60_000, 50_000);
    const resultado = motorSimplesUnificado.calcular(cenario, motorSimplesUnificado.avaliarElegibilidade(cenario));

    expect(resultado.porAtividade).toBeUndefined(); // mono-atividade calculável — sem decomposição necessária
    const das2026 = resultado.anos[0].componentes.find((c) => c.componente === "das")!;
    expect(das2026).toBeDefined();
    expect(das2026.memoriaCalculo).toContain("Fator R médio");
    expect(das2026.fundamentoLegal).toContain("5º-M");
    expect(resultado.anos[0].disponivel).toBe(true);
  });

  it("sem dados de pessoas, permanece indeterminada (comportamento anterior preservado)", () => {
    const cenario = cenarioServicoComFatorR("clinica_medica", 1_200_000, 0, 0, 0);
    cenario.pessoas = {}; // sem nenhum dado
    const resultado = motorSimplesUnificado.calcular(cenario, motorSimplesUnificado.avaliarElegibilidade(cenario));
    expect(resultado.anos[0].componentes.find((c) => c.componente === "das")).toBeUndefined();
    expect(resultado.alertas.some((a) => a.includes("FATOR_R_INDETERMINADO") || a.includes("FS12 indeterminada"))).toBe(true);
  });
});

describe("Software/SaaS — mesmo núcleo da clínica, nenhum cálculo específico por setor", () => {
  it("Fator R abaixo de 28% → Anexo V, DAS calculado", () => {
    // Receita 800.000/ano; folha+encargos+pró-labore = 160.000 → Fator R = 20% → Anexo V.
    const cenario = cenarioServicoComFatorR("software_saas", 800_000, 120_000, 30_000, 10_000);
    const resultado = motorSimplesUnificado.calcular(cenario, motorSimplesUnificado.avaliarElegibilidade(cenario));
    const das = resultado.anos[0].componentes.find((c) => c.componente === "das")!;
    expect(das).toBeDefined();
    expect(das.memoriaCalculo).toContain("Anexo V");
  });
});

describe("Multiatividade com Fator R — só a parcela aplicável é afetada", () => {
  it("comércio (Anexo I fixo) + serviço sujeito a Fator R: cada atividade mantém seu próprio tratamento", () => {
    const cenario: CenarioEmpresa = {
      id: "cenario-multi-fatorr",
      identificacao: {
        nomeEmpresa: campo("Comércio e Consultoria", "informado_usuario", "confirmado"),
        atividadePrincipal: { perfilId: "varejo_generico", status: "confirmado", origem: "informado_usuario" },
        atividadesSecundarias: [{ perfilId: "consultoria_servicos_profissionais", status: "confirmado", origem: "informado_usuario" }],
      },
      receita: {
        faturamentoAnual: campo(2_000_000, "informado_usuario", "confirmado"),
        receitaPorAtividade: {
          varejo_generico: campo(1_400_000, "informado_usuario", "confirmado"),
          consultoria_servicos_profissionais: campo(600_000, "informado_usuario", "confirmado"),
        },
        mixMercado: { b2b: campo(0.6, "informado_usuario", "confirmado"), b2c: campo(0.4, "informado_usuario", "confirmado") },
      },
      custos: { itens: [] },
      pessoas: {
        folhaAnual: campo(150_000, "informado_usuario", "confirmado"),
        encargosAnual: campo(30_000, "informado_usuario", "confirmado"),
        proLaboreAnual: campo(20_000, "informado_usuario", "confirmado"),
      },
      tributario: {
        regimeAtual: campo("simples_unificado", "informado_usuario", "confirmado"),
        premissas: { pisCofinsPercentualAtual: campo(0.03, "informado_usuario", "confirmado"), icmsIpiPercentualAtual: campo(0.04, "informado_usuario", "confirmado") },
      },
      economicoFinanceiro: { meioPagamentoPredominante: campo("boleto", "informado_usuario", "confirmado") },
      dadosSetoriais: [],
    };

    const resultado = motorSimplesUnificado.calcular(cenario, motorSimplesUnificado.avaliarElegibilidade(cenario));
    expect(resultado.porAtividade).toHaveLength(2);
    const varejo = resultado.porAtividade!.find((a) => a.perfilId === "varejo_generico")!;
    const consultoria = resultado.porAtividade!.find((a) => a.perfilId === "consultoria_servicos_profissionais")!;
    expect(varejo.anos[0].componentes.find((c) => c.componente === "das")?.regraAplicada).toContain("anexo_i");
    expect(consultoria.anos[0].componentes.find((c) => c.componente === "das")?.regraAplicada).toContain("fator_r");
  });
});

describe("Os dois motores do Simples compartilham exatamente o mesmo cálculo de Fator R", () => {
  it("DAS da atividade sujeita a Fator R é idêntico entre simples_unificado e simples_hibrido", () => {
    const cenario = cenarioServicoComFatorR("clinica_medica", 1_200_000, 250_000, 60_000, 50_000);
    const rUnificado = motorSimplesUnificado.calcular(cenario, motorSimplesUnificado.avaliarElegibilidade(cenario));
    const rHibrido = motorSimplesHibrido.calcular(cenario, motorSimplesHibrido.avaliarElegibilidade(cenario));
    const dasUnificado = rUnificado.anos[0].componentes.find((c) => c.componente === "das")!.valor;
    const dasHibrido = rHibrido.anos[0].componentes.find((c) => c.componente === "das")!.valor;
    expect(dasUnificado).toBeCloseTo(dasHibrido, 2);
  });
});

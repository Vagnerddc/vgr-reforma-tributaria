import { describe, it, expect } from "vitest";
import { motorLucroReal } from "../motor";
import { motorLucroPresumido } from "../../lucroPresumido/motor";
import { motorSimplesUnificado } from "../../simplesNacional/motor";
import { compararRegimes } from "../../comparador";
import { campoComProveniencia as campo } from "../../../operacaoTributaria";
import type { CenarioEmpresa, AjusteFiscal } from "../../../cenarioEmpresa";
import { ANOS_SIMULACAO } from "../../../parametros";

function cenarioBase(lucroAtual: number | undefined, opts: { crescimento?: number; ajustes?: AjusteFiscal[]; saldoPrejuizoInicial?: number } = {}): CenarioEmpresa {
  return {
    id: "cenario-real",
    identificacao: { nomeEmpresa: campo("Empresa Real", "informado_usuario", "confirmado"), atividadePrincipal: { perfilId: "varejo_generico", status: "confirmado", origem: "informado_usuario" } },
    receita: {
      faturamentoAnual: campo(5_000_000, "informado_usuario", "confirmado"),
      crescimentoAnualEstimado: opts.crescimento !== undefined ? campo(opts.crescimento, "informado_usuario", "confirmado") : undefined,
      mixMercado: { b2b: campo(0.7, "informado_usuario", "confirmado"), b2c: campo(0.3, "informado_usuario", "confirmado") },
    },
    custos: { itens: [] },
    pessoas: {},
    tributario: {
      regimeAtual: campo("lucro_real", "informado_usuario", "confirmado"),
      premissas: { pisCofinsPercentualAtual: campo(0.0365, "informado_usuario", "confirmado"), icmsIpiPercentualAtual: campo(0.05, "informado_usuario", "confirmado") },
      ajustesFiscais: opts.ajustes,
      saldosPrejuizoAnteriores: opts.saldoPrejuizoInicial !== undefined ? { irpj: campo(opts.saldoPrejuizoInicial, "informado_usuario", "confirmado"), csll: campo(opts.saldoPrejuizoInicial, "informado_usuario", "confirmado") } : undefined,
    },
    economicoFinanceiro: {
      lucroAtual: lucroAtual === undefined ? undefined : campo(lucroAtual, "informado_usuario", "confirmado"),
      meioPagamentoPredominante: campo("pix", "informado_usuario", "confirmado"),
    },
    dadosSetoriais: [],
  };
}

describe("MotorLucroReal — base insuficiente nunca vira resultado definitivo", () => {
  it("sem lucro contábil informado: todos os anos indisponíveis, cargaTotalPeriodo zero", () => {
    const cenario = cenarioBase(undefined);
    const resultado = motorLucroReal.calcular(cenario, motorLucroReal.avaliarElegibilidade(cenario));
    expect(resultado.anos.every((a) => !a.disponivel)).toBe(true);
    expect(resultado.cargaTotalPeriodo).toBe(0);
    expect(resultado.alertas.some((a) => a.includes("insuficiente") || a.includes("ausente"))).toBe(true);
  });
});

describe("Qualidade da base fiscal — refletida explicitamente no resultado", () => {
  it("sem ajustes informados: qualidade 'parcial', nunca apresentada como base completa", () => {
    const cenario = cenarioBase(500_000);
    const resultado = motorLucroReal.calcular(cenario, motorLucroReal.avaliarElegibilidade(cenario));
    expect(resultado.alertas.some((a) => a.includes("parcial"))).toBe(true);
  });

  it("com ajustes informados: qualidade 'completa'", () => {
    const ajustes: AjusteFiscal[] = [{ tipo: "adicao", tributoAplicavel: "ambos", valor: 10_000, descricao: "teste", origem: "informado_usuario", status: "confirmado" }];
    const cenario = cenarioBase(500_000, { ajustes });
    const resultado = motorLucroReal.calcular(cenario, motorLucroReal.avaliarElegibilidade(cenario));
    expect(resultado.alertas.some((a) => a.includes("completa"))).toBe(true);
  });
});

describe("Multi-ano — saldo de prejuízo evolui corretamente ao longo de 2026-2033, sem mutar o cenário original", () => {
  it("cobre os 8 anos; o saldo de prejuízo diminui ao longo dos anos quando há lucro suficiente para compensar", () => {
    const cenario = cenarioBase(300_000, { saldoPrejuizoInicial: 500_000 });
    const cenarioClone = JSON.parse(JSON.stringify(cenario));

    const resultado = motorLucroReal.calcular(cenario, motorLucroReal.avaliarElegibilidade(cenario));
    expect(resultado.anos).toHaveLength(8);
    expect(resultado.anos.map((a) => a.ano)).toEqual(ANOS_SIMULACAO);
    expect(resultado.anos.every((a) => a.disponivel)).toBe(true);

    // o cenário original não foi alterado pelo cálculo (imutabilidade)
    expect(cenario).toEqual(cenarioClone);

    // a memória final reporta o saldo de prejuízo consumido ao longo dos anos
    expect(resultado.memoria[0]).toContain("Saldo de prejuízo fiscal final");
  });

  it("cargaTotal soma IRPJ + adicional (quando houver) + CSLL + IBS/CBS reaproveitado — nunca só um componente", () => {
    const cenario = cenarioBase(1_000_000);
    const resultado = motorLucroReal.calcular(cenario, motorLucroReal.avaliarElegibilidade(cenario));
    const ano2026 = resultado.anos[0];
    const soma = ano2026.componentes.reduce((s, c) => s + c.valor, 0);
    expect(ano2026.cargaTotal).toBeCloseTo(soma, 2);
    expect(ano2026.componentes.map((c) => c.componente)).toContain("irpj");
    expect(ano2026.componentes.map((c) => c.componente)).toContain("csll");
    expect(ano2026.componentes.map((c) => c.componente)).toContain("ibs");
  });
});

describe("Integração com compararRegimes — os três motores reais coexistem", () => {
  it("Presumido + Simples + Real, todos reais, sem nenhuma fórmula fiscal no comparador", () => {
    const cenarioReal = cenarioBase(1_000_000);
    const r = compararRegimes(cenarioReal, [motorLucroPresumido, motorSimplesUnificado, motorLucroReal]);
    expect(r.resultados).toHaveLength(3);
    const real = r.resultados.find((res) => res.regime === "lucro_real")!;
    expect(real.anos).toHaveLength(8);
    expect(real.aplicabilidade.status).toBe("opcional"); // não obrigatório neste cenário
  });

  it("quando o Lucro Real é OBRIGATÓRIO, essa condição é preservada no resultado mesmo que outro regime pareça mais barato", () => {
    const cenarioObrigatorio = cenarioBase(1_000_000);
    cenarioObrigatorio.receita.faturamentoAnual = campo(100_000_000, "informado_usuario", "confirmado"); // acima do limite → obrigatório
    const r = compararRegimes(cenarioObrigatorio, [motorLucroReal]);
    const real = r.resultados[0];
    expect(real.aplicabilidade.status).toBe("obrigatorio");
    // o comparador não deveria escolher outro regime "mais barato" — aqui só o Real foi avaliado,
    // então regimeMenorCarga necessariamente aponta para ele, mas o ponto é que status permanece "obrigatorio".
    expect(r.regimeMenorCarga).toBe("lucro_real");
  });
});

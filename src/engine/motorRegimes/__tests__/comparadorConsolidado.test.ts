import { describe, it, expect } from "vitest";
import { avaliarComparacaoConsolidada } from "../comparadorConsolidado";
import { compararRegimes } from "../comparador";
import { motorLucroPresumido } from "../lucroPresumido/motor";
import { motorSimplesUnificado } from "../simplesNacional/motor";
import { motorLucroReal } from "../lucroReal/motor";
import type { ResultadoRegime } from "../tipos";
import { campoComProveniencia as campo } from "../../operacaoTributaria";
import type { CenarioEmpresa, AjusteFiscal } from "../../cenarioEmpresa";
import { ANOS_SIMULACAO } from "../../parametros";

function cenarioCompleto(): CenarioEmpresa {
  const ajustes: AjusteFiscal[] = [{ tipo: "adicao", tributoAplicavel: "ambos", valor: 5_000, descricao: "teste", origem: "informado_usuario", status: "confirmado" }];
  return {
    id: "cenario-consolidado",
    identificacao: { nomeEmpresa: campo("Empresa Teste", "informado_usuario", "confirmado"), atividadePrincipal: { perfilId: "varejo_generico", status: "confirmado", origem: "informado_usuario" } },
    receita: {
      faturamentoAnual: campo(2_000_000, "informado_usuario", "confirmado"),
      mixMercado: { b2b: campo(0.7, "informado_usuario", "confirmado"), b2c: campo(0.3, "informado_usuario", "confirmado") },
    },
    custos: { itens: [] },
    pessoas: {},
    tributario: {
      regimeAtual: campo("lucro_presumido", "informado_usuario", "confirmado"),
      premissas: { pisCofinsPercentualAtual: campo(0.0365, "informado_usuario", "confirmado"), icmsIpiPercentualAtual: campo(0.05, "informado_usuario", "confirmado") },
      ajustesFiscais: ajustes,
    },
    economicoFinanceiro: { lucroAtual: campo(400_000, "informado_usuario", "confirmado"), meioPagamentoPredominante: campo("pix", "informado_usuario", "confirmado") },
    dadosSetoriais: [],
  };
}

function resultadoFake(regime: ResultadoRegime["regime"], statusJuridico: ResultadoRegime["aplicabilidade"]["status"], cargasPorAno: Record<number, number | null>, alertasExtras: string[] = [], crescimento?: number): ResultadoRegime {
  return {
    regime,
    aplicabilidade: { regime, status: statusJuridico, motivo: "teste", criterios: [] },
    anos: ANOS_SIMULACAO.map((ano) => ({ ano, disponivel: cargasPorAno[ano] !== null && cargasPorAno[ano] !== undefined, componentes: [], cargaTotal: cargasPorAno[ano] ?? 0 })),
    cargaTotalPeriodo: 0,
    componentesConsolidados: {},
    premissas: crescimento !== undefined ? { crescimentoAnualEstimado: campo(crescimento, "informado_usuario", "confirmado") } : {},
    qualidade: { percentualConfirmado: 100, origemIbsCbs: "nao_aplicavel" },
    alertas: alertasExtras,
    memoria: [],
  };
}

describe("avaliarComparacaoConsolidada — três regimes reais e completos", () => {
  it("Presumido, Simples e Real produzem ranking, mas nunca 'comparavel' puro (PIS/COFINS sempre ausente é limitação conhecida)", () => {
    const cenario = cenarioCompleto();
    const { resultados } = compararRegimes(cenario, [motorLucroPresumido, motorSimplesUnificado, motorLucroReal]);
    const consolidado = avaliarComparacaoConsolidada(cenario, resultados);

    const ano2026 = consolidado.porAno.find((a) => a.ano === 2026)!;
    expect(ano2026.porRegime).toHaveLength(3);
    expect(ano2026.rankingTributario.length).toBeGreaterThan(0);
    // Presumido/Real sempre têm PIS/COFINS ausente — nunca "comparavel" puro, sempre "com ressalvas".
    const presumido = ano2026.porRegime.find((r) => r.regime === "lucro_presumido")!;
    expect(presumido.status).toBe("comparavel_com_ressalvas");
    expect(presumido.motivos.some((m) => m.codigo === "COMPONENTE_MATERIAL_AUSENTE")).toBe(true);
  });
});

describe("Componente segregado (faixa 6) bloqueia comparação — caso real documentado", () => {
  it("Simples com tributo segregado na faixa 6 não entra no ranking, mesmo com DAS numericamente baixo", () => {
    const cenario = cenarioCompleto();
    const simplesComFaixa6 = resultadoFake("simples_unificado", "elegivel", { 2026: 1_000 }, ['Atividade "x" atingiu a faixa 6 em 2026 — nessa faixa, o tributo indireto (ICMS/ISS/IPI, conforme o anexo) é recolhido SEPARADAMENTE do DAS']);
    const presumidoNormal = resultadoFake("lucro_presumido", "elegivel", { 2026: 100_000 });

    const consolidado = avaliarComparacaoConsolidada(cenario, [simplesComFaixa6, presumidoNormal]);
    const ano2026 = consolidado.porAno.find((a) => a.ano === 2026)!;
    const simples = ano2026.porRegime.find((r) => r.regime === "simples_unificado")!;
    expect(simples.status).toBe("nao_comparavel");
    expect(simples.motivos.some((m) => m.codigo === "COMPONENTE_SEGREGADO_NAO_CALCULADO")).toBe(true);
    expect(ano2026.rankingTributario).not.toContain("simples_unificado");
    expect(ano2026.menorCargaComparavel).toBe("lucro_presumido"); // não o Simples, mesmo tendo o número "menor"
  });
});

describe("Base fiscal parcial no Lucro Real", () => {
  it("sem ajustes fiscais informados: qualidade 'parcial' gera comparável COM RESSALVAS, não bloqueio total", () => {
    const cenario = cenarioCompleto();
    cenario.tributario.ajustesFiscais = undefined; // remove os ajustes — força qualidade "parcial"
    const resultado = motorLucroReal.calcular(cenario, motorLucroReal.avaliarElegibilidade(cenario));
    const consolidado = avaliarComparacaoConsolidada(cenario, [resultado]);
    const ano2026 = consolidado.porAno.find((a) => a.ano === 2026)!;
    const real = ano2026.porRegime[0];
    expect(real.status).toBe("comparavel_com_ressalvas");
    expect(real.motivos.some((m) => m.codigo === "BASE_FISCAL_PARCIAL")).toBe(true);
  });

  it("sem lucro contábil informado: motor não calcula nenhum ano — comparador bloqueia por indisponibilidade (PERIODO_INCOMPATIVEL), nunca aparenta um resultado válido", () => {
    const cenario = cenarioCompleto();
    cenario.economicoFinanceiro.lucroAtual = undefined;
    const resultado = motorLucroReal.calcular(cenario, motorLucroReal.avaliarElegibilidade(cenario));
    const consolidado = avaliarComparacaoConsolidada(cenario, [resultado]);
    const ano2026 = consolidado.porAno.find((a) => a.ano === 2026)!;
    expect(ano2026.porRegime[0].status).toBe("nao_comparavel");
    expect(ano2026.porRegime[0].disponivel).toBe(false);
    expect(ano2026.porRegime[0].motivos.some((m) => m.codigo === "PERIODO_INCOMPATIVEL")).toBe(true);
  });

  it("qualidade 'insuficiente' isolada (ano disponível, mas base fiscal marcada insuficiente) bloqueia via QUALIDADE_INSUFICIENTE", () => {
    const cenario = cenarioCompleto();
    const fakeInsuficiente = resultadoFake("lucro_real", "opcional", { 2026: 50_000 }, ["Qualidade da base fiscal: insuficiente — lucro contábil não informado."]);
    const consolidado = avaliarComparacaoConsolidada(cenario, [fakeInsuficiente]);
    const ano2026 = consolidado.porAno.find((a) => a.ano === 2026)!;
    expect(ano2026.porRegime[0].status).toBe("nao_comparavel");
    expect(ano2026.porRegime[0].motivos.some((m) => m.codigo === "QUALIDADE_INSUFICIENTE")).toBe(true);
  });
});

describe("Obrigatoriedade jurídica prevalece sobre número menor", () => {
  it("Lucro Real obrigatório exclui Presumido/Simples do ranking, mesmo com carga fake menor", () => {
    const cenario = cenarioCompleto();
    const realObrigatorio = resultadoFake("lucro_real", "obrigatorio", { 2026: 200_000 });
    const presumidoBarato = resultadoFake("lucro_presumido", "elegivel", { 2026: 1_000 }); // artificialmente muito menor
    const simplesBarato = resultadoFake("simples_unificado", "elegivel", { 2026: 1_000 });

    const consolidado = avaliarComparacaoConsolidada(cenario, [realObrigatorio, presumidoBarato, simplesBarato]);
    const ano2026 = consolidado.porAno.find((a) => a.ano === 2026)!;
    expect(ano2026.rankingTributario).toEqual(["lucro_real"]);
    expect(ano2026.menorCargaComparavel).toBe("lucro_real");
    const presumido = ano2026.porRegime.find((r) => r.regime === "lucro_presumido")!;
    expect(presumido.status).toBe("nao_comparavel");
    expect(presumido.motivos.some((m) => m.descricao.includes("obrigatório"))).toBe(true);
  });
});

describe("Elegibilidade indeterminada nunca ganha ranking definitivo", () => {
  it("regime com elegibilidade indeterminada fica fora do ranking, mesmo tendo um número calculado", () => {
    const cenario = cenarioCompleto();
    const indeterminado = resultadoFake("simples_unificado", "indeterminado", { 2026: 5_000 });
    const presumido = resultadoFake("lucro_presumido", "elegivel", { 2026: 50_000 });
    const consolidado = avaliarComparacaoConsolidada(cenario, [indeterminado, presumido]);
    const ano2026 = consolidado.porAno.find((a) => a.ano === 2026)!;
    expect(ano2026.rankingTributario).toEqual(["lucro_presumido"]);
    expect(ano2026.porRegime.find((r) => r.regime === "simples_unificado")!.status).toBe("indeterminado");
  });
});

describe("Receitas/premissas não equivalentes entre regimes comparados", () => {
  it("crescimento anual divergente entre os resultados gera ressalva explícita", () => {
    const cenario = cenarioCompleto();
    const a = resultadoFake("lucro_presumido", "elegivel", { 2026: 50_000 }, [], 0.05);
    const b = resultadoFake("simples_unificado", "elegivel", { 2026: 48_000 }, [], 0.10);
    const consolidado = avaliarComparacaoConsolidada(cenario, [a, b]);
    const ano2026 = consolidado.porAno.find((a2) => a2.ano === 2026)!;
    expect(ano2026.porRegime.every((r) => r.motivos.some((m) => m.codigo === "RECEITAS_NAO_EQUIVALENTES"))).toBe(true);
    expect(ano2026.porRegime.every((r) => r.status === "comparavel_com_ressalvas")).toBe(true);
  });
});

describe("Multi-ano — comparabilidade avaliada ano a ano, não para todo o horizonte de uma vez", () => {
  it("um regime disponível em 2026 mas indisponível em 2028 é comparável em um ano e não no outro", () => {
    const cenario = cenarioCompleto();
    const parcial = resultadoFake("lucro_presumido", "elegivel", { 2026: 50_000, 2027: 52_000, 2028: null });
    const completo = resultadoFake("simples_unificado", "elegivel", { 2026: 48_000, 2027: 49_000, 2028: 50_000 });
    const consolidado = avaliarComparacaoConsolidada(cenario, [parcial, completo]);

    const ano2026 = consolidado.porAno.find((a) => a.ano === 2026)!;
    const ano2028 = consolidado.porAno.find((a) => a.ano === 2028)!;
    expect(ano2026.rankingTributario).toContain("lucro_presumido");
    expect(ano2028.rankingTributario).not.toContain("lucro_presumido");
    expect(ano2028.porRegime.find((r) => r.regime === "lucro_presumido")!.motivos.some((m) => m.codigo === "PERIODO_INCOMPATIVEL")).toBe(true);
  });
});

describe("Empate — nunca escolhido arbitrariamente", () => {
  it("dois regimes com carga comparável idêntica geram empate explícito, sem vencedor", () => {
    const cenario = cenarioCompleto();
    const a = resultadoFake("lucro_presumido", "elegivel", { 2026: 100_000 });
    const b = resultadoFake("simples_unificado", "elegivel", { 2026: 100_000 });
    const consolidado = avaliarComparacaoConsolidada(cenario, [a, b]);
    const ano2026 = consolidado.porAno.find((a2) => a2.ano === 2026)!;
    expect(ano2026.empate).toBe(true);
    expect(ano2026.regimesEmEmpate).toHaveLength(2);
    expect(ano2026.menorCargaComparavel).toBeUndefined();
  });

  it("diferença de sub-centavo (ruído de ponto flutuante) é tratada como empate, não como vencedor espúrio", () => {
    const cenario = cenarioCompleto();
    const a = resultadoFake("lucro_presumido", "elegivel", { 2026: 100_000.001 });
    const b = resultadoFake("simples_unificado", "elegivel", { 2026: 100_000.004 });
    const consolidado = avaliarComparacaoConsolidada(cenario, [a, b]);
    const ano2026 = consolidado.porAno.find((a2) => a2.ano === 2026)!;
    expect(ano2026.empate).toBe(true);
  });

  it("diferença real de 1 centavo já decide um vencedor (precisão correta, sem ruído artificial)", () => {
    const cenario = cenarioCompleto();
    const a = resultadoFake("lucro_presumido", "elegivel", { 2026: 100_000.0 });
    const b = resultadoFake("simples_unificado", "elegivel", { 2026: 100_000.02 });
    const consolidado = avaliarComparacaoConsolidada(cenario, [a, b]);
    const ano2026 = consolidado.porAno.find((a2) => a2.ano === 2026)!;
    expect(ano2026.empate).toBe(false);
    expect(ano2026.menorCargaComparavel).toBe("lucro_presumido");
  });
});

describe("Único regime disponível — nunca chamado de 'menor carga' em tom comparativo", () => {
  it("com um único ResultadoRegime, menorCargaComparavel aponta para ele, mas o ranking tem tamanho 1 (estrutura já deixa isso explícito)", () => {
    const cenario = cenarioCompleto();
    const unico = resultadoFake("lucro_real", "opcional", { 2026: 80_000 });
    const consolidado = avaliarComparacaoConsolidada(cenario, [unico]);
    const ano2026 = consolidado.porAno.find((a) => a.ano === 2026)!;
    expect(ano2026.rankingTributario).toEqual(["lucro_real"]);
    expect(ano2026.menorCargaComparavel).toBe("lucro_real");
  });
});

describe("Nenhum regime comparável", () => {
  it("todos inelegíveis/indisponíveis: ranking vazio, menorCargaComparavel indefinido, sem escolher vencedor", () => {
    const cenario = cenarioCompleto();
    const a = resultadoFake("lucro_presumido", "inelegivel", { 2026: 50_000 });
    const b = resultadoFake("simples_unificado", "inelegivel", { 2026: 48_000 });
    const consolidado = avaliarComparacaoConsolidada(cenario, [a, b]);
    const ano2026 = consolidado.porAno.find((a2) => a2.ano === 2026)!;
    expect(ano2026.rankingTributario).toEqual([]);
    expect(ano2026.menorCargaComparavel).toBeUndefined();
  });
});

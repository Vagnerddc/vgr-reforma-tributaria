import { describe, it, expect } from "vitest";
import { construirTimelineViewModel } from "../viewModels/timeline";
import { executarCenario } from "../../engine/motorCenarios/motor";
import { decidirRegimeTributarioNoHorizonte } from "../../engine/motorDecisao/temporal";
import { motorLucroPresumido } from "../../engine/motorRegimes/lucroPresumido/motor";
import { motorLucroReal } from "../../engine/motorRegimes/lucroReal/motor";
import { campoComProveniencia as campo } from "../../engine/operacaoTributaria";
import type { CenarioEmpresa } from "../../engine/cenarioEmpresa";
import { ANOS_SIMULACAO } from "../../engine/parametros";

function cenarioComercio(faturamento = 1_000_000, margem = 0.24): CenarioEmpresa {
  return {
    id: "c1",
    identificacao: { nomeEmpresa: campo("Empresa", "informado_usuario", "confirmado"), atividadePrincipal: { perfilId: "varejo_generico", status: "confirmado", origem: "informado_usuario" } },
    receita: { faturamentoAnual: campo(faturamento, "informado_usuario", "confirmado"), mixMercado: { b2b: campo(0.7, "informado_usuario", "confirmado"), b2c: campo(0.3, "informado_usuario", "confirmado") } },
    custos: { itens: [{ categoria: { chave: "insumos", label: "Insumos", naturezaEconomica: "custo_operacional", creditoPisCofins: { tratamento: "creditavel", status: "confirmado" }, creditoIcmsIpi: { tratamento: "creditavel", status: "confirmado" }, creditoIbsCbs: { tratamento: "creditavel", status: "confirmado" } }, valorAnual: faturamento * (1 - margem) * 0.5 }] },
    pessoas: {},
    tributario: { regimeAtual: campo("lucro_presumido", "informado_usuario", "confirmado"), premissas: { pisCofinsPercentualAtual: campo(0.0365, "informado_usuario", "confirmado"), icmsIpiPercentualAtual: campo(0.05, "informado_usuario", "confirmado") } },
    economicoFinanceiro: { lucroAtual: campo(faturamento * margem, "informado_usuario", "confirmado"), meioPagamentoPredominante: campo("pix", "informado_usuario", "confirmado") },
    dadosSetoriais: [],
  };
}

describe("53 — timeline completa com 8 pontos na ordem correta", () => {
  it("um item por ano de ANOS_SIMULACAO, em ordem crescente", () => {
    const resultado = executarCenario(cenarioComercio(), [motorLucroPresumido, motorLucroReal], {});
    const horizonte = decidirRegimeTributarioNoHorizonte(resultado, {});
    const vm = construirTimelineViewModel(resultado, horizonte);
    expect(vm.anos.map((a) => a.ano)).toEqual(ANOS_SIMULACAO);
  });
});

describe("54 — indicador ausente em um ano nunca herda o valor do ano anterior", () => {
  it("quando não há alternativaPreferida naquele ano, os indicadores ficam indisponíveis, nunca copiados", () => {
    const resultado = executarCenario(cenarioComercio(), [motorLucroPresumido, motorLucroReal], {});
    // horizonte vazio força alternativaPreferida undefined em todos os anos.
    const vm = construirTimelineViewModel(resultado, { decisoesPorAno: [], conclusaoHorizonte: "sem_preferencia_unica", transicoes: [] });
    for (const ano of vm.anos) {
      expect(ano.carga.disponivel).toBe(false);
      expect(ano.margem.disponivel).toBe(false);
    }
  });
});

describe("55/56 — mudança de decisão/regime é sinalizada sem alterar a decisão", () => {
  it("marcos aparecem quando statusConclusao ou alternativaPreferida mudam entre anos consecutivos", () => {
    const resultado = executarCenario(cenarioComercio(), [motorLucroPresumido, motorLucroReal], {});
    const horizonteArtificial = {
      decisoesPorAno: ANOS_SIMULACAO.map((ano, i) => ({ ano, statusConclusao: i < 3 ? ("preferencia_tecnica_robusta" as const) : ("conflito_nao_resolvido" as const), alternativaPreferida: i < 3 ? "lucro_presumido" : undefined })),
      conclusaoHorizonte: "preferencia_muda_no_horizonte" as const,
      transicoes: [{ anoAntes: ANOS_SIMULACAO[2], anoDepois: ANOS_SIMULACAO[3], alternativaAntes: "lucro_presumido", alternativaDepois: undefined }],
    };
    const vm = construirTimelineViewModel(resultado, horizonteArtificial);
    const anoDaMudanca = vm.anos.find((a) => a.ano === ANOS_SIMULACAO[3])!;
    expect(anoDaMudanca.marcos.some((m) => m.includes("mudança de conclusão"))).toBe(true);
    // A comparação nunca infere causa — só sinaliza que mudou.
    expect(anoDaMudanca.marcos.every((m) => !m.toLowerCase().includes("porque") && !m.toLowerCase().includes("causa"))).toBe(true);
  });
});

describe("57 — Score ausente em um ano nunca vira zero (contrato não inclui score obrigatório)", () => {
  it("TimelineAnoViewModel não possui campo scoreConsolidado nesta versão — nunca um 0 implícito", () => {
    const resultado = executarCenario(cenarioComercio(), [motorLucroPresumido], {});
    const vm = construirTimelineViewModel(resultado, undefined);
    for (const ano of vm.anos) expect(ano).not.toHaveProperty("scoreConsolidado");
  });
});

describe("qualidade nunca promovida na timeline", () => {
  it("qualidade do ano reflete fielmente o valor do motorFinanceiro", () => {
    const resultado = executarCenario(cenarioComercio(), [motorLucroPresumido], {});
    const horizonte = decidirRegimeTributarioNoHorizonte(resultado, {});
    const vm = construirTimelineViewModel(resultado, horizonte);
    const anoComDado = vm.anos.find((a) => a.margem.disponivel);
    if (anoComDado) {
      const anoFinanceiro = resultado.resultadoFinanceiroPorRegime[0]?.resultado.anos.find((a) => a.ano === anoComDado.ano);
      expect(anoComDado.qualidade).toBe(anoFinanceiro?.qualidade);
    }
  });
});

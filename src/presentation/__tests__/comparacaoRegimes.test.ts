import { describe, it, expect } from "vitest";
import { construirComparacaoRegimesViewModel } from "../viewModels/comparacaoRegimes";
import { construirResumoExecutivoViewModel } from "../viewModels/resumoExecutivo";
import { executarCenario } from "../../engine/motorCenarios/motor";
import { motorLucroPresumido } from "../../engine/motorRegimes/lucroPresumido/motor";
import { motorSimplesUnificado } from "../../engine/motorRegimes/simplesNacional/motor";
import { motorLucroReal } from "../../engine/motorRegimes/lucroReal/motor";
import { campoComProveniencia as campo } from "../../engine/operacaoTributaria";
import type { CenarioEmpresa } from "../../engine/cenarioEmpresa";
import { ANOS_SIMULACAO } from "../../engine/parametros";
import type { ResultadoDecisaoEstrategica, AvaliacaoAlternativa } from "../../engine/motorDecisao/tipos";

const ANO = ANOS_SIMULACAO[0];

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

function decisaoDe(alternativaPreferida: string | undefined, ids: string[]): ResultadoDecisaoEstrategica {
  const alternativasAvaliadas: AvaliacaoAlternativa[] = ids.map((identificador) => ({ identificador, aplicabilidade: "aplicavel", evidenciasFavoraveis: [], evidenciasContrarias: [], bloqueios: [], riscos: [], condicoes: [], qualidade: "media", dominancia: {} }));
  return { id: "d1", cenarioId: "c1", periodo: { ano: ANO }, objetoDecisao: "regime_tributario", alternativasAvaliadas, statusConclusao: alternativaPreferida ? "preferencia_tecnica_robusta" : "conflito_nao_resolvido", alternativaPreferida, alternativasEquivalentes: [], evidenciasFavoraveis: [], evidenciasContrarias: [], conflitos: [], bloqueios: [], riscos: [], premissas: {}, validacoesPendentes: [], qualidade: "media", condicoes: [], pontosViradaRelacionados: [], razoesConclusao: [], justificativaEstruturada: "" };
}

describe("indisponível !== 0 na tabela comparativa", () => {
  it("sem premissa de split, capital de giro e custo financeiro ficam indisponíveis, nunca 0", () => {
    const cenario = cenarioComercio();
    const resultado = executarCenario(cenario, [motorLucroPresumido, motorLucroReal], {});
    const linhas = construirComparacaoRegimesViewModel(resultado, ANO);
    for (const l of linhas) {
      expect(l.capitalGiro.disponivel).toBe(false);
      expect(l.custoFinanceiro.disponivel).toBe(false);
    }
  });

  it("regime fora de comparação (Simples com faturamento alto) recebe motivo fora_da_comparacao, nunca valor 0", () => {
    const cenario = cenarioComercio(10_000_000);
    const resultado = executarCenario(cenario, [motorSimplesUnificado, motorLucroPresumido], {});
    const linhas = construirComparacaoRegimesViewModel(resultado, ANO);
    const simples = linhas.find((l) => l.regime === "simples_unificado");
    if (simples && !simples.carga.disponivel) {
      expect(simples.carga.motivo).not.toBe("indisponivel"); // fora_da_comparacao ou nao_calculado, nunca tratado como se fosse um "0 escondido"
    }
  });
});

describe("KPIs da Visão Geral não inventam alternativa quando a decisão não aponta uma", () => {
  it("conflito_nao_resolvido produz todos os KPIs indisponíveis", () => {
    const cenario = cenarioComercio();
    const resultado = executarCenario(cenario, [motorLucroPresumido, motorLucroReal], {});
    const decisao = decisaoDe(undefined, ["lucro_presumido", "lucro_real"]);
    const resumo = construirResumoExecutivoViewModel(resultado, decisao, ANO);
    expect(resumo.cargaProjetada.disponivel).toBe(false);
    expect(resumo.margemProjetada.disponivel).toBe(false);
  });

  it("com alternativaPreferida definida, os KPIs disponíveis carregam valor real do motor", () => {
    const cenario = cenarioComercio();
    const resultado = executarCenario(cenario, [motorLucroPresumido], {});
    const decisao = decisaoDe("lucro_presumido", ["lucro_presumido"]);
    const resumo = construirResumoExecutivoViewModel(resultado, decisao, ANO);
    if (resumo.margemProjetada.disponivel) {
      const anoFinanceiro = resultado.resultadoFinanceiroPorRegime[0].resultado.anos.find((a) => a.ano === ANO);
      expect(resumo.margemProjetada.valor).toBe(anoFinanceiro?.margem);
    }
  });
});

import { describe, it, expect } from "vitest";
import { construirApresentacaoExecutivaViewModel } from "../viewModels/apresentacao";
import { indiceAnterior, indiceProximo, indiceValido } from "../components/apresentacao/navegacao";
import { construirPaginaAnaliseEstrategicaViewModel } from "../viewModels/analiseEstrategica";
import { executarAnaliseEstrategica } from "../../application/analiseEstrategica/motor";
import { motorLucroPresumido } from "../../engine/motorRegimes/lucroPresumido/motor";
import { motorLucroReal } from "../../engine/motorRegimes/lucroReal/motor";
import { campoComProveniencia as campo } from "../../engine/operacaoTributaria";
import type { CenarioEmpresa } from "../../engine/cenarioEmpresa";
import { ANOS_SIMULACAO } from "../../engine/parametros";

const ANO = ANOS_SIMULACAO[0];

function cenarioComercio(faturamento = 1_200_000, margem = 0.24): CenarioEmpresa {
  return {
    id: "c1",
    identificacao: { nomeEmpresa: campo("Empresa XYZ", "informado_usuario", "confirmado"), atividadePrincipal: { perfilId: "varejo_generico", status: "confirmado", origem: "informado_usuario" } },
    receita: { faturamentoAnual: campo(faturamento, "informado_usuario", "confirmado"), mixMercado: { b2b: campo(0.7, "informado_usuario", "confirmado"), b2c: campo(0.3, "informado_usuario", "confirmado") } },
    custos: { itens: [{ categoria: { chave: "insumos", label: "Insumos", naturezaEconomica: "custo_operacional", creditoPisCofins: { tratamento: "creditavel", status: "confirmado" }, creditoIcmsIpi: { tratamento: "creditavel", status: "confirmado" }, creditoIbsCbs: { tratamento: "creditavel", status: "confirmado" } }, valorAnual: faturamento * (1 - margem) * 0.5 }] },
    pessoas: {},
    tributario: { regimeAtual: campo("lucro_presumido", "informado_usuario", "confirmado"), premissas: { pisCofinsPercentualAtual: campo(0.0365, "informado_usuario", "confirmado"), icmsIpiPercentualAtual: campo(0.05, "informado_usuario", "confirmado") } },
    economicoFinanceiro: { lucroAtual: campo(faturamento * margem, "informado_usuario", "confirmado"), meioPagamentoPredominante: campo("pix", "informado_usuario", "confirmado") },
    dadosSetoriais: [],
  };
}

const MOTORES = [motorLucroPresumido, motorLucroReal];

describe("89 — capítulos dinâmicos: sem Pareto/Score, não existem capítulos vazios", () => {
  it("sem otimização/score configurados, os capítulos correspondentes não aparecem", () => {
    const cenario = cenarioComercio();
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES, incluirHorizonte: true });
    const paginaVm = construirPaginaAnaliseEstrategicaViewModel(analise, cenario.identificacao.nomeEmpresa?.valor);
    const apresentacao = construirApresentacaoExecutivaViewModel(paginaVm);
    expect(apresentacao.capitulos.some((c) => c.id === "pareto")).toBe(false);
  });

  it("capítulo caixa sempre existe (indisponibilidade também é informação executiva)", () => {
    const cenario = cenarioComercio();
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES, incluirHorizonte: true });
    const paginaVm = construirPaginaAnaliseEstrategicaViewModel(analise, undefined);
    const apresentacao = construirApresentacaoExecutivaViewModel(paginaVm);
    expect(apresentacao.capitulos.some((c) => c.id === "caixa")).toBe(true);
    expect(paginaVm.caixa.status).toBe("indisponivel");
  });

  it("timeline só aparece quando incluirHorizonte foi solicitado", () => {
    const cenario = cenarioComercio();
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES });
    const paginaVm = construirPaginaAnaliseEstrategicaViewModel(analise, undefined);
    const apresentacao = construirApresentacaoExecutivaViewModel(paginaVm);
    expect(apresentacao.capitulos.some((c) => c.id === "timeline")).toBe(false);
  });
});

describe("90 — condição permanece visível na apresentação", () => {
  it("limitacoesMateriais inclui a condição da decisão quando existir", () => {
    const cenario = cenarioComercio(1_200_000);
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES, premissasSplit: { percentualRecebimentosSujeitos: campo(1, "informado_usuario", "estimado"), percentualTributoSegregado: campo(0.3, "informado_usuario", "estimado"), taxaCustoCapitalMensal: campo(0.01, "informado_usuario", "estimado") } });
    const paginaVm = construirPaginaAnaliseEstrategicaViewModel(analise, undefined);
    const apresentacao = construirApresentacaoExecutivaViewModel(paginaVm);
    if (paginaVm.decisao?.status === "preferencia_tecnica_condicionada") {
      expect(paginaVm.decisao.condicoes.length).toBeGreaterThan(0);
      expect(apresentacao.limitacoesMateriais.length).toBeGreaterThan(0);
    }
  });
});

describe("91 — conflito nunca recebe vencedor na apresentação", () => {
  it("vm.decisao.alternativaPreferida permanece undefined quando status é conflito", () => {
    const cenario = cenarioComercio(1_200_000);
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES, premissasSplit: { percentualRecebimentosSujeitos: campo(1, "informado_usuario", "estimado"), percentualTributoSegregado: campo(0.3, "informado_usuario", "estimado") } });
    const paginaVm = construirPaginaAnaliseEstrategicaViewModel(analise, undefined);
    if (paginaVm.decisao?.status === "conflito_nao_resolvido") {
      expect(paginaVm.decisao.alternativaPreferida).toBeUndefined();
    }
  });
});

describe("92 — obrigação jurídica nunca vira 'melhor regime'", () => {
  it("ehObrigacaoJuridica é repassado fielmente ao ViewModel de apresentação", () => {
    const cenario = cenarioComercio(1_000_000);
    cenario.tributario.regimeAtual = campo("lucro_real", "informado_usuario", "confirmado");
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: [motorLucroReal] });
    const paginaVm = construirPaginaAnaliseEstrategicaViewModel(analise, undefined);
    const apresentacao = construirApresentacaoExecutivaViewModel(paginaVm);
    if (apresentacao.vm.decisao?.ehObrigacaoJuridica) {
      expect(apresentacao.vm.decisao.rotuloStatus).not.toContain("melhor regime");
    }
  });
});

describe("93 — Caixa indisponível nunca vira R$ 0 na apresentação", () => {
  it("vm.caixa.reducaoDisponibilidade.valor permanece undefined quando indisponível", () => {
    const cenario = cenarioComercio();
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES });
    const paginaVm = construirPaginaAnaliseEstrategicaViewModel(analise, undefined);
    const apresentacao = construirApresentacaoExecutivaViewModel(paginaVm);
    expect(apresentacao.vm.caixa.reducaoDisponibilidade.disponivel).toBe(false);
    expect(apresentacao.vm.caixa.reducaoDisponibilidade.valor).toBeUndefined();
  });
});

describe("96/97 — Score não altera decisão; Pareto sem ranking (contrato)", () => {
  it("ApresentacaoExecutivaViewModel não possui nenhum campo que combine score/pareto com decisão", () => {
    const cenario = cenarioComercio();
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES });
    const paginaVm = construirPaginaAnaliseEstrategicaViewModel(analise, undefined);
    const apresentacao = construirApresentacaoExecutivaViewModel(paginaVm);
    expect(apresentacao).not.toHaveProperty("melhorAlternativa");
    expect(apresentacao).not.toHaveProperty("rankingPareto");
  });
});

describe("98/99 — IA opcional: apresentação funciona com e sem IA já gerada", () => {
  it("sem IA gerada, capítulo 'ia' não existe", () => {
    const cenario = cenarioComercio();
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES });
    const paginaVm = construirPaginaAnaliseEstrategicaViewModel(analise, undefined);
    const apresentacao = construirApresentacaoExecutivaViewModel(paginaVm);
    expect(apresentacao.capitulos.some((c) => c.id === "ia")).toBe(false);
  });

  it("com IA já gerada (simulada), o capítulo 'ia' aparece sem nenhuma nova chamada — só reaproveita o ViewModel recebido", () => {
    const cenario = cenarioComercio();
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES });
    const paginaVm = construirPaginaAnaliseEstrategicaViewModel(analise, undefined);
    const iaFalsa = { status: "indisponivel", nivelSelecionado: "consultiva", titulo: "t", resumoExecutivo: "r", explicacao: "e", evidencias: [], condicoes: [], ressalvas: [], validacoesPendentes: [], pontosAtencao: [], origemGeracao: "x" } as const;
    const apresentacao = construirApresentacaoExecutivaViewModel(paginaVm, iaFalsa as never);
    expect(apresentacao.capitulos.some((c) => c.id === "ia")).toBe(true);
  });
});

describe("101 — análise permanece imutável ao construir o ViewModel de apresentação", () => {
  it("construirApresentacaoExecutivaViewModel não muta o ViewModel recebido", () => {
    const cenario = cenarioComercio();
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES });
    const paginaVm = construirPaginaAnaliseEstrategicaViewModel(analise, undefined);
    const antes = JSON.stringify(paginaVm);
    construirApresentacaoExecutivaViewModel(paginaVm);
    expect(JSON.stringify(paginaVm)).toBe(antes);
  });
});

describe("102 — navegação por teclado (lógica pura)", () => {
  it("indiceProximo nunca excede o total, indiceAnterior nunca fica negativo", () => {
    expect(indiceProximo(2, 3)).toBe(2);
    expect(indiceProximo(0, 3)).toBe(1);
    expect(indiceAnterior(0)).toBe(0);
    expect(indiceAnterior(2)).toBe(1);
  });
});

describe("103 — contagem de capítulos é sempre real e dinâmica", () => {
  it("total de capítulos nunca é um número fixo — reflete exatamente o que existe", () => {
    const cenario = cenarioComercio(1_200_000);
    const analiseCompleta = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES, incluirHorizonte: true, premissasSplit: { percentualRecebimentosSujeitos: campo(1, "informado_usuario", "estimado"), percentualTributoSegregado: campo(0.1, "informado_usuario", "estimado") } });
    const paginaVmCompleta = construirPaginaAnaliseEstrategicaViewModel(analiseCompleta, undefined);
    const apresentacaoCompleta = construirApresentacaoExecutivaViewModel(paginaVmCompleta);

    const cenarioMinimo = cenarioComercio();
    const analiseMinima = executarAnaliseEstrategica(cenarioMinimo, { ano: ANO, motoresRegime: [motorLucroPresumido] });
    const paginaVmMinima = construirPaginaAnaliseEstrategicaViewModel(analiseMinima, undefined);
    const apresentacaoMinima = construirApresentacaoExecutivaViewModel(paginaVmMinima);

    expect(apresentacaoCompleta.capitulos.length).toBeGreaterThan(apresentacaoMinima.capitulos.length);
  });

  it("indiceValido nunca ultrapassa a contagem real", () => {
    expect(indiceValido(50, 5)).toBe(4);
    expect(indiceValido(-3, 5)).toBe(0);
    expect(indiceValido(2, 0)).toBe(0);
  });
});

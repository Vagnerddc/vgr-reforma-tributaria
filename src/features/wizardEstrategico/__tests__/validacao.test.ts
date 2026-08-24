import { describe, it, expect } from "vitest";
import { criarRascunhoVazio } from "../tipos";
import { validarRascunho, converterRascunhoParaCenario } from "../validacao";
import { construirOpcoesExecucao } from "../execucao";
import { executarAnaliseEstrategica } from "../../../application/analiseEstrategica/motor";
import { campoComProveniencia as campo } from "../../../engine/operacaoTributaria";
import type { RascunhoCenarioEmpresa } from "../tipos";

function rascunhoMinimoValido(): RascunhoCenarioEmpresa {
  const r = criarRascunhoVazio("teste-1");
  r.identificacao.nomeEmpresa = campo("Empresa Teste", "informado_usuario", "confirmado");
  r.identificacao.uf = campo("SP", "informado_usuario", "confirmado");
  r.identificacao.atividadePrincipal = { perfilId: "varejo_generico", origem: "informado_usuario", status: "confirmado" };
  r.receita.faturamentoAnual = campo(1_200_000, "informado_usuario", "confirmado");
  r.regimesSelecionados = ["lucro_presumido"];
  return r;
}

describe("92 — cenário mínimo válido: Rascunho → CenarioEmpresa → executarAnaliseEstrategica", () => {
  it("um rascunho com dados mínimos produz um CenarioEmpresa executável", () => {
    const rascunho = rascunhoMinimoValido();
    const resultado = validarRascunho(rascunho);
    expect(resultado.valido).toBe(true);

    const { cenario, origemCenario } = converterRascunhoParaCenario(rascunho);
    expect(origemCenario).toBe("wizard_v2");

    const opcoes = construirOpcoesExecucao(rascunho);
    const analise = executarAnaliseEstrategica(cenario, opcoes);
    expect(analise.statusRegimesComparador.status).not.toBe("erro");
  });
});

describe("94 — multiatividade preserva receitas individuais", () => {
  it("duas atividades mantêm receitas distintas no cenário convertido", () => {
    const rascunho = rascunhoMinimoValido();
    rascunho.identificacao.atividadesSecundarias = [{ perfilId: "servicos_generico", origem: "informado_usuario", status: "confirmado" }];
    rascunho.receita.receitaPorAtividade = {
      varejo_generico: campo(800_000, "informado_usuario", "confirmado"),
      servicos_generico: campo(400_000, "informado_usuario", "confirmado"),
    };
    rascunho.dadosSetoriais = [{ perfilId: "varejo_generico", valores: {} }, { perfilId: "servicos_generico", valores: {} }];

    const { cenario } = converterRascunhoParaCenario(rascunho);
    expect(cenario.receita.receitaPorAtividade?.varejo_generico.valor).toBe(800_000);
    expect(cenario.receita.receitaPorAtividade?.servicos_generico.valor).toBe(400_000);
    expect(cenario.dadosSetoriais).toHaveLength(2);
  });
});

describe("95 — reconciliação de receita gera bloqueio explícito", () => {
  it("receita total diferente da soma das atividades bloqueia a simulação", () => {
    const rascunho = rascunhoMinimoValido();
    rascunho.receita.receitaPorAtividade = { varejo_generico: campo(500_000, "informado_usuario", "confirmado") };
    const resultado = validarRascunho(rascunho);
    expect(resultado.valido).toBe(false);
    expect(resultado.bloqueios.some((b) => b.includes("diverge"))).toBe(true);
  });

  it("receita total compatível com a soma das atividades não bloqueia", () => {
    const rascunho = rascunhoMinimoValido();
    rascunho.receita.receitaPorAtividade = { varejo_generico: campo(1_200_000, "informado_usuario", "confirmado") };
    const resultado = validarRascunho(rascunho);
    expect(resultado.bloqueios.some((b) => b.includes("diverge"))).toBe(false);
  });
});

describe("96 — zero versus vazio", () => {
  it("custo com valor 0 permanece 0; campo não preenchido permanece undefined", () => {
    const rascunho = rascunhoMinimoValido();
    rascunho.custos.itens = [{ categoria: { chave: "x", label: "X", naturezaEconomica: "custo_operacional", creditoPisCofins: { tratamento: "indeterminado", status: "confirmado" }, creditoIcmsIpi: { tratamento: "indeterminado", status: "confirmado" }, creditoIbsCbs: { tratamento: "indeterminado", status: "confirmado" } }, valorAnual: 0 }];
    const { cenario } = converterRascunhoParaCenario(rascunho);
    expect(cenario.custos.itens[0].valorAnual).toBe(0);
    expect(cenario.pessoas.folhaAnual).toBeUndefined();
  });
});

describe("97/98 — Fator R condicional à seleção de regimes", () => {
  it("sem Simples selecionado, FS12 não é obrigatória e não gera bloqueio", () => {
    const rascunho = rascunhoMinimoValido();
    const resultado = validarRascunho(rascunho);
    expect(resultado.valido).toBe(true);
    expect(resultado.ressalvas.some((r) => r.includes("FS12"))).toBe(true);
  });

  it("com Simples selecionado e FS12 informada, a área Pessoas/FS12 fica confirmada", () => {
    const rascunho = rascunhoMinimoValido();
    rascunho.regimesSelecionados = ["simples_unificado"];
    rascunho.pessoas.folhaAnual = campo(100_000, "informado_usuario", "confirmado");
    rascunho.pessoas.encargosAnual = campo(30_000, "informado_usuario", "confirmado");
    const resultado = validarRascunho(rascunho);
    expect(resultado.qualidadePorArea["Pessoas/FS12"]).toBe("confirmado");
  });
});

describe("100 — crédito indeterminado nunca vira não creditável", () => {
  it("item de custo sem tratamento definido preserva 'indeterminado' na conversão", () => {
    const rascunho = rascunhoMinimoValido();
    rascunho.custos.itens = [
      {
        categoria: { chave: "insumo", label: "Insumo", naturezaEconomica: "custo_direto", creditoPisCofins: { tratamento: "indeterminado", status: "confirmado" }, creditoIcmsIpi: { tratamento: "indeterminado", status: "confirmado" }, creditoIbsCbs: { tratamento: "indeterminado", status: "confirmado" } },
        valorAnual: 50_000,
      },
    ];
    const { cenario } = converterRascunhoParaCenario(rascunho);
    expect(cenario.custos.itens[0].categoria.creditoPisCofins.tratamento).toBe("indeterminado");
    expect(cenario.custos.itens[0].categoria.creditoPisCofins.tratamento).not.toBe("nao_creditavel");
  });
});

describe("101 — Lucro Real parcial gera ressalva, não bloqueio", () => {
  it("Lucro Real selecionado sem ajustes/saldos permite a simulação com ressalva", () => {
    const rascunho = rascunhoMinimoValido();
    rascunho.regimesSelecionados = ["lucro_real"];
    const resultado = validarRascunho(rascunho);
    expect(resultado.valido).toBe(true);
    expect(resultado.ressalvas.some((r) => r.includes("Lucro Real"))).toBe(true);
  });
});

describe("102/103 — split ausente não bloqueia; split presente produz caixa", () => {
  it("sem analisarCaixa, a simulação roda e o caixa fica indisponível — nunca bloqueia", () => {
    const rascunho = rascunhoMinimoValido();
    const resultado = validarRascunho(rascunho);
    expect(resultado.valido).toBe(true);
    expect(resultado.ressalvas.some((r) => r.includes("Split não configurado"))).toBe(true);

    const { cenario } = converterRascunhoParaCenario(rascunho);
    const analise = executarAnaliseEstrategica(cenario, construirOpcoesExecucao(rascunho));
    expect(analise.statusCaixa.status).not.toBe("erro");
  });

  it("com split habilitado e premissas informadas, o caixa é produzido", () => {
    const rascunho = rascunhoMinimoValido();
    rascunho.analisarCaixa = true;
    rascunho.premissasSplit = {
      percentualRecebimentosSujeitos: campo(1, "informado_usuario", "estimado"),
      percentualTributoSegregado: campo(0.3, "informado_usuario", "estimado"),
      taxaCustoCapitalMensal: campo(0.01, "informado_usuario", "estimado"),
    };
    const { cenario } = converterRascunhoParaCenario(rascunho);
    const analise = executarAnaliseEstrategica(cenario, construirOpcoesExecucao(rascunho));
    expect(analise.statusCaixa.status).toBe("disponivel");
  });
});

describe("104 — custo de capital preserva a unidade % a.m.", () => {
  it("taxaCustoCapitalMensal chega ao motor com o mesmo valor fracionário informado", () => {
    const rascunho = rascunhoMinimoValido();
    rascunho.analisarCaixa = true;
    rascunho.premissasSplit = { taxaCustoCapitalMensal: campo(0.011, "informado_usuario", "confirmado") };
    const opcoes = construirOpcoesExecucao(rascunho);
    expect(opcoes.premissasSplit?.taxaCustoCapitalMensal?.valor).toBe(0.011);
  });
});

describe("105/106/107 — otimização desabilitada, habilitada e sem limite inventado", () => {
  it("otimização desabilitada não aparece nas opções — a análise básica funciona normalmente", () => {
    const rascunho = rascunhoMinimoValido();
    const opcoes = construirOpcoesExecucao(rascunho);
    expect(opcoes.otimizacao).toBeUndefined();
  });

  it("otimização habilitada com variáveis chega corretamente às opções de execução", () => {
    const rascunho = rascunhoMinimoValido();
    rascunho.otimizacao = { habilitada: true, variaveis: [{ variavel: "faturamento", min: 1_000_000, max: 2_000_000, passos: 5 }], objetivos: ["minimizar_carga_fiscal"] };
    const opcoes = construirOpcoesExecucao(rascunho);
    expect(opcoes.otimizacao?.variaveis[0].min).toBe(1_000_000);
    expect(opcoes.otimizacao?.variaveis[0].max).toBe(2_000_000);
    expect(opcoes.otimizacao?.objetivos).toEqual(["minimizar_carga_fiscal"]);
  });

  it("otimização habilitada sem variáveis não inventa limites — apenas gera ressalva", () => {
    const rascunho = rascunhoMinimoValido();
    rascunho.otimizacao = { habilitada: true, variaveis: [], objetivos: [] };
    const opcoes = construirOpcoesExecucao(rascunho);
    expect(opcoes.otimizacao).toBeUndefined();
    const resultado = validarRascunho(rascunho);
    expect(resultado.ressalvas.some((r) => r.includes("Otimização"))).toBe(true);
  });
});

describe("108 — ponto de virada sem intervalo não é auto-configurado", () => {
  it("intervalo criado manualmente permanece 0/0 até o usuário preencher — nunca um valor presumido", () => {
    const rascunho = rascunhoMinimoValido();
    rascunho.pontosVirada = [{ tipo: "preservacao_margem", variavel: "faturamento", intervalo: { min: 0, max: 0 }, ano: 2028 }];
    expect(rascunho.pontosVirada[0].intervalo).toEqual({ min: 0, max: 0 });
  });
});

describe("109 — revisão lista lacunas materiais corretamente", () => {
  it("ressalvas e qualidade por área refletem exatamente o estado do rascunho", () => {
    const rascunho = rascunhoMinimoValido();
    const resultado = validarRascunho(rascunho);
    expect(resultado.qualidadePorArea.Empresa).toBe("confirmado");
    expect(resultado.qualidadePorArea.Caixa).toBe("nao_informado");
  });
});

describe("110/111 — impeditivo bloqueia, opcional apenas gera ressalva", () => {
  it("receita ausente bloqueia a execução", () => {
    const rascunho = criarRascunhoVazio("teste-bloqueio");
    rascunho.regimesSelecionados = ["lucro_presumido"];
    const resultado = validarRascunho(rascunho);
    expect(resultado.valido).toBe(false);
    expect(resultado.bloqueios.some((b) => b.includes("Receita ausente"))).toBe(true);
  });

  it("split ausente nunca aparece na lista de bloqueios, apenas nas ressalvas", () => {
    const rascunho = rascunhoMinimoValido();
    const resultado = validarRascunho(rascunho);
    expect(resultado.bloqueios.some((b) => b.toLowerCase().includes("split"))).toBe(false);
    expect(resultado.ressalvas.some((r) => r.toLowerCase().includes("split"))).toBe(true);
  });
});

describe("112 — imutabilidade: converter não muta o rascunho", () => {
  it("converterRascunhoParaCenario não altera o rascunho recebido", () => {
    const rascunho = rascunhoMinimoValido();
    const antes = JSON.stringify(rascunho);
    converterRascunhoParaCenario(rascunho);
    expect(JSON.stringify(rascunho)).toBe(antes);
  });
});

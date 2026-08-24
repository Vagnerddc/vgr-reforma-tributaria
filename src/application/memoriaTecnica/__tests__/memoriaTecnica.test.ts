import { describe, it, expect } from "vitest";
import { construirMemoriaTecnicaAnalise } from "../motor";
import { buscarItemPorId, construirMemoriaTecnicaViewModel } from "../../../presentation/viewModels/memoriaTecnica";
import { construirApresentacaoExecutivaViewModel } from "../../../presentation/viewModels/apresentacao";
import { construirPaginaAnaliseEstrategicaViewModel } from "../../../presentation/viewModels/analiseEstrategica";
import { executarAnaliseEstrategica } from "../../analiseEstrategica/motor";
import { motorLucroPresumido } from "../../../engine/motorRegimes/lucroPresumido/motor";
import { motorLucroReal } from "../../../engine/motorRegimes/lucroReal/motor";
import { campoComProveniencia as campo } from "../../../engine/operacaoTributaria";
import type { CenarioEmpresa } from "../../../engine/cenarioEmpresa";
import { ANOS_SIMULACAO } from "../../../engine/parametros";
import type { PerdaAdaptacaoLegado } from "../../analiseEstrategica/adapters/legadoParaCenarioEmpresa";

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

describe("84/85 — carga e margem batem exatamente com os motores de origem", () => {
  it("item de carga usa o mesmo valor de resultadoRegimes; item de margem usa o mesmo valor de resultadoFinanceiroPorRegime", () => {
    const cenario = cenarioComercio();
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES });
    const memoria = construirMemoriaTecnicaAnalise(analise);

    const resultadoRegime = analise.resultadoCenario!.resultadoRegimes.find((r) => r.regime === "lucro_presumido")!;
    const anoRegime = resultadoRegime.anos.find((a) => a.ano === ANO)!;
    const itemCarga = buscarItemPorId(memoria, `fiscal:lucro_presumido:${ANO}:carga_total`);
    expect(itemCarga?.valor).toBe(anoRegime.cargaTotal);

    const financeiro = analise.resultadoCenario!.resultadoFinanceiroPorRegime.find((r) => r.regime === "lucro_presumido")!;
    const anoFinanceiro = financeiro.resultado.anos.find((a) => a.ano === ANO)!;
    const itemMargem = buscarItemPorId(memoria, `financeiro:lucro_presumido:${ANO}:margem`);
    expect(itemMargem?.valor).toBe(anoFinanceiro.margem);
  });
});

describe("86/87 — caixa bate com ResultadoImpactoCaixa; indisponível nunca vira zero", () => {
  it("com premissas de split, o valor de custo financeiro reflete o motor de caixa", () => {
    const cenario = cenarioComercio();
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES, premissasSplit: { percentualRecebimentosSujeitos: campo(1, "informado_usuario", "estimado"), percentualTributoSegregado: campo(0.3, "informado_usuario", "estimado"), taxaCustoCapitalMensal: campo(0.01, "informado_usuario", "estimado") } });
    const memoria = construirMemoriaTecnicaAnalise(analise);
    const caixaPresumido = analise.resultadoCenario!.resultadoCaixaPorRegime?.find((r) => r.regime === "lucro_presumido");
    const anoCaixa = caixaPresumido?.anos.find((a) => a.ano === ANO);
    if (anoCaixa?.disponivel) {
      const item = buscarItemPorId(memoria, `caixa:lucro_presumido:${ANO}:custo_financeiro`);
      expect(item?.valor).toBe(anoCaixa.custoFinanceiroAnual);
    }
  });

  it("sem premissas de split, itens de caixa ficam indisponíveis — nunca com valor 0", () => {
    const cenario = cenarioComercio();
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES });
    const memoria = construirMemoriaTecnicaAnalise(analise);
    const itemCaixa = memoria.itens.find((i) => i.categoria === "caixa" && i.regime === "lucro_presumido" && i.id.endsWith(":reducao_disponibilidade"));
    if (itemCaixa && itemCaixa.status === "indisponivel") {
      expect(itemCaixa.valor).toBeUndefined();
    }
  });
});

describe("88/89/90 — decisão preserva condição, evidências contrárias e natureza jurídica", () => {
  it("condição permanece registrada nas limitações do item de decisão", () => {
    const cenario = cenarioComercio(1_200_000);
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES, premissasSplit: { percentualRecebimentosSujeitos: campo(1, "informado_usuario", "estimado"), percentualTributoSegregado: campo(0.3, "informado_usuario", "estimado"), taxaCustoCapitalMensal: campo(0.01, "informado_usuario", "estimado") } });
    const memoria = construirMemoriaTecnicaAnalise(analise);
    const itemDecisao = buscarItemPorId(memoria, `decisao:${ANO}`);
    if (analise.decisao?.statusConclusao === "preferencia_tecnica_condicionada") {
      expect(analise.decisao.condicoes.length).toBeGreaterThan(0);
      const condicoesTexto = analise.decisao.condicoes.map((c) => c.descricao);
      expect(condicoesTexto.every((c) => itemDecisao?.limitacoes.includes(c))).toBe(true);
    }
  });

  it("evidências favoráveis e contrárias nunca são eliminadas quando existe conflito", () => {
    const cenario = cenarioComercio(1_200_000);
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES, premissasSplit: { percentualRecebimentosSujeitos: campo(1, "informado_usuario", "estimado"), percentualTributoSegregado: campo(0.3, "informado_usuario", "estimado") } });
    const memoria = construirMemoriaTecnicaAnalise(analise);
    const itemDecisao = buscarItemPorId(memoria, `decisao:${ANO}`);
    if (analise.decisao?.statusConclusao === "conflito_nao_resolvido") {
      expect(analise.decisao.alternativaPreferida).toBeUndefined();
      const favoraveis = analise.decisao.evidenciasFavoraveis.map((e) => `Favorável: ${e.descricao}`);
      const contrarias = analise.decisao.evidenciasContrarias.map((e) => `Contrária: ${e.descricao}`);
      expect(favoraveis.every((e) => itemDecisao?.evidencias.includes(e))).toBe(true);
      expect(contrarias.every((e) => itemDecisao?.evidencias.includes(e))).toBe(true);
    }
  });

  it("natureza obrigacao_juridica permanece no texto do item — nunca convertida em preferência", () => {
    const cenario = cenarioComercio(1_000_000);
    cenario.tributario.regimeAtual = campo("lucro_real", "informado_usuario", "confirmado");
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: [motorLucroReal] });
    const memoria = construirMemoriaTecnicaAnalise(analise);
    const itemDecisao = buscarItemPorId(memoria, `decisao:${ANO}`);
    if (analise.decisao?.naturezaConclusao === "obrigacao_juridica") {
      expect(itemDecisao?.descricao).toContain("obrigacao_juridica");
      expect(itemDecisao?.descricao).not.toContain("melhor regime");
    }
  });
});

describe("91 — Score expõe metodologia e pesos", () => {
  it("item de dimensão de score contém o peso utilizado pela metodologia", () => {
    const cenario = cenarioComercio();
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES });
    const memoria = construirMemoriaTecnicaAnalise(analise);
    const itemScore = memoria.itens.find((i) => i.categoria === "score" && i.id.split(":").length === 3);
    if (itemScore) {
      expect(itemScore.metodologia).toBe("VGR_SCORE");
      const dimensao = memoria.itens.find((i) => i.categoria === "score" && i.id.startsWith(itemScore.id) && i.id !== itemScore.id);
      expect(dimensao?.descricao).toContain("Peso utilizado");
    }
  });
});

describe("92 — Pareto expõe metodologia, objetivos e nunca cria ranking", () => {
  it("itens de fronteira de Pareto não possuem título/rótulo de posição (1º/2º)", () => {
    const cenario = cenarioComercio();
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES });
    const memoria = construirMemoriaTecnicaAnalise(analise);
    const itensPareto = memoria.itens.filter((i) => i.categoria === "otimizacao");
    for (const item of itensPareto) {
      expect(item.titulo).not.toMatch(/1º|2º|melhor solução/i);
    }
    if (analise.otimizacao) {
      expect(itensPareto.every((i) => i.metodologia === analise.otimizacao!.metodologiaId)).toBe(true);
    }
  });
});

describe("93 — pontos de virada preservam método e precisão", () => {
  it("descrição do item contém o método (analítica/numérica) e a precisão do motor", () => {
    const cenario = cenarioComercio();
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES });
    const memoria = construirMemoriaTecnicaAnalise(analise);
    for (const ponto of analise.pontosVirada ?? []) {
      const item = memoria.itens.find((i) => i.categoria === "pontos_virada" && i.descricao.includes(ponto.origemSolucao) && i.descricao.includes(String(ponto.precisao)));
      expect(item).toBeDefined();
    }
  });
});

describe("94 — perdas do adapter legado aparecem como itens auditáveis", () => {
  it("cada perda informada gera um item de categoria execução com origem adapter_legado", () => {
    const cenario = cenarioComercio();
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES });
    const perdas: PerdaAdaptacaoLegado[] = [{ campo: "pessoas.folhaAnual", motivo: "Folha de pagamento não capturada pelo pipeline legado." }];
    const memoria = construirMemoriaTecnicaAnalise(analise, { perdasLegado: perdas });
    const itemPerda = buscarItemPorId(memoria, "legado:perda:00");
    expect(itemPerda?.descricao).toBe("Folha de pagamento não capturada pelo pipeline legado.");
    expect(itemPerda?.status).toBe("indisponivel");
  });

  it("sem perdas informadas, nenhum item de perda é criado", () => {
    const cenario = cenarioComercio();
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES });
    const memoria = construirMemoriaTecnicaAnalise(analise);
    expect(memoria.itens.some((i) => i.id.startsWith("legado:perda:"))).toBe(false);
  });
});

describe("95 — contextHash distingue análises diferentes", () => {
  it("dois cenários com resultados diferentes produzem contextHash diferentes", () => {
    const analiseA = executarAnaliseEstrategica(cenarioComercio(1_200_000, 0.24), { ano: ANO, motoresRegime: MOTORES });
    const analiseB = executarAnaliseEstrategica(cenarioComercio(3_000_000, 0.05), { ano: ANO, motoresRegime: MOTORES });
    const memoriaA = construirMemoriaTecnicaAnalise(analiseA);
    const memoriaB = construirMemoriaTecnicaAnalise(analiseB);
    expect(memoriaA.contextHash).not.toBe(memoriaB.contextHash);
  });
});

describe("96 — imutabilidade: nenhum resultado de domínio é mutado", () => {
  it("construirMemoriaTecnicaAnalise não altera a análise recebida", () => {
    const cenario = cenarioComercio();
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES });
    const antes = JSON.stringify(analise);
    construirMemoriaTecnicaAnalise(analise);
    expect(JSON.stringify(analise)).toBe(antes);
  });
});

describe("97 — determinismo: mesma análise produz a mesma memória", () => {
  it("duas construções sobre a mesma análise produzem o mesmo contextHash e a mesma quantidade de itens", () => {
    const cenario = cenarioComercio();
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES });
    const memoria1 = construirMemoriaTecnicaAnalise(analise);
    const memoria2 = construirMemoriaTecnicaAnalise(analise);
    expect(memoria1.contextHash).toBe(memoria2.contextHash);
    expect(memoria1.itens.length).toBe(memoria2.itens.length);
    expect(JSON.stringify(memoria1.itens)).toBe(JSON.stringify(memoria2.itens));
  });
});

describe("98 — funciona integralmente sem IA", () => {
  it("sem resposta de IA, iaMetadado fica indefinido e o restante da memória é construído normalmente", () => {
    const cenario = cenarioComercio();
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES });
    const memoria = construirMemoriaTecnicaAnalise(analise);
    expect(memoria.iaMetadado).toBeUndefined();
    expect(memoria.itens.length).toBeGreaterThan(0);
  });
});

describe("99 — nenhum dado pessoal irrelevante vaza para a memória", () => {
  it("a memória não carrega o objeto cenario/CenarioEmpresa, apenas o cenarioId", () => {
    const cenario = cenarioComercio();
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES });
    const memoria = construirMemoriaTecnicaAnalise(analise);
    expect(memoria).not.toHaveProperty("cenario");
    expect(memoria.cenarioId).toBe(cenario.id);
    expect(JSON.stringify(memoria)).not.toContain("Empresa XYZ");
  });
});

describe("100 — nenhum vestígio de chain-of-thought", () => {
  it("a memória nunca contém chainOfThought/reasoningTokens/internalReasoning", () => {
    const cenario = cenarioComercio();
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES });
    const memoria = construirMemoriaTecnicaAnalise(analise);
    const texto = JSON.stringify(memoria).toLowerCase();
    expect(texto).not.toContain("chainofthought");
    expect(texto).not.toContain("reasoningtokens");
    expect(texto).not.toContain("internalreasoning");
  });
});

describe("101 — deep-link retorna o item correto", () => {
  it("buscarItemPorId localiza o item de carga pelo id determinístico", () => {
    const cenario = cenarioComercio();
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES });
    const memoria = construirMemoriaTecnicaAnalise(analise);
    const item = buscarItemPorId(memoria, `fiscal:lucro_presumido:${ANO}:carga_total`);
    expect(item?.categoria).toBe("fiscal");
    expect(item?.regime).toBe("lucro_presumido");
  });

  it("o ViewModel expõe links rápidos para carga/margem/decisão", () => {
    const cenario = cenarioComercio();
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES });
    const memoria = construirMemoriaTecnicaAnalise(analise);
    const vm = construirMemoriaTecnicaViewModel(memoria);
    expect(vm.linksRapidos.some((l) => l.rotulo === "Carga")).toBe(true);
  });
});

describe("102 — IDs são únicos dentro de uma mesma memória", () => {
  it("nenhum id se repete entre os itens produzidos", () => {
    const cenario = cenarioComercio();
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES });
    const memoria = construirMemoriaTecnicaAnalise(analise);
    const ids = memoria.itens.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("103 — Modo Apresentação permanece intacto com a Memória Técnica presente", () => {
  it("construir a memória técnica não altera o ViewModel de apresentação nem seus capítulos", () => {
    const cenario = cenarioComercio();
    const analise = executarAnaliseEstrategica(cenario, { ano: ANO, motoresRegime: MOTORES, incluirHorizonte: true });
    const paginaVm = construirPaginaAnaliseEstrategicaViewModel(analise, undefined);
    const apresentacaoAntes = construirApresentacaoExecutivaViewModel(paginaVm);
    construirMemoriaTecnicaAnalise(analise);
    const apresentacaoDepois = construirApresentacaoExecutivaViewModel(paginaVm);
    expect(apresentacaoDepois.capitulos.map((c) => c.id)).toEqual(apresentacaoAntes.capitulos.map((c) => c.id));
  });
});

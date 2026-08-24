import { describe, it, expect } from "vitest";
import { gerarPlanoAcao } from "../motor";
import { ordenarTopologicamente } from "../ordenacao";
import { CicloDependenciaError, type AcaoEstruturada } from "../tipos";
import type { ResultadoDecisaoEstrategica, AvaliacaoAlternativa } from "../../motorDecisao/tipos";
import type { RelatorioAuditoriaEstrategica, AchadoEstrategico } from "../../motorAchados/tipos";
import type { PlanoAlternativasEstrategicas, AlternativaEstrategica } from "../../motorEstrategico/tipos";

function avaliacoes(ids: string[]): AvaliacaoAlternativa[] {
  return ids.map((identificador) => ({ identificador, aplicabilidade: "aplicavel", evidenciasFavoraveis: [], evidenciasContrarias: [], bloqueios: [], riscos: [], condicoes: [], qualidade: "media", dominancia: {} }));
}

function decisaoBase(overrides: Partial<Omit<ResultadoDecisaoEstrategica, "alternativasAvaliadas">> & { alternativasAvaliadas?: string[] }): ResultadoDecisaoEstrategica {
  const { alternativasAvaliadas, ...resto } = overrides;
  return {
    id: "decisao:regime_tributario:c1:2028",
    cenarioId: "c1",
    periodo: { ano: 2028 },
    objetoDecisao: "regime_tributario",
    alternativasAvaliadas: avaliacoes(alternativasAvaliadas ?? []),
    statusConclusao: "sem_conclusao",
    alternativasEquivalentes: [],
    evidenciasFavoraveis: [],
    evidenciasContrarias: [],
    conflitos: [],
    bloqueios: [],
    riscos: [],
    premissas: {},
    validacoesPendentes: [],
    qualidade: "media",
    condicoes: [],
    pontosViradaRelacionados: [],
    razoesConclusao: [],
    justificativaEstruturada: "",
    ...resto,
  };
}

function achadoBase(overrides: Partial<AchadoEstrategico>): AchadoEstrategico {
  return { id: "achado:x", codigo: "CARGA_TRIBUTARIA_AUMENTOU", categoria: "fiscal", tituloTecnico: "t", descricaoTecnica: "d", evidencias: [], qualidade: "media", premissas: {}, origens: ["classificacao_vgr"], status: "estimado", ...overrides };
}

function relatorioBase(achados: AchadoEstrategico[]): RelatorioAuditoriaEstrategica {
  return { cenarioId: "c1", periodo: { anoInicio: 2026, anoFim: 2033 }, achados, qualidade: "media", resumoTecnico: "", cobertura: { fiscal: "disponivel", creditos: "disponivel", margem: "disponivel", caixa: "indisponivel", cenarios: "indisponivel", pontosVirada: "indisponivel", setorial: "indisponivel" }, premissas: {} };
}

function alternativaBase(overrides: Partial<AlternativaEstrategica>): AlternativaEstrategica {
  return {
    id: "alt:x",
    codigo: "AVALIAR_RECOMPOSICAO_PRECO",
    categoria: "preco",
    titulo: "t",
    objetivo: "o",
    descricaoTecnica: "d",
    achadosOrigem: [],
    evidencias: [],
    aplicabilidade: "condicionada",
    condicoes: [],
    dependencias: [],
    restricoes: [],
    impactosConhecidos: [],
    impactosIndeterminados: [],
    cenariosRelacionados: [],
    pontosViradaRelacionados: [],
    qualidade: "media",
    premissas: {},
    riscos: [],
    bloqueios: [],
    validacoesNecessarias: [],
    origens: ["classificacao_vgr"],
    ...overrides,
  };
}

function planoEstrategicoBase(alternativas: AlternativaEstrategica[]): PlanoAlternativasEstrategicas {
  return { cenarioId: "c1", alternativas, conflitos: [], bloqueiosGlobais: [], validacoesNecessarias: [], qualidade: "media", cobertura: { preco: "analisado", creditos: "analisado", fatorR: "nao_aplicavel", regimes: "analisado", capitalGiro: "indisponivel", custoFinanceiro: "indisponivel", qualidadeDados: "analisado" } };
}

function acaoDe(codigo: string, plano: ReturnType<typeof gerarPlanoAcao>) {
  return plano.acoes.find((a) => a.codigo === codigo);
}

const PALAVRAS_PROIBIDAS = ["aumentar_pro_labore", "contratar_emprestimo", "migrar_para_presumido", "aumentar_preco", "demitir_funcionarios"];

describe("67 — preferência condicionada por custo de capital", () => {
  it("VALIDAR_CUSTO_CAPITAL vem antes de SIMULAR_CENARIO_FINAL e de FORMALIZAR_DECISAO_TRIBUTARIA", () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_condicionada", naturezaConclusao: "preferencia_tecnica", alternativaPreferida: "lucro_presumido", alternativasAvaliadas: ["lucro_presumido", "lucro_real"], condicoes: [{ descricao: "custo de capital inferior a 1,28% a.m.", variavel: "custoCapital", limite: 0.0128 }] });
    const planoEstrategico = planoEstrategicoBase([alternativaBase({ codigo: "AVALIAR_CUSTO_FINANCEIRO", categoria: "custo_financeiro" })]);
    const plano = gerarPlanoAcao({ decisao, planoEstrategico });

    const validar = acaoDe("VALIDAR_CUSTO_CAPITAL", plano)!;
    const simular = acaoDe("SIMULAR_CENARIO_FINAL", plano)!;
    const formalizar = acaoDe("FORMALIZAR_DECISAO_TRIBUTARIA", plano)!;
    expect(validar).toBeDefined();
    expect(simular.dependeDe).toContain(validar.id);
    expect(formalizar.dependeDe).toContain(simular.id);
  });
});

describe("68 — PIS/COFINS pendente bloqueia formalização até validação", () => {
  it("VALIDAR_PIS_COFINS antes de SIMULAR_CENARIO_FINAL; formalização nunca antes da validação", () => {
    const relatorio = relatorioBase([achadoBase({ codigo: "COMPONENTE_MATERIAL_AUSENTE", descricaoTecnica: "Componentes esperados não calculados: pis, cofins.", regime: "lucro_presumido" })]);
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_robusta", naturezaConclusao: "preferencia_tecnica", alternativaPreferida: "lucro_presumido", alternativasAvaliadas: ["lucro_presumido"] });
    const plano = gerarPlanoAcao({ decisao, relatorio });

    const validarPis = acaoDe("VALIDAR_PIS_COFINS", plano)!;
    const simular = acaoDe("SIMULAR_CENARIO_FINAL", plano)!;
    expect(validarPis).toBeDefined();
    expect(simular.dependeDe).toContain(validarPis.id);

    const etapaValidacao = plano.etapas.find((e) => e.acoes.includes(validarPis.id))!;
    const etapaSimulacao = plano.etapas.find((e) => e.acoes.includes(simular.id))!;
    expect(etapaValidacao.numero).toBeLessThan(etapaSimulacao.numero);
  });
});

describe("69 — Lucro Real parcial gera validação bloqueante", () => {
  it("VALIDAR_BASE_LUCRO_REAL carrega bloqueio", () => {
    const relatorio = relatorioBase([achadoBase({ codigo: "BASE_LUCRO_REAL_PARCIAL", regime: "lucro_real", qualidade: "baixa" })]);
    const decisao = decisaoBase({ statusConclusao: "dados_insuficientes" });
    const plano = gerarPlanoAcao({ decisao, relatorio });
    const validar = acaoDe("VALIDAR_BASE_LUCRO_REAL", plano)!;
    expect(validar).toBeDefined();
    expect(validar.bloqueios.length).toBeGreaterThan(0);
  });
});

describe("70 — Fator R nunca prescreve pró-labore", () => {
  it("gera VALIDAR_COMPOSICAO_FS12, nunca AUMENTAR_PRO_LABORE, texto sem 'pró-labore' como instrução", () => {
    const decisao = decisaoBase({ statusConclusao: "sem_conclusao" });
    const planoEstrategico = planoEstrategicoBase([alternativaBase({ codigo: "AVALIAR_FATOR_R", categoria: "fator_r", objetivo: "Avaliar composição válida da FS12." })]);
    const plano = gerarPlanoAcao({ decisao, planoEstrategico });
    const validar = acaoDe("VALIDAR_COMPOSICAO_FS12", plano)!;
    expect(validar).toBeDefined();
    expect(plano.acoes.map((a) => a.codigo)).not.toContain("AUMENTAR_PRO_LABORE");
    expect(validar.objetivo.toLowerCase()).not.toContain("aumentar");
  });
});

describe("71 — preço nunca gera reajuste automático", () => {
  it("VALIDAR_VIABILIDADE_COMERCIAL_REAJUSTE carrega a referência matemática como evidência, nunca como instrução", () => {
    const decisao = decisaoBase({ statusConclusao: "sem_conclusao" });
    const planoEstrategico = planoEstrategicoBase([alternativaBase({ codigo: "AVALIAR_RECOMPOSICAO_PRECO", categoria: "preco", premissas: { reajusteMedioNecessario: 0.038 } })]);
    const plano = gerarPlanoAcao({ decisao, planoEstrategico });
    const validar = acaoDe("VALIDAR_VIABILIDADE_COMERCIAL_REAJUSTE", plano)!;
    expect(validar).toBeDefined();
    expect(validar.evidencias.some((e) => e.valor === 0.038)).toBe(true);
    expect(plano.acoes.map((a) => a.codigo)).not.toContain("REAJUSTAR_PRECO_3_8");
  });
});

describe("72 — conflito não resolvido nunca gera formalização", () => {
  it("nenhuma FORMALIZAR_DECISAO_TRIBUTARIA quando statusConclusao é conflito_nao_resolvido", () => {
    const decisao = decisaoBase({ statusConclusao: "conflito_nao_resolvido", alternativasAvaliadas: ["lucro_presumido", "lucro_real"], conflitos: ["lucro_presumido: menor carga; lucro_real: melhor caixa (capital de giro)"] });
    const plano = gerarPlanoAcao({ decisao });
    expect(plano.acoes.map((a) => a.codigo)).not.toContain("FORMALIZAR_DECISAO_TRIBUTARIA");
    expect(plano.acoes.some((a) => a.codigo === "EXECUTAR_CENARIO_ADICIONAL")).toBe(true);
  });
});

describe("73 — obrigação jurídica nunca gera ação de escolha", () => {
  it("gera FORMALIZAR_PLANEJAMENTO_NO_REGIME_OBRIGATORIO, nunca uma ação de escolha entre regimes", () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_robusta", naturezaConclusao: "obrigacao_juridica", alternativaPreferida: "lucro_real", alternativasAvaliadas: ["lucro_real"] });
    const plano = gerarPlanoAcao({ decisao });
    expect(plano.acoes.some((a) => a.codigo === "FORMALIZAR_PLANEJAMENTO_NO_REGIME_OBRIGATORIO")).toBe(true);
    expect(plano.acoes.some((a) => a.codigo === "FORMALIZAR_DECISAO_TRIBUTARIA")).toBe(false);
  });
});

describe("74 — preferência robusta sem bloqueios permite SIMULAR → FORMALIZAR", () => {
  it("fluxo completo sem validações pendentes", () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_robusta", naturezaConclusao: "preferencia_tecnica", alternativaPreferida: "lucro_presumido", alternativasAvaliadas: ["lucro_presumido"], qualidade: "alta" });
    const plano = gerarPlanoAcao({ decisao });
    const simular = acaoDe("SIMULAR_CENARIO_FINAL", plano)!;
    const formalizar = acaoDe("FORMALIZAR_DECISAO_TRIBUTARIA", plano)!;
    expect(formalizar.dependeDe).toEqual([simular.id]);
    expect(plano.status).toBe("pronto_para_formalizacao");
  });
});

describe("75 — ponto de virada gera monitoramento estruturado", () => {
  it("ACOMPANHAR_PONTO_VIRADA carrega variavel/limite/unidade", () => {
    const decisao = decisaoBase({
      statusConclusao: "preferencia_tecnica_condicionada",
      alternativaPreferida: "lucro_presumido",
      alternativasAvaliadas: ["lucro_presumido"],
      pontosViradaRelacionados: [{ tipo: "igualdade_resultado_economico", variavel: "custoCapital", valorEncontrado: 0.0128, estadoAntes: "a", estadoDepois: "b" }],
    });
    const plano = gerarPlanoAcao({ decisao });
    const gatilho = plano.gatilhosMonitoramento.find((g) => g.variavel === "custoCapital");
    expect(gatilho).toBeDefined();
    expect(gatilho!.valorReferencia).toBe(0.0128);
  });
});

describe("76 — mudança temporal gera reavaliação estruturada", () => {
  it("REAVALIAR_REGIME_NO_HORIZONTE com periodoAplicavel no ano da transição", () => {
    const decisao = decisaoBase({
      statusConclusao: "preferencia_tecnica_robusta",
      alternativaPreferida: "lucro_presumido",
      alternativasAvaliadas: ["lucro_presumido", "lucro_real"],
      horizonte: { decisoesPorAno: [], conclusaoHorizonte: "preferencia_muda_no_horizonte", transicoes: [{ anoAntes: 2029, anoDepois: 2030, alternativaAntes: "lucro_presumido", alternativaDepois: "lucro_real" }] },
    });
    const plano = gerarPlanoAcao({ decisao });
    const reavaliar = acaoDe("REAVALIAR_REGIME_NO_HORIZONTE", plano)!;
    expect(reavaliar).toBeDefined();
    expect(reavaliar.periodoAplicavel?.ano).toBe(2030);
  });
});

describe("77 — deduplicação preserva múltiplas origens", () => {
  it("VALIDAR_CUSTO_CAPITAL ativado por custo financeiro e por conflito vira uma única ação com origens combinadas", () => {
    const decisao = decisaoBase({ statusConclusao: "conflito_nao_resolvido", alternativasAvaliadas: ["lucro_presumido", "lucro_real"], conflitos: ["custo financeiro em disputa"] });
    const planoEstrategico = planoEstrategicoBase([alternativaBase({ codigo: "AVALIAR_CUSTO_FINANCEIRO", categoria: "custo_financeiro" })]);
    const plano = gerarPlanoAcao({ decisao, planoEstrategico });
    const validacoes = plano.acoes.filter((a) => a.codigo === "VALIDAR_CUSTO_CAPITAL");
    expect(validacoes.length).toBe(1);
    expect(validacoes[0].origens.length).toBeGreaterThan(1);
  });
});

describe("78 — gatilhos diferentes nunca são fundidos", () => {
  it("ponto de virada de faturamento e de custo de capital permanecem ações separadas", () => {
    const decisao = decisaoBase({
      statusConclusao: "preferencia_tecnica_condicionada",
      alternativaPreferida: "lucro_presumido",
      alternativasAvaliadas: ["lucro_presumido"],
      pontosViradaRelacionados: [
        { tipo: "mudanca_regime_menor_carga", variavel: "faturamento", valorEncontrado: 500000 },
        { tipo: "igualdade_resultado_economico", variavel: "custoCapital", valorEncontrado: 0.0128 },
      ],
    });
    const plano = gerarPlanoAcao({ decisao });
    const acompanhar = plano.acoes.filter((a) => a.codigo === "ACOMPANHAR_PONTO_VIRADA");
    expect(acompanhar.length).toBe(2);
    expect(new Set(acompanhar.map((a) => a.gatilho?.variavel)).size).toBe(2);
  });
});

describe("79 — dependência valida → simula → formaliza", () => {
  it("ordenação topológica respeita a cadeia completa", () => {
    const relatorio = relatorioBase([achadoBase({ codigo: "COMPONENTE_MATERIAL_AUSENTE", descricaoTecnica: "pis/cofins ausente" })]);
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_robusta", naturezaConclusao: "preferencia_tecnica", alternativaPreferida: "lucro_presumido", alternativasAvaliadas: ["lucro_presumido"] });
    const plano = gerarPlanoAcao({ decisao, relatorio });
    const validar = acaoDe("VALIDAR_PIS_COFINS", plano)!;
    const simular = acaoDe("SIMULAR_CENARIO_FINAL", plano)!;
    const formalizar = acaoDe("FORMALIZAR_DECISAO_TRIBUTARIA", plano)!;
    const numeroEtapa = (id: string) => plano.etapas.find((e) => e.acoes.includes(id))!.numero;
    expect(numeroEtapa(validar.id)).toBeLessThan(numeroEtapa(simular.id));
    expect(numeroEtapa(simular.id)).toBeLessThan(numeroEtapa(formalizar.id));
  });
});

describe("80 — ações paralelas na mesma etapa", () => {
  it("duas validações independentes aparecem na mesma etapa", () => {
    const relatorio = relatorioBase([achadoBase({ codigo: "COMPONENTE_MATERIAL_AUSENTE", descricaoTecnica: "pis/cofins ausente" })]);
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_robusta", naturezaConclusao: "preferencia_tecnica", alternativaPreferida: "lucro_presumido", alternativasAvaliadas: ["lucro_presumido"] });
    const planoEstrategico = planoEstrategicoBase([alternativaBase({ codigo: "AVALIAR_CUSTO_FINANCEIRO", categoria: "custo_financeiro" })]);
    const plano = gerarPlanoAcao({ decisao, relatorio, planoEstrategico });
    const validarPis = acaoDe("VALIDAR_PIS_COFINS", plano)!;
    const validarCusto = acaoDe("VALIDAR_CUSTO_CAPITAL", plano)!;
    const etapaPis = plano.etapas.find((e) => e.acoes.includes(validarPis.id))!;
    const etapaCusto = plano.etapas.find((e) => e.acoes.includes(validarCusto.id))!;
    expect(etapaPis.numero).toBe(etapaCusto.numero);
  });
});

describe("81 — ciclo de dependência é detectado", () => {
  it("configuração artificial A->B->A lança CicloDependenciaError", () => {
    const acoesComCiclo: AcaoEstruturada[] = [
      { id: "a", codigo: "VALIDAR_CUSTO_CAPITAL", categoria: "custo_financeiro", titulo: "a", descricaoTecnica: "", origens: [], achadosOrigem: [], alternativasOrigem: [], decisoesOrigem: [], objetivo: "", tipo: "validacao", status: "pendente", dependeDe: ["b"], bloqueios: [], riscos: [], condicoes: [], validacoesNecessarias: [], evidencias: [], responsabilidadeSugerida: [], resultadoEsperado: "", criterioConclusao: "", qualidade: "media", premissas: {} },
      { id: "b", codigo: "VALIDAR_PIS_COFINS", categoria: "fiscal", titulo: "b", descricaoTecnica: "", origens: [], achadosOrigem: [], alternativasOrigem: [], decisoesOrigem: [], objetivo: "", tipo: "validacao", status: "pendente", dependeDe: ["a"], bloqueios: [], riscos: [], condicoes: [], validacoesNecessarias: [], evidencias: [], responsabilidadeSugerida: [], resultadoEsperado: "", criterioConclusao: "", qualidade: "media", premissas: {} },
    ];
    expect(() => ordenarTopologicamente(acoesComCiclo)).toThrow(CicloDependenciaError);
  });
});

describe("82 — qualidade nunca é promovida", () => {
  it("decisão com qualidade media nunca produz plano com qualidade alta", () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_robusta", naturezaConclusao: "preferencia_tecnica", alternativaPreferida: "lucro_presumido", alternativasAvaliadas: ["lucro_presumido"], qualidade: "media" });
    const plano = gerarPlanoAcao({ decisao });
    expect(plano.qualidade).not.toBe("alta");
  });
});

describe("83 — cobertura indisponível nunca inventa ação", () => {
  it("sem alternativa de capital de giro, nenhuma ação de capital de giro é criada", () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_robusta", naturezaConclusao: "preferencia_tecnica", alternativaPreferida: "lucro_presumido", alternativasAvaliadas: ["lucro_presumido"] });
    const plano = gerarPlanoAcao({ decisao });
    expect(plano.acoes.some((a) => a.categoria === "capital_giro")).toBe(false);
    expect(plano.cobertura.caixa).toBe("nao_aplicavel");
  });
});

describe("84 — nenhuma alternativa exige providência", () => {
  it("decisão sem_conclusao sem relatorio/planoEstrategico produz acoes vazio", () => {
    const decisao = decisaoBase({ statusConclusao: "sem_conclusao" });
    const plano = gerarPlanoAcao({ decisao });
    expect(plano.acoes).toEqual([]);
    expect(plano.status).toBe("sem_acoes");
  });
});

describe("85 — determinismo", () => {
  it("mesma entrada produz as mesmas ações, dependências e ordem", () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_condicionada", naturezaConclusao: "preferencia_tecnica", alternativaPreferida: "lucro_presumido", alternativasAvaliadas: ["lucro_presumido", "lucro_real"], condicoes: [{ descricao: "custo de capital inferior a 1,28% a.m." }] });
    const planoEstrategico = planoEstrategicoBase([alternativaBase({ codigo: "AVALIAR_CUSTO_FINANCEIRO", categoria: "custo_financeiro" })]);
    const plano1 = gerarPlanoAcao({ decisao, planoEstrategico });
    const plano2 = gerarPlanoAcao({ decisao, planoEstrategico });
    expect(plano1.acoes.map((a) => a.codigo)).toEqual(plano2.acoes.map((a) => a.codigo));
    expect(plano1.etapas).toEqual(plano2.etapas);
  });
});

describe("86 — ausência de prescrição substantiva não sustentada", () => {
  it("nenhum código do catálogo corresponde a uma prescrição proibida", () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_condicionada", naturezaConclusao: "preferencia_tecnica", alternativaPreferida: "lucro_presumido", alternativasAvaliadas: ["lucro_presumido"], condicoes: [{ descricao: "x" }] });
    const planoEstrategico = planoEstrategicoBase([
      alternativaBase({ codigo: "AVALIAR_FATOR_R", categoria: "fator_r" }),
      alternativaBase({ codigo: "AVALIAR_RECOMPOSICAO_PRECO", categoria: "preco" }),
      alternativaBase({ codigo: "AVALIAR_CAPITAL_GIRO", categoria: "capital_giro" }),
    ]);
    const plano = gerarPlanoAcao({ decisao, planoEstrategico });
    const codigos = plano.acoes.map((a) => a.codigo.toLowerCase());
    for (const proibida of PALAVRAS_PROIBIDAS) expect(codigos).not.toContain(proibida);
  });
});

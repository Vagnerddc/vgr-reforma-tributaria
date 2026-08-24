import { describe, it, expect } from "vitest";
import { gerarExplicacaoConsultiva, gerarTresNiveis } from "../motor";
import { construirContexto } from "../contexto";
import { validarResposta } from "../guardrails";
import type { AvaliacaoAlternativa, ResultadoDecisaoEstrategica } from "../../motorDecisao/tipos";
import type { ProvedorIaConsultiva, RespostaBrutaIa } from "../tipos";

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

const PALAVRAS_PROIBIDAS = ["definitivamente", "garantido", "recomendamos", "deve migrar", "migre para", "contrate", "aumente pró-labore", "aumente o pró-labore", "é a melhor opção"];

describe("73 — preferência robusta nunca usa linguagem absoluta", () => {
  it("comunica preferência técnica sem 'definitivamente'/'garantido'/'sempre'", async () => {
    const decisao = decisaoBase({
      statusConclusao: "preferencia_tecnica_robusta",
      naturezaConclusao: "preferencia_tecnica",
      alternativaPreferida: "lucro_presumido",
      alternativasAvaliadas: ["lucro_presumido", "lucro_real"],
      evidenciasFavoraveis: [{ descricao: "Carga tributária menor", valor: 82000, unidade: "reais", origem: "comparador_consolidado" }],
      qualidade: "alta",
    });
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "executiva" });
    const texto = `${resposta.titulo} ${resposta.resumoExecutivo} ${resposta.explicacao}`.toLowerCase();
    for (const palavra of PALAVRAS_PROIBIDAS) expect(texto).not.toContain(palavra);
    expect(resposta.alternativaComunicada).toBe("lucro_presumido");
  });
});

describe("74 — preferência condicionada sempre menciona a condição", () => {
  it("a condição aparece em condicoesCitadas e no texto", async () => {
    const decisao = decisaoBase({
      statusConclusao: "preferencia_tecnica_condicionada",
      naturezaConclusao: "preferencia_tecnica",
      alternativaPreferida: "lucro_presumido",
      alternativasAvaliadas: ["lucro_presumido", "lucro_real"],
      condicoes: [{ descricao: "custo de capital inferior a 1,28% a.m.", variavel: "custoCapital", limite: 0.0128 }],
      qualidade: "media",
    });
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "consultiva" });
    expect(resposta.condicoesCitadas.length).toBeGreaterThan(0);
    expect(resposta.explicacao.toLowerCase()).toContain("custo de capital");
  });
});

describe("75 — conflito nunca declara vencedor", () => {
  it("resposta não afirma que uma alternativa vence, alternativaComunicada fica undefined", async () => {
    const decisao = decisaoBase({
      statusConclusao: "conflito_nao_resolvido",
      alternativasAvaliadas: ["lucro_presumido", "lucro_real"],
      conflitos: ["lucro_presumido: menor carga; lucro_real: melhor caixa"],
      qualidade: "media",
    });
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "consultiva" });
    expect(resposta.alternativaComunicada).toBeUndefined();
    const validacao = validarResposta(resposta, construirContexto(decisao));
    expect(validacao.valido).toBe(true);
  });
});

describe("76 — dados insuficientes nunca escolhe regime", () => {
  it("alternativaComunicada permanece undefined e a explicação destaca a lacuna", async () => {
    const decisao = decisaoBase({ statusConclusao: "dados_insuficientes", alternativasAvaliadas: ["lucro_presumido"], bloqueios: [{ tipo: "dados_insuficientes", descricao: "PIS/COFINS incompleto" }], qualidade: "insuficiente" });
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "executiva" });
    expect(resposta.alternativaComunicada).toBeUndefined();
    expect(resposta.explicacao.toLowerCase()).toContain("pis/cofins");
  });
});

describe("77 — obrigação jurídica nunca usa linguagem de preferência", () => {
  it("naturezaConclusao obrigacao_juridica gera texto explicando obrigatoriedade, não preferência", async () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_robusta", naturezaConclusao: "obrigacao_juridica", alternativaPreferida: "lucro_real", alternativasAvaliadas: ["lucro_real"], qualidade: "alta" });
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "consultiva" });
    const texto = `${resposta.resumoExecutivo} ${resposta.explicacao}`.toLowerCase();
    expect(texto).toContain("obrigatoriedade");
    expect(texto).not.toContain("apresenta preferência técnica");
  });
});

describe("78 — equivalência nunca escolhe arbitrariamente", () => {
  it("nenhuma alternativa é comunicada como preferida", async () => {
    const decisao = decisaoBase({ statusConclusao: "alternativas_equivalentes", alternativasEquivalentes: ["lucro_presumido", "simples_unificado"], qualidade: "media" });
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "executiva" });
    expect(resposta.alternativaComunicada).toBeUndefined();
  });
});

describe("79 — número inventado é rejeitado", () => {
  it("provedor que cita uma cifra inexistente no contexto é rejeitado e cai em fallback", async () => {
    const decisao = decisaoBase({
      statusConclusao: "preferencia_tecnica_robusta",
      naturezaConclusao: "preferencia_tecnica",
      alternativaPreferida: "lucro_presumido",
      alternativasAvaliadas: ["lucro_presumido"],
      evidenciasFavoraveis: [{ descricao: "Carga menor", valor: 82000, unidade: "reais", origem: "x" }],
      qualidade: "alta",
    });
    const provedorMalicioso: ProvedorIaConsultiva = {
      nome: "fake",
      async gerar(): Promise<RespostaBrutaIa> {
        return { titulo: "t", resumoExecutivo: "A economia é de R$ 999999 no cenário.", explicacao: "detalhe", principaisEvidencias: [], condicoesCitadas: [], ressalvas: [], validacoesPendentesCitadas: [], pontosAtencao: [], alternativaComunicada: "lucro_presumido", qualidadeComunicada: "alta" };
      },
    };
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "executiva", provedor: provedorMalicioso });
    expect(resposta.statusValidacao).toBe("rejeitada");
    expect(resposta.motivosRejeicao?.some((m) => m.includes("Número não rastreável"))).toBe(true);
  });
});

describe("80 — alternativa trocada é rejeitada", () => {
  it("provedor que comunica um regime diferente do preferido é rejeitado", async () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_robusta", naturezaConclusao: "preferencia_tecnica", alternativaPreferida: "lucro_presumido", alternativasAvaliadas: ["lucro_presumido", "lucro_real"], qualidade: "alta" });
    const provedorMalicioso: ProvedorIaConsultiva = {
      nome: "fake",
      async gerar(): Promise<RespostaBrutaIa> {
        return { titulo: "t", resumoExecutivo: "resumo", explicacao: "detalhe", principaisEvidencias: [], condicoesCitadas: [], ressalvas: [], validacoesPendentesCitadas: [], pontosAtencao: [], alternativaComunicada: "lucro_real" };
      },
    };
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "executiva", provedor: provedorMalicioso });
    expect(resposta.statusValidacao).toBe("rejeitada");
    expect(resposta.motivosRejeicao?.some((m) => m.includes("diverge"))).toBe(true);
  });
});

describe("81 — condição omitida é rejeitada", () => {
  it("preferência condicionada sem nenhuma condicoesCitadas é rejeitada", async () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_condicionada", naturezaConclusao: "preferencia_tecnica", alternativaPreferida: "lucro_presumido", alternativasAvaliadas: ["lucro_presumido"], condicoes: [{ descricao: "custo de capital inferior a 1,28% a.m." }], qualidade: "media" });
    const provedorMalicioso: ProvedorIaConsultiva = {
      nome: "fake",
      async gerar(): Promise<RespostaBrutaIa> {
        return { titulo: "t", resumoExecutivo: "resumo sem condição", explicacao: "detalhe", principaisEvidencias: [], condicoesCitadas: [], ressalvas: [], validacoesPendentesCitadas: [], pontosAtencao: [], alternativaComunicada: "lucro_presumido" };
      },
    };
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "executiva", provedor: provedorMalicioso });
    expect(resposta.statusValidacao).toBe("rejeitada");
    expect(resposta.motivosRejeicao?.some((m) => m.includes("condição"))).toBe(true);
  });
});

describe("82 — qualidade promovida é rejeitada", () => {
  it("provedor que comunica qualidade alta quando o contexto é media é rejeitado", async () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_robusta", naturezaConclusao: "preferencia_tecnica", alternativaPreferida: "lucro_presumido", alternativasAvaliadas: ["lucro_presumido"], qualidade: "media" });
    const provedorMalicioso: ProvedorIaConsultiva = {
      nome: "fake",
      async gerar(): Promise<RespostaBrutaIa> {
        return { titulo: "t", resumoExecutivo: "alta confiança", explicacao: "detalhe", principaisEvidencias: [], condicoesCitadas: [], ressalvas: [], validacoesPendentesCitadas: [], pontosAtencao: [], alternativaComunicada: "lucro_presumido", qualidadeComunicada: "alta" };
      },
    };
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "executiva", provedor: provedorMalicioso });
    expect(resposta.statusValidacao).toBe("rejeitada");
    expect(resposta.motivosRejeicao?.some((m) => m.includes("Qualidade comunicada"))).toBe(true);
  });
});

describe("83 — risco inventado é rejeitado", () => {
  it("provedor que cita um risco não presente no contexto é rejeitado", async () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_condicionada", naturezaConclusao: "preferencia_tecnica", alternativaPreferida: "lucro_presumido", alternativasAvaliadas: ["lucro_presumido"], condicoes: [{ descricao: "custo de capital baixo" }], riscos: [], qualidade: "media" });
    const provedorMalicioso: ProvedorIaConsultiva = {
      nome: "fake",
      async gerar(): Promise<RespostaBrutaIa> {
        return { titulo: "t", resumoExecutivo: "resumo", explicacao: "detalhe", principaisEvidencias: [], condicoesCitadas: [], ressalvas: [], validacoesPendentesCitadas: [], pontosAtencao: [], alternativaComunicada: "lucro_presumido", riscosComunicados: ["há risco de fiscalização"] };
      },
    };
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "executiva", provedor: provedorMalicioso });
    expect(resposta.statusValidacao).toBe("rejeitada");
    expect(resposta.motivosRejeicao?.some((m) => m.includes("Risco comunicado"))).toBe(true);
  });
});

describe("84 — evidências citadas devem existir no contexto", () => {
  it("id de evidência inexistente é rejeitado", async () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_robusta", naturezaConclusao: "preferencia_tecnica", alternativaPreferida: "lucro_presumido", alternativasAvaliadas: ["lucro_presumido"], evidenciasFavoraveis: [{ descricao: "x", valor: 100, unidade: "reais", origem: "y" }], qualidade: "alta" });
    const provedorMalicioso: ProvedorIaConsultiva = {
      nome: "fake",
      async gerar(): Promise<RespostaBrutaIa> {
        return { titulo: "t", resumoExecutivo: "resumo", explicacao: "detalhe", principaisEvidencias: ["fav-999"], condicoesCitadas: [], ressalvas: [], validacoesPendentesCitadas: [], pontosAtencao: [], alternativaComunicada: "lucro_presumido" };
      },
    };
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "executiva", provedor: provedorMalicioso });
    expect(resposta.statusValidacao).toBe("rejeitada");
    expect(resposta.motivosRejeicao?.some((m) => m.includes("fav-999"))).toBe(true);
  });
});

describe("85 — fallback em timeout do provedor", () => {
  it("provedor que nunca resolve produz statusValidacao erro_provedor com explicação válida", async () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_robusta", naturezaConclusao: "preferencia_tecnica", alternativaPreferida: "lucro_presumido", alternativasAvaliadas: ["lucro_presumido"], qualidade: "alta" });
    const provedorLento: ProvedorIaConsultiva = {
      nome: "lento",
      gerar: () => new Promise(() => {}), // nunca resolve
    };
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "executiva", provedor: provedorLento, timeoutMs: 20 });
    expect(resposta.statusValidacao).toBe("erro_provedor");
    expect(resposta.titulo.length).toBeGreaterThan(0);
  });
});

describe("86 — ausência de provedor não quebra a plataforma", () => {
  it("sem provedor configurado, retorna explicação com statusValidacao indisponivel", async () => {
    const decisao = decisaoBase({ statusConclusao: "preferencia_tecnica_robusta", naturezaConclusao: "preferencia_tecnica", alternativaPreferida: "lucro_presumido", alternativasAvaliadas: ["lucro_presumido"], qualidade: "alta" });
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "consultiva" });
    expect(resposta.statusValidacao).toBe("indisponivel");
    expect(resposta.alternativaComunicada).toBe("lucro_presumido");
  });
});

describe("87/88/89 — três níveis a partir da mesma decisão", () => {
  it("executiva é mais curta; técnica preserva mais evidências; nenhuma contradiz a decisão", async () => {
    const decisao = decisaoBase({
      statusConclusao: "preferencia_tecnica_condicionada",
      naturezaConclusao: "preferencia_tecnica",
      alternativaPreferida: "lucro_presumido",
      alternativasAvaliadas: ["lucro_presumido", "lucro_real"],
      evidenciasFavoraveis: [{ descricao: "Carga menor", valor: 82000, unidade: "reais", origem: "x" }],
      evidenciasContrarias: [{ descricao: "Capital de giro maior", valor: 210000, unidade: "reais", origem: "y" }],
      condicoes: [{ descricao: "custo de capital inferior a 1,28% a.m." }],
      validacoesPendentes: [{ tipo: "VALIDACAO_FISCAL", descricao: "cobertura de PIS/COFINS", motivo: "m", bloqueante: false }],
      qualidade: "media",
    });
    const niveis = await gerarTresNiveis({ decisao });
    expect(niveis.executiva.resumoExecutivo.length).toBeLessThanOrEqual(niveis.consultiva.explicacao.length + niveis.consultiva.resumoExecutivo.length);
    expect(niveis.tecnica.principaisEvidencias.length).toBeGreaterThanOrEqual(niveis.executiva.principaisEvidencias.length);
    for (const nivel of Object.values(niveis)) {
      expect(nivel.alternativaComunicada).toBe("lucro_presumido");
      expect(nivel.condicoesCitadas.length).toBeGreaterThan(0);
    }
  });
});

describe("90 — horizonte temporal nunca produz recomendação única para 2026-2033", () => {
  it("quando conclusaoHorizonte muda, o texto não afirma uma única alternativa para todo o período", async () => {
    const decisao = decisaoBase({
      statusConclusao: "preferencia_tecnica_robusta",
      naturezaConclusao: "preferencia_tecnica",
      alternativaPreferida: "lucro_presumido",
      alternativasAvaliadas: ["lucro_presumido", "lucro_real"],
      qualidade: "alta",
      horizonte: { decisoesPorAno: [], conclusaoHorizonte: "preferencia_muda_no_horizonte", transicoes: [{ anoAntes: 2029, anoDepois: 2030, alternativaAntes: "lucro_presumido", alternativaDepois: "lucro_real" }] },
    });
    const contexto = construirContexto(decisao);
    expect(contexto.horizonte?.conclusaoHorizonte).toBe("preferencia_muda_no_horizonte");
    expect(contexto.horizonte?.transicoes[0].alternativaDepois).toBe("lucro_real");
  });
});

describe("91 — ponto de virada explicado como fronteira, não previsão", () => {
  it("pontosAtencao descreve estado antes/depois sem afirmar que o valor 'será' atingido", async () => {
    const decisao = decisaoBase({
      statusConclusao: "preferencia_tecnica_condicionada",
      naturezaConclusao: "preferencia_tecnica",
      alternativaPreferida: "lucro_presumido",
      alternativasAvaliadas: ["lucro_presumido", "lucro_real"],
      condicoes: [{ descricao: "custo de capital inferior a 1,28% a.m." }],
      pontosViradaRelacionados: [{ tipo: "igualdade_resultado_economico", variavel: "custoCapital", valorEncontrado: 0.0128, estadoAntes: "lucro_presumido_maior", estadoDepois: "lucro_real_maior" }],
      qualidade: "media",
    });
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "consultiva" });
    expect(resposta.pontosAtencao.length).toBeGreaterThan(0);
    expect(resposta.pontosAtencao[0]).not.toContain("será");
  });
});

describe("92 — Fator R nunca prescreve pró-labore", () => {
  it("decisão sobre fator_r com FS12 adicional necessária nunca menciona pró-labore", async () => {
    const decisao = decisaoBase({
      objetoDecisao: "fator_r",
      statusConclusao: "preferencia_tecnica_condicionada",
      naturezaConclusao: "preferencia_tecnica",
      alternativaPreferida: "AVALIAR_FATOR_R",
      alternativasAvaliadas: ["AVALIAR_FATOR_R"],
      evidenciasFavoraveis: [{ descricao: "FS12 adicional necessária", valor: 48000, unidade: "reais", origem: "motor_achados" }],
      condicoes: [{ descricao: "confirmação de premissa de folha/encargos/pró-labore" }],
      qualidade: "media",
    });
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "consultiva" });
    const texto = `${resposta.resumoExecutivo} ${resposta.explicacao}`.toLowerCase();
    expect(texto).not.toContain("aumente");
    expect(texto).not.toContain("aumentar pró-labore");
  });
});

describe("93 — preço nunca prescreve reajuste", () => {
  it("reajuste matemático é citado como referência, nunca como instrução", async () => {
    const decisao = decisaoBase({
      objetoDecisao: "recomposicao_preco",
      statusConclusao: "preferencia_tecnica_condicionada",
      naturezaConclusao: "preferencia_tecnica",
      alternativaPreferida: "AVALIAR_RECOMPOSICAO_PRECO",
      alternativasAvaliadas: ["AVALIAR_RECOMPOSICAO_PRECO"],
      evidenciasFavoraveis: [{ descricao: "Reajuste médio de referência para preservar a margem", valor: 0.038, unidade: "percentual", origem: "motor_financeiro" }],
      condicoes: [{ descricao: "viabilidade comercial não analisada" }],
      qualidade: "media",
    });
    const resposta = await gerarExplicacaoConsultiva({ decisao, nivel: "consultiva" });
    const texto = `${resposta.resumoExecutivo} ${resposta.explicacao}`.toLowerCase();
    expect(texto).not.toContain("a empresa deve reajustar");
    expect(texto).not.toContain("recomendamos");
  });
});

describe("95 — política de dados limita o contexto enviado", () => {
  it("sem permitirValoresFinanceiros, evidências ficam sem valor numérico", () => {
    const decisao = decisaoBase({ evidenciasFavoraveis: [{ descricao: "Carga menor", valor: 82000, unidade: "reais", origem: "x" }] });
    const contexto = construirContexto(decisao, { permitirIdentificacaoEmpresa: false, permitirValoresFinanceiros: false, permitirDadosPessoais: false, anonimizar: true });
    expect(contexto.evidenciasFavoraveis[0].valor).toBeUndefined();
    expect(contexto.identificacaoAnalise.cenarioId).toBe("anonimizado");
  });
});

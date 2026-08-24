/**
 * Regras de ativação (seção 49) — cada função lê um pedaço do contexto
 * já calculado (achados, alternativas, decisão) e devolve 0..N
 * `AcaoEstruturada` SEM ids/dependências finais (resolvidas em
 * `motor.ts` após deduplicação). Nenhuma regra recalcula nada.
 */

import type { RelatorioAuditoriaEstrategica } from "../motorAchados/tipos";
import type { PlanoAlternativasEstrategicas, AlternativaEstrategica } from "../motorEstrategico/tipos";
import type { ResultadoDecisaoEstrategica } from "../motorDecisao/tipos";
import type { ResultadoPontoVirada } from "../motorPontosVirada/tipos";
import { CATALOGO_ACOES } from "./catalogo";
import type { AcaoEstruturada, CodigoAcao, GatilhoMonitoramento } from "./tipos";

export type AcaoRascunho = Omit<AcaoEstruturada, "id" | "dependeDe" | "status"> & { dependeDeCodigo?: CodigoAcao[] };

function criarAcao(codigo: CodigoAcao, params: Partial<AcaoRascunho> & { origens: string[]; qualidade: AcaoEstruturada["qualidade"] }): AcaoRascunho {
  const meta = CATALOGO_ACOES[codigo];
  return {
    codigo,
    categoria: meta.categoria,
    tipo: meta.tipo,
    titulo: meta.titulo,
    responsabilidadeSugerida: meta.responsabilidadeSugerida,
    descricaoTecnica: params.descricaoTecnica ?? meta.titulo,
    achadosOrigem: params.achadosOrigem ?? [],
    alternativasOrigem: params.alternativasOrigem ?? [],
    decisoesOrigem: params.decisoesOrigem ?? [],
    objetivo: params.objetivo ?? meta.titulo,
    bloqueios: params.bloqueios ?? [],
    riscos: params.riscos ?? [],
    condicoes: params.condicoes ?? [],
    validacoesNecessarias: params.validacoesNecessarias ?? [],
    evidencias: params.evidencias ?? [],
    periodoAplicavel: params.periodoAplicavel,
    resultadoEsperado: params.resultadoEsperado ?? meta.titulo,
    criterioConclusao: params.criterioConclusao ?? "Definido conforme a validação/simulação correspondente.",
    premissas: params.premissas ?? {},
    gatilho: params.gatilho,
    origens: params.origens,
    qualidade: params.qualidade,
    dependeDeCodigo: params.dependeDeCodigo,
  };
}

/** Família fiscal (seção 10/11) — lê achados de qualidade de dados já produzidos pelo Motor de Achados, nunca recalcula cobertura. */
export function regraValidacoesFiscais(relatorio?: RelatorioAuditoriaEstrategica): AcaoRascunho[] {
  if (!relatorio) return [];
  const acoes: AcaoRascunho[] = [];

  const baseReal = relatorio.achados.filter((a) => a.codigo === "BASE_LUCRO_REAL_PARCIAL");
  if (baseReal.length > 0) {
    acoes.push(
      criarAcao("VALIDAR_BASE_LUCRO_REAL", {
        objetivo: "Confirmar a base de apuração do Lucro Real (ajustes fiscais, saldos de prejuízo) antes de qualquer conclusão que dependa dela.",
        criterioConclusao: "Base do Lucro Real classificada como completa, ou ajustes pendentes formalmente registrados.",
        achadosOrigem: baseReal.map((a) => a.id),
        origens: ["motor_achados:BASE_LUCRO_REAL_PARCIAL"],
        qualidade: baseReal[0].qualidade,
        bloqueios: [{ tipo: "dados_insuficientes", descricao: baseReal[0].descricaoTecnica }],
      })
    );
  }

  const componenteAusente = relatorio.achados.filter((a) => a.codigo === "COMPONENTE_MATERIAL_AUSENTE");
  const pisCofinsAusente = componenteAusente.filter((a) => /pis|cofins/i.test(a.descricaoTecnica));
  if (pisCofinsAusente.length > 0) {
    acoes.push(
      criarAcao("VALIDAR_PIS_COFINS", {
        objetivo: "Completar a cobertura de PIS/COFINS ainda ausente na apuração comparada entre regimes.",
        criterioConclusao: "PIS/COFINS calculado, ou classificado como não aplicável, para o período analisado.",
        achadosOrigem: pisCofinsAusente.map((a) => a.id),
        origens: ["motor_achados:COMPONENTE_MATERIAL_AUSENTE"],
        qualidade: pisCofinsAusente[0].qualidade,
      })
    );
  }

  const demaisAusentes = componenteAusente.filter((a) => !pisCofinsAusente.includes(a));
  const naoComparaveis = relatorio.achados.filter((a) => a.codigo === "REGIMES_NAO_COMPARAVEIS");
  if (demaisAusentes.length > 0 || naoComparaveis.length > 0) {
    const origem = [...demaisAusentes, ...naoComparaveis];
    acoes.push(
      criarAcao("VALIDAR_COBERTURA_TRIBUTARIA", {
        objetivo: "Confirmar a cobertura de componentes tributários ainda ausentes entre os regimes comparados.",
        criterioConclusao: "Todos os componentes materiais calculados ou explicitamente classificados como não aplicáveis.",
        achadosOrigem: origem.map((a) => a.id),
        origens: ["motor_achados:REGIMES_NAO_COMPARAVEIS|COMPONENTE_MATERIAL_AUSENTE"],
        qualidade: origem[0].qualidade,
      })
    );
  }

  return acoes;
}

function alternativaPorCodigo(plano: PlanoAlternativasEstrategicas | undefined, codigo: AlternativaEstrategica["codigo"]): AlternativaEstrategica | undefined {
  return plano?.alternativas.find((a) => a.codigo === codigo);
}

/** Fator R (seção 12/13) — nunca converte FS12 em pró-labore. */
export function regraFatorR(plano?: PlanoAlternativasEstrategicas): AcaoRascunho[] {
  const alt = alternativaPorCodigo(plano, "AVALIAR_FATOR_R");
  if (!alt) return [];

  const validar = criarAcao("VALIDAR_COMPOSICAO_FS12", {
    objetivo: "Confirmar os componentes efetivamente elegíveis para a composição da FS12 (folha, encargos, pró-labore) — sem prescrever qual composição adotar.",
    criterioConclusao: "FS12 do período confirmada com os componentes efetivamente elegíveis (folha, encargos, pró-labore) documentados.",
    achadosOrigem: alt.achadosOrigem,
    alternativasOrigem: [alt.id],
    origens: [`motor_estrategico:${alt.codigo}`],
    qualidade: alt.qualidade,
    evidencias: alt.impactosConhecidos.map((i) => ({ descricao: i.descricao, valor: i.valor, unidade: i.unidade, origem: "motor_estrategico" })),
    validacoesNecessarias: alt.validacoesNecessarias,
    condicoes: alt.condicoes,
  });

  const simular = criarAcao("SIMULAR_FATOR_R_COM_DADOS_VALIDOS", {
    objetivo: "Reexecutar o Motor de Regimes com a FS12 validada, sem alterar nenhuma fórmula.",
    criterioConclusao: "Cenário reexecutado com a FS12 validada.",
    alternativasOrigem: [alt.id],
    origens: [`motor_estrategico:${alt.codigo}`],
    qualidade: alt.qualidade,
    dependeDeCodigo: ["VALIDAR_COMPOSICAO_FS12"],
  });

  return [validar, simular];
}

/** Recomposição de preço (seção 14/15) — referência matemática nunca é ordem. */
export function regraPreco(plano?: PlanoAlternativasEstrategicas): AcaoRascunho[] {
  const alt = alternativaPorCodigo(plano, "AVALIAR_RECOMPOSICAO_PRECO");
  if (!alt) return [];

  const reajuste = alt.premissas.reajusteMedioNecessario;
  const validar = criarAcao("VALIDAR_VIABILIDADE_COMERCIAL_REAJUSTE", {
    objetivo: "Avaliar a viabilidade comercial de um eventual reajuste — o Motor Financeiro só valida viabilidade matemática.",
    criterioConclusao: "Viabilidade comercial do reajuste avaliada pela área responsável (aceitação, elasticidade, concorrência).",
    achadosOrigem: alt.achadosOrigem,
    alternativasOrigem: [alt.id],
    origens: [`motor_estrategico:${alt.codigo}`],
    qualidade: alt.qualidade,
    evidencias: typeof reajuste === "number" ? [{ descricao: "Reajuste médio de referência para preservação de margem (fórmula fechada do Motor Financeiro)", valor: reajuste, unidade: "percentual", origem: "motor_financeiro" }] : [],
    riscos: alt.riscos,
  });

  const simular = criarAcao("SIMULAR_REPASSE_FINAL", {
    objetivo: "Reexecutar os cenários de repasse já disponíveis (0%/50%/100%) com a viabilidade comercial confirmada.",
    criterioConclusao: "Cenário de repasse final reexecutado com a viabilidade comercial confirmada.",
    alternativasOrigem: [alt.id],
    origens: [`motor_estrategico:${alt.codigo}`],
    qualidade: alt.qualidade,
    dependeDeCodigo: ["VALIDAR_VIABILIDADE_COMERCIAL_REAJUSTE"],
  });

  return [validar, simular];
}

/** Estrutura de créditos (seção 16/17) — crédito potencial nunca entra em decisão sem validação. */
export function regraCreditos(plano?: PlanoAlternativasEstrategicas): AcaoRascunho[] {
  const alt = alternativaPorCodigo(plano, "AVALIAR_ESTRUTURA_CREDITOS");
  if (!alt) return [];

  const acoes: AcaoRascunho[] = [];
  const indeterminado = alt.bloqueios.some((b) => b.tipo === "premissa_nao_confirmada");

  if (indeterminado) {
    acoes.push(
      criarAcao("VALIDAR_CLASSIFICACAO_CREDITOS", {
        objetivo: "Classificar o tratamento de crédito IBS/CBS das categorias de custo ainda indeterminadas.",
        criterioConclusao: "Todas as categorias de custo classificadas quanto ao tratamento de crédito.",
        achadosOrigem: alt.achadosOrigem,
        alternativasOrigem: [alt.id],
        origens: [`motor_estrategico:${alt.codigo}`],
        qualidade: alt.qualidade,
        bloqueios: alt.bloqueios,
      })
    );
    acoes.push(
      criarAcao("REVISAR_ITENS_INDETERMINADOS", {
        objetivo: "Revisar individualmente os itens de custo/despesa com tratamento de crédito ainda não classificado.",
        criterioConclusao: "Itens indeterminados revisados e reclassificados ou mantidos como indeterminados de forma justificada.",
        alternativasOrigem: [alt.id],
        origens: [`motor_estrategico:${alt.codigo}`],
        qualidade: alt.qualidade,
      })
    );
  }

  acoes.push(
    criarAcao("SIMULAR_CREDITOS_CONFIRMADOS", {
      objetivo: "Reexecutar o cenário com os créditos já confirmados/classificados.",
      criterioConclusao: "Cenário reexecutado com os créditos confirmados.",
      alternativasOrigem: [alt.id],
      origens: [`motor_estrategico:${alt.codigo}`],
      qualidade: alt.qualidade,
      dependeDeCodigo: indeterminado ? ["VALIDAR_CLASSIFICACAO_CREDITOS"] : [],
    })
  );

  return acoes;
}

/** Capital de giro (seção 25/26) — nunca recomenda banco/linha de crédito. */
export function regraCapitalGiro(plano?: PlanoAlternativasEstrategicas): AcaoRascunho[] {
  const alt = alternativaPorCodigo(plano, "AVALIAR_CAPITAL_GIRO");
  if (!alt) return [];

  const validar = criarAcao("VALIDAR_PREMISSAS_FLUXO", {
    objetivo: "Confirmar as premissas de split payment (percentual sujeito, percentual segregado, prazos) usadas na estimativa de capital de giro adicional.",
    criterioConclusao: "Premissas de split payment confirmadas ou mantidas como estimativa com proveniência explícita.",
    achadosOrigem: alt.achadosOrigem,
    alternativasOrigem: [alt.id],
    origens: [`motor_estrategico:${alt.codigo}`],
    qualidade: alt.qualidade,
    riscos: alt.riscos,
  });

  const simular = criarAcao("SIMULAR_PICO_CAPITAL_GIRO", {
    objetivo: "Reexecutar o cenário com as premissas de fluxo confirmadas.",
    criterioConclusao: "Pico de capital de giro adicional reexecutado com as premissas confirmadas.",
    alternativasOrigem: [alt.id],
    origens: [`motor_estrategico:${alt.codigo}`],
    qualidade: alt.qualidade,
    dependeDeCodigo: ["VALIDAR_PREMISSAS_FLUXO"],
  });

  const monitorar = criarAcao("MONITORAR_CAPITAL_GIRO", {
    objetivo: "Acompanhar a necessidade de capital de giro adicional ao longo do horizonte.",
    criterioConclusao: "Sem critério de conclusão — ação de monitoramento contínuo.",
    alternativasOrigem: [alt.id],
    origens: [`motor_estrategico:${alt.codigo}`],
    qualidade: alt.qualidade,
  });

  return [validar, simular, monitorar];
}

/** Custo financeiro (seção 27/28) — ponto de virada de custo de capital gera monitoramento estruturado, nunca previsão. */
export function regraCustoFinanceiro(plano?: PlanoAlternativasEstrategicas, pontosVirada: ResultadoPontoVirada[] = []): AcaoRascunho[] {
  const alt = alternativaPorCodigo(plano, "AVALIAR_CUSTO_FINANCEIRO");
  if (!alt) return [];

  const acoes: AcaoRascunho[] = [
    criarAcao("VALIDAR_CUSTO_CAPITAL", {
      objetivo: "Confirmar a taxa de custo de capital efetivamente praticada.",
      criterioConclusao: "Taxa mensal efetiva confirmada e registrada no cenário.",
      achadosOrigem: alt.achadosOrigem,
      alternativasOrigem: [alt.id],
      origens: [`motor_estrategico:${alt.codigo}`],
      qualidade: alt.qualidade,
    }),
  ];

  const pontoCustoCapital = pontosVirada.find((p) => p.variavel === "custoCapital" && p.status === "encontrado");
  if (pontoCustoCapital?.valorEncontrado !== undefined) {
    acoes.push(gatilhoDeVariavel("custoCapital", pontoCustoCapital.valorEncontrado, "percentual", [`motor_estrategico:${alt.codigo}`, "motor_pontos_virada"], alt.qualidade));
  }

  return acoes;
}

function gatilhoDeVariavel(variavel: string, valorReferencia: number, unidade: string, origens: string[], qualidade: AcaoEstruturada["qualidade"]): AcaoRascunho {
  const gatilho: GatilhoMonitoramento = { variavel, operador: "menor_que", valorReferencia, unidade, periodicidadeSugerida: "indefinida", origem: "motor_pontos_virada" };
  return criarAcao("ACOMPANHAR_PONTO_VIRADA", {
    objetivo: `Acompanhar a variável "${variavel}" em relação ao ponto de virada calculado.`,
    criterioConclusao: "Sem critério de conclusão — ação de monitoramento contínuo.",
    origens,
    qualidade,
    gatilho,
  });
}

/** Ponto de virada relacionado à decisão (seção 28/29/75) — sempre a partir de `ResultadoPontoVirada` já calculado, nunca recalculado. */
export function regraPontosVirada(decisao: ResultadoDecisaoEstrategica): AcaoRascunho[] {
  return decisao.pontosViradaRelacionados
    .filter((p) => p.valorEncontrado !== undefined)
    .map((p) => gatilhoDeVariavel(p.variavel, p.valorEncontrado!, p.variavel === "custoCapital" ? "percentual" : "reais", [`motor_decisao:${decisao.id}`], decisao.qualidade));
}

/** Horizonte temporal (seção 31) — mudança de preferência gera reavaliação futura estruturada, nunca uma recomendação única para 2026-2033. */
export function regraHorizonte(decisao: ResultadoDecisaoEstrategica): AcaoRascunho[] {
  if (!decisao.horizonte || decisao.horizonte.conclusaoHorizonte !== "preferencia_muda_no_horizonte") return [];
  return decisao.horizonte.transicoes.map((t) =>
    criarAcao("REAVALIAR_REGIME_NO_HORIZONTE", {
      objetivo: `Reavaliar a decisão de regime tributário a partir de ${t.anoDepois}, quando a preferência técnica identificada muda.`,
      criterioConclusao: `Decisão reavaliada com dados do ano ${t.anoDepois}.`,
      decisoesOrigem: [decisao.id],
      origens: [`motor_decisao:${decisao.id}`],
      qualidade: decisao.qualidade,
      periodoAplicavel: { ano: t.anoDepois },
      evidencias: [{ descricao: `Transição identificada entre ${t.alternativaAntes ?? "?"} (${t.anoAntes}) e ${t.alternativaDepois ?? "?"} (${t.anoDepois})`, origem: "motor_decisao" }],
    })
  );
}

/** Núcleo da decisão de regime (seção 18-24) — decide a sequência validação → simulação → formalização, ou ações de resolução de conflito/dados insuficientes, conforme `statusConclusao`/`naturezaConclusao`. Nunca gera formalização em conflito/dados insuficientes/bloqueado/equivalentes/sem_conclusao. */
export function regraConclusaoRegime(decisao: ResultadoDecisaoEstrategica, validacoesFiscaisGeradas: AcaoRascunho[]): AcaoRascunho[] {
  if (decisao.objetoDecisao !== "regime_tributario") return [];

  if (decisao.naturezaConclusao === "obrigacao_juridica") {
    const validar = criarAcao("VALIDAR_ENQUADRAMENTO_JURIDICO", {
      objetivo: `Confirmar o enquadramento jurídico que torna ${decisao.alternativaPreferida} obrigatório neste cenário.`,
      criterioConclusao: "Enquadramento jurídico confirmado por análise especializada.",
      decisoesOrigem: [decisao.id],
      origens: [`motor_decisao:${decisao.id}`],
      qualidade: decisao.qualidade,
    });
    const formalizar = criarAcao("FORMALIZAR_PLANEJAMENTO_NO_REGIME_OBRIGATORIO", {
      objetivo: `Formalizar o planejamento tributário no regime ${decisao.alternativaPreferida}, decorrente de obrigatoriedade jurídica — não de preferência entre alternativas.`,
      criterioConclusao: "Planejamento formalizado no regime obrigatório.",
      decisoesOrigem: [decisao.id],
      origens: [`motor_decisao:${decisao.id}`],
      qualidade: decisao.qualidade,
      dependeDeCodigo: ["VALIDAR_ENQUADRAMENTO_JURIDICO"],
    });
    return [validar, formalizar];
  }

  if (decisao.statusConclusao === "preferencia_tecnica_robusta" || decisao.statusConclusao === "preferencia_tecnica_condicionada") {
    const dependencias: CodigoAcao[] = [...new Set(validacoesFiscaisGeradas.map((a) => a.codigo))];
    const simular = criarAcao("SIMULAR_CENARIO_FINAL", {
      objetivo: "Reexecutar a análise consolidada com as premissas/validações confirmadas, sem alterar nenhuma fórmula dos motores.",
      criterioConclusao: "Cenário final reexecutado com as validações pendentes concluídas.",
      decisoesOrigem: [decisao.id],
      origens: [`motor_decisao:${decisao.id}`],
      qualidade: decisao.qualidade,
      condicoes: decisao.condicoes.map((c) => c.descricao),
      dependeDeCodigo: dependencias,
    });
    const formalizar = criarAcao("FORMALIZAR_DECISAO_TRIBUTARIA", {
      objetivo: `Formalizar a decisão tributária a favor de ${decisao.alternativaPreferida}, condicionada à manutenção da conclusão determinística após a reexecução.`,
      criterioConclusao: "Decisão formalizada, condicionada à conclusão determinística permanecer válida após a reexecução do cenário final.",
      decisoesOrigem: [decisao.id],
      origens: [`motor_decisao:${decisao.id}`],
      qualidade: decisao.qualidade,
      condicoes: decisao.condicoes.map((c) => c.descricao),
      dependeDeCodigo: ["SIMULAR_CENARIO_FINAL"],
    });
    return [simular, formalizar];
  }

  if (decisao.statusConclusao === "conflito_nao_resolvido") {
    const acoes: AcaoRascunho[] = [];
    const textoConflitos = decisao.conflitos.join(" ").toLowerCase();
    if (textoConflitos.includes("caixa") || textoConflitos.includes("capital de giro")) {
      acoes.push(criarAcao("VALIDAR_PREMISSAS_CAIXA", { objetivo: "Validar as premissas de caixa relacionadas ao conflito identificado entre carga tributária e capital de giro.", criterioConclusao: "Premissas de caixa confirmadas ou mantidas como estimativa explícita.", decisoesOrigem: [decisao.id], origens: [`motor_decisao:${decisao.id}`], qualidade: decisao.qualidade }));
    }
    if (textoConflitos.includes("custo") || textoConflitos.includes("financeiro")) {
      acoes.push(criarAcao("VALIDAR_CUSTO_CAPITAL", { objetivo: "Validar a taxa de custo de capital utilizada na comparação em conflito.", criterioConclusao: "Taxa mensal efetiva confirmada e registrada no cenário.", decisoesOrigem: [decisao.id], origens: [`motor_decisao:${decisao.id}`], qualidade: decisao.qualidade }));
    }
    acoes.push(criarAcao("EXECUTAR_CENARIO_ADICIONAL", { objetivo: "Executar um cenário adicional capaz de reduzir a incerteza que sustenta o conflito identificado.", criterioConclusao: "Cenário adicional executado e comparado com os candidatos em conflito.", decisoesOrigem: [decisao.id], origens: [`motor_decisao:${decisao.id}`], qualidade: decisao.qualidade }));
    return acoes;
  }

  if (decisao.statusConclusao === "alternativas_equivalentes") {
    return [
      criarAcao("VALIDAR_CRITERIOS_NAO_MENSURADOS", {
        objetivo: `Identificar dimensões ainda não mensuradas entre as alternativas equivalentes (${decisao.alternativasEquivalentes.join(", ")}).`,
        criterioConclusao: "Dimensões adicionais avaliadas ou explicitamente classificadas como não disponíveis.",
        decisoesOrigem: [decisao.id],
        origens: [`motor_decisao:${decisao.id}`],
        qualidade: decisao.qualidade,
      }),
    ];
  }

  return [];
}

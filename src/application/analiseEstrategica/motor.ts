/**
 * Orquestrador de APLICAÇÃO — chama módulos de domínio já existentes,
 * na sequência declarada abaixo (seção 9). NUNCA contém fórmula de
 * tributo/margem/capital de giro/score/decisão/Pareto (seção 5) — só
 * decide QUANDO chamar cada motor e como isolar falhas. Regimes/
 * Comparador são a única dependência ESSENCIAL (seção 15); todo o
 * resto é opcional e uma falha nunca derruba o restante (seção 11/14).
 */

import { ANOS_SIMULACAO } from "../../engine/parametros";
import { executarCenario } from "../../engine/motorCenarios/motor";
import { buscarPontoVirada } from "../../engine/motorPontosVirada/motor";
import { gerarRelatorioAuditoriaEstrategica } from "../../engine/motorAchados/motor";
import { gerarPlanoAlternativasEstrategicas } from "../../engine/motorEstrategico/motor";
import { decidirRegimeTributario } from "../../engine/motorDecisao/regime";
import { decidirRegimeTributarioNoHorizonte } from "../../engine/motorDecisao/temporal";
import { gerarPlanoAcao } from "../../engine/planoAcao/motor";
import { gerarScoresEstrategicos } from "../../engine/scoreEstrategico/motor";
import { otimizar } from "../../engine/otimizacaoMultidimensional/motor";
import type { CenarioEmpresa } from "../../engine/cenarioEmpresa";
import type { AnaliseEstrategicaCompleta, EstadoDimensao, OpcoesAnaliseEstrategica } from "./tipos";

function disponivel(): EstadoDimensao {
  return { status: "disponivel" };
}
function indisponivel(motivo: string): EstadoDimensao {
  return { status: "indisponivel", motivo };
}
function erro(motivo: string): EstadoDimensao {
  return { status: "erro", motivo };
}
function naoAplicavel(motivo: string): EstadoDimensao {
  return { status: "nao_aplicavel", motivo };
}

/**
 * Executa o pipeline estratégico completo para UM `CenarioEmpresa` —
 * NUNCA muta `cenario` (cada motor chamado já garante isso
 * internamente; este orquestrador não adiciona mutação nenhuma).
 * Síncrono, porque todos os motores de domínio são funções puras
 * síncronas — nenhuma infraestrutura de fila/job foi criada (seção 34).
 */
export function executarAnaliseEstrategica(cenario: CenarioEmpresa, opcoes: OpcoesAnaliseEstrategica): AnaliseEstrategicaCompleta {
  const inicio = new Date();
  const ano = opcoes.ano ?? ANOS_SIMULACAO[0];
  const etapasExecutadas: string[] = [];
  const etapasIndisponiveis: string[] = [];
  const erros: { etapa: string; mensagem: string }[] = [];

  // Etapas 1-4: Regimes + Comparador Consolidado + Econômico-Financeiro + Caixa/Split —
  // já orquestradas juntas por `executarCenario` (motorCenarios), reaproveitado aqui sem duplicação.
  const resultadoCenario = executarCenario(cenario, opcoes.motoresRegime, {}, { premissasFinanceiras: opcoes.premissasFinanceiras, premissasSplit: opcoes.premissasSplit });

  let statusRegimesComparador: EstadoDimensao;
  let statusFinanceiro: EstadoDimensao;
  let statusCaixa: EstadoDimensao;

  if (resultadoCenario.status === "erro_validacao") {
    // Dependência essencial falhou (seção 15) — nenhuma etapa subsequente pode produzir resultado confiável.
    statusRegimesComparador = erro(`Alterações inválidas ao executar o cenário base: ${resultadoCenario.errosValidacao.map((e) => e.motivo).join(" ")}`);
    statusFinanceiro = erro("Bloqueado pela falha essencial em Regimes/Comparador.");
    statusCaixa = erro("Bloqueado pela falha essencial em Regimes/Comparador.");
    erros.push({ etapa: "regimes_comparador", mensagem: statusRegimesComparador.motivo! });

    return {
      cenario,
      ano,
      resultadoCenario: undefined,
      statusRegimesComparador,
      statusFinanceiro,
      statusCaixa,
      statusPontosVirada: naoAplicavel("Não executado — dependência essencial indisponível."),
      statusAchados: naoAplicavel("Não executado — dependência essencial indisponível."),
      statusEstrategia: naoAplicavel("Não executado — dependência essencial indisponível."),
      statusDecisao: naoAplicavel("Não executado — dependência essencial indisponível."),
      statusHorizonte: naoAplicavel("Não executado — dependência essencial indisponível."),
      statusPlanoAcao: naoAplicavel("Não executado — dependência essencial indisponível."),
      statusScore: naoAplicavel("Não executado — dependência essencial indisponível."),
      statusOtimizacao: naoAplicavel("Não executado — dependência essencial indisponível."),
      auditoriaExecucao: finalizarAuditoria(inicio, etapasExecutadas, etapasIndisponiveis, erros),
    };
  }

  etapasExecutadas.push("regimes_comparador");
  statusRegimesComparador = disponivel();
  statusFinanceiro = resultadoCenario.resultadoFinanceiroPorRegime.length > 0 ? disponivel() : indisponivel("Nenhum resultado econômico-financeiro produzido para os regimes avaliados.");
  statusCaixa = resultadoCenario.resultadoCaixaPorRegime !== undefined ? disponivel() : indisponivel("Nenhuma premissa de split payment foi informada.");
  if (statusFinanceiro.status === "indisponivel") etapasIndisponiveis.push("financeiro");
  if (statusCaixa.status === "indisponivel") etapasIndisponiveis.push("caixa");

  // Etapa 6: Pontos de Virada — opcional (seção 10).
  let pontosVirada: AnaliseEstrategicaCompleta["pontosVirada"];
  let statusPontosVirada: EstadoDimensao;
  if (!opcoes.pontosVirada || opcoes.pontosVirada.length === 0) {
    statusPontosVirada = naoAplicavel("Nenhuma busca de ponto de virada foi configurada nesta análise.");
  } else {
    try {
      pontosVirada = opcoes.pontosVirada.map((def) => buscarPontoVirada({ ...def, cenarioBase: cenario, motoresRegime: opcoes.motoresRegime }));
      etapasExecutadas.push("pontos_virada");
      statusPontosVirada = disponivel();
    } catch (e) {
      statusPontosVirada = erro(String(e instanceof Error ? e.message : e));
      erros.push({ etapa: "pontos_virada", mensagem: statusPontosVirada.motivo! });
      etapasIndisponiveis.push("pontos_virada");
    }
  }

  // Etapa 7: Achados — depende só de resultadoCenario, sempre tentado quando a Etapa 1 teve sucesso.
  let relatorioAchados: AnaliseEstrategicaCompleta["relatorioAchados"];
  let statusAchados: EstadoDimensao;
  try {
    relatorioAchados = gerarRelatorioAuditoriaEstrategica({ ano, cenario, resultado: resultadoCenario, pontosVirada });
    etapasExecutadas.push("achados");
    statusAchados = disponivel();
  } catch (e) {
    statusAchados = erro(String(e instanceof Error ? e.message : e));
    erros.push({ etapa: "achados", mensagem: statusAchados.motivo! });
    etapasIndisponiveis.push("achados");
  }

  // Etapa 8: Motor Estratégico — depende de Achados.
  let planoEstrategico: AnaliseEstrategicaCompleta["planoEstrategico"];
  let statusEstrategia: EstadoDimensao;
  if (!relatorioAchados) {
    statusEstrategia = indisponivel("Achados indisponíveis.");
  } else {
    try {
      planoEstrategico = gerarPlanoAlternativasEstrategicas({ ano, cenario, relatorio: relatorioAchados, resultado: resultadoCenario, pontosVirada });
      etapasExecutadas.push("estrategia");
      statusEstrategia = disponivel();
    } catch (e) {
      statusEstrategia = erro(String(e instanceof Error ? e.message : e));
      erros.push({ etapa: "estrategia", mensagem: statusEstrategia.motivo! });
      etapasIndisponiveis.push("estrategia");
    }
  }

  // Etapa 9: Motor de Decisão — só a família de regime tributário nesta integração (prioridade já definida na fase do Motor de Decisão).
  let decisao: AnaliseEstrategicaCompleta["decisao"];
  let statusDecisao: EstadoDimensao;
  try {
    decisao = decidirRegimeTributario(resultadoCenario, { ano, pontosVirada });
    etapasExecutadas.push("decisao");
    statusDecisao = disponivel();
  } catch (e) {
    statusDecisao = erro(String(e instanceof Error ? e.message : e));
    erros.push({ etapa: "decisao", mensagem: statusDecisao.motivo! });
    etapasIndisponiveis.push("decisao");
  }

  // Etapa 9b: Horizonte da decisão (Timeline) — opcional, reaproveita `decidirRegimeTributarioNoHorizonte` já existente.
  let horizonteDecisao: AnaliseEstrategicaCompleta["horizonteDecisao"];
  let statusHorizonte: EstadoDimensao;
  if (!opcoes.incluirHorizonte) {
    statusHorizonte = naoAplicavel("Horizonte temporal não solicitado nesta análise.");
  } else {
    try {
      horizonteDecisao = decidirRegimeTributarioNoHorizonte(resultadoCenario, { pontosVirada });
      etapasExecutadas.push("horizonte_decisao");
      statusHorizonte = disponivel();
    } catch (e) {
      statusHorizonte = erro(String(e instanceof Error ? e.message : e));
      erros.push({ etapa: "horizonte_decisao", mensagem: statusHorizonte.motivo! });
      etapasIndisponiveis.push("horizonte_decisao");
    }
  }

  // Etapa 10: Plano de Ação — depende da Decisão (e usa Achados/Estratégia/Pontos de Virada quando disponíveis).
  let planoAcao: AnaliseEstrategicaCompleta["planoAcao"];
  let statusPlanoAcao: EstadoDimensao;
  if (!decisao) {
    statusPlanoAcao = indisponivel("Decisão indisponível.");
  } else {
    try {
      planoAcao = gerarPlanoAcao({ decisao, relatorio: relatorioAchados, planoEstrategico, pontosVirada });
      etapasExecutadas.push("plano_acao");
      statusPlanoAcao = disponivel();
    } catch (e) {
      statusPlanoAcao = erro(String(e instanceof Error ? e.message : e));
      erros.push({ etapa: "plano_acao", mensagem: statusPlanoAcao.motivo! });
      etapasIndisponiveis.push("plano_acao");
    }
  }

  // Etapa 11: Score — só depende de resultadoCenario (Etapa 1), independente de Decisão/Plano terem tido sucesso.
  let scores: AnaliseEstrategicaCompleta["scores"];
  let statusScore: EstadoDimensao;
  try {
    scores = gerarScoresEstrategicos({ resultado: resultadoCenario, ano, pontosVirada });
    etapasExecutadas.push("score");
    statusScore = scores.length > 0 ? disponivel() : indisponivel("Nenhum regime comparável para pontuar.");
  } catch (e) {
    statusScore = erro(String(e instanceof Error ? e.message : e));
    erros.push({ etapa: "score", mensagem: statusScore.motivo! });
    etapasIndisponiveis.push("score");
  }

  // Etapa 12: Otimização — só quando explicitamente configurada (seção 9/12); falha aqui é ISOLADA (seção 14/45), nunca derruba a decisão/score já produzidos.
  let otimizacao: AnaliseEstrategicaCompleta["otimizacao"];
  let statusOtimizacao: EstadoDimensao;
  if (!opcoes.otimizacao) {
    statusOtimizacao = naoAplicavel("Nenhum problema de otimização foi configurado nesta análise.");
  } else {
    try {
      otimizacao = otimizar({ ...opcoes.otimizacao, cenarioBase: cenario });
      etapasExecutadas.push("otimizacao");
      statusOtimizacao = disponivel();
    } catch (e) {
      statusOtimizacao = erro(String(e instanceof Error ? e.message : e));
      erros.push({ etapa: "otimizacao", mensagem: statusOtimizacao.motivo! });
      etapasIndisponiveis.push("otimizacao");
    }
  }

  return {
    cenario,
    ano,
    resultadoCenario,
    statusRegimesComparador,
    statusFinanceiro,
    statusCaixa,
    pontosVirada,
    statusPontosVirada,
    relatorioAchados,
    statusAchados,
    planoEstrategico,
    statusEstrategia,
    decisao,
    statusDecisao,
    horizonteDecisao,
    statusHorizonte,
    planoAcao,
    statusPlanoAcao,
    scores,
    statusScore,
    otimizacao,
    statusOtimizacao,
    auditoriaExecucao: finalizarAuditoria(inicio, etapasExecutadas, etapasIndisponiveis, erros),
  };
}

function finalizarAuditoria(inicio: Date, etapasExecutadas: string[], etapasIndisponiveis: string[], erros: { etapa: string; mensagem: string }[]) {
  const fim = new Date();
  return { inicio: inicio.toISOString(), fim: fim.toISOString(), duracaoMs: fim.getTime() - inicio.getTime(), etapasExecutadas, etapasIndisponiveis, erros };
}

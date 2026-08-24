/**
 * ViewModel do Modo Apresentação — seleciona referências dos
 * ViewModels JÁ EXISTENTES (`PaginaAnaliseEstrategicaViewModel`),
 * nunca recalcula nada (seção 1/2/11 do pedido). Capítulos são
 * dinâmicos: só existem quando há dado real (ou indisponibilidade
 * materialmente relevante) para mostrar — nunca um capítulo vazio
 * "porque a lista teria 10 itens" (seção 49-51).
 */

import type { PaginaAnaliseEstrategicaViewModel } from "./analiseEstrategica";
import type { IaConsultivaViewModel } from "./iaConsultiva";

export type CapituloApresentacao = "impacto" | "decisao" | "evidencias" | "regimes" | "caixa" | "timeline" | "pontosVirada" | "score" | "plano" | "pareto" | "ia" | "limitacoes";

export interface ItemCapitulo {
  id: CapituloApresentacao;
  titulo: string;
}

const TITULO_POR_CAPITULO: Record<CapituloApresentacao, string> = {
  impacto: "Impacto Estratégico",
  decisao: "Decisão",
  evidencias: "Por quê?",
  regimes: "Comparação de Regimes",
  caixa: "Impacto no Caixa",
  timeline: "Evolução 2026–2033",
  pontosVirada: "O que pode mudar esta conclusão?",
  score: "Score Estratégico",
  plano: "Próximas Providências",
  pareto: "Configurações Eficientes",
  ia: "Leitura Consultiva",
  limitacoes: "Premissas e pontos de atenção",
};

export interface ApresentacaoExecutivaViewModel {
  nomeEmpresa?: string;
  ano: number;
  capitulos: ItemCapitulo[];
  vm: PaginaAnaliseEstrategicaViewModel;
  ia?: IaConsultivaViewModel;
  limitacoesMateriais: string[];
}

function coletarLimitacoesMateriais(vm: PaginaAnaliseEstrategicaViewModel): string[] {
  const limitacoes: string[] = [];
  if (vm.decisao?.condicoes.length) for (const c of vm.decisao.condicoes) limitacoes.push(c.descricao);
  if (vm.decisao?.motivoIndisponibilidade) limitacoes.push(vm.decisao.motivoIndisponibilidade);
  if (vm.caixa.motivoIndisponibilidade) limitacoes.push(vm.caixa.motivoIndisponibilidade);
  if (vm.statusScoreMotivo) limitacoes.push(vm.statusScoreMotivo);
  if (vm.statusOtimizacaoMotivo) limitacoes.push(vm.statusOtimizacaoMotivo);
  return [...new Set(limitacoes)];
}

/**
 * `respostaIa` é OPCIONAL e nunca gerada aqui — só é incluída se já
 * tiver sido produzida antes (seção 3/40/75: a IA nunca é chamada
 * automaticamente ao entrar/navegar no Modo Apresentação).
 */
export function construirApresentacaoExecutivaViewModel(vm: PaginaAnaliseEstrategicaViewModel, respostaIa?: IaConsultivaViewModel): ApresentacaoExecutivaViewModel {
  const limitacoesMateriais = coletarLimitacoesMateriais(vm);

  const disponiveis: CapituloApresentacao[] = [];
  if (vm.resumo || vm.decisao) disponiveis.push("impacto");
  if (vm.decisao) disponiveis.push("decisao");
  if (vm.decisao && (vm.decisao.evidencias.length > 0 || vm.decisao.condicoes.length > 0)) disponiveis.push("evidencias");
  if (vm.comparacaoRegimes.length > 0) disponiveis.push("regimes");
  disponiveis.push("caixa"); // impacto de caixa é sempre material numa decisão tributária — indisponibilidade também é informação executiva relevante (seção 49).
  if (vm.timeline) disponiveis.push("timeline");
  if (vm.pontosVirada.length > 0) disponiveis.push("pontosVirada");
  if (vm.scores && vm.scores.length > 0) disponiveis.push("score");
  if (vm.planoAcao) disponiveis.push("plano");
  if (vm.pareto && vm.pareto.configuracoes.length > 0) disponiveis.push("pareto");
  if (respostaIa) disponiveis.push("ia");
  if (limitacoesMateriais.length > 0) disponiveis.push("limitacoes");

  return {
    nomeEmpresa: vm.nomeEmpresa,
    ano: vm.ano,
    capitulos: disponiveis.map((id) => ({ id, titulo: TITULO_POR_CAPITULO[id] })),
    vm,
    ia: respostaIa,
    limitacoesMateriais,
  };
}

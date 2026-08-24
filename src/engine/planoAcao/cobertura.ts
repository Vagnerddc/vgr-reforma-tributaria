/**
 * Cobertura do plano (seção 60/61/83) — "sem ações" precisa ser
 * distinguível de "não analisado". Nunca inferida pela ausência de
 * ação de uma categoria quando a dimensão de origem nunca foi
 * analisada.
 */

import type { PlanoAlternativasEstrategicas } from "../motorEstrategico/tipos";
import type { AcaoEstruturada, CoberturaPlanoAcao } from "./tipos";

export function avaliarCoberturaPlano(acoes: AcaoEstruturada[], planoEstrategico?: PlanoAlternativasEstrategicas): CoberturaPlanoAcao {
  const temAcao = (categoria: AcaoEstruturada["categoria"]) => acoes.some((a) => a.categoria === categoria);
  const coberturaEstrategica = planoEstrategico?.cobertura;

  return {
    fiscal: temAcao("fiscal") ? "analisado" : coberturaEstrategica?.fatorR === "indisponivel" ? "indisponivel" : "nao_aplicavel",
    preco: temAcao("preco") ? "analisado" : coberturaEstrategica?.preco === "indisponivel" ? "indisponivel" : "nao_aplicavel",
    creditos: temAcao("creditos") ? "analisado" : coberturaEstrategica?.creditos === "indisponivel" ? "indisponivel" : "nao_aplicavel",
    fatorR: temAcao("fator_r") ? "analisado" : coberturaEstrategica?.fatorR === "nao_aplicavel" ? "nao_aplicavel" : coberturaEstrategica?.fatorR === "indisponivel" ? "indisponivel" : "nao_aplicavel",
    caixa: temAcao("capital_giro") || temAcao("custo_financeiro") ? "analisado" : coberturaEstrategica?.capitalGiro === "indisponivel" ? "indisponivel" : "nao_aplicavel",
    regime: temAcao("regime") ? "analisado" : "nao_aplicavel",
    monitoramento: acoes.some((a) => a.tipo === "monitoramento") ? "analisado" : "nao_aplicavel",
  };
}

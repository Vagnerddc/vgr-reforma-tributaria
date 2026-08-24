/**
 * Motor de Decisão Estratégica Determinística — ponto de entrada único.
 * Despacha por `ObjetoDecisao` (seção 12) para os módulos
 * correspondentes — nenhum `if` fiscal disperso, catálogo simples por
 * objeto (seção 41/42, sem DSL).
 */

import type { ResultadoCenario } from "../motorCenarios/tipos";
import type { PlanoAlternativasEstrategicas } from "../motorEstrategico/tipos";
import { decidirRegimeTributario, type OpcoesDecisaoRegime } from "./regime";
import { decidirRegimeTributarioNoHorizonte } from "./temporal";
import { decidirRecomposicaoPreco, decidirFatorR } from "./precoFatorR";
import type { HorizonteDecisao, ResultadoDecisaoEstrategica } from "./tipos";

export interface OpcoesMotorDecisao {
  ano: number;
  resultado: ResultadoCenario;
  plano?: PlanoAlternativasEstrategicas;
  pontosVirada?: OpcoesDecisaoRegime["pontosVirada"];
  margemMaterialidadeProximidade?: number;
  incluirHorizonte?: boolean;
}

export interface ResultadoMotorDecisao {
  regimeTributario: ResultadoDecisaoEstrategica;
  recomposicaoPreco?: ResultadoDecisaoEstrategica;
  fatorR?: ResultadoDecisaoEstrategica;
  horizonteRegime?: HorizonteDecisao;
}

export function decidir(opcoes: OpcoesMotorDecisao): ResultadoMotorDecisao {
  const regimeTributario = decidirRegimeTributario(opcoes.resultado, { ano: opcoes.ano, pontosVirada: opcoes.pontosVirada, margemMaterialidadeProximidade: opcoes.margemMaterialidadeProximidade });

  const resultadoDecisao: ResultadoMotorDecisao = { regimeTributario };

  if (opcoes.plano) {
    resultadoDecisao.recomposicaoPreco = decidirRecomposicaoPreco(opcoes.plano, opcoes.ano);
    resultadoDecisao.fatorR = decidirFatorR(opcoes.plano, opcoes.ano);
  }

  if (opcoes.incluirHorizonte) {
    resultadoDecisao.horizonteRegime = decidirRegimeTributarioNoHorizonte(opcoes.resultado, { pontosVirada: opcoes.pontosVirada, margemMaterialidadeProximidade: opcoes.margemMaterialidadeProximidade });
  }

  return resultadoDecisao;
}

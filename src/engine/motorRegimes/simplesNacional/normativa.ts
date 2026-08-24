/**
 * Fundação normativa do Simples Nacional — LC 123/2006, com redação da
 * LC 155/2016 (tabelas vigentes desde 2018). Núcleo geral: Anexos I
 * (comércio), II (indústria), III (serviços/locação sem Fator R, ou
 * Fator R ≥ 28%) e V (serviços com Fator R < 28% — ver
 * simplesNacional/fatorR/). Anexo IV não é tabelado nesta fase: exige
 * tratamento de CPP fora do DAS, não modelado — nenhuma tabela morta.
 *
 * Tabelas I/II/III/V confirmadas por busca externa nesta e na fase
 * anterior (não assumidas de memória) — ver docs/motor-fator-r.md, seção L.
 */

import type { RegraNormativa } from "../lucroPresumido/normativa";

/** Limite de RBT12 para permanência no Simples — acima disso, exclusão do regime. */
export const LIMITE_RBT12_SIMPLES: RegraNormativa<number> = {
  valor: 4_800_000,
  fundamento: "LC 123/2006, art. 3º, II, com redação da LC 155/2016",
  vigenciaInicio: "2018-01-01",
};

/** Limite do Fator R — igual ou acima: Anexo III; abaixo: Anexo V (LC 123/2006, art. 18, §5º-M). */
export const LIMITE_FATOR_R: RegraNormativa<number> = {
  valor: 0.28,
  fundamento: "LC 123/2006, art. 18, §5º-M, com redação da LC 155/2016",
  vigenciaInicio: "2018-01-01",
};

export interface FaixaSimples {
  indice: number;
  limiteInferior: number;
  limiteSuperior: number;
  aliquotaNominal: number;
  parcelaDeduzir: number;
}

/** As 6 faixas de RBT12 são as MESMAS para todos os anexos — só aliquotaNominal/parcelaDeduzir mudam por anexo. */
const LIMITES_FAIXA: { indice: number; limiteInferior: number; limiteSuperior: number }[] = [
  { indice: 1, limiteInferior: 0, limiteSuperior: 180_000 },
  { indice: 2, limiteInferior: 180_000, limiteSuperior: 360_000 },
  { indice: 3, limiteInferior: 360_000, limiteSuperior: 720_000 },
  { indice: 4, limiteInferior: 720_000, limiteSuperior: 1_800_000 },
  { indice: 5, limiteInferior: 1_800_000, limiteSuperior: 3_600_000 },
  { indice: 6, limiteInferior: 3_600_000, limiteSuperior: 4_800_000 },
];

function montarTabela(aliquotasEParcelas: { aliquotaNominal: number; parcelaDeduzir: number }[]): FaixaSimples[] {
  return LIMITES_FAIXA.map((limite, i) => ({ ...limite, ...aliquotasEParcelas[i] }));
}

export type AnexoSimplesNucleo = "anexo_i" | "anexo_ii" | "anexo_iii" | "anexo_v";

export const FUNDAMENTO_TABELAS: RegraNormativa<string> = {
  valor: "LC 123/2006, Anexos I, II, III e V, com redação da LC 155/2016",
  fundamento: "LC 123/2006, Anexos I/II/III/V",
  vigenciaInicio: "2018-01-01",
};

export const TABELAS_SIMPLES: Record<AnexoSimplesNucleo, FaixaSimples[]> = {
  anexo_i: montarTabela([
    { aliquotaNominal: 0.04, parcelaDeduzir: 0 },
    { aliquotaNominal: 0.073, parcelaDeduzir: 5_940 },
    { aliquotaNominal: 0.095, parcelaDeduzir: 13_860 },
    { aliquotaNominal: 0.107, parcelaDeduzir: 22_500 },
    { aliquotaNominal: 0.143, parcelaDeduzir: 87_300 },
    { aliquotaNominal: 0.19, parcelaDeduzir: 378_000 },
  ]),
  anexo_ii: montarTabela([
    { aliquotaNominal: 0.045, parcelaDeduzir: 0 },
    { aliquotaNominal: 0.078, parcelaDeduzir: 5_940 },
    { aliquotaNominal: 0.10, parcelaDeduzir: 13_860 },
    { aliquotaNominal: 0.112, parcelaDeduzir: 22_500 },
    { aliquotaNominal: 0.147, parcelaDeduzir: 85_500 },
    { aliquotaNominal: 0.30, parcelaDeduzir: 720_000 },
  ]),
  anexo_iii: montarTabela([
    { aliquotaNominal: 0.06, parcelaDeduzir: 0 },
    { aliquotaNominal: 0.112, parcelaDeduzir: 9_360 },
    { aliquotaNominal: 0.135, parcelaDeduzir: 17_640 },
    { aliquotaNominal: 0.16, parcelaDeduzir: 35_640 },
    { aliquotaNominal: 0.21, parcelaDeduzir: 125_640 },
    { aliquotaNominal: 0.33, parcelaDeduzir: 648_000 },
  ]),
  anexo_v: montarTabela([
    { aliquotaNominal: 0.155, parcelaDeduzir: 0 },
    { aliquotaNominal: 0.18, parcelaDeduzir: 4_500 },
    { aliquotaNominal: 0.195, parcelaDeduzir: 9_900 },
    { aliquotaNominal: 0.205, parcelaDeduzir: 17_100 },
    { aliquotaNominal: 0.23, parcelaDeduzir: 62_100 },
    { aliquotaNominal: 0.305, parcelaDeduzir: 540_000 },
  ]),
};

/** Determina o índice de faixa (1-6) a partir da RBT12 — mesma banda para todos os anexos. Nunca chamado com RBT12 acima do limite (elegibilidade já teria excluído). */
export function determinarIndiceFaixa(rbt12: number): number {
  for (const faixa of LIMITES_FAIXA) {
    if (rbt12 <= faixa.limiteSuperior) return faixa.indice;
  }
  return LIMITES_FAIXA[LIMITES_FAIXA.length - 1].indice;
}

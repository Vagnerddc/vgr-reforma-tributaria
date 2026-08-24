/**
 * Fundação normativa do Lucro Presumido — percentuais/alíquotas/limites
 * centralizados aqui, nunca espalhados como números mágicos dentro do
 * cálculo (seção 20 do pedido). Cada valor carrega fundamento e vigência,
 * porque o motor precisa responder "essa regra era válida para qual
 * período" mesmo operando de 2026 a 2033 (seção 21) — a legislação do
 * Lucro Presumido em si (Lei 9.249/1995, Lei 9.430/1996, Lei 9.718/1998)
 * não é alterada pela Reforma Tributária, mas a estrutura já nasce
 * pronta para registrar uma mudança futura sem precisar reescrever o
 * motor.
 */

export interface RegraNormativa<T> {
  valor: T;
  fundamento: string;
  vigenciaInicio: string;
  vigenciaFim?: string;
}

/** IRPJ: 15% sobre a base de cálculo presumida. */
export const ALIQUOTA_IRPJ: RegraNormativa<number> = {
  valor: 0.15,
  fundamento: "Lei 9.249/1995, art. 3º",
  vigenciaInicio: "1996-01-01",
};

/** Adicional de IRPJ: 10% sobre a parcela da base presumida TRIMESTRAL que exceder R$ 60.000,00 (R$ 20.000,00/mês × 3). */
export const ALIQUOTA_ADICIONAL_IRPJ: RegraNormativa<number> = {
  valor: 0.10,
  fundamento: "Lei 9.430/1996, art. 3º",
  vigenciaInicio: "1997-01-01",
};

export const LIMITE_ADICIONAL_IRPJ_TRIMESTRAL: RegraNormativa<number> = {
  valor: 60_000,
  fundamento: "Lei 9.430/1996, art. 3º, parágrafo único",
  vigenciaInicio: "1997-01-01",
};

/** CSLL: 9% sobre a base de cálculo presumida (regra geral — instituições financeiras têm alíquota diferente, não modelada nesta fase). */
export const ALIQUOTA_CSLL: RegraNormativa<number> = {
  valor: 0.09,
  fundamento: "Lei 7.689/1988, art. 3º, com alterações da Lei 13.169/2015",
  vigenciaInicio: "2015-01-01",
};

/** Limite de receita bruta anual para permanência no Lucro Presumido — acima disso, obrigatoriedade do Lucro Real. */
export const LIMITE_RECEITA_BRUTA_ANUAL_PRESUMIDO: RegraNormativa<number> = {
  valor: 78_000_000,
  fundamento: "Lei 9.718/1998, art. 13, caput",
  vigenciaInicio: "2014-01-01",
};

/**
 * Percentuais de presunção de IRPJ/CSLL por natureza tributária da
 * receita (Lei 9.249/1995, art. 15 — IRPJ; art. 20 — CSLL). Comércio,
 * indústria e transporte de cargas compartilham o mesmo percentual (8%
 * IRPJ / 12% CSLL) — não é coincidência de catálogo, é a própria lei que
 * os agrupa (art. 15, §1º, III, "c" cita transporte de cargas junto com
 * as atividades de revenda/industrialização).
 */
export const PERCENTUAIS_PRESUNCAO: Record<
  "comercio_industria_transporte_cargas" | "transporte_passageiros" | "prestacao_servicos_geral",
  { irpj: RegraNormativa<number>; csll: RegraNormativa<number> }
> = {
  comercio_industria_transporte_cargas: {
    irpj: { valor: 0.08, fundamento: "Lei 9.249/1995, art. 15, caput e §1º, III, \"c\"", vigenciaInicio: "1996-01-01" },
    csll: { valor: 0.12, fundamento: "Lei 9.249/1995, art. 20", vigenciaInicio: "1996-01-01" },
  },
  transporte_passageiros: {
    irpj: { valor: 0.16, fundamento: "Lei 9.249/1995, art. 15, §1º, II", vigenciaInicio: "1996-01-01" },
    csll: { valor: 0.12, fundamento: "Lei 9.249/1995, art. 20", vigenciaInicio: "1996-01-01" },
  },
  prestacao_servicos_geral: {
    irpj: { valor: 0.32, fundamento: "Lei 9.249/1995, art. 15, §1º, III", vigenciaInicio: "1996-01-01" },
    csll: { valor: 0.32, fundamento: "Lei 9.249/1995, art. 20, §1º, III", vigenciaInicio: "1996-01-01" },
  },
};

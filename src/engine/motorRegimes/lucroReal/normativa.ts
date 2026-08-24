/**
 * Fundação normativa do Lucro Real. Reaproveita deliberadamente
 * `ALIQUOTA_IRPJ`/`ALIQUOTA_ADICIONAL_IRPJ`/`LIMITE_ADICIONAL_IRPJ_TRIMESTRAL`/
 * `ALIQUOTA_CSLL` do Presumido (`lucroPresumido/normativa.ts`) — são as
 * MESMAS alíquotas (Lei 9.249/1995, Lei 9.430/1996), o regime não altera
 * essas normas; duplicá-las aqui criaria dois lugares para desatualizar.
 * O limite de R$ 78.000.000 também é o mesmo valor da obrigatoriedade ao
 * Real (Lei 9.718/1998, art. 14, I) e do limite do Presumido — reaproveitado
 * por referência, não por coincidência de número mágico.
 */

import type { RegraNormativa } from "../lucroPresumido/normativa";
import { LIMITE_RECEITA_BRUTA_ANUAL_PRESUMIDO } from "../lucroPresumido/normativa";

export { ALIQUOTA_IRPJ, ALIQUOTA_ADICIONAL_IRPJ, LIMITE_ADICIONAL_IRPJ_TRIMESTRAL, ALIQUOTA_CSLL } from "../lucroPresumido/normativa";

/** Receita anual acima da qual o Lucro Real é OBRIGATÓRIO (Lei 9.718/1998, art. 14, I) — mesmo valor do limite de permanência no Presumido, reaproveitado por referência. */
export const LIMITE_RECEITA_OBRIGATORIEDADE_REAL: RegraNormativa<number> = LIMITE_RECEITA_BRUTA_ANUAL_PRESUMIDO;

/** Trava de 30%: prejuízo fiscal (IRPJ) e base negativa (CSLL) só podem reduzir até 30% do lucro líquido ajustado de cada período — confirmado por busca externa nesta fase. */
export const LIMITE_COMPENSACAO_PREJUIZO: RegraNormativa<number> = {
  valor: 0.30,
  fundamento: "Lei 9.065/1995, arts. 15 e 16 (trava dos 30%) — constitucionalidade confirmada pelo STF",
  vigenciaInicio: "1995-01-01",
};

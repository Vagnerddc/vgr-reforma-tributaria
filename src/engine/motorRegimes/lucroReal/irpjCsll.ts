/**
 * IRPJ + adicional + CSLL do Lucro Real — apuração TRIMESTRAL (Lei
 * 9.430/1996, art. 1º). Modalidade "anual com balanços de suspensão/
 * redução ou estimativas mensais" NÃO é implementada nesta fase —
 * limitação documentada (docs/motor-lucro-real.md, seção I), nunca
 * escolhida silenciosamente por conveniência (seção 19 do pedido).
 *
 * Diferente do Presumido: aqui a base de cada trimestre depende do saldo
 * de prejuízo TRANSPORTADO do trimestre anterior — por isso o cálculo é
 * sequencial (não uma função pura por trimestre isolado), mas ainda
 * assim imutável: cada chamada devolve o saldo seguinte como um valor
 * novo, nunca modifica o saldo recebido.
 */

import { ALIQUOTA_ADICIONAL_IRPJ, ALIQUOTA_CSLL, ALIQUOTA_IRPJ, LIMITE_ADICIONAL_IRPJ_TRIMESTRAL } from "../lucroPresumido/normativa";
import { compensarPrejuizo } from "./prejuizoFiscal";
import type { ValorComponenteTributario } from "../tipos";

const TRIMESTRES_POR_ANO = 4;

export interface ResultadoAnoLucroReal {
  componentes: ValorComponenteTributario[];
  saldoPrejuizoIrpjFinal: number;
  saldoBaseNegativaCsllFinal: number;
}

/**
 * `lucroLiquidoAjustadoAnualIrpj`/`...Csll` são o lucro líquido ajustado
 * (já com adições/exclusões, ver baseFiscal.ts) do ANO — distribuído
 * uniformemente entre os 4 trimestres (mesma premissa documentada do
 * Presumido/Simples: sem série trimestral real, é a única distribuição
 * defensável sem inventar sazonalidade).
 */
export function calcularIrpjCsllAnual(
  lucroLiquidoAjustadoAnualIrpj: number,
  lucroLiquidoAjustadoAnualCsll: number,
  saldoPrejuizoIrpjInicial: number,
  saldoBaseNegativaCsllInicial: number
): ResultadoAnoLucroReal {
  const lucroTrimestralIrpj = lucroLiquidoAjustadoAnualIrpj / TRIMESTRES_POR_ANO;
  const lucroTrimestralCsll = lucroLiquidoAjustadoAnualCsll / TRIMESTRES_POR_ANO;

  let saldoPrejuizoIrpj = saldoPrejuizoIrpjInicial;
  let saldoBaseNegativaCsll = saldoBaseNegativaCsllInicial;
  let baseIrpjAnual = 0;
  let irpjAnual = 0;
  let excedenteAdicionalAnual = 0;
  let adicionalAnual = 0;
  let baseCsllAnual = 0;
  let csllAnual = 0;

  for (let trimestre = 0; trimestre < TRIMESTRES_POR_ANO; trimestre++) {
    const compensacaoIrpj = compensarPrejuizo(lucroTrimestralIrpj, saldoPrejuizoIrpj);
    saldoPrejuizoIrpj = compensacaoIrpj.saldoDepois;
    baseIrpjAnual += compensacaoIrpj.baseFinal;
    irpjAnual += compensacaoIrpj.baseFinal * ALIQUOTA_IRPJ.valor;

    const excedente = Math.max(0, compensacaoIrpj.baseFinal - LIMITE_ADICIONAL_IRPJ_TRIMESTRAL.valor);
    excedenteAdicionalAnual += excedente;
    adicionalAnual += excedente * ALIQUOTA_ADICIONAL_IRPJ.valor;

    const compensacaoCsll = compensarPrejuizo(lucroTrimestralCsll, saldoBaseNegativaCsll);
    saldoBaseNegativaCsll = compensacaoCsll.saldoDepois;
    baseCsllAnual += compensacaoCsll.baseFinal;
    csllAnual += compensacaoCsll.baseFinal * ALIQUOTA_CSLL.valor;
  }

  const componentes: ValorComponenteTributario[] = [
    {
      componente: "irpj",
      valor: irpjAnual,
      base: baseIrpjAnual,
      aliquota: ALIQUOTA_IRPJ.valor,
      regraAplicada: "lucro_real.irpj.trimestral.v1",
      fundamentoLegal: `${ALIQUOTA_IRPJ.fundamento}; apuração trimestral (Lei 9.430/1996, art. 1º)`,
      memoriaCalculo: `Base de IRPJ (após compensação de prejuízo, trava de 30%) somada nos 4 trimestres: R$ ${baseIrpjAnual.toFixed(2)} × ${(ALIQUOTA_IRPJ.valor * 100).toFixed(0)}% = R$ ${irpjAnual.toFixed(2)}. Saldo de prejuízo fiscal ao final do ano: R$ ${saldoPrejuizoIrpj.toFixed(2)}.`,
      status: "estimado",
    },
    {
      componente: "csll",
      valor: csllAnual,
      base: baseCsllAnual,
      aliquota: ALIQUOTA_CSLL.valor,
      regraAplicada: "lucro_real.csll.trimestral.v1",
      fundamentoLegal: `${ALIQUOTA_CSLL.fundamento}; apuração trimestral`,
      memoriaCalculo: `Base de CSLL (após compensação de base negativa, trava de 30%) somada nos 4 trimestres: R$ ${baseCsllAnual.toFixed(2)} × ${(ALIQUOTA_CSLL.valor * 100).toFixed(0)}% = R$ ${csllAnual.toFixed(2)}. Saldo de base negativa ao final do ano: R$ ${saldoBaseNegativaCsll.toFixed(2)}.`,
      status: "estimado",
    },
  ];

  if (adicionalAnual > 0) {
    componentes.push({
      componente: "adicional_irpj",
      valor: adicionalAnual,
      base: excedenteAdicionalAnual,
      aliquota: ALIQUOTA_ADICIONAL_IRPJ.valor,
      regraAplicada: "lucro_real.irpj.adicional.trimestral.v1",
      fundamentoLegal: ALIQUOTA_ADICIONAL_IRPJ.fundamento,
      memoriaCalculo: `Soma dos excedentes trimestrais sobre R$ ${LIMITE_ADICIONAL_IRPJ_TRIMESTRAL.valor.toLocaleString("pt-BR")}/trimestre (já após compensação) = R$ ${excedenteAdicionalAnual.toFixed(2)} × ${(ALIQUOTA_ADICIONAL_IRPJ.valor * 100).toFixed(0)}% = R$ ${adicionalAnual.toFixed(2)}.`,
      status: "estimado",
    });
  }

  return { componentes, saldoPrejuizoIrpjFinal: saldoPrejuizoIrpj, saldoBaseNegativaCsllFinal: saldoBaseNegativaCsll };
}

/**
 * IRPJ + adicional de IRPJ + CSLL do Lucro Presumido, por atividade —
 * seções 8/9/10/11 do pedido. Respeita a periodicidade legal (apuração
 * TRIMESTRAL, Lei 9.430/1996, art. 1º) mesmo que o `CenarioEmpresa` só
 * traga receita anual: a agregação trimestral→anual é feita aqui, nunca
 * o inverso (nunca se aplica uma "fórmula anual" que simule o trimestre).
 *
 * Premissa obrigatória quando só há receita anual: distribuição uniforme
 * entre os 4 trimestres — sempre marcada `status: "estimado"` e nunca
 * escondida (ver alertas emitidos por quem chama esta função).
 */

import type { ValorComponenteTributario } from "../tipos";
import { ALIQUOTA_ADICIONAL_IRPJ, ALIQUOTA_CSLL, ALIQUOTA_IRPJ, LIMITE_ADICIONAL_IRPJ_TRIMESTRAL, PERCENTUAIS_PRESUNCAO } from "./normativa";
import type { NaturezaTributariaReceita } from "./naturezaReceita";

export interface ResultadoIrpjCsll {
  componentes: ValorComponenteTributario[];
}

const TRIMESTRES_POR_ANO = 4;

/**
 * Calcula IRPJ/adicional/CSLL de UMA atividade para UM ano, a partir da
 * receita anual dessa atividade e da natureza tributária já classificada
 * (naturezaReceita.ts) — nunca chamada com natureza "indeterminada"
 * (quem orquestra, motor.ts, decide não calcular nesse caso).
 */
export function calcularIrpjCsllAnual(receitaAnual: number, natureza: Exclude<NaturezaTributariaReceita, "indeterminada">): ResultadoIrpjCsll {
  const percentuais = PERCENTUAIS_PRESUNCAO[natureza];
  const receitaTrimestral = receitaAnual / TRIMESTRES_POR_ANO;

  let baseIrpjAnual = 0;
  let irpjAnual = 0;
  let excedenteAdicionalAnual = 0;
  let adicionalAnual = 0;
  let baseCsllAnual = 0;
  let csllAnual = 0;

  for (let trimestre = 0; trimestre < TRIMESTRES_POR_ANO; trimestre++) {
    const baseIrpjTrimestral = receitaTrimestral * percentuais.irpj.valor;
    baseIrpjAnual += baseIrpjTrimestral;
    irpjAnual += baseIrpjTrimestral * ALIQUOTA_IRPJ.valor;

    const excedente = Math.max(0, baseIrpjTrimestral - LIMITE_ADICIONAL_IRPJ_TRIMESTRAL.valor);
    excedenteAdicionalAnual += excedente;
    adicionalAnual += excedente * ALIQUOTA_ADICIONAL_IRPJ.valor;

    const baseCsllTrimestral = receitaTrimestral * percentuais.csll.valor;
    baseCsllAnual += baseCsllTrimestral;
    csllAnual += baseCsllTrimestral * ALIQUOTA_CSLL.valor;
  }

  const componentes: ValorComponenteTributario[] = [
    {
      componente: "irpj",
      valor: irpjAnual,
      base: baseIrpjAnual,
      aliquota: ALIQUOTA_IRPJ.valor,
      regraAplicada: "presumido.irpj.trimestral.v1",
      fundamentoLegal: `${percentuais.irpj.fundamento}; ${ALIQUOTA_IRPJ.fundamento}`,
      memoriaCalculo: `Base presumida anual R$ ${baseIrpjAnual.toFixed(2)} (${(percentuais.irpj.valor * 100).toFixed(0)}% da receita, apurada por trimestre) × ${(ALIQUOTA_IRPJ.valor * 100).toFixed(0)}% = R$ ${irpjAnual.toFixed(2)}.`,
      status: "estimado",
    },
    {
      componente: "csll",
      valor: csllAnual,
      base: baseCsllAnual,
      aliquota: ALIQUOTA_CSLL.valor,
      regraAplicada: "presumido.csll.trimestral.v1",
      fundamentoLegal: `${percentuais.csll.fundamento}; ${ALIQUOTA_CSLL.fundamento}`,
      memoriaCalculo: `Base presumida anual R$ ${baseCsllAnual.toFixed(2)} (${(percentuais.csll.valor * 100).toFixed(0)}% da receita, apurada por trimestre) × ${(ALIQUOTA_CSLL.valor * 100).toFixed(0)}% = R$ ${csllAnual.toFixed(2)}.`,
      status: "estimado",
    },
  ];

  if (adicionalAnual > 0) {
    componentes.push({
      componente: "adicional_irpj",
      valor: adicionalAnual,
      base: excedenteAdicionalAnual,
      aliquota: ALIQUOTA_ADICIONAL_IRPJ.valor,
      regraAplicada: "presumido.irpj.adicional.trimestral.v1",
      fundamentoLegal: ALIQUOTA_ADICIONAL_IRPJ.fundamento,
      memoriaCalculo: `Soma dos excedentes trimestrais sobre R$ ${LIMITE_ADICIONAL_IRPJ_TRIMESTRAL.valor.toLocaleString("pt-BR")}/trimestre = R$ ${excedenteAdicionalAnual.toFixed(2)} × ${(ALIQUOTA_ADICIONAL_IRPJ.valor * 100).toFixed(0)}% = R$ ${adicionalAnual.toFixed(2)}.`,
      status: "estimado",
    });
  }

  return { componentes };
}

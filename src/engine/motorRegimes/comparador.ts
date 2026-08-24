/**
 * Orquestrador do Motor de Regimes — chama avaliarElegibilidade/calcular
 * de cada MotorRegime recebido e consolida. Não contém NENHUMA regra
 * tributária: não decide se um regime é elegível, não calcula IRPJ/CSLL/
 * DAS/etc. Isso é responsabilidade de cada MotorRegime (Presumido, Simples,
 * Fator R, Real — nenhum implementado ainda). Este arquivo só orquestra —
 * mesmo princípio já usado para "Motor de Cenários" na auditoria estratégica
 * (docs/auditoria-visao-estrategica.md, item #12: "não criar regra fiscal
 * aqui, só orquestrar").
 */

import type { CenarioEmpresa } from "../cenarioEmpresa";
import type { MotorRegime, ResultadoComparacaoRegimes, ResultadoRegime } from "./tipos";

const STATUS_QUE_CALCULA: ReadonlySet<string> = new Set(["elegivel", "obrigatorio", "opcional"]);

/**
 * Devolve um ResultadoRegime "vazio", com a aplicabilidade preenchida, para
 * regimes inelegíveis/indeterminados — nunca omite o regime da comparação
 * (seção 1 do pedido: "explicar o motivo", mesmo quando não há cálculo).
 */
function resultadoSemCalculo(motor: MotorRegime, aplicabilidade: ResultadoRegime["aplicabilidade"]): ResultadoRegime {
  return {
    regime: motor.regime,
    aplicabilidade,
    anos: [],
    cargaTotalPeriodo: 0,
    componentesConsolidados: {},
    premissas: {},
    qualidade: { percentualConfirmado: 0, origemIbsCbs: "nao_aplicavel" },
    alertas: [],
    memoria: [`Regime não calculado — status de elegibilidade: ${aplicabilidade.status}.`],
  };
}

/**
 * Compara N motores de regime para um CenarioEmpresa. Cada motor decide
 * sua própria elegibilidade; este orquestrador só decide SE chama
 * `calcular()" (quando o status permite) e consolida o resultado — nunca
 * recalcula nada por conta própria.
 */
export function compararRegimes(cenario: CenarioEmpresa, motores: MotorRegime[]): ResultadoComparacaoRegimes {
  const resultados: ResultadoRegime[] = motores.map((motor) => {
    const aplicabilidade = motor.avaliarElegibilidade(cenario);
    if (!STATUS_QUE_CALCULA.has(aplicabilidade.status)) {
      return resultadoSemCalculo(motor, aplicabilidade);
    }
    return motor.calcular(cenario, aplicabilidade);
  });

  const calculados = resultados.filter((r) => STATUS_QUE_CALCULA.has(r.aplicabilidade.status) && r.anos.length > 0);
  const regimeMenorCarga = calculados.length > 0 ? calculados.reduce((menor, atual) => (atual.cargaTotalPeriodo < menor.cargaTotalPeriodo ? atual : menor)).regime : undefined;

  return { cenarioId: cenario.id, resultados, regimeMenorCarga };
}

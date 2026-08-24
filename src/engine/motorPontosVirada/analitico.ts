/**
 * Soluções ANALÍTICAS — reaproveitadas de motores existentes, nunca
 * recalculadas por busca numérica quando já há fórmula fechada
 * confiável (seção 12/14/20/53/54 do pedido). Cada função aqui só
 * chama funções já exportadas por outros motores.
 */

import type { CenarioEmpresa } from "../cenarioEmpresa";
import type { Regime } from "../types";
import { calcularRbt12MensalDoAno } from "../motorRegimes/simplesNacional/rbt12";
import { LIMITE_FATOR_R } from "../motorRegimes/simplesNacional/normativa";
import { executarCenario } from "../motorCenarios/motor";
import type { MotorRegime } from "../motorRegimes/tipos";
import type { OpcoesExecucaoCenario } from "../motorCenarios/tipos";
import { ANOS_SIMULACAO } from "../parametros";

export interface Fs12NecessariaMensal {
  mes: number;
  rbt12: number;
  fs12NecessariaParaLimite: number;
}

/**
 * FS12 necessária para atingir o limite do Fator R (28%) — reaproveita
 * `calcularRbt12MensalDoAno` (rbt12.ts) e a constante `LIMITE_FATOR_R`
 * (normativa.ts), EXATAMENTE como o motor do Simples Nacional real faz
 * internamente (fatorR.ts::calcularFatorRDoAno, campo
 * `fs12NecessariaParaLimite`) — mesma fórmula, mesma fonte, nunca uma
 * busca iterativa (seção 12/53).
 */
export function calcularFs12NecessariaAnalitica(cenario: CenarioEmpresa, ano: number): FsNecessariaResultado {
  const receitaAtual = cenario.receita.faturamentoAnual?.valor;
  if (receitaAtual === undefined) return { disponivel: false, motivo: "receita.faturamentoAnual ausente." };

  const crescimento = cenario.receita.crescimentoAnualEstimado?.valor ?? 0;
  const receitaDoAno = (a: number) => receitaAtual * Math.pow(1 + crescimento, a - ANOS_SIMULACAO[0]);
  const dataAbertura = cenario.identificacao.dataAberturaEmpresa?.valor;

  const meses = calcularRbt12MensalDoAno(receitaDoAno(ano), ano > ANOS_SIMULACAO[0] ? receitaDoAno(ano - 1) : undefined, dataAbertura, ano);
  const porMes: Fs12NecessariaMensal[] = meses.map((m) => ({ mes: m.mes, rbt12: m.rbt12, fs12NecessariaParaLimite: m.rbt12 * LIMITE_FATOR_R.valor }));
  return { disponivel: true, porMes };
}

export type FsNecessariaResultado = { disponivel: true; porMes: Fs12NecessariaMensal[] } | { disponivel: false; motivo: string };

/**
 * Preservação de margem / margem zero — reaproveita
 * `calcularResultadoEconomicoFinanceiro` (via `executarCenario`, que já
 * o chama) e sua fórmula fechada `calcularReceitaNecessariaParaMargem`
 * (precoNecessario.ts) — apenas LÊ `reajusteMedioNecessario`/
 * `cenariosRepasse` do resultado, nunca busca numérica (seção 14/54).
 * `margemAlvo: 0` responde "margem zero" com o MESMO mecanismo.
 */
export function resolverAnaliticoMargem(cenario: CenarioEmpresa, motoresRegime: MotorRegime[], regime: Regime, ano: number, margemAlvo: number, opcoes: OpcoesExecucaoCenario = {}) {
  const resultado = executarCenario(cenario, motoresRegime, {}, { ...opcoes, premissasFinanceiras: { ...opcoes.premissasFinanceiras, margemAlvo: { valor: margemAlvo, origem: "informado_usuario", status: "estimado" } } });
  const anoFinanceiro = resultado.resultadoFinanceiroPorRegime.find((r) => r.regime === regime)?.resultado.anos.find((a) => a.ano === ano);
  return { resultado, anoFinanceiro };
}

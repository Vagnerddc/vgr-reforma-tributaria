/**
 * Motor de Otimização Multidimensional — gera a grade de combinações
 * (grade.ts), executa CADA combinação via `executarCenario`
 * (motorCenarios, nunca uma fórmula paralela), aplica restrições
 * jurídicas (restricoes.ts) e localiza a fronteira de Pareto
 * (pareto.ts) entre os objetivos configurados. Nunca chama nenhuma
 * combinação de "melhor" — só descreve o trade-off observado.
 */

import type { CenarioEmpresa } from "../cenarioEmpresa";
import type { Regime } from "../types";
import type { MotorRegime } from "../motorRegimes/tipos";
import type { OpcoesExecucaoCenario, AlteracoesCenario } from "../motorCenarios/tipos";
import { executarCenario } from "../motorCenarios/motor";
import { alteracaoParaVariavel } from "../motorCenarios/sensibilidade";
import { gerarGrade } from "./grade";
import { extrairObjetivo } from "./objetivos";
import { avaliarRestricaoJuridica } from "./restricoes";
import { calcularFronteiraPareto } from "./pareto";
import type { Objetivo, PontoAvaliado, ResultadoOtimizacao, VariavelOtimizacao } from "./tipos";

const METODOLOGIA_ID = "VGR_OTIMIZACAO";
const METODOLOGIA_VERSAO = "V1";

/** Mescla as `AlteracoesCenario` de cada variável do combo — seguro porque cada `VariavelSensibilidade` mapeia para uma subchave distinta dentro de cada grupo (receita/custos/pessoas/splitPayment/financeiro), nunca a mesma subchave duas vezes na V1. */
function mesclarAlteracoes(alteracoes: AlteracoesCenario[]): AlteracoesCenario {
  const mesclado: AlteracoesCenario = {};
  for (const a of alteracoes) {
    for (const grupo of Object.keys(a) as (keyof AlteracoesCenario)[]) {
      mesclado[grupo] = { ...(mesclado[grupo] as object), ...(a[grupo] as object) } as never;
    }
  }
  return mesclado;
}

function hashContexto(valor: unknown): string {
  const texto = JSON.stringify(valor);
  let hash = 0;
  for (let i = 0; i < texto.length; i++) hash = (hash * 31 + texto.charCodeAt(i)) | 0;
  return `otim-ctx-${(hash >>> 0).toString(16)}`;
}

export interface OpcoesOtimizacao {
  cenarioBase: CenarioEmpresa;
  motorRegime: MotorRegime;
  regime: Regime;
  ano: number;
  variaveis: VariavelOtimizacao[];
  objetivos: Objetivo[];
  opcoesExecucao?: OpcoesExecucaoCenario;
}

/**
 * Executa a otimização. Lança `LimiteComputacionalExcedidoError`
 * (grade.ts) se a grade exceder o limite computacional — nunca trunca
 * silenciosamente. O `cenarioBase` nunca é mutado: cada combinação
 * passa por `executarCenario`, que já garante imutabilidade
 * (motorCenarios/patch.ts).
 */
export function otimizar(opcoes: OpcoesOtimizacao): ResultadoOtimizacao {
  const { cenarioBase, motorRegime, regime, ano, variaveis, objetivos, opcoesExecucao = {} } = opcoes;
  const alertas: string[] = [];

  const combinacoes = gerarGrade(variaveis);
  const todosOsPontos: PontoAvaliado[] = [];
  let bloqueadas = 0;
  let descartadasPorIndisponibilidade = 0;

  combinacoes.forEach((combinacao, indice) => {
    const alteracoesPorVariavel = variaveis.map((v) => alteracaoParaVariavel(v.variavel, combinacao[v.variavel]));
    const alteracoes = mesclarAlteracoes(alteracoesPorVariavel);
    const resultado = executarCenario(cenarioBase, [motorRegime], alteracoes, opcoesExecucao);

    const id = `ponto:${indice}`;
    if (resultado.status === "erro_validacao") {
      descartadasPorIndisponibilidade++;
      return;
    }

    const restricao = avaliarRestricaoJuridica(resultado, regime, ano);
    const objetivosDoPonto = Object.fromEntries(objetivos.map((o) => [o, extrairObjetivo(o, resultado, regime, ano)])) as PontoAvaliado["objetivos"];

    if (restricao.bloqueado) bloqueadas++;
    if (!restricao.bloqueado && objetivos.every((o) => !objetivosDoPonto[o]?.disponivel)) descartadasPorIndisponibilidade++;

    todosOsPontos.push({ id, valoresVariaveis: combinacao, resultado, objetivos: objetivosDoPonto, bloqueadoJuridicamente: restricao.bloqueado, motivoBloqueio: restricao.motivo });
  });

  const candidatosValidos = todosOsPontos.filter((p) => !p.bloqueadoJuridicamente);
  if (candidatosValidos.length === 0) alertas.push("Nenhuma combinação permaneceu juridicamente válida — fronteira de Pareto vazia.");
  if (bloqueadas > 0) alertas.push(`${bloqueadas} combinação(ões) excluída(s) por restrição jurídica (regime não comparável/elegível) — nunca avaliadas como solução válida.`);
  if (descartadasPorIndisponibilidade > 0) alertas.push(`${descartadasPorIndisponibilidade} combinação(ões) descartada(s) por indisponibilidade de dados (nunca tratada como zero).`);

  const fronteira = calcularFronteiraPareto(candidatosValidos, objetivos);

  return {
    cenarioBaseId: cenarioBase.id,
    regime,
    objetivos,
    variaveis,
    combinacoesAvaliadas: todosOsPontos.length,
    combinacoesBloqueadasJuridicamente: bloqueadas,
    combinacoesDescartadasPorIndisponibilidade: descartadasPorIndisponibilidade,
    fronteiraPareto: fronteira.map((ponto) => ({ ponto })),
    todosOsPontos,
    metodologiaId: METODOLOGIA_ID,
    metodologiaVersao: METODOLOGIA_VERSAO,
    contextHash: hashContexto({ cenarioId: cenarioBase.id, regime, ano, variaveis, objetivos }),
    alertas,
  };
}

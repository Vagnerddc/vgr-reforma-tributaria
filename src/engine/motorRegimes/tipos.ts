/**
 * Contrato do Motor de Regimes — ver docs/motor-regimes-contrato.md para o
 * racional completo. ESTA FASE NÃO CALCULA NENHUM REGIME: só define os
 * tipos que Presumido/Simples/Fator R/Real vão preencher nas fases
 * seguintes, e um orquestrador puro (comparador.ts) que já funciona hoje
 * com motores de teste (fakes), sem nenhuma fórmula tributária real.
 *
 * Reaproveita deliberadamente o que já existe: `Regime`/`ANOS_SIMULACAO`
 * (engine/types.ts, parametros.ts), `CampoComProveniencia`/`OrigemInformacao`/
 * `StatusInformacao`/`OrigemCalculo` (operacaoTributaria.ts), `ResultadoAno`
 * (para o componente ibs/cbs, quando um regime específico decidir reusar o
 * Motor VGR atual em vez de recalcular). Nenhum desses tipos foi alterado.
 */

import type { Regime } from "../types";
import type { CampoComProveniencia, OrigemCalculo, StatusInformacao } from "../operacaoTributaria";
import type { CenarioEmpresa } from "../cenarioEmpresa";
import type { ResultadoAno } from "../types";

// ---------------------------------------------------------------------------
// 1. Elegibilidade — nunca "calcula os três e escolhe o menor"
// ---------------------------------------------------------------------------

/**
 * Simples e Presumido: só podem ser elegível/inelegível/indeterminado —
 * nenhuma empresa é "obrigada" a estar no Simples ou no Presumido.
 * Real pode ser `obrigatorio` (ex.: faturamento acima do limite do
 * Presumido, atividade financeira) — essa é a diferença estrutural entre
 * os três que o pedido exigiu representar explicitamente.
 */
export type StatusElegibilidade = "elegivel" | "inelegivel" | "obrigatorio" | "opcional" | "indeterminado";

/**
 * Um critério individual de elegibilidade (ex.: "limite de receita bruta
 * anual", "atividade impeditiva do Simples", "Fator R ≥ 28%") — cada um
 * com sua própria proveniência, nunca uma conclusão "porque sim". Vários
 * critérios compõem uma AvaliacaoElegibilidade.
 */
export interface CriterioElegibilidade {
  id: string;
  descricao: string;
  atendido: boolean | "indeterminado";
  /** De onde veio o dado que permitiu avaliar este critério (ex.: faturamento confirmado vs. estimado). */
  fonte: CampoComProveniencia<string>;
}

export interface AvaliacaoElegibilidade {
  regime: Regime;
  status: StatusElegibilidade;
  /** Explicação em linguagem direta, sempre presente — nunca um status sem motivo. */
  motivo: string;
  criterios: CriterioElegibilidade[];
}

// ---------------------------------------------------------------------------
// 2/3. Resultado padronizado por regime — carga TOTAL, não só IBS/CBS
// ---------------------------------------------------------------------------

/**
 * "adicional_irpj" foi adicionado nesta fase (Lucro Presumido) — ÚNICA
 * alteração ao contrato desde a fase anterior. Motivo documentado (não é
 * conveniência): o adicional de IRPJ (10% sobre o excedente de R$ 20.000/mês
 * de base presumida, Lei 9.430/1996 art. 3º) é juridicamente um tributo
 * PRÓPRIO — tem base de incidência diferente (só o excedente, não a base
 * toda) e pode existir sem o IRPJ principal ser o problema. Somar seu valor
 * dentro de "irpj" preservaria o total, mas destruiria a auditabilidade por
 * componente exigida (impossível responder "quanto foi só adicional" a
 * partir de um único número). Alteração mínima: um valor novo na union,
 * nenhum campo/formato de ValorComponenteTributario mudou. Teste de
 * regressão: motorRegimes/lucroPresumido/__tests__ confirma que "irpj" e
 * "adicional_irpj" aparecem como entradas SEPARADAS no array de componentes.
 */
export type ComponenteTributario = "irpj" | "adicional_irpj" | "csll" | "pis" | "cofins" | "cpp_inss" | "iss" | "icms" | "ibs" | "cbs" | "is" | "das" | "outros";

/**
 * Um valor de componente tributário, sempre rastreável. `origemCalculo` só
 * é preenchido para ibs/cbs quando esse valor especificamente veio do
 * Motor Oficial ou do Motor VGR (reaproveita o tipo já existente da
 * arquitetura híbrida — nunca duplicado); os demais componentes (IRPJ,
 * CSLL, DAS...) não têm Motor Oficial equivalente, então o campo fica
 * ausente para eles, nunca preenchido com um valor inventado.
 */
export interface ValorComponenteTributario {
  componente: ComponenteTributario;
  valor: number;
  base?: number;
  aliquota?: number;
  /** Identificador estável da regra/fórmula aplicada (ex.: "presumido.irpj.trimestral.v1") — nenhuma fase atual preenche isso de verdade; o campo existe para quando a regra existir, não deve ficar vazio "por enquanto" quando a regra já tiver sido implementada. */
  regraAplicada?: string;
  fundamentoLegal?: string;
  memoriaCalculo?: string;
  origemCalculo?: OrigemCalculo;
  status: StatusInformacao;
}

/**
 * Um ano dentro do período de simulação (2026–2033, ANOS_SIMULACAO) —
 * `disponivel: false` é o valor correto quando aquele regime/versão ainda
 * não calcula aquele ano (ex.: transição ICMS/ISS→IBS entre 2029 e 2032),
 * nunca confundido com "carga zero naquele ano".
 */
export interface ResultadoAnoRegime {
  ano: number;
  disponivel: boolean;
  componentes: ValorComponenteTributario[];
  cargaTotal: number;
  /**
   * Quando este ano reaproveitou o Motor VGR atual (calculo.ts) para o
   * componente ibs/cbs em vez de recalcular — preserva o resultado original
   * completo (débito/crédito/split payment/etc.), sem duplicar lógica.
   */
  resultadoAnoVgrOrigem?: ResultadoAno;
}

/**
 * Sub-resultado por atividade — só populado quando a empresa é
 * multiatividade E os componentes tributários divergem entre atividades
 * (ex.: ISS de serviço diferente de ICMS de comércio na mesma empresa;
 * Fator R avaliado por atividade dentro do Simples). Quando a empresa é
 * mono-atividade, `porAtividade` fica ausente — `anos` já é o resultado
 * final, sem indireção desnecessária.
 */
export interface ResultadoAtividadeRegime {
  perfilId: string;
  anos: ResultadoAnoRegime[];
}

export interface QualidadeResultadoRegime {
  /** % dos componentes com status "confirmado" — o resto é estimado/herdado/importado. Não é o mesmo conceito de CompletudeCenario (que mede o cenário de entrada, não o resultado). */
  percentualConfirmado: number;
  /** Quando ibs/cbs vêm do Motor Oficial e/ou do Motor VGR ao mesmo tempo dentro do período simulado, sinaliza aqui — nunca escondido dentro de "misto" sem explicação. */
  origemIbsCbs: "motor_oficial" | "motor_vgr" | "misto" | "nao_aplicavel";
}

export interface ResultadoRegime {
  regime: Regime;
  aplicabilidade: AvaliacaoElegibilidade;
  /** Consolidado — sempre a soma/composição final, independente de a empresa ser multiatividade ou não. */
  anos: ResultadoAnoRegime[];
  /** Presente só quando a decomposição por atividade é necessária para explicar o resultado (ver ResultadoAtividadeRegime). */
  porAtividade?: ResultadoAtividadeRegime[];
  /** Soma da cargaTotal de todos os anos disponíveis — nunca inclui anos com disponivel:false na conta, para não subestimar silenciosamente. */
  cargaTotalPeriodo: number;
  /** Soma por componente, ao longo de todo o período disponível — permite comparar "quanto do total é IRPJ" entre regimes. */
  componentesConsolidados: Partial<Record<ComponenteTributario, number>>;
  premissas: Record<string, CampoComProveniencia<unknown>>;
  qualidade: QualidadeResultadoRegime;
  alertas: string[];
  /** Trilha de decisões em nível de regime (ex.: "Anexo III escolhido em vez de V por Fator R") — granularidade de regime, não de componente (isso já é memoriaCalculo em ValorComponenteTributario). */
  memoria: string[];
}

// ---------------------------------------------------------------------------
// 4/5/6. Contrato do motor de cada regime — multiatividade, multi-ano e
// auditabilidade já fazem parte da assinatura, não são extensões futuras.
// ---------------------------------------------------------------------------

/**
 * Um motor de regime (Presumido, Simples, Real — cada um implementado em
 * módulo próprio, em fases futuras) sempre expõe estas duas operações.
 * `calcular` só deve ser chamado depois de `avaliarElegibilidade` — não é
 * responsabilidade do motor decidir se DEVE ser calculado, é
 * responsabilidade de quem orquestra (comparador.ts).
 */
export interface MotorRegime {
  regime: Regime;
  avaliarElegibilidade(cenario: CenarioEmpresa): AvaliacaoElegibilidade;
  calcular(cenario: CenarioEmpresa, elegibilidade: AvaliacaoElegibilidade): ResultadoRegime;
}

export interface ResultadoComparacaoRegimes {
  cenarioId: string;
  /** Um item por regime AVALIADO — inclui os inelegíveis (com aplicabilidade preenchida e anos vazio), nunca omite silenciosamente um regime só porque não se aplica. */
  resultados: ResultadoRegime[];
  /**
   * Função pura sobre cargaTotalPeriodo dos regimes CALCULADOS (elegível/
   * obrigatório/opcional) — nunca decide "recomendação" (isso pertence ao
   * futuro Motor Estratégico, que pondera margem/caixa/risco além do menor
   * tributo puro; ver docs/auditoria-visao-estrategica.md, item #18).
   */
  regimeMenorCarga?: Regime;
}

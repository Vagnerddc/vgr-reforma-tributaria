/**
 * Contrato do Motor de Cenários e Sensibilidade — ORQUESTRADOR PURO. Não
 * possui fórmula tributária, econômica ou financeira própria: só aplica
 * alterações tipadas sobre um `CenarioEmpresa` e chama, em sequência,
 * `compararRegimes` (motorRegimes/comparador.ts), `avaliarComparacaoConsolidada`
 * (motorRegimes/comparadorConsolidado.ts), `calcularResultadoEconomicoFinanceiro`
 * (motorFinanceiro/motor.ts) e `calcularImpactoCaixaDoAno`
 * (motorFinanceiro/splitPayment/motor.ts) — todos já existentes e intocados.
 */

import type { CampoComProveniencia, OrigemInformacao } from "../operacaoTributaria";
import type { Regime } from "../types";
import type { ResultadoRegime } from "../motorRegimes/tipos";
import type { ResultadoComparacaoConsolidado, QualidadeConsolidada } from "../motorRegimes/comparadorConsolidado";
import type { PremissasFinanceiras, ResultadoEconomicoFinanceiro, QualidadeFinanceira } from "../motorFinanceiro/tipos";
import type { PremissasSplitPayment, ResultadoImpactoCaixa, QualidadeImpactoCaixa } from "../motorFinanceiro/splitPayment/tipos";

// ---------------------------------------------------------------------------
// Alterações — estrutura tipada, nunca Record<string, any> (seção 4 do pedido)
// ---------------------------------------------------------------------------

/**
 * Como um valor alterado se relaciona com o valor base (seção 40 do
 * pedido). `set` substitui; `incremento_absoluto` soma ao valor base
 * (ausência de base tratada como 0, documentado em patch.ts);
 * `incremento_percentual` multiplica o valor base por `(1 + valor)` —
 * exige que o valor base exista (nunca assume 0 como base percentual).
 */
export type TipoAlteracaoValor = "set" | "incremento_absoluto" | "incremento_percentual";

/**
 * Uma alteração tipada e rastreável (seção 6 do pedido: nunca uma
 * estimativa vira dado real silenciosamente — `origem`/`status` são
 * sempre os da ALTERAÇÃO em si, nunca herdados/promovidos do campo base).
 */
export interface ValorAlterado<T = number> {
  tipo: TipoAlteracaoValor;
  valor: T;
  origem: OrigemInformacao;
  status: CampoComProveniencia<T>["status"];
}

export interface AlteracaoReceita {
  faturamentoAnual?: ValorAlterado;
  crescimentoAnualEstimado?: ValorAlterado;
}

/** Altera o `valorAnual` de um item de custo JÁ EXISTENTE, identificado por `categoria.chave` — nunca cria uma categoria nova (isso pertenceria ao cadastro de custos, não a uma hipótese de cenário). */
export interface AlteracaoItemCusto {
  categoriaChave: string;
  valorAnual: ValorAlterado;
}

export interface AlteracaoCustos {
  itens?: AlteracaoItemCusto[];
  /**
   * Fator multiplicativo aplicado ao `valorAnual` de TODOS os itens cuja
   * `categoria.creditoIbsCbs.tratamento === "creditavel"` — usado para
   * sensibilidade de "créditos" (seção 23/24 do pedido) sem inventar uma
   * fórmula de crédito própria: o crédito efetivo continua sendo
   * derivado por `agregarCreditoPorSistema` (creditoTributario.ts),
   * exatamente como em qualquer outro cenário. `valor: 1.2` = +20% no
   * volume de custos creditáveis; nunca um "percentual de crédito" digitado
   * direto (o motor fiscal não aceita esse campo).
   */
  fatorEscalaCustosCreditaveisIbsCbs?: ValorAlterado;
  /** Mesma lógica, mas aplicado a TODOS os itens de custo (não só os creditáveis) — usado para sensibilidade de custos/despesas agregados (seção 23 do pedido, variável "custosFixos"). */
  fatorEscalaTodosItens?: ValorAlterado;
}

export interface AlteracaoPessoas {
  folhaAnual?: ValorAlterado;
  encargosAnual?: ValorAlterado;
  proLaboreAnual?: ValorAlterado;
}

/**
 * Premissa NORMATIVA HIPOTÉTICA (seção 10/11 do pedido) — categoria
 * separada de decisão empresarial comum; `status` é sempre `"hipotese"`,
 * nunca confundido com legislação confirmada. Reaproveita as MESMAS
 * chaves que `TributarioEmpresa.premissas` já aceita (ex.:
 * `pisCofinsPercentualAtual`), mas em um namespace isolado para nunca ser
 * lido silenciosamente como premissa confirmada pelos motores fiscais.
 */
export interface PremissaNormativaHipotetica {
  chave: string;
  valor: number;
  origem: OrigemInformacao;
}

export interface AlteracaoTributario {
  /** Mescla em `tributario.premissas` (ex.: pisCofinsPercentualAtual, icmsIpiPercentualAtual) — mesmas chaves já lidas pelo adapter do Motor VGR. */
  premissas?: Record<string, ValorAlterado<unknown>>;
  /** Nunca mesclado em `tributario.premissas` — ver PremissaNormativaHipotetica. Exposto em `ResultadoCenario.premissasNormativasHipoteticas`, nunca usado por nenhum motor fiscal real nesta fase. */
  premissasNormativasHipoteticas?: PremissaNormativaHipotetica[];
}

export interface AlteracaoFinanceiro {
  margemAlvo?: ValorAlterado;
  percentualCustosVariaveis?: ValorAlterado;
}

export interface AlteracaoSplitPayment {
  percentualRecebimentosSujeitos?: ValorAlterado;
  percentualTributoSegregado?: ValorAlterado;
  taxaCustoCapitalMensal?: ValorAlterado;
  caixaMinimoOperacional?: ValorAlterado;
}

export interface AlteracoesCenario {
  receita?: AlteracaoReceita;
  custos?: AlteracaoCustos;
  pessoas?: AlteracaoPessoas;
  tributario?: AlteracaoTributario;
  financeiro?: AlteracaoFinanceiro;
  splitPayment?: AlteracaoSplitPayment;
}

// ---------------------------------------------------------------------------
// CenarioAnalise — nunca duplica CenarioEmpresa, só referencia + alterações
// ---------------------------------------------------------------------------

/**
 * Rótulos reconhecidos (seção 7 do pedido) — NUNCA carregam premissa
 * automática. `tipo: "conservador"` não define nenhum valor por si só;
 * as premissas de fato vêm de `alteracoes`, sempre explícitas.
 */
export type TipoCenario = "baseline" | "conservador" | "provavel" | "otimizado_informado" | "personalizado";

export interface CenarioAnalise {
  id: string;
  nome: string;
  descricao?: string;
  cenarioBaseId: string;
  tipo: TipoCenario;
  alteracoes: AlteracoesCenario;
  /** Proveniência de conjunto (rótulo geral de quem definiu este cenário) — proveniência campo-a-campo já vive em cada `ValorAlterado`, esta é só a etiqueta do conjunto como um todo. */
  origemPremissas: OrigemInformacao;
  status: "rascunho" | "executado" | "erro_validacao";
}

export interface ErroValidacaoCenario {
  campo: string;
  motivo: string;
}

// ---------------------------------------------------------------------------
// ResultadoCenario — referencia contratos existentes, nunca copia
// ---------------------------------------------------------------------------

/** Qualidade consolidada por dimensão — nunca uma média 0-100 (seção 15/16 do pedido); cada dimensão preserva seu próprio veredito. */
export type QualidadeDimensao = QualidadeConsolidada | QualidadeFinanceira | QualidadeImpactoCaixa | "indisponivel";

export interface QualidadePorDimensao {
  fiscal: QualidadeDimensao;
  economica: QualidadeDimensao;
  caixa: QualidadeDimensao;
}

export interface ResultadoFinanceiroPorRegime {
  regime: Regime;
  resultado: ResultadoEconomicoFinanceiro;
}

export interface ResultadoCaixaPorRegime {
  regime: Regime;
  anos: ResultadoImpactoCaixa[];
}

/** Registro de auditabilidade (seção 47 do pedido) — nunca usado para decidir nada, só para explicar depois "o que foi usado". */
export interface VersaoMotores {
  motoresRegime: Regime[];
  origemIbsCbsPorRegime: Partial<Record<Regime, string>>;
  dataAnalise: string;
}

export interface ResultadoCenario {
  cenarioAnaliseId?: string;
  tipo: TipoCenario;
  cenarioId: string;
  status: "executado" | "erro_validacao";
  errosValidacao: ErroValidacaoCenario[];
  resultadoRegimes: ResultadoRegime[];
  comparacaoRegimes?: ResultadoComparacaoConsolidado;
  resultadoFinanceiroPorRegime: ResultadoFinanceiroPorRegime[];
  /** `undefined` quando NENHUMA premissa de split foi informada — dimensão inteira indisponível (seção 13 do pedido), nunca confundido com "insuficiente" (que significa "tentou calcular, faltou dado"). */
  resultadoCaixaPorRegime?: ResultadoCaixaPorRegime[];
  qualidade: QualidadePorDimensao;
  premissasEfetivas: AlteracoesCenario;
  premissasNormativasHipoteticas: PremissaNormativaHipotetica[];
  versaoMotores: VersaoMotores;
  alertas: string[];
}

export interface OpcoesExecucaoCenario {
  premissasFinanceiras?: PremissasFinanceiras;
  premissasSplit?: PremissasSplitPayment;
}

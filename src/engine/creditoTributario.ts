/**
 * Modelagem de crédito tributário por categoria de gasto — separa três
 * informações que a estrutura antiga (CategoriaDespesa.creditavel: boolean)
 * misturava numa só:
 *
 *   1. O que o gasto É economicamente (NaturezaEconomica) — nunca decide
 *      sozinho se há crédito.
 *   2. Como esse gasto se comporta perante o crédito, POR SISTEMA
 *      TRIBUTÁRIO (TratamentoCredito) — PIS/COFINS, ICMS/IPI e CBS/IBS são
 *      regimes de creditamento diferentes; uma mesma despesa pode ter
 *      tratamento diferente em cada um.
 *   3. Quão confiável é essa classificação (StatusClassificacao) — uma
 *      categoria pode estar "creditável" só por premissa herdada do sistema
 *      antigo, ainda não revisada tributariamente.
 *
 * Ver PROPOSTA_MODELAGEM (histórico da conversa) para o racional completo.
 */

/** O que o gasto é, economicamente — nunca determina por si só o tratamento de crédito. */
export type NaturezaEconomica =
  | "custo_direto"
  | "custo_operacional"
  | "folha_e_encargos"
  | "beneficios_pessoal"
  | "despesa_administrativa"
  | "outros_gastos";

export const LABEL_NATUREZA_ECONOMICA: Record<NaturezaEconomica, string> = {
  custo_direto: "Custo direto da atividade",
  custo_operacional: "Custo operacional",
  folha_e_encargos: "Folha e encargos",
  beneficios_pessoal: "Benefícios e serviços relacionados ao pessoal",
  despesa_administrativa: "Despesas administrativas e outros",
  outros_gastos: "Outros gastos",
};

/** Como o gasto se comporta perante o crédito, num sistema tributário específico. */
export type TratamentoCredito = "creditavel" | "nao_creditavel" | "parcial" | "indeterminado";

/** Quão confiável/validada é essa classificação — informação independente do tratamento em si. */
export type StatusClassificacao = "confirmado" | "estimado" | "herdado" | "informado_usuario";

export interface TratamentoTributarioCategoria {
  tratamento: TratamentoCredito;
  /** Só relevante quando tratamento === "parcial" — fração de fato creditável (ex.: 0.6 = 60%). */
  percentualCredito?: number;
  /**
   * Só relevante quando tratamento === "indeterminado". A premissa PROVISÓRIA
   * usada no cálculo enquanto a classificação real não é confirmada — nunca
   * implícita: se não houver premissa explícita aqui, o valor não credita
   * nada (never assume 100% nem 0% silenciosamente).
   */
  percentualPremissaCalculo?: number;
  status: StatusClassificacao;
  observacao?: string;
}

export interface CategoriaGasto {
  chave: string;
  label: string;
  naturezaEconomica: NaturezaEconomica;
  creditoPisCofins: TratamentoTributarioCategoria;
  creditoIcmsIpi: TratamentoTributarioCategoria;
  creditoIbsCbs: TratamentoTributarioCategoria;
  /** Redução de base/alíquota por NCM (ex.: insumos agropecuários) — não é tratamento de crédito, é redução de base de cálculo. Preservado da estrutura antiga. */
  reducaoAliquota?: boolean;
}

export type SistemaTributario = "pisCofins" | "icmsIpi" | "ibsCbs";

export function tratamentoDoSistema(categoria: CategoriaGasto, sistema: SistemaTributario): TratamentoTributarioCategoria {
  if (sistema === "pisCofins") return categoria.creditoPisCofins;
  if (sistema === "icmsIpi") return categoria.creditoIcmsIpi;
  return categoria.creditoIbsCbs;
}

/**
 * Fração do valor da categoria que efetivamente credita, num sistema —
 * "indeterminado" só credita a fração explícita em percentualPremissaCalculo
 * (0 se ausente); nunca assume 100%/0% por omissão.
 */
export function fracaoCreditavel(t: TratamentoTributarioCategoria): number {
  if (t.tratamento === "creditavel") return 1;
  if (t.tratamento === "nao_creditavel") return 0;
  if (t.tratamento === "parcial") return t.percentualCredito ?? 0;
  return t.percentualPremissaCalculo ?? 0;
}

export interface GastoInformado {
  categoria: CategoriaGasto;
  valorAnual: number;
}

/**
 * Diagnóstico agregado de crédito de um conjunto de gastos, num sistema
 * tributário — não é só "o percentual usado no cálculo": separa o que é
 * creditável, o que não é, o que ainda está indeterminado, e quanto do
 * indeterminado está sendo usado sob premissa (para o diagnóstico poder
 * dizer ao usuário quanto do resultado depende de dado confirmado).
 */
export interface ResultadoAgregacaoCredito {
  /** % do faturamento efetivamente usado como creditável no cálculo (inclui a parcela "sob premissa"). */
  percentualCreditavel: number;
  /** % do faturamento em gastos sem crédito (inclui a parcela não-creditável de categorias "parcial"). */
  percentualNaoCreditavel: number;
  /** % do faturamento em gastos cujo tratamento ainda não foi confirmado (informativo — não é o que o cálculo usa). */
  percentualIndeterminado: number;
  /** Subconjunto de percentualIndeterminado que está sendo contado dentro de percentualCreditavel via premissa provisória. */
  percentualSobPremissa: number;
}

/**
 * Converte os gastos informados (com categoria + valor anual) no percentual
 * de crédito usado pelo motor, para UM sistema tributário — e devolve a
 * decomposição completa para diagnóstico. Não decide nada sozinho: só lê o
 * tratamento já classificado em cada categoria.
 */
export function agregarCreditoPorSistema(
  gastos: GastoInformado[],
  sistema: SistemaTributario,
  faturamentoAnual: number
): ResultadoAgregacaoCredito {
  if (faturamentoAnual <= 0) {
    return { percentualCreditavel: 0, percentualNaoCreditavel: 0, percentualIndeterminado: 0, percentualSobPremissa: 0 };
  }
  let creditavel = 0;
  let naoCreditavel = 0;
  let indeterminado = 0;
  let sobPremissa = 0;

  for (const { categoria, valorAnual } of gastos) {
    const t = tratamentoDoSistema(categoria, sistema);
    if (t.tratamento === "creditavel") {
      creditavel += valorAnual;
    } else if (t.tratamento === "nao_creditavel") {
      naoCreditavel += valorAnual;
    } else if (t.tratamento === "parcial") {
      const fracao = t.percentualCredito ?? 0;
      creditavel += valorAnual * fracao;
      naoCreditavel += valorAnual * (1 - fracao);
    } else {
      indeterminado += valorAnual;
      const premissa = t.percentualPremissaCalculo ?? 0;
      sobPremissa += valorAnual * premissa;
    }
  }

  return {
    percentualCreditavel: (creditavel + sobPremissa) / faturamentoAnual,
    percentualNaoCreditavel: naoCreditavel / faturamentoAnual,
    percentualIndeterminado: indeterminado / faturamentoAnual,
    percentualSobPremissa: sobPremissa / faturamentoAnual,
  };
}

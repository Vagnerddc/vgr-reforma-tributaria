import type { PerfilAtividade } from "./atividades";

export type Regime =
  | "simples_unificado"
  | "simples_hibrido"
  | "lucro_presumido"
  | "lucro_real";

export type AnexoSimples = "anexoIII" | "anexoV";

export type MeioPagamento = "pix" | "boleto" | "ted" | "cartao_credito";

export type TipoOperacaoConstrucao = "empreitada" | "incorporacao" | "locacao";

export interface PerfilClientesInput {
  /** % do faturamento vendido a produtor rural que será contribuinte de IBS/CBS (B2B) */
  percentualClienteContribuinte: number;
  /** % do faturamento vendido a pessoa física / produtor não-contribuinte / isento */
  percentualClienteNaoContribuinte: number;
}

export interface SimulacaoInput {
  nomeEmpresa: string;
  /** perfil de atividade do cliente — define a redução de alíquota de CBS/IBS aplicável (ver reducaoAliquotaAtividadeEconomica em calculo.ts) */
  perfil?: PerfilAtividade;
  /** só relevante para o perfil "aviação agrícola" — omitir para os demais perfis */
  tipoAviacao?: "convencional" | "drone";
  /** só relevante para o perfil "construção civil" — define a redução de alíquota aplicável (venda/incorporação -50%, locação -70%, empreitada sem redução confirmada) */
  tipoOperacaoConstrucao?: TipoOperacaoConstrucao;
  regimeAtual: Regime;
  anexoSimples?: AnexoSimples;
  faturamentoAnual: number;
  /** carga de PIS/Cofins hoje, em % do faturamento — extinto integralmente a partir do início da cobrança efetiva (2027), substituído pela CBS */
  pisCofinsPercentualAtual: number;
  /** carga de ICMS/IPI (ou ISS, quando aplicável) hoje, em % do faturamento — extinto gradualmente de 2029 a 2033, substituído pelo IBS */
  icmsIpiPercentualAtual: number;
  /**
   * % do faturamento correspondente a custos/insumos que geram crédito —
   * LEGADO: usado indistintamente para PIS/COFINS, ICMS/IPI e CBS/IBS.
   * Continua sendo o fallback quando os dois campos abaixo não são informados
   * (compatibilidade com simulações antigas — ver engine/creditoTributario.ts
   * para o motivo de ter sido separado por sistema tributário).
   */
  percentualCustosCreditaveis: number;
  /**
   * % de custos creditáveis específico do SISTEMA ATUAL (PIS/COFINS e
   * ICMS/IPI) — quando informado, tem prioridade sobre percentualCustosCreditaveis
   * só para o crédito do sistema atual. Produzido por
   * engine/creditoTributario.ts (agregarCreditoPorSistema) a partir da
   * classificação de cada categoria de gasto — nunca precisa ser digitado
   * manualmente pelo usuário final.
   */
  percentualCustosCreditaveisSistemaAtual?: number;
  /**
   * % de custos creditáveis específico do NOVO SISTEMA (CBS/IBS) — mesma
   * prioridade sobre percentualCustosCreditaveis, só para o crédito de
   * insumos do sistema novo. Ver percentualCustosCreditaveisSistemaAtual.
   */
  percentualCustosCreditaveisNovoSistema?: number;
  perfilClientes: PerfilClientesInput;
  /** meio de pagamento predominante recebido dos clientes, para cálculo do impacto do split payment */
  meioPagamentoPredominante: MeioPagamento;
  /**
   * % dos custos creditáveis (percentualCustosCreditaveis) que correspondem a
   * compras de produtor rural não contribuinte — calculado automaticamente a
   * partir dos fornecedores pessoa física identificados no SPED (ver
   * sugerirPercentualComprasProdutorRuralNaoContribuinte em projecao.ts), não
   * é um campo para o contador estimar. Essa fração não gera crédito integral
   * (o vendedor não destaca CBS/IBS por não ser contribuinte) — só o crédito
   * PRESUMIDO do art. 168 da LC 214/2025, na alíquota de
   * percentualCreditoPresumidoProdutorRural. Default 0 = nenhuma compra de
   * produtor rural não contribuinte identificada.
   */
  percentualComprasProdutorRuralNaoContribuinte?: number;
  /**
   * % de crédito presumido sobre as compras de produtor rural não contribuinte
   * (LC 214/2025, art. 168) — ESSE sim é um dado que varia e precisa ser
   * informado/confirmado pelo contador: a lei não fixa o percentual, ele é
   * definido por ato do Comitê Gestor/Ministério da Fazenda e pode variar por
   * produto (ex.: hoje estimado em 60% para compra de gado). Default: cai no
   * parametros.produtorRural.creditoPresumidoComprasDeNaoContribuinte (60%,
   * estimativa) quando não informado.
   */
  percentualCreditoPresumidoProdutorRural?: number;
  /**
   * % do faturamento (não das despesas) composto por produtos com alíquota ZERO
   * identificada por NCM (Anexos I/XV da LC 214/2025 — cesta básica, hortícolas
   * in natura etc.), calculado a partir de faturamentoPorRegimeProduto no SPED
   * (ver identificarRegimeProdutoPorNcm em produtoRegimeEspecial.ts). Aplica-se
   * SOBRE a fração de faturamento não coberta por percentualFaturamentoProdutoReduzido60
   * nem pela redução de atividade econômica — os três regimes não se acumulam
   * na mesma fatia de receita. Default 0 = nenhum produto com regime especial
   * identificado (todo o faturamento na alíquota da atividade/cheia).
   */
  percentualFaturamentoProdutoZero?: number;
  /** Mesma lógica de percentualFaturamentoProdutoZero, para produtos com redução de 60% (Anexos IV/V/VII/IX). */
  percentualFaturamentoProdutoReduzido60?: number;
}

export interface ResultadoAno {
  ano: number;
  aliquotaCbs: number;
  aliquotaIbs: number;
  aliquotaTotal: number;
  cargaAtualReferencia: number;
  /** débito bruto de tributo apurado no ano (antes de deduzir créditos), em R$ */
  debitoBruto: number;
  /** créditos apurados sobre insumos/custos creditáveis, em R$ */
  creditoApurado: number;
  /** carga efetiva líquida (débito - crédito, incluindo custo de compliance quando houver) — igual a cargaNovaPropriaEmpresa */
  cargaNovaPropriaEmpresa: number;
  /**
   * Desmembramento de débito/crédito/efetivo entre CBS e IBS, em R$.
   * Para regimes onde a lei não separa os dois tributos na prática (Simples
   * unificado, e a parcela de DAS residual do híbrido), o desmembramento é uma
   * alocação proporcional pela razão aliquotaCbs/aliquotaTotal — estimativa
   * gerencial, não uma apuração oficial separada por tributo.
   */
  debitoBrutoCbs: number;
  debitoBrutoIbs: number;
  creditoApuradoCbs: number;
  creditoApuradoIbs: number;
  efetivoCbs: number;
  efetivoIbs: number;
  /**
   * Projeção do que seria devido no sistema antigo (PIS/Cofins + ICMS/IPI),
   * aplicando as alíquotas de hoje sobre o faturamento e o cronograma legal de
   * extinção (PIS/Cofins zerado a partir de 2027; ICMS/IPI reduzido gradualmente
   * de 2029 a 2033, na mesma proporção em que o IBS avança). Serve para comparar
   * lado a lado com o sistema novo (CBS + IBS) ano a ano.
   */
  pisCofinsProjetado: number;
  icmsIpiProjetado: number;
  sistemaAntigoProjetadoTotal: number;
  /**
   * Débito/crédito do sistema antigo, na referência de hoje (constante entre os
   * anos, antes do cronograma de extinção ser aplicado) — PIS/Cofins não
   * cumulativo (Lucro Real) e ICMS fora do Simples geram crédito sobre os
   * mesmos insumos/custos creditáveis usados no cálculo de CBS/IBS. No Simples
   * (unificado e a parcela de DAS residual do híbrido) e no PIS/Cofins
   * cumulativo (Lucro Presumido) não há crédito próprio.
   */
  debitoPisCofinsAtual: number;
  creditoPisCofinsAtual: number;
  debitoIcmsAtual: number;
  creditoIcmsAtual: number;
  deltaCargaPercentual: number;
  deltaCargaReais: number;
  custoComplianceAdicional: number;
  percentualCreditoRepassadoAoCliente: number;
  splitPaymentAtivoParaMeioPredominante: boolean;
  capitalGiroLiberadoAtualMensal: number;
  capitalGiroPerdidoComSplitMensal: number;
  /**
   * Saldo credor de CBS/IBS que sobrou neste ano (crédito > débito) e foi
   * carregado para abater o débito do ano seguinte (LC 214/2025, art. 45 —
   * direito à manutenção e aproveitamento do saldo credor em períodos
   * subsequentes). Zero quando o crédito do ano foi todo absorvido pelo
   * débito, ou no regime unificado (sem apuração própria de crédito).
   */
  saldoCredorAcumuladoFinal: number;
  observacoes: string[];
}

export interface ResultadoSimulacao {
  input: SimulacaoInput;
  anos: ResultadoAno[];
  recomendacao: string;
  avisos: string[];
}

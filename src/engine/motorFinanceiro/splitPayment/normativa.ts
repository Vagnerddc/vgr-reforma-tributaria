/**
 * Separação explícita entre regra normativa CONFIRMADA e premissa de
 * simulação financeira (seção 2/64 do pedido) — verificado por pesquisa
 * antes de codificar qualquer mecânica específica de split payment, não
 * assumido de memória (mesmo princípio já aplicado nas fases de Simples
 * Nacional/Fator R desta sessão).
 *
 * Data de validação desta pesquisa: 2026-08-12.
 */

/**
 * Fatos confirmados pela LC 214/2025, com fundamento legal citável — só
 * estes podem ser tratados como regra, nunca "premissa que pode mudar":
 *
 * 1. **Art. 348 — 2026 é ano-teste.** CBS/IBS cobrados em 2026 são
 *    simbólicos (alíquota efetiva próxima de zero para o contribuinte
 *    cumpridor); compensáveis com PIS/Cofins do mesmo período ou
 *    ressarcíveis em até 60 dias. Já citado em `calculo.ts` (linhas do
 *    ano-teste) — não duplicado aqui, só referenciado.
 * 2. **Art. 34, II — parcelamento.** Quando o preço é pago em parcelas, a
 *    segregação e o recolhimento do IBS/CBS devem ser proporcionais a
 *    cada parcela na liquidação financeira (não é segregado 100% na
 *    primeira parcela nem diferido para a última).
 * 3. **Existência do mecanismo em si** (retenção no momento da liquidação
 *    financeira por instituições de pagamento) está prevista na LC
 *    214/2025 — o QUE vai existir é confirmado; o COMO exatamente (datas,
 *    percentuais por arranjo, modalidades) depende de regulamento do
 *    Comitê Gestor do IBS.
 */
export const FATOS_CONFIRMADOS = {
  anoTeste2026: {
    fundamento: "LC 214/2025, art. 348",
    resumo:
      "2026 é ano-teste: CBS/IBS cobrados são simbólicos, compensáveis com PIS/Cofins do mesmo período ou ressarcíveis em até 60 dias; ônus final esperado é zero para o contribuinte cumpridor.",
  },
  segregacaoProporcionalParcelamento: {
    fundamento: "LC 214/2025, art. 34, II",
    resumo: "Em pagamentos parcelados, a segregação/recolhimento do IBS/CBS deve ser proporcional a cada parcela na liquidação financeira.",
  },
  mecanismoPrevistoDetalheRegulamentado: {
    fundamento: "LC 214/2025 (split payment) + regulamento do Comitê Gestor do IBS (pendente)",
    resumo: "A existência da retenção na liquidação financeira é prevista em lei; percentuais de retenção por arranjo de pagamento, cronograma detalhado por modalidade e exceções dependem de ato infralegal ainda não publicado com valores definitivos.",
  },
} as const;

/**
 * O que NÃO está confirmado com valores específicos (por isso nunca é
 * default do sistema, sempre premissa explícita do usuário):
 * - Percentual de retenção por meio de pagamento/arranjo.
 * - Cronograma exato de entrada em vigor por modalidade (fase1/fase2/...).
 * - Relação exata entre "tributo apurado no período" e "tributo segregado
 *   a cada recebimento" fora do caso de parcelamento (item 2 acima).
 * - Prazo de disponibilidade de créditos tributários compensados via
 *   split (arquitetura preparada em tipos.ts, sem motor de compensação).
 *
 * O próprio `config/parametros.json` (bloco `splitPayment`) já documenta
 * essa incerteza (`_comentario`: "Cronograma detalhado por arranjo [...]
 * ainda depende de ato infralegal complementar — tratar como parâmetro a
 * atualizar.") — este módulo segue a mesma cautela, não a contradiz.
 */
export const PENDENTE_REGULAMENTACAO = [
  "percentual_retencao_por_arranjo_pagamento",
  "cronograma_detalhado_por_modalidade",
  "relacao_tributo_apurado_vs_segregado_fora_parcelamento",
  "prazo_disponibilidade_credito_compensado_via_split",
] as const;

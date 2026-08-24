# Motor de Split Payment / Capital de Giro

> Continuação de [motor-financeiro.md](./motor-financeiro.md). **Nenhum
> motor fiscal foi alterado. `calculo.ts` intocado.** Nenhum Motor de
> Cenários/Sensibilidade, break-even, Motor Estratégico, Score, IA ou UI.
> 441 testes passando (427 + 14 novos), `tsc` limpo. Princípio: "Split
> payment não é apenas uma questão tributária. É uma questão de
> disponibilidade financeira e capital de giro."

## A. Arquitetura

```
src/engine/motorFinanceiro/splitPayment/
  tipos.ts        — PremissasSplitPayment, ResultadoImpactoCaixa, achados
  normativa.ts    — separa regra normativa confirmada de premissa
  fluxo.ts         — fluxo atual × fluxo com split, por mês
  qualidade.ts      — qualidade determinística (alta/media/parcial/insuficiente)
  achados.ts        — fatos estruturados, nunca recomendação
  motor.ts          — calcularImpactoCaixaDoAno: orquestra tudo acima
  comparacao.ts      — indicador matemático entre regimes, nunca "recomendado"
```

Preparatório a esta fase (sem código novo de split): os três motores de
regime (`lucroPresumido/motor.ts`, `simplesNacional/nucleo.ts`,
`lucroReal/motor.ts`) passaram a popular o campo `resultadoAnoVgrOrigem`
(já declarado, nunca usado, em `ResultadoAnoRegime`) com o `ResultadoAno`
completo devolvido por `calculo.ts::simular()` — preserva
`capitalGiroLiberadoAtualMensal`/`capitalGiroPerdidoComSplitMensal`/
`splitPaymentAtivoParaMeioPredominante` já calculados pelo Motor VGR
legado, disponíveis para referência cruzada, sem que este módulo precise
duplicá-los.

## B. Fronteira Fiscal × Caixa

Este módulo **não** calcula IBS, CBS, DAS, IRPJ/CSLL, não recalcula
créditos, não determina alíquota/cClassTrib. A única entrada fiscal é
`ResultadoRegime.anos[].cargaTotal` (`tributoFiscalReferencia`) — um
número já pronto. Complementa (nunca duplica) o Motor Financeiro: onde
este responde "o que o tributo faz com o resultado" (competência), o
Motor de Split responde "quando o dinheiro fica disponível" (caixa).
`ResultadoEconomicoFinanceiro` e `ResultadoImpactoCaixa` são dimensões
diferentes do mesmo cenário — nunca fundidas em um único objeto.

## C. Regras normativas confirmadas

Ver `normativa.ts::FATOS_CONFIRMADOS`, verificado por pesquisa em
2026-08-12, não assumido de memória:

1. **LC 214/2025, art. 348** — 2026 é ano-teste: CBS/IBS simbólicos,
   compensáveis/ressarcíveis em até 60 dias.
2. **LC 214/2025, art. 34, II** — em pagamento parcelado, a segregação é
   proporcional a cada parcela na liquidação financeira.
3. A existência do mecanismo de retenção na liquidação financeira está
   prevista em lei; o detalhamento (percentuais por arranjo, cronograma
   por modalidade) depende de regulamento do Comitê Gestor do IBS ainda
   não publicado com valores definitivos.

## D. Premissas utilizadas

Nenhuma tem valor padrão do sistema (`normativa.ts::PENDENTE_REGULAMENTACAO`):
`percentualRecebimentosSujeitos`, `percentualTributoSegregado` (sobre o
recebimento, nunca sobre o tributo apurado — seção 7 do pedido),
`prazoAtualPagamentoTributosDias`, `taxaCustoCapitalMensal`,
`caixaMinimoOperacional`, `distribuicaoMensalReceita`. Toda saída que
depende de uma dessas premissas carrega `estimativaCondicionada: true` e
o achado `PREMISSA_SPLIT_NAO_CONFIRMADA` — nunca apresentada como fato.

## E. Fluxo atual

`caixaDisponivelAntesTributo = recebimentoBruto` (100% do recebimento
entra no caixa; tributo pago depois, fora do escopo deste cálculo
mensal — representado só como referência de prazo,
`prazoAtualPagamentoTributosDias`, não como um motor de contas a pagar).

## F. Fluxo com split

`parcelaSujeita = recebimentoBruto × percentualRecebimentosSujeitos`;
`valorSegregado = parcelaSujeita × percentualTributoSegregado`;
`caixaLiquido = recebimentoBruto − valorSegregado`. Testado (seção 44/45
do pedido): R$100.000 com 100% sujeito e 10% segregado → segregado
R$10.000, líquido R$90.000; com 80% sujeito × 10% → segregado R$8.000
(sobre a parcela sujeita, não sobre o total).

## G. Redução de disponibilidade de caixa

`reducaoDisponibilidadeCaixa = valorSegregado` — **nunca** chamado de
"perda" no código ou nos achados; é sempre framed como redução de
disponibilidade financeira / diferença de timing.

## H. Capital de giro adicional

`necessidadeCapitalGiro(mês) = reducaoDisponibilidadeCaixa(mês)`.
`capitalGiroAdicionalMedio` = média simples dos 12 meses.
`picoCapitalGiroAdicional` = `Math.max` dos 12 meses (nunca a soma —
seção 32/33 do pedido: somar estoque mensal como se fosse despesa
anual inflaria o número em até 12×). `mesPicoCapitalGiro` acompanha o
pico.

## I. Pico de capital

Ver H — testado explicitamente com cenário sazonal (aviação
agrícola/cerealista, receita concentrada em 2 meses de 12):
`mesPicoCapitalGiro` cai corretamente no mês de maior receita.

## J. Dias equivalentes de caixa

`diasEquivalentesCaixaPerdidos = valorTotalSegregado ÷
necessidadeMediaDiariaCaixa`, onde `necessidadeMediaDiariaCaixa =
receitaAnual ÷ 360`. Metodologia fixa e documentada — nunca um número
visual sem definição matemática (seção 15 do pedido).

## K. Custo financeiro

`custoFinanceiro(mês) = necessidadeCapitalGiro(mês) × taxaCustoCapitalMensal`,
só quando a taxa é informada — caso contrário `undefined` (nunca 0, nunca
uma taxa default), com `custoFinanceiroAnual` também `undefined` se
qualquer mês ficar sem taxa. Nunca somado à carga tributária (naturezas
diferentes — carga tributária vem só de `ResultadoRegime`, custo
financeiro é um número separado em `ResultadoImpactoCaixa`).

## L. Sazonalidade

`distribuicaoMensalReceita` (premissa opcional, 12 posições) distribui a
receita anual por mês; ausente → distribuição uniforme (1/12), sempre com
alerta explícito. Testado com um perfil de receita concentrada
representando setores como aviação agrícola/cerealista.

## M. Comparação entre regimes

`comparacao.ts::compararImpactoCaixaRegimes` produz
`regimeComMenorNecessidadeCapital` — **indicador matemático puro**,
nunca "regime recomendado". Teste obrigatório (seção 37/50 do pedido)
demonstra que um regime com tributo MENOR pode ter necessidade de
capital de giro MAIOR que um regime com tributo maior — a divergência é
preservada estruturalmente, não escondida por um ranking único, para
uso futuro do Motor Estratégico.

## N. Qualidade e ressalvas

`comparabilidadeFiscal` (herdado do Comparador Consolidado, nunca
recalculado): `comparavel_com_ressalvas` → qualidade `"media"` + alerta;
`nao_comparavel`/`indeterminado` → qualidade `"insuficiente"` + alerta
de que o resultado não deve ser lido como conclusão definitiva — o
número continua calculado e exposto, nunca escondido.

## O. Casos indeterminados

- `percentualRecebimentosSujeitos`/`percentualTributoSegregado` ausentes
  → `meses` calculados sem os campos derivados (nunca inventa 0% ou
  100%), achado `DADOS_SPLIT_INSUFICIENTES`.
- Ano indisponível (`ResultadoAnoRegime.disponivel === false`) → nunca
  tratado como zero; `disponivel: false`, `meses: []`.

## P. Limitações conhecidas

1. Modelo mensal agregado — não é um sistema de contas a receber; não
   representa parcelas/títulos individuais (seção 25 do pedido).
2. Sem carry-over entre meses: cada mês é tratado independentemente
   (nenhum "acúmulo" de necessidade de capital de giro de um mês para o
   próximo é modelado nesta fase) — decisão simplificadora explícita,
   coerente com a granularidade mensal agregada adotada.
3. Créditos tributários e seu efeito no caixa (`efeitoFinanceiroDoCredito`,
   seção 19-21 do pedido) não são simulados nesta fase — arquitetura do
   tipo `PremissasSplitPayment` está preparada para receber
   `prazoDisponibilidadeCreditos` no futuro, sem compensação automática
   hoje.
4. Multiatividade: resultado sempre consolidado, nunca rateado por
   atividade sem dado de fluxo financeiro segregado (seção 54).
5. Nenhum percentual de split tem fundamento normativo com valor fixo
   nesta fase — `estimativaCondicionada` é sempre `true` quando qualquer
   premissa de split foi usada (ver seção D).

## Q. Próxima etapa recomendada

Com TRIBUTO → RESULTADO → CAIXA consolidados, o próximo passo natural é
o **Motor de Cenários e Sensibilidade** (conservador/provável/otimizado),
seguido do Motor Estratégico — ambos fora do escopo desta fase.

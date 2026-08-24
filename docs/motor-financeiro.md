# Motor Econômico-Financeiro

> Continuação de [comparador-consolidado.md](./comparador-consolidado.md).
> **Nenhum motor fiscal foi alterado. `calculo.ts` intocado.** Nenhum
> split payment, capital de giro, Motor Estratégico, Score, IA ou UI.
> 427 testes passando (407 + 20 novos), `tsc`/lint limpos. Princípio:
> "o Motor Fiscal responde quanto a empresa paga; o Motor Financeiro
> responde o que esse pagamento faz com o resultado da empresa."

## A. Arquitetura do Motor Econômico-Financeiro

```
src/engine/motorFinanceiro/
  tipos.ts            — PremissasFinanceiras, ResultadoEconomicoFinanceiro, achados
  custos.ts            — deriva custos econômicos de CenarioEmpresa.custos.itens
  precoNecessario.ts   — fórmula ANALÍTICA fechada (nunca iterativa) + cenários de repasse
  qualidade.ts          — qualidade financeira determinística (alta/media/baixa/insuficiente)
  achados.ts            — fatos estruturados, nunca recomendação
  motor.ts              — calcularResultadoEconomicoFinanceiro: orquestra tudo acima
```

## B. Fronteira Fiscal × Financeiro

Confirmada por auditoria do próprio código: `motorFinanceiro/` **não
importa** nada de `motorRegimes/lucroPresumido`, `simplesNacional` ou
`lucroReal`, não importa `parametros.json`, não importa `calculo.ts`. A
única entrada fiscal é `ResultadoRegime.anos[].cargaTotal` — um número
já pronto. O motor nunca sabe se essa carga veio de DAS, IRPJ+CSLL ou
IBS/CBS reaproveitado do Motor VGR.

## C. Conceitos de margem utilizados

Só dois, nomeados sem ambiguidade contábil (seção 6 do pedido):
**margem** = `resultado ÷ receita`, onde `resultado = receita − custos
econômicos − carga fiscal utilizada` — nunca chamado de "margem
líquida" (isso exigiria dados que o motor não tem, como depreciação,
resultado financeiro, etc.). **Margem-alvo** = a margem que os cenários
de preservação de preço tentam restaurar (padrão: margem do ano-base).

## D. Dados econômicos necessários

Reaproveitados sem duplicação: `CenarioEmpresa.receita.faturamentoAnual`
(+ `crescimentoAnualEstimado`, mesma premissa de projeção já usada nos
três motores fiscais), `CenarioEmpresa.custos.itens` (soma direta —
`GastoInformado`/`CategoriaGasto` já existentes, `creditoTributario.ts`
intocado). Custo econômico é sempre o valor bruto do gasto,
**independente de crédito fiscal** (seção 12) — o efeito do crédito já
está embutido em `cargaTotal` do `ResultadoRegime`; somar/descontar de
novo aqui duplicaria o efeito (seção 13, testado implicitamente: os
testes de erosão de margem usam a carga fiscal como o único canal
tributário, custos nunca ajustados por crédito).

## E. Resultado atual × projetado

Ano-base = `ANOS_SIMULACAO[0]` (2026 — mesma convenção já usada no
produto para "carga atual/ano-teste"). `margemBase`/`resultadoBase` são
calculados uma vez, a partir do MESMO `ResultadoRegime` no ano-base —
todo ano seguinte é comparado contra esse ponto de partida.

## F. Cálculo de erosão da margem

`erosaoMargemPp = (margem(ano) − margemBase) × 100` — sempre em pontos
percentuais, nunca confundido com variação relativa (seção 16, testado:
carga subindo de R$100 para R$140 com receita/custos constantes produz
exatamente `-4.0` p.p., não "-16%" nem outro número).

## G. Impacto em R$

Dois indicadores **separados** (seção 18): `impactoAnualReais =
resultado(ano) − resultadoBase` (impacto econômico, sinal negativo =
perda) e `impactoTributarioReais = cargaFiscal(ano) − cargaFiscalBase`
(sinal positivo = aumento de tributo) — testado que os dois têm sinais
opostos no caso simples (carga sube 40 → impacto econômico -40) e que
podem divergir quando há crescimento de receita/custos (não testado
explicitamente nesta fase, mas a separação estrutural já permite).

## H. Preservação de margem

`precoNecessario.ts::calcularReceitaNecessariaParaMargem` — fórmula
fechada `R* = CF ÷ (1 − k − t − m)`, nunca aproximação iterativa (seção
21). Resolve corretamente o caso em que o tributo é função da receita
(seção 22, testado: a receita necessária encontrada, quando testada de
volta em `margemNaReceita`, produz exatamente a margem-alvo). Quando
`(1-k-t-m) ≤ 0`, devolve `possivel: false` com motivo — nunca um número
inventado (testado).

## I. Cálculo de reajuste médio necessário

`reajusteMedioNecessario = receitaNecessaria ÷ receitaAtual − 1` — uma
única métrica de reajuste médio equivalente sobre receita (seção 29/30
do pedido: não exige preço unitário, funciona para qualquer mix de
produtos).

## J. Cenários de repasse

Três pontos, sempre nomeados pelo percentual (seção 28): **0%** =
absorção integral (receita inalterada); **100%** = receita necessária
para restaurar a margem-alvo (definição adotada para "neutralizar o
impacto tributário", seção 25); **50%** = interpolação linear em
receita entre os dois extremos (nunca em margem diretamente — preserva
a fórmula fechada). Testado que a margem é estritamente monotônica
entre os três pontos (seção 59).

## K. Multiatividade

Testado explicitamente (seção 40/64): custos de itens que poderiam vir
de atividades diferentes são somados diretamente, sem qualquer rateio.
O motor nunca tenta produzir "margem por atividade" — isso exigiria
segregar receita E custo por atividade com confiabilidade que
`CenarioEmpresa` não garante hoje; resultado sempre consolidado.

## L. Multi-ano

8 anos (`ANOS_SIMULACAO`), cada um com seu próprio
disponível/receita/custos/carga/margem/impacto/reajuste/achados.
`impactoAcumulado` soma só os anos com `disponivel: true` —
`impactoAcumuladoParcial: true` sinaliza quando algum ano ficou de fora
(testado: um ano indisponível no meio do horizonte nunca é somado como
zero "por coincidência" — o teste usa carga constante justamente para
garantir que, se o ano ausente fosse indevidamente somado como zero,
o acumulado ficaria diferente do esperado, e ele não fica).

## M. Qualidade e ressalvas

`calcularQualidadeFinanceira` combina dois eixos independentes (seção
9/12): completude econômica (`custos.informado`) e comparabilidade
fiscal herdada do Comparador Consolidado (`comparabilidadePorAno`,
parâmetro opcional). `comparavel_com_ressalvas` → qualidade `"media"` +
alerta textual explícito; `nao_comparavel`/`indeterminado` → qualidade
`"insuficiente"` + alerta dizendo que o resultado **não deve ser lido
como conclusão definitiva** — mas o número continua sendo calculado e
exposto, nunca escondido (testado nos dois casos).

## N. Dados ainda ausentes

- Sem `crescimentoAnualEstimado`: receita e custos mantidos constantes,
  sempre com alerta explícito (mesma premissa já usada nos 3 motores
  fiscais).
- Sem `percentualCustosVariaveis`: 100% dos custos tratados como fixos
  (nunca assume proporcionalidade sem dado — seção 23), com alerta.
- Sem `margemAlvo` explícita e sem margem do ano-base disponível:
  reajuste necessário não calculado, alerta explica o motivo.

## O. Limitações conhecidas

1. **Alíquota efetiva implícita assume que a carga fiscal escala
   linearmente com a receita** ao redor do ponto atual — uma
   simplificação necessária para ter fórmula fechada (em vez de
   iterativa); válida para reajustes moderados, não para variações
   extremas de preço. Documentado no próprio código
   (`precoNecessario.ts`).
2. **Custos/despesas são projetados com a MESMA taxa de crescimento da
   receita** quando não há premissa própria de custos — decisão
   simplificadora explícita, não uma tentativa de precisão que falhou.
3. **Sem distinção de custo fixo/variável no `CenarioEmpresa`** — só
   existe via `PremissasFinanceiras.percentualCustosVariaveis`
   (estrutura complementar opcional, seção 23 do pedido); nenhuma
   extensão ao `CenarioEmpresa` foi necessária nesta fase.
4. **Comparação econômica ENTRE regimes (seção 32) não foi implementada
   como uma função dedicada** — `calcularResultadoEconomicoFinanceiro`
   já pode ser chamado uma vez por `ResultadoRegime`; produzir os três
   lado a lado é responsabilidade de quem chama (mesma composição já
   usada em `compararRegimes`/`avaliarComparacaoConsolidada`), não uma
   função nova nesta fase — evita duplicar a orquestração que o
   Comparador Consolidado já resolve.
5. **`custosDespesas: 0` (sem itens) ainda produz um resultado
   calculado** (qualidade `"insuficiente"`, não bloqueado) — decisão
   deliberada: `0` é tecnicamente um valor válido (empresa sem custo
   registrado), então o motor calcula e sinaliza qualidade baixa, em vez
   de recusar o cálculo inteiramente.

## P. Próxima etapa recomendada

Com resultado, margem, preço e impacto resolvidos de forma
determinística, o próximo passo natural (mantendo a ordem já definida)
é o **Split Payment / Capital de Giro**: hoje o Motor Financeiro só
lida com resultado de competência (receita − custo − tributo), sem
nenhuma dimensão de caixa/prazo. Antes de qualquer Motor Estratégico
poder ponderar "menor carga comparável" (Comparador Consolidado) contra
o que realmente importa para a decisão de regime, falta responder: o
resultado melhor no papel também é melhor no caixa? Essa pergunta só
pode ser respondida depois que prazos de recebimento/pagamento e o
mecanismo de retenção do split payment tiverem um modelo — ainda não
construído.

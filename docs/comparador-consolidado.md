# Comparador Consolidado dos Regimes Tributários

> Continuação de [motor-lucro-real.md](./motor-lucro-real.md).
> **Nenhum motor fiscal foi alterado** (`lucroPresumido`, `simplesNacional`,
> `lucroReal` intocados — exceto leitura de texto de alertas já
> existentes, ver seção L). **`calculo.ts` intocado. `compararRegimes`
> (comparador.ts) intocado** — este módulo é uma camada nova sobre ele,
> não uma substituição. Nenhum Motor Financeiro, recomendação, Score ou
> IA. 407 testes passando (393 + 14 novos), `tsc`/lint limpos.

## A. Arquitetura do Comparador Consolidado

```
src/engine/motorRegimes/comparadorConsolidado.ts
  avaliarComparacaoConsolidada(cenario, resultados: ResultadoRegime[]): ResultadoComparacaoConsolidado
```

Recebe os `ResultadoRegime[]` **já calculados** (tipicamente
`compararRegimes(cenario, motores).resultados`) — não chama nenhum
motor, não recalcula nada fiscal. Só interpreta o que os motores já
produziram: `aplicabilidade.status`, `anos[].disponivel`,
`anos[].componentes`, `qualidade.percentualConfirmado`, e o texto de
`alertas` que os próprios motores já escrevem (faixa 6 do Simples,
qualidade da base fiscal do Real).

## B. Definição de comparabilidade

```ts
type StatusComparabilidade = "comparavel" | "comparavel_com_ressalvas" | "nao_comparavel" | "indeterminado";
```

Nunca depende só de "tem carga?" — depende de elegibilidade jurídica,
disponibilidade do ano, cobertura de componentes, qualidade da base e
equivalência de premissas (seção 5 do pedido), avaliados nesta ordem
(cada um pode agravar o status, nunca melhorá-lo).

## C. Cobertura tributária

`componentesEsperados(regime)` é estrutural, não uma lista universal
(seção 7): Simples espera `["das", "ibs", "cbs"]`; Presumido/Real
esperam `["irpj", "csll", "pis", "cofins", "ibs", "cbs"]`.
**Deliberadamente sem ICMS/ISS** — qual dos dois se aplica depende da
atividade, e nenhum motor atual os calcula; incluí-los tornaria todo
resultado permanentemente "com ressalva" por algo que nenhum motor pode
resolver hoje (documentado no próprio código). `adicional_irpj` também
não entra nos esperados — é condicional, sua ausência nunca é "falta".

**Consequência honesta, testada**: como PIS/COFINS nunca são calculados
por nenhum motor hoje, Presumido e Real **nunca** atingem
`"comparavel"` puro — sempre `"comparavel_com_ressalvas"`, no mínimo.
Isso não é um bug do comparador; é a representação correta de uma
limitação real já documentada nas três fases anteriores.

## D. Qualidade dos resultados

`QualidadeConsolidada = "alta" | "media" | "baixa" | "insuficiente"` —
regra determinística documentada em código (seção 28 do pedido, sem
média numérica arbitrária): `insuficiente` quando o ano está
indisponível; `baixa` com mais de 1 componente material ausente;
`media` com até 1 ausente e ≥30% dos componentes confirmados; `alta`
só com cobertura completa e ≥80% confirmados. **Separada da
cobertura** (seção 12) — um regime pode ter cobertura completa e dados
estimados (`media`), ou dados excelentes com cobertura incompleta
(`baixa`); são eixos independentes na mesma estrutura.

## E. Motivos bloqueantes e ressalvas

8 códigos estruturados (seção 25 do pedido), cada um com `severidade`:

| Código | Severidade | Gatilho |
|---|---|---|
| `REGIME_INELEGIVEL` | bloqueante | `aplicabilidade.status === "inelegivel"`, ou outro regime é obrigatório |
| `ELEGIBILIDADE_INDETERMINADA` | bloqueante | `aplicabilidade.status === "indeterminado"` |
| `PERIODO_INCOMPATIVEL` | bloqueante | `anos[ano].disponivel === false` |
| `COMPONENTE_SEGREGADO_NAO_CALCULADO` | bloqueante | alerta de faixa 6 do Simples presente naquele ano |
| `QUALIDADE_INSUFICIENTE` | bloqueante | alerta "Qualidade da base fiscal: insuficiente" (Real) |
| `COMPONENTE_MATERIAL_AUSENTE` | ressalva | componente esperado não está em `componentes` |
| `BASE_FISCAL_PARCIAL` | ressalva | alerta "parcial"/"estimada" (Real) |
| `RECEITAS_NAO_EQUIVALENTES` | ressalva | `premissas.crescimentoAnualEstimado` diverge entre os resultados comparados |

Bloqueante sempre leva a `nao_comparavel`/`indeterminado`; ressalva leva
a `comparavel_com_ressalvas` sem excluir do ranking (seção 27).

## F. Tratamento de elegibilidade/obrigatoriedade

Testado nos dois sentidos exigidos: quando um regime é `"obrigatorio"`,
todos os outros são marcados `nao_comparavel` com motivo explícito
("Outro regime é juridicamente obrigatório...") e excluídos do ranking
— **mesmo que tenham um número artificialmente menor** (teste com
Presumido/Simples fake em R$ 1.000 vs. Real obrigatório em R$ 200.000:
o ranking é só `["lucro_real"]`). Quando a elegibilidade é
`"indeterminado"`, o regime nunca aparece no ranking, mesmo tendo um
resultado numérico calculado.

## G. Como `regimeMenorCarga` passou a ser definido

**`compararRegimes.regimeMenorCarga` não foi alterado** — continua
existindo, com o mesmo comportamento (redução ingênua sobre
`cargaTotalPeriodo` dos regimes calculados). Ele deve agora ser lido
como **"menor carga calculada"** — um diagnóstico interno, nunca uma
conclusão executiva (seção 16 do pedido). Este módulo introduz
`ComparacaoAno.menorCargaComparavel`, calculado **só** entre os
candidatos que passaram por toda a avaliação de comparabilidade —
esse é o único campo seguro para qualquer leitura futura. Os dois
podem apontar para regimes diferentes (testado: o caso da faixa 6 do
Simples tem um "menor calculado" que não é o "menor comparável").

## H. Ranking tributário

`ComparacaoAno.rankingTributario: Regime[]` — só regimes
`comparavel`/`comparavel_com_ressalvas`, ordenado por `cargaConhecida`
(arredondada a centavos antes de comparar, seção 51). Chamado
`rankingTributario`, nunca `rankingEstrategico` (seção 35). Testado com
3, 2, 1 e 0 regimes comparáveis.

## I. Tratamento multi-ano

`ResultadoComparacaoConsolidado.porAno: ComparacaoAno[]` — um item por
ano de `ANOS_SIMULACAO`, avaliado **independentemente** (seção 4).
Testado: um regime disponível em 2026/2027 mas indisponível em 2028
aparece no ranking nos dois primeiros anos e fica de fora em 2028, com
`PERIODO_INCOMPATIVEL` explicando o motivo — nunca uma decisão "para
todo o horizonte" a partir de um único ano.

## J. Casos de incomparabilidade — exemplos testados

- **Faixa 6 do Simples**: DAS aparentemente baixo não vence o ranking;
  excluído com `COMPONENTE_SEGREGADO_NAO_CALCULADO`.
- **Empate**: duas cargas comparáveis idênticas (após arredondamento a
  centavos) → `empate: true`, `regimesEmEmpate` com os dois,
  `menorCargaComparavel: undefined` — nunca escolhido arbitrariamente.
- **Ruído de ponto flutuante**: diferença de fração de centavo é tratada
  como empate (testado com `100_000.001` vs. `100_000.004`); uma
  diferença real de 1 centavo já decide um vencedor — precisão
  centralizada em `arredondarCentavos`, sem depender de comparação de
  `number` bruta.

## K. Exemplos com os três regimes

Testado com `motorLucroPresumido` + `motorSimplesUnificado` +
`motorLucroReal` reais (não fakes) rodando sobre o mesmo `CenarioEmpresa`,
via `compararRegimes` seguido de `avaliarComparacaoConsolidada` — confirma
que a composição das duas camadas funciona de ponta a ponta, não só em
isolamento com dados fabricados.

## L. Limitações conhecidas

1. **Detecção de faixa 6 e qualidade da base fiscal depende de texto de
   alerta já escrito pelos motores** (`"faixa 6"`, `"Qualidade da base
   fiscal:"`) — funciona porque o texto é escrito de forma consistente
   nos próprios motores, mas é um acoplamento textual, não um campo
   estruturado dedicado no `ResultadoRegime`. Alternativa mais robusta
   (um campo estruturado em `ResultadoAnoRegime` para "componentes
   segregados conhecidos") não foi criada nesta fase para não alterar o
   contrato central sem necessidade comprovada (seção 2/52 do pedido) —
   fica como candidato a extensão futura se o acoplamento textual se
   revelar frágil.
2. **RECEITAS_NAO_EQUIVALENTES só compara `premissas.crescimentoAnualEstimado`**
   — não compara a receita-base em si (hoje sempre a mesma, porque os
   três motores leem do mesmo `CenarioEmpresa.receita.faturamentoAnual`)
   nem outras premissas (crédito, folha, preço) — não existem ainda
   para comparar (Motor Financeiro/Cenários são fases futuras).
3. **ICMS/ISS nunca entram em `componentesEsperados`** — decisão
   deliberada (seção C), não uma omissão.
4. **Ranking por atividade não existe** — corretamente: a decisão é
   sempre no nível consolidado da empresa (seção 20 do pedido); os
   resultados `porAtividade` de cada motor continuam existindo para
   explicar composição, mas nunca alimentam este comparador diretamente.

## M. Próxima etapa recomendada

Com comparabilidade, cobertura e qualidade formalizadas e testadas para
os três regimes reais, o próximo passo natural — mantendo a ordem já
definida — é o **Motor Econômico-Financeiro**: hoje o comparador só
lida com carga tributária (`cargaConhecida`, `percentualSobreReceita`).
Margem, caixa e preço são necessários antes que qualquer Motor
Estratégico possa ponderar "menor carga comparável" contra os demais
fatores que decidem qual regime é realmente melhor para a empresa — não
só tributariamente mais barato.

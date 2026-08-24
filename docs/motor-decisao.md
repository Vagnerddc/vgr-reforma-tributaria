# Motor de Recomendação / Decisão Estratégica Determinística

> Continuação de [motor-estrategico.md](./motor-estrategico.md).
> **Nenhum motor fiscal/financeiro/caixa/cenários/pontos-de-virada/achados/
> estratégico foi alterado. `calculo.ts` intocado.** Nenhuma IA, Score,
> plano de ação ou otimização multidimensional. 527 testes passando (511
> + 16 novos), `tsc` limpo. Princípio: "A inteligência desta camada não
> está em sempre escolher uma alternativa. Está em saber distinguir
> corretamente entre preferência robusta, preferência condicionada,
> conflito, equivalência, obrigação jurídica e dados insuficientes."

## A. Arquitetura

```
src/engine/motorDecisao/
  tipos.ts          — ResultadoDecisaoEstrategica, Dominancia, StatusConclusao
  dominancia.ts       — comparação por dimensão, sem peso/score
  regime.ts              — decidirRegimeTributario (família prioritária)
  temporal.ts               — decidirRegimeTributarioNoHorizonte (2026-2033)
  precoFatorR.ts               — decidirRecomposicaoPreco / decidirFatorR
  motor.ts                       — decidir(): ponto de entrada único
```

Fluxo: `ResultadoCenario` (Motor de Cenários) + `PlanoAlternativasEstrategicas`
(Motor Estratégico, opcional) + `ResultadoPontoVirada[]` (opcional) →
Motor de Decisão → `ResultadoDecisaoEstrategica`. Nenhum acesso direto a
tabelas fiscais, `parametros.json` ou fórmulas de margem/capital de
giro — só leitura de números já calculados por `ResumoComparativoRegimeAno`
(Comparador Consolidado), `ResultadoAnoEconomicoFinanceiro` (Motor
Financeiro) e `ResultadoImpactoCaixa` (Split Payment).

## B. Diferença entre Alternativa e Recomendação

O Motor Estratégico produz `AlternativaEstrategica` — "isso pode ser
avaliado". O Motor de Decisão produz `ResultadoDecisaoEstrategica` —
"o conjunto de evidências permite preferir uma dessas alternativas, e
sob quais condições?". Nenhum dos dois produz uma ordem ("faça X") —
mesmo `preferencia_tecnica_robusta` é redigido como "apresenta
preferência técnica nas condições analisadas", nunca "é definitivamente
a melhor" (seção 53, testado explicitamente contra lista de termos
prescritivos).

## C. Contratos

`ResultadoDecisaoEstrategica` (tipos.ts) — `statusConclusao`,
`naturezaConclusao`, `alternativaPreferida?`, `alternativasEquivalentes[]`,
`evidenciasFavoraveis[]`/`evidenciasContrarias[]` (nunca só um lado —
seção 37/38), `conflitos[]`, `bloqueios[]`/`riscos[]` (sempre
separados — seção 32), `condicoes[]` (estruturadas, nunca só texto —
seção 56), `pontosViradaRelacionados[]`, `horizonte?`,
`razoesConclusao[]` (códigos, seção 51), `justificativaEstruturada`
(template determinístico, nunca fonte da verdade — seção 52).
`AvaliacaoAlternativa` — uma entrada por regime/alternativa candidata,
com `dominancia` par-a-par.

## D. Status de conclusão

7 estados (seção 5): `sem_conclusao`, `dados_insuficientes`,
`bloqueado`, `alternativas_equivalentes`, `conflito_nao_resolvido`,
`preferencia_tecnica_condicionada`, `preferencia_tecnica_robusta`.
`preferencia_tecnica_robusta` só quando existe um candidato que domina
TODOS os demais (seção 6) e a qualidade consolidada não é
`"insuficiente"`. `preferencia_tecnica_condicionada` quando a dominância
existe mas depende de uma condição estruturada explícita (seção 7,
`condicaoDeProximidade`, só ativa quando `margemMaterialidadeProximidade`
é informado — seção 25, nunca um threshold "perto" inventado por
default).

## E. Natureza jurídica × preferência técnica

`NaturezaConclusao` (`obrigacao_juridica` | `preferencia_tecnica`) é um
campo SEPARADO de `statusConclusao` (seção 32). Quando um regime é
`statusJuridico === "obrigatorio"` no Comparador Consolidado, a decisão
retorna imediatamente com `naturezaConclusao: "obrigacao_juridica"` —
nenhuma comparação de dominância é executada (seção 31, testado: seção
65).

## F. Dimensões avaliadas

Fiscal (`cargaConhecida`, menor melhor), Econômica
(`resultadoLiquido = resultado − custoFinanceiroAnual`, maior melhor —
combinação aritmética de DOIS números já calculados por motores
distintos, nunca uma fórmula nova, seção 22/47), Caixa
(`picoCapitalGiroAdicional`, menor melhor). Cada dimensão usa sua
própria tolerância (`dominancia.ts`, `arredondarCentavos` para R$) —
nunca uma tolerância única para tudo (seção 30, mesma disciplina já
usada no Comparador Consolidado).

## G. Dominância

`calcularDominancia` (dominancia.ts) — `domina`/`dominado`/`conflitante`/
`equivalente`/`incomparavel`, SEM peso/score (seção 17-19, testado:
nenhum campo numérico de "prioridade" existe no contrato).
Dimensão indisponível (`valorA`/`valorB` ausente) nunca conta como
empate — é excluída do cálculo (seção 20, testado: caixa indisponível
não aparece como "equivalente").

## H. Conflitos

`conflito_nao_resolvido` só quando NENHUM candidato domina todos os
demais E as comparações par-a-par não são todas `equivalente`/
`incomparavel` (seção 8/46). O relatório lista, por regime, carga/
resultado líquido/capital de giro — nunca escolhe um vencedor
arbitrário (seção 61, testado: seção 63).

## I. Condições

`CondicaoDecisao` estruturada (`descricao`, `variavel`, `limite`,
`origemPontoVirada`) — só emitida quando há `ResultadoPontoVirada`
relevante E `margemMaterialidadeProximidade` foi informado
explicitamente (seção 25/68). Sem esse parâmetro, a distância ao ponto
de virada é só registrada em `pontosViradaRelacionados`, sem rebaixar o
status (testado: seção 70).

## J. Pontos de virada

`pontosViradaRelacionados` reusa `ResultadoPontoVirada` (motorPontosVirada)
diretamente — nunca recalcula limiar. Funciona como medida de robustez
(seção 24): quando informados, alimentam a condição estruturada de
`preferencia_tecnica_condicionada`.

## K. Sensibilidade

Não implementado como um mecanismo separado nesta fase — a robustez já
é obtida via pontos de virada (que são o resultado de uma busca
numérica sobre a mesma variável). `DECISAO_SENSIVEL_A_CUSTO_CAPITAL`/
`DECISAO_SENSIVEL_A_FATURAMENTO` estão declarados em
`CodigoRazaoConclusao` para uso futuro quando a integração com
`executarSensibilidade` (motorCenarios) for adicionada.

## L. Horizonte temporal

`decidirRegimeTributarioNoHorizonte` (temporal.ts) chama
`decidirRegimeTributario` ANO A ANO (2026-2033) — nunca uma segunda
lógica de comparação. `conclusaoHorizonte`
(`preferencia_estavel_no_horizonte`/`preferencia_muda_no_horizonte`/
`sem_preferencia_unica`) nunca esconde mudança temporal (seção 27-30,
testado: seção 71 — transições registradas com ano antes/depois e
alternativa antes/depois).

## M. Qualidade

Herdada do PIOR `qualidadeConsolidada` entre os candidatos comparáveis
(seção 35, testado: seção 73) — `"insuficiente"` nunca produz
`preferencia_tecnica_robusta`/`condicionada` (rebaixa para
`dados_insuficientes`).

## N. Bloqueios e riscos

`bloqueios[]` só contém regimes excluídos por comparabilidade/elegibilidade
— nunca aparecem em `riscos[]` (seção 32/74, testado). `riscos[]` nesta
fase só é populado pelas decisões de preço/Fator R (reaproveitando
`AlternativaEstrategica.riscos`, seção 33) — a decisão de regime não gera
risco próprio nesta fase (limitação, ver seção R).

## O. Decisão por regime

`decidirRegimeTributario` — 10 passos lógicos (nunca pontuação, seção
43/44): obrigatoriedade → filtra inelegíveis/não-comparáveis → único
candidato → dominância par-a-par → vencedor global (robusta/condicionada)
→ equivalência → conflito. Nunca usa `regimeMenorCarga` bruto — sempre
`ResumoComparativoRegimeAno`/`menorCargaComparavel` (seção 14).

## P. Demais famílias implementadas

`decidirRecomposicaoPreco`/`decidirFatorR` (precoFatorR.ts) — leem a
`AlternativaEstrategica` correspondente do Motor Estratégico e produzem
`preferencia_tecnica_condicionada` (nunca "reajuste recomendado" ou
"aumentar pró-labore" — testado textualmente) ou `sem_conclusao` quando
a alternativa não existe, ou `bloqueado` quando ela já carrega bloqueio.

## Q. Testes

Seções 62-79 do pedido — 16 testes em
`src/engine/motorDecisao/__tests__/regime.test.ts`: dominância clara,
trade-off não resolvido, trade-off resolvido pelo resultado líquido,
obrigatoriedade, inelegibilidade, comparabilidade insuficiente,
preferência condicionada (com e sem parâmetro de materialidade),
robustez sem threshold subjetivo, mudança temporal, equivalência,
qualidade nunca promovida, bloqueio ≠ risco, ausência de alternativa
aplicável, determinismo, ausência de linguagem prescritiva.

## R. Limitações conhecidas

1. **Decisão de regime não gera `Risco` próprio** — só bloqueios. Uma
   extensão natural seria sinalizar `RISCO_TRIBUTARIO`/`RISCO_CAIXA`
   quando a preferência é condicionada, reaproveitando o mesmo
   vocabulário já usado em `motorEstrategico/tipos.ts`.
2. **Sensibilidade (seção 26)** não tem um conversor dedicado
   (`RESULTADO_SENSIVEL_A_VARIAVEL` → `DECISAO_SENSIVEL_A_*`) — os
   códigos existem no contrato, mas a integração com
   `executarSensibilidade` não foi construída nesta fase.
3. **`AVALIAR_ESTRUTURA_CREDITOS`/`AVALIAR_CAPITAL_GIRO`/`AVALIAR_CUSTO_FINANCEIRO`**
   (demais famílias do Motor Estratégico) não têm decisão dedicada
   nesta fase — só regime, preço e Fator R, conforme priorizado
   explicitamente na instrução (seção 12: "priorizar... e uma ou duas
   decisões adicionais simples").
4. **`ObjetoDecisao`** está fechado a 3 valores
   (`regime_tributario`/`recomposicao_preco`/`fator_r`) — extensível
   por construção (mesmo padrão de catálogo por objeto, seção 41), mas
   as demais famílias declaradas na instrução (`estrutura_creditos`,
   `capital_giro`, `custo_financeiro`, `cenario`) não foram adicionadas.

## S. Próxima etapa recomendada

Com uma camada de decisão determinística madura — capaz de distinguir
preferência robusta, condicionada, conflito, equivalência, obrigação e
dados insuficientes —, a próxima camada (fora do escopo desta fase) é a
IA Consultiva, com a regra fundamental já fixada pela instrução: a IA
não decide, apenas explica/contextualiza/comunica uma decisão já
estruturada deterministicamente por este motor.

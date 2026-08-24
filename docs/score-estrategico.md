# Score Estratégico Auditável

> Continuação de [plano-acao.md](./plano-acao.md). **Nenhum motor
> determinístico foi alterado nem importa este módulo** (verificado por
> grep). `calculo.ts` intocado. Nenhuma IA, otimização multidimensional
> ou UI. 584 testes passando (567 + 17 novos), `tsc` limpo. Princípio:
> "O Motor de Decisão determina qual conclusão é defensável. O Score
> Estratégico sintetiza quão favoráveis, robustas e confiáveis são as
> dimensões que sustentam essa conclusão." — nunca o contrário.

## A. Objetivo do Score Estratégico

Responder "quão sólida é esta alternativa, considerando as dimensões
já analisadas?" — nunca "qual alternativa escolher?" (isso permanece
exclusivamente com `motorDecisao`). O Score é síntese de evidências já
produzidas; não é uma nova fonte de verdade (seção 1).

## B. Relação Score × Motor de Decisão

`motorDecisao` e `scoreEstrategico` leem os MESMOS fatos por contratos
DIFERENTES — podem coincidir, mas o Score nunca alimenta a decisão de
volta, e a decisão nunca é ajustada para "caber" no Score (seção 47/49).
`coerencia.ts::validarCoerenciaScoreDecisao` detecta divergência
(`INCONSISTENCIA_SCORE_DECISAO`) sem jamais alterar
`ResultadoDecisaoEstrategica` — testado explicitamente (seção 97: a
decisão permanece idêntica após a validação).

## C. Metodologia V1

`metodologia.ts::VGR_SCORE_V1` — 6 dimensões, pesos explícitos que somam
exatamente 1, `regraCoberturaMinima: "todas_dimensoes_calculadas"`.
`validarMetodologia` roda em TODA chamada do motor (nunca confia em uma
metodologia não validada) e rejeita: soma de pesos ≠ 1, peso negativo,
peso de dimensão inexistente (seção 31/100-102, testado).
Explicitamente documentada como primeira versão, não definitiva (seção
29).

## D. Dimensões

`fiscal`, `economica`, `financeira` (normalização relativa entre
regimes comparáveis do mesmo cenário/ano — seção 36/37), `robustez`
(pontos de virada já calculados), `qualidade_informacao` (regra fixa,
NUNCA relativa — seção 40), `aplicabilidade` (maturidade jurídica para
decisão/execução, NUNCA benefício — seção 6/24). Cada dimensão retorna
`status` (`calculado`/`parcial`/`indeterminado`/`nao_aplicavel`/
`bloqueado`) — zero é sempre um VALOR, nunca um substituto de
indisponibilidade (seção 8/9, testado nas seções 89/90/91/93).

## E. Indicadores utilizados

Fiscal: `cargaConhecida` (Comparador Consolidado). Econômica:
`resultado`/`margem` (Motor Financeiro). Financeira: `picoCapitalGiroAdicional`/
`custoFinanceiroAnual` (Split Payment). Robustez:
`ResultadoPontoVirada.valorEncontrado` (Motor de Pontos de Virada).
Qualidade: `qualidadeConsolidada`/`cobertura` (Comparador Consolidado).
Aplicabilidade: `statusJuridico`/`status` de comparabilidade. Nenhum
desses valores é recalculado — só lido.

## F. Normalização

`normalizacao.ts::normalizarRelativo` — melhor valor observado → 100,
pior → 0, só entre regimes efetivamente comparáveis do mesmo
cenário/ano (seção 39). Precisão em centavos (tolerância 0,01) — valores
empatados dentro da tolerância recebem o MESMO score (seção 41, testado
implicitamente pela mesma disciplina do Comparador Consolidado). Com
menos de 2 candidatos comparáveis, a dimensão NUNCA gera ranking
fictício — fica `nao_aplicavel` com a evidência objetiva preservada
(seção 42/93, testado).

## G. Pesos

Só existem em `metodologia.ts` — nenhum peso hardcoded espalhado por
`dimensoes/*.ts` ou `motor.ts` (seção 27). `consolidacao.ts` lê os
pesos exclusivamente da `MetodologiaScore` recebida.

## H. Cobertura mínima

`consolidarScore` só produz `scoreConsolidado` numérico quando TODAS as
dimensões materiais (as que não são `nao_aplicavel`, ex.: obrigatoriedade)
estão `"calculado"` — nenhuma dimensão indisponível tem seu peso
redistribuído silenciosamente para as demais (seção 32/34). Caso
contrário, `scoreConsolidado: undefined` e `statusConsolidado`
`"parcial"` (alguma dimensão calculada) ou `"indeterminado"` (nenhuma).

## I. Tratamento de dados ausentes

Preferência conservadora (seção 33): ausência de dado nunca é
convertida em precisão fabricada. Testado em cascata: sem premissa de
split → financeira `"indeterminado"` (nunca 0); sem `resultado`
econômico → economica `"indeterminado"`; regime inelegível →
`aplicabilidade: "nao_aplicavel"`.

## J. Qualidade

`dimensoes/qualidade.ts` usa um MAPEAMENTO FIXO (`alta=100, media=66,
baixa=33, insuficiente=indeterminado`) — nunca normalização relativa
entre alternativas (seção 40, testado: seção 88, qualidade baixa nunca
"vence" por comparação). A qualidade GERAL do `ScoreEstrategico` é a
PIOR entre as dimensões efetivamente `"calculado"` — nunca superior ao
elo essencial mais fraco (seção 68, testado: seção 106).

## K. Aplicabilidade jurídica

Nunca tratada como vantagem (seção 6): regime obrigatório produz
`aplicabilidade: "nao_aplicavel"` com evidência explícita ("obrigatoriedade
não é vantagem") e um alerta no `ScoreEstrategico`; regime inelegível
produz o mesmo status, sem participar de nenhuma comparação relativa
(seção 43/44/90/91, testado).

## L. Robustez e sensibilidade

`dimensoes/robustez.ts` — nunca inventa o que significa "próximo"
(seção 20/25): só produz `valor` numérico quando o CHAMADOR fornece
`distanciasRelativas` (fração 0-1 já calculada externamente, pois cada
variável exige sua própria noção de distância relativa — seção 21, não
uma fórmula universal). Sem esse parâmetro, a dimensão fica `"parcial"`
com a distância objetiva (o próprio ponto de virada) preservada como
evidência, nunca classificada (testado: seção 94/95).

## M. Pontos de virada

Sempre lidos de `ResultadoPontoVirada` (motorPontosVirada) já
calculado — nunca uma nova busca. `evidencias`/`indicadores` da
dimensão de robustez referenciam a variável e o valor encontrado,
nunca reformulam o cálculo.

## N. Consolidação

`consolidacao.ts::consolidarScore` — soma ponderada
`Σ (valor_dimensão × peso_dimensão)`, só quando a cobertura mínima é
satisfeita. `ExplicacaoScore` (`principaisFatoresPositivos`/
`principaisFatoresLimitantes`/`dimensoesIndisponiveis`) é derivada
deterministicamente dos mesmos valores — limiares (65/40) documentados
no próprio código, nunca ocultos.

## O. Coerência com Motor de Decisão

`coerencia.ts` — só avalia quando `decisao.alternativaPreferida` existe
(seção 51: em conflito/equivalência/dados insuficientes não há
preferência para comparar, então divergência de scores é esperada e
NUNCA gera achado de inconsistência). Quando há preferência e o maior
`scoreConsolidado` aponta para outra alternativa, gera
`INCONSISTENCIA_SCORE_DECISAO` — a decisão nunca é tocada (testado:
seção 97, `decisao.alternativaPreferida` permanece idêntico após a
chamada).

## P. Versionamento

`ScoreEstrategico.metodologiaId`/`metodologiaVersao` sempre presentes
(seção 69/103). `contextHash` (hash simples, não criptográfico) rastreia
os dados que alimentaram o score, preparado para cache/auditoria futura
(seção 71), sem infraestrutura de cache implementada ainda.

## Q. Testes

Seções 86-107 do pedido — 17 testes em
`src/engine/scoreEstrategico/__tests__/motor.test.ts`: composição
dimensional visível mesmo com divergência fiscal×caixa, qualidade
separada de desempenho, dimensão indisponível nunca zero, regime
inelegível/obrigatório nunca vira vantagem, alternativa única sem
ranking fictício, robustez com e sem parâmetro de distância,
inconsistência Score×Decisão detectada sem alterar a decisão, conflito
não gera achado de inconsistência, metodologia inválida rejeitada
(soma de pesos, peso negativo, peso de dimensão inexistente),
determinismo, cobertura sem dado econômico, qualidade nunca superior
ao pior componente, ausência de linguagem de recomendação.

## R. Limitações conhecidas

1. **Score por família além de regime tributário** (seção 76-78:
   recomposição de preço, Fator R) não foi implementado nesta fase —
   a V1 prioriza exclusivamente o Score entre alternativas de regime
   tributário, conforme explicitamente pedido (seção 78). A
   arquitetura (`dimensoes/*.ts` genéricas sobre `IndicadoresRegime`)
   não impede a extensão, mas exigiria coletores próprios para outras
   famílias.
2. **Score temporal (série 2026-2033) não tem uma função agregadora
   dedicada** — `gerarScoresEstrategicos` já é parametrizado por `ano`
   (seção 12/13/72/74), então uma série é obtida chamando a função uma
   vez por ano; nenhuma função "resumo do horizonte" foi construída
   nesta fase (decisão deliberada: evita esconder mudança temporal em
   uma média, seção 13).
3. **Robustez depende de um parâmetro externo (`distanciasRelativas`)**
   que este módulo não calcula — nenhuma fórmula "distância relativa
   universal" foi criada (seção 20/21), então a dimensão fica
   `"parcial"` sempre que o chamador não fornecer esse dado já
   calculado por uma camada apropriada (ex.: `motorPontosVirada` ou
   `motorCenarios`).
4. **Benchmark setorial/absoluto está fora de escopo** (seção 38) —
   toda normalização é relativa entre alternativas do mesmo cenário;
   comparar scores entre empresas diferentes não é suportado nem
   pretendido nesta versão (seção 37).

## S. Próxima etapa recomendada

Com achados, alternativas, decisões, explicações, ações e agora um
score auditável multidimensional todos rastreáveis aos motores
originais, a próxima camada fora de escopo desta fase — Otimização
Multidimensional — pode buscar combinações de preço/créditos/folha/
regime/margem/capital dentro de restrições jurídicas explícitas,
usando os mesmos contratos (`ResultadoCenario`, `ScoreEstrategico`,
`ResultadoDecisaoEstrategica`) como insumo, sem que nenhum deles precise
ser recalculado ou alterado.

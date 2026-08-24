# Motor de Pontos de Virada

> Continuação de [motor-cenarios.md](./motor-cenarios.md). **Nenhum motor
> fiscal/financeiro/caixa/cenários foi alterado. `calculo.ts` intocado.**
> Nenhum Motor Estratégico, otimização multidimensional, IA ou Score. 485
> testes passando (471 + 14 novos), `tsc` limpo. Princípio: "O Motor de
> Cenários responde 'o que acontece se X mudar?'. O Motor de Pontos de
> Virada responde 'em qual valor de X o resultado muda?'. Ele ainda não
> responde 'qual valor devemos escolher?'."

## A. Arquitetura

```
src/engine/motorPontosVirada/
  tipos.ts       — DefinicaoPontoVirada, ResultadoPontoVirada, achados
  precisao.ts     — tolerância por variável (moeda ≠ percentual)
  estado.ts        — extratores de estado/métrica a partir de ResultadoCenario
  analitico.ts      — Fator R e margem: reuso de fórmulas fechadas já existentes
  numerico.ts        — varredura + bisseção sobre ESTADO (nunca sobre carga)
  achados.ts          — fatos estruturados, nunca recomendação
  motor.ts             — buscarPontoVirada + buscarMudancaTemporal
```

Fluxo: `Variável + Intervalo` → (analítico, quando existe fórmula fechada)
OU (varredura inicial via `executarCenario`/`alteracaoParaVariavel`,
reaproveitados de `motorCenarios/`, nunca reimplementados) → detecção de
transição de estado → bisseção → `ResultadoPontoVirada`. **Nenhuma
fórmula fiscal/econômica/financeira vive em `motorPontosVirada/`.**

## B. Tipos de ponto suportados

`break-even` é um subtipo dentro de um domínio mais amplo (seção 2 do
pedido). Implementados nesta fase: `mudanca_regime_menor_carga`,
`mudanca_anexo_simples`, `cruzamento_fator_r` (analítico),
`preservacao_margem`/`margem_zero` (analíticos), `igualdade_resultado_economico`,
`igualdade_custo_financeiro`, `limite_capital_giro`,
`mudanca_elegibilidade`. `mudanca_temporal` é tratado por uma função
separada (`buscarMudancaTemporal`) — não há "variável contínua" entre
anos discretos.

## C. Variáveis suportadas

As mesmas `VariavelSensibilidade` já definidas em
`motorCenarios/sensibilidade.ts` (faturamento, crescimento,
creditosIbsCbs, custosFixos, folha, custoCapital,
percentualRecebimentosSujeitosSplit, percentualTributoSegregadoSplit) —
nenhuma variável normativa (alíquota legal, limite do Fator R, faixa do
Simples) é exposta como variável empresarial (seção 7). O limite do
Fator R é usado como CONSTANTE de referência (`LIMITE_FATOR_R`), nunca
como algo que o usuário "altera".

## D. Condições suportadas

Estados categóricos (nunca strings livres): regime (`menorCargaComparavel`),
anexo (`anexo_iii`/`anexo_v`), status jurídico (`elegivel`/`inelegivel`/
`obrigatorio`/...), e igualdades numéricas reduzidas a 3 estados
(`${regimeA}_maior` / `empate` / `${regimeB}_maior`, com empate decidido
em CENTAVOS — mesma disciplina de `comparadorConsolidado.ts::arredondarCentavos`,
reaplicada em `precisao.ts::arredondarCentavos`, nunca uma regra nova
conflitante).

## E. Soluções analíticas reutilizadas

1. **Fator R** (`cruzamento_fator_r`): `calcularFs12NecessariaAnalitica`
   chama `calcularRbt12MensalDoAno` (rbt12.ts) e usa a constante
   `LIMITE_FATOR_R` (normativa.ts) — a MESMA fórmula que
   `fatorR.ts::calcularFatorRDoAno` usa internamente
   (`fs12NecessariaParaLimite = rbt12 × LIMITE_FATOR_R.valor`). Zero
   busca numérica, zero iterações (testado: `iteracoes === 0`).
2. **Preservação de margem / margem zero** (`preservacao_margem`/
   `margem_zero`): chama `executarCenario` com `premissasFinanceiras.margemAlvo`
   e lê `reajusteMedioNecessario`/`cenariosRepasse` — já produzidos por
   `calcularReceitaNecessariaParaMargem` (motorFinanceiro/precoNecessario.ts).
   Testado: o valor retornado é IDÊNTICO ao do Motor Financeiro, nunca
   recalculado.

## F. Busca numérica

`numerico.ts`: `amostrarIntervalo` (varredura inicial, N amostras
configurável, default 9) → `detectarTransicoes` (compara estado entre
amostras consecutivas) → `refinarBissecao` (encolhe o intervalo mantendo
sempre um lado com cada estado, até a precisão solicitada). Usada para
todos os tipos exceto os analíticos (seção C/E).

## G. Tratamento de descontinuidades

O motor nunca interpola carga entre Anexo III/V ou entre regimes — a
bisseção opera sobre ESTADO (string), não sobre um número interpolável.
`estadoAntes`/`estadoDepois` sempre preservam o `ResultadoCenario`
completo de cada lado da fronteira (testado: seção 55, Fator R).

## H. Múltiplos pontos

Se a varredura inicial detectar MAIS DE UMA transição de estado,
`status: "multiplos_pontos"` e `outrosPontos` lista todos os intervalos
candidatos — nenhum é assumido como "o" ponto (nenhum refinamento
automático do primeiro). Se o refinamento encontrar um TERCEIRO estado
no meio do intervalo (nem o de `a` nem o de `b`), interrompe com
`resultado_indeterminado` — nunca assume monotonicidade (seção 11/22).

## I. Elegibilidade e obrigatoriedade

`mudanca_elegibilidade` usa o mesmo `statusJuridico` já produzido por
`avaliarComparacaoConsolidada` — quando o Simples cruza o limite de
receita, o estado muda de `"elegivel"` para `"inelegivel"` e é tratado
como uma fronteira jurídica de pleno direito (testado: seção 59,
transição localizada exatamente perto do limite legal de receita bruta
do Simples).

## J. Comparabilidade

`mudanca_regime_menor_carga` lê `menorCargaComparavel` — que já é
`undefined` quando a comparabilidade desaparece (herdado de
`avaliarComparacaoConsolidada`, nunca recalculado aqui). Uma transição
envolvendo esse `undefined` produz alerta explícito: "a fronteira é entre
determinado/indeterminado, não necessariamente entre dois regimes"
(testado: seção 58, faturamento perto do limite de faixa segregada do
Simples).

## K. Precisão

`precisao.ts::PRECISAO_PADRAO` — tolerância monetária (R$ 10 para
faturamento/folha) SEPARADA de tolerância fracionária (0,0001–0,01 para
taxas/percentuais/fatores) — nunca uma tolerância única.

## L. Performance

`iteracoes` é sempre reportado em `ResultadoPontoVirada` (0 para
soluções analíticas). Limite de 60 iterações de bisseção
(`numerico.ts::MAX_ITERACOES`) — se não convergir,
`resultado_indeterminado` com motivo explícito, nunca um loop
indefinido (seção 46).

## M. Auditabilidade

Cada resultado preserva `intervaloOriginal`, `intervaloFinal`,
`precisao`, `estadoAntes`/`estadoDepois` (cada um com o
`ResultadoCenario` completo), `cenarioNoPonto`, `premissas` e `alertas`
— nunca só o número (seção 33/49). Determinismo testado explicitamente
(seção 48): mesma entrada produz o mesmo `valorEncontrado`.

## N. Testes executados

Seções 51-62 do pedido, mais determinismo e validação de intervalo —
14 testes, todos em `src/engine/motorPontosVirada/__tests__/motor.test.ts`.
Resultados reais observados (não apenas os ramos permissivos dos
testes): faturamento cruzando a faixa segregada do Simples (~R$
4,7M) produz alerta de região indeterminada; elegibilidade do Simples
muda exatamente perto do limite legal de receita bruta (~R$ 4,8M);
Fator R resolvido analiticamente com 0 iterações.

## O. Limitações conhecidas

1. **Uma variável por busca** (seção 63) — nenhuma otimização/busca
   multidimensional. Combinações manuais continuam possíveis via
   `motorCenarios` (`AlteracoesCenario` com vários campos), mas o Motor
   de Pontos de Virada sempre varia um único eixo.
2. **`igualdade_custo_financeiro`/`igualdade_resultado_economico`**
   exigem que AMBOS os regimes tenham a métrica disponível no ano — se
   um regime não a calcula (ex.: caixa indisponível), o estado fica
   `undefined` naquele ponto, tratado como região indeterminada.
3. **`mudanca_temporal`** não busca "quando exatamente" dentro de um
   ano — só identifica ENTRE quais anos discretos a posição muda
   (`ANOS_SIMULACAO` é a granularidade mínima, nunca interpolada).
4. **Bisseção assume no máximo duas mudanças de estado detectáveis por
   refinamento** — um terceiro estado durante o refinamento interrompe
   com `resultado_indeterminado" em vez de tentar resolver uma árvore de
   estados mais complexa (decisão deliberada, evita over-engineering
   nesta fase).
5. **`cruzamento_fator_r`** usa a MÉDIA dos 12 meses de
   `fs12NecessariaParaLimite` como `valorEncontrado` único — quando a
   RBT12 mensal varia MUITO ao longo do ano (ex.: abertura no meio do
   ano), esse único número é uma simplificação; os 12 valores mensais
   completos continuam disponíveis em `premissas.porMes`.

## P. Próxima etapa recomendada

Com TRIBUTO → RESULTADO → CAIXA → CENÁRIOS/SENSIBILIDADE → PONTOS DE
VIRADA consolidados, a base matemática determinística está completa. A
próxima camada — Auditoria Estratégica / Motor Estratégico — pode agora
ponderar múltiplas dimensões (carga, margem, caixa, risco, fronteiras
jurídicas) usando esses pontos de virada como insumo, sem que o domínio
matemático precise ser refeito.

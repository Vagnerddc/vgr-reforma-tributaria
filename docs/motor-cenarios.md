# Motor de Cenários e Sensibilidade

> Continuação de [motor-split-payment.md](./motor-split-payment.md).
> **Nenhum motor fiscal/financeiro/caixa foi alterado. `calculo.ts`
> intocado.** Nenhum break-even, otimização automática, Motor Estratégico,
> Score, IA ou UI. 471 testes passando (441 + 30 novos), `tsc` limpo.
> Princípio: "O Motor de Cenários não responde qual é a melhor decisão.
> Ele responde o que acontece quando as premissas mudam."

## A. Arquitetura

```
src/engine/motorCenarios/
  tipos.ts          — AlteracoesCenario, CenarioAnalise, ResultadoCenario
  patch.ts           — validarAlteracoes + aplicarAlteracoes (puro, imutável)
  qualidade.ts        — piorQualidade (nunca média 0-100)
  motor.ts            — executarCenario: orquestra os motores existentes
  comparacao.ts        — compararCenarios (diferença absoluta × relativa)
  achados.ts            — detectarMudancasEntrePontos (mudança de estado)
  sensibilidade.ts        — executarSensibilidade (uma variável por vez)
```

Fluxo de `executarCenario`: `validarAlteracoes` → `aplicarAlteracoes`
(deriva um novo `CenarioEmpresa`) → `compararRegimes` (motorRegimes,
intocado) → `avaliarComparacaoConsolidada` (intocado) →
`calcularResultadoEconomicoFinanceiro` por regime (motorFinanceiro,
intocado) → `calcularImpactoCaixaDoAno` por regime × ano (split payment,
intocado, só quando há premissa de split) → consolidação de qualidade e
alertas. **Nenhuma fórmula tributária, econômica ou financeira vive em
`motorCenarios/`** — só orquestração e um `structuredClone` para
imutabilidade.

## B. Contrato de `CenarioAnalise`

`{ id, nome, descricao?, cenarioBaseId, tipo, alteracoes, origemPremissas,
status }` (tipos.ts). Não duplica `CenarioEmpresa`: só referencia
`cenarioBaseId` + `AlteracoesCenario` (patch tipado). `tipo` (baseline/
conservador/provável/otimizado_informado/personalizado) é um RÓTULO —
nunca carrega premissa automática; todo valor usado vem de `alteracoes`,
sempre explícito (testado implicitamente: nenhuma função lê `tipo` para
decidir um valor numérico).

## C. Alterações suportadas

`AlteracoesCenario` (nunca `Record<string, any>`): `receita`
(faturamentoAnual, crescimentoAnualEstimado), `custos` (itens existentes
por `categoria.chave`; `fatorEscalaCustosCreditaveisIbsCbs` e
`fatorEscalaTodosItens` para sensibilidade agregada sem inventar fórmula
de crédito própria — o crédito efetivo continua sendo derivado por
`agregarCreditoPorSistema`), `pessoas` (folhaAnual/encargosAnual/
proLaboreAnual — alimentam FS12 real), `tributario.premissas` (mesmas
chaves já lidas pelo adapter do Motor VGR) + `premissasNormativasHipoteticas`
(namespace isolado, nunca mesclado em premissas confirmadas — seção
10/11), `financeiro` (margemAlvo, percentualCustosVariaveis — repassados
a `OpcoesExecucaoCenario`, nunca ao `CenarioEmpresa`) e `splitPayment`
(mesmas premissas do módulo de split, idem).

Cada campo é um `ValorAlterado` (`{ tipo: "set"|"incremento_absoluto"|
"incremento_percentual", valor, origem, status }`) — nunca um número
solto.

## D. Imutabilidade

`aplicarAlteracoes` usa `structuredClone(base)` e só modifica a cópia —
`base` nunca é tocado. Testado explicitamente: executar dezenas de
cenários (`receita`, `pessoas`, `custos` alterados) e comparar
`JSON.stringify(base)` antes/depois — idêntico.

## E. Proveniência das premissas

Cada `ValorAlterado` carrega sua PRÓPRIA `origem`/`status` — nunca herda
nem promove o status do campo base (testado: uma alteração `status:
"estimado"` nunca produz um campo derivado `"confirmado"`, mesmo que o
campo base fosse confirmado). `premissasNormativasHipoteticas` usa
`status: "hipotese"` sempre, isolado de `tributario.premissas` (que os
motores fiscais de fato leem) — nenhuma hipótese normativa é lida por
nenhum motor fiscal nesta fase (é só exposta em
`ResultadoCenario.premissasNormativasHipoteticas`, para uso futuro).

## F. Execução dos motores

`executarCenario` chama, na ordem: `compararRegimes` →
`avaliarComparacaoConsolidada` → (por regime calculado)
`calcularResultadoEconomicoFinanceiro` → (por regime × ano, só se alguma
premissa de split foi informada) `calcularImpactoCaixaDoAno`. Testado:
o resultado do baseline (sem alterações) é byte-a-byte equivalente a
chamar `compararRegimes` diretamente.

## G. Resultado consolidado

`ResultadoCenario` referencia `ResultadoRegime[]`,
`ResultadoComparacaoConsolidado`, `ResultadoEconomicoFinanceiro` (por
regime) e `ResultadoImpactoCaixa[]` (por regime, quando disponível) —
nenhum desses é copiado internamente, só agregado em arrays/objetos
finos.

## H. Comparação entre cenários

`compararCenarios(baseline, cenario, regime, ano)` — SEMPRE um
regime/ano por chamada (quem quiser visão multi-ano/multi-regime chama
várias vezes). Diferença fiscal separa `diferencaReais` (absoluta) de
`diferencaPercentualRelativa` (relativa) — nunca misturadas (testado:
os dois números nunca são iguais, e cada um é validado pela fórmula
correta independentemente). Caixa só é comparado quando AMBOS os
cenários calcularam a dimensão — nunca comparado como zero quando um
dos lados não calculou (testado).

## I. Sensibilidade

`executarSensibilidade({ variavel, valores, cenarioBase, motoresRegime,
ano, regimeReferencia?, opcoes?, caixaMinimoOperacional? })` — varia UMA
variável por vez (seção 30 do pedido: sem busca multidimensional
automática); cada valor produz um `executarCenario` completo (reexecuta
os motores reais — nunca multiplica um resultado anterior, testado
explicitamente com faturamento cruzando faixa do Simples). Cada ponto
preserva o `ResultadoCenario` inteiro em `pontos`; `resumo` é só uma
projeção de conveniência (nunca substitui `pontos`).

## J. Variáveis suportadas

`faturamento`, `crescimento`, `creditosIbsCbs` (fator de escala sobre
custos creditáveis), `custosFixos` (fator de escala sobre todos os
itens), `folha` (propaga para FS12 → Fator R → Anexo → DAS, testado),
`custoCapital`, `percentualRecebimentosSujeitosSplit`,
`percentualTributoSegregadoSplit`. Sensibilidade de REPASSE DE PREÇO
(seção 25/59) não precisou de uma variável nova: `ResultadoAnoEconomicoFinanceiro.cenariosRepasse`
já produz os 3 pontos (0%/50%/100%) em CADA execução — reutilizado
diretamente (testado), nunca duplicado dentro de `motorCenarios/`.

## K. Mudanças descontínuas

`detectarMudancasEntrePontos` (achados.ts) compara dois pontos
CONSECUTIVOS e sinaliza, sem interpolar: `MUDANCA_REGIME_MENOR_CARGA`
(lê `comparacaoRegimes.porAno[].menorCargaComparavel`),
`MUDANCA_ANEXO_SIMPLES` (lê `memoriaCalculo` do componente `das`, onde o
anexo usado no ano é registrado pelo motor do Simples — nunca
recalculado aqui), `MARGEM_CRUZOU_ZERO` (mudança de sinal da margem de
um regime de referência), `CAPITAL_GIRO_CRUZOU_LIMITE_INFORMADO`
(transição de `financiamentoAdicionalNecessario > 0` em algum mês).
Testado com Fator R (folha variando 200k→500k, quebra real de Anexo V
para Anexo III, carga tributária caindo de forma não-linear).

## L. Multi-ano

`ANOS_SIMULACAO` (2026–2033) continua sendo a granularidade de cada
execução — `ResultadoRegime.anos`/`ResultadoEconomicoFinanceiro.anos`/
`ResultadoImpactoCaixa` (um por ano) preservados sem achatamento.
`compararCenarios` chamado ano a ano preserva diferenças que mudam ao
longo do horizonte (testado: dois cenários com crescimento diferente
produzem `diferencaReais` distinta em cada ano, nunca uma única
diferença "do período").

## M. Qualidade

`QualidadePorDimensao { fiscal, economica, caixa }` — cada dimensão é o
PIOR veredito entre todos os regimes/anos considerados (`piorQualidade`,
nunca uma média numérica). `caixa: "indisponivel"` (distinto de
`"insuficiente"`) quando NENHUMA premissa de split foi informada —
dimensão nunca calculada, diferente de "tentou calcular, faltou dado".
Testado: Fiscal alta + Caixa indisponível nunca produz uma qualidade
única "alta" escondendo a ausência de caixa.

## N. Casos parciais

Cenário sem nenhuma premissa de split: `resultadoCaixaPorRegime` fica
`undefined`, mas `resultadoRegimes`/`resultadoFinanceiroPorRegime`
continuam calculados normalmente (testado). Margem-alvo matematicamente
impossível: `ResultadoEconomicoFinanceiro` preserva o alerta do Motor
Financeiro, execução não quebra (testado). Alteração estruturalmente
inválida (receita negativa, percentual de split >100%): rejeitada com
`status: "erro_validacao"` + `errosValidacao[]` — nunca corrigida
silenciosamente (testado nos dois casos).

## O. Limitações conhecidas

1. **Premissas por ano/mês** (seção 37/38 do pedido) não têm um tipo
   dedicado nesta fase — `ValorAlterado` é sempre um único valor por
   execução. O domínio não impede evoluir para séries por ano no
   futuro (a estrutura de `AlteracoesCenario` é aditiva), mas isso não
   foi construído agora.
2. **`fatorEscalaCustosCreditaveisIbsCbs`/`fatorEscalaTodosItens`**
   representam "créditos"/"custos" como fator multiplicativo sobre
   `custos.itens` — não como um percentual direto de faturamento
   (evita inventar uma fórmula de crédito paralela à já existente em
   `creditoTributario.ts`).
3. **Sensibilidade de repasse de preço** usa os 3 pontos fixos
   (0%/50%/100%) já produzidos pelo Motor Financeiro — pontos
   intermediários (25%/75%) exigiriam expor `calcularCenarioRepasse`
   com um percentual arbitrário a partir de `motorCenarios/`, o que não
   foi feito para não duplicar a orquestração interna de
   `motorFinanceiro/motor.ts`.
4. **`MUDANCA_ANEXO_SIMPLES`** depende do texto de `memoriaCalculo` do
   componente `das` (única fonte hoje que registra o anexo usado no
   ano) — um acoplamento textual documentado, não uma leitura de campo
   estruturado dedicado.
5. **Paralelismo** (seção 45) não foi implementado — cada ponto de
   sensibilidade é `map` sequencial; como `aplicarAlteracoes` é pura e
   `executarCenario` não compartilha estado mutável, paralelizar é
   possível no futuro sem mudança de arquitetura, mas não foi otimizado
   agora (nenhuma medição indicou necessidade).
6. **Cache** (seção 46) não implementado — `versaoMotores` já registra
   `motoresRegime`/`origemIbsCbsPorRegime`/`dataAnalise` como base para
   uma chave de cache futura.

## P. Próxima etapa recomendada

Com TRIBUTO → RESULTADO → CAIXA → CENÁRIOS/SENSIBILIDADE consolidados,
o próximo passo natural é **Break-even e Pontos de Virada**: usar os
mesmos motores para procurar automaticamente o valor exato em que uma
mudança de estado ocorre (em vez de só detectar que ocorreu entre dois
pontos informados).

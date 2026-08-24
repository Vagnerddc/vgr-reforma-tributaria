# Motor Estratégico

> Continuação de [motor-achados.md](./motor-achados.md). **Nenhum motor
> fiscal/financeiro/caixa/cenários/pontos-de-virada/achados foi alterado
> (exceto uma extensão aditiva em `motorAchados/fiscal.ts`, ver seção
> D). `calculo.ts` intocado.** Nenhuma recomendação final, IA, Score ou
> otimização multidimensional. 511 testes passando (498 + 13 novos),
> `tsc` limpo. Princípio: "O Motor de Achados responde 'o que os dados
> estão revelando?'. O Motor Estratégico responde 'quais caminhos podem
> ser avaliados diante desses fatos?'." — nunca "qual caminho seguir?".

## A. Arquitetura

```
src/engine/motorEstrategico/
  tipos.ts            — AlternativaEstrategica, PlanoAlternativasEstrategicas
  contexto.ts           — ContextoEstrategico + helpers de leitura (achadosPorCodigo, qualidadeMinima...)
  regras/
    preco.ts              — AVALIAR_RECOMPOSICAO_PRECO
    creditos.ts            — AVALIAR_ESTRUTURA_CREDITOS
    fatorR.ts                — AVALIAR_FATOR_R
    regime.ts                  — AVALIAR_REGIME_TRIBUTARIO (+ conflitos)
    capitalGiro.ts               — AVALIAR_CAPITAL_GIRO
    custoFinanceiro.ts             — AVALIAR_CUSTO_FINANCEIRO
    validacaoDados.ts                — VALIDAR_DADOS_FISCAIS/BASE_LUCRO_REAL/PREMISSAS_SPLIT/COBERTURA_TRIBUTARIA
  conflitos.ts                        — MARGEM_VS_CAIXA (adicional às da regra de regime)
  cobertura.ts                         — dimensões analisadas/não aplicáveis/indisponíveis
  motor.ts                              — gerarPlanoAlternativasEstrategicas: orquestra tudo acima
```

Cada arquivo em `regras/` só LÊ achados já produzidos pelo Motor de
Achados (`RelatorioAuditoriaEstrategica.achados`) e, quando necessário,
campos já calculados de `ResultadoCenario`/`ResultadoPontoVirada` — nunca
recalcula DAS, Fator R, IRPJ, CSLL, IBS/CBS, créditos, margem, preço
necessário, capital de giro, custo financeiro ou break-even (seção 2 do
pedido).

## B. Contrato `AlternativaEstrategica`

`tipos.ts` — código estruturado (`CodigoAlternativa`, união fechada),
`achadosOrigem`/`evidencias` (rastreabilidade), `aplicabilidade`
(`aplicavel`/`potencialmente_aplicavel`/`condicionada`/`nao_aplicavel`/
`indeterminada`), `condicoes`/`dependencias`/`restricoes`,
`impactosConhecidos`/`impactosIndeterminados` (separados
explicitamente — seção 46), `cenariosRelacionados`/`pontosViradaRelacionados`
(referência, nunca cópia), `qualidade` (herdada, nunca promovida),
`premissas`, `riscos` (nunca com probabilidade/gravidade — seção 33/34),
`bloqueios` (separados de risco — seção 32), `validacoesNecessarias`.

## C. Catálogo de alternativas

7 famílias implementadas nesta fase: preço, créditos, Fator R, regime
tributário, capital de giro, custo financeiro, qualidade de dados
(4 códigos de validação). Estrutura de custos e mix de receitas
(seções 25-28) ficam declaradas no contrato (`CategoriaAlternativa`)
mas sem regra implementada nesta fase — ver Limitações (seção Q).

## D. Relação Achados → Alternativas

| Alternativa | Achados necessários (motorAchados) |
|---|---|
| `AVALIAR_RECOMPOSICAO_PRECO` | `MARGEM_REDUZIDA`/`MARGEM_NEGATIVA` **+** `REAJUSTE_PRECO_NECESSARIO` |
| `AVALIAR_ESTRUTURA_CREDITOS` | `INDICE_CREDITO_CALCULADO` **ou** `CREDITOS_INDETERMINADOS` **ou** `CREDITO_ADICIONAL_PARA_NEUTRALIZAR_REFORMA` |
| `AVALIAR_FATOR_R` | `FATOR_R_ABAIXO_LIMITE` (+ `FS12_ADICIONAL_NECESSARIA` quando existir) |
| `AVALIAR_REGIME_TRIBUTARIO` | `menorCargaComparavel` (Comparador Consolidado, lido diretamente do `ResultadoCenario` — é o próprio elemento verificável desta família, seção 19) |
| `AVALIAR_CAPITAL_GIRO` | `CAPITAL_GIRO_ADICIONAL`/`PICO_CAPITAL_GIRO`/`REDUCAO_DISPONIBILIDADE_CAIXA` |
| `AVALIAR_CUSTO_FINANCEIRO` | `CUSTO_FINANCEIRO_ADICIONAL` |
| `VALIDAR_DADOS_FISCAIS`/`VALIDAR_BASE_LUCRO_REAL`/`VALIDAR_PREMISSAS_SPLIT`/`VALIDAR_COBERTURA_TRIBUTARIA` | achados de qualidade/comparabilidade correspondentes |

Extensão aditiva necessária: `motorAchados/fiscal.ts` passou a produzir
`BASE_LUCRO_REAL_PARCIAL` a partir do alerta já existente `"Qualidade da
base fiscal: ..."` do `ResultadoRegime` do Lucro Real (mesmo padrão
textual já usado em `comparadorConsolidado.ts::alertaDeQualidadeBaseFiscal`)
— sem essa conversão, a família de validação (seção 29/77) não teria
como nascer de evidência real.

## E. Aplicabilidade

`AVALIAR_RECOMPOSICAO_PRECO`/`AVALIAR_ESTRUTURA_CREDITOS` (sem
indeterminação)/`AVALIAR_CAPITAL_GIRO`/`AVALIAR_CUSTO_FINANCEIRO` →
`potencialmente_aplicavel` ou `condicionada`. `AVALIAR_REGIME_TRIBUTARIO`
→ `aplicavel` só quando o regime de menor carga está `"comparavel"`
(nunca com ressalva/indeterminado). `AVALIAR_ESTRUTURA_CREDITOS` com
`CREDITOS_INDETERMINADOS` → `condicionada`. Validações de dados →
sempre `aplicavel` (a AÇÃO de validar é sempre aplicável quando o
problema existe).

## F. Dependências

`AVALIAR_RECOMPOSICAO_PRECO` registra `viabilidade_comercial_nao_analisada`
(seção 11). `AVALIAR_ESTRUTURA_CREDITOS` com indeterminação registra
`classificacao_completa_das_categorias_de_custo`. `AVALIAR_FATOR_R`
registra `confirmacao_de_premissa_de_folha_encargos_pro_labore`, nunca
uma ação concreta.

## G. Bloqueios

Só a família de validação de dados produz `Bloqueio` (`dados_insuficientes`)
— nunca uma alternativa fiscal/financeira "quebra" a análise; ela apenas
reflete a limitação em `qualidade`/`validacoesNecessarias`.
`AVALIAR_ESTRUTURA_CREDITOS` com créditos indeterminados registra
`premissa_nao_confirmada`. `AVALIAR_REGIME_TRIBUTARIO` registra
`regime_nao_comparavel` quando o regime de menor carga está com
ressalva/indeterminado.

## H. Riscos

`RISCO_COMERCIAL` (preço), `RISCO_TRIBUTARIO` (Fator R — mudança de
anexo), `RISCO_CAIXA` (capital de giro) — nenhum com probabilidade ou
gravidade numérica (testado implicitamente: `Risco` não tem campo de
score).

## I. Validações necessárias

`VALIDACAO_COMERCIAL` (preço, não bloqueante), `VALIDACAO_FISCAL` +
`VALIDACAO_JURIDICA` (Fator R, não bloqueantes — este motor não analisa
legislação trabalhista/previdenciária/societária, seção 18/52),
`VALIDACAO_FISCAL` bloqueante (família de qualidade de dados).

## J. Impactos conhecidos e indeterminados

`AVALIAR_RECOMPOSICAO_PRECO.impactosConhecidos` reusa diretamente
`ResultadoAnoEconomicoFinanceiro.cenariosRepasse` (0%/50%/100%, já
calculado) — `impactosIndeterminados` sempre lista elasticidade/
concorrência/volume (seção 46), nunca omitidos.

## K. Conflitos estratégicos

`TRIBUTO_VS_CAIXA`/`TRIBUTO_VS_MARGEM` nascem em `regras/regime.ts` a
partir dos achados `MENOR_TRIBUTO_NAO_COINCIDE_COM_*` (motorAchados/divergencias.ts,
já existentes); `MARGEM_VS_CAIXA` em `conflitos.ts`, a partir de
`MAIOR_MARGEM_NAO_COINCIDE_COM_MELHOR_CAIXA`. Nenhum conflito é
resolvido — `ConflitoEstrategico` só referencia as alternativas
envolvidas por id (seção 60/61, testado: teste 76 confirma que a
alternativa de regime aparece em `alternativasEnvolvidas` sem nenhuma
delas ser marcada como "melhor").

## L. Integração setorial

`aplicavelFatorR` (motor.ts, mesma lógica de `motorAchados/motor.ts`)
usa `buscarPerfil` + `classificarAnexo` — perfil habilita a
VERIFICAÇÃO, nunca cria a alternativa por si só (testado: clínica com
FS12 aplicável gera `AVALIAR_FATOR_R`; comércio com folha informada
nunca gera, porque a atividade não depende de Fator R).

## M. Qualidade

Cada alternativa herda `qualidadeMinima` das evidências ESSENCIAIS
(nunca das complementares) — nunca promovida (testado: seção 81).
Qualidade GERAL do plano é o PIOR veredito entre todas as alternativas.

## N. Cobertura

`fatorR`/`capitalGiro`/`custoFinanceiro`/`preco`/`creditos`/`regimes` →
`analisado`/`nao_aplicavel`/`indisponivel` — nunca inferido pela
ausência de alternativa daquela família (testado: sem premissa de
split, `cobertura.capitalGiro === "indisponivel"` E zero alternativas
de capital de giro coexistem, seção 84).

## O. Testes

Seções 74-86 do pedido — 13 testes em
`src/engine/motorEstrategico/__tests__/motor.test.ts`: preço, Fator R
(com verificação textual de ausência de "pró-labore" prescritivo),
conflito tributo×caixa, validação de dados incompletos, setor (saúde
vs. comércio), ponto de virada vinculado, cenário de repasse vinculado,
qualidade nunca promovida, três dimensões preservadas sem vencedor,
ausência de regra ativada, cobertura indisponível, determinismo,
ausência de linguagem prescritiva (lista de termos proibidos verificada
em todos os textos gerados, em dois cenários diferentes).

## P. Limitações conhecidas

1. **`AVALIAR_ESTRUTURA_FOLHA`, `AVALIAR_ESTRUTURA_CUSTOS`,
   `AVALIAR_MIX_RECEITAS`** (seções 17/25-28) estão declaradas no
   contrato (`CodigoAlternativa`/`CategoriaAlternativa`) mas nenhuma
   regra foi implementada nesta fase — seguem o mesmo padrão das
   demais (`RegraEstrategica`/módulo em `regras/`) quando houver achado
   correspondente disponível para ativá-las.
2. **`panorama.ts`/`oportunidadesParceiros.ts` não foram migrados**
   (seção 65/66) — mesma decisão já documentada em
   `docs/motor-achados.md`, seção N.
3. **Dedup entre alternativas não foi implementado** — diferente do
   Motor de Achados (que deduplica achados idênticos), o Motor
   Estratégico gera no máximo uma alternativa por código+ano nesta
   fase, então a deduplicação não era estritamente necessária; se o
   catálogo crescer (múltiplas regras produzindo o mesmo código para
   regimes diferentes), essa lacuna deve ser revisitada.
4. **`RegraEstrategica` (tipos.ts) é só um contrato descritivo** — as
   regras reais em `regras/*.ts` são funções diretas, não uma máquina
   de regras genérica sobre esse tipo (decisão deliberada, seção 39:
   "sem criar DSL exageradamente complexa").

## Q. Próxima etapa recomendada

Com achados, alternativas, condições, riscos, bloqueios, conflitos,
cenários e pontos de virada agora estruturados de ponta a ponta, a
próxima camada natural — fora do escopo desta fase — é a camada de
recomendação final (síntese de UMA alternativa preferida por
contexto), que consumirá `PlanoAlternativasEstrategicas` como insumo.
